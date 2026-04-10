'use strict';
/**
 * LTC decode bridge — optional `vendor/ltc/ltc_decoder.wasm` plus JS fallback (`NX.LtcDecodeCore`).
 *
 * **WHO THIS IS FOR:** integrators shipping a WASM build; runtime falls back to JS when WASM is missing or ABI mismatches.
 *
 * ## Expected WASM ABIs (try in order)
 *
 * ### 1) JS-style export (convenience)
 * - `decodeMonoF32(mono: Float32Array, sampleRate: number): { h, m, s, f, df? } | null`
 *   - Returns a plain SMPTE object or null. Any thrown error is caught; loader tries the next ABI.
 *
 * ### 2) Memory + C-style export (Emscripten / libltc style)
 * - `memory: WebAssembly.Memory` — linear memory backing `Float32Array` / `Uint32Array` views.
 * - `malloc(n: number): number` — byte offset, or 0 on failure.
 * - `free(ptr: number): void` — releases `malloc` blocks.
 * - `ltc_decode_mono_f32(ptr: number, sampleCount: number, sampleRate: number): number`
 *   - Reads `sampleCount` mono F32 samples at byte `ptr`.
 *   - Returns **0** if no frame, else a **malloc’d** pointer to **at least 16 bytes** (four `uint32_t`):
 *     - `u32[base+0]` = hours, `+1` = minutes, `+2` = seconds, `+3` = frame
 *   - Caller must `free()` the returned pointer after reading.
 *
 * ## JS streaming path
 * When WASM is absent or fails, `decodeMonoF32` keeps one `NX.LtcDecodeCore.createStream(sr)` instance and calls `feed(buf)`.
 * **`resetStream()`** clears that instance — call it whenever LTC input is torn down (e.g. `ShowClock.stopLTC`) so the next session does not reuse stale decoder state.
 *
 * ## Calibration (JS decoder only)
 * Schmitt thresholds for the fallback live in `localStorage` key `nexus.ltc.cal` (`hi` / `lo`); see `ltc-decode-core.js` and Show tab UI.
 *
 * @see vendor/ltc/README.txt
 */
(function () {
  var wasm = null;
  var _stream = null;
  var _streamSr = 0;

  function init() {
    if (wasm) return Promise.resolve(wasm);
    return fetch('vendor/ltc/ltc_decoder.wasm', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(); })
      .then(function (buf) {
        return WebAssembly.instantiate(buf, { env: {} });
      })
      .then(function (res) {
        wasm = res.instance;
        return wasm;
      })
      .catch(function () {
        wasm = null;
        return null;
      });
  }

  function resetStream() {
    _stream = null;
    _streamSr = 0;
  }

  /**
   * @param {Float32Array} buf
   * @param {number} sampleRate
   * @returns {{h:number,m:number,s:number,f:number,df?:boolean}|null}
   */
  function decodeMonoF32(buf, sampleRate) {
    if (!buf || !buf.length) return null;
    var sr = sampleRate > 0 ? sampleRate : 48000;

    if (wasm && wasm.exports) {
      var ex = wasm.exports;
      if (typeof ex.decodeMonoF32 === 'function') {
        try {
          var r = ex.decodeMonoF32(buf, sr);
          if (r && typeof r.h === 'number') return r;
        } catch (e0) { /* ABI mismatch */ }
      }
      if (ex.memory && typeof ex.ltc_decode_mono_f32 === 'function' && typeof ex.malloc === 'function' && typeof ex.free === 'function') {
        try {
          var mem = new Float32Array(ex.memory.buffer);
          var n = buf.length;
          var ptr = ex.malloc(n * 4);
          if (ptr) {
            mem.set(buf, ptr / 4);
            var outPtr = ex.ltc_decode_mono_f32(ptr, n, sr);
            ex.free(ptr);
            if (outPtr) {
              var u32 = new Uint32Array(ex.memory.buffer);
              var base = outPtr / 4;
              var o = {
                h: u32[base] | 0,
                m: u32[base + 1] | 0,
                s: u32[base + 2] | 0,
                f: u32[base + 3] | 0
              };
              ex.free(outPtr);
              return o;
            }
          }
        } catch (e1) { /* optional native layout */ }
      }
    }

    if (NX.LtcDecodeCore && NX.LtcDecodeCore.createStream) {
      if (!_stream || _streamSr !== sr) {
        _stream = NX.LtcDecodeCore.createStream(sr);
        _streamSr = sr;
      }
      return _stream.feed(buf);
    }
    return null;
  }

  window.NX = window.NX || {};
  NX.LtcWasm = { init: init, decodeMonoF32: decodeMonoF32, resetStream: resetStream };
})();
