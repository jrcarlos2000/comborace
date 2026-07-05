import type { CarTick, FeedEvent, LegTick, MatchPhase, MatchTick, LegStatus, CarStatus } from '../feed/types.js';
import type { RawSnapshot, DecodedScore } from './types.js';
import { COMBOS } from './combos.js';
import { decodeScore, resolveLeg, WHISTLE } from './scoreMapping.js';
import { matchMarketPct, comboPct } from './oddsMapping.js';

function phaseFor(minute: number): MatchPhase {
  if (minute >= WHISTLE) return 'full-time';
  if (minute <= 45) return 'first-half';
  return 'second-half';
}

// Stateful builder: fed one decoded snapshot at a time it emits the next MatchTick, carrying
// the score, resolved-leg memory, car status and derived events across calls. This is the
// real-data twin of the app mock's step() loop (app/src/mock/mockFeed.ts), reading a live
// win-probability from TxLINE instead of a Poisson estimate.
export class MatchEngine {
  private legStatus = new Map<string, LegStatus>();
  private carStatus = new Map<string, CarStatus>();
  private lastLegPct = new Map<string, number>();
  private prev: DecodedScore = { minute: 0, home: 0, away: 0, h1Home: 0, h1Away: 0, corners: 0, cards: 0, isFullTime: false, ended: false };
  private kickedOff = false;
  private halftimeSent = false;
  private fulltimeSent = false;

  constructor() {
    for (const combo of COMBOS) {
      this.carStatus.set(combo.id, 'racing');
      for (const leg of combo.legs) this.legStatus.set(`${combo.id}:${leg.id}`, 'pending');
    }
  }

  private diffEvents(next: DecodedScore, events: FeedEvent[]): void {
    if (!this.kickedOff) {
      this.kickedOff = true;
      events.push({ type: 'kickoff' });
    }
    const homeGoals = Math.max(0, next.home - this.prev.home);
    for (let i = 0; i < homeGoals; i++) {
      events.push({ type: 'goal', team: 'home', minute: next.minute, score: { home: this.prev.home + i + 1, away: next.away } });
    }
    const awayGoals = Math.max(0, next.away - this.prev.away);
    for (let i = 0; i < awayGoals; i++) {
      events.push({ type: 'goal', team: 'away', minute: next.minute, score: { home: next.home, away: this.prev.away + i + 1 } });
    }
    const corners = Math.max(0, next.corners - this.prev.corners);
    for (let i = 0; i < corners; i++) events.push({ type: 'corner', minute: next.minute });
    const cards = Math.max(0, next.cards - this.prev.cards);
    for (let i = 0; i < cards; i++) events.push({ type: 'card', minute: next.minute });

    if (!this.halftimeSent && next.minute >= 45 && next.minute < WHISTLE) {
      this.halftimeSent = true;
      events.push({ type: 'halftime' });
    }
    if (!this.fulltimeSent && next.isFullTime) {
      this.fulltimeSent = true;
      events.push({ type: 'fulltime' });
    }
  }

  build(snapshot: RawSnapshot, fallbackMinute: number): MatchTick {
    const s = decodeScore(snapshot.scores, fallbackMinute);
    const events: FeedEvent[] = [];
    this.diffEvents(s, events);

    const cars: CarTick[] = COMBOS.map((combo) => {
      const status = this.carStatus.get(combo.id) ?? 'racing';

      const legs: LegTick[] = combo.legs.map((leg) => {
        const key = `${combo.id}:${leg.id}`;
        const prior = this.legStatus.get(key) ?? 'pending';
        let legState: LegStatus = prior;

        if (prior === 'pending') {
          const resolved = resolveLeg(leg, s);
          if (resolved !== 'pending') {
            legState = resolved;
            this.legStatus.set(key, resolved);
            events.push({
              type: 'leg',
              carId: combo.id,
              legId: leg.id,
              result: resolved === 'won' ? 'won' : 'lost',
              minute: s.minute,
              label: leg.label,
            });
          }
        }

        let pct: number;
        if (legState === 'won') pct = 1;
        else if (legState === 'lost') pct = 0;
        else {
          const live = matchMarketPct(snapshot.odds, leg);
          pct = live ?? this.lastLegPct.get(key) ?? 0.5;
        }
        this.lastLegPct.set(key, pct);

        return { id: leg.id, label: leg.label, short: leg.short, pct, status: legState };
      });

      let nextStatus = status;
      if (status === 'racing') {
        const dead = legs.find((l) => l.status === 'lost');
        if (dead) {
          nextStatus = 'crashed';
          this.carStatus.set(combo.id, 'crashed');
          events.push({ type: 'crash', carId: combo.id, minute: s.minute, deadLegLabel: dead.label });
        } else if (legs.every((l) => l.status === 'won')) {
          nextStatus = 'cashed';
          this.carStatus.set(combo.id, 'cashed');
          events.push({ type: 'cash', carId: combo.id, minute: s.minute, multiplier: combo.multiplier });
        }
      }

      const pct =
        nextStatus === 'crashed'
          ? 0
          : nextStatus === 'cashed'
            ? 1
            : comboPct(
                legs.map((l) => l.pct),
                legs.map((l) => l.status),
              );

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

    const pot = COMBOS.reduce((acc, c) => acc + c.ante, 0);
    const survivors = cars.filter((c) => c.status !== 'crashed');
    const weightSum = survivors.reduce((acc, c) => acc + c.multiplier, 0) || 1;
    for (const car of cars) {
      car.payoutIfEndsNow = car.status === 'crashed' ? 0 : pot * (car.multiplier / weightSum);
    }

    this.prev = s;

    return {
      minute: s.minute,
      whistle: WHISTLE,
      phase: phaseFor(s.minute),
      score: { home: s.home, away: s.away },
      stats: { corners: s.corners, cards: s.cards },
      pot,
      cars,
      events,
    };
  }
}
