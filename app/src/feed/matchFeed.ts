import { createMockFeed, type MatchTick } from '../mock/mockFeed';
import type { ComboDef } from '../mock/combos';

export type FeedSource = 'server' | 'local' | 'replay';
export type FeedStatus = 'connecting' | 'live' | 'local';

export interface MatchFeedOptions {
  // 'server' streams the replay over WebSocket and falls back to the mock if it cannot
  // reach the server. 'local' skips the socket entirely (used for the drafted lobby field,
  // which the recorded server stream does not know about).
  source?: FeedSource;
  combos?: ComboDef[];
  wsUrl?: string;
  connectTimeoutMs?: number;
  onTick: (tick: MatchTick) => void;
  onEnd?: () => void;
  onStatus?: (status: FeedStatus) => void;
}

export interface MatchFeed {
  start: () => void;
  stop: () => void;
}

function isMatchTick(value: unknown): value is MatchTick {
  if (value === null || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.minute === 'number' &&
    typeof t.whistle === 'number' &&
    Array.isArray(t.cars) &&
    typeof t.phase === 'string'
  );
}

function defaultWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL;
  if (typeof override === 'string' && override !== '') return override;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

// The recorded stream carries no end-of-match signal, so the client derives it: the match is
// over once the tick has run past the whistle plus the stoppage window the mock also uses.
function isTerminal(tick: MatchTick): boolean {
  return tick.minute >= tick.whistle + 3;
}

function createServerFeed(opts: MatchFeedOptions): MatchFeed {
  const wsUrl = opts.wsUrl ?? defaultWsUrl();
  const connectTimeoutMs = opts.connectTimeoutMs ?? 2500;
  const idleEndMs = 2600;

  let ws: WebSocket | null = null;
  let fallback: MatchFeed | null = null;
  let stopped = false;
  let receiving = false;
  let ended = false;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearConnectTimer(): void {
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  }

  function clearIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function teardownSocket(): void {
    clearConnectTimer();
    clearIdleTimer();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // socket already closing; nothing to do
      }
      ws = null;
    }
  }

  function finish(): void {
    if (ended || stopped) return;
    ended = true;
    clearIdleTimer();
    opts.onEnd?.();
  }

  function startFallback(): void {
    if (stopped || fallback) return;
    fallback = createMockFeed({
      combos: opts.combos,
      onTick: opts.onTick,
      onEnd: opts.onEnd,
    });
    opts.onStatus?.('local');
    fallback.start();
  }

  // A late joiner receives only the held final frame, so a full-time tick that then goes quiet
  // must still settle the race.
  function armIdleEnd(tick: MatchTick): void {
    clearIdleTimer();
    if (tick.phase !== 'full-time') return;
    idleTimer = setTimeout(finish, idleEndMs);
  }

  return {
    start(): void {
      if (stopped || ws || fallback) return;
      opts.onStatus?.('connecting');
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        startFallback();
        return;
      }

      connectTimer = setTimeout(() => {
        if (!receiving && !stopped) {
          teardownSocket();
          startFallback();
        }
      }, connectTimeoutMs);

      ws.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        } catch {
          return;
        }
        if (!isMatchTick(parsed)) return;
        if (!receiving) {
          receiving = true;
          clearConnectTimer();
          opts.onStatus?.('live');
        }
        opts.onTick(parsed);
        if (isTerminal(parsed)) finish();
        else armIdleEnd(parsed);
      };

      ws.onerror = () => {
        if (!receiving && !stopped) {
          teardownSocket();
          startFallback();
        }
      };

      ws.onclose = () => {
        if (!receiving && !stopped) {
          teardownSocket();
          startFallback();
        } else if (receiving) {
          finish();
        }
      };
    },
    stop(): void {
      stopped = true;
      teardownSocket();
      if (fallback) {
        fallback.stop();
        fallback = null;
      }
    },
  };
}

// Replays a recorded real match bundled as a static JSON file (app/public/real-match.json), so the
// wallet-free landing plays a genuine TxLINE recording with no server. Falls back to the synthetic
// mock if the file cannot be fetched.
function createFileReplayFeed(opts: MatchFeedOptions, url = '/real-match.json'): MatchFeed {
  const tickMs = 450;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fallback: MatchFeed | null = null;

  function startFallback(): void {
    if (stopped || fallback) return;
    fallback = createMockFeed({ combos: opts.combos, onTick: opts.onTick, onEnd: opts.onEnd });
    opts.onStatus?.('local');
    fallback.start();
  }

  function play(ticks: MatchTick[]): void {
    let i = 0;
    opts.onStatus?.('local');
    const step = (): void => {
      if (stopped || i >= ticks.length) return;
      const tick = ticks[i++];
      opts.onTick(tick);
      if (isTerminal(tick)) {
        opts.onEnd?.();
        return;
      }
      timer = setTimeout(step, tickMs);
    };
    step();
  }

  return {
    start(): void {
      if (stopped) return;
      fetch(url)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (stopped) return;
          const ticks = Array.isArray(data) ? data.filter(isMatchTick) : [];
          if (ticks.length === 0) startFallback();
          else play(ticks);
        })
        .catch(() => startFallback());
    },
    stop(): void {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (fallback) {
        fallback.stop();
        fallback = null;
      }
    },
  };
}

export function createMatchFeed(opts: MatchFeedOptions): MatchFeed {
  if ((opts.source ?? 'server') === 'replay') return createFileReplayFeed(opts);
  if ((opts.source ?? 'server') === 'local') {
    const feed = createMockFeed({ combos: opts.combos, onTick: opts.onTick, onEnd: opts.onEnd });
    return {
      start(): void {
        opts.onStatus?.('local');
        feed.start();
      },
      stop(): void {
        feed.stop();
      },
    };
  }
  return createServerFeed(opts);
}
