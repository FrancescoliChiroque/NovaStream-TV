/**
 * Vista de diagnostico: informacion de la plataforma, prueba de red y
 * estado del servicio proxy. Sirve para saber por que una fuente falla
 * sin necesidad de un ordenador.
 */

import { el, clear } from '../../core/dom.js';
import { getDeviceInfo, getScreenInfo, getBrowserInfo, detectFeatures, isLunaAvailable } from '../../platform/webos.js';
import { APP_NAME, APP_VERSION } from '../../config.js';

function line(label, value) {
  var node = el('div', { class: 'diag__line' });
  node.appendChild(el('span', { class: 'diag__label', text: label }));
  node.appendChild(el('span', { class: 'diag__value', text: String(value === undefined || value === null ? '-' : value) }));
  return node;
}

export function createDiagnosticsView(ctx) {
  var element = el('section', { class: 'view view--diagnostics' });
  var header = el('header', { class: 'view__header' });
  header.appendChild(el('h1', { class: 'view__title', text: 'Diagnostico' }));
  element.appendChild(header);
  var body = el('div', { class: 'view__body' });
  element.appendChild(body);

  function show() {
    clear(body);
    var features = detectFeatures();
    var screen = getScreenInfo();

    var platform = el('section', { class: 'diag__group' });
    platform.appendChild(el('h2', { class: 'diag__title', text: 'Plataforma' }));
    platform.appendChild(line('Aplicacion', APP_NAME + ' ' + APP_VERSION));
    platform.appendChild(line('webOS', features.webOs ? 'si' : 'no (entorno de escritorio)'));
    platform.appendChild(line('Luna Service', isLunaAvailable() ? 'disponible' : 'no disponible'));
    platform.appendChild(line('Motor', features.chrome ? 'Chromium ' + features.chrome : 'desconocido'));
    platform.appendChild(line('Resolucion', screen.width + 'x' + screen.height + ' (' + screen.dpr + 'x)'));
    platform.appendChild(line('IndexedDB', features.indexedDb ? 'si' : 'no'));
    platform.appendChild(line('MediaSource', features.mediaSource ? 'si' : 'no'));
    body.appendChild(platform);

    var version = el('section', { class: 'diag__group' });
    version.appendChild(el('h2', { class: 'diag__title', text: 'Version de webOS' }));
    var value = el('span', { class: 'diag__value', text: 'consultando...' });
    version.appendChild(value);
    body.appendChild(version);
    getDeviceInfo().then(function (info) {
      if (!info) {
        // Sin Luna Service (app abierta en el navegador del TV): se sacan los
        // datos del propio navegador.
        version.removeChild(value);
        var browser = getBrowserInfo();
        version.appendChild(line('Plataforma', browser.family));
        version.appendChild(line('Version de webOS', browser.version || 'no incluida en el user agent'));
        version.appendChild(line('Identificadores de plataforma', browser.tokens.length ? browser.tokens.join(' / ') : 'ninguno'));
        version.appendChild(line('Modelo', browser.model || 'no detectable'));
        version.appendChild(line('User agent', browser.userAgent || '-'));
        version.appendChild(line('Como se ejecuta', 'navegador del televisor (sin JS Service)'));
        return;
      }
      version.removeChild(value);
      version.appendChild(line('Plataforma', info.family));
      version.appendChild(line('Version mostrada por el TV', info.version || '-'));
      version.appendChild(line('Modelo', info.model || '-'));
      version.appendChild(line('SDK de webOS', info.sdk || '-'));
      version.appendChild(line('Placa (boardType)', info.board || '-'));
      version.appendChild(line('Como se ejecuta', 'app instalada (JS Service disponible)'));
    }).catch(function () {
      value.textContent = 'no se pudo obtener';
    });

    var storage = el('section', { class: 'diag__group' });
    storage.appendChild(el('h2', { class: 'diag__title', text: 'Almacenamiento' }));
    storage.appendChild(line('Espacio usado', Math.round(ctx.storage.usageBytes() / 1024) + ' KB'));
    storage.appendChild(line('Fuentes', ctx.sources.listSources().length));
    storage.appendChild(line('Favoritos', ctx.storage.getFavorites().length));
    storage.appendChild(line('Historial', ctx.storage.getHistory().length));
    body.appendChild(storage);

    var proxy = el('section', { class: 'diag__group' });
    proxy.appendChild(el('h2', { class: 'diag__title', text: 'Proxy (JS Service)' }));
    var proxyValue = el('span', { class: 'diag__value', text: 'comprobando...' });
    proxy.appendChild(proxyValue);
    var modeLine = line('Transporte de red', 'comprobando...');
    proxy.appendChild(modeLine);
    body.appendChild(proxy);
    ctx.proxy.detect().then(function (available) {
      if (available) {
        proxyValue.textContent = 'disponible';
        modeLine.textContent = ctx.http ? ctx.http.describeMode() : '-';
        return;
      }
      proxyValue.textContent = 'no disponible (esta no es una app instalada)';
      if (!ctx.http) {
        modeLine.textContent = '-';
        return;
      }
      ctx.http.probeDevProxy().then(function (devAvailable) {
        modeLine.textContent = devAvailable
          ? ctx.http.describeMode()
          : 'Peticion directa desde el televisor (CORS puede bloquear las listas)';
      }).catch(function () {
        modeLine.textContent = 'Peticion directa desde el televisor';
      });
    });

    var net = el('section', { class: 'diag__group' });
    net.appendChild(el('h2', { class: 'diag__title', text: 'Prueba de red' }));
    var netValue = el('span', { class: 'diag__value', text: 'sin fuente activa' });
    net.appendChild(netValue);
    var button = el('button', { class: 'btn', 'data-focusable': 'true', 'data-nav-scope': 'content', type: 'button', text: 'Probar la fuente activa' });
    button.addEventListener('click', function () {
      var source = ctx.sources.getActiveSource();
      if (!source) {
        netValue.textContent = 'sin fuente activa';
        return;
      }
      netValue.textContent = 'probando...';
      ctx.sources.refresh().then(function (result) {
        netValue.textContent = 'ok: ' + result.channels.length + ' canales';
      }).catch(function (err) {
        netValue.textContent = 'error: ' + (err && err.message ? err.message : 'desconocido');
      });
    });
    net.appendChild(button);
    body.appendChild(net);

    var logs = el('section', { class: 'diag__group' });
    logs.appendChild(el('h2', { class: 'diag__title', text: 'Registro' }));
    var logBox = el('pre', { class: 'diag__logs', text: '' });
    logs.appendChild(logBox);
    body.appendChild(logs);
    ctx.dumpLogs().then(function (text) {
      logBox.textContent = text || '(vacio)';
    });

    ctx.focusFirstIn(['content']);
  }

  return { element: element, show: show };
}
