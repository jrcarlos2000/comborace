import type { ComboDescriptor } from './types.js';

// Server-side mirror of the balanced grid in app/src/mock/combos.ts. The app defines its
// legs as probability estimators; here each leg is a market descriptor instead, because the
// server reads a real win-probability (Pct) from TxLINE per market rather than modelling it.
// Keep the ids, handles, colors, multipliers, antes and taglines in sync with the app so a
// replayed real match paints the same four cars the mock demo did.
export const COMBOS: ComboDescriptor[] = [
  {
    id: 'messi',
    handle: 'MessiGoat99',
    color: '#22E1FF',
    colorRgb: '34,225,255',
    multiplier: 3.4,
    ante: 20,
    tagline: 'goals or nothing',
    legs: [
      { id: 'g', label: 'Over 2.5 goals', short: 'O2.5', market: { kind: 'totalGoals', side: 'over', line: 2.5 } },
      { id: 'c', label: 'Over 8.5 corners', short: 'O8.5 crn', market: { kind: 'totalCorners', side: 'over', line: 8.5 } },
    ],
  },
  {
    id: 'rico',
    handle: 'RicoSuave',
    color: '#FF8A1E',
    colorRgb: '255,138,30',
    multiplier: 2.1,
    ante: 20,
    tagline: 'the under is free money',
    legs: [
      { id: 'g', label: 'Under 2.5 goals', short: 'U2.5', market: { kind: 'totalGoals', side: 'under', line: 2.5 } },
      { id: 'k', label: 'Under 4.5 cards', short: 'U4.5 crd', market: { kind: 'totalCards', side: 'under', line: 4.5 } },
    ],
  },
  {
    id: 'bro',
    handle: 'BetBroski',
    color: '#FF3AF0',
    colorRgb: '255,58,240',
    multiplier: 2.8,
    ante: 20,
    tagline: 'both nets bulge',
    legs: [
      { id: 'b', label: 'Both teams to score', short: 'BTTS', market: { kind: 'btts', side: 'yes' } },
      { id: 'c', label: 'Over 9.5 corners', short: 'O9.5 crn', market: { kind: 'totalCorners', side: 'over', line: 9.5 } },
    ],
  },
  {
    id: 'oracle',
    handle: 'TheOracle',
    color: '#B6FF3A',
    colorRgb: '182,255,58',
    multiplier: 2.4,
    ante: 20,
    tagline: 'home holds the line',
    legs: [
      { id: 'w', label: 'Home win', short: 'HOME', market: { kind: 'matchResult', side: 'home' } },
      { id: 't', label: 'Home over 1.5 goals', short: 'O1.5 H', market: { kind: 'teamGoals', side: 'over', line: 1.5, team: 'home' } },
    ],
  },
];
