'use strict';
/**
 * nx-persist.js — IndexedDB-backed KV mirror for non-nx_* keys + nx_pro_key.
 * Keys `nx_*` (except Pro unlock) live in NX_Store (DB `nexus`); see nx-store.js.
 */
(function () {
  window.NX = window.NX || {};
  var PRO_EXEMPT = 'nx_pro_key';
  function isNxStoreKey(k) {
    return k && k.startsWith('nx_') && k !== PRO_EXEMPT;
  }
  var DB_NAME = 'nx_engine_persist';
  var DB_VER = 1;
  var STORE = 'kv';
  var db = null;
  var mem = Object.create(null);
  var delQ = Object.create(null);
  var putQ = Object.create(null);
  var flushTimer = null;
  var _initDone = false;
  var _callbacks = [];

  function memKeys() {
    var out = [];
    for (var k in mem) {
      if (Object.prototype.hasOwnProperty.call(mem, k)) out.push(k);
    }
    return out;
  }

  try {
    for (var i = 0; i < localStorage.length; i++) {
      var lk = localStorage.key(i);
      if (!lk) continue;
      /* nx_* (except Pro key) — owned by NX_Store; avoid duplicating in mem. */
      if (isNxStoreKey(lk)) continue;
      mem[lk] = localStorage.getItem(lk);
    }
  } catch (e0) { /* private mode / blocked */ }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushWrites, 48);
  }

  function flushWrites() {
    flushTimer = null;
    if (!db) {
      /* DB not open yet — keep delQ/putQ; reschedule when init completes. */
      return;
    }
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
        if (!Object.prototype.hasOwnProperty.call(mem, k)) continue;
        try { os.put({ k: k, v: String(mem[k]) }); } catch (eP) { /* ignore */ }
      }
    } catch (eTx) { /* ignore */ }
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

  function migrateBurst(done) {
    if (!db) {
      done();
      return;
    }
    try {
      var txw = db.transaction(STORE, 'readwrite');
      var osw = txw.objectStore(STORE);
      var keys = memKeys();
      for (var j = 0; j < keys.length; j++) {
        osw.put({ k: keys[j], v: String(mem[keys[j]]) });
      }
      txw.oncomplete = function () { done(); };
      txw.onerror = function () { done(); };
      txw.onabort = function () { done(); };
    } catch (eW) {
      done();
    }
  }

  /**
   * Open IndexedDB, merge into memory (IDB overwrites mirror), burst-migrate mirror to IDB.
   * @param {function(): void} [callback]
   */
  function openPersistDb() {
    var req;
    try {
      req = indexedDB.open(DB_NAME, DB_VER);
    } catch (eOpen) {
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
            if (!rows[i] || rows[i].k == null) continue;
            var kk = String(rows[i].k);
            if (isNxStoreKey(kk)) continue;
            mem[kk] = rows[i].v == null ? '' : String(rows[i].v);
          }
        };
        tx.oncomplete = function () {
          migrateBurst(runCallbacks);
        };
        tx.onerror = function () { migrateBurst(runCallbacks); };
        tx.onabort = function () { migrateBurst(runCallbacks); };
      } catch (e1) {
        runCallbacks();
      }
    };
  }

  function init(callback) {
    if (typeof callback === 'function') {
      if (_initDone) {
        try { callback(); } catch (e0) { /* ignore */ }
        return;
      }
      _callbacks.push(callback);
    }
    if (_initDone) return;

    function afterNxStore() {
      openPersistDb();
    }
    if (window.NX_Store && typeof NX_Store.init === 'function') {
      NX_Store.init(afterNxStore);
    } else {
      afterNxStore();
    }
  }

  function getItem(key) {
    if (key == null) return null;
    var k = String(key);
    if (isNxStoreKey(k) && window.NX_Store && typeof NX_Store.get === 'function') {
      var sv = NX_Store.get(k);
      return sv == null ? null : sv;
    }
    if (!Object.prototype.hasOwnProperty.call(mem, k)) return null;
    return mem[k];
  }

  function setItem(key, val) {
    if (key == null) return;
    var k = String(key);
    if (isNxStoreKey(k) && window.NX_Store && typeof NX_Store.set === 'function') {
      NX_Store.set(k, val);
      return;
    }
    mem[k] = String(val);
    delete delQ[k];
    putQ[k] = 1;
    if (db) scheduleFlush();
    try {
      localStorage.setItem(k, String(val));
    } catch (eLs) { /* quota / private */ }
  }

  function removeItem(key) {
    if (key == null) return;
    var k = String(key);
    if (isNxStoreKey(k) && window.NX_Store && typeof NX_Store.delete === 'function') {
      NX_Store.delete(k);
      return;
    }
    delete mem[k];
    delete putQ[k];
    delQ[k] = 1;
    if (db) scheduleFlush();
    try {
      localStorage.removeItem(k);
    } catch (eR) { /* ignore */ }
  }

  NX.Persist = {
    init: init,
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem
  };
})();
