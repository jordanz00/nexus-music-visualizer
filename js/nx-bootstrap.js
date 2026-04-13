'use strict';
/* nx-bootstrap.js — Deferred boot: Persist → SessionSeed → HW calibrate → compile + loop. */

(function nxMainBootstrap() {
  function showBootErr(err) {
    console.error('NEXUS bootstrap failed:', err);
    var sp = document.getElementById('splash');
    if (sp) {
      var detail = (err && err.message) ? String(err.message) : String(err);
      var msg = document.createElement('p');
      msg.style.cssText = 'color:#ff8a80;font-size:12px;margin-top:12px;max-width:28em;line-height:1.4';
      msg.textContent = detail + ' — Open console (F12) for full trace. Use http://localhost or GitHub Pages URL with trailing slash if assets 404.';
      var card = sp.querySelector('.nx-splash-card');
      if (card) card.appendChild(msg);
    }
  }

  function runBootCore() {
    try {
      try {
        var _nxBootUrl = new URL(location.href);
        if (_nxBootUrl.searchParams.get('soak') === '1') window.__NX_SOAK__ = true;
        if (window.NX && NX.S && NX.BootstrapQuery && typeof NX.BootstrapQuery.parseAsuraPostParamFromHref === 'function') {
          var _ap = NX.BootstrapQuery.parseAsuraPostParamFromHref(_nxBootUrl.href);
          if (_ap) {
            if (_ap.floor) NX.S.postFxAsura = Math.max(NX.S.postFxAsura || 0, _ap.value);
            else NX.S.postFxAsura = _ap.value;
          }
        }
      } catch (_eSoak) { /* ignore */ }
      if (typeof NX.compileScenes !== 'function') {
        throw new Error('compileScenes missing — is js/scenes.js loading?');
      }
      if (!NX.post || typeof NX.post.compile !== 'function') {
        throw new Error('post pipeline missing — is js/post.js loading?');
      }
      var ok = NX.compileScenes();
      if (typeof NX.applyHomageSceneExtensions === 'function') {
        try { NX.applyHomageSceneExtensions(typeof NX.S.curS === 'number' ? NX.S.curS : 0); } catch (_eHm0) { /* ignore */ }
      }
      if (typeof NX.applySessionSceneStart === 'function') NX.applySessionSceneStart();
      if (typeof NX.applyHomageSceneExtensions === 'function') {
        try { NX.applyHomageSceneExtensions(typeof NX.S.curS === 'number' ? NX.S.curS : 0); } catch (_eHm1) { /* ignore */ }
      }
      if (NX.Showfile && typeof NX.Showfile.consumeHashIfPresent === 'function') {
        try { NX.Showfile.consumeHashIfPresent(); } catch (_eHash) { /* ignore */ }
      }
      if (NX.ShipDefaults && typeof NX.ShipDefaults.applyColdStartVisuals === 'function') {
        NX.ShipDefaults.applyColdStartVisuals();
      }
      console.log('Scenes compiled:', ok, '/', NX.scenes.length);
      if (typeof console !== 'undefined' && console.info) {
        console.info('[NEXUS] boot', {
          scenes: NX.scenes.length,
          compiled: ok,
          seed: NX.SessionSeed && NX.SessionSeed.getSeed ? NX.SessionSeed.getSeed() : null
        });
      }
      NX.post.compile();
      if (NX.GpuParticles && typeof NX.GpuParticles.init === 'function') {
        try { NX.GpuParticles.init(); } catch (eGpu) { /* ignore */ }
      }
      if (NX.BpmTimeline && typeof NX.BpmTimeline.init === 'function') {
        try { NX.BpmTimeline.init(); } catch (eBpm) { /* ignore */ }
      }
      NX.resize();
      if (NX.ProcParticles && NX.ProcParticles.init) NX.ProcParticles.init();
      if (NX.S && NX.S._iosCoarsePointer) {
        requestAnimationFrame(function () { NX.resize(); });
        setTimeout(function () { NX.resize(); }, 320);
      }
      requestAnimationFrame(function () {
        try { NX.resize(); } catch (e1) { /* ignore */ }
      });
      setTimeout(function () {
        try { NX.resize(); } catch (e2) { /* ignore */ }
      }, 50);
      if (NX.ModernVisualStack && NX.ModernVisualStack.init) NX.ModernVisualStack.init();
      if (window.NexusEngine) NexusEngine.init();
      if (NX.watermark) NX.watermark.checkPro();
      if (NX.autoDirector) NX.autoDirector.categorize();
      NX.ui.init();
      if (NX.ProPlatform && typeof NX.ProPlatform.init === 'function') {
        try { NX.ProPlatform.init(); } catch (_eProPl) { /* ignore */ }
      }
      if (NX.ProPlatform && typeof NX.ProPlatform.initInfra === 'function') {
        try { NX.ProPlatform.initInfra(); } catch (_eInf) { /* ignore */ }
      }
      if (NX.ClipLayers && NX.ClipLayers.init) NX.ClipLayers.init();
      if (NX.FxChain && NX.FxChain.init) NX.FxChain.init();
      if (NX.CompositionUI && NX.CompositionUI.init) NX.CompositionUI.init();
      if (NX.LightingDeck && NX.LightingDeck.init) NX.LightingDeck.init();
      if (NX.ShowWorkbench && NX.ShowWorkbench.init) NX.ShowWorkbench.init();
      if (NX.WgslGraph && NX.WgslGraph.tryInit) NX.WgslGraph.tryInit().catch(function () { /* ignore */ });
      (function nxOptionalThreeGuest() {
        try {
          var want = NX.ThreeGuest && typeof NX.ThreeGuest.wantsThreeFromEnv === 'function' && NX.ThreeGuest.wantsThreeFromEnv();
          if (!want) return;
          if (NX.MazeThree && typeof NX.MazeThree.isActive === 'function' && NX.MazeThree.isActive()) return;
          if (window.THREE && NX.ThreeGuest && NX.ThreeGuest.bootstrapFromUrl) {
            NX.ThreeGuest.bootstrapFromUrl();
            return;
          }
          if (document.getElementById('nx-vendor-three')) return;
          var st = document.createElement('script');
          st.id = 'nx-vendor-three';
          st.src = 'vendor/three.min.js';
          st.async = true;
          st.onload = function () {
            try {
              if (NX.ThreeGuest && NX.ThreeGuest.bootstrapFromUrl) NX.ThreeGuest.bootstrapFromUrl();
            } catch (eB) { console.warn('NEXUS Three guest bootstrap:', eB); }
          };
          st.onerror = function () {
            console.warn('NEXUS: vendor/three.min.js failed to load (check path / hosting)');
          };
          document.head.appendChild(st);
        } catch (eTg) { /* ignore */ }
      })();
      (function nxOptionalPlaycanvasGuest() {
        try {
          var wantPc = NX.PlaycanvasGuest && typeof NX.PlaycanvasGuest.wantsPlaycanvasFromEnv === 'function' && NX.PlaycanvasGuest.wantsPlaycanvasFromEnv();
          if (!wantPc) return;
          if (NX.MazeThree && typeof NX.MazeThree.isActive === 'function' && NX.MazeThree.isActive()) return;
          if (window.pc && NX.PlaycanvasGuest && NX.PlaycanvasGuest.bootstrapFromUrl) {
            NX.PlaycanvasGuest.bootstrapFromUrl();
            return;
          }
          if (document.getElementById('nx-vendor-playcanvas')) return;
          var spc = document.createElement('script');
          spc.id = 'nx-vendor-playcanvas';
          spc.src = 'vendor/playcanvas.min.js';
          spc.async = true;
          spc.onload = function () {
            try {
              if (NX.PlaycanvasGuest && NX.PlaycanvasGuest.bootstrapFromUrl) NX.PlaycanvasGuest.bootstrapFromUrl();
            } catch (ePc) { console.warn('NEXUS PlayCanvas guest bootstrap:', ePc); }
          };
          spc.onerror = function () {
            console.warn('NEXUS: vendor/playcanvas.min.js failed to load (check path / hosting)');
          };
          document.head.appendChild(spc);
        } catch (ePg) { /* ignore */ }
      })();
      if (NX.midi) NX.midi.init();
      if (NX.ResearchBrief && NX.ResearchBrief.tryConsoleLog) NX.ResearchBrief.tryConsoleLog();
      NX.showName(NX.S && typeof NX.S.curS === 'number' ? NX.S.curS : 0);
      NX.loop();
    } catch (err) {
      showBootErr(err);
    }
  }

  function runAfterPersist() {
    try {
      if (NX.SessionSeed && typeof NX.SessionSeed.init === 'function') NX.SessionSeed.init();
    } catch (eSe) { /* ignore */ }
    if (NX.HwCalibrate && typeof NX.HwCalibrate.runIfNeeded === 'function') {
      NX.HwCalibrate.runIfNeeded(function () {
        runBootCore();
      });
    } else {
      runBootCore();
    }
  }

  if (typeof window.NX === 'undefined') {
    console.error('NEXUS: NX namespace missing — scripts likely failed to load (404 or blocked). Check Network tab.');
    return;
  }
  if (NX._fatalNoWebGL) return;

  try {
    if (NX.Persist && typeof NX.Persist.init === 'function') {
      NX.Persist.init(runAfterPersist);
    } else {
      runAfterPersist();
    }
  } catch (eP) {
    runAfterPersist();
  }
})();
