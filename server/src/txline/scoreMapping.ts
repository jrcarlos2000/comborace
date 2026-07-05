import type { DecodedScore, LegDescriptor } from './types.js';
import type { LegStatus } from '../feed/types.js';

// TxLINE score encoding -> match state -> leg resolution.
//
// The scores feed encodes goals, corners, yellow/red cards per team and per half under
// keys of the form period*1000 + base_key (base 1-8), plus a match-phase code (19 codes,
// 5 = Ended, 13 = Ended after penalty shootout). See docs/TXLINE_CAPABILITIES.md.
//
// TODO(real-sample): the base_key numbers below are placeholders. Once tonight's recorded
// match lands, replace the KEY_* constants and the field probing in decodeScore with the
// exact keys from a real /api/scores/snapshot payload, then delete this note.

const KEY_GOALS = 1;
const KEY_CORNERS = 2;
const KEY_YELLOW = 3;
const KEY_RED = 4;

const PHASE_ENDED = 5;
const PHASE_ENDED_PENS = 13;

// Full-time whistle, aligned with app/src/mock/probability.ts WHISTLE (90 + typical stoppage).
export const WHISTLE = 93;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function numAt(rec: Record<string, unknown> | null, keys: string[]): number {
  if (!rec) return 0;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
}

// Sum a base_key across both halves (period 1 and 2) for a given team subtree.
function sumStat(team: Record<string, unknown> | null, base: number): number {
  if (!team) return 0;
  const p1 = numAt(team, [String(1000 + base), `p1_${base}`, `h1_${base}`]);
  const p2 = numAt(team, [String(2000 + base), `p2_${base}`, `h2_${base}`]);
  const flat = numAt(team, [String(base), `k${base}`]);
  return p1 + p2 + flat;
}

// Decode a raw scores payload into the feed-agnostic match state the leg logic consumes.
// Defensive: every unknown shape degrades to zeros / not-ended rather than throwing, so a
// surprise payload never crashes the stream. Kept loose until the real keys are confirmed.
export function decodeScore(rawScores: unknown, fallbackMinute: number): DecodedScore {
  const root = asRecord(rawScores);

  const minute = numAt(root, ['minute', 'clock', 'matchMinute', 'time_minutes']) || fallbackMinute;

  const homeTeam =
    asRecord(root?.['home']) ?? asRecord(root?.['p1']) ?? asRecord(root?.['team1']) ?? asRecord(root?.['homeTeam']);
  const awayTeam =
    asRecord(root?.['away']) ?? asRecord(root?.['p2']) ?? asRecord(root?.['team2']) ?? asRecord(root?.['awayTeam']);

  const home =
    sumStat(homeTeam, KEY_GOALS) || numAt(root, ['homeGoals', 'p1Goals', 'homeScore', 'score_home']);
  const away =
    sumStat(awayTeam, KEY_GOALS) || numAt(root, ['awayGoals', 'p2Goals', 'awayScore', 'score_away']);

  const corners =
    sumStat(homeTeam, KEY_CORNERS) + sumStat(awayTeam, KEY_CORNERS) ||
    numAt(root, ['corners', 'totalCorners', 'cornersTotal']);

  const cards =
    sumStat(homeTeam, KEY_YELLOW) +
      sumStat(awayTeam, KEY_YELLOW) +
      sumStat(homeTeam, KEY_RED) +
      sumStat(awayTeam, KEY_RED) || numAt(root, ['cards', 'totalCards', 'bookings']);

  const phase = numAt(root, ['phase', 'gamePhase', 'phaseCode', 'status']);
  const ended = phase === PHASE_ENDED || phase === PHASE_ENDED_PENS;
  const isFullTime = ended || minute >= WHISTLE;

  return { minute, home, away, corners, cards, isFullTime, ended };
}

function overUnder(count: number, line: number, side: 'over' | 'under', isFullTime: boolean): LegStatus {
  const need = Math.floor(line) + 1;
  if (side === 'over') {
    if (count >= need) return 'won';
    return isFullTime ? 'lost' : 'pending';
  }
  if (count > Math.floor(line)) return 'lost';
  return isFullTime ? 'won' : 'pending';
}

// Resolve one leg against the decoded state, following the natural-settlement table in
// docs/GAME_DESIGN.md (Over can win early, Under can lose early, 1X2 at the whistle, etc).
// Mirrors the status branches in app/src/mock/probability.ts.
export function resolveLeg(leg: LegDescriptor, s: DecodedScore): LegStatus {
  const m = leg.market;
  switch (m.kind) {
    case 'totalGoals':
      return overUnder(s.home + s.away, m.line ?? 0, m.side === 'under' ? 'under' : 'over', s.isFullTime);
    case 'teamGoals':
      return overUnder(
        m.team === 'away' ? s.away : s.home,
        m.line ?? 0,
        m.side === 'under' ? 'under' : 'over',
        s.isFullTime,
      );
    case 'totalCorners':
      return overUnder(s.corners, m.line ?? 0, m.side === 'under' ? 'under' : 'over', s.isFullTime);
    case 'totalCards':
      return overUnder(s.cards, m.line ?? 0, m.side === 'under' ? 'under' : 'over', s.isFullTime);
    case 'btts': {
      const both = s.home >= 1 && s.away >= 1;
      if (m.side === 'no') {
        if (both) return 'lost';
        return s.isFullTime ? 'won' : 'pending';
      }
      if (both) return 'won';
      return s.isFullTime ? 'lost' : 'pending';
    }
    case 'matchResult': {
      if (!s.isFullTime) return 'pending';
      const diff = s.home - s.away;
      if (m.side === 'home') return diff > 0 ? 'won' : 'lost';
      if (m.side === 'away') return diff < 0 ? 'won' : 'lost';
      return diff === 0 ? 'won' : 'lost';
    }
    default:
      return 'pending';
  }
}
