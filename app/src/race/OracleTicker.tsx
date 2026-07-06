import type { FeedEvent, MatchTick } from '../mock/mockFeed';

// Proof-of-oracle strip: the raw incoming TxLINE de-vigged Pct for every market the field is
// riding, alongside the minute and score. This is the number that places the cars, shown straight
// so a viewer can see it is a real feed reading, not a game engine.
export function OracleTicker({ tick }: { tick: MatchTick | null }) {
  if (!tick) return null;

  const seen = new Set<string>();
  const markets: { short: string; pct: number; status: 'pending' | 'won' | 'lost' }[] = [];
  for (const car of tick.cars) {
    for (const leg of car.legs) {
      if (seen.has(leg.short)) continue;
      seen.add(leg.short);
      markets.push({ short: leg.short, pct: leg.pct, status: leg.status });
    }
  }

  return (
    <div className="px-3 pb-1.5">
      <div className="surface-card flex items-center gap-2 px-3 py-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-grey-500">TxLINE Pct</span>
          <span className="font-mono text-[9px] tabular-nums text-grey-400">
            {tick.minute}&apos; {tick.score.home}-{tick.score.away}
          </span>
        </div>
        <div className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto">
          {/* A pending market that is currently on track to land (Pct >= 50%) is the live,
              active reading, so it carries the accent; a won leg is a settled positive outcome
              (green) and a dead leg is a crash (red). Unlikely pending markets stay muted grey. */}
          {markets.map((m) => (
            <span
              key={m.short}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold shadow-pill-highlight ring-1 ${
                m.status === 'won'
                  ? 'bg-cash/12 text-cash ring-cash/30'
                  : m.status === 'lost'
                    ? 'bg-crash/12 text-crash ring-crash/30 line-through'
                    : m.pct >= 0.5
                      ? 'bg-brand/12 text-brand ring-brand/30'
                      : 'bg-grey-100 text-grey-600 ring-grey-200'
              }`}
            >
              <span>{m.short}</span>
              <span className="font-mono tabular-nums text-grey-800">{Math.round(m.pct * 100)}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface OracleFlash {
  id: string;
  tone: 'crash' | 'cash';
  text: string;
}

// Reads the tick's own crash / cash / leg events into a one-line "the oracle did this" cause,
// linking the goal, the leg it resolved and the Pct it snapped to.
export function selectOracleFlash(
  events: FeedEvent[],
  score: { home: number; away: number },
  minute: number,
): OracleFlash | null {
  const legEvents = events.filter((e): e is Extract<FeedEvent, { type: 'leg' }> => e.type === 'leg');
  const at = `${score.home}-${score.away}`;

  const crash = events.find((e): e is Extract<FeedEvent, { type: 'crash' }> => e.type === 'crash');
  if (crash) {
    const dead = legEvents.find((l) => l.carId === crash.carId && l.result === 'lost');
    const label = (dead?.label ?? crash.deadLegLabel).toUpperCase();
    return { id: `${crash.carId}-${minute}`, tone: 'crash', text: `GOAL ${at} -> ${label} OUT -> Pct 0%` };
  }

  const cash = events.find((e): e is Extract<FeedEvent, { type: 'cash' }> => e.type === 'cash');
  if (cash) {
    const won = legEvents.filter((l) => l.carId === cash.carId && l.result === 'won').slice(-1)[0];
    const label = (won?.label ?? 'all legs').toUpperCase();
    return { id: `${cash.carId}-${minute}`, tone: 'cash', text: `GOAL ${at} -> ${label} HIT -> Pct 100%` };
  }

  return null;
}

export function OracleFlashToast({ flash }: { flash: OracleFlash }) {
  const crash = flash.tone === 'crash';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[150px] z-30 flex justify-center px-4">
      <div
        className={`oracle-flash rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-bold tabular-nums backdrop-blur-md ${
          crash ? 'border-crash/40 bg-crash/10 text-crash' : 'border-cash/40 bg-cash/10 text-cash'
        }`}
      >
        {flash.text}
      </div>
    </div>
  );
}
