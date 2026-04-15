# Particula-derived MIX particle layer (NEXUS)

## Upstream

- **Repository:** [github.com/Humprt/particula](https://github.com/Humprt/particula) (MIT).
- **Pinned reference commit (`main` at port time):** `9c05c6664dd318eeeefd14457fa15862c72ae8c3` (2025-04-13).

Upstream ships a standalone ESM demo (CDN imports, own `AudioContext`, aggressive DOM cleanup). The NEXUS integration is an **embed-only port**: no runtime CDN, no second audio graph for the overlay, no `document.body` canvas takeover.

## What we ship

| Path | Role |
|------|------|
| `vendor/particula/three.module.r136.js` | Three.js **r136** ESM (matches upstream API expectations). |
| `vendor/particula/dat.gui.module.js` | dat.GUI ESM build for local parameter panels. |
| `js/particula/nexus-entry.mjs` | Boot: scene, renderer → `#nx-particula-host`, GUI → `#nx-particula-gui-host`, `NX.GpuParticles.renderOverlay`, `NX.particles`. |
| `js/particula/nexus-spheres-factory.mjs` | Five-sphere factory + per-sphere folders (from upstream `createSphereVisualization`). |
| `js/particula/nexus-spheres-core.mjs` | `tickSpheres`, reinit / color helpers. |
| `js/particula/nexus-audio.mjs` | `getAudioData` / spectrum synthesis from **`NX.S`**. |
| `js/particula/noise-beat.mjs` | Perlin noise + beat wave manager. |
| `js/particula/data/particula_presets.json` | Upstream preset bundle (local `fetch` + `localStorage` merge in `nexus-entry.mjs`). |

## Behaviour vs upstream

- **Audio:** NEXUS analysis on `NX.S` drives synthetic byte-frequency data; Particula’s file/mic/timeline UI is **not** ported.
- **Frame loop:** Simulation + `renderer.render` run inside `NX.GpuParticles.renderOverlay` (engine `rAF` tail), not a standalone `requestAnimationFrame`.
- **DOM:** Renderer mounts under `#nx-particula-host`; dat.GUI under `#nx-particula-gui-host`; preset strip under `#nx-particula-preset-host`. No `cleanupPreviousElements()`-style nuking.
- **Opacity:** `NX.SceneManager` applies MIX opacity to `#nx-particula-host` (same contract as the former `#c-particles` canvas).

## Upgrades

Bump Three for this overlay **deliberately** (r136 → newer) only after reviewing `nexus-spheres-factory.mjs` / Three API deltas. Guest `vendor/three.min.js` remains independent.

## Naming

Per upstream README practice: **credit Particula’s authors**; do not market NEXUS Engine as “Particula.”
