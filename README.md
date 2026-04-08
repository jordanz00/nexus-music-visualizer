# NEXUS Visualizer

Browser-based **live visual engine** (canvas, audio-reactive demo, optional microphone). Single-file app plus a small launcher.

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

## GitHub Pages (optional)

In the repo: **Settings → Pages →** deploy from branch **`main`**, folder **`/` (root)**. Live URL: `https://jordanz00.github.io/nexus-music-visualizer/`

Further updates from this folder:

```bash
git add -A && git commit -m "Your message" && git push
```

## License

Add a `LICENSE` file in this repo if you want to specify terms for others.
