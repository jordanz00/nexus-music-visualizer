# AI collaboration playbook (NEXUS Engine Pro)

Guidance for working on **NEXUS Engine Pro** with an AI coding assistant: clear context, small edits, and guardrails. Structured prompts (pair-programming tone, limits on retries and noise) adapted to this repo’s **static WebGL + Aurora Field / Butterchurn** stack.

## How to talk to the assistant

- **Pair-program:** Name the file and rough location (e.g. `js/audio.js` — beat detection). Ask for step-by-step reasoning when debugging WebGL or audio graph issues.
- **Give context:** Script load order matters (`index.html`). Mention browser (Chrome vs Safari), mic on/off, and whether the bug is **shader**, **Aurora**, or **UI**.
- **One focused change per turn** when possible: easier review and fewer regressions across `engine.js`, `post.js`, and `nexus-engine/`.

## Strict session modes (human-directed)

### Mode transitions

- Sessions start in **RESEARCH** until the human changes mode.
- The human changes mode only by sending one of these **exact** phrases: `MODE: RESEARCH`, `MODE: INNOVATE`, `MODE: PLAN`, or `MODE: EXECUTE` (literal text, including `MODE:` and the space after the colon).
- The assistant **declares the active mode at the beginning of every assistant response** (for example, a first line like `MODE: RESEARCH`).

### MODE: RESEARCH

- **Purpose:** Gather information about the codebase without suggesting or planning any changes.
- **Allowed:** Reading files, asking clarifying questions, requesting additional context, understanding code structure.
- **Forbidden:** Suggestions, planning, or implementation.
- **Output:** Observations and clarifying questions only.

### MODE: INNOVATE

- **Purpose:** Brainstorm and discuss potential approaches without committing to any specific plan.
- **Allowed:** Discussing ideas, advantages and disadvantages, seeking feedback.
- **Forbidden:** Detailed planning, concrete implementation strategies, or code writing.
- **Output:** Possibilities and considerations only.

### MODE: PLAN

- **Purpose:** Produce a detailed technical specification for the required changes.
- **Allowed:** Specific file paths, function names, and change-level detail; acceptance criteria.
- **Forbidden:** Any code implementation or example code in the assistant’s PLAN-mode output.
- **Output:** Specifications only, then a closing markdown block whose **first line is exactly** `IMPLEMENTATION CHECKLIST:` followed by a **numbered, sequential** list of steps that implementation will follow later. The checklist must be complete enough that **EXECUTE** needs no further design decisions.

### MODE: EXECUTE

- **Purpose:** Implement exactly what an approved PLAN checklist describes.
- **Allowed:** Only edits and actions that correspond to checklist items.
- **Forbidden:** Modifications, improvements, or creative additions not listed on the approved checklist.
- **Deviation:** If the work cannot follow the plan, stop; the human returns the thread to **PLAN** (send `MODE: PLAN`) before new edits.

### Notes for humans

- For **code** changes, use **PLAN** with an explicit objective and acceptance criteria before **EXECUTE**.
- All other rules in this playbook still apply: **`index.html` script order**, WebGL context handling, vendor and performance constraints, and sensitive surfaces (**mic**, **localStorage**, URL/query features such as `?demo=`, `?seed=`).

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
Let’s pair on NEXUS Pro: I’m in <file> around <area>. Goal: <one sentence>.
Constraints: <browser / mic / Free vs Pro if relevant>.
Please read the nearby code, then edit directly (don’t paste full files unless I ask).
If three fixes don’t work, stop and tell me what you need.
```

For cross-cutting work, mention **blast radius** (e.g. `post.js` + uniforms + MIDI).
