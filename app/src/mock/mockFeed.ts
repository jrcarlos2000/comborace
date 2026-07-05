import { COMBOS, type ComboDef } from './combos';
import { WHISTLE, type LegStatus, type MatchState } from './probability';

// Phase 1 stand-in for the live TxLINE match feed. It simulates one ~90 minute knockout
// tie sped up to roughly real seconds (one tick == one match minute), emitting for each of
// the four cars the live combined probability the combo still cashes, plus the discrete
// events (goals, corners, cards, legs resolving, crashes, cashes). The Data agent later
// replaces createMockFeed with a WebSocket-backed feed that emits the same MatchTick shape.

export type CarStatus = 'racing' | 'crashed' | 'cashed';

export interface LegTick {
  id: string;
  label: string;
  short: string;
  pct: number;
  status: LegStatus;
}

export interface CarTick {
  id: string;
  handle: string;
  color: string;
  colorRgb: string;
  multiplier: number;
  tagline: string;
  status: CarStatus;
  legs: LegTick[];
  pct: number;
  payoutIfEndsNow: number;
}

export type FeedEvent =
  | { type: 'kickoff' }
  | { type: 'halftime' }
  | { type: 'fulltime' }
  | { type: 'goal'; team: 'home' | 'away'; minute: number; score: { home: number; away: number } }
  | { type: 'corner'; minute: number }
  | { type: 'card'; minute: number }
  | { type: 'leg'; carId: string; legId: string; result: 'won' | 'lost'; minute: number; label: string }
  | { type: 'crash'; carId: string; minute: number; deadLegLabel: string }
  | { type: 'cash'; carId: string; minute: number; multiplier: number };

export type MatchPhase = 'first-half' | 'second-half' | 'full-time';

export interface MatchTick {
  minute: number;
  whistle: number;
  phase: MatchPhase;
  score: { home: number; away: number };
  stats: { corners: number; cards: number };
  pot: number;
  cars: CarTick[];
  events: FeedEvent[];
}

export interface MockFeedOptions {
  tickMs?: number;
  // The drafted field. Defaults to the four house cars so the standalone replay still works.
  combos?: ComboDef[];
  onTick: (tick: MatchTick) => void;
  onEnd?: () => void;
}

export interface MockFeed {
  start: () => void;
  stop: () => void;
}

// Scripted goals-only match. Deterministic so the demo always shows the split-fate beat: at 58'
// the third goal cashes the over-goals car and crashes the under-goals car in the same frame,
// then home extends at 84' to sink the underdog handicap and cash the favorite on the whistle.
const GOALS: { min: number; team: 'home' | 'away' }[] = [
  { min: 12, team: 'home' },
  { min: 34, team: 'away' },
  { min: 58, team: 'home' },
  { min: 84, team: 'home' },
];

const END_MINUTE = WHISTLE + 3;

function phaseFor(minute: number): MatchPhase {
  if (minute >= WHISTLE) return 'full-time';
  if (minute <= 45) return 'first-half';
  return 'second-half';
}

export function createMockFeed(opts: MockFeedOptions): MockFeed {
  // A faster cadence than one tick per second so the whole arc (crash + cash + settle) lands
  // inside a minute of watch time; the render smoothing interpolates across the shorter ticks.
  const tickMs = opts.tickMs ?? 450;
  const combos = opts.combos && opts.combos.length > 0 ? opts.combos : COMBOS;
  let minute = -1;
  let timer: ReturnType<typeof setInterval> | null = null;

  const score = { home: 0, away: 0 };
  let firstHalfGoals = 0;
  const corners = 0;
  const cards = 0;

  const legStatus = new Map<string, LegStatus>();
  const carStatus = new Map<string, CarStatus>();
  for (const combo of combos) {
    carStatus.set(combo.id, 'racing');
    for (const leg of combo.legs) legStatus.set(`${combo.id}:${leg.id}`, 'pending');
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function step(): void {
    minute += 1;
    const events: FeedEvent[] = [];

    if (minute === 0) events.push({ type: 'kickoff' });
    for (const g of GOALS) {
      if (g.min === minute) {
        if (g.team === 'home') score.home += 1;
        else score.away += 1;
        if (minute <= 45) firstHalfGoals += 1;
        events.push({ type: 'goal', team: g.team, minute, score: { ...score } });
      }
    }
    if (minute === 45) events.push({ type: 'halftime' });
    if (minute === WHISTLE) events.push({ type: 'fulltime' });

    const isFullTime = minute >= WHISTLE;
    const state: MatchState = {
      minute,
      home: score.home,
      away: score.away,
      firstHalfGoals,
      corners,
      cards,
      isFullTime,
    };

    const cars: CarTick[] = combos.map((combo) => {
      const status = carStatus.get(combo.id) ?? 'racing';

      const legs: LegTick[] = combo.legs.map((leg) => {
        const key = `${combo.id}:${leg.id}`;
        const prior = legStatus.get(key) ?? 'pending';
        let ev = leg.eval(state);
        if (prior !== 'pending') {
          ev = { pct: prior === 'won' ? 1 : 0, status: prior };
        } else if (ev.status !== 'pending') {
          legStatus.set(key, ev.status);
          events.push({
            type: 'leg',
            carId: combo.id,
            legId: leg.id,
            result: ev.status === 'won' ? 'won' : 'lost',
            minute,
            label: leg.label,
          });
        }
        return { id: leg.id, label: leg.label, short: leg.short, pct: ev.pct, status: legStatus.get(key) ?? 'pending' };
      });

      let nextStatus = status;
      if (status === 'racing') {
        const dead = legs.find((l) => l.status === 'lost');
        if (dead) {
          nextStatus = 'crashed';
          carStatus.set(combo.id, 'crashed');
          events.push({ type: 'crash', carId: combo.id, minute, deadLegLabel: dead.label });
        } else if (legs.every((l) => l.status === 'won')) {
          nextStatus = 'cashed';
          carStatus.set(combo.id, 'cashed');
          events.push({ type: 'cash', carId: combo.id, minute, multiplier: combo.multiplier });
        }
      }

      const pct =
        nextStatus === 'crashed' ? 0 : nextStatus === 'cashed' ? 1 : legs.reduce((acc, l) => acc * l.pct, 1);

      return {
        id: combo.id,
        handle: combo.handle,
        color: combo.color,
        colorRgb: combo.colorRgb,
        multiplier: combo.multiplier,
        tagline: combo.tagline,
        status: nextStatus,
        legs,
        pct,
        payoutIfEndsNow: 0,
      };
    });

    // Parimutuel pool. If the whistle blew now the pot splits across the cars still alive,
    // weighted by their multiplier, so a survivor's number ticks up the moment a rival dies.
    const pot = combos.reduce((acc, c) => acc + c.ante, 0);
    const survivors = cars.filter((c) => c.status !== 'crashed');
    const weightSum = survivors.reduce((acc, c) => acc + c.multiplier, 0) || 1;
    for (const car of cars) {
      car.payoutIfEndsNow = car.status === 'crashed' ? 0 : pot * (car.multiplier / weightSum);
    }

    opts.onTick({
      minute,
      whistle: WHISTLE,
      phase: phaseFor(minute),
      score: { ...score },
      stats: { corners, cards },
      pot,
      cars,
      events,
    });

    if (minute >= END_MINUTE) {
      stop();
      opts.onEnd?.();
    }
  }

  return {
    start(): void {
      if (timer) return;
      step();
      timer = setInterval(step, tickMs);
    },
    stop,
  };
}
