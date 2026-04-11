# Professional output workflows — NEXUS Engine Pro

## OBS / streaming (supported path)

1. Run NEXUS from **HTTPS or localhost** (mic and modern APIs require a secure context).
2. Add **`?obs=1`** to auto-dismiss splash and enter **Present** mode after load (see `README.md`).
3. Capture with **OBS Browser Source** or **Window Capture** on the browser window.
4. Route audio with your OS tools (VoiceMeeter, BlackHole, etc.) — see main `README.md` for typical setups.

**NDI / Syphon / Spout:** These are **not** implemented inside the browser build. Treat OBS Browser Source + Present as the supported “clean plate” path. A future **native companion** would be a separate product decision.

## Present mode

Use **Present** (`P` or top bar) to hide chrome and maximize canvas area for capture.

## Recording in-app (WebM)

- Profiles: Native canvas stream, or **composite** (`1080p`, `Stream 1080p`, `4K`) from `#c-rec`.
- Composite modes layer Aurora (when not shader-only), clips, WebGPU (if enabled), and main WebGL per `engine.js`.
- Optional **opening title / logo** branding is drawn only into the **composite** path when enabled in **System** (see `js/nexus-rec-brand.js`).

## GitHub Pages

Use the **trailing slash** URL form for project pages so relative scripts resolve (`index.html` base-tag bootstrap comment).
