# NEXUS parallel agent mesh (merge discipline)

## Single source of truth (repos)

- **NEXUS product code** lives in this **nested git repository** (`NEXUS/.git` → typically `github.com/jordanz00/nexus-music-visualizer`). **Commit and push only from `cd NEXUS`**, not from a parent monorepo that lists `NEXUS/` as untracked.
- The parent **HAP 340B** workspace may contain a copy of this folder for convenience; it must **not** be treated as a second source of truth. If you open Cursor at the monorepo root, still run `git status` inside `NEXUS/` before shipping.
- **Cursor rules** for assistants live in the **parent** `.cursor/rules/` (`nexus-ai-collaboration.mdc`, `nexus-professional-tests.mdc`) with globs pointing at `NEXUS/**`.

## Hot files (expect merge conflicts if two agents touch blindly)

| File | Risk |
|------|------|
| `js/engine.js` | rAF loop, FBOs, recording composite |
| `index.html` | Script order, splash, System panel markup |
| `js/post.js` | Post chain, uniforms |
| `js/audio.js` | Analyser, BPM, beat visual |
| `js/nexus-engine/engine-host.js` | Hybrid init order |
| `js/ui.js` | Recording, splash, System controls |

**Before you push:** `git pull`, `npm test` + `npm run test:e2e` inside `NEXUS/` (when present), manual hybrid + Present + 5s REC from `docs/QA-MATRIX.md`.

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
