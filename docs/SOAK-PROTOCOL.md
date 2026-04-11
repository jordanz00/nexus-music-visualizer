# Live soak protocol (measurable resilience)

**Pass/fail:** `SOAK-GATES.md`. **Instrumentation:** `?soak=1` on the URL.

## Framing

Browsers cannot promise “never crash.” The bar is **recovery**, **stable rAF** (no uncaught errors escaping the frame handler), and **graceful degradation** on iOS.

## Desktop soak (example: 2h)

- Enable Cycle or AI Director + moderate Aurora auto morph; optional WGSL.  
- Watch DevTools Performance, `webglcontextlost` / `webglcontextrestored`, FPS overlay (backtick).  

## iOS soak (30–45 min)

- Instant scene changes; rotate scenes + mic on/off; watch for thermal dimming.

## Transition matrix (spot checks)

Same scene → adjacent → random pads; MIDI CC while morphing (desktop); clip load during scene change; **Record** while toggling present mode and panels.

## Recording

`MediaRecorder` + composite canvas is fragile — re-test after renderer or clip changes.
