# Changelog — NEXUS Engine Pro

All notable changes are documented in this file. Version chip in the app (`nexus-version.js`) should match the latest release entry.

## 4.0.0 — 2026-04-12

- **Pro platform:** ES module entry (`js/main.mjs`, `js/app-loader.mjs`), expanded Pro modules (workflow, engines, NDI/WebRTC paths, PlayCanvas guest, suite scenes, structure worker, Comfy client, GPU particles, film LUT, audio science, research brief), NX bootstrap/persist/store, clip pad, BPM timeline, hardware re-calibrate, structure mood / evolve stack. Details: `docs/CHANGELOG.md` (4.0.0-pro).
- **Show / I/O:** Showfile hash restore ordering, large JSON guard, scene and cue updates across `js/show/*`.
- **Tooling:** `tools/` WebRTC signaling + NDI bridge helpers; `vendor/fetch-playcanvas.sh` + vendored PlayCanvas.
- **Dependencies:** Vitest 4.x, Playwright 1.59.x; `tools/package.json` `ws` 8.20.x.

## 1.1.11 — 2026-04-10

- Removed **WORMHOLE PASSAGE** WebGL scene from `js/scenes/pro-upgrade.js`.
- Dropped **WORMHOLE** from the high-cost name regex in `js/scenes.js` (`normalizeScene`).

## 1.1.10 — 2026-04-10

- Removed **AURORA CORRIDOR** WebGL scene from `js/scenes/pro-upgrade.js`.

## 1.1.9 — 2026-04-10

- Removed **INFLECT CORRIDOR** WebGL scene from `js/scenes/vision.js`.
- Dropped **INFLECT** fractal-tag check in `js/scenes.js` (`normalizeScene`).

## 1.1.8 — 2026-04-10

- Removed **KALI ABYSS** WebGL scene from `js/scenes/vision.js` (often blank / weak hit).
- Dropped **KALI** name checks in `js/scenes.js` (`normalizeScene` fractal tag + high-cost regex).

## 1.1.7 — 2026-04-10

- Removed **WORMHOLE VOID** WebGL scene from `js/scenes/vision.js` (often blank / miss on common ray budgets).

## 1.1.6 — 2026-04-10

- Removed **MERGER SPONGE** WebGL scene from `js/scenes/vision.js` (black / non-hit raymarch in practice on common GPUs).
- Dropped **MERGER** name checks in `js/scenes.js` (`normalizeScene` fractal tag + high-cost regex).

## 1.1.5 — 2026-04-10

- Removed **ECHO LATTICE** WebGL scene from `js/scenes/unique.js` (18 shader scenes in roster).
- Dropped obsolete cost hint for that scene in `js/scenes.js` (`normalizeScene`).

## 1.1.4 — 2026-04-10

- **AudioWorklet** meter (`js/audio-meter-processor.js`) — optional RMS / crest tap in-line before the analyser; `?noworklet=1` disables. Shader uniforms **WM** / **WC** in `js/scenes.js` + `engine.js`.
- **Scenes:** `SPECTRAL HELIX`, `PRISM ORBIT` in `js/scenes/roadmap-scenes.js` (appended after `pro-upgrade.js` so demo indices stay stable).
- **Post:** highlight knee + interleaved gradient dither in `js/post.js`.
- **Three.js guest:** `vendor/three.min.js` + `js/nexus-three-guest.js` — `?three=1` or `localStorage nexus.three.guest=1`; canvas `#c-three` + `css/nexus.css`.
- **WebGPU diagnostics:** `js/nexus-webgpu-spike.js` (`?wgpu_probe=1`); main path remains `NX.WgslGraph`.
- **Docs:** `docs/NEXUS-PROJECTM-LGPL-EVALUATION.md`, `docs/PUBLIC-REPO-SYNC.md`; `THIRD_PARTY_NOTICES.md` (Three + Meyda note).

## 1.1.3 — 2026-04-10

- Removed **NEBULA FLYTHROUGH** WebGL scene from `js/scenes/environment.js` (17 shader scenes total).
- Reindexed `demo-director.js` scene jumps for indices ≥ 12.

## 1.1.2 — 2026-04-10

- Removed **NEON CITY** WebGL scene from `js/scenes/environment.js` (18 shader scenes total).
- Reindexed `demo-director.js` scene jumps for indices ≥ 11.

## 1.1.1 — 2026-04-10

- Removed **DEEP SEA** WebGL scene from `js/scenes/fluid.js` (19 shader scenes total).
- Reindexed `demo-director.js` scene jumps for the removed slot.

## 1.1.0 — 2026-04-10

- Added **third-party**, **privacy**, and **pro output** docs; root **`THIRD_PARTY_NOTICES.md`** and **`LICENSE`**.
- **`NX.BootstrapQuery`** + safer **`?demo=`** allowlist in `demo-director.js`.
- **Ship defaults** for cold start (no explicit `?seed=`) — showcase scene + stronger default mix.
- **Onboarding** wizard (`nx_onboard_done_v1`); **showfile** JSON export/import; **REC branding** (composite title + optional logo).
- **Vitest** + **Playwright** smoke under `NEXUS/package.json` (see `README.md`).
- **`AGENT-MESH.md`** — single-source-of-truth / merge checklist for nested repo workflow.
- **`engine.js`** — extracted `resetGlStateForCompositePass()`; composite REC calls `RecBrand` overlay.
