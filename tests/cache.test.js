import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCache } from '../src/services/cache.js';

test('la cache guarda y devuelve valores', () => {
  const cache = createCache({ ttl: 1000 });
  cache.set('a', { x: 1 });
  assert.deepEqual(cache.get('a'), { x: 1 });
  assert.equal(cache.has('a'), true);
});

test('la cache caduca segun el TTL', async () => {
  const cache = createCache({ ttl: 20 });
  cache.set('a', 1);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(cache.get('a'), null);
});

test('la cache respeta el limite de entradas', () => {
  const cache = createCache({ maxEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.size(), 2);
  assert.equal(cache.get('a'), null);
  assert.equal(cache.get('c'), 3);
});

test('remove y clear vacian la cache', () => {
  const cache = createCache();
  cache.set('a', 1);
  cache.set('b', 2);
  cache.remove('a');
  assert.equal(cache.has('a'), false);
  cache.clear();
  assert.equal(cache.size(), 0);
});
