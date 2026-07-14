import type { ReactNode } from 'react';
import type { MatchTick } from '../mock/mockFeed';

// The bundled wallet-free replay is a real recorded match: Mexico vs England (final 2-3).
const HOME = 'MEX';
const AWAY = 'ENG';

export function Scoreboard({
  tick,
  feed,
  action,
  live = false,
}: {
  tick: MatchTick | null;
  feed?: ReactNode;
  action?: ReactNode;
  // True only when a real live feed is attached; a replay says "replay", not "live".
  live?: boolean;
}) {
  const minute = tick?.minute ?? 0;
  const isFt = tick ? tick.phase === 'full-time' : false;
  const clock = isFt ? 'FT' : `${Math.max(0, minute)}'`;
  const home = tick?.score.home ?? 0;
  const away = tick?.score.away ?? 0;
  const stateLabel = isFt ? 'FULL TIME' : live ? 'LIVE' : 'REPLAY';

  return (
    <header className="sticky top-0 z-30 border-b border-grey-200/70 bg-track-bg/85 px-3 pb-2.5 pt-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-black tracking-tight">
            <span className="text-brand">RED</span>
            <span className="text-grey-950">LINE</span>
          </span>
          {feed}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isFt ? 'bg-grey-300' : live ? 'live-dot bg-crash' : 'bg-grey-300'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-grey-500">{stateLabel}</span>
          </div>
          {action}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-grey-50 px-3 py-2 ring-1 ring-grey-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-grey-700">{HOME}</span>
          <span className="font-mono text-xl font-black tabular-nums text-grey-950">
            {home}
            <span className="mx-1 text-grey-300">-</span>
            {away}
          </span>
          <span className="text-sm font-bold text-grey-700">{AWAY}</span>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold tabular-nums text-grey-950">{clock}</div>
          <div className="text-[10px] uppercase tracking-wide text-grey-400">
            prize <span className="font-semibold tabular-nums text-grey-600">${tick?.pot ?? 0}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
