'use strict';
/**
 * LightingDeck — simple executor faders → OLA universe (browser-safe path via CORS proxy).
 */
(function () {
  var universe = 0;
  var startCh = 1;
  var buf = new Uint8Array(512);
  var pending = false;
  var raf = null;

  function channelIndexForFader(i) {
    var ch = startCh + i;
    if (ch < 1) ch = 1;
    return ch - 1;
  }

  function schedulePush() {
    if (pending) return;
    pending = true;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      pending = false;
      raf = null;
      if (!NX.OlaClient) return;
      NX.OlaClient.setDmx(universe, buf).catch(function () { /* UI shows error */ });
    });
  }

  function onFaderInput(idx, value0to1) {
    var v = Math.max(0, Math.min(1, value0to1));
    var dmx = Math.round(v * 255);
    var ci = channelIndexForFader(idx);
    if (ci >= 0 && ci < 512) buf[ci] = dmx;
    schedulePush();
  }

  function flashChannel(idx, ms) {
    var ci = channelIndexForFader(idx);
    if (ci < 0 || ci >= 512) return;
    var prev = buf[ci];
    buf[ci] = 255;
    schedulePush();
    setTimeout(function () {
      buf[ci] = prev;
      schedulePush();
    }, ms || 120);
  }

  function wireDeck() {
    var root = document.getElementById('nx-lighting-deck');
    if (!root) return;
    var faders = root.querySelectorAll('.nx-dmx-fader');
    faders.forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-fader'), 10);
      if (isNaN(idx)) return;
      var range = el.querySelector('input[type="range"]');
      if (!range) return;
      range.addEventListener('input', function () {
        onFaderInput(idx, parseInt(range.value, 10) / 255);
      });
    });
    var flashes = root.querySelectorAll('.nx-dmx-flash');
    flashes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-fader'), 10);
        if (!isNaN(idx)) flashChannel(idx, 140);
      });
    });
    var uni = document.getElementById('nx-dmx-universe');
    if (uni) {
      uni.addEventListener('change', function () {
        universe = Math.max(0, Math.min(32, parseInt(uni.value, 10) || 0));
      });
    }
    var st = document.getElementById('nx-dmx-start');
    if (st) {
      st.addEventListener('change', function () {
        startCh = Math.max(1, Math.min(496, parseInt(st.value, 10) || 1));
      });
    }
    var url = document.getElementById('nx-ola-url');
    if (url && NX.OlaClient) {
      url.value = NX.OlaClient.getBaseUrl();
      url.addEventListener('change', function () {
        NX.OlaClient.setBaseUrl(url.value.trim());
      });
    }
    var test = document.getElementById('nx-ola-test');
    if (test) {
      test.addEventListener('click', function () {
        var t = buf[0];
        buf[0] = 255;
        NX.OlaClient.setDmx(universe, buf).then(function () {
          var stEl = document.getElementById('nx-ola-status');
          if (stEl) stEl.textContent = 'OK @ ' + NX.OlaClient.getBaseUrl();
          buf[0] = t;
          schedulePush();
        }).catch(function (e) {
          var stEl = document.getElementById('nx-ola-status');
          if (stEl) stEl.textContent = 'Fail: ' + (e && e.message ? e.message : e);
        });
      });
    }
    var mtc = document.getElementById('nx-show-mtc');
    if (mtc) {
      mtc.addEventListener('click', function () {
        if (!NX.ShowClock) return;
        NX.ShowClock.startMTC().then(function () {
          var stEl = document.getElementById('nx-show-clock-status');
          if (stEl) stEl.textContent = 'MTC · MIDI inputs: ' + NX.ShowClock.getMidiInputCount();
        }).catch(function (e) {
          var stEl = document.getElementById('nx-show-clock-status');
          if (stEl) stEl.textContent = 'MTC: ' + (e && e.message ? e.message : e);
        });
      });
    }
    var ltc = document.getElementById('nx-show-ltc');
    if (ltc) {
      ltc.addEventListener('click', function () {
        if (!NX.ShowClock) return;
        NX.ShowClock.startLTC().then(function () {
          var stEl = document.getElementById('nx-show-clock-status');
          if (stEl) stEl.textContent = 'LTC input armed (RMS gate; decode = future WASM)';
        }).catch(function (e) {
          var stEl = document.getElementById('nx-show-clock-status');
          if (stEl) stEl.textContent = 'LTC: ' + (e && e.message ? e.message : e);
        });
      });
    }
    var modeSel = document.getElementById('nx-show-mode');
    if (modeSel && NX.ShowClock) {
      modeSel.addEventListener('change', function () {
        NX.ShowClock.setMode(modeSel.value);
        if (modeSel.value === 'bpm') NX.ShowClock.resetInternal();
      });
    }
    var rst = document.getElementById('nx-show-reset');
    if (rst && NX.ShowClock) {
      rst.addEventListener('click', function () {
        NX.ShowClock.resetInternal();
        var stEl = document.getElementById('nx-show-clock-status');
        if (stEl) stEl.textContent = 'Timer reset';
      });
    }
    var stopMidi = document.getElementById('nx-show-stop-midi');
    if (stopMidi && NX.ShowClock) {
      stopMidi.addEventListener('click', function () {
        NX.ShowClock.stopMIDI();
        NX.ShowClock.stopLTC();
        NX.ShowClock.setMode('internal');
        var m = document.getElementById('nx-show-mode');
        if (m) m.value = 'internal';
        var stEl = document.getElementById('nx-show-clock-status');
        if (stEl) stEl.textContent = 'MIDI/LTC stopped — internal clock';
      });
    }
  }

  function init() {
    wireDeck();
  }

  window.NX = window.NX || {};
  NX.LightingDeck = {
    init: init,
    setUniverse: function (u) { universe = u | 0; },
    getBuffer: function () { return buf; },
    schedulePush: schedulePush
  };
})();
