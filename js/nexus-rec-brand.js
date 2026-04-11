'use strict';
/**
 * nexus-rec-brand.js — Optional opening title + logo on composite REC (#c-rec).
 */
(function () {
  if (!window.NX || !NX.S) return;

  var _logo = null;

  function syncFromDom() {
    var S = NX.S;
    var cb = document.getElementById('nx-rec-brand-open');
    S.recBrandEnabled = !!(cb && cb.checked);
    var ti = document.getElementById('nx-rec-brand-title');
    S.recBrandTitle = ti && ti.value ? String(ti.value).slice(0, 80) : 'NEXUS Engine Pro';
  }

  function loadLogoFile(file) {
    if (!file || file.size > 2 * 1024 * 1024) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS: logo file too large or missing (max 2MB)');
      _logo = null;
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () { _logo = img; };
      img.onerror = function () { _logo = null; };
      img.src = String(r.result || '');
    };
    r.readAsDataURL(file);
  }

  function wire() {
    var cb = document.getElementById('nx-rec-brand-open');
    var ti = document.getElementById('nx-rec-brand-title');
    var lo = document.getElementById('nx-rec-brand-logo');
    if (cb) cb.addEventListener('change', syncFromDom);
    if (ti) ti.addEventListener('input', syncFromDom);
    if (lo) {
      lo.addEventListener('change', function () {
        var f = lo.files && lo.files[0];
        lo.value = '';
        if (f) loadLogoFile(f);
      });
    }
    syncFromDom();
  }

  /**
   * @param {CanvasRenderingContext2D} x2d
   * @param {{w:number,h:number}} d
   * @param {object} S NX.S
   */
  function drawCompositeOverlay(x2d, d, S) {
    if (!S.recBrandEnabled) return;
    var t0 = typeof S._recT0 === 'number' ? S._recT0 : performance.now();
    var elapsed = (performance.now() - t0) / 1000;
    if (elapsed > 1.25) return;
    var title = S.recBrandTitle || 'NEXUS Engine Pro';
    x2d.save();
    x2d.fillStyle = 'rgba(0,4,12,0.55)';
    x2d.fillRect(0, 0, d.w, Math.min(d.h * 0.14, 120));
    x2d.fillStyle = 'rgba(240,248,255,0.95)';
    x2d.font = '600 ' + Math.round(Math.min(d.w, d.h) * 0.035) + 'px Orbitron,system-ui,sans-serif';
    x2d.textAlign = 'center';
    x2d.textBaseline = 'middle';
    x2d.fillText(title, d.w * 0.5, Math.min(d.h * 0.07, 56));
    x2d.restore();
    if (_logo && _logo.complete && _logo.naturalWidth && elapsed > 0.12) {
      var lw = Math.min(d.w * 0.12, 180);
      var lh = lw * (_logo.naturalHeight / _logo.naturalWidth);
      try {
        x2d.drawImage(_logo, d.w - lw - 16, d.h - lh - 16, lw, lh);
      } catch (e) { /* ignore */ }
    }
  }

  NX.RecBrand = { wire: wire, drawCompositeOverlay: drawCompositeOverlay, syncFromDom: syncFromDom };
})();
