import { createMockFeed, type MatchTick } from '../mock/mockFeed';
import type { ComboDef } from '../mock/combos';

export type FeedSource = 'server' | 'local';
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

export function createMatchFeed(opts: MatchFeedOptions): MatchFeed {
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
