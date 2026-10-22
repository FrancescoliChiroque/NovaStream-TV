/**
 * Capa de plataforma webOS TV.
 * Aísla las diferencias del SO (Luna Service, botón Back, version) del
 * resto de la aplicacion. Si webOSTV.js no esta disponible (por ejemplo en
 * un navegador de escritorio) la app sigue funcionando con funciones
 * reducidas.
 */

import { NovaError, ERROR_CODES } from '../core/errors.js';
import { logger } from '../core/logger.js';

export const SERVICE_ID = 'com.novastream.tv.fetch';

function getWebOSLib() {
  return globalThis.webOS && globalThis.webOS.service ? globalThis.webOS : null;
}

export function isWebOS() {
  try {
    var ua = String(globalThis.navigator && globalThis.navigator.userAgent || '');
    return ua.indexOf('Web0S') >= 0 || ua.indexOf('webOS') >= 0 || ua.indexOf('SmartTV') >= 0 || !!globalThis.PalmSystem;
  } catch (e) {
    return false;
  }
}

export function isLunaAvailable() {
  return !!getWebOSLib();
}

/**
 * Llamada generica a un Luna Service.
 * @param {string} uri luna://...
 * @param {string} method
 * @param {Object} [parameters]
 * @param {number} [timeoutMs]
 */
export function callService(uri, method, parameters, timeoutMs) {
  var lib = getWebOSLib();
  if (!lib) {
    return Promise.reject(new NovaError(ERROR_CODES.UNSUPPORTED, 'Luna Service no disponible en esta plataforma'));
  }
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(new NovaError(ERROR_CODES.TIMEOUT, 'El servicio no ha respondido'));
    }, timeoutMs || 4000);

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    }

    try {
      lib.service.request(uri, {
        method: method,
        parameters: parameters || {},
        onSuccess: function (response) { finish(resolve, response); },
        onFailure: function (error) {
          finish(reject, new NovaError(ERROR_CODES.NETWORK, error && error.errorText ? String(error.errorText) : 'Luna Service error'));
        },
        onComplete: function (response) { finish(resolve, response); }
      });
    } catch (e) {
      finish(reject, new NovaError(ERROR_CODES.UNSUPPORTED, 'No se pudo invocar el Luna Service'));
    }
  });
}

/** Version de webOS TV (mayor, menor) o null si no se puede saber. */
export function getWebOSVersion() {
  return getDeviceInfo().then(function (info) {
    if (!info) return null;
    return { raw: info.version, major: info.major, minor: info.minor };
  });
}

/**
 * Deduce la familia de la plataforma a partir del firmware.
 *
 * En los SMART TV de marca con licencia webOS (webOS Hub: Hyundai/HYLED,
 * Hisense, AOC...) el numero de version que muestra el televisor tiene el
 * formato 04.xx.xx (por ejemplo 04.56.35) y no corresponde a la numeracion
 * de LG (webOS 6.0, 22, 23...). Son plataformas modernas: soportan apps web,
 * JS Service y HLS igual que un LG.
 */
export function detectPlatformFamily(firmware, model) {
  var match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(firmware || ''));
  if (!match) return { family: 'desconocido', version: '', major: 0, minor: 0 };
  var major = parseInt(match[1], 10);
  var minor = parseInt(match[2], 10);
  var family;
  if (major === 4 && minor >= 20) {
    family = 'webOS Hub (licencia de marca)';
  } else if (major >= 22) {
    family = 'webOS ' + major;
  } else if (major >= 6 && major <= 21) {
    family = 'webOS TV ' + major + '.0';
  } else if (major >= 1 && major <= 5) {
    family = 'webOS TV ' + major;
  } else {
    family = 'desconocido';
  }
  if (model && /^HYLED/i.test(String(model))) {
    family += ' / HYLED';
  }
  return { family: family, version: String(firmware), major: major, minor: minor };
}

