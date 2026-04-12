# NEXUS Engine Pro — changelog

## 4.0.0-pro

- ES module entry [`js/main.mjs`](../js/main.mjs) re-exports the classic [`app-loader.mjs`](../js/app-loader.mjs) chain (GitHub Pages–safe).
- **NX_Store** persistence (prior release) + Pro workflow keys now use `NX.Persist` instead of raw `localStorage`.
- **Structure mood** (`nx-structure-mood.js`) + **Evolve stack** (`nexus-evolve-stack.js`): genome / boredom nudge / emotional & narrative fields on `NX.S`.
- **Hardware re-calibrate** control + `NX.HwCalibrate.forceRecalibrate`; tier mirrored to `hw_tier` (legacy store).
- **Clip pad** (`nx-clip-pad.js`): 4×4 store/launch in System tab; god-ray mix default aligned; GPU particle grid scales by quality preset.
- **Share hash** restore runs before cold-start ship defaults; `NX._nxShowfileFromHash` prevents spectral-mesh override after hash import.
- Showfile JSON guard: reject payloads over 240k chars.
