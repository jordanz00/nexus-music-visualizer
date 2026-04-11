# Public repository sync (NEXUS)

The canonical GitHub remote for the standalone product is **[jordanz00/nexus-music-visualizer](https://github.com/jordanz00/nexus-music-visualizer)** (see root `README.md` in the parent monorepo). This workspace may contain a nested **`NEXUS/`** tree used for development.

## After each mergeable slice

1. **Verify locally**
   - Open `index.html` over **http(s)** (not `file://`) so AudioWorklet and module URLs resolve.
   - Smoke: Launch → mic → hybrid → **Present** (`P`).
   - Optional: `?soak=1` for long-run markers; `?three=1` only if you intend to load Three.js (~670 KB).
2. **Automated checks** (from `NEXUS/`):
   - `npm test` — Vitest unit tests.
   - `npx playwright test --config=playwright.nexus.config.mjs` — browser smoke (requires install: `npm ci`).
3. **Mirror to GitHub**
   - From the nested repo: `git remote -v` → confirm `origin` points at the public visualizer repo (or add `public` remote).
   - `git push origin <branch>` (or open a PR) so GitHub Pages matches this tree.

## Versioning

- Bump `js/nexus-version.js` and add an entry to `CHANGELOG.md` for user-visible releases.

## If NEXUS is only a subfolder

If you maintain a **monorepo** and the public site is a **subtree** or separate clone, use your usual `git subtree split` / copy workflow; keep `THIRD_PARTY_NOTICES.md` and `vendor/` in sync with what Pages deploys.
