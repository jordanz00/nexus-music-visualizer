# Third-party notices — NEXUS Engine Pro

This file summarizes open-source components **shipped** in this repository and how we treat components we **do not** ship.

## Shipped in `vendor/` (browser bundles)

| Component | License | Notes |
|-----------|---------|--------|
| **Butterchurn** (`butterchurn.min.js`) | MIT | WebGL MilkDrop-class preset renderer. Upstream: [jberg/butterchurn](https://github.com/jberg/butterchurn). Do not fork for production fixes without a license review; prefer vendored releases. |
| **butterchurn-presets** (`butterchurnPresets*.min.js`) | MIT (preset pack per upstream) | Preset JSON and pack tooling from [jberg/butterchurn-presets](https://github.com/jberg/butterchurn-presets). Individual presets retain original MilkDrop / community authorship. |
| **three.js** (`vendor/three.min.js`) | MIT | Optional guest 3D layer when `?three=1` or `localStorage nexus.three.guest=1` — upstream [mrdoob/three.js](https://github.com/mrdoob/three.js). Loaded dynamically from `index.html` bootstrap; not required for core VJ operation. |
| **three.js r136 ESM** (`vendor/particula/three.module.r136.js`) | MIT | **Separate** pinned build used only by the Particula-derived MIX particle overlay (`js/particula/nexus-entry.mjs`); does not replace `vendor/three.min.js` for guest scenes. |
| **dat.GUI** (`vendor/particula/dat.gui.module.js`) | Apache-2.0 (per upstream `dat.gui` package) | In-app parameter panels for the Particula-derived overlay; vendored ESM (no CDN). |
| **Particula (adapted)** | MIT | Sphere / noise / beat-visual logic and preset JSON adapted from [Humprt/particula](https://github.com/Humprt/particula) into `js/particula/*` and `js/particula/data/particula_presets.json`. NEXUS remains a distinct product — credit the original authors; see `docs/PARTICULA-PORT.md`. |
| **PlayCanvas engine** (`vendor/playcanvas.min.js`) | MIT | Optional guest layer when `?playcanvas=1` or `localStorage nexus.playcanvas.guest=1` — upstream [playcanvas/engine](https://github.com/playcanvas/engine) (vendored UMD `build/playcanvas.min.js`, pinned in `vendor/fetch-playcanvas.sh`). ~2.1 MB; third WebGL context on `#c-playcanvas`. |

Optional extra packs installed via `vendor/fetch-extra-presets.sh` are subject to the same upstream licenses; list any additional filenames here when you add them.

## Optional (not vendored)

| Component | License | Notes |
|-----------|---------|-------|
| **Meyda** | MIT | Audio feature extractors; not bundled. May be vendored later for chroma / RMS features if bundle size is acceptable. |

## Referenced but not vendored here

| Component | Typical license | Status in this repo |
|-----------|-----------------|---------------------|
| **projectM** | LGPL | **Not shipped.** Evaluated only for compatibility research. Commercial redistribution of LGPL WASM/native builds requires legal review; overlaps Butterchurn’s role for MilkDrop-class visuals. |
| **Hydra** (hydra-synth) | AGPL-3.0 (typical for editor line) | **Not shipped.** Research / UX inspiration only; see `docs/NEXUS-BROWSER-VIZ-RESEARCH.md` and Credits. Do not embed without license + bundle review. |
| **cables.gl** | MIT (project) | **Runtime not vendored** in this repo. `nexus-cables-lite.js` is an original whitelist helper inspired by node-graph topology (no cables player code). |
| **MangoWave** | AGPL-3.0 | **Not shipped.** Third-party MilkDrop-class browser player — listed for comparison only; AGPL differs from NEXUS default stack. |
| **Demoscene / pouët / CSDb links** | n/a | **Not shipped.** Educational links in docs and Credits only. |

## Research documentation (project-authored)

| File | Notes |
|------|--------|
| `docs/NEXUS-BROWSER-VIZ-RESEARCH.md` | Curated external links (OSS browser viz, WebGPU, demoscene lessons); no third-party code. |
| `js/nexus-engine/nexus-research-brief.js` | Read-only `NX.ResearchBrief` metadata for same pointers; optional `?research=1` console hint. |

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
| `js/nexus-engine/nexus-isf-loader.js` | Parses ISF-style JSON metadata only; **does not** ship ISF sample packs. Spec reference: [ISF_Spec](https://github.com/mrRay/ISF_Spec). |
| `js/nexus-engine/nexus-cables-lite.js` | Whitelist “mini graph” helpers inspired by [cables.gl](https://cables.gl/) topology; **no** cables.gl runtime embedded. |
| `js/nexus-engine/nexus-homage-dom-overlays.js` | Original DOM HUD strings only (CYBR / YNI / MAZE / T00); no third-party prose or iframes. |
| `js/nexus-engine/nexus-maze-three.js` | Original maze generator + Three.js on `#c-three`; optional `vendor/three.min.js` (MIT). |

## Trademarks

**MilkDrop** is a historical product name for the preset ecosystem. **Aurora Field** is the in-product name for the Butterchurn-driven spectrum layer. **NEXUS Engine Pro** is project branding.

## Updates

Bump this file whenever you add or upgrade a vendored bundle. Keep the in-app **Credits** disclosure (`index.html`) aligned with this list.
