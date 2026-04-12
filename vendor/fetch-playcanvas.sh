#!/usr/bin/env sh
# Re-download PlayCanvas engine UMD build (MIT). Pin version when upgrading.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${PLAYCANVAS_VERSION:-2.17.2}"
URL="https://cdn.jsdelivr.net/npm/playcanvas@${VER}/build/playcanvas.min.js"
echo "Fetching PlayCanvas ${VER} -> vendor/playcanvas.min.js"
curl -fsSL "$URL" -o "${ROOT}/vendor/playcanvas.min.js"
wc -c "${ROOT}/vendor/playcanvas.min.js"
