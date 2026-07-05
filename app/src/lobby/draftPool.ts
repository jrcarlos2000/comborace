import { type ComboDef } from '../mock/combos';
import { carColors } from '../theme/colors';
import {
  awayWin,
  bttsYes,
  homeWin,
  overCards,
  overCorners,
  overGoals,
  overTeamGoals,
  underCards,
  underGoals,
} from '../mock/probability';
import { BUY_IN } from '../game/session';

// Candidate cars for the balanced-grid draft, spread across opposing bets (more vs fewer
// goals, home vs away, both-score vs corner chaos) so no single scoreline moves the whole
// field the same way. Every entry is settleable from the same match the feed drives.
export const DRAFT_POOL: ComboDef[] = [
  {
    id: 'messi',
    handle: 'NitroNova',
    color: carColors[0].hex,
    colorRgb: carColors[0].rgb,
    multiplier: 3.4,
    ante: BUY_IN,
    tagline: 'goals or bust',
    legs: [
      { id: 'g', label: '3 or more goals', short: '3+ goals', eval: (s) => overGoals(2.5, s) },
      { id: 'c', label: '9 or more corners', short: '9+ corners', eval: (s) => overCorners(8.5, s) },
    ],
  },
  {
    id: 'rico',
    handle: 'RicoSuave',
    color: carColors[1].hex,
    colorRgb: carColors[1].rgb,
    multiplier: 2.1,
    ante: BUY_IN,
    tagline: 'a quiet game pays',
    legs: [
      { id: 'g', label: '2 goals or fewer', short: 'under 3 goals', eval: (s) => underGoals(2.5, s) },
      { id: 'k', label: '4 cards or fewer', short: 'under 5 cards', eval: (s) => underCards(4.5, s) },
    ],
  },
  {
    id: 'bro',
    handle: 'BetBroski',
    color: carColors[2].hex,
    colorRgb: carColors[2].rgb,
    multiplier: 2.8,
    ante: BUY_IN,
    tagline: 'both teams score',
    legs: [
      { id: 'b', label: 'both teams score', short: 'both score', eval: (s) => bttsYes(s) },
      { id: 'c', label: '10 or more corners', short: '10+ corners', eval: (s) => overCorners(9.5, s) },
    ],
  },
  {
    id: 'oracle',
    handle: 'TheOracle',
    color: carColors[3].hex,
    colorRgb: carColors[3].rgb,
    multiplier: 2.4,
    ante: BUY_IN,
    tagline: 'the home team wins',
    legs: [
      { id: 'w', label: 'home team wins', short: 'home wins', eval: (s) => homeWin(s) },
      { id: 't', label: 'home team scores 2+', short: 'home 2+ goals', eval: (s) => overTeamGoals(1.5, 'home', s) },
    ],
  },
  {
    id: 'nyx',
    handle: 'NyxUnderdog',
    color: carColors[4].hex,
    colorRgb: carColors[4].rgb,
    multiplier: 3.6,
    ante: BUY_IN,
    tagline: 'away steals it',
    legs: [
      { id: 'w', label: 'away team wins', short: 'away wins', eval: (s) => awayWin(s) },
      { id: 'b', label: 'both teams score', short: 'both score', eval: (s) => bttsYes(s) },
    ],
  },
  {
    id: 'blitz',
    handle: 'BlitzMode',
    color: carColors[5].hex,
    colorRgb: carColors[5].rgb,
    multiplier: 4.3,
    ante: BUY_IN,
    tagline: 'goal fest or bust',
    legs: [
      { id: 'g', label: '4 or more goals', short: '4+ goals', eval: (s) => overGoals(3.5, s) },
      { id: 't', label: 'home team scores 2+', short: 'home 2+ goals', eval: (s) => overTeamGoals(1.5, 'home', s) },
    ],
  },
  {
    id: 'wall',
    handle: 'TheWall',
    color: carColors[6].hex,
    colorRgb: carColors[6].rgb,
    multiplier: 1.8,
    ante: BUY_IN,
    tagline: 'grind it to zero',
    legs: [
      { id: 'g', label: '3 goals or fewer', short: 'under 4 goals', eval: (s) => underGoals(3.5, s) },
      { id: 'k', label: '4 cards or fewer', short: 'under 5 cards', eval: (s) => underCards(4.5, s) },
    ],
  },
  {
    id: 'havoc',
    handle: 'HavocCrew',
    color: carColors[7].hex,
    colorRgb: carColors[7].rgb,
    multiplier: 2.6,
    ante: BUY_IN,
    tagline: 'cards and corners',
    legs: [
      { id: 'c', label: '10 or more corners', short: '10+ corners', eval: (s) => overCorners(9.5, s) },
      { id: 'k', label: '4 or more cards', short: '4+ cards', eval: (s) => overCards(3.5, s) },
    ],
  },
];

// The three friends who have already locked in before you reach the draft board. Chosen to
// sit on opposing markets so the grid stays balanced no matter what you pick.
export const FRIEND_IDS = ['rico', 'bro', 'oracle'] as const;

export const FRIEND_NAMES: Record<string, string> = {
  rico: 'Rico',
  bro: 'Broski',
  oracle: 'Dede',
};
