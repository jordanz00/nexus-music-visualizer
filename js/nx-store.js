'use strict';
/**
 * nx-store.js — IndexedDB-backed KV for nx_* user data (presets, MIDI, session, etc.).
 *
 * WHO THIS IS FOR: NEXUS app code that needs sync reads in rAF and async durable writes.
 * WHAT IT DOES: Mirrors string values in _cache; persists to DB `nexus` / store `kv`.
 * HOW IT CONNECTS: Loaded before nx-persist.js; nx-persist delegates nx_* keys (except nx_pro_key).
 *
 * Pro unlock `nx_pro_key` stays on NX.Persist / localStorage only (read-once, tiny).
 */
(function () {
  var DB_NAME = 'nexus';
  var DB_VER = 1;
  var STORE = 'kv';
  var PRO_EXEMPT = 'nx_pro_key';

  var _cache = Object.create(null);
  var db = null;
  var putQ = Object.create(null);
  var delQ = Object.create(null);
  var flushTimer = null;
  var _initDone = false;
  var _callbacks = [];

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushWrites, 48);
  }

  function flushWrites() {
    flushTimer = null;
    if (!db) return;
    var dels = Object.keys(delQ);
    var puts = Object.keys(putQ);
    delQ = Object.create(null);
    putQ = Object.create(null);
    if (!dels.length && !puts.length) return;
    try {
      var tx = db.transaction(STORE, 'readwrite');
      var os = tx.objectStore(STORE);
      for (var i = 0; i < dels.length; i++) {
        try { os.delete(dels[i]); } catch (eD) { /* ignore */ }
      }
      for (var j = 0; j < puts.length; j++) {
        var k = puts[j];
        if (!Object.prototype.hasOwnProperty.call(_cache, k)) continue;
        try { os.put({ k: k, v: String(_cache[k]) }); } catch (eP) { /* ignore */ }
      }
    } catch (eTx) { /* ignore */ }
  }

  function seedFromLocalStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var lk = localStorage.key(i);
        if (!lk || lk === PRO_EXEMPT || !lk.startsWith('nx_')) continue;
        _cache[lk] = localStorage.getItem(lk);
      }
    } catch (e0) { /* private mode */ }
  }

  function mergeLegacyIndexedDb(done) {
    var req;
    try {
      req = indexedDB.open('nx_engine_persist', 1);
    } catch (eOpen) {
      done();
      return;
    }
    req.onerror = function () { done(); };
    req.onsuccess = function (ev) {
      var ldb = ev.target.result;
      try {
        if (!ldb.objectStoreNames.contains(STORE)) {
          ldb.close();
          done();
          return;
        }
        var tx = ldb.transaction(STORE, 'readonly');
        var os = tx.objectStore(STORE);
        var g = os.getAll();
        g.onsuccess = function () {
          var rows = g.result || [];
          for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (!row || row.k == null) continue;
            var k = String(row.k);
            if (k === PRO_EXEMPT || !k.startsWith('nx_')) continue;
            if (!Object.prototype.hasOwnProperty.call(_cache, k)) {
              _cache[k] = row.v == null ? '' : String(row.v);
            }
          }
        };
        tx.oncomplete = function () {
          try { ldb.close(); } catch (eC) { /* ignore */ }
          done();
        };
        tx.onerror = function () {
          try { ldb.close(); } catch (eE) { /* ignore */ }
          done();
        };
        tx.onabort = function () {
          try { ldb.close(); } catch (eA) { /* ignore */ }
          done();
        };
      } catch (e1) {
        try { ldb.close(); } catch (e2) { /* ignore */ }
        done();
      }
    };
  }

  function burstPersistAll(done) {
    if (!db) {
      done();
      return;
    }
    try {
      var keys = Object.keys(_cache);
      var txw = db.transaction(STORE, 'readwrite');
      var osw = txw.objectStore(STORE);
      for (var j = 0; j < keys.length; j++) {
        var kk = keys[j];
        if (kk === PRO_EXEMPT || !kk.startsWith('nx_')) continue;
        try { osw.put({ k: kk, v: String(_cache[kk]) }); } catch (eW) { /* ignore */ }
      }
      txw.oncomplete = function () { done(); };
      txw.onerror = function () { done(); };
      txw.onabort = function () { done(); };
    } catch (eB) {
      done();
    }
  }

  function runCallbacks() {
    _initDone = true;
    var cbs = _callbacks.slice();
    _callbacks.length = 0;
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](); } catch (eC) { /* ignore */ }
    }
    if (db && (Object.keys(putQ).length || Object.keys(delQ).length)) {
      flushTimer = null;
      flushWrites();
    }
  }

  /**
   * Open IndexedDB `nexus`, merge on-disk KV into _cache, pull one-time legacy nx_* from nx_engine_persist.
   * @param {function(): void} [callback]
   */
  function init(callback) {
    if (typeof callback === 'function') {
      if (_initDone) {
        try { callback(); } catch (e0) { /* ignore */ }
        return;
      }
      _callbacks.push(callback);
    }
    if (_initDone) return;

    seedFromLocalStorage();

    var req;
    try {
      req = indexedDB.open(DB_NAME, DB_VER);
    } catch (eOpen2) {
      runCallbacks();
      return;
    }

    req.onupgradeneeded = function (ev) {
      var d = ev.target.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'k' });
    };

    req.onerror = function () {
      runCallbacks();
    };

    req.onsuccess = function (ev) {
      db = ev.target.result;
      try {
        var tx = db.transaction(STORE, 'readonly');
        var os = tx.objectStore(STORE);
        var g = os.getAll();
        g.onsuccess = function () {
          var rows = g.result || [];
          for (var i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].k != null) {
              var kk = String(rows[i].k);
              if (kk === PRO_EXEMPT || !kk.startsWith('nx_')) continue;
              _cache[kk] = rows[i].v == null ? '' : String(rows[i].v);
            }
          }
        };
        tx.oncomplete = function () {
          seedFromLocalStorage();
          mergeLegacyIndexedDb(function () {
            burstPersistAll(runCallbacks);
          });
        };
        tx.onerror = function () {
          mergeLegacyIndexedDb(function () {
            burstPersistAll(runCallbacks);
          });
        };
        tx.onabort = function () {
          mergeLegacyIndexedDb(function () {
            burstPersistAll(runCallbacks);
          });
        };
      } catch (e1) {
        mergeLegacyIndexedDb(function () {
          burstPersistAll(runCallbacks);
        });
      }
    };
  }

  function mirrorLocal(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (eLs) { /* quota / private */ }
  }

  function clearLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (eR) { /* ignore */ }
  }

  function assertNxKey(key) {
    var k = String(key);
    if (k === PRO_EXEMPT) throw new Error('NX_Store: use NX.Persist for nx_pro_key');
    if (!k.startsWith('nx_')) throw new Error('NX_Store: key must start with nx_');
    return k;
  }

  window.NX_Store = {
    _cache: _cache,

    init: init,

    get: function (key) {
      if (key == null) return undefined;
      var k = String(key);
      if (!k.startsWith('nx_') || k === PRO_EXEMPT) return undefined;
      if (!Object.prototype.hasOwnProperty.call(_cache, k)) return undefined;
      return _cache[k];
    },

    set: function (key, val) {
      var k = assertNxKey(key);
      _cache[k] = String(val);
      delete delQ[k];
      putQ[k] = 1;
      mirrorLocal(k, _cache[k]);
      if (db) scheduleFlush();
      return Promise.resolve();
    },

    delete: function (key) {
      var k = assertNxKey(key);
      delete _cache[k];
      delete putQ[k];
      delQ[k] = 1;
      clearLocal(k);
      if (db) scheduleFlush();
      return Promise.resolve();
    },

    list: function (prefix) {
      var p = prefix == null ? '' : String(prefix);
      var out = [];
      for (var key in _cache) {
        if (!Object.prototype.hasOwnProperty.call(_cache, key)) continue;
        if (key.startsWith(p)) out.push(key);
      }
      return Promise.resolve(out.sort());
    }
  };
})();
