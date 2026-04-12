'use strict';
/**
 * nexus-homage-dom-overlays.js — Safe-DOM HUDs for homage packs (CYBR boot, YNI type, MAZE compass, T00 log).
 *
 * WHO THIS IS FOR: operators on MAZE / CYBR / YNI / T00 scenes.
 * WHAT IT DOES: createElement + textContent only for dynamic strings; optional alias allowlist for CYBR.
 * HOW IT CONNECTS: engine calls applyForScene + tick; see HomageBridge for HM uniform sync.
 */
(function () {
  var NX = window.NX || (window.NX = {});

  var root = null;
  var bootPanel = null;
  var ynPanel = null;
  var ynWord = null;
  var mazePanel = null;
  var mazeNeedle = null;
  var mazeMsg = null;
  var t00Panel = null;
  var t00Scroll = null;
  var t00PlainBtn = null;
  var t00Intensity = null;
  var plainAscii = false;
  var t00LineIdx = 0;
  var bootTimer = 0;
  var mazeBlocked = false;
  var lastScene = '';

  var T00_LINES = [
    'Archive layer 00: probe handshake pending.',
    'No route through static; hold position.',
    'Return key rotated; corridor maps to noise.',
    'Dead end logged. Repeat is intentional.',
    'Switch to plain text if readers struggle with width.',
    'Refusal voice (original): this is a rehearsal surface, not a command.',
    'Mic gate closed — silence preserves the frame.'
  ];

  function fw(s) {
    if (plainAscii) return s;
    var out = '';
    var i;
    for (i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch >= '!' && ch <= '~') {
        out += String.fromCharCode(0xff00 + (s.charCodeAt(i) - 0x20));
      } else {
        out += ch;
      }
    }
    return out;
  }

  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'nx-homage-root';
    root.className = 'nx-homage-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  function clearRoot() {
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
    bootPanel = ynPanel = mazePanel = t00Panel = null;
  }

  function hideAll() {
    if (bootTimer) {
      try { window.clearInterval(bootTimer); } catch (eB) { /* ignore */ }
      bootTimer = 0;
    }
    clearRoot();
    mazeBlocked = false;
  }

  function sceneName(idx) {
    return NX.HomageBridge && NX.HomageBridge.sceneNameAt ? String(NX.HomageBridge.sceneNameAt(idx)) : '';
  }

  function up(s) {
    return s.toUpperCase();
  }

  function showBootCYBR() {
    ensureRoot();
    bootPanel = document.createElement('div');
    bootPanel.className = 'nx-homage-boot';
    var pre = document.createElement('pre');
    pre.className = 'nx-homage-boot-pre';
    var lines = [
      'NEXUS_SUBSYSTEM v0 (original boot sequence)',
      'Memory map … synthetic',
      'Raster bridge … idle',
      'Phosphor channel … ready',
      'Tap to skip boot'
    ];
    var i = 0;
    pre.textContent = '';
    bootPanel.appendChild(pre);
    root.appendChild(bootPanel);
    bootPanel.style.pointerEvents = 'auto';
    bootTimer = window.setInterval(function () {
      if (i >= lines.length) {
        window.clearInterval(bootTimer);
        bootTimer = 0;
        if (bootPanel && bootPanel.parentNode) bootPanel.parentNode.removeChild(bootPanel);
        bootPanel = null;
        return;
      }
      pre.textContent = (pre.textContent ? pre.textContent + '\n' : '') + lines[i];
      i++;
    }, 520);
    bootPanel.addEventListener('click', function skip() {
      if (bootTimer) {
        window.clearInterval(bootTimer);
        bootTimer = 0;
      }
      if (bootPanel && bootPanel.parentNode) bootPanel.parentNode.removeChild(bootPanel);
      bootPanel = null;
    }, { once: true });
  }

  function showYNI() {
    ensureRoot();
    ynPanel = document.createElement('div');
    ynPanel.className = 'nx-homage-yni';
    ynWord = document.createElement('div');
    ynWord.className = 'nx-homage-yni-word';
    ynWord.setAttribute('role', 'status');
    ynPanel.appendChild(ynWord);
    root.appendChild(ynPanel);
    var hint = document.createElement('p');
    hint.className = 'nx-homage-hint';
    hint.textContent = 'Tap canvas or use arrow keys to cycle YES / NO / IF.';
    ynPanel.appendChild(hint);
  }

  function ynLabelFromHM() {
    var S = NX.S;
    if (!S || !S.homageHM) return 'YES';
    var st = Math.floor(S.homageHM[0] + 0.001) % 3;
    return st === 0 ? 'YES' : st === 1 ? 'NO' : 'IF';
  }

  function showMazeHud() {
    ensureRoot();
    mazePanel = document.createElement('div');
    mazePanel.className = 'nx-homage-maze';
    mazeNeedle = document.createElement('div');
    mazeNeedle.className = 'nx-homage-compass-needle';
    mazeMsg = document.createElement('div');
    mazeMsg.className = 'nx-homage-maze-msg';
    mazeMsg.textContent = '';
    mazePanel.appendChild(mazeNeedle);
    mazePanel.appendChild(mazeMsg);
    root.appendChild(mazePanel);
  }

  function showT00() {
    ensureRoot();
    t00Panel = document.createElement('div');
    t00Panel.className = 'nx-homage-t00';
    t00Scroll = document.createElement('div');
    t00Scroll.className = 'nx-homage-t00-scroll';
    t00Scroll.setAttribute('role', 'log');
    t00PlainBtn = document.createElement('button');
    t00PlainBtn.type = 'button';
    t00PlainBtn.className = 'nx-homage-plain-btn';
    t00PlainBtn.textContent = 'Plain ASCII';
    t00PlainBtn.addEventListener('click', function () {
      plainAscii = !plainAscii;
      t00PlainBtn.textContent = plainAscii ? 'Fullwidth style' : 'Plain ASCII';
      refreshT00Block();
    });
    var lab = document.createElement('label');
    lab.className = 'nx-homage-int-label';
    lab.textContent = 'Intensity ';
    t00Intensity = document.createElement('input');
    t00Intensity.type = 'range';
    t00Intensity.min = '0';
    t00Intensity.max = '100';
    t00Intensity.value = '40';
    t00Intensity.setAttribute('aria-label', 'T00 glitch intensity cap');
    lab.appendChild(t00Intensity);
    t00Panel.appendChild(t00PlainBtn);
    t00Panel.appendChild(lab);
    t00Panel.appendChild(t00Scroll);
    root.appendChild(t00Panel);
    t00LineIdx = 0;
    refreshT00Block();
  }

  function refreshT00Block() {
    if (!t00Scroll) return;
    while (t00Scroll.firstChild) t00Scroll.removeChild(t00Scroll.firstChild);
    var block = document.createElement('p');
    block.className = 'nx-homage-t00-block';
    var text = T00_LINES[Math.min(t00LineIdx, T00_LINES.length - 1)];
    block.textContent = plainAscii ? text : fw(text);
    t00Scroll.appendChild(block);
  }

  function showCybrLeaderboard() {
    ensureRoot();
    var wrap = document.createElement('div');
    wrap.className = 'nx-homage-cybr-board';
    var title = document.createElement('div');
    title.className = 'nx-homage-board-title';
    title.textContent = 'Signal board (decorative)';
    wrap.appendChild(title);
    var rows = [
      { rank: '01', handle: 'NODE_A', sig: '88' },
      { rank: '02', handle: 'NODE_B', sig: '76' },
      { rank: '03', handle: 'NODE_C', sig: '71' }
    ];
    var i;
    for (i = 0; i < rows.length; i++) {
      var r = document.createElement('div');
      r.className = 'nx-homage-board-row';
      var t1 = document.createElement('span');
      t1.textContent = rows[i].rank;
      var t2 = document.createElement('span');
      t2.textContent = rows[i].handle;
      var t3 = document.createElement('span');
      t3.textContent = rows[i].sig;
      r.appendChild(t1);
      r.appendChild(t2);
      r.appendChild(t3);
      wrap.appendChild(r);
    }
    var aliasLab = document.createElement('label');
    aliasLab.className = 'nx-homage-alias-lab';
    aliasLab.textContent = 'Local alias (optional, a-z 0-9 _ - max 12): ';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 12;
    inp.className = 'nx-homage-alias-inp';
    inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('change', function () {
      var raw = String(inp.value || '');
      var ok = /^[a-zA-Z0-9_-]{0,12}$/.test(raw);
      if (!ok) {
        inp.value = '';
        return;
      }
      try {
        NX.Persist.setItem('nexus.cybr.alias', raw);
      } catch (e0) { /* ignore */ }
    });
    try {
      inp.value = NX.Persist.getItem('nexus.cybr.alias') || '';
    } catch (e1) { /* ignore */ }
    aliasLab.appendChild(inp);
    wrap.appendChild(aliasLab);
    root.appendChild(wrap);
  }

  /**
   * @param {boolean} on
   */
  function setMazeBlocked(on) {
    mazeBlocked = !!on;
    if (mazeMsg && mazeBlocked) {
      mazeMsg.textContent = 'Three.js maze needs desktop + tap for look (pointer lock not used on this device). Shader maze preview continues on #c.';
    }
  }

  /**
   * @param {number} idx
   */
  function applyForScene(idx) {
    var n = sceneName(idx);
    lastScene = n;
    hideAll();
    var u = up(n);
    if (u.indexOf('CYBR') === 0) {
      showBootCYBR();
      if (u.indexOf('TRACE') >= 0) showCybrLeaderboard();
    }
    if (u.indexOf('YNI') === 0) showYNI();
    if (u.indexOf('MAZE') === 0) {
      showMazeHud();
      var S2 = NX.S;
      if (S2 && S2._iosCoarsePointer) setMazeBlocked(true);
      else setMazeBlocked(false);
    }
    if (u.indexOf('T00') === 0) showT00();
  }

  function tick() {
    var u = up(lastScene);
    if (u.indexOf('YNI') === 0 && ynWord) {
      ynWord.textContent = ynLabelFromHM();
    }
    if (u.indexOf('MAZE') === 0 && mazeNeedle && NX.MazeThree && NX.MazeThree.getHudCompassDeg) {
      var deg = NX.MazeThree.getHudCompassDeg();
      if (deg != null) mazeNeedle.style.transform = 'rotate(' + deg + 'deg)';
      if (mazeMsg && NX.MazeThree.isWon && NX.MazeThree.isWon()) {
        mazeMsg.textContent = 'Exit reached — press N for new maze (desktop).';
      } else if (mazeMsg && !mazeBlocked) {
        mazeMsg.textContent = 'WASD move · click canvas to look · Esc exit layer';
      }
    }
    if (u.indexOf('T00') === 0 && t00Scroll) {
      var S = NX.S;
      var drive = S && typeof S._visualDrive === 'number' ? S._visualDrive : 0;
      var wm = S && typeof S.workletRms === 'number' ? S.workletRms : 0;
      if (drive > 0.38 && wm > 0.06 && S.frame % 90 === 0) {
        t00LineIdx = Math.min(t00LineIdx + 1, T00_LINES.length - 1);
        refreshT00Block();
      }
      var cap = 0.2;
      if (t00Intensity) cap = 0.08 + (parseInt(t00Intensity.value, 10) || 0) / 100 * 0.35;
      var rm = false;
      try {
        rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (eR) { /* ignore */ }
      if (rm) cap *= 0.45;
      if (S && typeof S.postFxGlitch === 'number' && S.postFxGlitch > cap) S.postFxGlitch = cap;
    }
  }

  function onKeyNav(e) {
    if (!NX.S || !NX.scenes) return;
    var n = sceneName(NX.S.curS);
    if (up(n).indexOf('YNI') !== 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (NX.S.homageHM) {
        NX.S.homageHM[0] = (Math.floor(NX.S.homageHM[0]) + 1) % 3;
      } else {
        NX.S.homageHM = [1, 0, 0, 0];
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (NX.S.homageHM) {
        NX.S.homageHM[0] = (Math.floor(NX.S.homageHM[0]) + 2) % 3;
      }
      e.preventDefault();
    }
  }

  function init() {
    document.addEventListener('keydown', onKeyNav, false);
  }

  NX.HomageDOM = {
    init: init,
    applyForScene: applyForScene,
    tick: tick,
    setMazeBlocked: setMazeBlocked
  };
})();
