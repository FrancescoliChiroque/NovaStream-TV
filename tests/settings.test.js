import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installFakeDom, createKeyEvent } from './fake-dom.js';

installFakeDom();

const { createSettingsView } = await import('../src/ui/views/settings.js');

function makeCtx(overrides) {
  var fuentes = [];
  var prefs = {};
  var avisos = [];
  var ctx = {
    storage: {
      getPrefs: function () { return prefs; },
      setPrefs: function (patch) { Object.assign(prefs, patch); },
      getSources: function () { return fuentes; },
      getFavorites: function () { return []; },
      getHistory: function () { return []; },
      usageBytes: function () { return 0; },
      getParentalGroups: function () { return []; }
    },
    sources: {
      listSources: function () { return fuentes; },
      getActiveSource: function () {
        for (var i = 0; i < fuentes.length; i++) if (fuentes[i].active) return fuentes[i];
        return null;
      },
      addSource: function (config) {
        var record = {
          id: 'src-' + (fuentes.length + 1),
          name: config.name || 'Lista M3U',
          type: config.type || 'm3u',
          url: config.url || config.baseUrl || '',
          epgUrl: config.epgUrl || '',
          username: config.username || '',
          password: config.password || '',
          active: false
        };
        fuentes.push(record);
        if (!fuentes.some(function (f) { return f.active; })) {
          record.active = true;
        }
        return record;
      },
      activate: function (id) {
        fuentes.forEach(function (f) { f.active = f.id === id; });
        return ctx.sources.getActiveSource();
      },
      removeSource: function (id) {
        fuentes = fuentes.filter(function (f) { return f.id !== id; });
        return fuentes;
      },
      loadChannels: function () {
        ctx.cargadas = (ctx.cargadas || 0) + 1;
        return Promise.resolve({ channels: [{ id: 'c1', name: 'Canal 1' }], groups: ['Grupo'] });
      }
    },
    toaster: {
      show: function (message, kind) { avisos.push({ message: message, kind: kind || 'info' }); }
    },
    focusFirstIn: function () {}
  };
  return Object.assign(ctx, overrides || {});
}

function elementsOf(root, className) {
  var found = [];
  (function walk(node) {
    if (String(node.className || '').indexOf(className) !== -1) found.push(node);
    (node.childNodes || []).forEach(walk);
  })(root);
  return found;
}

/** Texto de un nodo y de sus descendientes (el DOM simulado solo guarda el suyo). */
function textOf(node) {
  var text = node.textContent || '';
  (node.childNodes || []).forEach(function (child) { text += ' ' + textOf(child); });
  return text;
}

test('anadir una fuente activa la descarga de la lista', async function () {
  var ctx = makeCtx();
  var view = createSettingsView(ctx);
  view.show();

  // Se abre el formulario de "Anadir fuente".
  var fila = elementsOf(view.element, 'settings__row').filter(function (node) {
    return textOf(node).indexOf('Anadir fuente') !== -1;
  })[0];
  assert.ok(fila, 'existe la fila Anadir fuente');
  fila.dispatchEvent(createKeyEvent('click', 13, fila));

  // Rellena los campos del formulario: nombre y URL.
  var campos = elementsOf(view.element, 'field').filter(function (node) {
    return node.tagName === 'INPUT';
  });
  var nombre = campos.filter(function (node) { return node.getAttribute('placeholder') === 'Nombre'; })[0];
  var url = campos.filter(function (node) { return node.getAttribute('placeholder') === 'http://servidor/plista.m3u'; })[0];
  assert.ok(nombre, 'hay campo de nombre');
  assert.ok(url, 'hay campo de URL');
  nombre.value = 'Demo';
  url.value = 'http://192.168.18.5:3000/demo/demo.m3u';

  // Pulsa "Guardar" en el dialogo.
  var botones = elementsOf(view.element, 'dialog__action');
  var guardar = botones.filter(function (node) { return textOf(node) === 'Guardar'; })[0];
  assert.ok(guardar, 'existe la accion Guardar');
  guardar.dispatchEvent(createKeyEvent('click', 13, guardar));

  await new Promise(function (resolve) { setTimeout(resolve, 10); });
  assert.equal(ctx.cargadas, 1, 'la lista se descarga al anadir la fuente');
});

test('el formulario se abre con los campos visibles', function () {
  var ctx = makeCtx();
  var view = createSettingsView(ctx);
  view.show();
  var fila = elementsOf(view.element, 'settings__row').filter(function (node) {
    return textOf(node).indexOf('Anadir fuente') !== -1;
  })[0];
  fila.dispatchEvent(createKeyEvent('click', 13, fila));

  var etiquetas = elementsOf(view.element, 'form__label').map(function (node) { return textOf(node); });
  assert.equal(etiquetas.indexOf('URL') !== -1, true, 'la etiqueta URL esta visible');
  assert.equal(etiquetas.indexOf('Nombre') !== -1, true, 'la etiqueta Nombre esta visible');
});