/**
 * Datos del televisor: modelo, firmware, SDK y placa.
 * Requiere el Luna Service `com.webos.service.tv.systemproperty`.
 */
export function getDeviceInfo() {
  return callService(
    'luna://com.webos.service.tv.systemproperty',
    'getSystemInfo',
    { keys: ['firmwareVersion', 'modelName', 'sdkVersion', 'boardType'] },
    3000
  ).then(function (response) {
    if (!response || response.returnValue === false) return null;
    var firmware = response.firmwareVersion ? String(response.firmwareVersion) : '';
    var model = response.modelName ? String(response.modelName) : '';
    var guess = detectPlatformFamily(firmware, model);
    return {
      firmware: firmware,
      model: model,
      sdk: response.sdkVersion ? String(response.sdkVersion) : '',
      board: response.boardType ? String(response.boardType) : '',
      family: guess.family,
      version: guess.version,
      major: guess.major,
      minor: guess.minor
    };
  }).catch(function () { return null; });
}

/**
 * Salir de la aplicacion.
 * - App instalada en webOS: popup del sistema (webOS 6.0+).
 * - Modo navegador (webOS Hub sin IPK): window.close() solo funciona si la
 *   ventana la abrio un script, asi que se recurre al historial del
 *   navegador. Devuelve false si no hay ninguna forma de salir.
 */
export function platformBack(options) {
  var opts = options || {};
  if (getWebOSLib() && typeof globalThis.webOS.platformBack === 'function') {
    try {
      globalThis.webOS.platformBack();
      return true;
    } catch (e) {
      logger.debug('platformBack no disponible');
    }
  }
  try {
    globalThis.close();
  } catch (e) {
    logger.debug('window.close no permitido');
  }
  if (opts.allowHistoryBack !== false) {
    try {
      if (globalThis.history && globalThis.history.length > 1) {
        globalThis.history.back();
        return true;
      }
    } catch (e) {
      logger.debug('history.back no disponible');
    }
  }
  return false;
}

/**
 * Deduce la version de webOS del user agent del navegador del televisor.
 * El navegador de webOS no siempre la incluye: se prueban los formatos
 * habituales ("webOS/4.56.35", "Web0S/4.56.35" y "Linux/SmartTV; 4.56.35").
 */
function parseVersionFromUserAgent(ua) {
  var patterns = [
    /(?:webos|web0s)\/v?([0-9][0-9.]*)/i,
    /SmartTV[;\s]+v?([0-9][0-9.]*)/i,
    /Web0S[;\s]+v?([0-9][0-9.]*)/i,
    /NetCast[;\s]+v?([0-9][0-9.]*)/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = patterns[i].exec(ua);
    if (match) return match[1].replace(/\.$/, '');
  }
  return '';
}

/**
 * Identificadores de plataforma que aparecen en el user agent del navegador
 * del televisor ("NetCast", "Colt/2.0", "SmartTV/10.0"...). Son utiles para
 * saber con que familia de webOS se esta trabajando.
 */
function platformTokensFromUserAgent(ua) {
  var tokens = [];
  var patterns = [
    { re: /\bNetCast\b/i, label: 'NetCast' },
    { re: /\bColt\/([0-9][0-9.]*)/i, label: 'Colt' },
    { re: /\bSmartTV\/([0-9][0-9.]*)/i, label: 'SmartTV' },
    { re: /\bWeb0S\b/i, label: 'Web0S' },
    { re: /\bwebOS\b/i, label: 'webOS' },
    { re: /\bWebAppManager\b/i, label: 'WebAppManager' }
  ];
  patterns.forEach(function (pattern) {
    var match = pattern.re.exec(ua);
    if (!match) return;
    var value = match[1] ? match[1] : '';
    tokens.push(value ? pattern.label + ' ' + value : pattern.label);
  });
  return tokens;
}

/**
 * Datos del dispositivo cuando la app NO esta instalada (se abre en el
 * navegador del televisor). No hay Luna Service, asi que la version de webOS
 * se deduce del user agent y del objeto global 'webOS' si el navegador lo
 * expone.
 */
