# Professional test outline — NEXUS Engine Pro

Canonical structure for automated and manual tests touching **NEXUS/**. The app is **static**: globals on `window.NX`, WebGL1, optional WebGPU, browser-only APIs (mic, MIDI, MediaRecorder).

## Product context (blast radius)

| Surface | Primary files |
|---------|----------------|
| Boot / GL | `index.html`, `js/engine.js` |
| Aurora / hybrid | `js/nexus-engine/visual-engine-manager.js`, `scene-manager.js` |
| Post | `js/post.js` |
| Audio | `js/audio.js`, `js/nexus-engine/audio-engine.js` |
| Recording | `js/ui.js`, `js/engine.js` (`#c-rec` composite) |
| Show / I/O | `js/show/*.js` |

## Test types

| Type | Where it runs | Examples |
|------|----------------|----------|
| Unit (pure) | Node + Vitest | URL allowlists, seed parsing helpers, JSON import validation |
| E2E smoke | Playwright + static server | Splash → Launch, no `pageerror`, one control click |
| Manual | Browser matrix | `docs/QA-MATRIX.md`, `docs/SHIP-CRITERIA.md` |

## File header template (every new test file)

```text
/**
 * ============================================================================
 * TEST SUITE: [Descriptive Suite Name]
 * ============================================================================
 * MODULE UNDER TEST: [target]
 * TEST TYPE: [Unit | E2E]
 * FRAMEWORK: Vitest | Playwright
 * PRODUCT: NEXUS Engine Pro
 * LAST MODIFIED: YYYY-MM-DD
 *
 * DESCRIPTION: [What behaviour is validated]
 * COVERAGE SCOPE: [bullets]
 * ============================================================================
 */
```

## Vitest conventions

- Prefer **`node:assert/strict`** with a **message** when the failure needs operator context.
- Do not require WebGL in Node; test **pure** helpers only, or use Playwright for GL surfaces.

## Playwright conventions

- Serve `NEXUS/` with `python3 -m http.server` on a fixed port.
- Use Chromium headless with software GL flags where needed (see `playwright.nexus.config.mjs`).
- Fail the run on **uncaught page errors** during smoke.

## Test IDs

Use stable prefixes: `NX-TEST-[AREA]-[NNN]` in `test.describe` / `it` titles for grep-friendly CI logs.

## Merge checklist (author)

- [ ] Test file has the header block above.
- [ ] No secrets or real user data in fixtures.
- [ ] If you changed `engine.js` / `post.js`, run **manual** hybrid + REC smoke (see `QA-MATRIX.md`).

See also: `docs/AGENT-MESH.md`, `docs/AI-COLLABORATION.md`, `QA-UPGRADE-MATRIX.md`.
