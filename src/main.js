/**
 * Punto de entrada de NovaStream TV.
 * Arranque:
 *   1. crea los servicios (almacenamiento, red, cache, EPG, catalogo),
 *   2. monta la interfaz,
 *   3. carga la fuente activa y la guia,
 *   4. engancha el teclado del mando.
 */

import { createBus } from './core/bus.js';
import { createStorage } from './core/storage.js';
import { createHttpClient } from './core/net.js';
import { createCache } from './services/cache.js';
import { createIdbStore } from './core/idb.js';
import { createSourceService } from './services/sources.js';
import { createEpgService } from './services/epg.js';
import { createCatalogService } from './services/catalog.js';
import { createPlayer } from './player/player.js';
import { createShell } from './ui/shell.js';
import { createServiceProxy, detectFeatures, isLunaAvailable } from './platform/webos.js';
import { installBackGuard } from './platform/history.js';
import { logger } from './core/logger.js';
import { el } from './core/dom.js';
import { APP_NAME, APP_VERSION } from './config.js';

export function bootstrap(mountNode) {
  var bus = createBus();
  var storage = createStorage();
  var proxy = createServiceProxy();
  var preferProxy = false;
  var isFileProtocol = false;
  try {
    isFileProtocol = globalThis.location && globalThis.location.protocol === 'file:';
    preferProxy = isFileProtocol;
  } catch (e) {
    preferProxy = false;
  }
  var http = createHttpClient({ proxy: proxy, preferProxy: preferProxy });
  var cache = createCache();
  var idb = createIdbStore();
  var sources = createSourceService({ storage: storage, http: http, bus: bus, cache: cache });
  var epg = createEpgService({ http: http, bus: bus, cache: cache, idb: idb });
  var catalog = createCatalogService({ http: http, cache: cache });

  var video = el('video', { class: 'player__video' });
  var player = createPlayer({
    bus: bus,
    video: video,
    getPrefs: function () { return storage.getPrefs(); }
  });

  var shell = createShell({
    bus: bus,
    storage: storage,
    sources: sources,
    epg: epg,
    catalog: catalog,
    player: player,
    proxy: proxy,
    http: http,
    video: video
  });

  var mount = mountNode || document.getElementById('ns-app') || document.getElementById('app');
  if (!mount) return null;
  mount.appendChild(shell.element);
  mount.hidden = false;
  document.body.classList.remove('is-booting');

  var features = detectFeatures();
  logger.info(APP_NAME + ' ' + APP_VERSION + ' iniciado', 'webOS:', features.webOs, 'chromium:', features.chrome);

  // La deteccion del JS Service se lanza antes de la primera peticion: en el
  // televisor se descarga a traves del service y en modo navegador se usa el
  // proxy del servidor de desarrollo.
  var proxyReady = proxy.detect().then(function (available) {
    logger.info('proxy JS Service:', available ? 'disponible' : 'no disponible');
    return available;
  });

  function loadInitialData() {
    return proxyReady.then(function () {
      var source = sources.getActiveSource();
      if (!source) {
        shell.router.navigate('/home');
        return null;
      }
      return sources.loadChannels().then(function (result) {
        logger.info('canales cargados:', result.channels.length);
        var epgUrl = source.epgUrl || '';
        if (!epgUrl) return null;
        return epg.load(epgUrl).then(function (epgResult) {
          logger.info('guia cargada:', epgResult.channels, 'canales');
        }).catch(function (err) {
          logger.warn('no se pudo cargar la guia:', err && err.message);
        });
      }).catch(function (err) {
        logger.warn('no se pudo cargar la lista:', err && err.message);
        shell.router.navigate('/settings');
      });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (shell.handleKey(event)) event.preventDefault();
  });

  // Modo navegador: la app no esta instalada en el TV (webOS Hub sin SSH).
  // Ahi el navegador se queda con la tecla ATRAS y la pagina no la ve, asi
  // que hace falta la guarda de historial. Ademas se pide pantalla completa
  // con la primera pulsacion (los navegadores exigen que el gesto venga del
  // usuario). No se usa el user agent para detectarlo: el navegador del TV
  // tambien se identifica como webOS.
  var browserMode = !isFileProtocol && !isLunaAvailable();
  if (browserMode) {
    installBackGuard(function () {
      shell.handleBack();
    });
    requestFullscreenOnFirstGesture();
  }

  shell.start();
  loadInitialData();

  return {
    bus: bus,
    storage: storage,
    sources: sources,
    epg: epg,
    catalog: catalog,
    player: player,
    shell: shell,
    proxy: proxy
  };
}

if (typeof document !== 'undefined') {
  /**
   * Pide pantalla completa en la primera pulsacion del usuario.
   * Solo se usa en modo navegador: en una app instalada ya ocupa la pantalla.
   */
  function requestFullscreenOnFirstGesture() {
    var done = false;
    function ask() {
      if (done) return;
      done = true;
      var element = document.documentElement;
      try {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        }
      } catch (err) {
        logger.debug('pantalla completa no disponible');
      }
    }
    document.addEventListener('keydown', ask, { once: true });
    document.addEventListener('click', ask, { once: true });
    document.addEventListener('touchstart', ask, { once: true });
  }

  function start() {
    var mount = document.getElementById('ns-app') || document.getElementById('app');
    if (!mount) return;
    try {
      bootstrap(mount);
    } catch (err) {
      logger.error('fallo al iniciar:', err && err.message);
      mount.appendChild(el('p', { class: 'empty', text: 'No se pudo iniciar NovaStream TV: ' + (err && err.message ? err.message : 'error desconocido') }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