export function getBrowserInfo() {
  var ua = String(globalThis.navigator && globalThis.navigator.userAgent || '');
  var version = parseVersionFromUserAgent(ua);
  var model = '';
  var native = globalThis.webOS || null;
  if (native) {
    if (native.deviceInfo) {
      try {
        var device = native.deviceInfo;
        if (typeof device === 'string') device = JSON.parse(device);
        model = device.modelName || device.model || '';
        if (!version && device.platformVersion) version = String(device.platformVersion);
      } catch (e) { /* datos no disponibles */ }
    }
    // Algunas versiones exponen la version directamente.
    if (!version && native.version) {
      version = String(native.version).replace(/^.*?(\d[\d.]*)$/, '$1');
    }
  }
  var tokens = platformTokensFromUserAgent(ua);
  var guess = detectPlatformFamily(version, model);
  var family = version ? guess.family : 'navegador webOS';
  if (!version && tokens.length) family += ' (' + tokens.join(' / ') + ')';
  var screen = getScreenInfo();
  return {
    userAgent: ua,
    version: version,
    model: model,
    tokens: tokens,
    family: family,
    major: guess.major,
    minor: guess.minor,
    width: screen.width,
    height: screen.height
  };
}

/** Datos de pantalla (utiles para el diagnostico). */
export function getScreenInfo() {  var screen = globalThis.screen || {};
  return {
    width: screen.width || 1920,
    height: screen.height || 1080,
    dpr: globalThis.devicePixelRatio || 1,
    ua: String(globalThis.navigator && globalThis.navigator.userAgent || '')
  };
}

/**
 * Proxy opcional via Luna Service: permite descargar playlists, XMLTV y
 * llamar a la API Xtream sin problemas de CORS (el origen de una app
 * empaquetada es file://).
 */
export function createServiceProxy() {
  var proxy = {
    available: false,
    checked: false,
    ready: null,
    fetchText: function (url) {
      return callService('luna://' + SERVICE_ID + '/', 'fetchText', { url: url }, 15000)
        .then(function (response) {
          if (!response || response.returnValue === false) {
            throw new NovaError(ERROR_CODES.NETWORK, response && response.errorText ? String(response.errorText) : 'El servicio devolvio un error');
          }
          return response.text !== undefined ? response.text : '';
        });
    },
    fetchJson: function (url) {
      return proxy.fetchText(url).then(function (text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new NovaError(ERROR_CODES.PARSE, 'Respuesta JSON invalida del servicio');
        }
      });
    }
  };

  proxy.detect = function () {
    if (!isLunaAvailable()) {
      proxy.available = false;
      proxy.checked = true;
      proxy.ready = Promise.resolve(false);
      return proxy.ready;
    }
    var pending = callService('luna://' + SERVICE_ID + '/', 'ping', {}, 2500)
      .then(function (response) {
        proxy.available = !!(response && response.returnValue !== false);
        proxy.checked = true;
        return proxy.available;
      })
      .catch(function () {
        proxy.available = false;
        proxy.checked = true;
        return false;
      });
    proxy.ready = pending;
    return pending;
  };

  return proxy;
}

/** Caracteristicas deducidas del navegador (no del SO). */
export function detectFeatures() {
  var ua = String(globalThis.navigator && globalThis.navigator.userAgent || '');
  var chromeMatch = /Chrome\/(\d+)/.exec(ua);
  return {
    chrome: chromeMatch ? parseInt(chromeMatch[1], 10) : 0,
    esModules: !!(globalThis.document && 'noModule' in document.createElement('script')),
    fetch: typeof globalThis.fetch === 'function',
    abortController: typeof globalThis.AbortController !== 'undefined',
    indexedDb: !!globalThis.indexedDB,
    mediaSource: typeof globalThis.MediaSource !== 'undefined',
    webOs: isWebOS()
  };
}
