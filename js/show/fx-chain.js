'use strict';
/**
 * In-app effect chain toggles → NX.S.postChain (consumed by post.js). Mirrors Resolume-style bypass.
 */
(function () {
  function ensure() {
    var S = NX.S;
    if (!S.postChain) {
      S.postChain = { bloom: true, streak: true, grade: true, trails: true, kaleido: true, glitch: true, godray: true };
    }
    if (S.postChain.kaleido === undefined) S.postChain.kaleido = true;
    if (S.postChain.glitch === undefined) S.postChain.glitch = true;
    if (S.postChain.godray === undefined) S.postChain.godray = true;
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
    var gr = document.getElementById('nx-fx-godray-chain');
    if (b) pc.bloom = !!b.checked;
    if (st) pc.streak = !!st.checked;
    if (g) pc.grade = !!g.checked;
    if (tr) pc.trails = !!tr.checked;
    if (kal) pc.kaleido = !!kal.checked;
    if (gli) pc.glitch = !!gli.checked;
    if (gr) pc.godray = !!gr.checked;
    var nb = document.getElementById('nx-bloom');
    if (!pc.bloom) NX.S.nexusPostBloom = false;
    else if (nb) NX.S.nexusPostBloom = !!nb.checked;
    var grMix = document.getElementById('nx-godray-mix');
    if (grMix) NX.S.nexusGodRayMix = Math.max(0, Math.min(1, (parseInt(grMix.value, 10) || 0) / 100));
    var gpu = document.getElementById('nx-gpu-particles');
    if (gpu) NX.S.nexusGpuParticlesEnabled = !!gpu.checked;
    var bpmOn = document.getElementById('nx-bpm-timeline');
    var bpmBeats = document.getElementById('nx-bpm-phrase-beats');
    var bpmMode = document.getElementById('nx-bpm-timeline-mode');
    if (bpmOn) NX.S.nexusBpmTimelineEnabled = !!bpmOn.checked;
    if (bpmBeats) NX.S.nexusBpmPhraseBeats = Math.max(1, Math.min(128, parseInt(bpmBeats.value, 10) || 16));
    if (bpmMode) NX.S.nexusBpmTimelineMode = String(bpmMode.value || 'clock');
    if (NX.BpmTimeline && typeof NX.BpmTimeline.resetTracking === 'function') {
      try { NX.BpmTimeline.resetTracking(); } catch (eR) { /* ignore */ }
    }
    updateGpuParticlesStatus();
  }

  function updateGpuParticlesStatus() {
    var el = document.getElementById('nx-gpu-particles-status');
    if (!el) return;
    var S = NX.S;
    if (!S || !S.nexusGpuParticlesEnabled) {
      el.textContent = '';
      el.style.display = 'none';
      return;
    }
    var ready = NX.GpuParticles && typeof NX.GpuParticles.isReady === 'function' && NX.GpuParticles.isReady();
    if (ready) {
      el.textContent = '';
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.textContent = 'GPU particle sim unavailable on this device (float framebuffer or vertex texture fetch not supported).';
  }

  function syncCheckboxes() {
    var S = NX.S;
    var pc = ensure();
    var b = document.getElementById('nx-fx-bloom');
    var st = document.getElementById('nx-fx-streak');
    var g = document.getElementById('nx-fx-grade');
    var tr = document.getElementById('nx-fx-trails-chain');
    var kal = document.getElementById('nx-fx-kaleido-chain');
    var gli = document.getElementById('nx-fx-glitch-chain');
    var gr = document.getElementById('nx-fx-godray-chain');
    if (b) b.checked = pc.bloom !== false;
    if (st) st.checked = pc.streak !== false;
    if (g) g.checked = pc.grade !== false;
    if (tr) tr.checked = pc.trails !== false;
    if (kal) kal.checked = pc.kaleido !== false;
    if (gli) gli.checked = pc.glitch !== false;
    if (gr) gr.checked = pc.godray !== false;
    var grMix = document.getElementById('nx-godray-mix');
    if (grMix) grMix.value = String(Math.round(Math.max(0, Math.min(1, S.nexusGodRayMix == null ? 0.32 : S.nexusGodRayMix)) * 100));
    var gpu = document.getElementById('nx-gpu-particles');
    if (gpu) gpu.checked = !!S.nexusGpuParticlesEnabled;
    var bpmOn = document.getElementById('nx-bpm-timeline');
    var bpmBeats = document.getElementById('nx-bpm-phrase-beats');
    var bpmMode = document.getElementById('nx-bpm-timeline-mode');
    if (bpmOn) bpmOn.checked = !!S.nexusBpmTimelineEnabled;
    if (bpmBeats) bpmBeats.value = String(Math.max(1, Math.min(128, (S.nexusBpmPhraseBeats | 0) || 16)));
    if (bpmMode) bpmMode.value = String(S.nexusBpmTimelineMode || 'clock');
    updateGpuParticlesStatus();
  }

  function init() {
    ensure();
    ['nx-fx-bloom', 'nx-fx-streak', 'nx-fx-grade', 'nx-fx-trails-chain', 'nx-fx-kaleido-chain', 'nx-fx-glitch-chain', 'nx-fx-godray-chain'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFromUI);
    });
    var nb = document.getElementById('nx-bloom');
    if (nb) nb.addEventListener('change', applyFromUI);
    var grMix = document.getElementById('nx-godray-mix');
    if (grMix) grMix.addEventListener('input', applyFromUI);
    var gpu = document.getElementById('nx-gpu-particles');
    if (gpu) gpu.addEventListener('change', applyFromUI);
    var bpmOn = document.getElementById('nx-bpm-timeline');
    if (bpmOn) bpmOn.addEventListener('change', applyFromUI);
    var bpmBeats = document.getElementById('nx-bpm-phrase-beats');
    if (bpmBeats) bpmBeats.addEventListener('change', applyFromUI);
    var bpmMode = document.getElementById('nx-bpm-timeline-mode');
    if (bpmMode) bpmMode.addEventListener('change', applyFromUI);
    syncCheckboxes();
    updateGpuParticlesStatus();
  }

  window.NX = window.NX || {};
  NX.FxChain = {
    init: init,
    ensure: ensure,
    applyFromUI: applyFromUI,
    syncCheckboxes: syncCheckboxes,
    updateGpuParticlesStatus: updateGpuParticlesStatus
  };
})();
