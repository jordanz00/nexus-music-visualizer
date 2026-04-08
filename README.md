# NEXUS Pro Visualizer

Browser-based **broadcast-style WebGL** engine: multi-scene 3D raymarching, **spectral flux** transients, **centroid-tinted** palettes, knee bloom, and mic/demo audio. Single-file app plus a small launcher.

**Repository:** [github.com/jordanz00/nexus-music-visualizer](https://github.com/jordanz00/nexus-music-visualizer)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point — redirects to the visualizer |
| `NEXUS_v3_Final.html` | Full app (styles + logic inlined) |

## Run locally

- **Quick:** open `index.html` in a modern browser (Chrome or Safari recommended per in-app copy).
- **Safer for mic / CORS:** serve the folder, then open the served URL:

```bash
cd /path/to/NEXUS
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

## Live / venue / broadcast

NEXUS is a **browser WebGL** show: great for IMAG screens, stream overlays, and club visuals when the machine can run Chrome or Edge full-screen.

| Goal | Suggestion |
|------|------------|
| **Smooth 30–60 fps** | Start **GPU → Balanced**; use **Performance** on older GPUs or laptops. **AUTO** (Balanced only) nudges internal resolution down if FPS dips, and back up when headroom returns. |
| **Clean output** | **SHOW** (or **P**) = present mode: hides HUD, control bar, and demo badge; move the mouse to see the hint strip. |
| **Crossfades** | **Morph** slider sets scene-to-scene blend time (about **0.8–4.2 s**); **Spd** still scales how fast the engine runs and how snappy morphs feel. |
| **Tech check** | **Backtick** (grave accent key, same as tilde) toggles a small **FPS / internal % / buffer size** readout (top-right). |
| **House audio** | For *true* line-level or mixer feed, browsers only see **microphone** or **loopback** (e.g. OS/virtual cable). Plan capture in OBS/vMix and use **Window/Display Capture**, or route mixer → audio interface → mic input with sane gain. |

This is not a replacement for dedicated VJ apps (Resolume, Notch, TouchDesigner) for every tour—but it is **zero-install for guests** and easy to host on **GitHub Pages**.

## GitHub Pages (optional)

In the repo: **Settings → Pages →** deploy from branch **`main`**, folder **`/` (root)**. Live URL: `https://jordanz00.github.io/nexus-music-visualizer/`

Further updates from this folder:

```bash
git add -A && git commit -m "Your message" && git push
```

## License

Add a `LICENSE` file in this repo if you want to specify terms for others.
