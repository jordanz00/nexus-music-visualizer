'use strict';
/**
 * In-app composition map: taps scroll to integrated sections (clips, effects, cues, clock).
 */
(function () {
  function scrollToPanel(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (window.NXShell && NXShell.setTab) NXShell.setTab('show');
    setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function init() {
    document.querySelectorAll('[data-nx-compose]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-nx-compose');
        if (t === 'clips') scrollToPanel('nx-compose-clips');
        else if (t === 'fx') scrollToPanel('nx-compose-fx');
        else if (t === 'cues') scrollToPanel('nx-compose-cues');
        else if (t === 'clock') scrollToPanel('nx-compose-clock');
        else if (t === 'dmx') scrollToPanel('nx-lighting-deck');
        else if (t === 'wgpu') scrollToPanel('nx-compose-wgpu');
      });
    });
  }

  window.NX = window.NX || {};
  NX.CompositionUI = { init: init };
})();
