import type { DecodedScore, LegDescriptor } from './types.js';
import type { LegStatus } from '../feed/types.js';

// TxLINE soccer score encoding -> match state -> leg resolution.
//
// Finalized against a REAL recorded fixture (Mexico vs England, txline-dev, 18192996). The live
// scores payload uses PascalCase keys: the running score is `Score` (a SoccerFixtureScore with
// `Participant1`/`Participant2`, each a per-period map H1/HT/H2/Total of { Goals, YellowCards,
// RedCards, Corners }), `Participant1IsHome` names the home side, `Clock` is { Running, Seconds }
// with Seconds the cumulative match clock, and `StatusId` is an INTEGER game-phase code (2=H1,
// 3=HT, 4=H2, 5=Ended, 10=Ended-after-ET, 13=Ended-after-pens). `GameState` is unreliable here
// (always "scheduled"), so ended-detection reads StatusId. The documented / synthetic feed instead
// nests the score under `scoreSoccer`, the phase as a one-key object under `statusSoccerId`
// (e.g. { F: {} }) and a lowercase `clock`; all reads below are case-insensitive so both work.
// We read Total goals for full-match markets and H1 goals for first-half markets.

// Finished game-phase names (documented / synthetic) and integer codes (real feed): F, FET, FPE.
const ENDED_STATUS = new Set(['F', 'FET', 'FPE', 'END', 'AET', 'AP']);
const ENDED_STATUS_IDS = new Set([5, 10, 13]);

// Full-time whistle at 90 plus typical stoppage, aligned with app/src/mock/probability.ts.
export const WHISTLE = 93;
// First-half whistle at 45 plus typical stoppage.
export const FIRST_HALF_WHISTLE = 47;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

