/**
 * Persistencia de preferencias, fuentes, favoritos e historial.
 *
 * Notas de seguridad:
 * - Las credenciales Xtream NO se guardan en claro en localStorage: se
 *   guardan ofuscadas (base64 + XOR con clave local) y el propio
 *   localStorage de webOS no es un almacen seguro. El usuario debe saberlo.
 * - La clave de ofuscacion se deriva del propio dispositivo y solo protege
 *   frente a lectura casual, no frente a un atacante con acceso al SO.
 * - Los logs nunca incluyen credenciales (ver core/logger.js).
 */

import { STORAGE_KEYS, DEFAULT_PREFS, HISTORY_LIMIT, FAVORITES_LIMIT } from '../config.js';
import { NovaError, ERROR_CODES } from './errors.js';
import { logger } from './logger.js';

/** Backend de almacenamiento inyectable (para pruebas). */
export function createMemoryBackend() {
  var map = Object.create(null);
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    },
    setItem: function (key, value) { map[key] = String(value); },
    removeItem: function (key) { delete map[key]; },
    key: function (index) { return Object.keys(map)[index]; },
    get length() { return Object.keys(map).length; }
  };
}

function safeLocalStorage() {
  try {
    var ls = globalThis.localStorage;
    if (!ls) return createMemoryBackend();
    var probe = STORAGE_KEYS.prefs + '__probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch (e) {
    logger.warn('localStorage no disponible, se usa almacen en memoria');
    return createMemoryBackend();
  }
}

/* ------------------------------------------------------------------ */
/* Ofuscacion de credenciales                                           */
/* ------------------------------------------------------------------ */

function xorKey() {
  var seed = '';
  try {
    seed = String(globalThis.navigator && globalThis.navigator.userAgent || 'novastream');
  } catch (e) {
    seed = 'novastream';
  }
  var hash = 2166136261;
  for (var i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * XOR simetrico con un flujo de claves dependiente de la posicion.
 * Cifrar y descifrar son la misma operacion, de modo que el dato se
 * recupera exactamente. OJO: es ofuscacion, no cifrado real.
 */
function xorString(text, key) {
  var out = '';
  for (var i = 0; i < text.length; i++) {
    var k = (key + i * 31) & 0xff;
    out += String.fromCharCode(text.charCodeAt(i) ^ k);
  }
  return out;
}

export function obfuscateSecret(value) {
  if (!value) return '';
  var key = xorKey();
  var encoded;
  try {
    encoded = globalThis.btoa(unescape(encodeURIComponent(value)));
  } catch (e) {
    encoded = value;
  }
  try {
    return 'nvt1:' + globalThis.btoa(xorString(encoded, key)) + ':' + key.toString(16);
  } catch (e) {
    return 'nvt1:' + encoded + ':' + key.toString(16);
  }
}

export function deobfuscateSecret(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.indexOf('nvt1:') !== 0) return value;
  var parts = value.split(':');
  if (parts.length < 3) return '';
  var key = parseInt(parts[2], 16) >>> 0;
  var encoded = parts[1];
  try {
    encoded = xorString(globalThis.atob(encoded), key);
  } catch (e) {
    return '';
  }
  var decoded;
  try {
    decoded = decodeURIComponent(escape(globalThis.atob(encoded)));
  } catch (e) {
    return '';
  }
  return decoded;
}

/* ------------------------------------------------------------------ */
/* PIN parental (hash no reversible, ofuscacion best-effort)            */
/* ------------------------------------------------------------------ */

export function hashPin(pin) {
  if (!pin) return '';
  var key = xorKey();
  var hash = 2166136261 ^ key;
  var text = 'nvt:' + pin;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
    hash = (hash << 13 | hash >>> 19) >>> 0;
  }
  return 'nvtp$' + hash.toString(16);
}

/* ------------------------------------------------------------------ */

function readJSON(store, key, fallback) {
  var raw;
  try {
    raw = store.getItem(key);
  } catch (e) {
    return fallback;
  }
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    var parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    logger.warn('dato corrupto en', key, '- se ignora');
    return fallback;
  }
}

function writeJSON(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    throw new NovaError(ERROR_CODES.STORAGE, 'No se pudo guardar ' + key);
  }
}

