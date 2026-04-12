# NEXUS — QA matrix & recording regression

Manual releases; combine with:

```bash
python3 NEXUS/scripts/nexus_smoke.py
```

(from repository root — parent folder that contains `NEXUS/`)

Exit code **0** = required files and bootstrap markers present.

## Manual matrix (tick per release)

| # | Case | Steps | Pass criteria |
|---|------|-------|----------------|
| 1 | Cold load | Open `index.html` via local server or GH Pages URL **with trailing slash** | Splash → Launch; no `NX` missing bootstrap error |
| 2 | WebGL | Launch | Canvas shows motion (not `nx-fatal-no-webgl`) |
| 3 | Scene advance | Space / Next | Scene name updates; no black freeze |
| 4 | Random | R twice | Different scene index (high probability) |
| 5 | Session seed | More → **Reroll seed** or URL `?seed=12345` | Seed display updates; deterministic behavior per seed contract |
| 6 | Mic | M, allow mic | Meters move; Aurora reacts when in BC/hybrid |
| 7 | Present | P | UI hidden; canvas fills |
| 8 | OBS hint | `?obs=1` | Auto-present per README |
| 9 | Record | REC 5–10s, stop | WebM downloads; playback acceptable |
| 10 | iOS / Safari | Repeat 1–3 on iPhone | Rotate portrait/landscape recovers canvas |
| 11 | Onboarding | Clear tour (`Show tour again`) → reload → Launch | Wizard appears once; Skip/Done persists |
| 12 | Showfile | System → Export → Import JSON | Visual mode / seed / post flags apply without console errors |
| 13 | REC brand | System → enable title + optional logo → REC 1080p 5s | Title bar visible at start of composite clip |
| 14 | Unit / E2E | `cd NEXUS && npm test && npm run test:e2e` | Vitest green; Playwright smoke green |
| 15 | Share hash `#nx=` | System → Copy share link → open in new tab | State restores; cold-start spectral mesh does not override imported scene |
| 16 | HW re-calibrate | System → Re-calibrate hardware | Banner text; quality select may change; `?nocal=1` skips probe |
| 17 | Evolve panel | System → Evolve & BPM clip pad open | Mood + genome codes update with mic on; Copy genome works |
| 18 | Clip pad | Shift+click cell to store, plain click to launch another | Stored scene launches; no console errors |
| 19 | Structure mood | Mic on, music with transients | `nx-structure-mood-disp` changes over time |
| 20 | God-ray perf | Quality Performance + VIZ PERF | Scene still visible; god-ray strength reduced vs Ultra |

## Recording regression (optional)

After major visual changes, capture **10s** clips (balanced, hybrid, one intense scene). Compare bloom, trails, Aurora blend, hue. Store artifacts outside git or in a local-only folder.
