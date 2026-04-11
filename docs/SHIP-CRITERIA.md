# NEXUS Engine Pro — ship criteria

What **shipped** means for the static-site build (GitHub Pages or local `python3 -m http.server`). Aligns with reliability, performance, licensing, operator UX, and QA.

## 1. Browser matrix

| Browser | Desktop | Mobile / tablet | Notes |
|---------|---------|-----------------|-------|
| Chrome | Required | Android: required | WebMIDI, WebGL1, MediaRecorder baseline |
| Edge | Required | — | Same engine as Chrome for most checks |
| Safari | Best-effort | iOS: required for stated mobile support | WebGL watchdog, DPR caps, rotate recovery (`engine.js` iOS paths) |
| Firefox | Best-effort | — | WebGL + recording codec may differ |

**Document** mic permission UX, `file://` vs `http(s)://`, and GitHub Pages base URL / trailing slash behavior (see `index.html` bootstrap comment).

## 2. Performance targets (not guarantees)

| Quality preset | Typical target | If sustained below |
|----------------|----------------|---------------------|
| Performance | ≥ 36 FPS mid laptop iGPU | User uses Perf lock + Performance preset |
| Balanced | ≥ 42 FPS | Adaptive GPU may lower internal render scale |
| Ultra | ≥ 30 FPS discrete GPU | Downgrade preset or Perf lock |

**Show mode:** Present + Perf lock + visual perf mode are first-class for live OBS; operators validate on their hardware before a gig.

## 3. OBS / streaming

- Window capture with **Present** (`P` or `?obs=1`).
- Virtual audio routing documented in main `README.md` (VoiceMeeter / BlackHole, etc.).

## 4. Pro vs Free

- **Free:** corner watermark (`#watermark`); feature set must not silently shrink vs last release without note.
- **Pro:** unlock via documented codes → `localStorage` (see `README.md` and in-app **More → Unlock Pro**).

## 5. v1.0 scope (suggested freeze)

**In:** WebGL scenes + post + Aurora hybrid; MIDI learn + persistence; recording profiles; session seed + DNA + preset recall; optional Meyda (lazy).

**Defer unless critical:** Second full compositor swap, full automated visual regression — see `VISUAL-TECH-ROADMAP.md`.

## 6. Release checklist (human)

- [ ] `python3 NEXUS/scripts/nexus_smoke.py` from monorepo root (or `cd NEXUS && …` per README).
- [ ] Manual pass: Launch → mic → scene change → Aurora preset → REC 10s → stop.
- [ ] Safari iOS: Launch → no permanent black canvas after rotate.
- [ ] Credits links match `THIRD_PARTY_NOTICES.md`.

## 7. Versioning

Bump customer-visible version / brand string when cutting a release (`js/nexus-brand.js` / UI as implemented).
