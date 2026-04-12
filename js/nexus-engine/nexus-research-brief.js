'use strict';
/**
 * nexus-research-brief.js — Structured OSS / WebGPU / demoscene research pointers (not bundled third-party runtimes).
 *
 * WHO THIS IS FOR: operators, onboarding, and future “Research” UI panels.
 * WHAT IT DOES: Exposes read-only metadata + URLs aligned with docs/NEXUS-BROWSER-VIZ-RESEARCH.md.
 * HOW IT CONNECTS: optional `?research=1` logs a one-line index in console after boot; no network I/O.
 */
(function () {
  var NX = window.NX || (window.NX = {});

  var TRACKS = [
    {
      id: 't1',
      title: 'In-browser visuals (2015–2025)',
      summary: 'WebGL era → WebGPU for compute-heavy passes; Hydra, cables.gl, PlayCanvas, showcases; Milkshake as historical note.',
      links: [
        { label: 'Hydra (canonical)', href: 'https://github.com/hydra-synth/hydra' },
        { label: 'Hydra editor/docs', href: 'https://hydra.ojack.xyz/' },
        { label: 'cables.gl', href: 'https://cables.gl/' },
        { label: 'cables audio viz docs', href: 'https://cables.gl/docs/8_audio/2_realtime_visualization/realtime_visualization' },
        { label: 'PlayCanvas engine', href: 'https://github.com/playcanvas/engine' },
        { label: 'WebGPU showcase (Tendrils)', href: 'https://www.webgpu.com/showcase/tendrils-emergent-webgl-particle-visuals/' },
        { label: 'milkshake (historical WebGL Milkdrop-style)', href: 'https://github.com/gattis/milkshake' }
      ]
    },
    {
      id: 't2',
      title: 'Audio-reactive 3D & GPU audio',
      summary: 'OSS Three + Web Audio examples; MangoWave (AGPL, not bundled); three.js webgpu_compute_audio.',
      links: [
        { label: 'r3f-audio-visualizer', href: 'https://github.com/dcyoung/r3f-audio-visualizer' },
        { label: 'kuhung/audiovisualizer', href: 'https://github.com/kuhung/audiovisualizer' },
        { label: 'music-visualisation-3d', href: 'https://github.com/LoanDeveloper/music-visualisation-3d' },
        { label: '3d-audio-visualizer', href: 'https://github.com/Percobain/3d-audio-visualizer' },
        { label: 'MangoWave (AGPL — reference only)', href: 'https://github.com/Louis-Mascari/MangoWave' },
        { label: 'three.js webgpu_compute_audio', href: 'https://threejs.org/examples/webgpu_compute_audio.html' }
      ]
    },
    {
      id: 't3',
      title: 'Shipable OSS shortlist',
      summary: 'Hydra / cables / Butterchurn / optional Three + PlayCanvas guests / WebGPU — governance: prefer canonical Hydra; NEXUS ships Butterchurn.',
      links: [
        { label: 'Butterchurn (shipped)', href: 'https://github.com/jberg/butterchurn' },
        { label: 'PlayCanvas engine (guest ?playcanvas=1)', href: 'https://github.com/playcanvas/engine' },
        { label: 'hydra-synth org', href: 'https://github.com/hydra-synth' }
      ]
    },
    {
      id: 't4',
      title: 'Bad Apple — Sega Mega Drive / Genesis',
      summary: 'FMV-style streaming on tight ROM/VDP; codec + grayscale tradeoffs.',
      links: [
        { label: 'MegaBites overview', href: 'https://megabitesblog.wordpress.com/2014/04/25/bad-apple/' },
        { label: 'AtariAge discussion', href: 'https://forums.atariage.com/topic/205813-badapple-demo-for-sega-megadrive' },
        { label: 'YouTube (reference)', href: 'https://www.youtube.com/watch?v=2vPe452cegU' }
      ]
    },
    {
      id: 't5',
      title: 'Underpowered hardware & demoscene',
      summary: 'Bad Apple C64; size-coding classics; deterministic music clock vs mic FFT layering.',
      links: [
        { label: 'Bad Apple 64 (C64.CH)', href: 'https://c64.ch/productions/7785/Bad_Apple_64' },
        { label: 'Bad Apple 64 (pouët)', href: 'https://www.pouet.net/prod.php?which=63649' },
        { label: 'Bad Apple 64 (CSDb)', href: 'https://csdb.dk/release/?id=131628' },
        { label: 'cnlohr/badderapple', href: 'https://github.com/cnlohr/badderapple' },
        { label: 'Shapeshifter (4k, pouët)', href: 'https://m.pouet.net/prod.php?which=2066' },
        { label: 'Animate (4k, pouët)', href: 'https://www.pouet.net/prod.php?which=2859' },
        { label: 'Heaven (4k, pouët)', href: 'https://www.pouet.net/prod.php?which=1105' }
      ]
    }
  ];

  var TAKEAWAYS = [
    'WebGPU compute + post + instancing + careful mobile fallback — see WgslGraph + VIZ PERF.',
    'OSS gravity: Butterchurn shipped; Hydra / cables / PlayCanvas are references unless explicitly vendored.',
    'Bad Apple–class ideas: compression + streaming + low bpp — inspiration for REC-friendly output, not generative 3D replacement.',
    'Pro reactivity: bands + phase + BPM confidence + crest — ProceduralAudioBus + engine NX.S.'
  ];

  function getTracks() {
    return TRACKS.map(function (t) {
      return { id: t.id, title: t.title, summary: t.summary, links: t.links.slice() };
    });
  }

  function getTakeaways() {
    return TAKEAWAYS.slice();
  }

  function docPath() {
    return 'docs/NEXUS-BROWSER-VIZ-RESEARCH.md';
  }

  function tryConsoleLog() {
    try {
      if (new URLSearchParams(location.search).get('research') !== '1') return;
      if (typeof console === 'undefined' || !console.info) return;
      console.info('[NEXUS] Research brief — open', docPath(), 'or expand Credits → Browser viz research. Tracks:', TRACKS.length);
    } catch (e0) { /* ignore */ }
  }

  NX.ResearchBrief = {
    version: '2026.04.11',
    getTracks: getTracks,
    getTakeaways: getTakeaways,
    docPath: docPath,
    tryConsoleLog: tryConsoleLog
  };
})();
