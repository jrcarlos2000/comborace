import type { Config } from '../config.js';
import { log } from '../log.js';
import type { MatchTick } from './types.js';
import type { MatchSource, SourceHandlers } from './source.js';
import { MatchEngine } from '../txline/index.js';
import type { RawSnapshot } from '../txline/index.js';

// Live TxLINE source. Subscribes to the odds + scores SSE streams for one fixture, folds the
// latest of each into a raw snapshot, and runs it through the same MatchEngine the replay path
// uses so live and replay emit identical MatchTicks.
//
// STATUS: skeleton. Blocked on (1) a valid TxLINE guest/JWT token and (2) the real SSE frame
// shape, both of which land with tonight's recorded match. The field extraction lives in
// src/txline/{scoreMapping,oddsMapping}.ts and is shared with replay, so finalizing the raw
// path there lights this up with no changes here.
//
// TODO(real-sample):
//   - Confirm auth: guest JWT vs Bearer, and the token acquisition flow (quickstart).
//   - Confirm SSE endpoints and whether the free World Cup tier exposes in-play odds.
//   - Confirm the `data:` frame envelope (is each frame a full snapshot or a delta?).
//   - Filter frames to config.fixtureId.
export class LiveSource implements MatchSource {
  private readonly config: Config;
  private readonly engine = new MatchEngine();
  private readonly controller = new AbortController();
  private latestOdds: unknown = null;
  private latestScores: unknown = null;
  private minute = 0;
  private handlers: SourceHandlers | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  describe(): string {
    return `live TxLINE ${this.config.txlineBase} fixture=${this.config.fixtureId ?? '(unset)'}`;
  }

  start(handlers: SourceHandlers): void {
    this.handlers = handlers;
    if (!this.config.fixtureId) {
      log.warn('live: no fixture id set (--fixture / FIXTURE_ID); nothing to subscribe to');
    }
    if (!this.config.txlineToken) {
      log.warn('live: no TXLINE_TOKEN set; the free World Cup tier may 401 without a guest JWT');
    }
    void this.subscribe(`${this.config.txlineBase}/api/odds/stream`, (payload) => {
      this.latestOdds = payload;
      this.emit();
    });
    void this.subscribe(`${this.config.txlineBase}/api/scores/stream`, (payload) => {
      this.latestScores = payload;
      this.emit();
    });
  }

  stop(): void {
    this.controller.abort();
  }

  private emit(): void {
    if (!this.handlers) return;
    if (this.latestOdds === null && this.latestScores === null) return;
    this.minute += 1;
    const snapshot: RawSnapshot = { t: Date.now(), odds: this.latestOdds, scores: this.latestScores };
    const tick: MatchTick = this.engine.build(snapshot, this.minute);
    this.handlers.onTick(tick);
  }

  private async subscribe(url: string, onFrame: (payload: unknown) => void): Promise<void> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (this.config.txlineToken) headers.Authorization = `Bearer ${this.config.txlineToken}`;

    try {
      const res = await fetch(url, { headers, signal: this.controller.signal });
      if (!res.ok || !res.body) {
        log.error(`live: ${url} -> ${res.status} ${res.statusText}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const payload = parseSseData(rawEvent);
          if (payload !== null) onFrame(payload);
          sep = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if (!this.controller.signal.aborted) log.error(`live: stream error on ${url}`, err);
    }
  }
}

// Extract and JSON-parse the concatenated `data:` lines of one SSE event block.
function parseSseData(block: string): unknown {
  const dataLines = block
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart());
  if (dataLines.length === 0) return null;
  const joined = dataLines.join('\n');
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}
