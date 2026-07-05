#!/usr/bin/env bash
# Throwaway devnet deploy helper for combo_race.
# Reads the built program keypair, writes its id into declare_id! + Anchor.toml
# + sdk constants, rebuilds, and deploys to devnet with the Agave 3.1.11 toolchain.
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
REPO=/home/carlos_quantum3labs_com/farmer-skills/projects/comborace
PROG_DIR="$REPO/program"
KEYPAIR="$PROG_DIR/target/deploy/combo_race-keypair.json"
SO="$PROG_DIR/target/deploy/combo_race.so"

# force the complete toolchain (anchor invocations flip active_release to a broken 1.18.17)
ln -sfn "$HOME/.local/share/solana/install/releases/stable-25cd9da946ebf6d90024ac32071d05b319715589/solana-release" \
  "$HOME/.local/share/solana/install/active_release"

PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR")
echo "program id: $PROGRAM_ID"

OLD="Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
# declare_id in lib.rs
sed -i "s/$OLD/$PROGRAM_ID/g" "$PROG_DIR/programs/combo_race/src/lib.rs"
# Anchor.toml program ids (all clusters)
sed -i "s/$OLD/$PROGRAM_ID/g" "$PROG_DIR/Anchor.toml"
# sdk constant
sed -i "s/$OLD/$PROGRAM_ID/g" "$REPO/sdk/src/constants.ts"

echo "=== rebuilding with real declare_id ==="
( cd "$PROG_DIR" && cargo-build-sbf 2>&1 | tail -5 )

echo "=== so size ==="
ls -la "$SO"
echo "=== balance before deploy ==="
solana balance

echo "=== deploying to devnet ==="
solana program deploy "$SO" \
  --program-id "$KEYPAIR" \
  --url devnet \
  --keypair "$HOME/.config/solana/id.json"

echo "=== deployed. program account on devnet: ==="
solana program show "$PROGRAM_ID" --url devnet