export function createStorage(backend) {
  var store = backend || safeLocalStorage();

  function getPrefs() {
    var stored = readJSON(store, STORAGE_KEYS.prefs, {});
    var prefs = {};
    var key;
    for (key in DEFAULT_PREFS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, key)) {
        prefs[key] = DEFAULT_PREFS[key];
      }
    }
    for (key in stored) {
      if (Object.prototype.hasOwnProperty.call(stored, key)) prefs[key] = stored[key];
    }
    return prefs;
  }

  function setPrefs(patch) {
    var current = getPrefs();
    var key;
    for (key in patch || {}) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) current[key] = patch[key];
    }
    writeJSON(store, STORAGE_KEYS.prefs, current);
    return current;
  }

  function getSources() {
    var list = readJSON(store, STORAGE_KEYS.sources, []);
    return Array.isArray(list) ? list : [];
  }

  function setSources(list) {
    writeJSON(store, STORAGE_KEYS.sources, list);
    return list;
  }

  function addSource(source) {
    var list = getSources();
    var id = source.id || ('src_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36));
    var record = {
      id: id,
      name: source.name || 'Fuente',
      type: source.type || 'm3u',
      url: source.url || '',
      epgUrl: source.epgUrl || '',
      username: source.username ? obfuscateSecret(source.username) : '',
      password: source.password ? obfuscateSecret(source.password) : '',
      active: !!source.active,
      createdAt: Date.now()
    };
    list.push(record);
    setSources(list);
    return record;
  }

  function updateSource(id, patch) {
    var list = getSources();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      found = list[i];
      var key;
      for (key in patch || {}) {
        if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
        if (key === 'username' || key === 'password') {
          found[key] = patch[key] ? obfuscateSecret(patch[key]) : '';
        } else {
          found[key] = patch[key];
        }
      }
      break;
    }
    if (!found) throw new NovaError(ERROR_CODES.NOT_FOUND, 'Fuente no encontrada');
    setSources(list);
    return found;
  }

  function removeSource(id) {
    var list = getSources().filter(function (item) { return item.id !== id; });
    setSources(list);
    return list;
  }

  function getActiveSource() {
    var list = getSources();
    for (var i = 0; i < list.length; i++) {
      if (list[i].active) return list[i];
    }
    return null;
  }

  function setActiveSource(id) {
    var list = getSources().map(function (item) {
      item.active = item.id === id;
      return item;
    });
    setSources(list);
    return list;
  }

  function getFavorites() {
    var list = readJSON(store, STORAGE_KEYS.favorites, []);
    return Array.isArray(list) ? list : [];
  }

  function isFavorite(id) {
    var list = getFavorites();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return true;
    }
    return false;
  }

  function toggleFavorite(item) {
    var list = getFavorites();
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === item.id) { index = i; break; }
    }
    if (index >= 0) {
      list.splice(index, 1);
      writeJSON(store, STORAGE_KEYS.favorites, list);
      return false;
    }
    list.unshift({
      id: item.id,
      name: item.name,
      group: item.group || '',
      logo: item.logo || '',
      url: item.url || '',
      kind: item.kind || 'live',
      addedAt: Date.now()
    });
    if (list.length > FAVORITES_LIMIT) list.length = FAVORITES_LIMIT;
    writeJSON(store, STORAGE_KEYS.favorites, list);
    return true;
  }

  function getHistory() {
    var list = readJSON(store, STORAGE_KEYS.history, []);
    return Array.isArray(list) ? list : [];
  }

  function pushHistory(item) {
    var list = getHistory().filter(function (entry) { return entry.id !== item.id; });
    list.unshift({
      id: item.id,
      name: item.name,
      group: item.group || '',
      logo: item.logo || '',
      url: item.url || '',
      kind: item.kind || 'live',
      playedAt: Date.now()
    });
    if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
    writeJSON(store, STORAGE_KEYS.history, list);
    return list;
  }

  function clearHistory() {
    writeJSON(store, STORAGE_KEYS.history, []);
  }

  function removeFavorite(id) {
    var list = getFavorites().filter(function (entry) { return entry.id !== id; });
    writeJSON(store, STORAGE_KEYS.favorites, list);
    return list;
  }

  function getLastChannelId() {
    return readJSON(store, STORAGE_KEYS.lastChannel, null);
  }

  function setLastChannelId(id) {
    writeJSON(store, STORAGE_KEYS.lastChannel, id);
  }

  function clearAll() {
    var keys = [];
    var i;
    for (i = 0; i < store.length; i++) {
      var key = store.key(i);
      if (key && key.indexOf('nvt_') === 0) keys.push(key);
    }
    for (i = 0; i < keys.length; i++) {
      try { store.removeItem(keys[i]); } catch (e) { /* ignorado */ }
    }
  }

  function usageBytes() {
    var total = 0;
    var i;
    for (i = 0; i < store.length; i++) {
      var key = store.key(i);
      var value = store.getItem(key);
      total += (key ? key.length : 0) + (value ? value.length : 0);
    }
    return total * 2;
  }

  return {
    getPrefs: getPrefs,
    setPrefs: setPrefs,
    getSources: getSources,
    setSources: setSources,
    addSource: addSource,
    updateSource: updateSource,
    removeSource: removeSource,
    getActiveSource: getActiveSource,
    setActiveSource: setActiveSource,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    removeFavorite: removeFavorite,
    getHistory: getHistory,
    pushHistory: pushHistory,
    clearHistory: clearHistory,
    getLastChannelId: getLastChannelId,
    setLastChannelId: setLastChannelId,
    clearAll: clearAll,
    usageBytes: usageBytes,
    backend: store
  };
}
