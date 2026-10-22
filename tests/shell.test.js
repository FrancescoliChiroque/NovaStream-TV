import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installFakeDom, createKeyEvent } from './fake-dom.js';

installFakeDom();

// El enrutador usa el hash de la ventana.
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  writable: true,
  value: { hash: '#/home', href: 'http://localhost/#/home' }
});

const { createShell } = await import('../src/ui/shell.js');
const { createBus } = await import('../src/core/bus.js');

function stub(extra) {
  var base = {
    bus: createBus(),
    storage: {
      getPrefs: () => ({}),
      setPrefs: () => {},
      getSources: () => [],
      getActiveSourceId: () => '',
      getFavorites: () => [],
      getHistory: () => [],
      pushHistory: () => {},
      setLastChannelId: () => {},
      usageBytes: () => 0,
      getParentalGroups: () => []
    },
    sources: {
      listSources: () => [],
      getActiveSource: () => null,
      getState: () => ({ channels: [], groups: [] }),
      refresh: () => Promise.resolve({ channels: [], groups: [] }),
      loadChannels: () => Promise.resolve({ channels: [], groups: [] })
    },
    epg: { current: () => null, next: () => null, isLoaded: () => false },
    catalog: { movies: () => [], series: () => [], search: () => [] },
    player: {
      load: () => Promise.resolve({}),
      play: () => {}, pause: () => {}, stop: () => {}, setVolume: () => {}, getVolume: () => 0, isPlaying: () => false
    },
    proxy: {
      detect: () => Promise.resolve(false),
      available: false,
      checked: true,
      fetchText: null
    },
    http: {
      getText: () => Promise.resolve(''),
      getJson: () => Promise.resolve({}),
      describeMode: () => 'directa',
      probeDevProxy: () => Promise.resolve(false)
    },
    video: globalThis.document.createElement('video')
  };
  return Object.assign(base, extra || {});
}

function campoEnShell(shell) {
  var campo = globalThis.document.createElement('input');
  campo.setAttribute('data-focusable', 'true');
  shell.element.appendChild(campo);
  return campo;
}

test('ENTER sobre un campo de texto abre el teclado en pantalla', function () {
  var shell = createShell(stub());
  var campo = campoEnShell(shell);
  campo.focus();

  var event = createKeyEvent('keydown', 13, campo);
  var handled = shell.handleKey(event);
  assert.equal(handled, true, 'la tecla la consume el shell');
  assert.equal(event.defaultPrevented, true);
  var teclado = shell.element.querySelectorAll('*').filter(function (node) {
    return String(node.className || '').indexOf('keyboard') !== -1;
  })[0];
  assert.equal(teclado.className.indexOf('is-open') !== -1, true, 'el teclado se abre');
});

test('el teclado abierto se cierra con el boton atras', function () {
  var shell = createShell(stub());
  var campo = campoEnShell(shell);
  shell.handleKey(createKeyEvent('keydown', 13, campo));
  var event = createKeyEvent('keydown', 461, campo);
  shell.handleKey(event);
  assert.equal(event.defaultPrevented, true, 'el shell consume la tecla');
});

test('las flechas con un campo enfocado no mueven el foco fuera del campo', function () {
  var shell = createShell(stub());
  var campo = campoEnShell(shell);
  campo.focus();
  var event = createKeyEvent('keydown', 40, campo);
  shell.handleKey(event);
  assert.equal(event.defaultPrevented, false, 'el campo gestiona la flecha');
});

test('el boton atras cierra el reproductor', function () {
  var shell = createShell(stub());
  shell.play({ id: 'c1', name: 'Canal 1', url: 'http://x/stream.m3u8' });
  assert.equal(shell.getOverlay().isOpen(), true, 'el reproductor esta abierto');
  shell.handleKey(createKeyEvent('keydown', 461, null));
  assert.equal(shell.getOverlay().isOpen(), false, 'el reproductor se cierra');
});

test('el boton EXIT tambien cierra el reproductor', function () {
  var shell = createShell(stub());
  shell.play({ id: 'c1', name: 'Canal 1', url: 'http://x/stream.m3u8' });
  shell.handleKey(createKeyEvent('keydown', 10182, null));
  assert.equal(shell.getOverlay().isOpen(), false, 'el reproductor se cierra con EXIT');
});

test('el boton atras lleva a la portada desde otra seccion', function () {
  var shell = createShell(stub());
  shell.start();
  shell.router.navigate('/channels');
  shell.router.resolve();
  assert.equal(shell.router.getCurrent().path, '/channels');
  shell.handleKey(createKeyEvent('keydown', 461, null));
  shell.router.resolve();
  assert.equal(shell.router.getCurrent().path, '/home');
});
