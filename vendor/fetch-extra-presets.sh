#!/usr/bin/env bash
# Optional: add ALL official butterchurn-presets bundles (merge in preset-library.js).
set -e
V="2.4.7"
BASE="https://unpkg.com/butterchurn-presets@${V}/lib"
cd "$(dirname "$0")"
for f in butterchurnPresetsExtra.min.js butterchurnPresetsExtra2.min.js butterchurnPresetsMD1.min.js butterchurnPresetsNonMinimal.min.js; do
  echo "Fetching $f ..."
  curl -fsSL "$BASE/$f" -o "$f"
done
echo "Done. Uncomment the matching <script> lines in index.html (see comment there)."
