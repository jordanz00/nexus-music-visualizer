'use strict';
/**
 * In-app composition map: taps scroll to integrated sections (clips, effects, cues, clock).
 */
(function () {
  function scrollToPanel(tabId, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (window.NXShell && NXShell.setTab) NXShell.setTab(tabId || 'show');
    setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function init() {
    document.querySelectorAll('[data-nx-compose]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-nx-compose');
        if (t === 'clips') scrollToPanel('show', 'nx-compose-clips');
        else if (t === 'fx') scrollToPanel('show', 'nx-compose-fx');
        else if (t === 'cues') scrollToPanel('show', 'nx-compose-cues');
        else if (t === 'wgpu') scrollToPanel('show', 'nx-compose-wgpu');
        else if (t === 'lights' || t === 'clock') scrollToPanel('show', 'nx-compose-clock');
        else if (t === 'dmx') scrollToPanel('show', 'nx-lighting-deck');
      });
    });
  }

  window.NX = window.NX || {};
  NX.CompositionUI = { init: init };
})();
