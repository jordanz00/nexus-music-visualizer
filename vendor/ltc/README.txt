Optional SMPTE LTC via WebAssembly
=================================

NEXUS calls NX.LtcWasm.init() which fetches vendor/ltc/ltc_decoder.wasm if present.

Build options (pick one):
1) JorenSix/LTC.wasm — https://github.com/JorenSix/LTC.wasm — AGPL-3.0; verify license fit before shipping; copy .wasm as ltc_decoder.wasm and match exports in js/show/ltc-wasm.js.
2) Emscripten + x42/libltc — compile libltc to WASM with glue (e.g. ltc_decode_mono_f32 + malloc/free) as documented in js/show/ltc-wasm.js.

Without a .wasm file, js/show/ltc-decode-core.js feeds a streaming JS biphase decoder through NX.LtcWasm.decodeMonoF32 (best-effort; not a substitute for calibrated hardware decoders).

JS path calibration (Show tab): thresholds are stored in localStorage as `nexus.ltc.cal` JSON `{ "hi": 0.08, "lo": -0.08 }` (positive `hi`, negative `lo`, clamped in code). Saving calls `NX.LtcDecodeCore.saveCalibration`. Full WASM ABI notes: file header in js/show/ltc-wasm.js.

Until decode locks, LTC mode still shows line activity (RMS + edge-rate confidence); MTC and internal/session clocks drive cues.

Stopping LTC (`NX.ShowClock.stopLTC`) calls `NX.LtcWasm.resetStream()` so the JS streaming decoder state is cleared.
