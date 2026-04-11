'use strict';
/**
 * nexus-cables-lite.js — Whitelist “mini graph” inspired by cables.gl topology (no cables runtime).
 *
 * WHO THIS IS FOR: operators experimenting with chained post-like controls from Show workbench later.
 * WHAT IT DOES: Compiles a tiny JSON graph of allowed ops into numeric uniforms for the main shader / post,
 *   e.g. mix amount, blur radius proxy, feedback gain — all clamped.
 * HOW IT CONNECTS: read-only helpers; FBO ping-pong remains in post.js / engine.
 */
(function () {
  var NX = window.NX || (window.NX = {});

  var OPS = { textureIn: true, mix: true, blur: true, feedback: true, colorGrade: true, kaleido: true, mapUV: true };

  /**
   * @param {object} graph — { nodes: [{id,type,amount?}], edges: [{from,to}] } (subset)
   * @returns {{ mix: number, blur: number, feedback: number, grade: number, kaleido: number, mapUv: number, ok: boolean, error?: string }}
   */
  function compileGraph(graph) {
    var out = { mix: 0, blur: 0, feedback: 0, grade: 0, kaleido: 0, mapUv: 0, ok: true };
    if (!graph || !Array.isArray(graph.nodes)) return { mix: 0, blur: 0, feedback: 0, grade: 0, kaleido: 0, mapUv: 0, ok: false, error: 'nodes' };
    for (var i = 0; i < graph.nodes.length; i++) {
      var n = graph.nodes[i];
      if (!n || typeof n.type !== 'string' || !OPS[n.type]) continue;
      var a = typeof n.amount === 'number' ? n.amount : 0.5;
      a = Math.max(0, Math.min(1, a));
      if (n.type === 'mix') out.mix = Math.max(out.mix, a);
      if (n.type === 'blur') out.blur = Math.max(out.blur, a);
      if (n.type === 'feedback') out.feedback = Math.max(out.feedback, a);
      if (n.type === 'colorGrade') out.grade = Math.max(out.grade, a);
      if (n.type === 'kaleido') out.kaleido = Math.max(out.kaleido, a);
      if (n.type === 'mapUV') out.mapUv = Math.max(out.mapUv, a);
    }
    return out;
  }

  /**
   * Apply compiled uniforms onto NX.S post fields (conservative caps).
   * @param {ReturnType<typeof compileGraph>} u
   * @param {object} S — NX.S
   */
  function applyToEngineState(u, S) {
    if (!u || !u.ok || !S) return;
    S.nexusPostTrails = Math.max(S.nexusPostTrails || 0, u.feedback * 0.85);
    S.postFxKaleido = Math.max(S.postFxKaleido || 0, u.kaleido * 0.55);
    S.hueShift = (S.hueShift || 0) + (u.grade - 0.5) * 0.08;
    if (typeof S.postBloomMul === 'number') S.postBloomMul += u.mix * 0.15;
  }

  NX.CablesLite = {
    compileGraph: compileGraph,
    applyToEngineState: applyToEngineState,
    ALLOWED_OPS: Object.keys(OPS).slice()
  };
})();