// Case-insensitive property read across a few candidate keys.
function pick(rec: Record<string, unknown> | null, keys: string[]): unknown {
  if (!rec) return undefined;
  const lower = new Map(Object.keys(rec).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const hit = lower.get(k.toLowerCase());
    if (hit !== undefined) return rec[hit];
  }
  return undefined;
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function boolAt(rec: Record<string, unknown> | null, keys: string[], fallback: boolean): boolean {
  const v = pick(rec, keys);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

// Goals in one period subtree (H1, Total, ...) of a participant's SoccerTotalScore.
function periodGoals(total: Record<string, unknown> | null, period: string): number {
  const sub = asRecord(pick(total, [period]));
  return num(pick(sub, ['Goals']));
}

function periodStat(total: Record<string, unknown> | null, period: string, stat: string): number {
  const sub = asRecord(pick(total, [period]));
  return num(pick(sub, [stat]));
}

// Whether the match has finished, from the integer StatusId (real feed), the one-key
// SoccerFixtureStatus object (documented / synthetic feed) or the gameState string.
function isEnded(root: Record<string, unknown> | null): boolean {
  const status = pick(root, ['statusSoccerId', 'statusId', 'status']);
  if (typeof status === 'number') return ENDED_STATUS_IDS.has(status);
  if (typeof status === 'string' && status.trim() !== '') {
    const n = Number(status);
    if (Number.isFinite(n) && String(n) === status.trim()) return ENDED_STATUS_IDS.has(n);
    return ENDED_STATUS.has(status.toUpperCase());
  }
  const rec = asRecord(status);
  if (rec) {
    const keys = Object.keys(rec);
    if (keys.length > 0 && ENDED_STATUS.has(keys[0].toUpperCase())) return true;
  }
  const gameState = pick(root, ['gameState', 'state']);
  if (typeof gameState === 'string' && gameState.trim() !== '') return ENDED_STATUS.has(gameState.toUpperCase());
  return false;
}

// Decode a raw scores payload into the feed-agnostic match state the leg logic consumes.
// Defensive: an unexpected shape degrades to zeros / not-ended rather than throwing, so a
// surprise payload never crashes the stream.
export function decodeScore(rawScores: unknown, fallbackMinute: number): DecodedScore {
  const root = asRecord(rawScores);

  const clock = asRecord(pick(root, ['clock', 'clockSoccer']));
  const clockMinute = clock ? Math.floor(num(pick(clock, ['seconds'])) / 60) : 0;
  const minute = num(pick(root, ['minute', 'matchMinute'])) || clockMinute || fallbackMinute;

  const soccer = asRecord(pick(root, ['scoreSoccer', 'score', 'scoreSoccerId']));
  const p1IsHome = boolAt(root, ['participant1IsHome'], true);
  const p1 = asRecord(pick(soccer, ['Participant1']));
  const p2 = asRecord(pick(soccer, ['Participant2']));
  const homeTotal = p1IsHome ? p1 : p2;
  const awayTotal = p1IsHome ? p2 : p1;

  const home = periodGoals(homeTotal, 'Total');
  const away = periodGoals(awayTotal, 'Total');
  const h1Home = periodGoals(homeTotal, 'H1');
  const h1Away = periodGoals(awayTotal, 'H1');

  const corners = periodStat(homeTotal, 'Total', 'Corners') + periodStat(awayTotal, 'Total', 'Corners');
  const cards =
    periodStat(homeTotal, 'Total', 'YellowCards') +
    periodStat(homeTotal, 'Total', 'RedCards') +
    periodStat(awayTotal, 'Total', 'YellowCards') +
    periodStat(awayTotal, 'Total', 'RedCards');

  const ended = isEnded(root);
  const isFullTime = ended || minute >= WHISTLE;

  return { minute, home, away, h1Home, h1Away, corners, cards, isFullTime, ended };
}

function overUnder(count: number, line: number, side: 'over' | 'under', resolved: boolean): LegStatus {
  const need = Math.floor(line) + 1;
  if (side === 'over') {
    if (count >= need) return 'won';
    return resolved ? 'lost' : 'pending';
  }
  if (count > Math.floor(line)) return 'lost';
  return resolved ? 'won' : 'pending';
}

// Resolve one leg against the decoded state, following the natural-settlement table in
// docs/GAME_DESIGN.md (Over can win early, Under can lose early, 1X2 and handicap at the whistle,
// first-half lines at half time). Mirrors the status branches in app/src/mock/probability.ts.
export function resolveLeg(leg: LegDescriptor, s: DecodedScore): LegStatus {
  const m = leg.market;
  const firstHalf = m.period === 'firstHalf';
  const firstHalfOver = firstHalf && (s.minute >= FIRST_HALF_WHISTLE || s.isFullTime);

  switch (m.kind) {
    case 'totalGoals': {
      const total = firstHalf ? s.h1Home + s.h1Away : s.home + s.away;
      return overUnder(total, m.line ?? 0, m.side === 'under' ? 'under' : 'over', firstHalf ? firstHalfOver : s.isFullTime);
    }
    case 'teamGoals': {
      const home = firstHalf ? s.h1Home : s.home;
      const away = firstHalf ? s.h1Away : s.away;
      return overUnder(
        m.team === 'away' ? away : home,
        m.line ?? 0,
        m.side === 'under' ? 'under' : 'over',
        firstHalf ? firstHalfOver : s.isFullTime,
      );
    }
    case 'matchResult': {
      if (!s.isFullTime) return 'pending';
      const diff = s.home - s.away;
      if (m.side === 'home') return diff > 0 ? 'won' : 'lost';
      if (m.side === 'away') return diff < 0 ? 'won' : 'lost';
      return diff === 0 ? 'won' : 'lost';
    }
    case 'asianHandicap': {
      if (!s.isFullTime) return 'pending';
      const team = m.team === 'away' ? 'away' : 'home';
      const teamGoals = team === 'away' ? s.away : s.home;
      const oppGoals = team === 'away' ? s.home : s.away;
      const margin = teamGoals - oppGoals + (m.line ?? 0);
      return margin > 0 ? 'won' : 'lost';
    }
    default:
      return 'pending';
  }
}
