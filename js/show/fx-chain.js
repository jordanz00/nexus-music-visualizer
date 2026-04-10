'use strict';
/**
 * In-app effect chain toggles → NX.S.postChain (consumed by post.js). Mirrors Resolume-style bypass.
 */
(function () {
  function ensure() {
    var S = NX.S;
    if (!S.postChain) {
      S.postChain = { bloom: true, streak: true, grade: true, trails: true, kaleido: true, glitch: true };
    }
    if (S.postChain.kaleido === undefined) S.postChain.kaleido = true;
    if (S.postChain.glitch === undefined) S.postChain.glitch = true;
    return S.postChain;
  }

  function applyFromUI() {
    var pc = ensure();
    var b = document.getElementById('nx-fx-bloom');
    var st = document.getElementById('nx-fx-streak');
    var g = document.getElementById('nx-fx-grade');
    var tr = document.getElementById('nx-fx-trails-chain');
    var kal = document.getElementById('nx-fx-kaleido-chain');
    var gli = document.getElementById('nx-fx-glitch-chain');
    if (b) pc.bloom = !!b.checked;
    if (st) pc.streak = !!st.checked;
    if (g) pc.grade = !!g.checked;
    if (tr) pc.trails = !!tr.checked;
    if (kal) pc.kaleido = !!kal.checked;
    if (gli) pc.glitch = !!gli.checked;
    var nb = document.getElementById('nx-bloom');
    if (!pc.bloom) NX.S.nexusPostBloom = false;
    else if (nb) NX.S.nexusPostBloom = !!nb.checked;
  }

  function syncCheckboxes() {
    var pc = ensure();
    var b = document.getElementById('nx-fx-bloom');
    var st = document.getElementById('nx-fx-streak');
    var g = document.getElementById('nx-fx-grade');
    var tr = document.getElementById('nx-fx-trails-chain');
    var kal = document.getElementById('nx-fx-kaleido-chain');
    var gli = document.getElementById('nx-fx-glitch-chain');
    if (b) b.checked = pc.bloom !== false;
    if (st) st.checked = pc.streak !== false;
    if (g) g.checked = pc.grade !== false;
    if (tr) tr.checked = pc.trails !== false;
    if (kal) kal.checked = pc.kaleido !== false;
    if (gli) gli.checked = pc.glitch !== false;
  }

  function init() {
    ensure();
    ['nx-fx-bloom', 'nx-fx-streak', 'nx-fx-grade', 'nx-fx-trails-chain', 'nx-fx-kaleido-chain', 'nx-fx-glitch-chain'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFromUI);
    });
    var nb = document.getElementById('nx-bloom');
    if (nb) nb.addEventListener('change', applyFromUI);
    syncCheckboxes();
  }

  window.NX = window.NX || {};
  NX.FxChain = { init: init, ensure: ensure, applyFromUI: applyFromUI, syncCheckboxes: syncCheckboxes };
})();
