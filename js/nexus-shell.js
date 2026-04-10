'use strict';
/**
 * nexus-shell.js — Mobile-first tab navigation (Live / Audio / Scenes / Aurora / Show / More).
 * Desktop: same routes, horizontal tab bar becomes top-aligned strip inside panel.
 */
(function () {
  var current = 'live';

  function setTab(id) {
    var allowed = { live: 1, audio: 1, scenes: 1, aurora: 1, show: 1, more: 1 };
    if (!allowed[id]) id = 'live';
    current = id;
    document.querySelectorAll('.nx-tab-panel').forEach(function (p) {
      p.classList.toggle('nx-tab-active', p.id === 'nx-tab-' + id);
      p.setAttribute('aria-hidden', p.id === 'nx-tab-' + id ? 'false' : 'true');
    });
    document.querySelectorAll('.nx-tab-btn').forEach(function (b) {
      var on = b.getAttribute('data-tab') === id;
      b.classList.toggle('nx-tab-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.body.classList.remove('nx-shell-live', 'nx-shell-audio', 'nx-shell-scenes', 'nx-shell-aurora', 'nx-shell-show', 'nx-shell-more');
    document.body.classList.add('nx-shell-' + id);
  }

  function init() {
    document.querySelectorAll('.nx-tab-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        if (t) setTab(t);
      });
    });
    setTab('live');
  }

  window.NXShell = { init: init, setTab: setTab, getTab: function () { return current; } };
})();
