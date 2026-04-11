# Soak gates (pass / fail)

Use with `SOAK-PROTOCOL.md`. Append **`?soak=1`** to the app URL; the engine logs `[NEXUS][soak]` about once per minute (seconds, frame count, `S._emaFps`).

## Desktop (e.g. ≥ 2 h, tab visible)

| Gate | Pass |
|------|------|
| rAF | Soak log lines appear ~every 60s while tab visible |
| WebGL | Recoverable after stress; no stuck black |
| Heap | Stable within ~2× warm-up steady state |

## iOS (30–45 min)

| Gate | Pass |
|------|------|
| rAF | Continues under thermal throttle |
| Scenes | Instant cuts remain responsive |

Background-tab throttling is expected; do not fail on throttled FPS alone.
