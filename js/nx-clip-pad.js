'use strict';
/**
 * nx-clip-pad.js — 4×4 scene snapshot pad (queues goNext on bar via BpmTimeline reset).
 */
(function () {
  if (!window.NX) return;
  var PAD = 16;
  var slots = [];

  function ensure() {
    while (slots.length < PAD) slots.push(null);
  }

  function captureSlot(i) {
    ensure();
    var S = NX.S;
    if (!S) return;
    slots[i] = {
      curS: S.curS | 0,
      visualMode: String(S.visualMode || 'hybrid'),
      postChain: S.postChain ? JSON.parse(JSON.stringify(S.postChain)) : {}
    };
  }

  function launchSlot(i) {
    ensure();
    var s = slots[i];
    if (!s || !NX.scenes || !NX.scenes.length) return;
    if (s.postChain && typeof s.postChain === 'object' && NX.S) {
      var k;
      for (k in s.postChain) {
        if (Object.prototype.hasOwnProperty.call(s.postChain, k) && typeof s.postChain[k] === 'boolean') {
          NX.S.postChain[k] = s.postChain[k];
        }
      }
    }
    if (NX.SceneManager && s.visualMode) {
      NX.SceneManager.setMode(s.visualMode, { crossfade: true, fadeSec: 0.35 });
    }
    if (typeof NX.goNext === 'function') NX.goNext(Math.max(0, Math.min(s.curS, NX.scenes.length - 1)));
    if (NX.BpmTimeline && typeof NX.BpmTimeline.resetTracking === 'function') NX.BpmTimeline.resetTracking();
  }

  function mount() {
    var host = document.getElementById('nx-clip-pad-host');
    if (!host || host.getAttribute('data-mounted') === '1') return;
    host.setAttribute('data-mounted', '1');
    ensure();
    var r;
    for (r = 0; r < 4; r++) {
      var row = document.createElement('div');
      row.className = 'panel-row nx-show-row';
      row.style.gap = '6px';
      var c;
      for (c = 0; c < 4; c++) {
        var idx = r * 4 + c;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sm-btn';
        b.textContent = String(idx + 1);
        b.title = 'Click: launch scene · Shift+click: store current look';
        (function (ii) {
          b.addEventListener('click', function (ev) {
            if (ev.shiftKey) {
              captureSlot(ii);
              b.classList.add('nx-clip-saved');
              setTimeout(function () { b.classList.remove('nx-clip-saved'); }, 400);
            } else {
              launchSlot(ii);
            }
          });
        })(idx);
        row.appendChild(b);
      }
      host.appendChild(row);
    }
  }

  NX.ClipPad = { mount: mount, captureSlot: captureSlot, launchSlot: launchSlot };
})();
