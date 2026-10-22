/**
 * Catalogo de peliculas y series.
 * - Fuente M3U: las entradas marcadas como VOD (grupo) se tratan como
 *   peliculas; no hay capitulos ni metadatos fiables.
 * - Fuente Xtream: se usan los endpoints del proveedor.
 */

import { CACHE_TTL } from '../config.js';
import { deobfuscateSecret } from '../core/storage.js';
import { createXtreamClient } from '../data/xtream.js';
import { NovaError, ERROR_CODES } from '../core/errors.js';

export function createCatalogService(deps) {
  var http = deps.http;
  var cache = deps.cache;

  function isXtream(source) {
    return source && source.type === 'xtream';
  }

  function xtreamClient(source) {
    return createXtreamClient({
      baseUrl: source.url,
      username: deobfuscateSecret(source.username),
      password: deobfuscateSecret(source.password),
      http: http
    });
  }

  function loadMovies(source, opts) {
    var options = opts || {};
    if (!source) return Promise.resolve([]);
    var cacheKey = 'movies:' + source.id;
    if (!options.force) {
      var cached = cache.get(cacheKey);
      if (cached) return Promise.resolve(cached);
    }
    if (isXtream(source)) {
      var client = xtreamClient(source);
      return client.getVodCategories().then(function (categories) {
        return client.getVodStreams().then(function (streams) {
          var byId = Object.create(null);
          categories.forEach(function (cat) { byId[cat.id] = cat.name; });
          streams.forEach(function (stream) {
            if (stream.group && byId[stream.group]) stream.group = byId[stream.group];
          });
          cache.set(cacheKey, streams, CACHE_TTL.catalog);
          return streams;
        });
      });
    }
    return Promise.resolve([]);
  }

  function loadSeries(source, opts) {
    var options = opts || {};
    if (!source) return Promise.resolve([]);
    if (!isXtream(source)) return Promise.resolve([]);
    var cacheKey = 'series:' + source.id;
    if (!options.force) {
      var cached = cache.get(cacheKey);
      if (cached) return Promise.resolve(cached);
    }
    var client = xtreamClient(source);
    return client.getSeriesCategories().then(function (categories) {
      return client.getSeries().then(function (series) {
        var byId = Object.create(null);
        categories.forEach(function (cat) { byId[cat.id] = cat.name; });
        series.forEach(function (item) {
          if (item.group && byId[item.group]) item.group = byId[item.group];
        });
        cache.set(cacheKey, series, CACHE_TTL.catalog);
        return series;
      });
    });
  }

  function loadEpisodes(source, seriesItem, opts) {
    var options = opts || {};
    if (!source || !isXtream(source)) {
      return Promise.reject(new NovaError(ERROR_CODES.UNSUPPORTED, 'Las series requieren una fuente Xtream Codes'));
    }
    var cacheKey = 'episodes:' + source.id + ':' + seriesItem.xtreamId;
    if (!options.force) {
      var cached = cache.get(cacheKey);
      if (cached) return Promise.resolve(cached);
    }
    return xtreamClient(source).getSeriesInfo(seriesItem.xtreamId).then(function (result) {
      cache.set(cacheKey, result.episodes, CACHE_TTL.catalog);
      return result.episodes;
    });
  }

  return {
    loadMovies: loadMovies,
    loadSeries: loadSeries,
    loadEpisodes: loadEpisodes
  };
}
