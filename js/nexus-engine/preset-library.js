'use strict';
/**
 * Butterchurn preset catalog: official packs expose a class with .getPresets() — NOT a plain object.
 * Merges main + optional Extra / Extra2 / MD1 / NonMinimal / Minimal globals when present.
 */
(function () {
  var raw = null;
  var keys = [];
  var showcase = [];
  var byCategory = { ambient: [], heavy: [], psychedelic: [], glitch: [], other: [] };
  var FAV_KEY = 'nx_bc_favorites';

  function categorize(name) {
    var n = String(name).toLowerCase();
    if (/castle in the air|martin - castle/.test(n)) return 'ambient';
    if (/glitch|noise|static|tv|error|corrupt/.test(n)) return 'glitch';
    if (/bass|kick|storm|war|metal|hard|chaos|rage|pulse/.test(n)) return 'heavy';
    if (/ambient|cloud|dream|slow|space|void|calm|soft|mist/.test(n)) return 'ambient';
    if (/fract|geo|spiral|flux|acid|trip|melt|kaleido|infin/.test(n)) return 'psychedelic';
    return 'other';
  }

  /**
   * npm butterchurn-presets bundles: default export is a class; presets map is getPresets().
   */
  function extractPresetMap(mod) {
    if (!mod) return null;
    var c = mod.default !== undefined ? mod.default : mod;
    if (c && typeof c.getPresets === 'function') {
      try {
        var pmap = c.getPresets();
        return pmap && typeof pmap === 'object' ? pmap : null;
      } catch (e) {
        console.warn('PresetLibrary: getPresets() failed', e.message);
        return null;
      }
    }
    var o = c;
    if (o && o.default && typeof o.default === 'object' && !o.baseVals) o = o.default;
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  }

  function mergeMaps(target, source) {
    if (!source) return;
    Object.keys(source).forEach(function (k) {
      target[k] = source[k];
    });
  }

  function loadFromGlobal() {
    var merged = {};
    var prioritySources = [
      typeof butterchurnPresets !== 'undefined' ? butterchurnPresets : null,
      typeof butterchurnPresetsNonMinimal !== 'undefined' ? butterchurnPresetsNonMinimal : null,
      typeof butterchurnPresetsExtra !== 'undefined' ? butterchurnPresetsExtra : null,
      typeof butterchurnPresetsExtra2 !== 'undefined' ? butterchurnPresetsExtra2 : null,
      typeof butterchurnPresetsMD1 !== 'undefined' ? butterchurnPresetsMD1 : null
    ];
    for (var i = 0; i < prioritySources.length; i++) {
      var map = extractPresetMap(prioritySources[i]);
      if (map) mergeMaps(merged, map);
    }
    if (!Object.keys(merged).length) {
      var minMap = extractPresetMap(typeof butterchurnPresetsMinimal !== 'undefined' ? butterchurnPresetsMinimal : null);
      if (minMap) mergeMaps(merged, minMap);
    }
    if (!Object.keys(merged).length) return false;
    raw = merged;
    keys = Object.keys(raw).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    byCategory = { ambient: [], heavy: [], psychedelic: [], glitch: [], other: [] };
    keys.forEach(function (k) {
      var cat = categorize(k);
      (byCategory[cat] || byCategory.other).push(k);
    });
    showcase = [];
    if (window.NXBcShowcase && typeof NXBcShowcase.resolve === 'function') {
      showcase = NXBcShowcase.resolve(keys);
    }
    var label = (typeof window !== 'undefined' && window.NexusBrand && window.NexusBrand.spectrumShortName) ? window.NexusBrand.spectrumShortName : 'Aurora';
    console.log('PresetLibrary: ' + keys.length + ' MilkDrop-format presets (' + label + ' / Butterchurn)');
    return true;
  }

  function getShowcase() {
    return showcase.slice();
  }

  function getPreset(name) {
    if (!raw || !raw[name]) return null;
    return raw[name];
  }

  function getFavorites() {
    try {
      var j = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return Array.isArray(j) ? j : [];
    } catch (e) { return []; }
  }

  function toggleFavorite(name) {
    var f = getFavorites();
    var i = f.indexOf(name);
    if (i >= 0) f.splice(i, 1); else f.push(name);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch (e) { }
    return f;
  }

  NX.PresetLibrary = {
    loadFromGlobal: loadFromGlobal,
    getKeys: function () { return keys.slice(); },
    getRaw: function () { return raw; },
    getShowcase: getShowcase,
    byCategory: byCategory,
    getPreset: getPreset,
    categorize: categorize,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite
  };
})();
