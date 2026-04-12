'use strict';
/*  demo-director.js — Choreographed sequences for filming viral clips.
    Trigger via URL param (?demo=drop|festival|genres|ai|resolume|asura_show)
    or from the UI. Automates scene switches, parameter sweeps, beat
    triggers, and camera moves on a precise timeline.                  */

(function () {
  var S = NX.S, P = NX.P;
  var running = false, timeline = null, startT = 0, stepIdx = 0;

  /* ---- Easing ----------------------------------------------------- */
  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function ease(t) { return t * t * (3 - 2 * t); }

  /* ---- Execute a single action ------------------------------------ */
  function exec(action) {
    if (action.scene != null) NX.goNext(action.scene);
    if (action.explode) { S.explode = 0.95; S.beat = 0.72; }
    if (action.palette != null) { P.PAL = action.palette; if (NX.ui) NX.ui.setPalette(action.palette); }
    if (action.speed != null) P.SPD = action.speed;
    if (action.react != null) P.RCT = action.react;
    if (action.warp != null) P.WRP = action.warp;
    if (action.morph != null) S.morphDurationSec = action.morph;
    if (action.quality) NX.setQualityPreset(action.quality);
    if (action.present && NX.ui) NX.ui.togglePresent();
    if (action.autoMorph != null) S.autoMorph = action.autoMorph;
    if (action.beat != null) S.beat = action.beat;
    if (action.postFxAsura != null) S.postFxAsura = Math.max(0, Math.min(1, action.postFxAsura));
    if (action.nexusGodRayMix != null) S.nexusGodRayMix = Math.max(0, Math.min(1, action.nexusGodRayMix));
    if (action.cablesEnabled != null && NX.CablesGuest && typeof NX.CablesGuest.setEnabled === 'function') {
      NX.CablesGuest.setEnabled(!!action.cablesEnabled, { skipPersist: true });
    }
    if (action.cablesOpacity != null && NX.CablesGuest && typeof NX.CablesGuest.setOpacity01 === 'function') {
      NX.CablesGuest.setOpacity01(Math.max(0, Math.min(1, action.cablesOpacity)));
    }
    if (action.fn) action.fn();
    if (NX.ui && NX.ui.syncControls) {
      try {
        NX.ui.syncControls();
      } catch (eSc) { /* ignore */ }
    }
  }

  /* ---- Tick (called from engine loop) ----------------------------- */
  function tick() {
    if (!running || !timeline) return;
    var elapsed = (performance.now() - startT) / 1000;
    while (stepIdx < timeline.length && timeline[stepIdx].t <= elapsed) {
      exec(timeline[stepIdx]);
      stepIdx++;
    }
    if (stepIdx >= timeline.length) { running = false; }
  }

  /* ---- Start a named demo sequence -------------------------------- */
  function play(name) {
    var seq = sequences[name];
    if (!seq) { console.warn('Demo sequence not found:', name); return; }
    /* auto-skip splash + enter present mode */
    var sp = document.getElementById('splash');
    if (sp && sp.style.display !== 'none') { sp.classList.add('out'); sp.style.display = 'none'; }
    if (!S.presentMode && NX.ui) NX.ui.togglePresent();
    S.autoMorph = false;
    timeline = seq; stepIdx = 0; startT = performance.now(); running = true;
    console.log('Demo:', name, '|', seq.length, 'steps');
  }

  function stop() { running = false; }

  /* ==================================================================
     SEQUENCES — each is an array of {t: seconds, ...actions}
     ================================================================== */

  var sequences = {};

  /* ---- 1. THE DROP THAT BREAKS REALITY ----------------------------- */
  sequences.drop = [
    { t: 0,   scene: 12, speed: 1, react: 3, warp: 2, palette: 4, morph: 3.5, quality: 'ultra' },
    { t: 0.5, fn: function () { S.beat = 0; S.explode = 0; } },
    /* slow ambient breathe for 12 seconds */
    { t: 3,   speed: 1.5, warp: 3 },
    { t: 6,   speed: 2, react: 4 },
    { t: 9,   speed: 2.5, react: 5, warp: 4 },
    { t: 10,  speed: 3, react: 6 },
    { t: 11,  speed: 4, react: 7, warp: 5 },
    { t: 11.5, speed: 5, react: 8 },
    /* THE DROP @ 12s */
    { t: 12,  scene: 4, speed: 9, react: 10, warp: 9, palette: 0, morph: 0.6, explode: true },
    { t: 12.3, beat: 1.3, scene: 0 },
    { t: 12.8, explode: true, scene: 13 },
    { t: 13.2, beat: 1.2, scene: 8 },
    { t: 13.8, explode: true, scene: 2 },
    { t: 14.5, scene: 15, beat: 1.4 },
    { t: 15.2, explode: true, scene: 10 },
    { t: 16,  scene: 6, beat: 1.1 },
    { t: 17,  explode: true, scene: 11 },
    { t: 18,  scene: 9, speed: 7, react: 8 },
    /* cool down */
    { t: 20,  speed: 4, react: 6, warp: 5 },
    { t: 23,  speed: 2, react: 4, warp: 3, palette: 4 },
    { t: 26,  scene: 12, speed: 1, react: 3, morph: 3 },
    { t: 30,  autoMorph: true }
  ];

  /* ---- 2. POV: $10M FESTIVAL --------------------------------------- */
  sequences.festival = [
    { t: 0,   scene: 0, speed: 6, react: 8, warp: 7, palette: 0, morph: 1.2, quality: 'ultra' },
    { t: 0.1, autoMorph: false },
    /* tunnel fly */
    { t: 3,   beat: 0.8 },
    { t: 4,   explode: true },
    { t: 5,   scene: 13, beat: 1.0 },
    { t: 7,   explode: true, scene: 15 },
    { t: 9,   scene: 4, beat: 1.2 },
    { t: 10,  explode: true },
    { t: 11,  scene: 10, palette: 1 },
    { t: 13,  explode: true, scene: 8 },
    { t: 15,  scene: 6, beat: 1.3, palette: 3 },
    { t: 17,  explode: true, scene: 11 },
    { t: 19,  scene: 2, palette: 0 },
    { t: 21,  explode: true, scene: 9 },
    { t: 23,  scene: 0, speed: 8, beat: 1.4 },
    { t: 25,  autoMorph: true, morph: 1.0 }
  ];

  /* ---- 3. REACTS TO ANY SONG (rapid genre cuts) -------------------- */
  sequences.genres = [
    { t: 0,   scene: 0, speed: 7, react: 9, warp: 6, palette: 0, morph: 0.7, quality: 'ultra' },
    { t: 0.1, autoMorph: false },
    /* EDM section */
    { t: 1,   scene: 4, explode: true, palette: 0 },
    { t: 2.5, scene: 15, beat: 1.2 },
    { t: 4,   scene: 10, explode: true },
    { t: 5.5, scene: 6, beat: 1.0 },
    /* Hip-hop section */
    { t: 7,   scene: 11, palette: 3, speed: 4, react: 7 },
    { t: 8.5, scene: 8, beat: 0.9 },
    { t: 10,  scene: 2, explode: true },
    { t: 11.5, scene: 13, beat: 1.1 },
    /* Rock section */
    { t: 13,  scene: 9, palette: 1, speed: 8, react: 10, warp: 8 },
    { t: 14.5, scene: 0, explode: true },
    { t: 16,  scene: 4, beat: 1.4 },
    { t: 17.5, scene: 15, explode: true },
    { t: 19,  autoMorph: true }
  ];

  /* ---- 4. AI VISUALS (auto-director showcase) ---------------------- */
  sequences.ai = [
    { t: 0,   scene: 12, speed: 3, react: 6, warp: 4, palette: 4, morph: 2.0, quality: 'ultra' },
    { t: 0.1, autoMorph: true },
    /* let auto-director run; just trigger periodic beats to show reactivity */
    { t: 4,   beat: 1.0 },
    { t: 6,   explode: true },
    { t: 10,  beat: 1.2 },
    { t: 14,  explode: true },
    { t: 18,  beat: 1.0, speed: 6, react: 8 },
    { t: 22,  explode: true },
    { t: 25,  speed: 3, react: 5 },
    { t: 30,  fn: function () { /* end */ } }
  ];

  /* ---- 6. ASURA POST + CABLES GUEST (MFX-style + iframe patch) ----- */
  sequences.asura_show = [
    { t: 0,   scene: 13, speed: 5, react: 8, warp: 6, palette: 0, morph: 1.4, quality: 'balanced', postFxAsura: 0.28, nexusGodRayMix: 0.28 },
    { t: 0.1, autoMorph: false },
    { t: 2,   postFxAsura: 0.52, nexusGodRayMix: 0.38, beat: 0.85 },
    { t: 4,   cablesEnabled: true, cablesOpacity: 0.42, explode: true },
    { t: 6,   postFxAsura: 0.68, scene: 4, beat: 1.0 },
    { t: 9,   cablesOpacity: 0.58, scene: 15 },
    { t: 12,  postFxAsura: 0.55, explode: true },
    { t: 15,  cablesOpacity: 0.35, postFxAsura: 0.4 },
    { t: 18,  cablesEnabled: false, postFxAsura: 0.22, nexusGodRayMix: 0.22 },
    { t: 21,  autoMorph: true, morph: 1.8 }
  ];

  /* ---- 5. RESOLUME KILLER (UI showcase) ---------------------------- */
  sequences.resolume = [
    { t: 0,   quality: 'ultra' },
    { t: 0.1, autoMorph: false },
    { t: 0.2, fn: function () { if (S.presentMode && NX.ui) NX.ui.togglePresent(); } },
    /* show UI: cycle through scenes via pads */
    { t: 1,   scene: 0, speed: 5, react: 7, palette: 0 },
    { t: 3,   scene: 4 },
    { t: 5,   scene: 8, palette: 1 },
    { t: 7,   scene: 10, palette: 3, explode: true },
    { t: 9,   scene: 13, palette: 0 },
    { t: 10,  speed: 8, react: 10, warp: 8, explode: true },
    { t: 11,  scene: 15, beat: 1.3 },
    { t: 12,  speed: 3, react: 5, warp: 4 },
    /* enter present mode for clean output */
    { t: 14,  present: true },
    { t: 15,  scene: 11, explode: true },
    { t: 17,  scene: 6, beat: 1.0 },
    { t: 19,  scene: 2, palette: 5 },
    { t: 21,  autoMorph: true }
  ];

  /* ---- URL param auto-start --------------------------------------- */
  function checkURL() {
    var m = location.search.match(/[?&]demo=([^&]+)/);
    if (!m) return;
    var raw = decodeURIComponent(String(m[1]).replace(/\+/g, ' '));
    var key = NX.BootstrapQuery && NX.BootstrapQuery.normalizeDemo ? NX.BootstrapQuery.normalizeDemo(raw) : raw;
    if (!key || !sequences[key]) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS: ignoring unknown or unsafe ?demo=', raw);
      return;
    }
    setTimeout(function () { play(key); }, 500);
  }

  NX.demo = { play: play, stop: stop, tick: tick, checkURL: checkURL, sequences: Object.keys(sequences) };
})();
