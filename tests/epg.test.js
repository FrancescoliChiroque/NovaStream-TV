import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEpgService } from '../src/services/epg.js';
import { createCache } from '../src/services/cache.js';
import { createBus } from '../src/core/bus.js';

const XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="canal1"><display-name>Canal Uno</display-name></channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="canal1">
    <title>Noticias</title>
  </programme>
</tv>`;

function createService(text) {
  const http = {
    getText: function () {
      if (text instanceof Error) return Promise.reject(text);
      return Promise.resolve(text);
    },
    getJson: function () { return Promise.reject(new Error('no usado')); }
  };
  return createEpgService({ http, bus: createBus(), cache: createCache(), idb: null });
}

test('la guia se carga e indexa por canal', async () => {
  const service = createService(XMLTV);
  const result = await service.load('http://servidor/epg.xml');
  assert.equal(result.channels, 1);
  assert.equal(service.isLoaded(), true);
});

test('se encuentra el programa en curso por tvg-id', async () => {
  const service = createService(XMLTV);
  await service.load('http://servidor/epg.xml');
  const channel = { id: 'ch:1', tvgId: 'canal1', name: 'Canal Uno' };
  const now = Date.UTC(2024, 0, 1, 12, 30, 0);
  const current = service.current(channel, now);
  assert.equal(current.title, 'Noticias');
});

test('no hay programa en curso fuera del horario', async () => {
  const service = createService(XMLTV);
  await service.load('http://servidor/epg.xml');
  const channel = { id: 'ch:1', tvgId: 'canal1' };
  assert.equal(service.current(channel, Date.UTC(2030, 0, 1)), null);
});

test('una segunda carga usa la cache', async () => {
  let calls = 0;
  const http = {
    getText: function () {
      calls++;
      return Promise.resolve(XMLTV);
    }
  };
  const service = createEpgService({ http, bus: createBus(), cache: createCache(), idb: null });
  await service.load('http://servidor/epg.xml');
  await service.load('http://servidor/epg.xml');
  assert.equal(calls, 1);
});

test('un fallo de descarga se propaga como error', async () => {
  const service = createService(new Error('sin red'));
  await assert.rejects(() => service.load('http://servidor/epg.xml'));
});

test('se rechazan las URLs no permitidas', async () => {
  const service = createService(XMLTV);
  await assert.rejects(() => service.load('javascript:alert(1)'));
});
