#!/usr/bin/env python3
"""
NEXUS static smoke test — required files and bootstrap markers exist.

Run from monorepo root:
  python3 NEXUS/scripts/nexus_smoke.py

Or from NEXUS/ (parent of scripts/):
  python3 scripts/nexus_smoke.py
"""
from __future__ import annotations

import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NEXUS_ROOT = os.path.dirname(SCRIPT_DIR)

REQUIRED_FILES = [
    "index.html",
    "css/nexus.css",
    "js/engine.js",
    "js/ui.js",
    "js/watermark.js",
    "js/nexus-brand.js",
    "js/nx-store.js",
    "js/nx-persist.js",
    "js/nx-bootstrap.js",
    "js/nx-hw-calibrate.js",
    "js/app-loader.mjs",
    "js/main.mjs",
    "js/nx-structure-mood.js",
    "js/nexus-evolve-stack.js",
    "js/nx-clip-pad.js",
    "js/nexus-gpu-particles.js",
    "js/nx-bpm-timeline.js",
    "js/scenes/nx-spectral-mesh.js",
    "README.md",
    "docs/AI-COLLABORATION.md",
    "docs/PRODUCT-ROADMAP.md",
    "docs/SHIP-CRITERIA.md",
    "docs/QA-MATRIX.md",
    "docs/VISUAL-TECH-ROADMAP.md",
]


def main() -> int:
    missing = []
    for rel in REQUIRED_FILES:
        path = os.path.join(NEXUS_ROOT, rel)
        if not os.path.isfile(path):
            missing.append(rel)
    if missing:
        print("NEXUS smoke FAIL — missing:", ", ".join(missing), file=sys.stderr)
        return 1

    index_path = os.path.join(NEXUS_ROOT, "index.html")
    with open(index_path, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()
    boot_path = os.path.join(NEXUS_ROOT, "js", "nx-bootstrap.js")
    with open(boot_path, "r", encoding="utf-8", errors="replace") as f:
        boot_js = f.read()
    if "NX.watermark.checkPro" not in boot_js:
        print("NEXUS smoke FAIL — nx-bootstrap.js missing watermark bootstrap", file=sys.stderr)
        return 1
    if "main.mjs" not in html and "app-loader.mjs" not in html:
        print("NEXUS smoke FAIL — index.html missing ES module entry (main.mjs or app-loader.mjs)", file=sys.stderr)
        return 1
    if not re.search(r"id=[\"']nx-pro-unlock-btn[\"']", html):
        print("NEXUS smoke FAIL — index.html missing Pro unlock UI id", file=sys.stderr)
        return 1

    print("NEXUS smoke OK —", len(REQUIRED_FILES), "files + bootstrap markers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
