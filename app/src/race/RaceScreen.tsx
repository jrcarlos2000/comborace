import { useEffect, useMemo, useRef, useState } from 'react';
import type { CarTick, FeedEvent, MatchTick } from '../mock/mockFeed';
import { createMatchFeed, type FeedSource, type FeedStatus } from '../feed/matchFeed';
import { BUY_IN, computeStandings, fieldCombos, pickWinner, racerFor, type Racer } from '../game/session';
import { useMoneyFlow, type Settlement } from '../game/useMoneyFlow';
import { MomentSheet, type MomentData } from '../share/KillCard';
import { raceAudio } from '../audio/raceAudio';
import { clamp01 } from '../mock/probability';
import colors, { cashRgb, crashRgb } from '../theme/colors';
import { Particles, type ParticlesHandle } from './Particles';
import { RaceTrack } from './RaceTrack';
import { Scoreboard } from './Scoreboard';
import { ResultOverlay } from './ResultOverlay';
import { Coach, hasSeenCoach } from './Coach';
import { OracleTicker, OracleFlashToast, selectOracleFlash, type OracleFlash } from './OracleTicker';

const NEAR_DEATH = 0.16;

export function RaceScreen({
  field,
  onExit,
  onReplay,
  feedSource = 'server',
}: {
  field: Racer[];
  onExit: () => void;
  onReplay: () => void;
  feedSource?: FeedSource;
}) {
  const combos = useMemo(() => fieldCombos(field), [field]);
  const particlesRef = useRef<ParticlesHandle>(null);
  const [tick, setTick] = useState<MatchTick | null>(null);
  const [ended, setEnded] = useState(false);
  const [moment, setMoment] = useState<MomentData | null>(null);
  const [flash, setFlash] = useState<OracleFlash | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('connecting');
  const [showCoach, setShowCoach] = useState(() => !hasSeenCoach());

  const { pool, phase, settleAndPay } = useMoneyFlow(field);
  const lastTick = useRef<MatchTick | null>(null);
  const settledRef = useRef(false);
  const endedRef = useRef(false);
  const youId = (field.find((r) => r.isYou) ?? field[0])?.combo.id;
  const prevYourPct = useRef(0);

  useEffect(() => {
    setTick(null);
    setEnded(false);
    lastTick.current = null;
    endedRef.current = false;
    const feed = createMatchFeed({
      source: feedSource,
      combos,
      onStatus: setFeedStatus,
      // A looping kiosk stream restarts at kickoff after full time; once the race has ended
      // and settled, ignore the next lap so the result screen holds instead of re-animating.
      onTick: (t) => {
        if (endedRef.current) return;
        lastTick.current = t;
        setTick(t);
        const next = selectMoment(t.events, t.cars, field);
        if (next) setMoment(next);
        const nextFlash = selectOracleFlash(t.events, t.score, t.minute);
        if (nextFlash) setFlash(nextFlash);
        driveAudio(t, youId, prevYourPct);
      },
      onEnd: () => {
        endedRef.current = true;
        setEnded(true);
      },
    });
    feed.start();
    return () => feed.stop();
  }, [combos, field, feedSource]);

  useEffect(() => {
    if (!ended || settledRef.current) return;
    const cars = lastTick.current?.cars;
    if (!cars) return;
    settledRef.current = true;
    const winner = pickWinner(field, cars);
    void settleAndPay(winner).then((result) => {
      if (result) setSettlement(result);
    });
  }, [ended, field, settleAndPay]);

  // The moment sheet owns its own hold-and-retract lifecycle (KillCard MomentSheet), so it plays a
  // symmetric exit before it unmounts. It calls onClose when that finishes; nothing to time here.

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  // Idle the engine hum toward silence when the race is over or this screen unmounts.
  useEffect(() => {
    if (ended) raceAudio.setEngine(0, false);
  }, [ended]);
  useEffect(() => () => raceAudio.setEngine(0, false), []);

  const you = field.find((r) => r.isYou) ?? field[0];
  const yourCar = tick?.cars.find((c) => c.id === you.combo.id);
  const nearDeath = !!yourCar && yourCar.status === 'racing' && yourCar.pct < NEAR_DEATH;
  const standings = useMemo(() => (tick ? computeStandings(tick.cars) : new Map<string, number>()), [tick]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <Particles ref={particlesRef} />
      {nearDeath && <div className="redline-vignette" aria-hidden="true" />}
      <Scoreboard
        tick={tick}
        live={feedStatus === 'live'}
        feed={<FeedBadge source={feedSource} status={feedStatus} />}
        action={<MuteButton />}
      />
      <YourStakeBar
        car={yourCar}
        handle={you.combo.handle}
        funding={phase === 'funding'}
        pot={tick?.pot ?? pool?.pot ?? 0}
        place={standings.get(you.combo.id)}
        total={tick?.cars.length ?? field.length}
      />
      <OracleTicker tick={tick} />
      {flash && <OracleFlashToast flash={flash} />}
      <RaceTrack
        key={combos.map((c) => c.id).join(',')}
        tick={tick}
        particles={particlesRef}
        combos={combos}
        pot={tick?.pot ?? pool?.pot ?? 0}
        youId={you.combo.id}
        standings={standings}
      />

      {moment && <MomentSheet moment={moment} onClose={() => setMoment(null)} />}

      {showCoach && <Coach onDone={() => setShowCoach(false)} />}

      {ended && tick && (
        <ResultOverlay
          cars={tick.cars}
          field={field}
          settlement={settlement}
          settling={phase === 'settling' || (ended && !settlement)}
          onReplay={onReplay}
          onExit={onExit}
        />
      )}
    </div>
  );
}

