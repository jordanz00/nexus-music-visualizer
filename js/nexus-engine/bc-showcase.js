'use strict';
/**
 * 20 curated “showcase” slots — labels map to the closest real MilkDrop preset
 * in the loaded pack by keyword scoring (no invented preset JSON).
 */
(function () {
  var SLOTS = [
    { label: 'Cosmic Tunnel', tokens: ['tunnel', 'worm', 'cosmic', 'space', 'void', 'hole', 'fly'] },
    { label: 'Laser Grid', tokens: ['laser', 'grid', 'line', 'matrix', 'club', 'beam'] },
    { label: 'Liquid Aurora', tokens: ['aurora', 'liquid', 'flow', 'fluid', 'wave', 'smooth'] },
    { label: 'Fractal Flame', tokens: ['fract', 'flame', 'julia', 'mandel', 'iter'] },
    { label: 'Neon Swirl', tokens: ['neon', 'swirl', 'spiral', 'twist', 'vortex', 'color'] },
    { label: 'Galactic Spiral', tokens: ['galax', 'spiral', 'star', 'orbit', 'deep'] },
    { label: 'Pulse Wave', tokens: ['pulse', 'beat', 'kick', 'bass', 'minimal'] },
    { label: 'Chromatic Flow', tokens: ['chroma', 'flow', 'shift', 'gradient', 'hue'] },
    { label: 'Electric Veins', tokens: ['electric', 'vein', 'bolt', 'lightning', 'energy'] },
    { label: 'Afterlife Warp', tokens: ['warp', 'dark', 'cath', 'mono', 'slow', 'cinematic'] },
    { label: 'Rainbow Vortex', tokens: ['rainbow', 'vortex', 'psy', 'trippy', 'spectrum'] },
    { label: 'Pixel Rain', tokens: ['pixel', 'rain', 'drop', 'retro', '8', 'bit'] },
    { label: 'Aurora Beats', tokens: ['aurora', 'chill', 'ambient', 'glow', 'soft'] },
    { label: 'Crystal Tunnel', tokens: ['crystal', 'glass', 'tunnel', 'prism', 'shard'] },
    { label: 'Hypno Grid', tokens: ['hypno', 'grid', 'repeat', 'tile', 'trance'] },
    { label: 'Laser Rain', tokens: ['laser', 'rain', 'streak', 'dram', 'storm'] },
    { label: 'Fluid Geometry', tokens: ['fluid', 'geo', 'shape', 'morph', 'blob'] },
    { label: 'Spectrum Wave', tokens: ['spectrum', 'eq', 'wave', 'freq', 'band'] },
    { label: 'Warp Tunnel', tokens: ['warp', 'tunnel', 'techno', 'drive', 'speed'] },
    { label: 'Mirror Pulse', tokens: ['mirror', 'reflect', 'pulse', 'echo', 'sym'] }
  ];

  function scoreKey(keyLower, tokens) {
    var s = 0;
    for (var t = 0; t < tokens.length; t++) {
      if (keyLower.indexOf(tokens[t]) >= 0) s += 2;
    }
    return s;
  }

  /**
   * @param {string[]} packKeys — from PresetLibrary.getKeys()
   * @returns {{ label: string, key: string }[]}
   */
  function resolve(packKeys) {
    if (!packKeys || !packKeys.length) return [];
    var used = {};
    var out = [];
    for (var i = 0; i < SLOTS.length; i++) {
      var slot = SLOTS[i];
      var bestKey = null;
      var bestScore = -1;
      for (var p = 0; p < packKeys.length; p++) {
        var k = packKeys[p];
        if (used[k]) continue;
        var sc = scoreKey(k.toLowerCase(), slot.tokens);
        if (sc > bestScore) { bestScore = sc; bestKey = k; }
      }
      if (!bestKey || bestScore < 1) {
        for (var q = 0; q < packKeys.length; q++) {
          if (!used[packKeys[q]]) { bestKey = packKeys[q]; break; }
        }
      }
      if (bestKey) used[bestKey] = true;
      out.push({ label: slot.label, key: bestKey || packKeys[i % packKeys.length] });
    }
    return out;
  }

  window.NXBcShowcase = { SLOTS: SLOTS, resolve: resolve };
})();
