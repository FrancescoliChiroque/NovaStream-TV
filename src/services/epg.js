/**
 * Servicio de guia electronica (XMLTV).
 * Descarga, parsea e indexa la guia; cache en memoria y copia ligera en
 * IndexedDB para no volver a descargarla en cada arranque.
 */

import { CACHE_TTL, NET_CONFIG } from '../config.js';
import { parseXmltv, buildEpgIndex } from '../data/xmltv.js';
import { assertSafeUrl } from '../core/url.js';
import { NovaError, ERROR_CODES } from '../core/errors.js';
import { logger } from '../core/logger.js';

export function createEpgService(deps) {
  var http = deps.http;
  var bus = deps.bus;
  var cache = deps.cache;
  var idb = deps.idb || null;
  var index = Object.create(null);
  var loadedUrl = '';
  var loading = false;

  function channelKeys(channel) {
    var keys = [];
    if (channel.tvgId) keys.push(channel.tvgId);
    if (channel.id) keys.push(channel.id);
    if (channel.name) keys.push(channel.name);
    return keys;
  }

  function findProgramme(channel, nowMs) {
    var keys = channelKeys(channel);
    var now = nowMs || Date.now();
    for (var k = 0; k < keys.length; k++) {
      var list = index[keys[k]];
      if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item.startMs === null || item.stopMs === null) continue;
        if (item.startMs <= now && item.stopMs > now) return item;
      }
    }
    return null;
  }

  function nextProgramme(channel, nowMs) {
    var keys = channelKeys(channel);
    var now = nowMs || Date.now();
    for (var k = 0; k < keys.length; k++) {
      var list = index[keys[k]];
      if (!list) continue;
      for (var i = 0; i < list.length; i++) {
        if (list[i].startMs !== null && list[i].startMs > now) return list[i];
      }
    }
    return null;
  }

  function load(url, opts) {
    var options = opts || {};
    if (!url) {
      return Promise.reject(new NovaError(ERROR_CODES.UNSUPPORTED, 'No hay URL de guia configurada'));
    }
    var safeUrl;
    try {
      safeUrl = assertSafeUrl(url);
    } catch (err) {
      return Promise.reject(err);
    }
    if (!options.force && safeUrl === loadedUrl && Object.keys(index).length) {
      return Promise.resolve({ channels: Object.keys(index).length, cached: true });
    }
    var cacheKey = 'epg:' + safeUrl;
    if (!options.force) {
      var cached = cache.get(cacheKey);
      if (cached) {
        index = cached;
        loadedUrl = safeUrl;
        return Promise.resolve({ channels: Object.keys(index).length, cached: true });
      }
    }
    if (loading) return Promise.reject(new NovaError(ERROR_CODES.NETWORK, 'Guia ya en curso'));
    loading = true;
    bus.emit('epg:loading', { url: safeUrl });
    return http.getText(safeUrl, {
      timeoutMs: NET_CONFIG.requestTimeoutMs,
      maxBytes: NET_CONFIG.maxEpGBytes
    }).then(function (text) {
      var parsed = parseXmltv(text);
      index = buildEpgIndex(parsed);
      loadedUrl = safeUrl;
      cache.set(cacheKey, index, CACHE_TTL.epg);
      if (idb && idb.put) {
        idb.put('epg:' + safeUrl, { index: index, loadedAt: Date.now() }).catch(function (err) {
          logger.debug('no se pudo persistir la guia', err && err.message);
        });
      }
      bus.emit('epg:loaded', { url: safeUrl, programmes: parsed.programmes.length });
      return { channels: Object.keys(index).length, cached: false };
    }).catch(function (err) {
      bus.emit('epg:error', { url: safeUrl, error: err });
      throw err;
    }).then(function (value) {
      loading = false;
      return value;
    }, function (err) {
      loading = false;
      throw err;
    });
  }

  return {
    load: load,
    isLoaded: function () { return Object.keys(index).length > 0; },
    current: findProgramme,
    next: nextProgramme,
    programmesFor: function (channelId) { return index[channelId] || []; },
    clear: function () {
      index = Object.create(null);
      loadedUrl = '';
      cache.remove('epg:' + loadedUrl);
    }
  };
}
