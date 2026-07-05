import type { MatchTick } from '../mock/mockFeed';

const HOME = 'ARG';
const AWAY = 'FRA';

export function Scoreboard({ tick }: { tick: MatchTick | null }) {
  const minute = tick?.minute ?? 0;
  const isFt = tick ? tick.phase === 'full-time' : false;
  const clock = isFt ? 'FT' : `${Math.max(0, minute)}'`;
  const home = tick?.score.home ?? 0;
  const away = tick?.score.away ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-track-bg/85 px-3 pb-2.5 pt-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black tracking-tight">
            <span className="text-brand">COMBO</span>
            <span className="text-white">RACE</span>
          </span>
          <span className="hidden text-[10px] text-white/30 min-[360px]:inline">4 bets, 1 track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${isFt ? 'bg-white/30' : 'live-dot bg-crash'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            {isFt ? 'FULL TIME' : 'LIVE'}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80">{HOME}</span>
          <span className="font-mono text-xl font-black tabular-nums text-white">
            {home}
            <span className="mx-1 text-white/30">-</span>
            {away}
          </span>
          <span className="text-sm font-bold text-white/80">{AWAY}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatPill label="corners" value={tick?.stats.corners ?? 0} />
          <StatPill label="cards" value={tick?.stats.cards ?? 0} />
          <div className="text-right">
            <div className="font-mono text-sm font-bold tabular-nums text-white">{clock}</div>
            <div className="text-[9px] uppercase tracking-wide text-white/30">prize ${tick?.pot ?? 0}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-mono text-sm font-bold tabular-nums text-white/70">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/25">{label}</div>
    </div>
  );
}
