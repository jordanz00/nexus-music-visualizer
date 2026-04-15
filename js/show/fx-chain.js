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
    var mixP = document.getElementById('nx-mix-particles');
    if (mixP) NX.S.nexusMixParticlesEnabled = !!mixP.checked;
    var mixProc = document.getElementById('nx-mix-proc-ambient');
    if (mixProc) NX.S.nexusProcParticlesEnabled = !!mixProc.checked;
    var volProd = document.getElementById('nx-volumetric-product');
    if (volProd) {
      NX.S.nexusVolumetricProductEnabled = !!volProd.checked;
      if (!volProd.checked && NX.VolumetricFX && typeof NX.VolumetricFX.tearDown === 'function') {
        try { NX.VolumetricFX.tearDown(); } catch (eV0) { /* ignore */ }
      }
    }
    var pLook = document.getElementById('nx-particle-look');
    if (pLook) NX.S.nexusParticleLook = String(pLook.value || 'default');
    var pMg = document.getElementById('nx-particle-match-genre');
    if (pMg) NX.S.nexusParticleMatchGenre = !!pMg.checked;
    var pAdv = document.getElementById('nx-vol-advanced-fx');
    if (pAdv) NX.S.nexusVolAdvancedFX = !!pAdv.checked;
    applyVolFromUI();
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

  function applyVolFromUI() {
    var S = NX.S;
    if (!S) return;
    var t = document.getElementById('nx-vol-tornado');
    var o = document.getElementById('nx-vol-ocean');
    var v = document.getElementById('nx-vol-vortex');
    var g = document.getElementById('nx-vol-gravity');
    var d = document.getElementById('nx-vol-depth');
    var aw = document.getElementById('nx-vol-autowind');
    var ae = document.getElementById('nx-vol-autoexplode');
    if (t) S.nexusVolTornado = Math.max(0, Math.min(1.5, (parseInt(t.value, 10) || 0) / 100));
    if (o) S.nexusVolOcean = Math.max(0, Math.min(1.5, (parseInt(o.value, 10) || 0) / 100));
    if (v) S.nexusVolVortex = Math.max(0, Math.min(1.5, (parseInt(v.value, 10) || 0) / 100));
    if (g) S.nexusVolGravity = Math.max(-1, Math.min(1, (parseInt(g.value, 10) || 0) / 100));
    if (d) S.nexusVolDepthTest = !!d.checked;
    if (aw) S.nexusVolAutoWind = !!aw.checked;
    if (ae) S.nexusVolAutoExplode = !!ae.checked;
  }

  function updateGpuParticlesStatus() {
    var el = document.getElementById('nx-gpu-particles-status');
    if (!el) return;
    var S = NX.S;
    var forced = NX.SceneManager && typeof NX.SceneManager.isParticleStackForced === 'function' && NX.SceneManager.isParticleStackForced();
    if (!S || S.nexusMixParticlesEnabled === false || (!S.nexusGpuParticlesEnabled && !forced)) {
      el.textContent = '';
      el.style.display = 'none';
      return;
    }
    var nxp = NX.particles;
    if (nxp && nxp._ready) {
      el.style.display = 'block';
      el.textContent = 'MIX particles active (Particula-derived Three.js).';
      return;
    }
    el.style.display = 'block';
    if (!nxp) el.textContent = 'MIX particles loading…';
    else el.textContent = 'MIX particles unavailable (overlay init failed).';
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
    var mixP = document.getElementById('nx-mix-particles');
    if (mixP) mixP.checked = S.nexusMixParticlesEnabled !== false;
    var mixProc = document.getElementById('nx-mix-proc-ambient');
    if (mixProc) mixProc.checked = S.nexusProcParticlesEnabled === true;
    var vt = document.getElementById('nx-vol-tornado');
    var vo = document.getElementById('nx-vol-ocean');
    var vv = document.getElementById('nx-vol-vortex');
    var vg = document.getElementById('nx-vol-gravity');
    var vd = document.getElementById('nx-vol-depth');
    var vaw = document.getElementById('nx-vol-autowind');
    var vae = document.getElementById('nx-vol-autoexplode');
    if (vt) vt.value = String(Math.round(Math.max(0, Math.min(1.5, S.nexusVolTornado != null ? S.nexusVolTornado : 0.55)) * 100));
    if (vo) vo.value = String(Math.round(Math.max(0, Math.min(1.5, S.nexusVolOcean != null ? S.nexusVolOcean : 0.45)) * 100));
    if (vv) vv.value = String(Math.round(Math.max(0, Math.min(1.5, S.nexusVolVortex != null ? S.nexusVolVortex : 0.35)) * 100));
    if (vg) vg.value = String(Math.round(Math.max(-100, Math.min(100, (S.nexusVolGravity != null ? S.nexusVolGravity : -0.24) * 100))));
    if (vd) vd.checked = S.nexusVolDepthTest !== false;
    if (vaw) vaw.checked = S.nexusVolAutoWind !== false;
    if (vae) vae.checked = S.nexusVolAutoExplode !== false;
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
    var mixP = document.getElementById('nx-mix-particles');
    if (mixP) mixP.addEventListener('change', applyFromUI);
    var mixProc = document.getElementById('nx-mix-proc-ambient');
    if (mixProc) mixProc.addEventListener('change', applyFromUI);
    var volProd = document.getElementById('nx-volumetric-product');
    if (volProd) volProd.addEventListener('change', applyFromUI);
    var pLook = document.getElementById('nx-particle-look');
    if (pLook) pLook.addEventListener('change', applyFromUI);
    var pMg = document.getElementById('nx-particle-match-genre');
    if (pMg) pMg.addEventListener('change', applyFromUI);
    var pAdv = document.getElementById('nx-vol-advanced-fx');
    if (pAdv) pAdv.addEventListener('change', applyFromUI);
    function bumpParticlePreset() {
      if (NX.VolumetricFX && typeof NX.VolumetricFX.onPresetChange === 'function') {
        try { NX.VolumetricFX.onPresetChange(); } catch (eB) { /* ignore */ }
      }
    }
    if (volProd) volProd.addEventListener('change', bumpParticlePreset);
    if (pLook) pLook.addEventListener('change', bumpParticlePreset);
    if (pMg) pMg.addEventListener('change', bumpParticlePreset);
    if (pAdv) pAdv.addEventListener('change', bumpParticlePreset);
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
    applyVolFromUI: applyVolFromUI,
    syncCheckboxes: syncCheckboxes,
    updateGpuParticlesStatus: updateGpuParticlesStatus
  };
})();
