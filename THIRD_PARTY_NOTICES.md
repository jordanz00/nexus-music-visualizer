# Third-party notices — NEXUS Engine Pro

This file summarizes open-source components **shipped** in this repository and how we treat components we **do not** ship.

## Shipped in `vendor/` (browser bundles)

| Component | License | Notes |
|-----------|---------|--------|
| **Butterchurn** (`butterchurn.min.js`) | MIT | WebGL MilkDrop-class preset renderer. Upstream: [jberg/butterchurn](https://github.com/jberg/butterchurn). Do not fork for production fixes without a license review; prefer vendored releases. |
| **butterchurn-presets** (`butterchurnPresets*.min.js`) | MIT (preset pack per upstream) | Preset JSON and pack tooling from [jberg/butterchurn-presets](https://github.com/jberg/butterchurn-presets). Individual presets retain original MilkDrop / community authorship. |
| **three.js** (`vendor/three.min.js`) | MIT | Optional guest 3D layer when `?three=1` or `localStorage nexus.three.guest=1` — upstream [mrdoob/three.js](https://github.com/mrdoob/three.js). Loaded dynamically from `index.html` bootstrap; not required for core VJ operation. |

Optional extra packs installed via `vendor/fetch-extra-presets.sh` are subject to the same upstream licenses; list any additional filenames here when you add them.

## Optional (not vendored)

| Component | License | Notes |
|-----------|---------|-------|
| **Meyda** | MIT | Audio feature extractors; not bundled. May be vendored later for chroma / RMS features if bundle size is acceptable. |

## Referenced but not vendored here

| Component | Typical license | Status in this repo |
|-----------|-----------------|---------------------|
| **projectM** | LGPL | **Not shipped.** Evaluated only for compatibility research. Commercial redistribution of LGPL WASM/native builds requires legal review; overlaps Butterchurn’s role for MilkDrop-class visuals. |

## Engineering references

WebGL raymarching / SDF scenes may cite common literature (e.g. Inigo Quilez’s articles) as **technique references**; scene code in `js/scenes/` is project-authored unless a file header states otherwise.

## Project-authored scene packs (no third-party media)

| File | Notes |
|------|--------|
| `js/scenes/preset-pack-2026.js` | **PRESET_PACK_2026**: 30 additional WebGL fragment scenes (original GLSL). |
| `js/scenes/homage-gl-scenes.js` | **Homage moods**: original shaders only; UI credits in `index.html` name public web works as **inspiration** (no copied prose, no embedded third-party sites). |
| `js/nexus-engine/hybrid-layer-registry.js` | Layer-stack metadata only; no external code. |
| `js/nexus-engine/nexus-homage-bridge.js` | Scene-driven hybrid presets + HM uniform drivers; project code. |
| `js/nexus-engine/nexus-audio-procedural-bus.js` | Documentation helper for audio→uniform mapping; project code. |

## Trademarks

**MilkDrop** is a historical product name for the preset ecosystem. **Aurora Field** is the in-product name for the Butterchurn-driven spectrum layer. **NEXUS Engine Pro** is project branding.

## Updates

Bump this file whenever you add or upgrade a vendored bundle. Keep the in-app **Credits** disclosure (`index.html`) aligned with this list.