// Turns a tick into sound: one-shot crash / cash / pot-tick cues off the events, plus an engine
// hum whose pitch and volume track your car's position and how fast it is moving. Every call is a
// no-op when muted (the audio layer guards it), so this is safe to run every tick.
function driveAudio(t: MatchTick, youId: string | undefined, prevYourPct: React.MutableRefObject<number>): void {
  for (const ev of t.events) {
    if (ev.type === 'crash') {
      raceAudio.crash();
      // A rival dying grows the survivor pool: a small pot-tick, but not when it is your own car.
      if (ev.carId !== youId) window.setTimeout(() => raceAudio.potTick(), 140);
    } else if (ev.type === 'cash') {
      raceAudio.cash();
    }
  }
  const your = youId ? t.cars.find((c) => c.id === youId) : undefined;
  if (!your) return;
  const pct = your.status === 'crashed' ? 0 : your.status === 'cashed' ? 1 : your.pct;
  const delta = pct - prevYourPct.current;
  prevYourPct.current = pct;
  raceAudio.setEngine(clamp01(pct * 0.65 + Math.abs(delta) * 4), your.status === 'racing');
}

function MuteButton() {
  const [muted, setMuted] = useState(raceAudio.isMuted());
  useEffect(() => raceAudio.subscribe(setMuted), []);
  return (
    <button
      onClick={() => raceAudio.toggleMuted()}
      className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full border border-grey-200 bg-white text-grey-500 shadow-button transition hover:border-grey-300 hover:text-grey-800"
      aria-label={muted ? 'Unmute race sound' : 'Mute race sound'}
      aria-pressed={muted}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        {muted ? <path d="m16 9 5 6M21 9l-5 6" /> : <path d="M16 9a3.5 3.5 0 0 1 0 6" />}
      </svg>
    </button>
  );
}

function selectMoment(events: FeedEvent[], cars: CarTick[], field: Racer[]): MomentData | null {
  const crashes = events.filter((e): e is Extract<FeedEvent, { type: 'crash' }> => e.type === 'crash');
  const cashes = events.filter((e): e is Extract<FeedEvent, { type: 'cash' }> => e.type === 'cash');
  const survivors = cars.filter((c) => c.status !== 'crashed').length;

  const yourCash = cashes.find((e) => racerFor(field, e.carId)?.isYou);
  if (yourCash) return cashMoment(yourCash, field);
  if (crashes.length > 0) return crashMoment(crashes[0], survivors, field);
  if (cashes.length > 0) return cashMoment(cashes[0], field);
  return null;
}

function stamp(minute: number): string {
  const secs = (minute * 17 + 7) % 60;
  return `${minute}:${String(secs).padStart(2, '0')}`;
}

function crashMoment(ev: Extract<FeedEvent, { type: 'crash' }>, survivors: number, field: Racer[]): MomentData {
  const racer = racerFor(field, ev.carId);
  const combo = racer?.combo;
  const perSurvivor = Math.max(1, Math.round(BUY_IN / Math.max(1, survivors)));
  return {
    id: `${ev.carId}-crash-${ev.minute}`,
    kind: 'crash',
    handle: combo?.handle ?? ev.carId,
    color: combo?.color ?? colors.crash,
    colorRgb: combo?.colorRgb ?? crashRgb,
    tagline: combo?.tagline ?? '',
    headline: 'WRECKED',
    detail: `"${ev.deadLegLabel}" pick died at ${stamp(ev.minute)}`,
    minuteLabel: stamp(ev.minute),
    multiplier: combo?.multiplier ?? 0,
    potLine: `prize grows +$${perSurvivor} for each car still alive`,
    isYou: !!racer?.isYou,
  };
}

