# NEXUS volumetric particle product (`nx-volumetric`)

**Default:** `S.nexusVolumetricProductEnabled` is **false** — the familiar `GpuParticles.renderOverlay()` path runs (same shaders as always). Legacy overlay must **not** be skipped unless this flag is on *and* `NX.VolumetricFX` is ready (otherwise you only see the optional 2D mist layer).

**Optional integrated path:** GPU sim still lives in `nexus-gpu-particles.js`. `NX.VolumetricFX` draws **the same NDC sprite formula** as `VS_DRAW` / `FS_DRAW` in that file (parallax, palette, soft disk, additive overlap) into an offscreen buffer, then composites **after** `NX.post` and **after** Butterchurn — same stack order as the legacy overlay. Point size is scaled for the smaller FBO vs `#c` width and clamped to `ALIASED_POINT_SIZE_RANGE` so sprites stay distinct instead of one clamped mega-disk.

World-space perspective ribbons were removed here (they read as a smeared “blob” vs the classic field).

## Render order (per frame)

1. Shader scene → `finalTex` (FBO, no scene depth buffer).
2. `NX.VolumetricFX.setSourceSceneTexture(finalTex)` then `tick(dt)` — builds a **half-res proxy depth** texture from scene **luma**, **screen-space derivatives** (`fwidth`), and **frame delta** vs a copied history of the previous frame’s scene color. This is **not** geometric depth.
3. `NX.post.render` — bloom / grade / trails → default framebuffer.
4. Butterchurn / hybrid Aurora canvas (`#c-bc`) if active.
5. If volumetric pipeline is ready and `S.nexusVolumetricProductEnabled !== false`: `compositeToScreen` (draws particles into the particle FBO, then blits additive). Otherwise `GpuParticles.renderOverlay()` draws the legacy full-screen sprite pass.

## Proxy depth (limitations)

- **Artistic only** — heuristic on HDR scene color, not ray-traced occlusion. Expect possible **shimmer** or **swimming** on fast motion; tune weights via preset (`proxyDepth` in `preset-resolve.js` / JSON packs).
- Requires **`OES_standard_derivatives`** for the proxy fragment shader (`fwidth`). If the extension is missing, init may fail and the app falls back to the legacy overlay.

## Authoring

- **Runtime merge**: `NX.VolumetricPresetResolve.resolve(S)` — bundled defaults in `preset-resolve.js` mirror `NEXUS/data/particle-presets/*.json` for documentation; extend `BUNDLED` or add fetch-based loading later.
- **Mix UI**: `S.nexusParticleLook`, `S.nexusParticleMatchGenre`, `S.nexusVolAdvancedFX`, `S.nexusVolumetricProductEnabled` (see `index.html` + `show/fx-chain.js`).

## Recording & iOS

- **Recording** samples the main WebGL canvas (`#c`) after the volumetric composite in `engine.js` — particles are included when the integrated path runs.
- **iOS**: `S._iosInstantSceneChange` avoids morph FBO pressure; volumetric **advanced** screen pass (glow) is skipped on coarse pointer / iOS profile. `tick` / `composite` also bail when `S.nexusPerfLock` or `S.nexusVizPerformance` is set (matches legacy GPU overlay gating).

## Context loss

`webglcontextlost` tears down both `GpuParticles` and `VolumetricFX`; restore path re-inits GPU particles then `VolumetricFX.ensureInit()` after `NX.resize()`.
