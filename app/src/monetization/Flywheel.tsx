// Static "License ComboRace" screen: the growth flywheel where fans and white-label books both
// pull through a paid TxLINE feed. Framed as skill-game plus B2B infrastructure (a 2% track fee
// against a book's 20%+ compounded vig), not the crowded "no house / undercut the vig" pitch.
export function Flywheel({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-12 pt-14">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-grey-200 bg-white text-grey-600 shadow-button transition duration-150 hover:border-grey-300 hover:text-grey-900 active:scale-95"
          aria-label="Back"
        >
          &#8592;
        </button>
        <span className="text-sm font-bold text-grey-800">License ComboRace</span>
      </div>

      <h1 className="text-[30px] font-black leading-tight tracking-tight text-grey-950">
        A demand engine for the <span className="text-brand">TxLINE feed</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-grey-600">
        ComboRace is a skill-game watch-along and a B2B widget. Every unit of growth, fan or
        book, pulls through a paid real-time TxLINE subscription. The builder&apos;s growth and the
        sponsor&apos;s feed revenue are the same arrow.
      </p>

      <div className="mt-7 space-y-3">
        <FlywheelStep
          n={1}
          title="Fans play, free tier hooks them"
          body="The wallet-free race runs on the 60-second World Cup feed. Bigger pools, private leagues and instant replays need the real-time feed, so a paying fan literally funds a feed pull."
        />
        <FlywheelStep
          n={2}
          title="Books white-label the widget"
          body="A sportsbook that embeds the ComboRace watch-along must subscribe to a real-time TxLINE feed to power it. The book carries licensing and custody inside its regulated perimeter; ComboRace is the engine and funnel."
        />
        <FlywheelStep
          n={3}
          title="A thin track fee, not a vig"
          body="A 2% on-chain track fee accrues to a protocol account, against a book's 20%+ compounded combo vig. It is a skill game with a transparent fee, not a house taking the other side."
        />
      </div>

      <div className="mt-7 rounded-2xl border border-brand/25 bg-brand/[0.05] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">the number that switches you</div>
        <div className="mt-2 flex items-end gap-6">
          <div>
            <div className="font-mono text-3xl font-black text-cash">2%</div>
            <div className="mt-0.5 text-[11px] text-grey-500">ComboRace track fee</div>
          </div>
          <div className="pb-1 text-grey-400">vs</div>
          <div>
            <div className="font-mono text-3xl font-black text-grey-900">20%+</div>
            <div className="mt-0.5 text-[11px] text-grey-500">a book&apos;s compounded combo vig</div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-grey-500">
          Possible because TxLINE&apos;s <span className="font-semibold text-grey-700">Pct</span> is already de-margined, so a
          four-leg combo costs about 2% here instead of stacking a fresh margin on every leg.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-grey-200 bg-grey-50 px-4 py-3 text-center text-[11px] leading-relaxed text-grey-500">
        Interested in a white-label watch-along? This screen is the pitch surface. The live pool,
        settlement and B2B deal flow are owner-gated, never an open public sportsbook.
      </div>
    </div>
  );
}

function FlywheelStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="surface-card flex gap-3 p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-sm font-black text-brand ring-1 ring-brand/25">
        {n}
      </span>
      <div>
        <div className="text-sm font-bold text-grey-900">{title}</div>
        <div className="mt-1 text-[12px] leading-relaxed text-grey-500">{body}</div>
      </div>
    </div>
  );
}
