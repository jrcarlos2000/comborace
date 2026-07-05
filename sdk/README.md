# @comborace/sdk

Escrow client for the ComboRace lobby pool. Two implementations behind one interface:

- `ComboRaceClient` talks to the deployed `combo_race` Solana program over `@solana/web3.js`.
- `MockComboRaceClient` runs the whole escrow in memory, no RPC, no wallet, no deployed
  program. Use it for all UI work until the program is on-chain.

Both implement `ComboRaceClientInterface`, so the UI and integration layer swap one for the
other without touching call sites.

## Install and build

```bash
cd sdk
npm install
npm run build      # emits dist/ (ESM + .d.ts)
```

## Import

```ts
// full surface (pulls in web3.js)
import { ComboRaceClient, MockComboRaceClient } from '@comborace/sdk';

// mock + types only, zero Solana dependency
import { MockComboRaceClient } from '@comborace/sdk/mock';
```

## Conventions

- Addresses cross the interface as base58 `string` (JSON friendly, wallet-adapter friendly).
- USDC amounts cross as major units: `buyIn: 20` means 20 USDC. The on-chain client converts
  to and from 6-decimal base units internally.
- Every write returns `{ signature }`. On the mock the signature is a synthetic `mock-*` id.

## Interface

```ts
type Address = string;
type PoolStatus = 'open' | 'settled' | 'paid';

interface PoolEntry {
  player: Address;
  amount: number;              // USDC major units
}

interface PoolState {
  address: Address;            // pool PDA
  poolId: number;
  authority: Address;          // host who ran init_pool / settle
  usdcMint: Address;
  vault: Address;              // program-owned token account
  buyIn: number;               // USDC major units
  pot: number;                 // total deposited, USDC major units
  playerCount: number;
  players: PoolEntry[];
  status: PoolStatus;
  winner: Address | null;      // set after settle
}

interface CreatePoolParams {
  authority: Address;          // must equal the connected wallet on the real client
  buyIn: number;               // USDC major units
  poolId?: number;             // default: random
  usdcMint?: Address;          // default: mainnet USDC
}
interface JoinPoolParams { pool: Address; player: Address; }
interface SettleParams  { pool: Address; authority: Address; winner: Address; }
interface ClaimParams   { pool: Address; winner: Address; }

interface TxResult { signature: string; }
interface CreatePoolResult extends TxResult { pool: Address; }

interface ComboRaceClientInterface {
  createPool(params: CreatePoolParams): Promise<CreatePoolResult>;
  joinPool(params: JoinPoolParams): Promise<TxResult>;
  settle(params: SettleParams): Promise<TxResult>;
  claim(params: ClaimParams): Promise<TxResult>;
  getPool(pool: Address): Promise<PoolState | null>;
}
```

## Real client construction

```ts
import { ComboRaceClient } from '@comborace/sdk';
import { Connection } from '@solana/web3.js';

const client = new ComboRaceClient({
  connection: new Connection(rpcUrl, 'confirmed'),
  wallet,                       // { publicKey, signTransaction } (wallet-adapter compatible)
  programId,                    // optional, defaults to constants.PROGRAM_ID
  usdcMint,                     // optional, defaults to mainnet USDC
  commitment: 'confirmed',      // optional
});
```

On the real client the connected wallet is always the signer. `authority`, `player`, and
`winner` params must match `wallet.publicKey`; a mismatch throws before any transaction is
built.

## Mock client

```ts
import { MockComboRaceClient } from '@comborace/sdk/mock';

const client = new MockComboRaceClient({
  latencyMs: 400,               // optional, fake wallet-confirm delay
  pools: [                      // optional, pre-seed lobbies for the UI
    { authority: hostAddr, buyIn: 20, players: [
      { player: meAddr, amount: 20 }, { player: ricoAddr, amount: 20 },
    ] },
  ],
});
// extras beyond the interface: client.seedPool(partial), client.reset()
```

## Lifecycle

`createPool` (host) then `joinPool` per player, `settle(winner)` by the host once the race
ends and the off-chain settler has the result, then `claim` by the winner to pull the pot.
`getPool` reads current state for the lobby view and the pot ticker.

## Status

- `MockComboRaceClient`: complete, tested via the in-memory lifecycle above.
- `ComboRaceClient`: type-checks and encodes instructions against the program layout, but is
  untested end to end until `combo_race` is built and deployed. Set `PROGRAM_ID` in
  `src/constants.ts` after `anchor keys sync`. If `anchor build` is available, regenerate the
  instruction and account discriminators in `src/codec.ts` from `target/idl/combo_race.json`
  to guard against any layout drift.

## Stubbed for later

- No client path for the ~2% track fee yet; add it once the program carries the rake.
- No batch settle or refund path; the escrow settles to a single winner by design.
