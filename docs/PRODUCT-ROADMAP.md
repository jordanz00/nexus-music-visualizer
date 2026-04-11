# NEXUS Engine Pro — product roadmap

Single place for **vision**, **user journeys**, and **release phases**. Engineering checklists live in `SHIP-CRITERIA.md` and `QA-MATRIX.md`.

## Positioning

**One line:** A static, no-build pro VJ surface in the browser — WebGL scenes + graded post + **Aurora Field** (Butterchurn / MilkDrop-class) hybrid stack, driven by **live audio**, **MIDI**, and **recording**, tuned for real shows and OBS capture.

## Who it is for

| Segment | Need |
|--------|------|
| **Live operator** | Predictable FPS, present mode, perf lock, fast scene change, clear mic path. |
| **Content creator** | Repeatable looks (`?seed=`, presets), recording profiles, codec fallback. |
| **First-time visitor** | Splash → Launch → motion without reading the README. |

## Product principles

1. **Show-first** — On-air path: launch → input → motion → optional record in minutes.
2. **Calm under load** — Beat-driven visuals avoid punishing the operator (smoothed beat channels, adaptive quality).
3. **Recoverability** — WebGL loss, mic denial, recorder failure: visible state, not a silent black canvas.
4. **Determinism when it matters** — Session seed + preset recall for repeatable art direction.
5. **Honest static scope** — No fake backend; GitHub Pages–friendly; vendor and license story stays documented.

## Journey (success = the flow works)

| Stage | Goal | “Done” signal |
|-------|------|----------------|
| Land | Trust + load | Launch works; fatal WebGL path is clear. |
| Configure | Input + feel | Mic/MIDI discoverable; meters truthful. |
| Perform | Control + stability | Scene change, hybrid, post — without hunting; Present one action away. |
| Capture | File out the door | REC produces a playable WebM; labels match intent. |
| Return | Same show tomorrow | Presets + seed + maps persist in localStorage. |

## Phased roadmap

### v1.0 — Shippable show

**In scope:** Scene stack + post + Aurora hybrid; MIDI learn + persistence; recording profiles + VP9→VP8 fallback; session seed + preset recall; optional Meyda (lazy, off by default). Pro vs Free (watermark) with in-app unlock path (see **More** tab).

**Exit:** `python3 NEXUS/scripts/nexus_smoke.py` + manual `QA-MATRIX.md` pass + browser matrix documented in `SHIP-CRITERIA.md`.

### v1.1 — Operator polish

Deeper failure copy (mic denied, recorder unsupported), OBS onboarding micro-copy, optional short QA clips after major visual changes.

### v1.2+ — Expansion (explicit decision only)

Second compositor stacks, projectM-class integrations — only after OSS/LGPL/perf review; see `VISUAL-TECH-ROADMAP.md`.

## Metrics (lightweight)

- FPS vs quality tier on a defined reference class of devices.
- REC success: start → stop → downloaded file plays with acceptable A/V sync.
- No silent Free-tier regressions without release note.

## Related files

- `README.md` — features, shortcuts, run locally.
- `docs/SHIP-CRITERIA.md` — what “shipped” means.
- `docs/QA-MATRIX.md` — manual matrix + smoke command.
- `docs/VISUAL-TECH-ROADMAP.md` — WebGL / WebGPU directions.
- `docs/AI-COLLABORATION.md` — how humans and AI should work this repo.
