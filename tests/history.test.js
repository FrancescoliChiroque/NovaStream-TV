import { test } from 'node:test';
import assert from 'node:assert/strict';

const { installBackGuard } = await import('../src/platform/history.js');

function fakeWindow() {
  var listeners = {};
  var state = [];
  var win = {
    location: { href: 'http://192.168.18.5:3000/#/channels' },
    history: {
      pushState: function (value, title, url) {
        state.push({ value: value, url: url });
      },
      replaceState: function (value, title, url) {
        state.push({ value: value, url: url, replace: true });
      }
    },
    addEventListener: function (type, handler) {
      (listeners[type] = listeners[type] || []).push(handler);
    },
    removeEventListener: function (type, handler) {
      listeners[type] = (listeners[type] || []).filter(function (fn) { return fn !== handler; });
    },
    dispatch: function (type, event) {
      (listeners[type] || []).forEach(function (fn) { fn(event || {}); });
    },
    states: state
  };
  return win;
}

function withWindow(win, fn) {
  var saved = {
    history: globalThis.history,
    location: globalThis.location,
    addEventListener: globalThis.addEventListener,
    removeEventListener: globalThis.removeEventListener
  };
  globalThis.history = win.history;
  globalThis.location = win.location;
  globalThis.addEventListener = win.addEventListener;
  globalThis.removeEventListener = win.removeEventListener;
  try {
    return fn();
  } finally {
    globalThis.history = saved.history;
    globalThis.location = saved.location;
    globalThis.addEventListener = saved.addEventListener;
    globalThis.removeEventListener = saved.removeEventListener;
  }
}

test('la guarda anade una entrada al historial al instalar', function () {
  var win = fakeWindow();
  withWindow(win, function () {
    installBackGuard(function () {});
  });
  assert.equal(win.states.length, 2, 'replace + push');
  assert.equal(win.states[1].value.novastreamBack, true);
});

test('un popstate llama al manejador de atras', function () {
  var win = fakeWindow();
  var llamadas = 0;
  withWindow(win, function () {
    installBackGuard(function () { llamadas++; });
  });
  win.dispatch('popstate', {});
  assert.equal(llamadas, 1, 'la app recibe el boton atras del navegador');
  assert.equal(win.states.length, 3, 'se vuelve a anadir la entrada');
});

test('si la tecla ya llego a la app no se gestiona dos veces', function () {
  var win = fakeWindow();
  var llamadas = 0;
  withWindow(win, function () {
    installBackGuard(function () { llamadas++; });
  });
  // La app recibio la tecla (keydown) y despues el navegador navega.
  win.dispatch('keydown', { keyCode: 461 });
  win.dispatch('popstate', {});
  assert.equal(llamadas, 0, 'no se duplica la accion');
});

test('al desactivar la guarda ya no se atienden los popstate', function () {
  var win = fakeWindow();
  var llamadas = 0;
  withWindow(win, function () {
    var uninstall = installBackGuard(function () { llamadas++; });
    uninstall();
  });
  win.dispatch('popstate', {});
  assert.equal(llamadas, 0);
});
