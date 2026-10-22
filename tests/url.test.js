import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertSafeUrl, isSafeUrl, joinUrl, buildQuery, looksLikeHls } from '../src/core/url.js';

test('assertSafeUrl acepta http y https', () => {
  assert.equal(assertSafeUrl('http://servidor/lista.m3u'), 'http://servidor/lista.m3u');
  assert.equal(assertSafeUrl('https://servidor/lista.m3u'), 'https://servidor/lista.m3u');
});

test('assertSafeUrl rechaza esquemas peligrosos', () => {
  assert.throws(() => assertSafeUrl('javascript:alert(1)'));
  assert.throws(() => assertSafeUrl('file:///etc/passwd'));
  assert.throws(() => assertSafeUrl('data:text/html;base64,AAAA'));
  assert.throws(() => assertSafeUrl(''));
  assert.throws(() => assertSafeUrl(null));
});

test('assertSafeUrl rechaza credenciales embebidas salvo que se permitan', () => {
  assert.throws(() => assertSafeUrl('http://user:pass@servidor/x'));
  assert.doesNotThrow(() => assertSafeUrl('http://user:pass@servidor/x', { allowCredentials: true }));
});

test('isSafeUrl no lanza excepciones', () => {
  assert.equal(isSafeUrl('http://ok/x'), true);
  assert.equal(isSafeUrl('javascript:x'), false);
});

test('joinUrl une sin duplicar barras', () => {
  assert.equal(joinUrl('http://s/', 'a/b'), 'http://s/a/b');
  assert.equal(joinUrl('http://s', '/a/b'), 'http://s/a/b');
  assert.equal(joinUrl('http://s', 'a/b'), 'http://s/a/b');
  assert.equal(joinUrl('http://s', 'http://otro/x'), 'http://otro/x');
  assert.equal(joinUrl('', 'x'), 'x');
});

test('buildQuery omite vacios y codifica', () => {
  assert.equal(buildQuery({ a: 1, b: '', c: null, d: undefined, e: 'x y' }), 'a=1&e=x%20y');
});

test('looksLikeHls detecta playlists m3u8', () => {
  assert.equal(looksLikeHls('http://s/live.m3u8'), true);
  assert.equal(looksLikeHls('http://s/live.m3u8?token=1'), true);
  assert.equal(looksLikeHls('http://s/live.ts'), false);
});
