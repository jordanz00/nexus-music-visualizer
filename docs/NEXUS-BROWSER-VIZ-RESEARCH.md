# Browser visualization research — OSS, WebGPU arc, demoscene lessons (NEXUS)

**Purpose:** In-repo capture of **external references** that inform NEXUS direction. Nothing here is shipped as a runtime dependency unless listed in `THIRD_PARTY_NOTICES.md` and `vendor/`.

## Track 1 — In-browser visuals (~2015–2025)

- **Arc:** WebGL 1/2 carried serious browser 3D and VJ-style stacks through the late 2010s (Three.js, custom GLSL, shadertoy-style fragments). WebGPU is the forward path for **compute-heavy** passes (particles, post, audio-driven buffers) where the browser exposes it.
- **Hydra** (live-coded modular 2D/video): [hydra-synth/hydra](https://github.com/hydra-synth/hydra) · [hydra.ojack.xyz](https://hydra.ojack.xyz/) · [hydra-synth engine (npm)](https://www.npmjs.com/package/hydra-synth)
- **cables.gl** (node graph, WebGL): [cables.gl](https://cables.gl/) · [GitHub cables-gl](https://github.com/cables-gl) · [Realtime audio visualization docs](https://cables.gl/docs/8_audio/2_realtime_visualization/realtime_visualization)
- **PlayCanvas** (engine WebGL + WebGPU + WebXR): [playcanvas/engine](https://github.com/playcanvas/engine)
- **WebGPU showcase (e.g. particles):** [Tendrils — webgpu.com showcase](https://www.webgpu.com/showcase/tendrils-emergent-webgl-particle-visuals/)
- **Historical WebGL Milkdrop-class experiment:** [gattis/milkshake](https://github.com/gattis/milkshake) — stale stack; cultural reference only. **NEXUS** uses **Butterchurn** (see notices).

## Track 2 — Audio-reactive 3D / music graphics (OSS examples)

- **React Three Fiber + analyser:** [dcyoung/r3f-audio-visualizer](https://github.com/dcyoung/r3f-audio-visualizer)
- **Three + Web Audio + particles:** [kuhung/audiovisualizer](https://github.com/kuhung/audiovisualizer) · [LoanDeveloper/music-visualisation-3d](https://github.com/LoanDeveloper/music-visualisation-3d) · [Percobain/3d-audio-visualizer](https://github.com/Percobain/3d-audio-visualizer)
- **MilkDrop-class (AGPL):** [Louis-Mascari/MangoWave](https://github.com/Louis-Mascari/MangoWave) — **not** bundled; license differs from NEXUS stack.
- **WebGPU + audio (Three.js official example):** [webgpu_compute_audio](https://threejs.org/examples/webgpu_compute_audio.html) · [PR rename context](https://github.com/mrdoob/three.js/pull/26845)

**Product takeaway:** Most OSS “big” 3D reactivity is **FFT → uniforms / instance attributes + post**. Tighter musical feel needs **onset / phase / BPM confidence** on top of bands — see `nexus-audio-procedural-bus.js` and engine audio.

## Track 3 — Shipable OSS shortlist (governance)

| Stack | Role | NEXUS relation |
|-------|------|----------------|
| Hydra | Live coding, collab culture | Inspiration; optional future embed needs **license + bundle** review |
| cables.gl | TD-like node graph in browser | Inspiration only — `nexus-cables-lite.js` whitelist ops |
| Butterchurn / Milkdrop presets | Preset mass | **Shipped** (MIT) — vendor dir |
| Three + WebGPU | Dense fields | Optional `three.js` + `WgslGraph` / probes |
| PlayCanvas | Full engine | **Optional guest** in NEXUS: `?playcanvas=1` loads `vendor/playcanvas.min.js` + `nexus-playcanvas-guest.js` on `#c-playcanvas` |

Prefer **canonical** [hydra-synth/hydra](https://github.com/hydra-synth/hydra) over unvetted forks when evaluating embeds.

## Track 4 — Bad Apple (Sega Mega Drive / Genesis)

- **Idea:** Full-motion style playback on **tight ROM / VDP** budgets — custom codec, streaming, low bpp / grayscale tradeoffs — not “AAA 3D engine.”
- **Secondary sources:** [MegaBites — Bad Apple](https://megabitesblog.wordpress.com/2014/04/25/bad-apple/) · [AtariAge thread](https://forums.atariage.com/topic/205813-badapple-demo-for-sega-megadrive) · [YouTube reference](https://www.youtube.com/watch?v=2vPe452cegU)

**Lessons for NEXUS:** **REC / streaming** readability at low bitrate; **minimal color** lanes; **decode isolation** (already a goal for clips).

## Track 5 — Underpowered hardware & demoscene

- **Bad Apple C64 (2014):** [C64.CH](https://c64.ch/productions/7785/Bad_Apple_64) · [pouët](https://www.pouet.net/prod.php?which=63649) · [CSDb](https://csdb.dk/release/?id=131628)
- **Experiment:** [cnlohr/badderapple](https://github.com/cnlohr/badderapple) — verify scope before commercial claims.
- **4k classics:** [Shapeshifter — Chrome](https://m.pouet.net/prod.php?which=2066) · [Animate — Schwartz](https://www.pouet.net/prod.php?which=2859) · [Heaven — NoooN](https://www.pouet.net/prod.php?which=1105)

**Audio link:** Demoscene sync is often **deterministic player clock + envelopes**; browser VJ adds **mic/FFT** as an optional layer — NEXUS combines both via `NX.S` (bands + BPM + worklet RMS/crest).

## Cross-track — NEXUS alignment

1. **WebGPU compute + post + instancing + mobile fallback** — `wgsl-graph.js`, `getComputeParticleStage`, `VIZ PERF`, iOS paths in `engine.js`.
2. **OSS gravity** — Butterchurn shipped; Hydra/cables/PlayCanvas documented here, not implied as bundled.
3. **Bad Apple class** — inspiration for **low-bitrate / high-readability** output, not a substitute for generative 3D.
4. **Pro audio feel** — bands + phase + BPM confidence + crest — see `ProceduralAudioBus` and `HomageBridge`.

_Last updated: NEXUS repo maintenance pass._
