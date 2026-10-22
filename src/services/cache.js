/**
 * Cache en memoria con caducidad (TTL) y limite de entradas.
 * Evita volver a descargar la misma playlist o guia en cada cambio de
 * pantalla. La persistencia en disco se deja en IndexedDB (core/idb.js).
 */

export function createCache(options) {
  var opts = options || {};
  var ttl = opts.ttl || 30 * 60 * 1000;
  var maxEntries = opts.maxEntries || 20;
  var store = Object.create(null);
  var order = [];

  function evict() {
    while (order.length > maxEntries) {
      var oldest = order.shift();
      delete store[oldest];
    }
  }

  return {
    get: function (key) {
      var entry = store[key];
      if (!entry) return null;
      if (entry.expires && entry.expires < Date.now()) {
        delete store[key];
        var idx = order.indexOf(key);
        if (idx >= 0) order.splice(idx, 1);
        return null;
      }
      return entry.value;
    },
    set: function (key, value, customTtl) {
      if (!Object.prototype.hasOwnProperty.call(store, key)) order.push(key);
      store[key] = {
        value: value,
        expires: Date.now() + (typeof customTtl === 'number' ? customTtl : ttl)
      };
      evict();
      return value;
    },
    has: function (key) { return this.get(key) !== null; },
    remove: function (key) {
      delete store[key];
      var idx = order.indexOf(key);
      if (idx >= 0) order.splice(idx, 1);
    },
    clear: function () {
      store = Object.create(null);
      order = [];
    },
    size: function () { return order.length; },
    keys: function () { return order.slice(); }
  };
}
