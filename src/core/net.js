/**
 * Capa de red: timeouts, limite de concurrencia, reintentos con backoff,
 * limite de tamano de respuesta y soporte de proxy (JS service) para
 * evitar el bloqueo CORS de las apps empaquetadas (origen file://).
 */

import { NET_CONFIG } from '../config.js';
import { NovaError, ERROR_CODES } from './errors.js';
import { assertSafeUrl } from './url.js';
import { logger } from './logger.js';

/** Limitador de concurrencia. */
export function createLimiter(max) {
  var limit = Math.max(1, max || 1);
  var active = 0;
  var queue = [];

  function next() {
    if (active >= limit || !queue.length) return;
    var job = queue.shift();
    active++;
    var settled = false;
    function release() {
      if (settled) return;
      settled = true;
      active--;
      next();
    }
    job.resolve(job.run().then(function (value) {
      release();
      return value;
    }, function (err) {
      release();
      throw err;
    }));
  }

  return function schedule(run) {
    return new Promise(function (resolve, reject) {
      queue.push({
        run: run,
        resolve: resolve,
        reject: reject
      });
      next();
    });
  };
}

export function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Lee la respuesta limitando el numero de bytes. */
function readLimited(response, maxBytes) {
  if (!response.body || !response.body.getReader) {
    return response.text().then(function (text) {
      if (text.length > maxBytes) {
        throw new NovaError(ERROR_CODES.PARSE, 'Respuesta demasiado grande');
      }
      return text;
    });
  }
  var reader = response.body.getReader();
  var decoder = new TextDecoder('utf-8');
  var received = 0;
  var chunks = [];
  function pump() {
    return reader.read().then(function (result) {
      if (result.done) return;
      received += result.value.length;
      if (received > maxBytes) {
        try { reader.cancel(); } catch (e) { /* ignorado */ }
        throw new NovaError(ERROR_CODES.PARSE, 'Respuesta demasiado grande');
      }
      chunks.push(decoder.decode(result.value, { stream: true }));
      return pump();
    });
  }
  return pump().then(function () {
    return chunks.join('') + decoder.decode();
  });
}

function isRetryable(err) {
  if (!err) return false;
  if (err.code === ERROR_CODES.NETWORK || err.code === ERROR_CODES.TIMEOUT) return true;
  if (err.httpStatus && err.httpStatus >= 500) return true;
  return false;
}

/**
 * Peticion GET con timeout, reintentos y limite de concurrencia.
 * @param {string} url
 * @param {{timeoutMs?:number, retries?:number, signal?:AbortSignal, maxBytes?:number, headers?:Object, skipValidation?:boolean}} [opts]
 */
export function requestText(url, opts) {
  var options = opts || {};
  var timeoutMs = options.timeoutMs || NET_CONFIG.requestTimeoutMs;
  var retries = typeof options.retries === 'number' ? options.retries : NET_CONFIG.maxRetries;
  var maxBytes = options.maxBytes || NET_CONFIG.maxResponseBytes;
  var limiter = options.limiter || createLimiter(NET_CONFIG.maxConcurrent);

  function attempt(remaining) {
    return limiter(function () {
      var safeUrl;
      try {
        safeUrl = options.skipValidation ? String(url) : assertSafeUrl(url);
      } catch (err) {
        return Promise.reject(err);
      }
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      if (controller) {
        timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      }
      if (options.signal && controller) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', function () { controller.abort(); });
      }

      return fetch(safeUrl, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'follow',
        headers: options.headers || undefined,
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (timer) clearTimeout(timer);
        if (!response.ok) {
          var httpErr = new NovaError(ERROR_CODES.HTTP, 'HTTP ' + response.status);
          httpErr.httpStatus = response.status;
          throw httpErr;
        }
        return readLimited(response, maxBytes);
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        var novaErr = err;
        if (err && err.name === 'AbortError') {
          novaErr = new NovaError(ERROR_CODES.TIMEOUT, 'Sin respuesta en ' + timeoutMs + ' ms');
        } else if (!(err && err.isNovaError)) {
          novaErr = new NovaError(ERROR_CODES.NETWORK, err && err.message ? String(err.message).slice(0, 160) : '');
        }
        if (remaining > 0 && isRetryable(novaErr)) {
          var backoff = Math.min(
            NET_CONFIG.retryMaxDelayMs,
            NET_CONFIG.retryBaseDelayMs * Math.pow(2, retries - remaining)
          );
          var jitter = Math.floor(Math.random() * 120);
          logger.debug('reintento', remaining, 'en', backoff + jitter, 'ms');
          return delay(backoff + jitter).then(function () {
            return attempt(remaining - 1);
          });
        }
        throw novaErr;
      });
    });
  }

  return attempt(retries);
}

