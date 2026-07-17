import type { CSSProperties, ReactNode } from 'react';
import { useReveal } from './useReveal';

// The marketing face of ComboRace. Wiring is unchanged from the app contract: the primary CTA
// everywhere calls onWatch (launches the wallet-free replay), onLobby opens a private lobby, and
// onFlywheel is the quiet "how it makes money" link in the footer.
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
    <div className="min-h-[100dvh] w-full overflow-x-hidden">
      <Nav onWatch={onWatch} />
      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Hero onWatch={onWatch} onLobby={onLobby} />
        <HowItWorks />
        <Wedge />
        <UnderTheHood />
        <FinalCta onWatch={onWatch} />
      </main>
      <Footer onWatch={onWatch} onFlywheel={onFlywheel} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className="text-grey-950">RED</span>
      <span className="text-brand">LINE</span>
    </span>
  );
}

function Reveal({
  children,
  className = '',
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delayMs}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Small state chip reused across the illustrations, tinted by meaning only.
function StateChip({ tone, label }: { tone: 'surge' | 'run' | 'redline'; label: string }) {
  const styles: Record<'surge' | 'run' | 'redline', string> = {
    surge: 'bg-cash/10 text-cash ring-cash/25',
    run: 'bg-grey-100 text-grey-500 ring-grey-200',
    redline: 'bg-crash/10 text-crash ring-crash/30',
  };
  return <span className={`pill ${styles[tone]}`}>{label}</span>;
}

const checker: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(70,70,70,0.85) 0 5px, rgba(255,255,255,0.95) 5px 10px)',
};

/* -------------------------------------------------------------------------- */
/* Nav                                                                        */
/* -------------------------------------------------------------------------- */

