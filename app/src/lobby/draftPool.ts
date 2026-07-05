import { COMBOS, DRAFT_EXTRAS, type ComboDef } from '../mock/combos';

// Candidate cars for the balanced-grid draft: the four house cars plus the extra goals-market
// cars, spread across opposing bets (more vs fewer goals, home vs away, favorite vs underdog,
// draw vs a result) so no single scoreline moves the whole field the same way. Every entry is
// settleable from the same match the feed drives, and every leg is a market TxLINE prices.
export const DRAFT_POOL: ComboDef[] = [...COMBOS, ...DRAFT_EXTRAS];

// The three friends who have already locked in before you reach the draft board. Chosen to sit
// on opposing markets so the grid stays balanced no matter what you pick.
export const FRIEND_IDS = ['rico', 'bro', 'oracle'] as const;

export const FRIEND_NAMES: Record<string, string> = {
  rico: 'Rico',
  bro: 'Broski',
  oracle: 'Dede',
};
