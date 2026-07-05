import { forwardRef, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { difficultyLabel } from '../mock/combos';
import colors, { cashRgb, crashRgb } from '../theme/colors';

export interface MomentData {
  id: string;
  kind: 'crash' | 'cash';
  handle: string;
  color: string;
  colorRgb: string;
  tagline: string;
  headline: string;
  detail: string;
  minuteLabel: string;
  multiplier: number;
  potLine: string;
  isYou: boolean;
}

async function capture(node: HTMLElement): Promise<Blob | null> {
  return toBlob(node, { pixelRatio: 2.4, cacheBust: true, backgroundColor: '#06060c' });
}

async function shareNode(node: HTMLElement, moment: MomentData): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await capture(node);
  if (!blob) return 'failed';
  const file = new File([blob], `comborace-${moment.kind}-${moment.handle}.png`, { type: 'image/png' });
  const text =
    moment.kind === 'crash'
      ? `${moment.handle} got WRECKED on ComboRace. ${moment.detail}`
      : `${moment.handle} CASHED on ComboRace. ${moment.detail}`;

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text, title: 'ComboRace' });
      return 'shared';
    } catch {
      // User dismissed the sheet or the platform refused; fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return 'saved';
}

export const ShareCard = forwardRef<HTMLDivElement, { moment: MomentData }>(function ShareCard({ moment }, ref) {
  const crash = moment.kind === 'crash';
  const accent = crash ? colors.crash : colors.cash;
  const accentRgb = crash ? crashRgb : cashRgb;

  return (
    <div
      ref={ref}
      style={{
        width: 320,
        boxSizing: 'border-box',
        padding: 22,
        borderRadius: 26,
        background: `radial-gradient(120% 80% at 50% -10%, rgba(${moment.colorRgb},0.22), transparent 60%), linear-gradient(180deg, #10101c, #06060c)`,
        border: `1px solid rgba(${accentRgb},0.35)`,
        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em' }}>
          <span style={{ color: '#7E5DFE' }}>COMBO</span>
          <span style={{ color: '#fff' }}>RACE</span>
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.22em',
            padding: '4px 8px',
            borderRadius: 999,
            color: accent,
            background: `rgba(${accentRgb},0.14)`,
            border: `1px solid rgba(${accentRgb},0.4)`,
          }}
        >
          {crash ? 'CRASH CARD' : 'CASH CARD'}
        </span>
      </div>

      <div style={{ fontSize: 44, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.03em', color: accent }}>
        {moment.headline}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: moment.color,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 1px 2px rgba(0, 0, 0, 0.4)',
          }}
        />
        <span style={{ fontSize: 19, fontWeight: 800, color: moment.color }}>{moment.handle}</span>
        {moment.isYou && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.12em',
              padding: '2px 6px',
              borderRadius: 6,
              color: '#fff',
              background: 'rgba(126,93,254,0.35)',
            }}
          >
            YOU
          </span>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{moment.detail}</div>

      <div
        style={{
          marginTop: 18,
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
        }}
      >
        <Cell label="minute" value={moment.minuteLabel} />
        <Cell label="difficulty" value={difficultyLabel(moment.multiplier).text} />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 12px',
          borderRadius: 14,
          background: `rgba(${accentRgb},0.1)`,
          border: `1px solid rgba(${accentRgb},0.25)`,
          fontSize: 13,
          fontWeight: 700,
          color: accent,
        }}
      >
        {moment.potLine}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        &ldquo;{moment.tagline}&rdquo; &middot; no house &middot; settled on-chain
      </div>
    </div>
  );
});

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export function ShareButton({
  moment,
  cardRef,
  className,
  label = 'Share',
}: {
  moment: MomentData;
  cardRef: React.RefObject<HTMLDivElement>;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'shared' | 'saved'>('idle');

  const onClick = async () => {
    if (!cardRef.current || state === 'working') return;
    setState('working');
    const result = await shareNode(cardRef.current, moment);
    setState(result === 'shared' ? 'shared' : result === 'saved' ? 'saved' : 'idle');
    if (result !== 'failed') window.setTimeout(() => setState('idle'), 1800);
  };

  const text = state === 'working' ? 'rendering...' : state === 'shared' ? 'shared' : state === 'saved' ? 'saved' : label;

  return (
    <button
      onClick={onClick}
      className={
        className ??
        'rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50'
      }
      disabled={state === 'working'}
    >
      {text}
    </button>
  );
}

// Transient bottom sheet fired on each crash/cash. The card stays static (the wrapper does the
// slide) so the html-to-image capture target is never mid-animation.
export function MomentSheet({ moment, onClose }: { moment: MomentData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
      <div className="moment-pop pointer-events-auto w-full max-w-sm">
        <ShareCard ref={cardRef} moment={moment} />
        <div className="mt-2 flex gap-2">
          <ShareButton
            moment={moment}
            cardRef={cardRef}
            className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          />
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white/70 transition active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
