# Third-party notices — NEXUS Engine Pro

This file summarizes open-source components **shipped** in this repository and how we treat components we **do not** ship.

## Shipped in `vendor/` (browser bundles)

| Component | License | Notes |
|-----------|---------|--------|
| **Butterchurn** (`butterchurn.min.js`) | MIT | WebGL MilkDrop-class preset renderer. Upstream: [jberg/butterchurn](https://github.com/jberg/butterchurn). Do not fork for production fixes without a license review; prefer vendored releases. |
| **butterchurn-presets** (`butterchurnPresets*.min.js`) | MIT (preset pack per upstream) | Preset JSON and pack tooling from [jberg/butterchurn-presets](https://github.com/jberg/butterchurn-presets). Individual presets retain original MilkDrop / community authorship. |

Optional extra packs installed via `vendor/fetch-extra-presets.sh` are subject to the same upstream licenses; list any additional filenames here when you add them.

## Referenced but not vendored here

| Component | Typical license | Status in this repo |
|-----------|-----------------|---------------------|
| **projectM** | LGPL | **Not shipped.** Evaluated only for compatibility research. Commercial redistribution of LGPL WASM/native builds requires legal review; overlaps Butterchurn’s role for MilkDrop-class visuals. |

## Engineering references

WebGL raymarching / SDF scenes may cite common literature (e.g. Inigo Quilez’s articles) as **technique references**; scene code in `js/scenes/` is project-authored unless a file header states otherwise.

## Trademarks

**MilkDrop** is a historical product name for the preset ecosystem. **Aurora Field** is the in-product name for the Butterchurn-driven spectrum layer. **NEXUS Engine Pro** is project branding.

## Updates

Bump this file whenever you add or upgrade a vendored bundle. Keep the in-app **Credits** disclosure (`index.html`) aligned with this list.
