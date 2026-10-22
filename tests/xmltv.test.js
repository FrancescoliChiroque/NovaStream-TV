import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseXmltv, parseXmltvTime, buildEpgIndex, currentProgrammes } from '../src/data/xmltv.js';

const XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="test">
  <channel id="canal1">
    <display-name>Canal Uno</display-name>
    <icon src="http://logos/1.png" />
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="canal1">
    <title>Noticias de la mañana</title>
    <desc>Resumen de la mañana</desc>
  </programme>
  <programme start="20240101130000 +0000" stop="20240101140000 +0000" channel="canal1">
    <title><![CDATA[Deporte & Relax]]></title>
  </programme>
</tv>`;

test('parseXmltv extrae canales y programas', () => {
  const parsed = parseXmltv(XMLTV);
  assert.equal(parsed.channels.length, 1);
  assert.equal(parsed.channels[0].id, 'canal1');
  assert.equal(parsed.channels[0].name, 'Canal Uno');
  assert.equal(parsed.channels[0].logo, 'http://logos/1.png');
  assert.equal(parsed.programmes.length, 2);
  assert.equal(parsed.programmes[0].title, 'Noticias de la mañana');
  assert.equal(parsed.programmes[0].description, 'Resumen de la mañana');
});

test('parseXmltv resuelve CDATA y entidades', () => {
  const parsed = parseXmltv(XMLTV);
  assert.equal(parsed.programmes[1].title, 'Deporte & Relax');
});

test('parseXmltv tolera entradas invalidas', () => {
  assert.deepEqual(parseXmltv(null), { channels: [], programmes: [] });
  assert.deepEqual(parseXmltv('texto plano'), { channels: [], programmes: [] });
});

test('parseXmltvTime convierte a epoch', () => {
  assert.equal(parseXmltvTime('20240101120000 +0000'), Date.UTC(2024, 0, 1, 12, 0, 0));
  assert.equal(parseXmltvTime('20240101130000 +0100'), Date.UTC(2024, 0, 1, 12, 0, 0));
  assert.equal(parseXmltvTime('basura'), null);
  assert.equal(parseXmltvTime(''), null);
});

test('buildEpgIndex indexa por canal y ordena', () => {
  const index = buildEpgIndex(parseXmltv(XMLTV));
  assert.equal(index.canal1.length, 2);
  assert.equal(index.canal1[0].startMs < index.canal1[1].startMs, true);
});

test('currentProgrammes devuelve el programa en curso y el siguiente', () => {
  const index = buildEpgIndex(parseXmltv(XMLTV));
  const now = Date.UTC(2024, 0, 1, 12, 30, 0);
  const result = currentProgrammes(index, 'canal1', now);
  assert.equal(result.current.title, 'Noticias de la mañana');
  assert.equal(result.next.title, 'Deporte & Relax');
});

test('currentProgrammes sin coincidencia devuelve null', () => {
  const index = buildEpgIndex(parseXmltv(XMLTV));
  const result = currentProgrammes(index, 'canal1', Date.UTC(2030, 0, 1));
  assert.equal(result.current, null);
});
