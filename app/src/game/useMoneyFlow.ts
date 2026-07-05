import { useEffect, useRef, useState } from 'react';
import {
  MockComboRaceClient,
  type Address,
  type ComboRaceClientInterface,
  type PoolState,
} from '@comborace/sdk/mock';
import { BUY_IN, type Racer } from './session';
import { useRaceClientBridge } from './clientContext';

export interface Settlement {
  winner: Racer;
  amount: number;
  signature: string;
  youWon: boolean;
  poolAddress: Address;
}

export type FlowPhase = 'funding' | 'racing' | 'settling' | 'paid';

// Wires the escrow lifecycle through a ComboRaceClientInterface so the pot is real in the UI:
// create the pool, ante every racer in, then settle to the off-chain winner and claim the vault
// at full time. Defaults to the in-memory mock (no wallet, no program). When the real client is
// toggled on and a wallet is connected, the same call sites drive the connected wallet as a
// solo pool; a genuine multi-wallet ante needs one signer per racer and is deferred.
export function useMoneyFlow(field: Racer[]) {
  const bridge = useRaceClientBridge();
  const real = (bridge?.connected ?? false) && bridge?.address != null;
  const walletAddr = real ? (bridge?.address ?? null) : null;

  const buildRealClient = useRef<(() => ComboRaceClientInterface) | null>(null);
  buildRealClient.current = real && bridge ? bridge.build : null;

  const clientRef = useRef<ComboRaceClientInterface | null>(null);
  const poolAddr = useRef<Address | null>(null);
  const authorityRef = useRef<Address>('');
  const [pool, setPool] = useState<PoolState | null>(null);
  const [phase, setPhase] = useState<FlowPhase>('funding');

  const host = field.find((r) => r.isYou) ?? field[0];
  const hostAddr = walletAddr ?? host?.address ?? '';

  useEffect(() => {
    if (field.length === 0) return;
    let cancelled = false;
    const client: ComboRaceClientInterface =
      real && buildRealClient.current ? buildRealClient.current() : new MockComboRaceClient({ latencyMs: 220 });
    clientRef.current = client;
    authorityRef.current = hostAddr;
    // With the real client only the connected wallet can sign, so a single wallet antes one seat;
    // the mock signs for every racer.
    const seats: Address[] = real && walletAddr ? [walletAddr] : field.map((r) => r.address);
    setPhase('funding');
    setPool(null);

    (async () => {
      const created = await client.createPool({ authority: hostAddr, buyIn: BUY_IN });
      poolAddr.current = created.pool;
      for (const seat of seats) {
        await client.joinPool({ pool: created.pool, player: seat });
        if (cancelled) return;
        const mid = await client.getPool(created.pool);
        if (!cancelled && mid) setPool(mid);
      }
      if (cancelled) return;
      const state = await client.getPool(created.pool);
      if (!cancelled && state) {
        setPool(state);
        setPhase('racing');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [field, hostAddr, real, walletAddr]);

  async function settleAndPay(winner: Racer): Promise<Settlement | null> {
    const client = clientRef.current;
    const addr = poolAddr.current;
    if (!client || !addr) return null;
    setPhase('settling');
    // In the real solo pool the sole depositor is the connected wallet, so settlement pays it;
    // the mock settles to whichever racer won the race.
    const winnerAddr = real && walletAddr ? walletAddr : winner.address;
    await client.settle({ pool: addr, authority: authorityRef.current, winner: winnerAddr });
    const claim = await client.claim({ pool: addr, winner: winnerAddr });
    const state = await client.getPool(addr);
    if (state) setPool(state);
    setPhase('paid');
    return {
      winner,
      amount: state?.pot ?? BUY_IN * field.length,
      signature: claim.signature,
      youWon: winner.isYou,
      poolAddress: addr,
    };
  }

  return { pool, phase, settleAndPay };
}
