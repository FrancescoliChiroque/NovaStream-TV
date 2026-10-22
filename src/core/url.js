/**
 * Validacion y normalizacion de URLs.
 * Solo se permiten http/https: cualquier otro esquema (file:, data:, javascript:)
 * se rechaza antes de llegar a fetch o a un elemento <video>.
 */

import { ALLOWED_SCHEMES } from '../config.js';
import { NovaError, ERROR_CODES } from './errors.js';

export function isAllowedScheme(url, allowed) {
  var list = allowed || ALLOWED_SCHEMES;
  try {
    var parsed = new URL(url);
    return list.indexOf(parsed.protocol) >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * Devuelve la URL normalizada o lanza NovaError.
 * @param {string} url
 * @param {{allowedSchemes?: string[], allowCredentials?: boolean}} [opts]
 */
export function assertSafeUrl(url, opts) {
  var options = opts || {};
  if (typeof url !== 'string' || !url.trim()) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'URL vacia');
  }
  var trimmed = url.trim();
  var parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'URL no valida');
  }
  var allowed = options.allowedSchemes || ALLOWED_SCHEMES;
  if (allowed.indexOf(parsed.protocol) < 0) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'Esquema no permitido: ' + parsed.protocol.replace(':', ''));
  }
  if (!parsed.hostname) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'URL sin host');
  }
  if (!options.allowCredentials && (parsed.username || parsed.password)) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'URL con credenciales embebidas no permitida');
  }
  return parsed.toString();
}

export function isSafeUrl(url, opts) {
  try {
    assertSafeUrl(url, opts);
    return true;
  } catch (e) {
    return false;
  }
}

/** Une una base y una ruta sin duplicar ni perder barras. */
export function joinUrl(base, path) {
  if (!base) return path || '';
  var b = String(base).replace(/\/+$/, '');
  var p = String(path || '');
  if (!p) return b;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.charAt(0) !== '/') p = '/' + p;
  return b + p;
}

/** Construye una query string omitiendo valores vacios. */
export function buildQuery(params) {
  var parts = [];
  var keys = Object.keys(params || {});
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = params[key];
    if (value === undefined || value === null || value === '') continue;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  }
  return parts.join('&');
}

/** Indica si la URL apunta a un streaming HLS. */
export function looksLikeHls(url) {
  if (typeof url !== 'string') return false;
  return /\.m3u8(\?|$)/i.test(url);
}
