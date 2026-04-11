# Hybrid layer composite + REC path (internal spec)

This document matches `NX.HybridLayers.getOrderedStack()` in `js/nexus-engine/hybrid-layer-registry.js` and the DOM order in `index.html`.

## Bottom → top (on-screen)

1. **`#c-bc`** — Butterchurn / Aurora (opacity `S.hybridBcOpacity`, SceneManager `visualMode`).
2. **`#nx-ambient`** — OKLCH ambient wash (`ModernVisualStack`).
3. **`#c`** — Main WebGL fragment scenes (opacity `S.hybridShaderOpacity`).
4. **`#nx-proc-particles`** — 2D procedural bursts (`ProcParticles`).
5. **`#c-three`** — Three.js guest / maze layer (separate context; alpha composite).
6. **`#nx-wgpu`** — WebGPU WGSL overlay (`WgslGraph` when enabled).
7. **`#nx-clip-under`** / **`#nx-clip-over`** — HTML5 video/image (`ClipLayers`; blend via `mixBlendMode` + opacity).

**Post chain** (`post.js` / `NX.post`) runs on the **main `#c` FBO output** (and global grade), not inside each DOM layer. Homage DOM overlays (`#nx-homage-root`) sit in the **UI layer** (fixed, pointer-events as needed) and are **not** sampled into WebGL unless explicitly copied later.

## Per-layer JSON (showfile / future SceneManager)

See `NX.HybridLayers.defaultLayerState()` — fields:

- `id` — layer key (`ambient`, `butterchurn`, …).
- `opacity` — 0..1.
- `blendMode` — subset: `normal` | `screen` | `multiply` | `soft-light` | `plus-lighter` (maps to CSS `mix-blend-mode` for clips; shader stack uses engine uniforms).
- `solo` — boolean; when true, other layers forced to 0 (future deck UI).
- `bypass` — boolean; skip layer tick + composite weight 0.
- `audioDrive` — optional string key: `none` | `rms` | `bass` | `beat` (feeds preset param bus).
- `busSend` — `prePost` | `main` (where layer taps the post chain; today `main` only).

## REC composite

Recording (`engine.js` / capture path) composites, in order:

- Optional REC ambient gradient (checkbox).
- Butterchurn canvas (if visible).
- Main `#c` bitmap (post-processed frame).
- `ClipLayers.drawForRecording` for under, then over stacks.
- Three / WebGPU layers are included only if the capture pipeline draws those canvases into the same 2D context (verify per build; iOS may omit heavy layers when `VIZ PERF` caps).

**Invariant:** clip decode failures must not stop the animation loop (`ClipLayers` isolates per slot).

## Cue engine (Show tab)

`NX.CueEngine.tick(dt)` runs from `engine.js` each frame so timecode and beat triggers fire while the Show panel is closed. Beat alignment hints: `NX.CueEngine.getBpmConfidenceHint()` (uses `S.bpmConfidence`).
