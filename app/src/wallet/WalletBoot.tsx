import { useMemo, type FC, type ReactNode } from 'react';
import { clusterApiUrl, type Transaction } from '@solana/web3.js';
import {
  ConnectionProvider as RawConnectionProvider,
  WalletProvider as RawWalletProvider,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';
import {
  WalletModalProvider as RawWalletModalProvider,
  WalletMultiButton as RawWalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { ComboRaceClient, type ComboRaceClientOptions } from '@comborace/sdk';
import { RaceClientContext, type RaceClientBridge } from '../game/clientContext';
import '@solana/wallet-adapter-react-ui/styles.css';

// The mobile wallet adapter pulls a React 19 copy of @types/react into the tree, so the
// provider components resolve as React 19 FCs that our React 18 JSX runtime rejects. Re-type
// them as plain React 18 components; runtime behaviour is unchanged.
const ConnectionProvider = RawConnectionProvider as unknown as FC<{ endpoint: string; children: ReactNode }>;
const WalletProvider = RawWalletProvider as unknown as FC<{
  wallets: PhantomWalletAdapter[];
  autoConnect?: boolean;
  children: ReactNode;
}>;
const WalletModalProvider = RawWalletModalProvider as unknown as FC<{ children: ReactNode }>;
const WalletMultiButton = RawWalletMultiButton as unknown as FC;

const ENDPOINT =
  typeof import.meta.env.VITE_SOLANA_RPC === 'string' && import.meta.env.VITE_SOLANA_RPC !== ''
    ? import.meta.env.VITE_SOLANA_RPC
    : clusterApiUrl('mainnet-beta');

export function WalletBoot({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ClientBridge>{children}</ClientBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function ClientBridge({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();

  const bridge = useMemo<RaceClientBridge>(() => {
    return {
      connected: connected && publicKey !== null && signTransaction !== undefined,
      address: publicKey ? publicKey.toBase58() : null,
      build: () => {
        if (!publicKey || !signTransaction) throw new Error('wallet is not connected');
        const sign = signTransaction;
        // The app and the SDK each resolve their own @solana/web3.js copy (same version), whose
        // PublicKey/Connection classes are nominally distinct; the cast bridges the two copies.
        const options = {
          connection,
          wallet: {
            publicKey,
            signTransaction: (tx: Transaction) => sign(tx),
          },
        } as unknown as ComboRaceClientOptions;
        return new ComboRaceClient(options);
      },
    };
  }, [connection, connected, publicKey, signTransaction]);

  return (
    <RaceClientContext.Provider value={bridge}>
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 60 }}>
        <WalletMultiButton />
      </div>
      {children}
    </RaceClientContext.Provider>
  );
}
