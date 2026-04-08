# NEXUS Engine — Pro (DJ / VJ)

**Production-style live VJ stack:** [Butterchurn](https://github.com/jberg/butterchurn) (MilkDrop) **plus** 20 custom raymarched WebGL scenes, shared audio analysis (bass / **low-mid** / mid / high), MIDI map overlay, graded post (bloom, trails, **hue**), and recording at **native / 1080p / Stream 1080p (high bitrate) / 4K** with **30–60 FPS**. Vendored Butterchurn + minimal preset pack ship in-repo; no build step.

**Anti-flash tuning:** a smoothed **`beatVisual`** channel drives shaders and post (attack ~90ms, release ~400ms) so kicks and bloom no longer strobe as hard as raw beat spikes.

**Showcase 20:** curated display names map to the **closest real presets** in the loaded pack (keyword scoring — no fabricated MilkDrop JSON).

**Pro 60 hybrid library:** showcase × **Apex / Flux / Nova** variants — real Butterchurn key + procedural engine params; each row tagged **Trance / Techno / Ambient / EDM / Glitch** for the genre filter. **DJ style** macro (Output panel): one-click **Trance, Techno, Ambient, EDM, Glitch** — sets speed, react, warp, morph, trails, bloom, and stack mode.

**User presets** (Save / Preset dropdown) now also store **hue, bloom, trails, visual mode** (shader / Butterchurn / hybrid) for full recall.

> **Live:** [jordanz00.github.io/nexus-music-visualizer](https://jordanz00.github.io/nexus-music-visualizer)  
> **Marketing / demos:** [landing.html](landing.html) (open locally or host alongside `index.html`)

---

## Features

| Category | Details |
|----------|---------|
| **Visual modes** | **Shader** (WebGL1 scenes only), **Butterchurn** (MilkDrop on `#c-bc`), **Hybrid** (Butterchurn base + WebGL with `mix-blend-mode: plus-lighter`) |
| **Butterchurn** | Local `vendor/butterchurn.min.js` + `butterchurnPresetsMinimal.min.js`; preset browser by category; `loadPreset(preset, blendSeconds)`; requires **mic / audio context** |
| **Nexus modules** | `js/nexus-engine/` — `AudioEngine`, `VisualEngineManager`, `SceneManager`, `PresetLibrary`, `pro-presets.js` (Pro 60 + `applyVisualStyle`), `NexusEngine` host (`3.0.0-pro`, `init` / `update` / `renderButterchurnLayer`) |
| **Scenes** | 20 real-time raymarched 3D scenes (fractals, volumetrics, particles, tunnels, geometry, environments) |
| **Audio** | FFT frequency bands, spectral flux, spectral centroid, beat detection, BPM tracking |
| **Post-processing** | Tinted knee bloom (toggle + MIDI **bloom** multiplier), anamorphic streak, trails / afterimage, sharpen, ACES, subtle beat lift (smoothed) |
| **Camera** | 5 cinematic modes — orbit, dolly, crane, handheld, snap (beat-triggered angle jumps) |
| **MIDI** | WebMIDI + learn mode; extended CC targets: **bloom**, **colorShift** (reserved), **bcNext** (random Butterchurn preset), **visualMode** (shader / BC / hybrid) |
| **Recording** | MediaRecorder WebM (VP9→VP8 fallback); profiles include **Stream 1080p** (~22 Mbps) for cleaner OBS re-encode |
| **Presets** | Save/load engine + post + stack to localStorage; 4 built-in starting points (Afterlife Dark, Festival Energy, Ambient Chill, Laser Show) |
| **UI** | Resolume-inspired dark pro theme with scene pads, audio meters, control sliders, palette selector |
| **Performance** | 3 GPU quality presets, adaptive FPS; **Perf lock** caps DPR and internal resolution; `prefers-reduced-motion` support |
| **Demo Director** | Pre-choreographed sequences for recording clips — top bar **DEMO** menu or URL `?demo=drop` / `festival` / `genres` / `ai` / `resolume` |
| **AI Director** | Energy + drop detection for automatic scene switches — **AI DIR** (turns off auto-morph while active) |
| **Free / Pro** | Free tier shows a subtle corner watermark; Pro unlock in dev: `NX.watermark.unlock('NEXUS_MK4_PRO')` or `earlyaccess2026` (stored in `localStorage`) |

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

## Scene Roster (20)

### Cosmic
HYPERSPACE · BLACK HOLE · MANDELBULB · CHROME PLANET · GALAXY CORE

### Energy
VORTEX ENGINE · PLASMA SPHERE · ALIEN MONOLITH

### Fluid
INK & OIL · LIQUID METAL · DEEP SEA

### Environment
NEON CITY · NEON GRID · NEBULA FLYTHROUGH

### Afterlife
VOID CATHEDRAL · SACRED GEOMETRY · NEURAL SWARM · DARK MONOLITH · LASER CATHEDRAL · AFTERLIFE RINGS

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

No npm, no bundler, no build step. Plain `<script>` tags loaded in order. GitHub Pages serves it directly.

---

## Run Locally

```bash
cd NEXUS
python3 -m http.server 8888
# Open http://localhost:8888
```

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

MIT — free for personal and commercial use. Attribution appreciated.
