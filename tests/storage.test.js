import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createStorage,
  createMemoryBackend,
  obfuscateSecret,
  deobfuscateSecret,
  hashPin
} from '../src/core/storage.js';

function newStorage() {
  return createStorage(createMemoryBackend());
}

test('las preferencias por defecto se completan con las guardadas', () => {
  const storage = newStorage();
  const prefs = storage.getPrefs();
  assert.equal(prefs.language, 'es');
  assert.equal(prefs.playerMode, 'native');
  storage.setPrefs({ language: 'en', playerMode: 'mse' });
  const updated = storage.getPrefs();
  assert.equal(updated.language, 'en');
  assert.equal(updated.playerMode, 'mse');
  assert.equal(updated.theme, 'midnight');
});

test('las fuentes se guardan, activan y eliminan', () => {
  const storage = newStorage();
  const source = storage.addSource({ name: 'Mi lista', type: 'm3u', url: 'http://s/l.m3u' });
  assert.equal(storage.getSources().length, 1);
  storage.setActiveSource(source.id);
  assert.equal(storage.getActiveSource().id, source.id);
  storage.removeSource(source.id);
  assert.equal(storage.getSources().length, 0);
  assert.equal(storage.getActiveSource(), null);
});

test('las credenciales no se guardan en claro', () => {
  const storage = newStorage();
  storage.addSource({
    name: 'Xtream',
    type: 'xtream',
    url: 'http://s:8080',
    username: 'usuario',
    password: 'secreto'
  });
  const raw = storage.backend.getItem('nvt_sources');
  assert.equal(raw.indexOf('secreto') >= 0, false);
  assert.equal(raw.indexOf('usuario') >= 0, false);
  const stored = storage.getSources()[0];
  assert.equal(deobfuscateSecret(stored.username), 'usuario');
  assert.equal(deobfuscateSecret(stored.password), 'secreto');
});

test('obfuscateSecret y deobfuscateSecret son inversas', () => {
  assert.equal(deobfuscateSecret(obfuscateSecret('clave con espacios y acentos ñ')), 'clave con espacios y acentos ñ');
  assert.equal(deobfuscateSecret(''), '');
  assert.equal(deobfuscateSecret('sin prefijo'), 'sin prefijo');
});

test('hashPin no es reversible y es estable', () => {
  const hash = hashPin('1234');
  assert.match(hash, /^nvtp\$/);
  assert.equal(hashPin('1234'), hash);
  assert.notEqual(hashPin('1235'), hash);
  assert.equal(hashPin(''), '');
});

test('los favoritos se alternan y se guardan los datos del canal', () => {
  const storage = newStorage();
  const item = { id: 'c1', name: 'Canal 1', group: 'G', logo: 'l', url: 'u', kind: 'live' };
  assert.equal(storage.toggleFavorite(item), true);
  assert.equal(storage.isFavorite('c1'), true);
  assert.equal(storage.getFavorites()[0].name, 'Canal 1');
  assert.equal(storage.toggleFavorite(item), false);
  assert.equal(storage.getFavorites().length, 0);
});

test('el historial no repite elementos y respeta el limite', () => {
  const storage = newStorage();
  storage.pushHistory({ id: 'a', name: 'A' });
  storage.pushHistory({ id: 'b', name: 'B' });
  storage.pushHistory({ id: 'a', name: 'A' });
  const history = storage.getHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].id, 'a');
});

test('clearHistory y clearAll funcionan', () => {
  const storage = newStorage();
  storage.pushHistory({ id: 'a', name: 'A' });
  storage.setPrefs({ language: 'en' });
  storage.clearHistory();
  assert.equal(storage.getHistory().length, 0);
  storage.clearAll();
  assert.equal(storage.getPrefs().language, 'es');
});

test('los datos corruptos se ignoran sin romper la app', () => {
  const backend = createMemoryBackend();
  backend.setItem('nvt_prefs', '{esto no es json');
  backend.setItem('nvt_sources', 'tampoco');
  const storage = createStorage(backend);
  assert.equal(storage.getPrefs().language, 'es');
  assert.deepEqual(storage.getSources(), []);
});
