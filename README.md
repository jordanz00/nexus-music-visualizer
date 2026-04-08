# NEXUS Visualizer

Browser-based **live visual engine** (canvas, audio-reactive demo, optional microphone). Single-file app plus a small launcher.

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

## Publish on GitHub

1. Create a **new empty repository** on GitHub (e.g. `nexus-visualizer`), **without** adding a README (this folder already has one).
2. From this directory:

```bash
cd /path/to/NEXUS
git remote add origin https://github.com/YOUR_USERNAME/nexus-visualizer.git
git branch -M main
git push -u origin main
```

3. **Optional — GitHub Pages:** Repository **Settings → Pages → Build and deployment → Deploy from a branch →** branch `main`, folder `/ (root)`. Your site URL will be `https://YOUR_USERNAME.github.io/nexus-visualizer/` (open `index.html` via that root URL).

## License

Add a `LICENSE` file in this repo if you want to specify terms for others.
