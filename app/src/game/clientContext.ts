import { createContext, useContext } from 'react';
import type { ComboRaceClientInterface } from '@comborace/sdk/mock';

// Bridge published by the wallet layer (only mounted when the real client is toggled on).
// When absent, the money flow falls back to the in-memory mock, so the default build needs
// neither a wallet nor any @solana code on the loaded path.
export interface RaceClientBridge {
  connected: boolean;
  address: string | null;
  build: () => ComboRaceClientInterface;
}

export const RaceClientContext = createContext<RaceClientBridge | null>(null);

export function useRaceClientBridge(): RaceClientBridge | null {
  return useContext(RaceClientContext);
}
