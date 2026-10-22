import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseM3U, parseAttributes, cleanName, buildChannelId, groupChannels } from '../src/data/m3u.js';

const PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="canal1" tvg-name="Canal Uno" tvg-logo="http://logos/1.png" group-title="Noticias",Canal Uno HD',
  'http://servidor/live/uno.ts',
  '#EXTINF:-1 tvg-id="canal2" group-title="Deportes",Canal Dos',
  'http://servidor/live/dos.ts',
  '#EXTINF:-1 group-title="Peliculas VOD",Pelicula Demo',
  'http://servidor/vod/demo.mp4',
  'http://servidor/live/sin-extinf.ts'
].join('\n');

test('parseM3U devuelve canales y grupos', () => {
  const result = parseM3U(PLAYLIST);
  assert.equal(result.channels.length, 4);
  assert.deepEqual(result.groups, ['Deportes', 'Noticias', 'Peliculas VOD']);
  assert.equal(result.stats.total, 4);
});

test('parseM3U lee los atributos EXTINF', () => {
  const result = parseM3U(PLAYLIST);
  const first = result.channels[0];
  assert.equal(first.name, 'Canal Uno HD');
  assert.equal(first.tvgId, 'canal1');
  assert.equal(first.logo, 'http://logos/1.png');
  assert.equal(first.group, 'Noticias');
  assert.equal(first.url, 'http://servidor/live/uno.ts');
  assert.equal(first.kind, 'live');
  assert.equal(first.id, 'tvg:canal1');
});

test('parseM3U marca como VOD los grupos de peliculas', () => {
  const result = parseM3U(PLAYLIST);
  const vod = result.channels[2];
  assert.equal(vod.kind, 'vod');
  assert.equal(vod.name, 'Pelicula Demo');
});

test('parseM3U genera un id estable para los canales sin tvg-id', () => {
  const a = parseM3U(PLAYLIST).channels[3];
  const b = parseM3U(PLAYLIST).channels[3];
  assert.equal(a.id, b.id);
  assert.match(a.id, /^ch:/);
});

test('parseM3U genera nombres y urls para lineas sueltas', () => {
  const result = parseM3U('http://servidor/live/sin-extinf.ts');
  assert.equal(result.channels[0].name, 'Canal 1');
  assert.equal(result.channels[0].url, 'http://servidor/live/sin-extinf.ts');
});

test('parseM3U rechaza un texto que no es string', () => {
  assert.throws(() => parseM3U(null));
  assert.throws(() => parseM3U(42));
});

test('parseAttributes acepta comillas dobles y simples', () => {
  const attrs = parseAttributes('-1 tvg-id="a" group-title=\'Noticias\' tvg-logo="x.png"');
  assert.equal(attrs['tvg-id'], 'a');
  assert.equal(attrs['group-title'], 'Noticias');
  assert.equal(attrs['tvg-logo'], 'x.png');
});

test('cleanName normaliza espacios', () => {
  assert.equal(cleanName('  Canal   Uno  '), 'Canal Uno');
  assert.equal(cleanName(''), '');
});

test('buildChannelId prioriza el tvg-id', () => {
  assert.equal(buildChannelId({ tvgId: 'x1', name: 'A', url: 'u' }, 0), 'tvg:x1');
  assert.equal(buildChannelId({ tvgId: '', name: 'A', url: 'u' }, 3), buildChannelId({ tvgId: '', name: 'A', url: 'u' }, 3));
});

test('groupChannels agrupa y ordena alfabeticamente', () => {
  const grouped = groupChannels([
    { name: 'a', group: 'Deportes' },
    { name: 'b', group: 'Noticias' },
    { name: 'c', group: 'Deportes' },
    { name: 'd', group: '' }
  ]);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].name, 'Deportes');
  assert.equal(grouped[0].channels.length, 2);
  assert.equal(grouped[1].name, 'Noticias');
  assert.equal(grouped[2].name, 'Sin grupo');
});
