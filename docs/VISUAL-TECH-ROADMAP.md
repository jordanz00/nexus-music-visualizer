# NEXUS — Visual technology roadmap

High-level browser directions for the NEXUS stack (WebGL fragment scenes + Aurora Field / Butterchurn + post). **NEXUS today targets WebGL 1** (`getContext('webgl')` in `js/engine.js`). This doc is planning guidance, not a commitment to ship every item in one release.

| # | Direction | One-line summary | Safari / iOS | Fit: WebGL1 now vs WebGPU later |
|---|-----------|------------------|--------------|----------------------------------|
| 1 | **WebGPU + WGSL** | Compute + render in one modern API; best long-term for particles and large buffers. | Lagging vs Chrome; test each milestone on Safari TP / release notes. | **Phase 2+** — would replace or parallel the current GL loop. |
| 2 | **WebGL2** (instancing, MRT, 3D textures) | Richer GPU features without WebGPU. | Broad on iOS/macOS Safari; still a migration from GL1 shaders. | **Migration cost** — rewrite programs, retest all `NX.registerScene` shaders. |
| 3 | **GPU flow / particles (ping-pong)** | Double FBO feedback for fluid, particles, streak fields. | Feasible if framebuffer floats + precision are validated per device. | **Extends** current `PV` feedback scenes (`feedUV`). |
| 4 | **SDF raymarching** | Signed-distance fields + lighting for “object in space” looks. | Same GL1 constraints as today; heavy loops need fps caps on mobile. | **Core** of many existing scenes; keep adding **signature** variants (e.g. `js/scenes/unique.js`). |
| 5 | **Spectral / audio texture** | FFT or band envelopes as `sampler2D` driving the fragment shader. | Already used via `AU`; document as first-class in new scenes. | **Now** — align new scenes with `HEAD` uniforms (`B`,`M`,`H`, etc.). |
| 6 | **Post chain** | Bloom, color grade, temporal trails — `js/post.js` and flags in engine state. | Watch banding and half-float support; degrade gracefully on low-end. | **Now** — tune presets; avoid duplicating Aurora’s role. |
| 7 | **Hybrid compositing** | Shader layer + Aurora Field blend modes. | Same as current product; performance = sum of both passes. | **Now** — primary differentiator; keep failure isolation (BC optional). |
| 8 | **OffscreenCanvas + worker** | Render in a worker to isolate jank from main-thread UI. | Supported in modern Safari with caveats; transferables and sizing are fiddly. | **Future** — large refactor; pair with quality presets. |
| 9 | **Procedural noise / FBM** | `fbm`, `vn`, domain warp — no art assets, infinite variety. | Safe on GL1; watch ALU cost on older phones. | **Now** — expand `js/scenes/*.js` patterns. |
| 10 | **Compute-style in fragment** | Reaction-diffusion-ish, curl-noise fields emulated without compute. | Fits GL1; use fewer iterations on iOS (`engine` already caps quality). | **Now** — good for “non-milkdrop” variety without WebGPU. |

## Practical order for this repo

1. Keep diversifying **WebGL1** scenes and post presets (low risk, immediate visual payoff).  
2. Document and test **Safari / iOS** on each new technique (float textures, loop counts, feedback stability).  
3. Treat **WebGPU** as a deliberate Phase 2 renderer, not a silent swap — dual maintenance until parity is proven.
