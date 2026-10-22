/**
 * Logger con niveles y redaccion.
 * Regla de seguridad: nunca se registran credenciales, tokens ni URLs
 * completas con usuario/password o query strings sensibles.
 */

import { STORAGE_PREFIX } from '../config.js';

var LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

var SENSITIVE_QUERY = [
  'password', 'passwd', 'pwd', 'user', 'username', 'login', 'token',
  'access_token', 'api_key', 'apikey', 'key', 'secret', 'auth', 'session',
  'mac', 'signature', 'code'
];

function currentLevel() {
  try {
    var stored = globalThis.localStorage && globalThis.localStorage.getItem(STORAGE_PREFIX + 'log_level');
    if (stored && Object.prototype.hasOwnProperty.call(LEVELS, stored)) return stored;
  } catch (e) {
    /* localStorage puede fallar en modo privado: se ignora */
  }
  return 'warn';
}

/**
 * Redacta una URL: elimina credenciales embebidas y parametros sensibles.
 * "https://user:pass@host/x?token=abc" -> "https://host/x?token=***"
 */
export function redactUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  var out = url;
  out = out.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
  try {
    var qIndex = out.indexOf('?');
    if (qIndex >= 0) {
      var base = out.slice(0, qIndex);
      var query = out.slice(qIndex + 1);
      var parts = query.split('&');
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf('=');
        if (eq < 0) continue;
        var key = parts[i].slice(0, eq).toLowerCase();
        if (SENSITIVE_QUERY.indexOf(key) >= 0) parts[i] = parts[i].slice(0, eq + 1) + '***';
      }
      out = base + '?' + parts.join('&');
    }
  } catch (e) {
    return '<url invalida>';
  }
  return out;
}

export function redactText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1')
    .replace(/(\/(?:getlive|movie|series)\/)[^/\s]+\/[^/\s]+/gi, '$1***/***')
    .replace(/\b(password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=***')
    .replace(/\b(username|user|login)\s*=\s*[^&\s]+/gi, '$1=***');
}

/** Registro circular de las ultimas lineas (visible en Diagnostico). */
var BUFFER_LIMIT = 200;
var buffer = [];

function formatArgs(args) {
  var parts = [];
  for (var i = 0; i < args.length; i++) {
    var value = args[i];
    if (typeof value === 'string') parts.push(redactText(value));
    else if (value instanceof Error) parts.push(value.name + ': ' + redactText(value.message));
    else {
      try { parts.push(redactText(JSON.stringify(value))); }
      catch (e) { parts.push(String(value)); }
    }
  }
  return parts.join(' ');
}

export function dumpLogs() {
  return buffer.join('\n');
}

function log(level, args) {
  var line = '[' + new Date().toISOString() + '] ' + level.toUpperCase() + ' ' + formatArgs(args);
  buffer.push(line);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  if (LEVELS[level] > LEVELS[currentLevel()]) return;
  var safe = [];
  for (var i = 0; i < args.length; i++) {
    var value = args[i];
    if (typeof value === 'string') safe.push(redactText(value));
    else if (value instanceof Error) safe.push(value.name + ': ' + redactText(value.message));
    else safe.push(value);
  }
  var fn = (typeof console !== 'undefined' && console[level]) || console.log;
  fn.apply(console, ['[NovaStream]'].concat(safe));
}

export const logger = {
  setLevel: function (level) {
    if (!Object.prototype.hasOwnProperty.call(LEVELS, level)) return false;
    try {
      globalThis.localStorage.setItem(STORAGE_PREFIX + 'log_level', level);
    } catch (e) { /* ignorado */ }
    return true;
  },
  getLevel: currentLevel,
  error: function () { log('error', arguments); },
  warn: function () { log('warn', arguments); },
  info: function () { log('info', arguments); },
  debug: function () { log('debug', arguments); },
  dump: dumpLogs,
  clear: function () { buffer = []; }
};
