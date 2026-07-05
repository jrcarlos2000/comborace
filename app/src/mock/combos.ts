import { carColors } from '../theme/colors';
import {
  asianHandicap,
  drawResult,
  firstHalfOverGoals,
  homeWin,
  awayWin,
  overGoals,
  overTeamGoals,
  underGoals,
  type LegEval,
  type MatchState,
} from './probability';

export interface LegDef {
  id: string;
  label: string;
  short: string;
  eval: (s: MatchState) => LegEval;
}

export interface ComboDef {
  id: string;
  handle: string;
  color: string;
  colorRgb: string;
  multiplier: number;
  ante: number;
  tagline: string;
  legs: LegDef[];
}

// Turns the internal odds multiplier into a plain risk word for the picker, so a non-gambler
// reads "how long a shot is this car" instead of a betting multiple.
export function difficultyLabel(multiplier: number): { text: string; tone: 'safe' | 'even' | 'risky' | 'longshot' } {
  if (multiplier <= 2.1) return { text: 'safe pick', tone: 'safe' };
  if (multiplier <= 2.8) return { text: 'even odds', tone: 'even' };
  if (multiplier <= 3.6) return { text: 'risky', tone: 'risky' };
  return { text: 'long shot', tone: 'longshot' };
}

// A balanced grid: four cars drafted across opposing GOALS markets so any goal helps some cars
// and hurts others. No single scoreline moves the whole field the same way. Every leg is a
// market TxLINE prices with a de-vigged Pct (over/under goals, 1X2, Asian handicap, team totals),
// so a car's position is a real oracle number rather than a modeled guess. Kept in sync with the
// server descriptors in server/src/txline/combos.ts.
export const COMBOS: ComboDef[] = [
  {
    id: 'messi',
    handle: 'NitroNova',
    color: carColors[0].hex,
    colorRgb: carColors[0].rgb,
    multiplier: 3.2,
    ante: 20,
    tagline: 'goals or bust',
    legs: [
      { id: 'g1', label: 'over 1.5 goals', short: 'O1.5', eval: (s) => overGoals(1.5, s) },
      { id: 'g2', label: 'over 2.5 goals', short: 'O2.5', eval: (s) => overGoals(2.5, s) },
    ],
  },
  {
    id: 'rico',
    handle: 'RicoSuave',
    color: carColors[1].hex,
    colorRgb: carColors[1].rgb,
    multiplier: 2.0,
    ante: 20,
    tagline: 'a quiet game pays',
    legs: [
      { id: 'u1', label: 'under 2.5 goals', short: 'U2.5', eval: (s) => underGoals(2.5, s) },
      { id: 'u2', label: 'under 3.5 goals', short: 'U3.5', eval: (s) => underGoals(3.5, s) },
    ],
  },
  {
    id: 'oracle',
    handle: 'TheOracle',
    color: carColors[3].hex,
    colorRgb: carColors[3].rgb,
    multiplier: 2.4,
    ante: 20,
    tagline: 'home holds the line',
    legs: [
      { id: 'w', label: 'home win', short: 'HOME', eval: (s) => homeWin(s) },
      { id: 't', label: 'home over 1.5 goals', short: 'HOME O1.5', eval: (s) => overTeamGoals(1.5, 'home', s) },
    ],
  },
  {
    id: 'bro',
    handle: 'BetBroski',
    color: carColors[2].hex,
    colorRgb: carColors[2].rgb,
    multiplier: 3.4,
    ante: 20,
    tagline: 'the underdog bites back',
    legs: [
      { id: 'h', label: 'away +1.5 handicap', short: 'AWAY +1.5', eval: (s) => asianHandicap('away', 1.5, s) },
      { id: 't', label: 'away over 0.5 goals', short: 'AWAY O0.5', eval: (s) => overTeamGoals(0.5, 'away', s) },
    ],
  },
];

// Extra goals-market cars for the lobby draft board, spread across the same opposing axes so the
// grid stays balanced whatever the pick. Draw (1X2), first-half goals and higher over/under lines
// widen the menu without leaving the markets the feed genuinely prices.
export const DRAFT_EXTRAS: ComboDef[] = [
  {
    id: 'nyx',
    handle: 'NyxUnderdog',
    color: carColors[4].hex,
    colorRgb: carColors[4].rgb,
    multiplier: 4.0,
    ante: 20,
    tagline: 'away steals a wild one',
    legs: [
      { id: 'w', label: 'away win', short: 'AWAY', eval: (s) => awayWin(s) },
      { id: 'g', label: 'over 2.5 goals', short: 'O2.5', eval: (s) => overGoals(2.5, s) },
    ],
  },
  {
    id: 'blitz',
    handle: 'BlitzMode',
    color: carColors[5].hex,
    colorRgb: carColors[5].rgb,
    multiplier: 4.3,
    ante: 20,
    tagline: 'goal fest or bust',
    legs: [
      { id: 'g', label: 'over 3.5 goals', short: 'O3.5', eval: (s) => overGoals(3.5, s) },
      { id: 't', label: 'home over 1.5 goals', short: 'HOME O1.5', eval: (s) => overTeamGoals(1.5, 'home', s) },
    ],
  },
  {
    id: 'wall',
    handle: 'TheWall',
    color: carColors[6].hex,
    colorRgb: carColors[6].rgb,
    multiplier: 3.6,
    ante: 20,
    tagline: 'grind it to a stalemate',
    legs: [
      { id: 'u', label: 'under 2.5 goals', short: 'U2.5', eval: (s) => underGoals(2.5, s) },
      { id: 'd', label: 'draw at full time', short: 'DRAW', eval: (s) => drawResult(s) },
    ],
  },
  {
    id: 'dash',
    handle: 'DashPace',
    color: carColors[7].hex,
    colorRgb: carColors[7].rgb,
    multiplier: 3.0,
    ante: 20,
    tagline: 'fast start, early goals',
    legs: [
      { id: 'f', label: 'first half over 1.5', short: '1H O1.5', eval: (s) => firstHalfOverGoals(1.5, s) },
      { id: 'g', label: 'over 2.5 goals', short: 'O2.5', eval: (s) => overGoals(2.5, s) },
    ],
  },
];
