# NEXUS parallel agent mesh (merge discipline)

## Purpose

Coordinate risky changes across **renderer**, **WebGPU/WGSL**, **post/composite**, **audio→GPU**, **perf/mobile**, and **interop** without single-agent blind spots.

## Lanes (each change files)

- **Scope:** files + user-visible behaviour  
- **Safari/iOS risk:** instant cuts, memory, WebGPU absence  
- **Fallback:** what still works when the feature is off  

### Lane → typical files

| Lane | Owns |
|------|------|
| **Renderer** | `engine.js`, `scenes/*`, `NX.showName` / pads |
| **WebGPU** | `wgsl-graph.js`, `#nx-wgpu` |
| **Post** | `post.js`, `S.postChain` |
| **Audio→GPU** | `audio.js`, `audio-engine.js`, `bc-morph-conductor.js` |
| **Perf/mobile** | adaptive FPS, `S._iosInstantSceneChange`, quality presets |
| **Interop** | `midi.js`, `clip-layers.js`, `show-workbench.js`, recording |

## P0 merge gates

1. Main `requestAnimationFrame` loop never dies on guarded errors.  
2. WebGL context loss / WGSL throw: degrade without permanent black frame.  
3. iOS: no new morph storms on coarse pointer unless explicitly tested.  
4. No unsafe DOM with user/import strings.  

## P1 before release

Soak spot (see `SOAK-GATES.md`), transition matrix (pads + MIDI + clips + REC), session seed still drives `NX.randomUnit` after change.