function Nav({ onWatch }: { onWatch: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-grey-200/70 bg-track-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark className="text-lg" />
        <nav className="hidden items-center gap-7 md:flex">
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#hood">Under the hood</NavLink>
          <NavLink href="/docs">Docs</NavLink>
        </nav>
        <button onClick={onWatch} className="btn-primary px-4 py-2 text-sm">
          Watch a race
        </button>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="focus-ring rounded text-sm font-semibold text-grey-500 transition hover:text-grey-900"
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({ onWatch, onLobby }: { onWatch: () => void; onLobby: () => void }) {
  return (
    <section className="grid items-center gap-10 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:gap-16 lg:pb-24 lg:pt-24">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-grey-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-grey-500 shadow-button">
          <span className="h-1.5 w-1.5 rounded-full bg-crash animate-soft-pulse motion-reduce:animate-none" />
          Live parlay race
        </span>
        <h1 className="mt-5 text-[42px] font-black leading-[0.94] tracking-[-0.02em] text-grey-950 sm:text-[56px] lg:text-[64px]">
          Your parlay is a car.
          <br />
          <span className="text-brand">Watch it race.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-grey-600 sm:text-lg">
          Each car is a bet. Its position on the track is the live chance it still cashes, read
          straight from the odds.
        </p>
        <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button onClick={onWatch} className="btn-hero w-full px-7 py-4 text-base sm:w-auto">
            Watch a race
          </button>
          <button
            onClick={onLobby}
            className="focus-ring rounded-xl px-2 py-2 text-sm font-semibold text-grey-500 transition hover:text-grey-900"
          >
            or start a private lobby
          </button>
        </div>
        <p className="mt-5 text-sm text-grey-400">
          Plays a full replay in your browser. No wallet, no signup.
        </p>
      </div>

      <Reveal delayMs={120} className="lg:justify-self-end">
        <HeroTrack />
      </Reveal>
    </section>
  );
}

type LaneDef = {
  car: string;
  name: string;
  legs: string;
  pct: number;
  pos: number;
  drift: string;
  tone: 'surge' | 'run' | 'redline';
  chip: string;
};

const HERO_LANES: LaneDef[] = [
  {
    car: '/cars/car1/hero.png',
    name: 'NitroNova',
    legs: 'O1.5 + O2.5',
    pct: 74,
    pos: 66,
    drift: 'animate-drift-lead',
    tone: 'surge',
    chip: 'goal, surging',
  },
  {
    car: '/cars/car3/hero.png',
    name: 'TheOracle',
    legs: 'HOME + O1.5',
    pct: 51,
    pos: 46,
    drift: 'animate-drift-mid',
    tone: 'run',
    chip: 'holding',
  },
  {
    car: '/cars/car4/hero.png',
    name: 'BetBroski',
    legs: 'AWAY +1.5',
    pct: 22,
    pos: 20,
    drift: 'animate-drift-trail',
    tone: 'redline',
    chip: 'near out',
  },
];

function HeroTrack() {
  return (
    <div className="rounded-3xl border border-grey-200 bg-track-panel p-4 shadow-card-drop sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-grey-500">
          <span className="h-1.5 w-1.5 rounded-full bg-crash animate-soft-pulse motion-reduce:animate-none" />
          Live odds
        </span>
        <div className="flex items-baseline gap-1.5 rounded-xl bg-cash/[0.08] px-2.5 py-1 ring-1 ring-cash/25">
          <span className="font-mono text-sm font-black tabular-nums text-grey-950">$80</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-cash">pot</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {HERO_LANES.map((lane) => (
          <Lane key={lane.name} {...lane} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-grey-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-crash" />
          0% out
        </span>
        <span className="text-grey-400">win chance</span>
        <span className="inline-flex items-center gap-1.5">
          100% cashes
          <span className="h-1.5 w-1.5 rounded-full bg-cash" />
        </span>
      </div>
    </div>
  );
}

function Lane({ car, name, legs, pct, pos, drift, tone, chip }: LaneDef) {
  const pctTone =
    tone === 'redline' ? 'text-crash' : tone === 'surge' ? 'text-cash' : 'text-grey-700';
  return (
    <div className="relative h-[68px] overflow-hidden rounded-2xl bg-track-lane shadow-lane">
      {/* crash edge */}
      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-crash/30 to-transparent" />
      <span className="absolute left-0 top-0 h-full w-[3px] bg-crash/70" />
      {/* finish edge */}
      <span className="absolute inset-y-0 right-0 w-2 opacity-70" style={checker} />

      {/* meta */}
      <div className="absolute left-4 top-2.5 flex items-center gap-2">
        <span className="text-xs font-bold text-grey-800">{name}</span>
        <span className="font-mono text-[10px] font-semibold text-grey-400">{legs}</span>
      </div>
      <div className="absolute right-5 top-2">
        <StateChip tone={tone} label={chip} />
      </div>

      {/* car + readout */}
      <div className={`absolute bottom-2.5 ${drift} motion-reduce:animate-none`} style={{ left: `${pos}%` }}>
        <div className="flex items-center gap-1.5">
          <img
            src={car}
            alt={`${name} car`}
            width={54}
            height={36}
            className="h-9 w-[54px] object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
          />
          <span className={`font-mono text-sm font-black tabular-nums ${pctTone}`}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

// The three beats of a race, laid out as an asymmetric bento instead of three identical columns:
// a tall "pick" card down the left, then the wider "race" and "pot" cards stacked on the right,
// with the pot card mirrored so the money shot sits on the outside edge.
function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-t border-grey-200 py-20 lg:py-28">
      <Reveal className="max-w-xl">
        <h2 className="text-[30px] font-black leading-tight tracking-[-0.02em] text-grey-950 sm:text-[38px]">
          How a race works
        </h2>
        <p className="mt-3 text-base text-grey-500">Three moves, and none of them need a spreadsheet.</p>
      </Reveal>

      <div className="mt-10 grid gap-4 lg:grid-cols-12 lg:grid-rows-2 lg:gap-5">
        <Reveal className="lg:col-span-4 lg:row-span-2" delayMs={0}>
          <article className="flex h-full flex-col rounded-3xl border border-grey-200 bg-track-panel p-6 shadow-card-drop">
            <h3 className="text-lg font-bold text-grey-950">Pick a car</h3>
            <p className="mt-2 text-sm leading-relaxed text-grey-500">
              Every car is a goals parlay. Safe picks sit shorter, long shots pay more.
            </p>
            <div className="mt-5 flex-1">
              <PickVisual />
            </div>
          </article>
        </Reveal>

        <Reveal className="lg:col-span-8" delayMs={90}>
          <article className="grid h-full items-center gap-5 rounded-3xl border border-grey-200 bg-track-panel p-6 shadow-card-drop sm:grid-cols-[minmax(0,0.9fr)_1.3fr]">
            <div>
              <h3 className="text-lg font-bold text-grey-950">Watch it race</h3>
              <p className="mt-2 text-sm leading-relaxed text-grey-500">
                Positions move on live de-vigged odds. A goal surges your car, a dead leg blows it up.
              </p>
            </div>
            <div className="min-w-0">
              <RaceVisual />
            </div>
          </article>
        </Reveal>

        <Reveal className="lg:col-span-8" delayMs={180}>
          <article className="grid h-full items-center gap-5 rounded-3xl border border-grey-200 bg-track-panel p-6 shadow-card-drop sm:grid-cols-[1.1fr_minmax(0,0.95fr)]">
            <div className="sm:order-2">
              <h3 className="text-lg font-bold text-grey-950">Last car takes the pot</h3>
              <p className="mt-2 text-sm leading-relaxed text-grey-500">
                At the whistle, the surviving car on the best line takes the whole pool.
              </p>
            </div>
            <div className="min-w-0 sm:order-1">
              <PotVisual />
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

function PickChip({
  car,
  name,
  odds,
  tone,
  selected = false,
}: {
  car: string;
  name: string;
  odds: string;
  tone: 'safe' | 'longshot';
  selected?: boolean;
}) {
  const oddsTone = 'text-grey-800';
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3 py-2.5 ${
        selected ? 'border-brand/50 shadow-car-select' : 'border-grey-200 shadow-button'
      }`}
    >
      <img src={car} alt={`${name} car`} width={42} height={28} className="h-7 w-[42px] object-contain" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-grey-900">{name}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-grey-400">
          {tone === 'safe' ? 'safe pick' : 'long shot'}
        </div>
      </div>
      <span className={`font-mono text-sm font-black tabular-nums ${oddsTone}`}>{odds}</span>
    </div>
  );
}

function PickVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 rounded-2xl bg-track-lane/70 p-3">
      <PickChip car="/cars/car2/hero.png" name="RicoSuave" odds="2.0x" tone="safe" />
      <PickChip car="/cars/car1/hero.png" name="NitroNova" odds="3.2x" tone="longshot" selected />
    </div>
  );
}

function RaceVisual() {
  return (
    <div className="relative flex h-full min-h-[128px] items-center rounded-2xl bg-track-lane shadow-lane">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-crash/30 to-transparent" />
      <span className="absolute inset-y-0 right-0 w-2 opacity-70" style={checker} />
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-grey-400">
        <span className="h-1.5 w-1.5 rounded-full bg-crash animate-soft-pulse motion-reduce:animate-none" />
        live
      </div>
      <div className="absolute bottom-6 animate-drift-mid motion-reduce:animate-none" style={{ left: '52%' }}>
        <div className="flex items-center gap-1.5">
          <img
            src="/cars/car3/hero.png"
            alt="Car racing on live odds"
            width={56}
            height={38}
            className="h-[38px] w-14 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
          />
          <span className="font-mono text-sm font-black tabular-nums text-grey-800">58%</span>
        </div>
      </div>
    </div>
  );
}

function PotVisual() {
  return (
    <div className="relative flex h-full min-h-[128px] flex-col items-center justify-center gap-2 rounded-2xl bg-track-lane p-4">
      <span className="absolute inset-y-4 right-4 w-2.5 rounded-sm opacity-80" style={checker} />
      <img
        src="/cars/car1/hero.png"
        alt="Winning car crossing the line"
        width={72}
        height={48}
        className="h-12 w-[72px] object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
      />
      <div className="flex items-baseline gap-1.5 rounded-xl bg-cash/[0.08] px-3 py-1.5 ring-1 ring-cash/25">
        <span className="font-mono text-2xl font-black tabular-nums text-grey-950">$80</span>
        <span className="text-xs font-bold uppercase tracking-wide text-cash">to the winner</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Wedge                                                                      */
/* -------------------------------------------------------------------------- */

function Wedge() {
  return (
    <section id="why" className="scroll-mt-24 py-4 lg:py-10">
      <Reveal>
        <div className="overflow-hidden rounded-3xl bg-gradient-brand-soft px-6 py-12 ring-1 ring-brand/15 sm:px-12 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-[34px] font-black leading-[1.02] tracking-[-0.02em] text-grey-950 sm:text-[46px]">
              Betting you can watch.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-grey-700 sm:text-lg">
              The oracle number stops being a spreadsheet cell. It becomes a car you watch surge on a
              goal and explode the moment a leg dies.
            </p>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-grey-500">
              Made for people who do not follow soccer, and only tune in once they have money on the
              game.
            </p>
          </div>

          <div className="mt-10 max-w-2xl">
            <ProbabilityAxis />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ProbabilityAxis() {
  return (
    <div className="relative h-16 overflow-hidden rounded-2xl border border-grey-200 bg-track-panel shadow-lane">
      <div className="absolute inset-0 bg-gradient-to-r from-crash/15 via-transparent to-cash/15" />
      <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-crash/40 to-transparent" />
      <span className="absolute inset-y-0 right-0 w-2 opacity-70" style={checker} />
      <span className="absolute left-3 top-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-grey-500">
        <span className="h-1.5 w-1.5 rounded-full bg-crash" />
        dead
      </span>
      <span className="absolute right-4 top-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-grey-500">
        cashes
        <span className="h-1.5 w-1.5 rounded-full bg-cash" />
      </span>
      <div className="absolute bottom-3 animate-drift-lead motion-reduce:animate-none" style={{ left: '44%' }}>
        <div className="flex items-center gap-1.5">
          <img
            src="/cars/car4/hero.png"
            alt="Car on the probability axis"
            width={54}
            height={36}
            className="h-9 w-[54px] object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
          />
          <span className="font-mono text-sm font-black tabular-nums text-grey-800">46%</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Under the hood                                                             */
/* -------------------------------------------------------------------------- */

// Deliberately NOT another card grid. The heading and the honest-build note sit in a left rail,
// and the three technical facts read as a plain hairline-divided list on the right, so this
// section has a different texture (lines, not boxes) from the bento above it.
function UnderTheHood() {
  return (
    <section id="hood" className="scroll-mt-24 border-t border-grey-200 py-20 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <Reveal className="lg:col-span-5">
          <h2 className="text-[30px] font-black leading-tight tracking-[-0.02em] text-grey-950 sm:text-[38px]">
            What it actually runs on
          </h2>
          <p className="mt-3 max-w-md text-base text-grey-500">
            The odds are real, the pools are private, and the settlement is on-chain where anyone can
            check it.
          </p>
          <p className="mt-6 max-w-md rounded-2xl border border-grey-200 bg-grey-50 px-5 py-4 text-sm leading-relaxed text-grey-500">
            This public build plays a recorded match and simulates the payout, so you can watch a full
            race without a wallet. Live pools stay invite-only.
          </p>
        </Reveal>

        <Reveal className="lg:col-span-7" delayMs={90}>
          <dl className="divide-y divide-grey-200">
            <HoodFact title="Live odds from TxLINE" tags={['de-vigged Pct', 'Solana oracle', 'goals markets']}>
              Each car&apos;s position is a real number from TxLINE, the on-chain sports-data oracle on
              Solana. Its odds arrive already de-vigged, so a car shows the oracle&apos;s own probability
              that the parlay cashes, not a model&apos;s guess.
            </HoodFact>
            <HoodFact title="Private pools">
              Open a lobby, invite friends, and everyone antes in. No open house and no strangers in
              your race.
            </HoodFact>
            <HoodFact title="On-chain settlement">
              The pot is escrowed and paid to the winner from the verifiable match result.
            </HoodFact>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function HoodFact({
  title,
  tags,
  children,
}: {
  title: string;
  tags?: string[];
  children: ReactNode;
}) {
  return (
    <div className="py-6 first:pt-0 last:pb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <dt className="text-lg font-bold text-grey-950">{title}</dt>
        {tags ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TechTag key={tag}>{tag}</TechTag>
            ))}
          </div>
        ) : null}
      </div>
      <dd className="mt-2 max-w-xl text-sm leading-relaxed text-grey-600">{children}</dd>
    </div>
  );
}

function TechTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-brand/[0.07] px-3 py-1 font-mono text-[11px] font-semibold text-brand ring-1 ring-brand/20">
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                  */
/* -------------------------------------------------------------------------- */

function FinalCta({ onWatch }: { onWatch: () => void }) {
  return (
    <section className="py-20 lg:py-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-track-panel p-8 shadow-card-drop ring-1 ring-grey-200 sm:p-12 lg:p-14">
          {/* One neon car parked at the finish, bleeding off the right edge, so the closing band
              shows the product one last time instead of centering empty space. */}
          <img
            src="/cars/car1/hero.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 bottom-6 hidden w-56 rotate-[-4deg] opacity-90 drop-shadow-[0_10px_24px_rgba(0,0,0,0.25)] sm:block lg:w-72"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-8 right-10 hidden w-2.5 rounded-sm opacity-70 sm:block lg:right-14"
            style={checker}
          />
          <div className="relative max-w-xl">
            <h2 className="text-[34px] font-black leading-[1.0] tracking-[-0.02em] text-grey-950 sm:text-[46px]">
              Pick a car.
              <br />
              <span className="text-brand">Watch it race.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-grey-600 sm:text-lg">
              One tap starts a full replay, with no wallet and no soccer knowledge required.
            </p>
            <div className="mt-8">
              <button onClick={onWatch} className="btn-hero px-8 py-4 text-lg">
                Watch a race
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */

function Footer({ onWatch, onFlywheel }: { onWatch: () => void; onFlywheel: () => void }) {
  return (
    <footer className="border-t border-grey-200 bg-track-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Wordmark className="text-base" />
          <p className="mt-1.5 text-sm text-grey-500">Betting you can watch.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
          <button onClick={onWatch} className="focus-ring rounded text-grey-700 transition hover:text-brand">
            Watch a race
          </button>
          <a href="/docs" className="focus-ring rounded text-grey-500 transition hover:text-grey-900">
            Docs
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
            className="focus-ring rounded text-grey-500 transition hover:text-grey-900"
          >
            X
          </a>
          <button onClick={onFlywheel} className="focus-ring rounded text-grey-400 transition hover:text-grey-700">
            How it makes money
          </button>
        </nav>
      </div>
    </footer>
  );
}
