/**
 * Servicio de fuentes: M3U/M3U8 por URL y Xtream Codes API.
 * Centraliza la descarga, el cache, la normalizacion y el refresco.
 */

import { CACHE_TTL, NET_CONFIG } from '../config.js';
import { parseM3U } from '../data/m3u.js';
import { createXtreamClient } from '../data/xtream.js';
import { assertSafeUrl } from '../core/url.js';
import { NovaError, ERROR_CODES } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { deobfuscateSecret } from '../core/storage.js';

export function createSourceService(deps) {
  var storage = deps.storage;
  var http = deps.http;
  var bus = deps.bus;
  var cache = deps.cache;
  var state = { channels: [], groups: [], source: null, loading: false };

  function listSources() {
    return storage.getSources();
  }

  function addSource(config) {
    var type = config.type || 'm3u';
    if (type === 'm3u') {
      assertSafeUrl(config.url);
    } else if (type === 'xtream') {
      assertSafeUrl(config.baseUrl, { allowCredentials: true });
      if (!config.username || !config.password) {
        throw new NovaError(ERROR_CODES.UNSUPPORTED, 'Faltan usuario o contrasena');
      }
    } else {
      throw new NovaError(ERROR_CODES.UNSUPPORTED, 'Tipo de fuente desconocido: ' + type);
    }
    var record = storage.addSource({
      name: config.name || (type === 'xtream' ? 'Xtream' : 'Lista M3U'),
      type: type,
      url: config.url || config.baseUrl || '',
      epgUrl: config.epgUrl || '',
      username: config.username || '',
      password: config.password || ''
    });
    if (!storage.getActiveSource()) {
      storage.setActiveSource(record.id);
    }
    return record;
  }

  function updateSource(id, patch) {
    return storage.updateSource(id, patch);
  }

  function removeSource(id) {
    storage.removeSource(id);
    cache.remove('channels:' + id);
    return listSources();
  }

  function activate(id) {
    storage.setActiveSource(id);
    cache.remove('channels:' + id);
    state.channels = [];
    state.groups = [];
    return storage.getActiveSource();
  }

  function getActiveSource() {
    return storage.getActiveSource();
  }

  function fetchM3U(source) {
    var url = assertSafeUrl(source.url);
    return http.getText(url, {
      timeoutMs: NET_CONFIG.requestTimeoutMs,
      maxBytes: NET_CONFIG.maxPlaylistBytes
    }).then(function (text) {
      var parsed = parseM3U(text);
      if (!parsed.channels.length) {
        throw new NovaError(ERROR_CODES.EMPTY, 'La lista no contiene canales');
      }
      return parsed;
    });
  }

  function fetchXtream(source) {
    var client = createXtreamClient({
      baseUrl: source.url,
      username: deobfuscateSecret(source.username),
      password: deobfuscateSecret(source.password),
      http: http
    });
    return client.getLiveCategories().then(function (categories) {
      return client.getLiveStreams().then(function (streams) {
        var byId = Object.create(null);
        categories.forEach(function (cat) { byId[cat.id] = cat.name; });
        streams.forEach(function (stream) {
          if (stream.group && byId[stream.group]) stream.group = byId[stream.group];
        });
        return { channels: streams, groups: categories.map(function (c) { return c.name; }) };
      });
    });
  }

  /**
   * Carga los canales de la fuente activa.
   * @param {{force?:boolean}} [opts]
   */
  function loadChannels(opts) {
    var options = opts || {};
    var source = getActiveSource();
    if (!source) {
      state.channels = [];
      state.groups = [];
      state.source = null;
      return Promise.resolve({ channels: [], groups: [], source: null });
    }
    var cacheKey = 'channels:' + source.id;
    if (!options.force) {
      var cached = cache.get(cacheKey);
      if (cached) {
        state.channels = cached.channels;
        state.groups = cached.groups;
        state.source = source;
        return Promise.resolve({ channels: cached.channels, groups: cached.groups, source: source, cached: true });
      }
    }
    if (state.loading) {
      return Promise.reject(new NovaError(ERROR_CODES.NETWORK, 'Carga ya en curso'));
    }
    state.loading = true;
    bus.emit('sources:loading', { source: source });
    var promise = (source.type === 'xtream' ? fetchXtream(source) : fetchM3U(source))
      .then(function (result) {
        state.channels = result.channels;
        state.groups = result.groups;
        state.source = source;
        cache.set(cacheKey, { channels: result.channels, groups: result.groups }, CACHE_TTL.playlist);
        bus.emit('sources:loaded', { source: source, count: result.channels.length });
        return { channels: result.channels, groups: result.groups, source: source, cached: false };
      })
      .catch(function (err) {
        logger.warn('no se pudo cargar la fuente', err && err.message);
        bus.emit('sources:error', { source: source, error: err });
        throw err;
      })
      .then(function (value) {
        state.loading = false;
        return value;
      }, function (err) {
        state.loading = false;
        throw err;
      });
    return promise;
  }

  function refresh() {
    var source = getActiveSource();
    if (!source) return Promise.resolve(null);
    cache.remove('channels:' + source.id);
    return loadChannels({ force: true });
  }

  return {
    listSources: listSources,
    addSource: addSource,
    updateSource: updateSource,
    removeSource: removeSource,
    activate: activate,
    getActiveSource: getActiveSource,
    loadChannels: loadChannels,
    refresh: refresh,
    getState: function () { return state; },
    isLoading: function () { return state.loading; }
  };
}
