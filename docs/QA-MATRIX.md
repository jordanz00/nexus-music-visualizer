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
| 5 | Session seed | More → New seed (if exposed) or URL `?seed=12345` | Deterministic behavior per seed contract |
| 6 | Mic | M, allow mic | Meters move; Aurora reacts when in BC/hybrid |
| 7 | Present | P | UI hidden; canvas fills |
| 8 | OBS hint | `?obs=1` | Auto-present per README |
| 9 | Record | REC 5–10s, stop | WebM downloads; playback acceptable |
| 10 | iOS / Safari | Repeat 1–3 on iPhone | Rotate portrait/landscape recovers canvas |

## Recording regression (optional)

After major visual changes, capture **10s** clips (balanced, hybrid, one intense scene). Compare bloom, trails, Aurora blend, hue. Store artifacts outside git or in a local-only folder.
