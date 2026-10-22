/**
 * Bus de eventos minimalista (sin dependencias).
 * Permite desacoplar UI, servicios y almacenamiento.
 */

export function createBus() {
  var handlers = Object.create(null);

  function on(eventName, handler) {
    if (!handlers[eventName]) handlers[eventName] = [];
    handlers[eventName].push(handler);
    return function off() {
      var list = handlers[eventName] || [];
      var idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  function once(eventName, handler) {
    var off = on(eventName, function (payload) {
      off();
      handler(payload);
    });
    return off;
  }

  function off(eventName, handler) {
    var list = handlers[eventName];
    if (!list) return;
    if (!handler) {
      delete handlers[eventName];
      return;
    }
    var idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
  }

  function emit(eventName, payload) {
    var list = handlers[eventName];
    if (!list || !list.length) return;
    var copy = list.slice();
    for (var i = 0; i < copy.length; i++) {
      try {
        copy[i](payload);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[bus] error en handler de "' + eventName + '"', err);
        }
      }
    }
  }

  function clear() {
    handlers = Object.create(null);
  }

  return { on: on, once: once, off: off, emit: emit, clear: clear };
}
