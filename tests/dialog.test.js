import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installFakeDom, createKeyEvent } from './fake-dom.js';

installFakeDom();

const { createDialog, isAnyDialogOpen } = await import('../src/ui/components/dialog.js');

function press(dialog, keyCode, target) {
  var event = createKeyEvent('keydown', keyCode, target);
  (target || dialog.element).dispatchEvent(event);
  return event;
}

test('un dialogo abierto queda registrado en la pila de dialogos', function () {
  var dialog = createDialog({ title: 'Prueba', actions: [{ label: 'Aceptar' }] });
  assert.equal(isAnyDialogOpen(), false);
  dialog.open();
  assert.equal(isAnyDialogOpen(), true);
  dialog.close();
  assert.equal(isAnyDialogOpen(), false);
});

test('ENTER ejecuta la accion enfocada', function () {
  var llamadas = [];
  var dialog = createDialog({
    title: 'Prueba',
    actions: [
      { label: 'Aceptar', primary: true, onSelect: function () { llamadas.push('aceptar'); } },
      { label: 'Cancelar', onSelect: function () { llamadas.push('cancelar'); } }
    ]
  });
  dialog.open();
  press(dialog, 13);
  assert.deepEqual(llamadas, ['aceptar']);
  assert.equal(dialog.isOpen(), false, 'el dialogo se cierra tras aceptar');
});

test('las flechas recorren las acciones', function () {
  var llamadas = [];
  var dialog = createDialog({
    title: 'Prueba',
    actions: [
      { label: 'Aceptar', onSelect: function () { llamadas.push('aceptar'); } },
      { label: 'Cancelar', onSelect: function () { llamadas.push('cancelar'); } }
    ]
  });
  dialog.open();
  press(dialog, 39);
  press(dialog, 13);
  assert.deepEqual(llamadas, ['cancelar']);
});

test('una accion puede impedir el cierre', function () {
  var dialog = createDialog({
    title: 'Prueba',
    actions: [{ label: 'Guardar', primary: true, onSelect: function () { return false; } }]
  });
  dialog.open();
  press(dialog, 13);
  assert.equal(dialog.isOpen(), true, 'el dialogo sigue abierto');
  dialog.close();
  assert.equal(isAnyDialogOpen(), false);
});

test('ESC y el boton atras cierran el dialogo', function () {
  var dialog = createDialog({ title: 'Prueba', actions: [{ label: 'Aceptar' }] });
  dialog.open();
  press(dialog, 27);
  assert.equal(dialog.isOpen(), false);

  dialog.open();
  press(dialog, 461);
  assert.equal(dialog.isOpen(), false);
  assert.equal(isAnyDialogOpen(), false);
});

test('con el foco en un campo de texto las teclas las gestiona el campo', function () {
  var llamadas = [];
  var campo = globalThis.document.createElement('input');
  var dialog = createDialog({
    title: 'PIN',
    body: campo,
    actions: [{ label: 'Aceptar', primary: true, onSelect: function () { llamadas.push('aceptar'); } }]
  });
  dialog.open();

  var event = press(dialog, 13, campo);
  assert.equal(event.defaultPrevented, false, 'no se impide la tecleo por defecto');
  assert.deepEqual(llamadas, [], 'ENTER no ejecuta la accion con un campo enfocado');
  assert.equal(dialog.isOpen(), true);

  // Las flechas verticales no las consume el dialogo: las lleva la
  // navegacion espacial (para recorrer los campos del formulario).
  var abajo = press(dialog, 40, campo);
  assert.equal(abajo.defaultPrevented, false, 'la flecha vertical la gestiona el shell');
  assert.equal(dialog.isOpen(), true);
});

test('al abrir un dialogo con campos el foco va al primer campo', function () {
  var campo = globalThis.document.createElement('input');
  var dialog = createDialog({
    title: 'Fuente',
    body: campo,
    actions: [{ label: 'Guardar', primary: true }]
  });
  dialog.open();
  assert.equal(campo.focused, true, 'el campo queda enfocado para escribir');
});

test('setBody adjunta el formulario al dialogo', function () {
  var form = globalThis.document.createElement('div');
  var campo = globalThis.document.createElement('input');
  form.appendChild(campo);
  var dialog = createDialog({ title: 'Anadir fuente', actions: [{ label: 'Guardar' }] });
  dialog.setBody(form);
  dialog.open();

  var box = dialog.element.querySelectorAll('*').filter(function (node) {
    return String(node.className || '').indexOf('dialog') !== -1;
  })[0];
  var found = false;
  box.querySelectorAll('*').forEach(function (node) {
    if (node === campo) found = true;
  });
  assert.equal(found, true, 'el formulario se ve dentro del dialogo');
  assert.equal(campo.focused, true, 'el primer campo queda enfocado');
});
