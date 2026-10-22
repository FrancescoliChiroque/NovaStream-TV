import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installFakeDom, createKeyEvent } from './fake-dom.js';

installFakeDom();

const { createKeyboard } = await import('../src/ui/components/keyboard.js');

function makeField(value) {
  var field = globalThis.document.createElement('input');
  field.value = value || '';
  field.setAttribute = field.setAttribute || function () {};
  field.focus = function () { this.focused = true; };
  return field;
}

function keysOf(keyboard) {
  return keyboard.element.querySelectorAll('button');
}

function clickKey(keyboard, text) {
  var buttons = keysOf(keyboard);
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].textContent === text) {
      buttons[i].dispatchEvent(createKeyEvent('click', 13, buttons[i]));
      return true;
    }
  }
  return false;
}

test('el teclado escribe en el campo de destino', function () {
  var field = makeField('');
  var keyboard = createKeyboard();
  keyboard.open(field);
  assert.equal(keyboard.isOpen(), true);
  clickKey(keyboard, 'a');
  clickKey(keyboard, 'b');
  assert.equal(field.value, 'ab');
});

test('la tecla MAYUS escribe en mayusculas', function () {
  var field = makeField('');
  var keyboard = createKeyboard();
  keyboard.open(field);
  clickKey(keyboard, 'MAYÚS');
  // Con MAYUS activa las teclas se muestran en mayusculas.
  clickKey(keyboard, 'A');
  assert.equal(field.value, 'A');
});

test('la capa de numeros escribe digitos y simbolos', function () {
  var field = makeField('');
  var keyboard = createKeyboard();
  keyboard.open(field);
  clickKey(keyboard, '123');
  clickKey(keyboard, '7');
  assert.equal(field.value, '7');
});

test('ESPACIO y BORRAR funcionan', function () {
  var field = makeField('ab');
  var keyboard = createKeyboard();
  keyboard.open(field);
  clickKey(keyboard, 'ESPACIO');
  assert.equal(field.value, 'ab ');
  clickKey(keyboard, 'BORRAR');
  assert.equal(field.value, 'ab');
});

test('el texto se inserta al final del campo', function () {
  var field = makeField('ab');
  var keyboard = createKeyboard();
  keyboard.open(field);
  clickKey(keyboard, 'x');
  assert.equal(field.value, 'abx');
});

test('OK cierra el teclado y devuelve el valor', function () {
  var field = makeField('hola');
  var recibido = null;
  var keyboard = createKeyboard({
    onAccept: function (value) { recibido = value; }
  });
  keyboard.open(field);
  clickKey(keyboard, 'OK');
  assert.equal(keyboard.isOpen(), false);
  assert.equal(recibido, 'hola');
});

test('CANCELAR cierra el teclado sin devolver el valor', function () {
  var field = makeField('hola');
  var recibido = null;
  var keyboard = createKeyboard({
    onAccept: function (value) { recibido = value; }
  });
  keyboard.open(field);
  clickKey(keyboard, 'CANCELAR');
  assert.equal(keyboard.isOpen(), false);
  assert.equal(recibido, null);
});

test('el boton atras cierra el teclado sin confirmar', function () {
  var field = makeField('hola');
  var recibido = null;
  var keyboard = createKeyboard({
    onAccept: function (value) { recibido = value; }
  });
  keyboard.open(field);
  var event = createKeyEvent('keydown', 461, null);
  assert.equal(keyboard.handleKey(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(keyboard.isOpen(), false);
  assert.equal(recibido, null);
});

test('al abrir se muestra el valor actual del campo', function () {
  var field = makeField('texto previo');
  var keyboard = createKeyboard();
  keyboard.open(field);
  var preview = keyboard.element.querySelectorAll('*').filter(function (node) {
    return node.className.indexOf('keyboard__preview') !== -1;
  })[0];
  assert.equal(preview.textContent, 'texto previo');
});
