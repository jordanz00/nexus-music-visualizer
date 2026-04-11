# NEXUS module inventory vs deck / layer / cue metaphors

**Purpose:** gap analysis for “Resolume / Disguise-style” workflows without claiming feature parity.

## Core runtime

| Module | File(s) | Role | Deck / layer gap |
|--------|---------|------|------------------|
| Engine loop | `js/engine.js` | RAF, morph, uniforms, `HomageBridge` | No multi-deck; single `curS` scene |
| Scenes | `js/scenes.js` + `js/scenes/*.js` | GLSL registry, `NX.registerScene` | “Clip” = whole scene swap, not per-layer clip matrix |
| Post | `js/post.js` | Bloom, trails, glitch, kaleido on main FBO | Global post, not per-layer sends (see `busSend` future) |
| Audio | `js/audio.js`, `js/nexus-engine/audio-engine.js` | FFT, BPM, worklet RMS/crest | OK for procedural bus |
| MIDI | `js/midi.js`, `js/nexus-engine/midi-manager.js` | Note→scene, CC params | CC scene index exists; no per-cue MIDI map file for PRESET_PACK IDs alone |

## Hybrid visual stack

| Module | File | Role | Gap |
|--------|------|------|-----|
| SceneManager | `js/nexus-engine/scene-manager.js` | `visualMode` shader / hybrid / BC | Not a layer matrix |
| HybridLayers | `js/nexus-engine/hybrid-layer-registry.js` | Ordered stack metadata + JSON defaults | UI does not yet edit stack JSON |
| Butterchurn | `js/nexus-engine/butterchurn-scene.js` + vendor | MilkDrop-class | Single BC canvas |
| Shader scene | `js/nexus-engine/shader-scene.js` | `#c` program | — |
| WGSL graph | `js/nexus-engine/wgsl-graph.js` | `#nx-wgpu` overlay chain | Optional compute / particles staged behind probe |
| Three guest | `js/nexus-three-guest.js` | `?three=1` demo mesh | MAZE mode uses `nexus-maze-three.js` when scene `MAZE*` |
| Clips | `js/show/clip-layers.js` | Under/over video slots | No timecode-stamped clip lanes yet (see CLIP-LANE-MVP) |

## Show / touring helpers

| Module | File | Role | Gap |
|--------|------|------|-----|
| Show clock / LTC | `js/show/show-clock.js`, `ltc-*.js` | Wall clock, LTC decode | — |
| Cue engine | `js/show/cue-engine.js` | Time + beat triggers | Phrase boundaries vs `bpmConfidence`: optional hint in `NX.CueEngine.getBpmConfidenceHint()` |
| Show workbench | `js/show/show-workbench.js` | Operator panel | — |
| Composition UI | `js/show/composition-ui.js` | Layout helpers | — |

## Generative / import paths (planned / partial)

| Module | File | Role |
|--------|------|------|
| ISF subset | `js/nexus-engine/nexus-isf-loader.js` | Parse ISF JSON `INPUTS` → uniform map (no arbitrary includes) |
| Cables-inspired | `js/nexus-engine/nexus-cables-lite.js` | Whitelist ops → mix/blur uniforms for shader templates |
| Homage DOM | `js/nexus-engine/nexus-homage-dom-overlays.js` | CYBR boot HUD, YNI type, T00 log + ASCII toggle (safe DOM) |

## Recording

| Area | File | Notes |
|------|------|-------|
| WebM capture | `engine.js` / host | Composites BC + `#c` + clips per build; verify Three/WGPU inclusion on desktop |

**Summary gap:** true **deck** = N independent clip lanes × M layers; NEXUS today is **one primary shader scene** + **optional BC** + **clip stacks** + **cues**. Closing the gap is incremental (layer JSON UI, per-layer post taps, timecode ruler on clips).
