#!/usr/bin/env bash
# Render the full 4-car ComboRace set on the GPU box.
# Per player we vary only the main body hue; roof grey + brand-purple accents
# stay fixed. Outputs land under ~/comborace_car/out/<car>/.
set -euo pipefail

BL="$HOME/blender-5.1.2-linux-x64/blender"
CC="$HOME/comborace_car"
cd "$CC"

names=(car1 car2 car3 car4)
hues=(2E8E86 C79A44 A663A6 7C9A5E)   # teal, gold, orchid, sage

for i in "${!names[@]}"; do
  n="${names[$i]}"; h="${hues[$i]}"
  mkdir -p "out/$n/crash"
  echo "### $n ($h) hero ###"
  BODY_HEX="$h" OUT="$CC/out/$n/hero.png" SAMPLES=176 RESX=1600 RESY=1200 \
    "$BL" -b -P car_hero.py >"out/$n/hero.log" 2>&1
  echo "### $n ($h) crash ###"
  BODY_HEX="$h" OUTDIR="$CC/out/$n/crash" SAMPLES=112 RESX=1200 RESY=900 NFRAMES=18 \
    "$BL" -b -P car_crash.py >"out/$n/crash.log" 2>&1
  echo "### $n normalize ###"
  python3 normalize_frames.py "$CC/out/$n/crash"
done
echo "ALL DONE"
