import type { Config } from '../config.js';
import type { MatchTick } from './types.js';
import { ReplaySource } from './replaySource.js';
import { LiveSource } from './liveSource.js';

export interface SourceHandlers {
  onTick: (tick: MatchTick) => void;
  onEnd?: () => void;
}

export interface MatchSource {
  start(handlers: SourceHandlers): void;
  stop(): void;
  describe(): string;
}

export function createSource(config: Config): MatchSource {
  return config.source === 'live' ? new LiveSource(config) : new ReplaySource(config);
}
