# AI collaboration playbook (NEXUS)

Guidance for working on **NEXUS** with an AI coding assistant: clear context, small edits, and guardrails. Structured prompts (pair-programming tone, limits on retries and noise) adapted to this repo’s **static WebGL + Aurora Field / Butterchurn** stack.

## How to talk to the assistant

- **Pair-program:** Name the file and rough location (e.g. `js/audio.js` — beat detection). Ask for step-by-step reasoning when debugging WebGL or audio graph issues.
- **Give context:** Script load order matters (`index.html`). Mention browser (Chrome vs Safari), mic on/off, and whether the bug is **shader**, **Aurora**, or **UI**.
- **One focused change per turn** when possible: easier review and fewer regressions across `engine.js`, `post.js`, and `nexus-engine/`.

## What the assistant should do

1. **Read before editing** — especially call sites and the `NX` namespace; avoid breaking globals used across modules.
2. **Prefer semantic search** for behavior (“Where is MediaRecorder started?”, “context lost handler”) over guessing filenames.
3. **Group edits** — one apply pass per file when practical; avoid unrelated refactors.
4. **No noise** — do not paste long hashes, huge minified blobs, or large binary data into chat or source.
5. **Three-try rule** — if the same file still fails lint or behavior after three focused attempts, stop and ask the human for direction or a repro URL (`?seed=`, `?demo=`).
6. **Terminal discipline** — prefer non-destructive commands; use pager-safe patterns when needed; long-running servers in the background; flag git mutations or package installs (this project has **no npm build** by default).

## NEXUS-specific reminders

- **No bundler:** plain scripts; preserve order in `index.html` unless you intentionally reorder and verify boot.
- **WebGL1 + extensions** — `engine.js` owns context and restore path; shaders live under `js/scenes.js` + `js/scenes/*.js`.
- **Vendor** — Butterchurn / presets live under `vendor/`; respect `THIRD_PARTY_NOTICES.md` when upgrading bundles.
- **Performance** — avoid extra per-frame allocations; respect existing rAF and adaptive quality patterns.
- **User data** — presets and MIDI maps use **localStorage**; do not log sensitive values.

## Optional user prompt template

```text
Let’s pair on NEXUS: I’m in <file> around <area>. Goal: <one sentence>.
Constraints: <browser / mic / Free vs Pro if relevant>.
Please read the nearby code, then edit directly (don’t paste full files unless I ask).
If three fixes don’t work, stop and tell me what you need.
```

For cross-cutting work, mention **blast radius** (e.g. `post.js` + uniforms + MIDI).
