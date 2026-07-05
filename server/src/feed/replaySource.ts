import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../config.js';
import { log } from '../log.js';
import { isMatchTick, type MatchTick } from './types.js';
import type { MatchSource, SourceHandlers } from './source.js';
import { MatchEngine } from '../txline/index.js';
import type { RawSnapshot } from '../txline/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SAMPLE = path.resolve(HERE, '..', '..', '..', 'data', 'sample-match.jsonl');

// Fallback per-tick spacing when a raw record carries no timestamp delta. Kept short so the
// whole arc lands inside a minute of watch time; the render smoothing absorbs the faster ticks.
const MOCK_TICK_MS = 450;

type Record =
  | { kind: 'tick'; tick: MatchTick }
  | { kind: 'raw'; raw: RawSnapshot }
  | { kind: 'skip' };

// Replays a recorded JSONL as a MatchTick stream. Two on-disk formats are accepted per line:
//   - a MatchTick object (a captured feed, streamed verbatim, exact shape guaranteed)
//   - a raw TxLINE snapshot { t, odds, scores } from scripts/record-match.mjs, run through
//     the txline MatchEngine to produce a MatchTick.
// Files are homogeneous in practice; classification is per line so a stray line never throws.
export class ReplaySource implements MatchSource {
  private readonly file: string;
  private readonly speed: number;
  private readonly loop: boolean;
  private records: Record[] = [];
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Config) {
    this.file = config.replayFile ?? DEFAULT_SAMPLE;
    this.speed = config.speed;
    this.loop = config.loop;
  }

  describe(): string {
    return `replay ${this.file} at ${this.speed}x${this.loop ? ' (loop)' : ''}`;
  }

  private load(): void {
    if (!fs.existsSync(this.file)) {
      throw new Error(`replay file not found: ${this.file}`);
    }
    const lines = fs.readFileSync(this.file, 'utf8').split('\n');
    const records: Record[] = [];
    let bad = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        bad++;
        continue;
      }
      if (isMatchTick(parsed)) {
        records.push({ kind: 'tick', tick: parsed });
      } else if (parsed !== null && typeof parsed === 'object' && ('odds' in parsed || 'scores' in parsed)) {
        records.push({ kind: 'raw', raw: parsed as RawSnapshot });
      } else {
        bad++;
      }
    }
    this.records = records;
    if (bad > 0) log.warn(`replay: skipped ${bad} unparseable/unknown line(s) in ${this.file}`);
    if (records.length === 0) throw new Error(`replay file has no usable ticks: ${this.file}`);
  }

  start(handlers: SourceHandlers): void {
    this.load();
    log.info(`replay: ${this.records.length} record(s) loaded from ${path.basename(this.file)}`);
    void this.run(handlers);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      this.timer = setTimeout(resolve, ms);
    });
  }

  private async run(handlers: SourceHandlers): Promise<void> {
    do {
      const engine = new MatchEngine();
      let prevRawT: number | null = null;
      let fallbackMinute = 0;
      let first = true;

      for (const rec of this.records) {
        if (this.stopped) break;

        let tick: MatchTick | null = null;
        let waitMs = first ? 0 : MOCK_TICK_MS / this.speed;

        if (rec.kind === 'tick') {
          tick = rec.tick;
        } else if (rec.kind === 'raw') {
          const t = typeof rec.raw.t === 'number' ? rec.raw.t : null;
          if (!first && prevRawT !== null && t !== null) waitMs = Math.max(0, ((t - prevRawT) * 1000) / this.speed);
          if (t !== null) prevRawT = t;
          fallbackMinute += 1;
          tick = engine.build(rec.raw, fallbackMinute);
        }
        first = false;

        await this.sleep(waitMs);
        if (this.stopped) break;
        if (tick) handlers.onTick(tick);
      }
    } while (this.loop && !this.stopped);

    if (!this.stopped) handlers.onEnd?.();
  }
}
