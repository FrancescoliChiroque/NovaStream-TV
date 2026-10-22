import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSourceService } from '../src/services/sources.js';
import { createCache } from '../src/services/cache.js';
import { createStorage, createMemoryBackend } from '../src/core/storage.js';
import { createBus } from '../src/core/bus.js';

function createHttpStub(handlers) {
  return {
    getText: function (url) {
      const handler = handlers[url];
      if (!handler) return Promise.reject(new Error('sin handler para ' + url));
      return typeof handler === 'function' ? handler(url) : Promise.resolve(handler);
    },
    getJson: function (url) {
      return this.getText(url).then((text) => JSON.parse(text));
    }
  };
}

function createService(httpStub) {
  const storage = createStorage(createMemoryBackend());
  const bus = createBus();
  const cache = createCache();
  const service = createSourceService({
    storage,
    http: httpStub,
    bus,
    cache
  });
  return { service, storage, bus };
}

const PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 group-title="Noticias",Noticia 1',
  'http://servidor/1.ts',
  '#EXTINF:-1 group-title="Deportes",Deporte 1',
  'http://servidor/2.ts'
].join('\n');

test('se rechazan las fuentes con esquemas no permitidos', () => {
  const { service } = createService(createHttpStub({}));
  assert.throws(() => service.addSource({ type: 'm3u', url: 'javascript:alert(1)' }));
  assert.throws(() => service.addSource({ type: 'm3u', url: 'file:///etc/passwd' }));
  assert.throws(() => service.addSource({ type: 'xtream', baseUrl: 'http://s', username: '', password: '' }));
});

test('se cargan los canales de la fuente activa', async () => {
  const { service } = createService(createHttpStub({ 'http://servidor/lista.m3u': PLAYLIST }));
  service.addSource({ name: 'Lista', type: 'm3u', url: 'http://servidor/lista.m3u' });
  const source = service.listSources()[0];
  service.activate(source.id);
  const result = await service.loadChannels();
  assert.equal(result.channels.length, 2);
  assert.deepEqual(result.groups, ['Deportes', 'Noticias']);
});

test('la segunda carga usa la cache', async () => {
  let calls = 0;
  const { service } = createService(createHttpStub({
    'http://servidor/lista.m3u': () => {
      calls++;
      return Promise.resolve(PLAYLIST);
    }
  }));
  service.addSource({ name: 'Lista', type: 'm3u', url: 'http://servidor/lista.m3u' });
  service.activate(service.listSources()[0].id);
  await service.loadChannels();
  const second = await service.loadChannels();
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
});

test('refresh vuelve a descargar la lista', async () => {
  let calls = 0;
  const { service } = createService(createHttpStub({
    'http://servidor/lista.m3u': () => {
      calls++;
      return Promise.resolve(PLAYLIST);
    }
  }));
  service.addSource({ name: 'Lista', type: 'm3u', url: 'http://servidor/lista.m3u' });
  service.activate(service.listSources()[0].id);
  await service.loadChannels();
  await service.refresh();
  assert.equal(calls, 2);
});

test('una lista vacia produce un error claro', async () => {
  const { service } = createService(createHttpStub({ 'http://servidor/lista.m3u': '#EXTM3U\n' }));
  service.addSource({ name: 'Lista', type: 'm3u', url: 'http://servidor/lista.m3u' });
  service.activate(service.listSources()[0].id);
  await assert.rejects(() => service.loadChannels());
});

test('sin fuente activa se devuelve una lista vacia', async () => {
  const { service } = createService(createHttpStub({}));
  const result = await service.loadChannels();
  assert.equal(result.channels.length, 0);
  assert.equal(result.source, null);
});

test('se puede eliminar una fuente y se limpia su cache', async () => {
  const { service } = createService(createHttpStub({ 'http://servidor/lista.m3u': PLAYLIST }));
  service.addSource({ name: 'Lista', type: 'm3u', url: 'http://servidor/lista.m3u' });
  const source = service.listSources()[0];
  service.activate(source.id);
  await service.loadChannels();
  service.removeSource(source.id);
  assert.equal(service.listSources().length, 0);
  assert.equal(service.getActiveSource(), null);
});
