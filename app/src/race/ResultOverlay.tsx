import { useEffect, useMemo, useRef, useState } from 'react';
import type { CarTick } from '../mock/mockFeed';
import { pickWinner, type Racer } from '../game/session';
import type { Settlement } from '../game/useMoneyFlow';
import { ShareButton, ShareOnXButton, ShareCard, type MomentData } from '../share/KillCard';

// The thin on-chain track fee (see the License / flywheel screen): 2% of the pot, well under a
// book's compounded combo vig. Surfaced here so the money model is visible at the point of payout.
const TRACK_FEE_RATE = 0.02;

// A real Solana signature is base58; the mock escrow returns "mock-claim-N", which is not, so it
// would 404 on Solscan. Anything that is not a plausible base58 signature stays plain text.
function isRealSignature(sig: string): boolean {
  return !sig.startsWith('mock') && /^[1-9A-HJ-NP-Za-km-z]{32,90}$/.test(sig);
}

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

          {settlement && <TrackFee pot={amount} />}

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
                  <span className="car-chip h-2.5 w-2.5" style={{ background: c.color }} />
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
              className="btn-primary flex-1 py-3 text-sm"
            />
            <ShareOnXButton moment={card} className="btn-secondary px-3 py-3 text-sm" />
            <button onClick={onReplay} className="btn-secondary px-4 py-3 text-sm">
              Again
            </button>
          </div>
          <button onClick={onExit} className="btn-ghost mt-2 w-full py-2.5 text-xs font-semibold">
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

  const real = isRealSignature(settlement.signature);

  return (
    <div className="rounded-2xl bg-cash/[0.06] px-3 py-2.5 ring-1 ring-cash/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-cash">
          {settlement.youWon ? `You received $${settlement.amount} USDC` : `Paid $${settlement.amount} to ${settlement.winner.combo.handle}`}
        </span>
        <span className="rounded bg-cash/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cash">paid</span>
      </div>
      {real ? (
        <a
          href={`https://solscan.io/tx/${settlement.signature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-[10px] text-white/35 underline decoration-white/15"
        >
          {settlement.signature} &middot; view on Solscan
        </a>
      ) : (
        <span className="mt-1 block truncate font-mono text-[10px] text-white/30">
          settlement simulated &middot; no on-chain tx in this build
        </span>
      )}
    </div>
  );
}

// Ticks the 2% track fee up from zero once the pot settles, so the money model is visible.
function TrackFee({ pot }: { pot: number }) {
  const target = Math.round(pot * TRACK_FEE_RATE * 100) / 100;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setDisplay(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        track fee <span className="text-white/25">2% vs a book&apos;s 20%+ vig</span>
      </div>
      <div className="font-mono text-sm font-bold tabular-nums text-white/70">${display.toFixed(2)}</div>
    </div>
  );
}