function cashMoment(ev: Extract<FeedEvent, { type: 'cash' }>, field: Racer[]): MomentData {
  const racer = racerFor(field, ev.carId);
  const combo = racer?.combo;
  return {
    id: `${ev.carId}-cash-${ev.minute}`,
    kind: 'cash',
    handle: combo?.handle ?? ev.carId,
    color: combo?.color ?? colors.cash,
    colorRgb: combo?.colorRgb ?? cashRgb,
    tagline: combo?.tagline ?? '',
    headline: 'CASHED',
    detail: `all picks landed at ${stamp(ev.minute)}`,
    minuteLabel: stamp(ev.minute),
    multiplier: ev.multiplier,
    potLine: racer?.isYou ? 'you crossed the finish line' : `${combo?.handle ?? 'car'} crossed the finish line`,
    isYou: !!racer?.isYou,
  };
}

interface FeedBadgeStyle {
  label: string;
  dot: string;
  ring: string;
  text: string;
  glow: boolean;
  pulse: boolean;
}

// The server feed silently falls back to a local replay, so there is no dead-end disconnect
// to surface. What matters is legibility of the degraded states: connecting reads as a warning
// (amber, pulsing), live reads positive (green, glowing), a fallback reads muted-neutral.
function feedBadgeStyle(source: FeedSource, status: FeedStatus): FeedBadgeStyle {
  if (source === 'local') {
    return { label: 'local demo', dot: 'bg-grey-400', ring: 'ring-grey-200', text: 'text-grey-500', glow: false, pulse: false };
  }
  if (status === 'live') {
    return { label: 'live feed', dot: 'bg-cash', ring: 'ring-cash/30', text: 'text-grey-700', glow: true, pulse: false };
  }
  if (status === 'local') {
    return { label: 'offline replay', dot: 'bg-grey-400', ring: 'ring-grey-200', text: 'text-grey-500', glow: false, pulse: false };
  }
  return { label: 'connecting', dot: 'bg-yellow-500', ring: 'ring-yellow-400/40', text: 'text-grey-600', glow: false, pulse: true };
}

function FeedBadge({ source, status }: { source: FeedSource; status: FeedStatus }) {
  const s = feedBadgeStyle(source, status);
  return (
    <span
      className={`pointer-events-none mt-px inline-flex items-center gap-1.5 rounded-full border border-grey-200 bg-white px-2 py-0.5 shadow-pill-highlight ring-1 ${s.ring}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`}
        style={s.glow ? { boxShadow: `0 0 6px rgba(${cashRgb}, 0.55)` } : undefined}
      />
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${s.text}`}>{s.label}</span>
    </span>
  );
}

function useTweenNumber(target: number): number {
  const [display, setDisplay] = useState(target);
  const value = useRef(target);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const next = value.current + (target - value.current) * (1 - Math.exp(-dt / 0.16));
      value.current = Math.abs(target - next) < 0.02 ? target : next;
      setDisplay(value.current);
      if (value.current !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

function YourStakeBar({
  car,
  handle,
  funding,
  pot,
  place,
  total,
}: {
  car: CarTick | undefined;
  handle: string;
  funding: boolean;
  pot: number;
  place?: number;
  total: number;
}) {
  const chance = car?.status === 'crashed' ? 0 : car?.status === 'cashed' ? 1 : car?.pct ?? 0;
  const display = useTweenNumber(chance * 100);
  const prev = useRef(chance);
  const [rising, setRising] = useState(false);

  useEffect(() => {
    if (chance > prev.current + 0.005) {
      setRising(true);
      const timer = window.setTimeout(() => setRising(false), 700);
      prev.current = chance;
      return () => window.clearTimeout(timer);
    }
    prev.current = chance;
    return undefined;
  }, [chance]);

  const crashed = car?.status === 'crashed';
  const cashed = car?.status === 'cashed';
  const anteing = funding && !car;
  const leading = place === 1 && car?.status === 'racing';

  const label = anteing
    ? 'buying in...'
    : crashed
      ? 'your car crashed out'
      : cashed
        ? 'your car won the race'
        : leading
          ? 'your car is in the lead!'
          : place
            ? `your car is ${ORDINAL[place] ?? `${place}th`} of ${total}`
            : "your car's chance to win";

  return (
    <div className="sticky top-[92px] z-20 px-3 pb-1.5 pt-1">
      <div
        className={`flex items-center justify-between rounded-2xl border bg-track-panel px-3.5 py-2.5 shadow-card-raise transition-colors ${
          crashed
            ? 'border-crash/40'
            : leading
              ? 'border-brand/40'
              : rising
                ? 'border-cash/40'
                : 'border-grey-200'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-grey-500">{label}</div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-semibold text-grey-600">
            {handle}
            <span className="h-1 w-1 rounded-full bg-grey-300" />
            <span className="text-grey-400">racing for <span className="tabular-nums">${pot}</span></span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {crashed ? (
            <div className="font-mono text-lg font-black text-crash">OUT</div>
          ) : (
            <div
              className={`font-mono text-xl font-black tabular-nums transition-transform ${
                cashed ? 'text-cash' : rising ? 'scale-105 text-brand' : 'text-brand'
              }`}
            >
              {Math.round(display)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
