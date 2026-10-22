import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactUrl, redactText, dumpLogs, logger } from '../src/core/logger.js';

test('redactUrl elimina credenciales embebidas', () => {
  assert.equal(redactUrl('http://user:pass@host/x'), 'http://host/x');
  assert.equal(redactUrl('https://u:p@h:8080/x'), 'https://h:8080/x');
});

test('redactUrl oculta parametros sensibles', () => {
  const redacted = redactUrl('http://host/x?action=get_live&username=juan&password=secreto');
  assert.equal(redacted.indexOf('secreto') >= 0, false);
  assert.equal(redacted.indexOf('username=juan') >= 0, false);
  assert.equal(redacted.indexOf('action=get_live') >= 0, true);
});

test('redactText oculta credenciales en texto', () => {
  assert.equal(redactText('http://user:pass@host/x'), 'http://host/x');
  assert.equal(redactText('password=secreto'), 'password=***');
  assert.equal(redactText('username=juan'), 'username=***');
  assert.equal(
    redactText('http://host/getlive/juan/secreto/123.ts'),
    'http://host/getlive/***/***/123.ts'
  );
});

test('el log se puede volcar para el diagnostico', () => {
  logger.clear();
  logger.warn('mensaje de prueba con password=secreto');
  const dump = dumpLogs();
  assert.match(dump, /mensaje de prueba/);
  assert.equal(dump.indexOf('secreto') >= 0, false);
});
