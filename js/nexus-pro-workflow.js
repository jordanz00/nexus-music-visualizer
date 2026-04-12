'use strict';
/**
 * nexus-pro-workflow.js — Track fingerprint, set arc, broadcast/sync/AI stubs, System tab UI.
 *
 * WHO THIS IS FOR: Pro operators; complements shaders in nexus-pro-suite-scenes.js.
 * WHAT IT DOES: Stable short hash from spectrum snapshot; macro “narrative” phase; optional canvas.captureStream arm (no remote signaling in-repo).
 * HOW IT CONNECTS: `engine.js` calls `NX.ProPlatform.tick`; `nx-bootstrap.js` calls `init` after UI exists.
 */

(function () {
  var S = null;
  var _fpAcc = 0;
  var _fpHash = 0;

  function getS() {
    if (!S) S = NX.S;
    return S;
  }

  function djb2FreqSnapshot(freqArr) {
    if (!freqArr || !freqArr.length) return 0;
    var hash = 5381 | 0;
    var step = Math.max(1, (freqArr.length / 32) | 0);
    var i;
    for (i = 0; i < freqArr.length; i += step) {
      hash = ((hash << 5) + hash + (freqArr[i] | 0)) | 0;
    }
    return hash >>> 0;
  }

  function tick(dt) {
    var St = getS();
    if (!St) return;
    _fpAcc += dt;
    if (_fpAcc > 0.42) {
      _fpAcc = 0;
      if (St.micOn && St.freqArr) {
        _fpHash = djb2FreqSnapshot(St.freqArr);
        var hex = (_fpHash >>> 0).toString(16);
        while (hex.length < 6) hex = '0' + hex;
        St.proFingerprintShort = hex.slice(-6);
      } else if (!St.micOn) {
        St.proFingerprintShort = '';
      }
    }
    var gt = typeof St.GT === 'number' ? St.GT : 0;
    var bpm = typeof St.bpm === 'number' ? St.bpm : 120;
    var conf = typeof St.bpmConfidence === 'number' ? St.bpmConfidence : 0;
    var w = 0.018 + (bpm / 7200) * (0.35 + conf * 0.65);
    St.narrativePhase01 = 0.5 + 0.5 * Math.sin(gt * w + (St.sessionSeed || 0) * 0.001);
    var hint = St.proAiSceneHint;
    if (hint && typeof St.procHue === 'number') {
      var h = 0;
      var j;
      for (j = 0; j < Math.min(hint.length, 24); j++) {
        h += hint.charCodeAt(j) * (j + 3) * 0.0011;
      }
      St.procHue = (St.procHue * 0.92 + (h - Math.floor(h)) * 0.08) % 1;
    }
  }

  function persist(key, val) {
    try {
      if (NX.Persist && NX.Persist.setItem) NX.Persist.setItem(key, val);
      else localStorage.setItem(key, val);
    } catch (e0) { /* ignore */ }
  }

  function read(key, def) {
    try {
      var v = (NX.Persist && NX.Persist.getItem) ? NX.Persist.getItem(key) : localStorage.getItem(key);
      return v == null ? def : v;
    } catch (e1) {
      return def;
    }
  }

  function setStatus(el, text) {
    if (el) el.textContent = text;
  }

  function initInfra() {
    var St = getS();
    var body = document.querySelector('#nx-pro-platform-wrap .nx-pro-platform-body');
    if (!body || document.getElementById('nx-pro-infra-mounted')) return;
    var hr = document.createElement('hr');
    hr.id = 'nx-pro-infra-mounted';
    hr.className = 'nx-pro-infra-hr';
    body.appendChild(hr);

    var h3 = document.createElement('h3');
    h3.className = 'nx-section-title';
    h3.textContent = 'Pro infrastructure';
    body.appendChild(h3);

    function row(html) {
      var d = document.createElement('div');
      d.className = 'panel-row nx-show-row';
      d.innerHTML = html;
      body.appendChild(d);
      return d;
    }

    row('<span class="g-label" style="width:auto">Structure worker</span> <label class="nx-inline"><input type="checkbox" id="nx-pro-worker-en" checked> Dedicated Web Worker chroma</label>');
    var wk = document.getElementById('nx-pro-worker-en');
    if (wk) {
      wk.checked = read('nexus.pro.worker', '1') === '1';
      St.nexusProWorkerClassifier = wk.checked;
      wk.addEventListener('change', function () {
        persist('nexus.pro.worker', wk.checked ? '1' : '0');
        St.nexusProWorkerClassifier = wk.checked;
      });
    }

    row('<span class="g-label" style="width:auto">Film LUT (.cube)</span> <input type="file" id="nx-pro-lut-file" accept=".cube,text/plain"> <label class="nx-inline">Mix <input type="range" id="nx-pro-lut-mix" min="0" max="100" value="0"></label>');
    var lutF = document.getElementById('nx-pro-lut-file');
    var lutM = document.getElementById('nx-pro-lut-mix');
    if (lutM) {
      lutM.value = String(Math.round((St.filmLutMix || 0) * 100));
      lutM.addEventListener('input', function () {
        St.filmLutMix = (+lutM.value || 0) / 100;
        persist('nexus.pro.lutMix', String(St.filmLutMix));
      });
    }
    if (lutF) {
      lutF.addEventListener('change', function () {
        var f = lutF.files && lutF.files[0];
        if (!f || !NX.FilmLUT || !NX.gl) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            if (NX.FilmLUT.loadCubeText(NX.gl, String(r.result || ''))) {
              St.filmLutDim = NX.FilmLUT.getDim();
              St.filmLutMix = Math.max(St.filmLutMix, 0.65);
              if (lutM) lutM.value = String(Math.round(St.filmLutMix * 100));
              if (NX.post && NX.post.compile) NX.post.compile();
            }
          } catch (eL) { /* ignore */ }
        };
        r.readAsText(f);
      });
    }

    row('<span class="g-label" style="width:auto">ComfyUI base</span> <input type="url" id="nx-pro-comfy-url" class="nx-ola-url" placeholder="http://127.0.0.1:8188" spellcheck="false">');
    row('<span class="g-label" style="width:auto">Checkpoint file</span> <input type="text" id="nx-pro-comfy-ckpt" class="nx-rec-brand-title-input" placeholder="model.safetensors" maxlength="120">');
    row('<label class="nx-inline" style="width:100%">Comfy API JSON (optional — <button type="button" class="sm-btn" id="nx-pro-comfy-template">Load template</button>) <textarea id="nx-pro-comfy-wf" class="nx-pro-ai-hint" rows="4" maxlength="120000" spellcheck="false"></textarea></label>');
    row('<span class="g-label" style="width:auto">A1111 base</span> <input type="url" id="nx-pro-a1111-url" class="nx-ola-url" placeholder="http://127.0.0.1:7860" spellcheck="false">');
    row('<button type="button" class="sm-btn" id="nx-pro-ai-comfy">Queue Comfy (local)</button> <button type="button" class="sm-btn" id="nx-pro-ai-a1111">A1111 txt2img</button> <span id="nx-pro-ai-st" class="nx-show-status">—</span>');
    var comfyUrl = document.getElementById('nx-pro-comfy-url');
    var ckptEl = document.getElementById('nx-pro-comfy-ckpt');
    var wfEl = document.getElementById('nx-pro-comfy-wf');
    var a1111Url = document.getElementById('nx-pro-a1111-url');
    var aiSt = document.getElementById('nx-pro-ai-st');
    if (comfyUrl) comfyUrl.value = read('nexus.pro.comfyUrl', 'http://127.0.0.1:8188');
    if (ckptEl) ckptEl.value = read('nexus.pro.comfyCkpt', 'sd_xl_base_1.0.safetensors');
    if (wfEl) wfEl.value = read('nexus.pro.comfyWorkflow', '');
    if (a1111Url) a1111Url.value = read('nexus.pro.a1111Url', 'http://127.0.0.1:7860');
    var tplBtn = document.getElementById('nx-pro-comfy-template');
    if (tplBtn) tplBtn.addEventListener('click', function () {
      fetch(new URL('assets/comfy-api-template.json', document.baseURI || location.href).href)
        .then(function (r) { return r.text(); })
        .then(function (t) {
          wfEl.value = t;
          persist('nexus.pro.comfyWorkflow', t);
        })
        .catch(function () { setStatus(aiSt, 'Template fetch failed'); });
    });
    var comfyRun = document.getElementById('nx-pro-ai-comfy');
    if (comfyRun) comfyRun.addEventListener('click', function () {
      var base = comfyUrl && comfyUrl.value;
      var wf = wfEl && wfEl.value;
      var ck = ckptEl && ckptEl.value;
      if (!NX.ComfyClient || !base) return;
      var graph = NX.ComfyClient.parseWorkflowTemplate(wf, St.proAiSceneHint || 'abstract neon', ck);
      if (!graph) {
        setStatus(aiSt, 'Invalid workflow JSON');
        return;
      }
      persist('nexus.pro.comfyUrl', base);
      persist('nexus.pro.comfyCkpt', ck || '');
      persist('nexus.pro.comfyWorkflow', wf || '');
      setStatus(aiSt, 'Queuing…');
      NX.ComfyClient.comfyQueueAndWait(base, graph)
        .then(function (o) {
          var u = o.viewUrls && o.viewUrls[0];
          if (!u) throw new Error('no-url');
          return NX.ComfyClient.fetchAsBlob(u);
        })
        .then(function (blob) {
          var file = new File([blob], 'nexus-comfy.png', { type: 'image/png' });
          if (NX.ClipLayers && NX.ClipLayers.loadFile) {
            return NX.ClipLayers.loadFile(file, true, 0);
          }
        })
        .then(function () { setStatus(aiSt, 'Clip layer loaded (under).'); })
        .catch(function (e) { setStatus(aiSt, String(e && e.message ? e.message : e)); });
    });
    var a1111Run = document.getElementById('nx-pro-ai-a1111');
    if (a1111Run) a1111Run.addEventListener('click', function () {
      var base = a1111Url && a1111Url.value;
      if (!NX.ComfyClient || !base) return;
      persist('nexus.pro.a1111Url', base);
      setStatus(aiSt, 'A1111…');
      NX.ComfyClient.a1111Txt2Img(base, St.proAiSceneHint || 'abstract neon', {})
        .then(function (o) {
          var raw = o.base64Png;
          var bin = atob(raw);
          var arr = new Uint8Array(bin.length);
          var i;
          for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          var blob = new Blob([arr], { type: 'image/png' });
          var file = new File([blob], 'nexus-a1111.png', { type: 'image/png' });
          if (NX.ClipLayers && NX.ClipLayers.loadFile) return NX.ClipLayers.loadFile(file, true, 0);
        })
        .then(function () { setStatus(aiSt, 'A1111 image loaded (under).'); })
        .catch(function (e) { setStatus(aiSt, String(e && e.message ? e.message : e)); });
    });

    row('<span class="g-label" style="width:auto">WebRTC signaling</span> <input type="url" id="nx-pro-ws-url" class="nx-ola-url" placeholder="ws://127.0.0.1:8787" spellcheck="false">');
    row('<button type="button" class="sm-btn" id="nx-pro-ws-leader">Connect as leader</button> <button type="button" class="sm-btn" id="nx-pro-ws-follow">Connect as follower</button> <button type="button" class="sm-btn" id="nx-pro-ws-dis">Disconnect WebRTC</button>');
    row('<label class="nx-inline"><input type="checkbox" id="nx-pro-follow-scenes"> Follower: match leader scene index</label>');
    var fs = document.getElementById('nx-pro-follow-scenes');
    if (fs) {
      fs.checked = read('nexus.pro.followScenes', '0') === '1';
      St.proSyncFollowScenes = fs.checked;
      fs.addEventListener('change', function () {
        St.proSyncFollowScenes = fs.checked;
        persist('nexus.pro.followScenes', fs.checked ? '1' : '0');
      });
    }
    var wsUrl = document.getElementById('nx-pro-ws-url');
    if (wsUrl) wsUrl.value = read('nexus.pro.wsUrl', 'ws://127.0.0.1:8787');
    var wsL = document.getElementById('nx-pro-ws-leader');
    if (wsL) wsL.addEventListener('click', function () {
      var u = wsUrl && wsUrl.value;
      if (!NX.MultiscreenRTC || !u) return;
      persist('nexus.pro.wsUrl', u);
      NX.MultiscreenRTC.connect(u, 'leader', {}).then(function () { setStatus(aiSt, 'WebRTC leader signaling OK'); }).catch(function (e) { setStatus(aiSt, String(e)); });
    });
    var wsF = document.getElementById('nx-pro-ws-follow');
    if (wsF) wsF.addEventListener('click', function () {
      var u = wsUrl && wsUrl.value;
      if (!NX.MultiscreenRTC || !u) return;
      persist('nexus.pro.wsUrl', u);
      NX.MultiscreenRTC.connect(u, 'follower', {}).then(function () { setStatus(aiSt, 'WebRTC follower signaling OK'); }).catch(function (e) { setStatus(aiSt, String(e)); });
    });
    var wsD = document.getElementById('nx-pro-ws-dis');
    if (wsD) wsD.addEventListener('click', function () {
      if (NX.MultiscreenRTC && NX.MultiscreenRTC.disconnect) NX.MultiscreenRTC.disconnect();
      setStatus(aiSt, 'WebRTC disconnected.');
    });

    row('<span class="g-label" style="width:auto">NDI® relay (JPEG)</span> <input type="url" id="nx-pro-ndi-ws" class="nx-ola-url" placeholder="ws://127.0.0.1:9797" spellcheck="false">');
    row('<button type="button" class="sm-btn" id="nx-pro-ndi-go">Connect relay</button> <button type="button" class="sm-btn" id="nx-pro-ndi-pump">Start JPEG pump</button> <button type="button" class="sm-btn" id="nx-pro-ndi-stop">Stop pump</button> <span id="nx-pro-ndi-st" class="nx-show-status">—</span>');
    var ndiWs = document.getElementById('nx-pro-ndi-ws');
    var ndiSt = document.getElementById('nx-pro-ndi-st');
    if (ndiWs) ndiWs.value = read('nexus.pro.ndiWs', 'ws://127.0.0.1:9797');
    var ndiGo = document.getElementById('nx-pro-ndi-go');
    if (ndiGo) ndiGo.addEventListener('click', function () {
      var u = ndiWs && ndiWs.value;
      if (!NX.NdiBridge || !u) return;
      persist('nexus.pro.ndiWs', u);
      NX.NdiBridge.connect(u).then(function () { setStatus(ndiSt, 'NDI relay connected'); }).catch(function (e) { setStatus(ndiSt, String(e)); });
    });
    var ndiPump = document.getElementById('nx-pro-ndi-pump');
    if (ndiPump) ndiPump.addEventListener('click', function () {
      var c = document.getElementById('c');
      if (!c || !NX.NdiBridge || !NX.NdiBridge.isConnected()) {
        setStatus(ndiSt, 'Connect relay first.');
        return;
      }
      NX.NdiBridge.startPump(c, 12);
      setStatus(ndiSt, 'Pump running (~12 fps).');
    });
    var ndiStop = document.getElementById('nx-pro-ndi-stop');
    if (ndiStop) ndiStop.addEventListener('click', function () {
      if (NX.NdiBridge && NX.NdiBridge.stopPump) NX.NdiBridge.stopPump();
      if (NX.NdiBridge && NX.NdiBridge.disconnect) NX.NdiBridge.disconnect();
      setStatus(ndiSt, 'Stopped.');
    });

    row('<span class="g-label" style="width:auto">Three Pro stack</span> <button type="button" class="sm-btn" id="nx-pro-3d-msdf">MSDF text layer</button> <button type="button" class="sm-btn" id="nx-pro-3d-cam">+ Webcam</button> <button type="button" class="sm-btn" id="nx-pro-3d-off">Dispose</button>');
    var b3a = document.getElementById('nx-pro-3d-msdf');
    if (b3a) b3a.addEventListener('click', function () {
      if (!NX.ProThreeStack) return;
      NX.ProThreeStack.init({ text: 'NEXUS', camera: false }).catch(function (e) { console.warn(e); });
    });
    var b3b = document.getElementById('nx-pro-3d-cam');
    if (b3b) b3b.addEventListener('click', function () {
      if (!NX.ProThreeStack) return;
      NX.ProThreeStack.dispose();
      NX.ProThreeStack.init({ text: 'NEXUS', camera: true }).catch(function (e) { console.warn(e); });
    });
    var b3c = document.getElementById('nx-pro-3d-off');
    if (b3c) b3c.addEventListener('click', function () {
      if (NX.ProThreeStack && NX.ProThreeStack.dispose) NX.ProThreeStack.dispose();
    });
  }

  function init() {
    var St = getS();
    var host = document.getElementById('nx-tab-more');
    if (!host) return;
    if (document.getElementById('nx-pro-platform-wrap')) {
      initInfra();
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = 'nx-pro-platform-wrap';
    wrap.className = 'nx-pro-platform-wrap';

    var det = document.createElement('details');
    det.className = 'nx-acc nx-acc-inline';
    det.open = read('nexus.pro.platform.open', '0') === '1';
    det.addEventListener('toggle', function () {
      persist('nexus.pro.platform.open', det.open ? '1' : '0');
    });

    var sum = document.createElement('summary');
    sum.className = 'nx-acc-sum';
    sum.textContent = 'NEXUS Pro platform (2026 suite)';

    var body = document.createElement('div');
    body.className = 'nx-acc-body nx-pro-platform-body';

    var lead = document.createElement('p');
    lead.className = 'nx-tab-lead';
    lead.innerHTML = 'Audio science drives the <code class="nx-code-inline">PRO</code> uniform (chromagram · M/S proxy · structure). Shaders: <strong>CHROMA TONNETZ</strong> … <strong>NARRATIVE ARC SKY</strong>. NDI®/CLIP backends require your own bridge — canvas stream below is local-only.';

    var rowFp = document.createElement('div');
    rowFp.className = 'panel-row nx-show-row';
    rowFp.innerHTML = '<span class="g-label" style="width:auto">Fingerprint</span> <code id="nx-pro-fp" class="nx-seed-display meta">—</code>';

    var rowNar = document.createElement('div');
    rowNar.className = 'panel-row nx-show-row';
    rowNar.innerHTML = '<span class="g-label" style="width:auto">Narrative</span> <span id="nx-pro-nar" class="meta">—</span>';

    var rowSync = document.createElement('div');
    rowSync.className = 'panel-row nx-show-row';
    rowSync.innerHTML = '<span class="g-label" style="width:auto">Multiscreen</span> ' +
      '<select id="nx-pro-sync-role" class="preset-select" aria-label="Sync role">' +
      '<option value="solo">Solo (local)</option>' +
      '<option value="leader">Leader clock</option>' +
      '<option value="follower">Follower (manual)</option></select>';

    var rowAi = document.createElement('div');
    rowAi.className = 'panel-row nx-show-row';
    rowAi.innerHTML = '<label class="nx-inline" style="align-items:flex-start;width:100%">Scene hint (local bias) ' +
      '<textarea id="nx-pro-ai-hint" class="nx-pro-ai-hint" rows="2" maxlength="280" placeholder="e.g. cobalt minimal strobe — biases procedural hue only"></textarea></label>';

    var rowBc = document.createElement('div');
    rowBc.className = 'panel-row nx-show-row';
    rowBc.innerHTML = '<button type="button" class="sm-btn" id="nx-pro-arm-stream">Arm canvas stream</button> ' +
      '<span id="nx-pro-bc-status" class="nx-show-status">Idle — use OBS Browser Source or capture this tab; no cloud.</span>';

    var rowStop = document.createElement('div');
    rowStop.className = 'panel-row nx-show-row';
    rowStop.innerHTML = '<button type="button" class="sm-btn" id="nx-pro-stop-stream">Stop stream</button>';

    body.appendChild(lead);
    body.appendChild(rowFp);
    body.appendChild(rowNar);
    body.appendChild(rowSync);
    body.appendChild(rowAi);
    body.appendChild(rowBc);
    body.appendChild(rowStop);

    det.appendChild(sum);
    det.appendChild(body);
    wrap.appendChild(det);

    var anchor = host.querySelector('.nx-panel-scroll');
    if (anchor && anchor.firstChild) {
      anchor.insertBefore(wrap, anchor.firstChild);
    } else {
      host.appendChild(wrap);
    }

    var fpEl = document.getElementById('nx-pro-fp');
    var narEl = document.getElementById('nx-pro-nar');
    var syncSel = document.getElementById('nx-pro-sync-role');
    var aiTa = document.getElementById('nx-pro-ai-hint');
    var bcBtn = document.getElementById('nx-pro-arm-stream');
    var bcSt = document.getElementById('nx-pro-bc-status');
    var stopBtn = document.getElementById('nx-pro-stop-stream');

    if (syncSel) {
      syncSel.value = read('nexus.pro.syncRole', 'solo');
      St.proSyncRole = syncSel.value;
      syncSel.addEventListener('change', function () {
        St.proSyncRole = syncSel.value;
        persist('nexus.pro.syncRole', syncSel.value);
        setStatus(bcSt, syncSel.value === 'leader' ? 'Leader: use wall clock + LTC tab for house sync.' : 'Local visuals only.');
      });
    }
    if (aiTa) {
      aiTa.value = read('nexus.pro.aiHint', '');
      St.proAiSceneHint = aiTa.value;
      aiTa.addEventListener('input', function () {
        St.proAiSceneHint = aiTa.value;
        persist('nexus.pro.aiHint', aiTa.value);
      });
    }

    var _stream = null;
    function stopStream() {
      if (_stream && _stream.getTracks) {
        _stream.getTracks().forEach(function (t) { try { t.stop(); } catch (eT) { /* ignore */ } });
      }
      _stream = null;
      St.proBroadcastArmed = false;
      setStatus(bcSt, 'Stopped.');
    }
    if (stopBtn) stopBtn.addEventListener('click', stopStream);

    if (bcBtn) {
      bcBtn.addEventListener('click', function () {
        var c = document.getElementById('c');
        if (!c || !c.captureStream) {
          setStatus(bcSt, 'captureStream not supported in this browser.');
          return;
        }
        try {
          stopStream();
          _stream = c.captureStream(30);
          St.proBroadcastArmed = true;
          setStatus(bcSt, 'Stream armed (' + (_stream.getVideoTracks().length || 0) + ' video track). Point OBS / WebRTC peer at this MediaStream from devtools or a custom embed.');
          if (typeof console !== 'undefined' && console.info) {
            console.info('[NEXUS Pro] canvas MediaStream (local)', _stream);
          }
        } catch (eCap) {
          setStatus(bcSt, 'Could not arm stream: ' + (eCap && eCap.message ? eCap.message : eCap));
        }
      });
    }

    setInterval(function () {
      var s2 = getS();
      if (fpEl) fpEl.textContent = s2.proFingerprintShort || (s2.micOn ? '…' : '—');
      if (narEl) narEl.textContent = s2.micOn
        ? ('phase ' + (s2.narrativePhase01 || 0).toFixed(2))
        : 'mic off';
    }, 380);

    initInfra();
  }

  window.NX.ProPlatform = {
    tick: tick,
    init: init,
    initInfra: initInfra
  };
})();
