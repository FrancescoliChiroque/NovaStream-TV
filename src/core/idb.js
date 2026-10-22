/**
 * Almacen grande (IndexedDB) con respaldo en localStorage.
 * Se usa para catalogos, guia EPG y caches de imagenes, que pueden
 * superar el tamano razonable de localStorage.
 */

var DB_NAME = 'novastream';
var DB_VERSION = 1;
var STORE_NAME = 'cache';

function hasIndexedDB() {
  try {
    return !!(globalThis.indexedDB && globalThis.indexedDB.open);
  } catch (e) {
    return false;
  }
}

function openDatabase() {
  return new Promise(function (resolve, reject) {
    var request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error || new Error('IndexedDB no disponible')); };
  });
}

export function createIdbStore(options) {
  var opts = options || {};
  var name = opts.name || DB_NAME;
  var useIdb = hasIndexedDB();
  var dbPromise = null;

  function getDb() {
    if (!dbPromise) dbPromise = openDatabase().catch(function (err) {
      useIdb = false;
      throw err;
    });
    return dbPromise;
  }

  function memoryFallback() {
    var map = Object.create(null);
    return {
      get: function (key) { return Promise.resolve(map[key]); },
      put: function (key, value) { map[key] = value; return Promise.resolve(value); },
      del: function (key) { delete map[key]; return Promise.resolve(); },
      all: function () { return Promise.resolve(Object.keys(map).map(function (k) { return { key: k, value: map[k] }; })); },
      clear: function () { map = Object.create(null); return Promise.resolve(); }
    };
  }

  var fallback = memoryFallback();

  function run(operation, fallbackCall) {
    if (!useIdb) return fallbackCall();
    return getDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, operation === 'get' ? 'readonly' : 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var request = operation === 'get' ? store.get(fallbackCall.arg)
          : operation === 'put' ? store.put(fallbackCall.arg, fallbackCall.key)
            : operation === 'del' ? store.delete(fallbackCall.key)
              : store.clear();
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
    }).catch(function () {
      useIdb = false;
      return fallbackCall();
    });
  }

  return {
    isPersistent: function () { return useIdb; },
    get: function (key) {
      return run('get', { arg: key }).then(function (value) {
        return value === undefined ? fallback.get(key) : value;
      });
    },
    put: function (key, value) {
      return run('put', { key: key, arg: value }).then(function () {
        return fallback.put(key, value);
      });
    },
    remove: function (key) {
      return run('del', { key: key }).then(function () { return fallback.remove(key); });
    },
    all: function () {
      return run('all', {}).then(function (rows) {
        if (rows && rows.length) return rows;
        return fallback.all();
      });
    },
    clear: function () {
      return run('clear', {}).then(function () { return fallback.clear(); });
    }
  };
}
