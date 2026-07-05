# combo_race (Anchor escrow)

Minimal, non-custodial lobby escrow for ComboRace. Source only. Not built, not deployed.

## What it does

One lobby is one `Pool` PDA plus a program-owned USDC `vault`. Flow:

| Instruction | Signer | Effect |
| --- | --- | --- |
| `init_pool(pool_id, buy_in)` | authority (host) | Creates the pool PDA and its vault token account, sets the fixed buy-in. |
| `deposit()` | player | Transfers exactly `buy_in` USDC from the player into the vault, writes one `Entry` PDA per player. |
| `settle(winner)` | authority | Records the off-chain winner pubkey, flips the pool to `Settled`. |
| `claim()` | winner | Transfers the whole vault balance to the winner, flips the pool to `Paid`. |

Winner selection, the parimutuel split, and TxLINE result verification are all off-chain
by design. This program is escrow only: no Merkle proofs, no on-chain odds math.

## PDAs

- `pool`  = `["pool", authority, pool_id_le_u64]`
- `vault` = `["vault", pool]` (SPL token account, authority = pool PDA)
- `entry` = `["entry", pool, player]`

## State

`Pool { authority, usdc_mint, vault, pool_id, buy_in, total_deposited, player_count, status, winner, bump, vault_bump }`
`Entry { pool, player, amount, bump }`
`PoolStatus { Open, Settled, Paid }`

## Guards

- deposit and settle require `Open`; a second deposit from the same wallet fails on the `Entry` init.
- settle requires the pool authority (`has_one`).
- claim requires `Settled` and `signer == pool.winner`; it drains the vault and marks `Paid`.
- token accounts are checked against `pool.usdc_mint`, `pool.vault`, and the signer.

## Toolchain status

The Anchor CLI and the Solana CLI are NOT installed in this environment (`cargo` and
`rustc` are). The program was written to Anchor 0.30.1 conventions but has not been
compiled or deployed here. To build and deploy later:

```bash
# install once: https://www.anchor-lang.com/docs/installation
avm install 0.30.1 && avm use 0.30.1
solana-keygen new                 # or point Anchor.toml at an existing keypair

cd program
anchor keys sync                  # replaces the placeholder id below in lib.rs + Anchor.toml
anchor build                      # emits target/idl/combo_race.json + target/types/combo_race.ts
anchor deploy --provider.cluster devnet
```

`declare_id!` and `Anchor.toml` currently carry the placeholder
`Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`. Replace it with the real program id via
`anchor keys sync`, then set `PROGRAM_ID` in `../sdk/src/constants.ts` to match.

## Stubbed for later

- The ~2% track fee (WINNING_PLAN section 5) is not in this program. Add it as a rake in
  `claim` paying a protocol PDA before the winner transfer when the fee model is locked.
- On-chain Merkle verification of the TxLINE result is intentionally out of scope; the
  off-chain settler passes the winner directly to `settle`.
