import {
  bttsYes,
  homeWin,
  overCorners,
  overGoals,
  overTeamGoals,
  underCards,
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

// A balanced grid: four cars drafted across opposing bets so any goal helps some cars and
// hurts others. No single scoreline moves the whole field the same way.
export const COMBOS: ComboDef[] = [
  {
    id: 'messi',
    handle: 'NitroNova',
    color: '#22E1FF',
    colorRgb: '34,225,255',
    multiplier: 3.4,
    ante: 20,
    tagline: 'goals or bust',
    legs: [
      { id: 'g', label: '3 or more goals', short: '3+ goals', eval: (s) => overGoals(2.5, s) },
      { id: 'c', label: '9 or more corners', short: '9+ corners', eval: (s) => overCorners(8.5, s) },
    ],
  },
  {
    id: 'rico',
    handle: 'RicoSuave',
    color: '#FF8A1E',
    colorRgb: '255,138,30',
    multiplier: 2.1,
    ante: 20,
    tagline: 'a quiet game pays',
    legs: [
      { id: 'g', label: '2 goals or fewer', short: 'under 3 goals', eval: (s) => underGoals(2.5, s) },
      { id: 'k', label: '4 cards or fewer', short: 'under 5 cards', eval: (s) => underCards(4.5, s) },
    ],
  },
  {
    id: 'bro',
    handle: 'BetBroski',
    color: '#FF3AF0',
    colorRgb: '255,58,240',
    multiplier: 2.8,
    ante: 20,
    tagline: 'both teams score',
    legs: [
      { id: 'b', label: 'both teams score', short: 'both score', eval: (s) => bttsYes(s) },
      { id: 'c', label: '10 or more corners', short: '10+ corners', eval: (s) => overCorners(9.5, s) },
    ],
  },
  {
    id: 'oracle',
    handle: 'TheOracle',
    color: '#B6FF3A',
    colorRgb: '182,255,58',
    multiplier: 2.4,
    ante: 20,
    tagline: 'the home team wins',
    legs: [
      { id: 'w', label: 'home team wins', short: 'home wins', eval: (s) => homeWin(s) },
      { id: 't', label: 'home team scores 2+', short: 'home 2+ goals', eval: (s) => overTeamGoals(1.5, 'home', s) },
    ],
  },
];
