'use strict';
/**
 * Wires Show tab: cues list, executors, clip file picker, FX chain sync with Aurora bloom checkbox.
 */
(function () {
  function refreshCueList() {
    var ul = document.getElementById('nx-cue-list');
    if (!ul || !NX.CueEngine) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    NX.CueEngine.getCues().forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'nx-cue-li';
      var lab;
      if (c.trigger === 'beat') {
        lab = (c.label || c.id) + ' · beat ÷' + (c.everyBeats | 0) + ' ph' + (c.phaseBeats | 0);
      } else {
        var t = typeof c.tSec === 'number' ? c.tSec : 0;
        lab = (c.label || c.id) + ' @ ' + t.toFixed(2) + 's';
      }
      li.textContent = lab;
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'nx-cue-rm';
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove cue');
      rm.addEventListener('click', function () {
        NX.CueEngine.removeCue(c.id);
        refreshCueList();
      });
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }

  function wireExecutors() {
    for (var i = 0; i < 6; i++) {
      (function (idx) {
        var btn = document.getElementById('nx-exec-' + idx);
        var sel = document.getElementById('nx-exec-sel-' + idx);
        if (btn) {
          btn.addEventListener('click', function () {
            if (NX.CueEngine) NX.CueEngine.fireExecutor(idx);
          });
        }
        if (sel) {
          sel.addEventListener('change', function () {
            if (NX.CueEngine) NX.CueEngine.bindExecutor(idx, sel.value);
          });
        }
      })(i);
    }
  }

  function syncExecSelectors() {
    var cues = NX.CueEngine ? NX.CueEngine.getCues() : [];
    for (var i = 0; i < 6; i++) {
      var sel = document.getElementById('nx-exec-sel-' + i);
      if (!sel) continue;
      var cur = NX.CueEngine ? (NX.CueEngine.getExecutors()[i] || {}).cueId : '';
      while (sel.options.length > 1) sel.remove(1);
      cues.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.label || c.id;
        sel.appendChild(o);
      });
      if (cur) sel.value = cur;
    }
  }

  function pushChainFromUI() {
    if (!NX.WgslGraph) return;
    var box = document.getElementById('nx-wgpu-chain-list');
    if (!box) return;
    var rows = box.querySelectorAll('.nx-wgpu-row');
    var list = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      var sel = row.querySelector('select');
      var rg = row.querySelector('input[type="range"]');
      if (!sel) continue;
      list.push({
        type: sel.value,
        intensity: rg ? parseInt(rg.value, 10) / 100 : 0.5
      });
    }
    if (!list.length) list = [{ type: 'passthrough', intensity: 0 }];
    NX.WgslGraph.setChain(list);
  }

  function rebuildWgpuChainList() {
    var box = document.getElementById('nx-wgpu-chain-list');
    if (!box || !NX.WgslGraph) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    var types = NX.WgslGraph.NODE_TYPES || [];
    var chain = NX.WgslGraph.getChain();
    chain.forEach(function (node) {
      var row = document.createElement('div');
      row.className = 'nx-wgpu-row';
      var sel = document.createElement('select');
      sel.className = 'preset-select';
      var t;
      for (t = 0; t < types.length; t++) {
        var o = document.createElement('option');
        o.value = types[t];
        o.textContent = types[t];
        if (types[t] === node.type) o.selected = true;
        sel.appendChild(o);
      }
      var rg = document.createElement('input');
      rg.type = 'range';
      rg.min = '0';
      rg.max = '100';
      rg.value = String(Math.round(node.intensity * 100));
      rg.title = 'Intensity';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'sm-btn nx-wgpu-rm';
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove node');
      sel.addEventListener('change', pushChainFromUI);
      rg.addEventListener('input', pushChainFromUI);
      rm.addEventListener('click', function () {
        if (box.querySelectorAll('.nx-wgpu-row').length <= 1) return;
        row.remove();
        pushChainFromUI();
      });
      row.appendChild(sel);
      row.appendChild(rg);
      row.appendChild(rm);
      box.appendChild(row);
    });
  }

  function wireWgpu() {
    var st = document.getElementById('nx-wgpu-status');
    var en = document.getElementById('nx-wgpu-enable');
    var add = document.getElementById('nx-wgpu-add-node');
    if (!NX.WgslGraph) {
      if (st) st.textContent = 'WGSL graph not loaded';
      return;
    }
    NX.WgslGraph.tryInit().then(function (ok) {
      if (st) {
        st.textContent = ok
          ? 'WebGPU ready — enable layer to composite over WebGL.'
          : 'WebGPU unavailable (use a supported browser or disable).';
      }
      if (en) en.disabled = !ok;
    });
    rebuildWgpuChainList();
    if (add) {
      add.addEventListener('click', function () {
        var ch = NX.WgslGraph.getChain().slice();
        ch.push({ type: 'passthrough', intensity: 0.45 });
        NX.WgslGraph.setChain(ch.slice(0, 8));
        rebuildWgpuChainList();
      });
    }
    if (en) {
      en.addEventListener('change', function () {
        NX.WgslGraph.tryInit().then(function (ok) {
          if (ok) NX.WgslGraph.setEnabled(!!en.checked);
          else {
            en.checked = false;
            NX.WgslGraph.setEnabled(false);
          }
        });
      });
    }
    var hr = document.getElementById('nx-wgpu-half-res');
    if (hr && NX.WgslGraph) {
      hr.checked = !!NX.WgslGraph.getHalfResChain();
      hr.addEventListener('change', function () {
        NX.WgslGraph.setHalfResChain(!!hr.checked);
      });
    }
  }

  function syncCueTriggerFields() {
    var trig = document.getElementById('nx-cue-trigger');
    var beat = trig && trig.value === 'beat';
    ['nx-cue-tsec', 'nx-cue-every-beats', 'nx-cue-phase-beats'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('label');
      if (row) {
        if (id === 'nx-cue-tsec') row.style.display = beat ? 'none' : '';
        if (id === 'nx-cue-every-beats' || id === 'nx-cue-phase-beats') row.style.display = beat ? '' : 'none';
      }
    });
  }

  function init() {
    wireExecutors();
    var trigEl = document.getElementById('nx-cue-trigger');
    if (trigEl) {
      trigEl.addEventListener('change', syncCueTriggerFields);
      syncCueTriggerFields();
    }
    var add = document.getElementById('nx-cue-add');
    if (add) {
      add.addEventListener('click', function () {
        var tEl = document.getElementById('nx-cue-tsec');
        var sEl = document.getElementById('nx-cue-scene');
        var trig = document.getElementById('nx-cue-trigger');
        var evEl = document.getElementById('nx-cue-every-beats');
        var phEl = document.getElementById('nx-cue-phase-beats');
        var tSec = tEl ? parseFloat(tEl.value) : 0;
        var idx = sEl ? parseInt(sEl.value, 10) : 0;
        if (isNaN(tSec) || tSec < 0) tSec = 0;
        if (isNaN(idx)) idx = 0;
        var everyB = evEl ? parseInt(evEl.value, 10) : 8;
        var phaseB = phEl ? parseInt(phEl.value, 10) : 0;
        if (isNaN(everyB) || everyB < 1) everyB = 8;
        if (isNaN(phaseB) || phaseB < 0) phaseB = 0;
        var cue;
        if (trig && trig.value === 'beat') {
          cue = {
            label: 'Beat ÷' + everyB,
            trigger: 'beat',
            everyBeats: everyB,
            phaseBeats: phaseB % everyB,
            tSec: 0,
            enabled: true,
            actions: [{ type: 'scene', index: idx }]
          };
        } else {
          cue = {
            label: 'Cue ' + tSec.toFixed(1) + 's',
            tSec: tSec,
            enabled: true,
            actions: [{ type: 'scene', index: idx }]
          };
        }
        NX.CueEngine.addCue(cue);
        refreshCueList();
        syncExecSelectors();
      });
    }
    var arm = document.getElementById('nx-cue-arm');
    if (arm) arm.addEventListener('click', function () { if (NX.CueEngine) NX.CueEngine.armAll(); });

    var fin = document.getElementById('nx-clip-file');
    var slot = document.getElementById('nx-clip-slot');
    var below = document.getElementById('nx-clip-below');
    var go = document.getElementById('nx-clip-load');
    if (go && fin) {
      go.addEventListener('click', function () {
        var f = fin.files && fin.files[0];
        if (!f || !NX.ClipLayers) return;
        var sl = slot ? parseInt(slot.value, 10) : 0;
        var bl = below ? !!below.checked : true;
        NX.ClipLayers.loadFile(f, bl, sl).then(function () {
          NX.ClipLayers.playSlot(sl, bl);
        }).catch(function () { });
      });
    }
    var opR = document.getElementById('nx-clip-opacity');
    var opGo = document.getElementById('nx-clip-opacity-set');
    if (opGo && opR) {
      opGo.addEventListener('click', function () {
        var sl = slot ? parseInt(slot.value, 10) : 0;
        var bl = below ? !!below.checked : true;
        var v = parseInt(opR.value, 10) / 100;
        if (NX.ClipLayers) NX.ClipLayers.setOpacity(sl, bl, v);
      });
    }
    var blSel = document.getElementById('nx-clip-blend');
    var blGo = document.getElementById('nx-clip-blend-set');
    if (blGo && blSel && NX.ClipLayers) {
      blGo.addEventListener('click', function () {
        var sl = slot ? parseInt(slot.value, 10) : 0;
        var bl = below ? !!below.checked : true;
        NX.ClipLayers.setBlend(sl, bl, blSel.value);
      });
    }

    function refreshPresetSelect() {
      var sel = document.getElementById('nx-preset-sel');
      if (!sel || !NX.ScenePresets) return;
      var cur = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      NX.ScenePresets.listNames().forEach(function (n) {
        var o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        sel.appendChild(o);
      });
      if (cur && Array.prototype.some.call(sel.options, function (o) { return o.value === cur; })) sel.value = cur;
    }
    var psave = document.getElementById('nx-preset-save');
    var papp = document.getElementById('nx-preset-apply');
    var psel = document.getElementById('nx-preset-sel');
    var pname = document.getElementById('nx-preset-name');
    if (psave && NX.ScenePresets) {
      psave.addEventListener('click', function () {
        var n = pname ? pname.value : '';
        if (NX.ScenePresets.save(n)) refreshPresetSelect();
      });
    }
    if (papp && psel && NX.ScenePresets) {
      papp.addEventListener('click', function () {
        if (psel.value) NX.ScenePresets.apply(psel.value);
      });
    }
    refreshPresetSelect();

    var ltcTh = document.getElementById('nx-ltc-thresh');
    var ltcSv = document.getElementById('nx-ltc-cal-save');
    if (ltcTh && ltcSv && NX.LtcDecodeCore && NX.LtcDecodeCore.saveCalibration) {
      try {
        var cal = JSON.parse(localStorage.getItem('nexus.ltc.cal') || '{}');
        if (typeof cal.hi === 'number') ltcTh.value = String(Math.round(cal.hi * 100));
      } catch (eCal) { /* ignore */ }
      ltcSv.addEventListener('click', function () {
        var v = parseInt(ltcTh.value, 10);
        if (isNaN(v)) v = 8;
        NX.LtcDecodeCore.saveCalibration(v / 100);
      });
    }

    refreshCueList();
    syncExecSelectors();
    wireWgpu();
  }

  window.NX = window.NX || {};
  NX.ShowWorkbench = { init: init, refreshCueList: refreshCueList, syncExecSelectors: syncExecSelectors };
})();
