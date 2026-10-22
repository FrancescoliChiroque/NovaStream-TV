import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayer, createNativeAdapter } from '../src/player/player.js';
import { createBus } from '../src/core/bus.js';
import { ERROR_CODES } from '../src/core/errors.js';

/** Elemento <video> simulado con el comportamiento que necesita el adaptador. */
class FakeVideo {
  constructor(options) {
    const opts = options || {};
    this.listeners = Object.create(null);
    this.readyState = opts.readyState === undefined ? 3 : opts.readyState;
    this.paused = true;
    this.currentTime = 0;
    this.duration = opts.duration === undefined ? 100 : opts.duration;
    this.volume = 1;
    this.muted = false;
    this.src = '';
    this.playCalls = 0;
    this.failPlay = !!opts.failPlay;
  }
  addEventListener(name, handler) {
    if (!this.listeners[name]) this.listeners[name] = [];
    this.listeners[name].push(handler);
  }
  removeEventListener(name, handler) {
    const list = this.listeners[name] || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }
  emit(name, payload) {
    (this.listeners[name] || []).forEach((handler) => handler(payload));
  }
  removeAttribute() {}
  load() {}
  play() {
    this.playCalls++;
    this.paused = false;
    if (this.failPlay) return Promise.reject(new Error('bloqueado por el sistema'));
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}

test('el adaptador nativo carga la URL y reproduce', async () => {
  const video = new FakeVideo();
  const adapter = createNativeAdapter(video);
  adapter.load('http://servidor/live.m3u8');
  assert.equal(video.src, 'http://servidor/live.m3u8');
  await adapter.play();
  assert.equal(video.playCalls, 1);
});

test('el adaptador nativo traduce los errores de media', () => {
  const video = new FakeVideo();
  const adapter = createNativeAdapter(video);
  let captured = null;
  adapter.on('error', (err) => { captured = err; });
  video.error = { code: 2 };
  video.emit('error');
  assert.equal(captured.code, ERROR_CODES.PLAYBACK);
  assert.equal(captured.mediaCode, 2);
});

test('el reproductor emite los eventos de ciclo de vida', async () => {
  const bus = createBus();
  const video = new FakeVideo();
  const events = [];
  bus.on('player:loading', () => events.push('loading'));
  bus.on('player:playing', () => events.push('playing'));
  const player = createPlayer({ bus, video, getPrefs: () => ({ playerMode: 'native' }) });
  await player.load({ id: 'c1', name: 'Canal 1', url: 'http://s/live.m3u8' });
  assert.deepEqual(events, ['loading', 'playing']);
  assert.equal(player.getItem().id, 'c1');
});

test('el reproductor reintenta y avisa si falla definitivamente', async () => {
  const bus = createBus();
  const video = new FakeVideo({ failPlay: true });
  let failed = null;
  bus.on('player:failed', (payload) => { failed = payload; });
  const player = createPlayer({
    bus,
    video,
    getPrefs: () => ({ playerMode: 'native', playerTimeoutMs: 50 })
  });
  await assert.rejects(() => player.load({ id: 'c1', url: 'http://s/live.m3u8' }));
  assert.ok(failed);
  assert.equal(failed.error.code, ERROR_CODES.PLAYBACK);
});

test('el motor MSE no disponible informa con claridad', async () => {
  const bus = createBus();
  const video = new FakeVideo();
  const player = createPlayer({ bus, video, getPrefs: () => ({ playerMode: 'mse' }) });
  await assert.rejects(
    () => player.load({ id: 'c1', url: 'http://s/live.m3u8' }),
    (err) => err.code === ERROR_CODES.UNSUPPORTED
  );
});
