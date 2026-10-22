import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createHttpClient, createLimiter, requestText, requestJson } from '../src/core/net.js';
import { ERROR_CODES } from '../src/core/errors.js';

const originalFetch = globalThis.fetch;

function response(body, status) {
  return {
    ok: (status || 200) < 300,
    status: status || 200,
    headers: {},
    text: function () { return Promise.resolve(body); }
  };
}

/**
 * Respuesta con streaming, como la que devuelve el navegador (Chromium).
 * body.getReader() existe y entrega el cuerpo troceado: es el caso en el que
 * el primer fragmento no puede perderse.
 */
function streamedResponse(chunks, status) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    ok: (status || 200) < 300,
    status: status || 200,
    headers: {},
    body: {
      getReader: function () {
        return {
          read: function () {
            if (index >= chunks.length) return Promise.resolve({ done: true, value: undefined });
            const value = encoder.encode(chunks[index]);
            index += 1;
            return Promise.resolve({ done: false, value: value });
          },
          cancel: function () { return Promise.resolve(); }
        };
      }
    },
    text: function () { return Promise.resolve(chunks.join('')); }
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('getText devuelve el cuerpo de la respuesta', async () => {
  globalThis.fetch = () => Promise.resolve(response('hola', 200));
  const http = createHttpClient();
  const text = await http.getText('http://servidor/x');
  assert.equal(text, 'hola');
});

test('un error HTTP produce un NovaError con el codigo http', async () => {
  globalThis.fetch = () => Promise.resolve(response('no', 404));
  const http = createHttpClient();
  await assert.rejects(
    () => http.getText('http://servidor/x'),
    (err) => err.code === ERROR_CODES.HTTP && err.httpStatus === 404
  );
});

test('los errores de red se reintentan y acaban en un NovaError', async () => {
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.reject(new TypeError('fallo de red'));
  };
  const http = createHttpClient();
  await assert.rejects(
    () => http.getText('http://servidor/x'),
    (err) => err.code === ERROR_CODES.NETWORK
  );
  assert.equal(calls, 3);
});

test('un timeout se traduce a un NovaError de timeout', async () => {
  globalThis.fetch = () => {
    const error = new Error('abortado');
    error.name = 'AbortError';
    return Promise.reject(error);
  };
  const http = createHttpClient();
  await assert.rejects(
    () => http.getText('http://servidor/x', { retries: 0 }),
    (err) => err.code === ERROR_CODES.TIMEOUT
  );
});

test('se rechaza una respuesta demasiado grande', async () => {
  globalThis.fetch = () => Promise.resolve(response('x'.repeat(5000), 200));
  const http = createHttpClient();
  await assert.rejects(
    () => http.getText('http://servidor/x', { maxBytes: 100, retries: 0 }),
    (err) => err.code === ERROR_CODES.PARSE
  );
});

test('se rechazan las URLs con esquemas no permitidos antes de la peticion', async () => {
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return Promise.resolve(response('x', 200));
  };
  const http = createHttpClient();
  await assert.rejects(() => http.getText('javascript:alert(1)'));
  assert.equal(called, false);
});

test('si la peticion directa falla se usa el proxy del JS service', async () => {
  globalThis.fetch = () => Promise.reject(new TypeError('CORS'));
  let proxyCalls = 0;
  const proxy = {
    available: true,
    fetchText: function () {
      proxyCalls++;
      return Promise.resolve('contenido del proxy');
    }
  };
  const http = createHttpClient({ proxy: proxy });
  const text = await http.getText('http://servidor/x');
  assert.equal(text, 'contenido del proxy');
  assert.equal(proxyCalls, 1);
});

test('con preferProxy se intenta primero el proxy', async () => {
  globalThis.fetch = () => Promise.resolve(response('directo', 200));
  const order = [];
  const proxy = {
    available: true,
    fetchText: function () {
      order.push('proxy');
      return Promise.resolve('proxy');
    }
  };
  const http = createHttpClient({ proxy: proxy, preferProxy: true });
  const text = await http.getText('http://servidor/x');
  assert.equal(text, 'proxy');
  assert.deepEqual(order, ['proxy']);
});

test('el limitador respeta la concurrencia maxima', async () => {
  let active = 0;
  let peak = 0;
  const limit = createLimiter(2);
  const job = () => {
    active++;
    peak = Math.max(peak, active);
    return new Promise((resolve) => setTimeout(() => {
      active--;
      resolve(true);
    }, 10));
  };
  await Promise.all([limit(job), limit(job), limit(job), limit(job)]);
  assert.equal(peak <= 2, true);
});

