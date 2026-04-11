# Changelog — NEXUS Engine Pro

All notable changes are documented in this file. Version chip in the app (`nexus-version.js`) should match the latest release entry.

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
