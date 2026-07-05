import { useEffect, useMemo, useRef, useState } from 'react';
import type { CarTick, FeedEvent, MatchTick } from '../mock/mockFeed';
import { createMatchFeed, type FeedSource, type FeedStatus } from '../feed/matchFeed';
import { BUY_IN, computeStandings, fieldCombos, pickWinner, racerFor, type Racer } from '../game/session';
import { useMoneyFlow, type Settlement } from '../game/useMoneyFlow';
import { MomentSheet, type MomentData } from '../share/KillCard';
import { Particles, type ParticlesHandle } from './Particles';
import { RaceTrack } from './RaceTrack';
import { Scoreboard } from './Scoreboard';
import { ResultOverlay } from './ResultOverlay';

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
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('connecting');

  const { pool, phase, settleAndPay } = useMoneyFlow(field);
  const lastTick = useRef<MatchTick | null>(null);
  const settledRef = useRef(false);
  const endedRef = useRef(false);

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

  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(() => setMoment(null), 5200);
    return () => window.clearTimeout(timer);
  }, [moment]);

  const you = field.find((r) => r.isYou) ?? field[0];
  const yourCar = tick?.cars.find((c) => c.id === you.combo.id);
  const nearDeath = !!yourCar && yourCar.status === 'racing' && yourCar.pct < NEAR_DEATH;
  const standings = useMemo(() => (tick ? computeStandings(tick.cars) : new Map<string, number>()), [tick]);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <Particles ref={particlesRef} />
      {nearDeath && <div className="redline-vignette" aria-hidden="true" />}
      <FeedBadge source={feedSource} status={feedStatus} />
      <Scoreboard tick={tick} />
      <YourStakeBar
        car={yourCar}
        handle={you.combo.handle}
        funding={phase === 'funding'}
        pot={tick?.pot ?? pool?.pot ?? 0}
        place={standings.get(you.combo.id)}
        total={tick?.cars.length ?? field.length}
      />
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
    color: combo?.color ?? '#FF3A3E',
    colorRgb: combo?.colorRgb ?? '255,58,62',
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
    color: combo?.color ?? '#22F58A',
    colorRgb: combo?.colorRgb ?? '34,245,138',
    tagline: combo?.tagline ?? '',
    headline: 'CASHED',
    detail: `all picks landed at ${stamp(ev.minute)}`,
    minuteLabel: stamp(ev.minute),
    multiplier: ev.multiplier,
    potLine: racer?.isYou ? 'you crossed the finish line' : `${combo?.handle ?? 'car'} crossed the finish line`,
    isYou: !!racer?.isYou,
  };
}

function FeedBadge({ source, status }: { source: FeedSource; status: FeedStatus }) {
  const live = status === 'live';
  const label =
    source === 'local'
      ? 'local demo'
      : status === 'live'
        ? 'live feed'
        : status === 'local'
          ? 'offline replay'
          : 'connecting';
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2 py-1 backdrop-blur-sm">
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-cash' : 'bg-white/40'}`}
        style={live ? { boxShadow: '0 0 8px rgba(34,245,138,0.9)' } : undefined}
      />
      <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">{label}</span>
    </div>
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
        className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 transition-colors ${
          crashed ? 'border-crash/40 bg-crash/[0.06]' : rising || leading ? 'border-cash/50 bg-cash/[0.07]' : 'border-white/8 bg-white/[0.03]'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/35">{label}</div>
          <div className="truncate text-xs font-semibold text-white/60">
            {handle} <span className="text-white/30">&middot; racing for ${pot}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {crashed ? (
            <div className="font-mono text-lg font-black text-crash">OUT</div>
          ) : (
            <div
              className={`font-mono text-xl font-black tabular-nums transition-transform ${
                cashed ? 'text-cash' : rising ? 'scale-105 text-cash' : 'text-white'
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
