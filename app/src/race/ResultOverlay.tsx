import { useMemo, useRef } from 'react';
import type { CarTick } from '../mock/mockFeed';
import { pickWinner, type Racer } from '../game/session';
import type { Settlement } from '../game/useMoneyFlow';
import { ShareButton, ShareCard, type MomentData } from '../share/KillCard';

export function ResultOverlay({
  cars,
  field,
  settlement,
  settling,
  onReplay,
  onExit,
}: {
  cars: CarTick[];
  field: Racer[];
  settlement: Settlement | null;
  settling: boolean;
  onReplay: () => void;
  onExit: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const winner = useMemo(() => pickWinner(field, cars), [field, cars]);
  const winnerCrashed = cars.find((c) => c.id === winner.combo.id)?.status === 'crashed';

  const ranked = useMemo(() => {
    return [...cars].sort((a, b) => {
      const rank = (c: CarTick) => (c.status === 'cashed' ? 2 : c.status === 'crashed' ? 0 : 1);
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      return b.payoutIfEndsNow - a.payoutIfEndsNow;
    });
  }, [cars]);

  const amount = settlement?.amount ?? 0;
  const youWon = settlement?.youWon ?? false;

  const card: MomentData = {
    id: 'winner',
    kind: 'cash',
    handle: winner.combo.handle,
    color: winner.combo.color,
    colorRgb: winner.combo.colorRgb,
    tagline: winner.combo.tagline,
    headline: 'WINNER',
    detail: settlement ? `banked the $${amount} prize` : 'taking the prize...',
    minuteLabel: 'FT',
    multiplier: winner.combo.multiplier,
    potLine: settlement
      ? youWon
        ? `you received $${amount} USDC`
        : `${winner.combo.handle} received $${amount} USDC`
      : 'settling on-chain...',
    isYou: winner.isYou,
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:items-center">
      <div className="my-auto w-full max-w-md">
        <div className="mb-3 flex justify-center">
          <ShareCard ref={cardRef} moment={card} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-track-panel p-4 shadow-2xl">
          {winnerCrashed && (
            <div className="mb-2 rounded-xl bg-white/[0.04] px-3 py-2 text-center text-[11px] font-semibold text-white/55 ring-1 ring-white/8">
              Every car crashed. The one that got closest to the finish takes the prize.
            </div>
          )}
          <SettlementLine settlement={settlement} settling={settling} />

          <div className="mt-3 space-y-1.5">
            {ranked.map((c, i) => {
              const isWinner = c.id === winner.combo.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${
                    isWinner ? 'bg-cash/[0.08] ring-cash/25' : 'bg-white/[0.03] ring-white/5'
                  }`}
                >
                  <span className="w-4 text-center font-mono text-xs text-white/40">{i + 1}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span className="flex-1 truncate text-sm font-bold" style={{ color: c.color }}>
                    {c.handle}
                  </span>
                  {c.status === 'crashed' ? (
                    <span className="font-mono text-xs font-bold text-crash">WRECKED</span>
                  ) : isWinner && settlement ? (
                    <span className="font-mono text-sm font-bold text-cash">${amount}</span>
                  ) : (
                    <span className="font-mono text-xs font-bold text-white/50">
                      {c.status === 'cashed' ? 'CASHED' : 'alive'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <ShareButton
              moment={card}
              cardRef={cardRef}
              label="Share result"
              className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            />
            <button
              onClick={onReplay}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white/80 transition active:scale-95"
            >
              Again
            </button>
          </div>
          <button
            onClick={onExit}
            className="mt-2 w-full rounded-2xl py-2.5 text-xs font-semibold text-white/40 transition active:scale-[0.99]"
          >
            Back to start
          </button>
        </div>
      </div>
    </div>
  );
}

function SettlementLine({ settlement, settling }: { settlement: Settlement | null; settling: boolean }) {
  if (!settlement) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        <span className="text-sm font-semibold text-white/70">
          {settling ? 'Paying the winner on-chain...' : 'Full time'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-cash/[0.06] px-3 py-2.5 ring-1 ring-cash/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-cash">
          {settlement.youWon ? `You received $${settlement.amount} USDC` : `Paid $${settlement.amount} to ${settlement.winner.combo.handle}`}
        </span>
        <span className="rounded bg-cash/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cash">paid</span>
      </div>
      <a
        href={`https://solscan.io/tx/${settlement.signature}?cluster=devnet`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate font-mono text-[10px] text-white/35 underline decoration-white/15"
      >
        {settlement.signature} &middot; view on Solscan (mock)
      </a>
    </div>
  );
}
