import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NovaError, ERROR_CODES, toNovaError, userMessage, isNovaError } from '../src/core/errors.js';

test('NovaError expone el mensaje real para la interfaz', () => {
  const err = new NovaError(ERROR_CODES.PARSE, 'La playlist no es texto');
  assert.equal(err.message, 'parse: La playlist no es texto');
  assert.equal(err.detail, 'La playlist no es texto');
  assert.equal(err.code, 'parse');
  assert.equal(isNovaError(err), true);
});

test('NovaError sin detalle tiene un mensaje utilizable', () => {
  const err = new NovaError(ERROR_CODES.NETWORK);
  assert.equal(err.message, 'network');
  assert.equal(err.detail, '');
});

test('toNovaError conserva los NovaError y normaliza los demas', () => {
  const original = new NovaError(ERROR_CODES.TIMEOUT, 'Sin respuesta');
  assert.equal(toNovaError(original), original);
  const normal = toNovaError(new Error('fallo de red'));
  assert.equal(isNovaError(normal), true);
  assert.equal(normal.detail, 'fallo de red');
});

test('userMessage devuelve un texto en español y otro en ingles', () => {
  const err = new NovaError(ERROR_CODES.NETWORK, 'timeout al resolver');
  assert.equal(userMessage(err, 'es').indexOf('Sin conexion') === 0, true);
  assert.equal(userMessage(err, 'en').indexOf('Network error') === 0, true);
});