test('en modo navegador se usa el proxy del servidor de desarrollo', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { protocol: 'http:' };
  const calls = [];
  globalThis.fetch = (url) => {
    calls.push(String(url));
    if (String(url) === '/api/fetch') return Promise.resolve(response('', 400));
    if (String(url).indexOf('/api/fetch?url=') === 0) return Promise.resolve(response('via proxy local', 200));
    return Promise.reject(new TypeError('CORS'));
  };
  try {
    const http = createHttpClient();
    const text = await http.getText('http://servidor/playlist.m3u');
    assert.equal(text, 'via proxy local');
    assert.equal(calls[0], '/api/fetch', 'primero se comprueba si el proxy existe');
    assert.equal(calls[1].indexOf('/api/fetch?url=') === 0, true);
  } finally {
    globalThis.location = originalLocation;
  }
});

test('si el proxy de desarrollo no existe se hace la peticion directa', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { protocol: 'http:' };
  globalThis.fetch = (url) => {
    if (String(url) === '/api/fetch') return Promise.resolve(response('no encontrado', 404));
    return Promise.resolve(response('directo', 200));
  };
  try {
    const http = createHttpClient();
    const text = await http.getText('http://servidor/playlist.m3u');
    assert.equal(text, 'directo');
  } finally {
    globalThis.location = originalLocation;
  }
});

test('el proxy de desarrollo no se usa con origen file://', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { protocol: 'file:' };
  const calls = [];
  globalThis.fetch = (url) => {
    calls.push(String(url));
    return Promise.resolve(response('directo', 200));
  };
  try {
    const http = createHttpClient();
    const text = await http.getText('http://servidor/playlist.m3u');
    assert.equal(text, 'directo');
    assert.equal(calls.length, 1, 'no se consulta el proxy local');
  } finally {
    globalThis.location = originalLocation;
  }
});

test('el modo de red refleja el transporte usado', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { protocol: 'http:' };
  globalThis.fetch = (url) => {
    if (String(url) === '/api/fetch') return Promise.resolve(response('', 400));
    if (String(url).indexOf('/api/fetch?url=') === 0) return Promise.resolve(response('via proxy local', 200));
    return Promise.reject(new TypeError('CORS'));
  };
  try {
    const http = createHttpClient();
    assert.equal(http.getMode(), 'direct');
    assert.equal(http.describeMode(), 'Peticion directa desde el televisor');
    await http.getText('http://servidor/playlist.m3u');
    assert.equal(http.getMode(), 'dev-proxy');
    assert.equal(http.describeMode().indexOf('servidor de desarrollo') !== -1, true);
  } finally {
    globalThis.location = originalLocation;
  }
});

test('probeDevProxy detecta el proxy local y cambia el modo', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { protocol: 'http:' };
  globalThis.fetch = (url) => {
    if (String(url) === '/api/fetch') return Promise.resolve(response('', 400));
    return Promise.resolve(response('ok', 200));
  };
  try {
    const http = createHttpClient();
    const available = await http.probeDevProxy();
    assert.equal(available, true);
    assert.equal(http.getMode(), 'dev-proxy');
  } finally {
    globalThis.location = originalLocation;
  }
});

test('una respuesta por streaming no pierde el primer fragmento', async () => {
  globalThis.fetch = () => Promise.resolve(streamedResponse([
    '#EXTM3U\n',
    '#EXTINF:-1 tvg-id="a",Canal A\n',
    'http://servidor/a.ts\n'
  ]));
  const text = await requestText('http://servidor/playlist.m3u');
  assert.equal(text.indexOf('#EXTM3U') === 0, true, 'no se pierde el inicio');
  assert.equal(text.indexOf('Canal A') !== -1, true);
  assert.equal(text, '#EXTM3U\n#EXTINF:-1 tvg-id="a",Canal A\nhttp://servidor/a.ts\n');
});

test('una respuesta por streaming de un solo fragmento se lee completa', async () => {
  globalThis.fetch = () => Promise.resolve(streamedResponse(['{"ok":true}']));
  const json = await requestJson('http://servidor/datos.json');
  assert.deepEqual(json, { ok: true });
});

test('una respuesta por streaming demasiado grande se rechaza', async () => {
  globalThis.fetch = () => Promise.resolve(streamedResponse(['0123456789', '0123456789']));
  await assert.rejects(
    () => requestText('http://servidor/grande.txt', { maxBytes: 5 }),
    (err) => err.code === 'parse' && err.detail.indexOf('demasiado grande') !== -1
  );
});
