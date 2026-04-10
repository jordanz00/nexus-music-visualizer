# NEXUS Engine Pro — manual QA matrix (upgrade pass)

Run before/after substantive changes. Record browser + GPU in PR notes.

| Area | Steps | Pass criteria |
|------|--------|----------------|
| Hybrid stack | Launch → hide splash → Hybrid mode | `#c` + `#c-bc` visible per blend; no console GL errors |
| Shader-only | Visual mode = Shader | Aurora back layer hidden appropriately; WebGL only |
| Recording | REC start/stop, Native + 1080p; optional **BG** checkbox | WebM plays; composite order unchanged; **BG** only replaces black fill on composite (`#c-rec`), default off |
| LTC calibration | Show → set schmitt (×0.01) → Save; re-arm LTC | Edges follow new threshold; `nexus.ltc.cal` in localStorage |
| Clips under/over | Load clip, opacity, record | Clips appear in file; same order in export |
| WGSL | Show → enable WGSL + optional Half-res chain (Chrome/Edge) | `#nx-wgpu` overlays when enabled; half-res trades quality for FPS; disable / no WebGPU → falls back cleanly; no throw |
| LTC | Show → Arm LTC (line in) | RMS/confidence moves; time stable when signal clean; Stop teardown clean (`resetStream`) |
| MTC | Enable MTC + MIDI source | Clock follows quarter-frames |
| Adaptive GPU | Toggle AUTO Q + balanced preset | `renderScale` moves after sustained low/high FPS (watch internal state or resolution feel) |
| iOS / coarse | Safari iOS or coarse pointer | No runaway DPR; panels scroll; mic gesture still required |
| Performance lock | PERF + VIZ PERF | FPS stabilizes; high-cost scenes less likely when viz perf on |

**Git:** Run `git status` at repo root; scope NEXUS edits to `NEXUS/` unless coordinating repo-wide config.