export function requestJson(url, opts) {
  return requestText(url, opts).then(function (text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new NovaError(ERROR_CODES.PARSE, 'Respuesta JSON invalida');
    }
  });
}

/**
 * Cliente HTTP con soporte de proxy opcional (JS service de webOS).
 * El proxy se usa cuando la peticion directa falla por CORS.
 *
 * En una app instalada el proxy es el JS Service (Luna). En modo navegador
 * (por ejemplo la app abierta en el navegador del TV con webOS Hub) no hay
 * Luna, asi que se usa el proxy del servidor de desarrollo (/api/fetch),
 * que hace la descarga desde el PC y evita el bloqueo CORS.
 */
export function createHttpClient(options) {
  var opts = options || {};
  var proxy = opts.proxy || null;
  var limiter = createLimiter(opts.maxConcurrent || NET_CONFIG.maxConcurrent);
  var useProxy = opts.useProxy !== false;
  var preferProxy = !!opts.preferProxy;
  var devProxyPath = opts.devProxyPath || '/api/fetch';
  var devProxyState = null;
  var mode = 'direct';

  function direct(url, requestOpts) {
    mode = 'direct';
    return requestText(url, Object.assign({}, requestOpts, { limiter: limiter }));
  }

  function viaService(url, requestOpts) {
    if (!proxy || !proxy.fetchText) {
      return Promise.reject(new NovaError(ERROR_CODES.UNSUPPORTED, 'Proxy no disponible'));
    }
    mode = 'js-service';
    return proxy.fetchText(url).then(function (text) {
      if (requestOpts && requestOpts.maxBytes && text.length > requestOpts.maxBytes) {
        throw new NovaError(ERROR_CODES.PARSE, 'Respuesta demasiado grande');
      }
      return text;
    });
  }

  /** El proxy del servidor de desarrollo existe solo si responde con 400. */
  function devProxyAvailable() {
    if (devProxyState !== null) return Promise.resolve(devProxyState);
    var protocol = '';
    try {
      protocol = globalThis.location && globalThis.location.protocol ? globalThis.location.protocol : '';
    } catch (e) {
      protocol = '';
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      devProxyState = false;
      return Promise.resolve(false);
    }
    return fetch(devProxyPath, { method: 'GET' }).then(function (response) {
      devProxyState = response.status === 400;
      return devProxyState;
    }).catch(function () {
      devProxyState = false;
      return false;
    });
  }

  function viaDevProxy(url, requestOpts) {
    var target = devProxyPath + '?url=' + encodeURIComponent(url);
    mode = 'dev-proxy';
    return requestText(target, Object.assign({}, requestOpts, {
      limiter: limiter,
      skipValidation: true
    }));
  }

  function request(url, requestOpts) {
    var options = requestOpts || {};

    if (preferProxy && proxy && proxy.available) {
      return viaService(url, options).catch(function () {
        return direct(url, options);
      });
    }

    // Si el JS Service todavia no ha terminado de detectarse, se espera.
    if (proxy && !proxy.checked && proxy.ready) {
      return proxy.ready.catch(function () { return false; }).then(function () {
        return request(url, requestOpts);
      });
    }

    if (!proxy || !proxy.available) {
      return devProxyAvailable().then(function (available) {
        if (!available) return direct(url, options);
        logger.debug('usando el proxy del servidor de desarrollo');
        return viaDevProxy(url, options).catch(function () {
          return direct(url, options);
        });
      });
    }

    return direct(url, options).catch(function (err) {
      if (!useProxy) throw err;
      logger.debug('peticion directa fallida, se intenta proxy');
      return viaService(url, options);
    });
  }

  return {
    getText: function (url, requestOpts) {
      return request(url, requestOpts);
    },
    getJson: function (url, requestOpts) {
      return this.getText(url, requestOpts).then(function (text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new NovaError(ERROR_CODES.PARSE, 'Respuesta JSON invalida');
        }
      });
    },
    setProxy: function (nextProxy) {
      proxy = nextProxy;
    },
    getProxy: function () { return proxy; },
    getMode: function () { return mode; },
    probeDevProxy: function () {
      return devProxyAvailable().then(function (available) {
        if (available && (!proxy || !proxy.available)) mode = 'dev-proxy';
        return available;
      });
    },
    describeMode: function () {
      if (mode === 'js-service') return 'JS Service de webOS (Luna)';
      if (mode === 'dev-proxy') return 'Proxy del servidor de desarrollo (el PC descarga)';
      return 'Peticion directa desde el televisor';
    }
  };
}
