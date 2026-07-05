export function Landing({ onWatch, onLobby }: { onWatch: () => void; onLobby: () => void }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden px-6 pb-10 pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-24 -z-10 h-40 opacity-70">
        <div className="mx-auto h-full max-w-xs rounded-full bg-brand/30 blur-[70px]" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-crash" />
          powered by TxLINE odds
        </span>

        <h1 className="text-[42px] font-black leading-[0.95] tracking-tight">
          <span className="text-brand">COMBO</span>
          <span className="text-white">RACE</span>
        </h1>
        <p className="mt-3 max-w-[17rem] text-sm leading-snug text-white/55">
          Everyone picks a car. Each car <span className="text-white/80">is</span> your live chance of winning.
          A goal drops, your car races ahead, your friend's blows up. Last car running takes the prize.
        </p>

        <div className="mt-10 w-full max-w-xs space-y-3">
          <button
            onClick={onWatch}
            className="watch-cta w-full rounded-2xl bg-brand py-4 text-base font-black tracking-tight text-white transition active:scale-[0.98]"
          >
            Watch a race
            <span className="mt-0.5 block text-[11px] font-medium tracking-normal text-white/70">
              instant replay, no wallet
            </span>
          </button>
          <button
            onClick={onLobby}
            className="w-full rounded-2xl border border-white/12 bg-white/[0.04] py-3.5 text-sm font-bold text-white/85 transition active:scale-[0.98]"
          >
            Enter a private lobby
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="no house" value="0% cut" />
        <Stat label="settled" value="on-chain" />
        <Stat label="prize to" value="winner" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] py-2.5">
      <div className="text-sm font-bold text-white/85">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-white/35">{label}</div>
    </div>
  );
}
