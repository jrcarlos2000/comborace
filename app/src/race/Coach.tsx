import { useState } from 'react';

// First-run, tap-through explainer of the one rule that makes the race legible. Shows once, gated
// on a localStorage flag, and is skippable. Kept out of the way of the race behind a dim scrim.
const COACH_KEY = 'comborace.coach.v1';

const STEPS: { accent: string; title: string; body: string }[] = [
  {
    accent: 'text-grey-950',
    title: 'Position = your live chance',
    body: 'Each car sits at the live chance its combo still cashes. Further right means closer to paying out.',
  },
  {
    accent: 'text-crash',
    title: '0% and your car crashes',
    body: 'A leg dies (a second goal kills an Under, say) and the car detonates on the spot at the crash zone.',
  },
  {
    accent: 'text-cash',
    title: '100% and you cash',
    body: 'Every leg lands, the car crosses the finish line, and the pot goes to the survivor at full time.',
  },
];

export function hasSeenCoach(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(COACH_KEY, '1');
  } catch {
    // storage unavailable; the overlay simply shows again next time
  }
}

export function Coach({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  const finish = () => {
    markSeen();
    onDone();
  };

  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-grey-950/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="moment-pop w-full max-w-sm rounded-3xl border border-grey-200 bg-track-panel p-5 shadow-card-drop">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-grey-400">how to read the track</span>
          <button onClick={finish} className="btn-ghost text-[11px] font-semibold" aria-label="Skip">
            Skip
          </button>
        </div>

        <div className={`mt-4 text-xl font-black tracking-tight ${s.accent}`}>{s.title}</div>
        <p className="mt-2 text-sm leading-relaxed text-grey-600">{s.body}</p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-brand' : 'w-1.5 bg-grey-200'}`}
              />
            ))}
          </div>
          <button
            onClick={() => (last ? finish() : setStep((n) => n + 1))}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
