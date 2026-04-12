# NEXUS Engine — Pro (DJ / VJ)

**Production-style live VJ stack:** [Butterchurn](https://github.com/jberg/butterchurn) (MilkDrop) with the **full vendored `butterchurn-presets` library** (hundreds of presets) **plus** 12 custom raymarched WebGL scenes, shared audio analysis (bass / **low-mid** / mid / high), MIDI map overlay, graded post (bloom, trails, **hue**), and recording at **native / 1080p / Stream 1080p / 4K** with **30–60 FPS**. No build step.

**Anti-flash tuning:** a smoothed **`beatVisual`** channel drives shaders and post (attack ~90ms, release ~400ms) so kicks and bloom no longer strobe as hard as raw beat spikes.

**Showcase 20:** curated display names map to the **closest real presets** in the loaded pack (keyword scoring — no fabricated MilkDrop JSON).

**Pro 60 hybrid library:** showcase × **Apex / Flux / Nova** variants — real Butterchurn key + procedural engine params; each row tagged **Trance / Techno / Ambient / EDM / Glitch** for the genre filter. **DJ style** macro (Output panel): one-click **Trance, Techno, Ambient, EDM, Glitch** — sets speed, react, warp, morph, trails, bloom, and stack mode.

**User presets** (Save / Preset dropdown) now also store **hue, bloom, trails, visual mode** (shader / Butterchurn / hybrid) for full recall.

**Pro PWA polish (this tree):** `session-seed.js` + `NX.randomUnit()` (session DNA for shaders/camera), **Mix** Aurora **Conductor** slider, WGSL **rack presets** + per-node **bypass**, seeded default WGSL chain when none saved, scene **search/list/grid**, **MIDI profiles** (`nx_midi_profiles`), **`?soak=1`** long-run console markers, **Export debug** JSON (System tab), docs under `NEXUS/docs/` (`AGENT-MESH`, `SOAK-*`, `SCENE-AUTHORING`).

> **Live:** [jordanz00.github.io/nexus-music-visualizer](https://jordanz00.github.io/nexus-music-visualizer)  
> **Marketing / demos:** [landing.html](landing.html) (open locally or host alongside `index.html`)

---

## Features

| Category | Details |
|----------|---------|
| **Visual modes** | **Shader** (WebGL1 scenes only), **Butterchurn** (MilkDrop on `#c-bc`), **Hybrid** (Butterchurn base + WebGL with `mix-blend-mode: plus-lighter`) |
| **Butterchurn** | `butterchurnPresets.min.js` ships the **official** npm pack: presets live behind **`getPresets()`** on the bundle’s default export (not a plain object — the catalog reads that map so **every** preset is addressable). Optional: run `vendor/fetch-extra-presets.sh` and add `<script src="vendor/butterchurnPresetsExtra.min.js">` (and siblings) before `preset-library` to merge **Extra / Extra2 / MD1 / NonMinimal** into one library. **Auto morph** + full dropdown + RND BC use the merged key list. Mic required for BC. |
| **Nexus modules** | `js/nexus-engine/` — `AudioEngine`, `VisualEngineManager`, `SceneManager`, `PresetLibrary`, `bc-morph-conductor.js`, `pro-presets.js` (Pro 60 + `applyVisualStyle`), `NexusEngine` host (`3.1.0-pro`, `init` / `update` / `renderButterchurnLayer`) |
| **Scenes** | 12 real-time raymarched 3D scenes (fractals, volumetrics, particles, tunnels, geometry, environments) |
| **Audio** | FFT frequency bands, spectral flux, spectral centroid, beat detection, BPM tracking |
| **Post-processing** | Tinted knee bloom (toggle + MIDI **bloom** multiplier), anamorphic streak, trails / afterimage, sharpen, ACES, subtle beat lift (smoothed) |
| **Camera** | 5 cinematic modes — orbit, dolly, crane, handheld, snap (beat-triggered angle jumps) |
| **MIDI** | WebMIDI + learn mode; extended CC targets: **bloom**, **colorShift** (reserved), **bcNext** (random Butterchurn preset), **visualMode** (shader / BC / hybrid) |
| **Recording** | MediaRecorder WebM (VP9→VP8 fallback); profiles include **Stream 1080p** (~22 Mbps) for cleaner OBS re-encode |
| **Presets** | Save/load engine + post + stack to localStorage; 4 built-in starting points (Afterlife Dark, Festival Energy, Ambient Chill, Laser Show) |
| **UI** | Resolume-inspired dark pro theme with scene pads, audio meters, control sliders, palette selector |
| **Performance** | 3 GPU quality presets, adaptive FPS; **Perf lock** caps DPR and internal resolution; `prefers-reduced-motion` support |
| **Demo Director** | Pre-choreographed sequences for recording clips — top bar **DEMO** menu or URL `?demo=drop` / `festival` / `genres` / `ai` / `resolume` / **`asura_show`** (ramps **Asura** post + optional **Cables guest** iframe) |
| **Asura post (native)** | Mix tab **Asura** slider + built-in preset / Show macro — URL `?asura=1` (floor ~0.78) or `?asura=0.65` sets `postFxAsura` at boot ([`post.js`](js/post.js) barrel + radial chroma + scanlines + vignette). |
| **Cables guest (iframe)** | Mix tab **Cables guest** / **Cables mix** / **Patch** — loads a **real** hosted cables.gl patch (default [MFX Asura](https://mfx.drastic.net/view/asura/)) in `#nx-cables-guest-frame`. **HTTPS + allowlisted host only** (`mfx.drastic.net`, `cables.gl`, `sandbox.cables.gl`). Boot: `?cables=1`, `?cables=asura`, `?cablesUrl=` (encoded URL), or `?cables=0` to force off. See [`js/nexus-cables-guest.js`](js/nexus-cables-guest.js). |
| **Show scene presets** | I/O workbench bundles also snapshot **`postFxAsura`**, **`nexusGodRayMix`** (via `fxBatch2`), and **cables guest** `{ enabled, opacity, url }` for full recall ([`js/show/scene-presets.js`](js/show/scene-presets.js)). |
| **AI Director** | Energy + drop detection for automatic scene switches — **AI DIR** (turns off auto-morph while active) |
| **Free / Pro** | Free tier: corner watermark. **More → Unlock Pro** (or console): `NX.watermark.unlock('NEXUS_MK4_PRO')` or `earlyaccess2026` → stored in `localStorage` on this device |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space / →** | Next scene |
| **←** | Previous scene |
| **1–9, 0** | Jump to scene 1–10 |
| **R** | Random scene |
| **A** | Toggle auto-morph |
| **X** | Explode / beat trigger |
| **M** | Toggle mic input |
| **P** | Present mode (hide UI) |
| **F** | Fullscreen |
| **H** | Hide/show bottom panel |
| **`** (backtick) | Toggle FPS overlay |

---

## Scene Roster (12)

### Cosmic
HYPERSPACE · BLACK HOLE · MANDELBULB · CHROME PLANET · GALAXY CORE

### Energy
VORTEX ENGINE · PLASMA SPHERE · ALIEN MONOLITH

### Fluid
INK & OIL · LIQUID METAL

### Environment
NEON GRID

### Afterlife
VOID CATHEDRAL · SACRED GEOMETRY · NEURAL SWARM · DARK MONOLITH · LASER CATHEDRAL · AFTERLIFE RINGS

### Unique / feedback + roadmap add-ons
TUNNEL GRID · **SPECTRAL HELIX** · **PRISM ORBIT** (`js/scenes/roadmap-scenes.js`; **WM** / **WC** tie to optional AudioWorklet meter)

---

## MIDI Setup

1. Connect a MIDI controller (Launchpad, APC Mini, any CC-capable device)
2. Open NEXUS MARK IV in **Chrome** (WebMIDI requires Chrome or Edge)
3. The controller auto-detects — check the MIDI status indicator in the input panel
4. **Learn mode:** Click "MIDI Learn" in the input panel, then move a knob/fader on your controller to map it
5. **Scene triggers:** MIDI note-on messages trigger scenes by note number (note 0 = scene 1, etc.)
6. **CC mapping:** Any CC channel maps to engine parameters (speed, react, warp, gain, morph, palette)
7. Mappings persist in localStorage across sessions

### Launchpad / APC Mini Quick Map
- Bottom row pads → scene 1–8
- Top faders/knobs → speed, react, warp, gain

---

## OBS / Streaming Guide

1. Open NEXUS MARK IV and click LAUNCH
2. Enter **Present mode** (press P) — this hides all UI, leaving only the canvas
3. In OBS, add a **Window Capture** source → select the NEXUS browser window
4. **Auto-present URL:** Add `?obs=1` to the URL to auto-enter present mode and skip the splash:
   ```
   https://jordanz00.github.io/nexus-music-visualizer/?obs=1
   ```
5. For transparent background compositing, use OBS color-key on the black background

### Developer URL flags (optional)

| Query | Effect |
|-------|--------|
| `?noworklet=1` | Skip AudioWorklet meter (AnalyserNode-only path). |
| `?three=1` | Load `vendor/three.min.js` and enable the `#c-three` guest layer (second WebGL context; ~670 KB). |
| `?playcanvas=1` | Load `vendor/playcanvas.min.js` and enable the `#c-playcanvas` PlayCanvas guest layer (third WebGL context; ~2.1 MB). |
| `?wgpu_probe=1` | Log `NX.WebGpuSpike.probe()` to the console (WebGPU / WgslGraph status). |

### Audio Routing for OBS
- Use **VoiceMeeter** or **BlackHole** (macOS) to route system audio to a virtual mic device
- In NEXUS, click the IN button and select the virtual mic as input
- This makes the visualizer react to your DJ set / music player output

---

## Recording

1. Click the **REC** button in the top bar (or trigger via MIDI)
2. The button pulses red while recording
3. Click REC again to stop — the WebM file downloads automatically
4. Quality: 1080p30 at 8 Mbps VP9 (adjusts to your canvas resolution)

---

## Presets

### Built-in
| Preset | Style | Speed | React | Warp |
|--------|-------|-------|-------|------|
| **Afterlife Dark** | Dark cinematic | 3 | 8 | 6 |
| **Festival Energy** | High energy | 7 | 9 | 7 |
| **Ambient Chill** | Slow, relaxed | 2 | 4 | 3 |
| **Laser Show** | Aggressive, fast | 8 | 10 | 8 |

### Custom Presets
- Click **Save** next to the preset dropdown to save your current settings
- Presets store: speed, reactivity, warp, morph time, palette, gain, smooth, quality, scene, **hue shift, bloom multiplier, bloom on/off, trails, visual stack mode**
- Stored in localStorage — clear browser data to reset

---

## Documentation & ship bar

| Doc | Purpose |
|-----|---------|
| [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md) | Vision, user journeys, phased roadmap |
| [`docs/SHIP-CRITERIA.md`](docs/SHIP-CRITERIA.md) | What “shipped” means (browsers, FPS, OBS, Pro/Free) |
| [`docs/QA-MATRIX.md`](docs/QA-MATRIX.md) | Manual QA matrix + recording checks |
| [`docs/VISUAL-TECH-ROADMAP.md`](docs/VISUAL-TECH-ROADMAP.md) | WebGL / WebGPU technology directions |
| [`docs/AI-COLLABORATION.md`](docs/AI-COLLABORATION.md) | How to pair-program this codebase with AI assistants |

**Automated smoke** (from parent folder that contains `NEXUS/`):

```bash
python3 NEXUS/scripts/nexus_smoke.py
```

**In-app:** **More** tab → **Nexus Pro — operator guide** (OBS, seed, FPS, MIDI) and **Unlock Pro** (watermark removal on this device).

---

## Architecture

```
NEXUS/
  index.html              ← App shell (Resolume-style layout)
  css/
    nexus.css             ← Dark pro theme + component styles
  js/
    engine.js             ← WebGL context, FBO pipeline, render loop
    audio.js              ← Mic, analyser, spectral flux/centroid, beat detection
    scenes.js             ← Shared GLSL HEAD, scene registry, compilation
    camera.js             ← 5-mode cinematic camera system
    post.js               ← Bloom, streak, grading, ACES output
    ui.js                 ← Scene pads, sliders, meters, present mode, recording
    midi.js               ← WebMIDI learn mode + CC mapping
    presets.js            ← Save/load to localStorage (full DJ state)
    nexus-engine/
      pro-presets.js      ← Pro 60 hybrids + genre filter + DJ style macros
      preset-library.js   ← Butterchurn pack + showcase resolution
      engine-host.js      ← NexusEngine facade
    scenes/
      cosmic.js           ← Hyperspace, Black Hole, Mandelbulb, Chrome Planet, Galaxy Core
      energy.js           ← Vortex Engine, Plasma Sphere, Alien Monolith
      fluid.js            ← Ink & Oil, Liquid Metal, Deep Sea
      environment.js      ← Neon City, Neon Grid, Nebula Flythrough
      afterlife.js        ← Void Cathedral, Sacred Geometry, Neural Swarm, Dark Monolith, Laser Cathedral, Afterlife Rings
  NEXUS_v3_Final.html     ← Legacy standalone (original monolith)
```

No bundler for the **app** runtime: plain `<script>` tags loaded in order. GitHub Pages serves it directly. **DevDependencies** (`vitest`, `@playwright/test`) exist only for `npm test` / `npm run test:e2e`.

**Legal / privacy:** [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), [`LICENSE`](LICENSE), [`docs/PRIVACY-DATA.md`](docs/PRIVACY-DATA.md), [`docs/PRO-OUTPUT-WORKFLOWS.md`](docs/PRO-OUTPUT-WORKFLOWS.md).

---

## Run Locally

```bash
cd NEXUS
python3 -m http.server 8888
# Open http://localhost:8888
```

### Automated tests (Vitest + Playwright)

From `NEXUS/` (uses `package.json` in this folder — separate from any parent dashboard repo):

```bash
npm install
npm test
npx playwright install chromium   # first run only
npm run test:e2e
```

Vitest covers **pure** URL/bootstrap helpers. Playwright runs a **smoke** path (splash → Launch → no `pageerror`). See `docs/PROFESSIONAL-TEST-OUTLINE.md`.

---

## AI-assisted development (Nexus Pro)

- **Playbook (pair-programming, edit/search discipline, strict MODE workflow):** [`docs/AI-COLLABORATION.md`](docs/AI-COLLABORATION.md) — use human-directed phases **`MODE: RESEARCH`**, **`MODE: INNOVATE`**, **`MODE: PLAN`**, **`MODE: EXECUTE`** so scope stays controlled; details and checklists are in that doc.

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge | Full (WebGL + WebMIDI + MediaRecorder) |
| Firefox | Visual + Audio (no WebMIDI, recording may vary) |
| Safari | Visual + Audio (no WebMIDI) |
| Mobile Chrome | Visual + Audio (touch supported, no MIDI) |

---

## License

See [`LICENSE`](LICENSE). Third-party bundles under `vendor/` keep their own licenses — [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
