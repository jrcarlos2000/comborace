import type { ComboDescriptor } from './types.js';

// Server-side mirror of the four house cars in app/src/mock/combos.ts. The app defines its legs
// as probability estimators; here each leg is a market descriptor instead, because the server
// reads a real de-vigged win-probability (Pct) from TxLINE per market rather than modelling it.
// Every market is one TxLINE prices (goals totals, team goals, 1X2, Asian handicap): no corners,
// cards or BTTS, which carry no Pct. Ids, handles, colors, multipliers, antes and taglines stay
// in sync with the app so a replayed real match paints the same four cars the mock demo did.
export const COMBOS: ComboDescriptor[] = [
  {
    id: 'messi',
    handle: 'NitroNova',
    color: '#3FB6B0',
    colorRgb: '63,182,176',
    multiplier: 3.2,
    ante: 20,
    tagline: 'goals or bust',
    legs: [
      { id: 'g1', label: 'over 1.5 goals', short: 'O1.5', market: { kind: 'totalGoals', side: 'over', line: 1.5 } },
      { id: 'g2', label: 'over 2.5 goals', short: 'O2.5', market: { kind: 'totalGoals', side: 'over', line: 2.5 } },
    ],
  },
  {
    id: 'rico',
    handle: 'RicoSuave',
    color: '#E0B052',
    colorRgb: '224,176,82',
    multiplier: 2.0,
    ante: 20,
    tagline: 'a quiet game pays',
    legs: [
      { id: 'u1', label: 'under 2.5 goals', short: 'U2.5', market: { kind: 'totalGoals', side: 'under', line: 2.5 } },
      { id: 'u2', label: 'under 3.5 goals', short: 'U3.5', market: { kind: 'totalGoals', side: 'under', line: 3.5 } },
    ],
  },
  {
    id: 'oracle',
    handle: 'TheOracle',
    color: '#7FB86A',
    colorRgb: '127,184,106',
    multiplier: 2.4,
    ante: 20,
    tagline: 'home holds the line',
    legs: [
      { id: 'w', label: 'home win', short: 'HOME', market: { kind: 'matchResult', side: 'home' } },
      { id: 't', label: 'home over 1.5 goals', short: 'HOME O1.5', market: { kind: 'teamGoals', side: 'over', line: 1.5, team: 'home' } },
    ],
  },
  {
    id: 'bro',
    handle: 'BetBroski',
    color: '#B478D6',
    colorRgb: '180,120,214',
    multiplier: 3.4,
    ante: 20,
    tagline: 'the underdog bites back',
    legs: [
      { id: 'h', label: 'away +1.5 handicap', short: 'AWAY +1.5', market: { kind: 'asianHandicap', side: 'away', line: 1.5, team: 'away' } },
      { id: 't', label: 'away over 0.5 goals', short: 'AWAY O0.5', market: { kind: 'teamGoals', side: 'over', line: 0.5, team: 'away' } },
    ],
  },
];
