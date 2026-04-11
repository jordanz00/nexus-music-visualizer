# projectM (LGPL) — evaluation gate for NEXUS

This document supports **Phase 4** of the OSS VFX roadmap: **do not ship** projectM WASM/native integration until legal and product review are complete.

## Why projectM

- [projectM](https://github.com/projectM-visualizer/projectm) is a mature **LGPL-2.1** reimplementation of the MilkDrop preset ecosystem.
- NEXUS already ships **Butterchurn** (MIT) for the same class of visuals; projectM is only justified for preset variety, platform-specific performance, or upstream maintenance reasons.

## Technical entry points

- Upstream **Emscripten** notes: `EMSCRIPTEN.md` in the projectM repository.
- Example web builds: [projectM-visualizer/examples-emscripten](https://github.com/projectM-visualizer/examples-emscripten).
- Browser constraints: WebGL2 / float textures per upstream docs; multithreading expectations differ from desktop.

## Legal / compliance checklist (human)

- [ ] LGPL **static linking / WASM** distribution model reviewed for your deployment (GitHub Pages, private host, commercial Pro tier).
- [ ] **Attribution** and **source offer** obligations mapped to how you ship `vendor/` bundles.
- [ ] **Patent / trademark**: “MilkDrop” naming remains historical reference; keep `THIRD_PARTY_NOTICES.md` and in-app Credits accurate.
- [ ] **Overlap with Butterchurn**: product decision on **one** primary MilkDrop-class engine vs dual stack (GPU budget, UX).

## Engineering checklist (before any merge)

- [ ] Feature-flagged mode (e.g. `?projectm=1`) **off** by default.
- [ ] `THIRD_PARTY_NOTICES.md` + Credits tab updated with LGPL notice and upstream link.
- [ ] `webglcontextlost` / perf paths unchanged for users who never enable projectM.
- [ ] No bundled WASM until artifacts are built in CI with reproducible steps (document command + version pins).

## Status

**Not integrated** — this file is the gate. When the above boxes are checked, open a dedicated PR that only adds projectM-related artifacts and wiring.
