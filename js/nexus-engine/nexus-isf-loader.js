'use strict';
/**
 * nexus-isf-loader.js — ISF JSON header subset (no arbitrary #includes; no remote fetches).
 *
 * WHO THIS IS FOR: shader authors porting community ISF filters into NEXUS GLSL templates.
 * WHAT IT DOES: Parses the `/*` … `*/` ISF metadata block as JSON; validates INPUTS types we support;
 *   returns a plain map of uniform name → { type, default, min, max } for wiring to existing quad passes.
 * HOW IT CONNECTS: optional; does not execute GLSL. See https://github.com/mrRay/ISF_Spec
 */
(function () {
  var NX = window.NX || (window.NX = {});

  var ALLOWED_INPUT_TYPES = {
    float: true,
    long: true,
    bool: true,
    event: true,
    point2D: true,
    color: true,
    image: true
  };

  /**
   * Extract first ISF JSON object from combined ISF+GLSL source string.
   * @param {string} src
   * @returns {{ ok: boolean, meta?: object, error?: string }}
   */
  function parseIsfMeta(src) {
    if (!src || typeof src !== 'string') return { ok: false, error: 'empty' };
    var start = src.indexOf('/*');
    var end = src.indexOf('*/');
    if (start < 0 || end < 0 || end <= start) return { ok: false, error: 'no_block' };
    var jsonStr = src.slice(start + 2, end).trim();
    try {
      var meta = JSON.parse(jsonStr);
      if (!meta || typeof meta !== 'object') return { ok: false, error: 'not_object' };
      return { ok: true, meta: meta };
    } catch (e) {
      return { ok: false, error: 'json' };
    }
  }

  /**
   * @param {object} meta
   * @returns {{ ok: boolean, inputs?: object[], error?: string }}
   */
  function validateInputs(meta) {
    var inputs = meta.INPUTS;
    if (!Array.isArray(inputs)) return { ok: true, inputs: [] };
    var out = [];
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (!inp || typeof inp !== 'object') continue;
      var nm = inp.NAME;
      if (typeof nm !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) continue;
      var typ = inp.TYPE;
      if (!ALLOWED_INPUT_TYPES[typ]) continue;
      out.push({
        name: nm,
        type: typ,
        DEFAULT: inp.DEFAULT,
        MIN: inp.MIN,
        MAX: inp.MAX,
        LABEL: typeof inp.LABEL === 'string' ? inp.LABEL : nm
      });
    }
    return { ok: true, inputs: out };
  }

  /**
   * @param {string} isfSource
   * @returns {{ ok: boolean, passes?: object, inputs?: object[], error?: string }}
   */
  function parseIsfDocument(isfSource) {
    var p = parseIsfMeta(isfSource);
    if (!p.ok) return p;
    var v = validateInputs(p.meta);
    if (!v.ok) return v;
    var passes = p.meta.PASSES;
    if (passes != null && !Array.isArray(passes)) return { ok: false, error: 'passes_shape' };
    return { ok: true, meta: p.meta, inputs: v.inputs, passes: passes || [] };
  }

  NX.IsfLoader = {
    parseIsfMeta: parseIsfMeta,
    validateInputs: validateInputs,
    parseIsfDocument: parseIsfDocument,
    ALLOWED_INPUT_TYPES: Object.keys(ALLOWED_INPUT_TYPES).slice()
  };
})();
