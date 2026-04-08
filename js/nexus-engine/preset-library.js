'use strict';
/**
 * Butterchurn preset catalog: load minimal pack, bucket by name heuristics, favorites in localStorage.
 */
(function () {
  var raw = null;
  var keys = [];
  var byCategory = { ambient: [], heavy: [], psychedelic: [], glitch: [], other: [] };
  var FAV_KEY = 'nx_bc_favorites';

  function categorize(name) {
    var n = String(name).toLowerCase();
    if (/glitch|noise|static|tv|error|corrupt/.test(n)) return 'glitch';
    if (/bass|kick|storm|war|metal|hard|chaos|rage|pulse/.test(n)) return 'heavy';
    if (/ambient|cloud|dream|slow|space|void|calm|soft|mist/.test(n)) return 'ambient';
    if (/fract|geo|spiral|flux|acid|trip|melt|kaleido|infin/.test(n)) return 'psychedelic';
    return 'other';
  }

  function loadFromGlobal() {
    var mod = typeof butterchurnPresetsMinimal !== 'undefined' ? butterchurnPresetsMinimal : null;
    if (!mod) return false;
    raw = mod.default || mod;
    if (raw && raw.default && typeof raw.default === 'object' && !raw.baseVals) raw = raw.default;
    if (!raw || typeof raw !== 'object') return false;
    keys = Object.keys(raw).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    byCategory = { ambient: [], heavy: [], psychedelic: [], glitch: [], other: [] };
    keys.forEach(function (k) {
      var cat = categorize(k);
      (byCategory[cat] || byCategory.other).push(k);
    });
    return true;
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
    byCategory: byCategory,
    getPreset: getPreset,
    categorize: categorize,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite
  };
})();
