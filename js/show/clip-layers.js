'use strict';
/**
 * Resolume-style clip layers: user video/image under/over WebGL without stopping the engine loop.
 * iOS/Android: playsInline + muted default; user must pick media after a tap (gesture unlock).
 */
(function () {
  var slotsBelow = [];
  var slotsAbove = [];
  var maxSlots = 4;

  function ensureSlots(arr) {
    while (arr.length < maxSlots) arr.push({ video: null, url: '', opacity: 0, blend: 'screen', playing: false });
  }
  ensureSlots(slotsBelow);
  ensureSlots(slotsAbove);

  function stackEl(below) {
    return document.getElementById(below ? 'nx-clip-under' : 'nx-clip-over');
  }

  function makeVideoWrap(below, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'nx-clip-cell';
    wrap.dataset.slot = String(idx);
    wrap.dataset.stack = below ? 'below' : 'above';
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.muted = true;
    v.loop = true;
    v.preload = 'auto';
    v.className = 'nx-clip-video';
    wrap.appendChild(v);
    return { wrap: wrap, video: v };
  }

  function getSlot(below, idx) {
    var arr = below ? slotsBelow : slotsAbove;
    return arr[idx];
  }

  function mountIfNeeded(below, idx) {
    var st = getSlot(below, idx);
    var root = stackEl(below);
    if (!root || !st.video) return;
    if (!st.wrap || !root.contains(st.wrap)) {
      var m = makeVideoWrap(below, idx);
      st.wrap = m.wrap;
      st.video = m.video;
      root.appendChild(m.wrap);
    }
    applyStyle(st, below, idx);
  }

  function applyStyle(st, below, idx) {
    if (!st.wrap) return;
    st.wrap.style.opacity = String(st.opacity);
    st.wrap.style.mixBlendMode = st.blend || 'screen';
    st.wrap.style.zIndex = String(10 + idx);
  }

  function setOpacity(below, idx, op) {
    var st = getSlot(below, idx);
    if (!st) return;
    st.opacity = Math.max(0, Math.min(1, op));
    mountIfNeeded(below, idx);
    applyStyle(st, below, idx);
  }

  function revoke(st) {
    if (st.url && st.url.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(st.url); } catch (e) { }
    }
    st.url = '';
  }

  /**
   * @param {File} file
   * @param {boolean} below
   * @param {number} idx 0..maxSlots-1
   */
  function loadFile(file, below, idx) {
    if (!file) return Promise.reject();
    idx = Math.max(0, Math.min(maxSlots - 1, idx | 0));
    var st = getSlot(below, idx);
    revoke(st);
    var url = URL.createObjectURL(file);
    st.url = url;
    mountIfNeeded(below, idx);
    var v = st.video;
    var isVid = file.type.indexOf('video') === 0;
    return new Promise(function (resolve, reject) {
      v.onerror = function () { reject(new Error('decode')); };
      v.onloadeddata = function () { resolve(v); };
      v.src = url;
      if (isVid) {
        v.style.display = '';
        st.opacity = st.opacity > 0 ? st.opacity : 1;
        applyStyle(st, below, idx);
      } else {
        v.style.display = 'none';
        if (!st.img) {
          st.img = document.createElement('img');
          st.img.className = 'nx-clip-img';
          st.wrap.insertBefore(st.img, v);
        }
        st.img.onload = function () { resolve(st.img); };
        st.img.onerror = function () { reject(new Error('img')); };
        st.img.src = url;
        st.opacity = st.opacity > 0 ? st.opacity : 1;
        applyStyle(st, below, idx);
      }
    });
  }

  function playSlotBelow(below, idx) {
    var st = getSlot(below, idx);
    mountIfNeeded(below, idx);
    if (st.video && st.video.src) {
      var p = st.video.play();
      if (p && p.catch) p.catch(function () { });
      st.playing = true;
    }
  }

  function stopSlotBelow(below, idx) {
    var st = getSlot(below, idx);
    if (st.video) {
      try { st.video.pause(); } catch (e) { }
      st.playing = false;
    }
    st.opacity = 0;
    applyStyle(st, below, idx);
  }

  function blendToCompositeOp(blend) {
    var m = {
      screen: 'screen',
      multiply: 'multiply',
      overlay: 'overlay',
      'plus-lighter': 'lighter',
      'soft-light': 'soft-light',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      exclusion: 'exclusion',
      luminosity: 'luminosity',
      saturation: 'saturation',
      normal: 'source-over',
      'hard-light': 'hard-light',
      difference: 'difference',
      lighten: 'lighten',
      darken: 'darken'
    };
    return m[blend] || 'screen';
  }

  var BLEND_OPTIONS = [
    'screen', 'multiply', 'overlay', 'soft-light', 'plus-lighter', 'normal',
    'hard-light', 'color-dodge', 'color-burn', 'difference', 'exclusion',
    'lighten', 'darken', 'luminosity', 'saturation'
  ];

  /**
   * Draw clip stack into a 2D recording context (same order as on-screen under stack).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} dw
   * @param {number} dh
   * @param {boolean} below — true = under slots, false = over slots
   */
  function drawForRecording(ctx, dw, dh, below) {
    if (!ctx || dw < 2 || dh < 2) return;
    var arr = below ? slotsBelow : slotsAbove;
    var i;
    for (i = 0; i < maxSlots; i++) {
      var st = arr[i];
      if (!st || st.opacity < 0.001) continue;
      var el = null;
      if (st.img && st.img.complete && st.img.naturalWidth > 0) el = st.img;
      else if (st.video && st.video.readyState >= 2) el = st.video;
      if (!el) continue;
      try {
        ctx.save();
        ctx.globalAlpha = st.opacity;
        ctx.globalCompositeOperation = blendToCompositeOp(st.blend);
        ctx.drawImage(el, 0, 0, dw, dh);
        ctx.restore();
      } catch (e) { /* CORS / decode */ }
    }
  }

  function resize() {
    var b, a, i;
    for (i = 0; i < maxSlots; i++) {
      b = slotsBelow[i];
      a = slotsAbove[i];
      if (b && b.wrap) applyStyle(b, true, i);
      if (a && a.wrap) applyStyle(a, false, i);
    }
  }

  function init() {
    window.addEventListener('resize', resize, { passive: true });
    resize();
  }

  window.NX = window.NX || {};
  NX.ClipLayers = {
    init: init,
    loadFile: loadFile,
    setOpacity: function (idx, below, op) { setOpacity(!!below, idx, op); },
    playSlot: function (idx, below) { playSlotBelow(!!below, idx); },
    stopSlot: function (idx, below) { stopSlotBelow(!!below, idx); },
    setBlend: function (idx, below, mode) {
      var st = getSlot(!!below, idx);
      if (st) { st.blend = mode || 'screen'; applyStyle(st, !!below, idx); }
    },
    getBlendOptions: function () { return BLEND_OPTIONS.slice(); },
    drawForRecording: drawForRecording
  };
})();
