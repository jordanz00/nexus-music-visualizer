# NEXUS volumetric particle product (`nx-volumetric`)

**Default:** `S.nexusVolumetricProductEnabled` is **false** — screen GPU particles are **`NX.particles`** (`js/scenes/particles-gpu.js`), invoked from the same `GpuParticles.renderOverlay()` call site in `engine.js` (stub + chained hook). The integrated volumetric path must **not** be skipped unless this flag is on *and* `NX.VolumetricFX` is ready (otherwise you only see the optional 2D mist layer).

**Optional integrated path:** `NX.VolumetricFX` composites NDC-style sprites when `NX.GpuParticles.getSimReadState()` returns a live sim (today the legacy sim file is removed — `nexus-gpu-particles-stub.js` keeps APIs inert until a replacement sim feeds textures). Shaders in this folder keep the parallax + palette + soft disk formula; point size is scaled for the smaller FBO vs `#c` width and clamped to `ALIASED_POINT_SIZE_RANGE`.

World-space perspective ribbons were removed here (they read as a smeared “blob” vs the classic field).

## Render order (per frame)

1. Shader scene → `finalTex` (FBO, no scene depth buffer).
2. `NX.VolumetricFX.setSourceSceneTexture(finalTex)` then `tick(dt)` — builds a **half-res proxy depth** texture from scene **luma**, **screen-space derivatives** (`fwidth`), and **frame delta** vs a copied history of the previous frame’s scene color. This is **not** geometric depth.
3. `NX.post.render` — bloom / grade / trails → default framebuffer.
4. Butterchurn / hybrid Aurora canvas (`#c-bc`) if active.
5. If volumetric pipeline is ready and `S.nexusVolumetricProductEnabled !== false`: `compositeToScreen` (draws particles into the particle FBO, then blits additive). Otherwise `GpuParticles.renderOverlay()` runs the stub (no legacy draw) and **`NX.particles`** draws the screen GPU particle pass.

## Proxy depth (limitations)

- **Artistic only** — heuristic on HDR scene color, not ray-traced occlusion. Expect possible **shimmer** or **swimming** on fast motion; tune weights via preset (`proxyDepth` in `preset-resolve.js` / JSON packs).
- Requires **`OES_standard_derivatives`** for the proxy fragment shader (`fwidth`). If the extension is missing, integrated init may fail; screen particles still use `NX.particles` when enabled.

## Authoring

- **Runtime merge**: `NX.VolumetricPresetResolve.resolve(S)` — bundled defaults in `preset-resolve.js` mirror `NEXUS/data/particle-presets/*.json` for documentation; extend `BUNDLED` or add fetch-based loading later.
- **Mix UI**: `S.nexusParticleLook`, `S.nexusParticleMatchGenre`, `S.nexusVolAdvancedFX`, `S.nexusVolumetricProductEnabled` (see `index.html` + `show/fx-chain.js`).

## Recording & iOS

- **Recording** samples the main WebGL canvas (`#c`) after the volumetric composite in `engine.js` — particles are included when the integrated path runs.
- **iOS**: `S._iosInstantSceneChange` avoids morph FBO pressure; volumetric **advanced** screen pass (glow) is skipped on coarse pointer / iOS profile. `tick` / `composite` also bail when `S.nexusPerfLock` or `S.nexusVizPerformance` is set (matches GPU particle gating).

## Context loss

`webglcontextlost` tears down `VolumetricFX`; restore path calls `VolumetricFX.ensureInit()` after `NX.resize()`. `NX.particles` re-inits on its own schedule when the canvas context is valid.
