export function Landing({
  onWatch,
  onLobby,
  onFlywheel,
}: {
  onWatch: () => void;
  onLobby: () => void;
  onFlywheel: () => void;
}) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-hidden px-6 pb-8 pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-40 opacity-70">
        <div className="mx-auto h-full max-w-xs rounded-full bg-brand/20 blur-[70px]" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-grey-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-grey-500 shadow-pill-highlight">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          recorded replay
          <span className="h-1 w-1 rounded-full bg-grey-300" />
          TxLINE odds
        </span>

        <h1 className="text-[44px] font-black leading-[0.92] tracking-tight">
          <span className="text-grey-950">COMBO</span>
          <span className="text-grey-500">RACE</span>
        </h1>
        <p className="mt-4 max-w-[20rem] text-base leading-relaxed text-grey-600">
          The only game where the oracle&apos;s de-vigged number is a thing you
          <span className="font-semibold text-grey-900"> watch move, and explode.</span>
        </p>
        <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-grey-400">
          Each car is a soccer parlay. Its spot on the track is the live chance it still cashes. A
          goal drops, your car surges to the line, your friend&apos;s nose-dives to zero.
        </p>

        <div className="mt-9 w-full max-w-xs space-y-3">
          <button onClick={onWatch} className="btn-hero w-full flex-col py-4 text-base tracking-tight">
            Watch a race
            <span className="mt-0.5 block text-[11px] font-medium tracking-normal text-white/75">
              instant replay, no wallet
            </span>
          </button>
          <button onClick={onLobby} className="btn-secondary w-full py-3.5 text-sm">
            Enter a private lobby
          </button>
        </div>

        <div className="mt-11 grid w-full max-w-xs grid-cols-3 gap-2 text-center">
          <Stat label="vs 20%+ vig" value="2% fee" />
          <Stat label="settled" value="on-chain" />
          <Stat label="takes the pot" value="winner" />
        </div>

        <button
          onClick={onFlywheel}
          className="focus-ring mt-5 rounded text-[11px] font-semibold uppercase tracking-[0.18em] text-grey-400 underline decoration-grey-300 underline-offset-4 transition hover:text-grey-700"
        >
          How ComboRace makes money
        </button>
      </div>

      <p className="mx-auto mt-6 max-w-[20rem] text-center text-[10px] leading-relaxed text-grey-400">
        Free-tier odds arrive in 60-second batches, shared by every player in a lobby. The motion
        you watch is the client-side smoothing between those batches.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card py-3">
      <div className="text-sm font-bold text-grey-900">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-grey-400">{label}</div>
    </div>
  );
}
