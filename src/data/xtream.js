/**
 * Cliente de la API Xtream Codes.
 * Solo se usa si el proveedor autoriza el acceso y el usuario introduce
 * sus propias credenciales. Las URLs que contienen usuario/contrasena
 * nunca se registran en el log (ver core/logger.js).
 */

import { joinUrl, buildQuery } from '../core/url.js';
import { NovaError, ERROR_CODES } from '../core/errors.js';

function cleanBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function createXtreamClient(config) {
  var base = cleanBase(config && config.baseUrl);
  var username = (config && config.username) || '';
  var password = (config && config.password) || '';
  var http = config && config.http;
  if (!http) throw new NovaError(ERROR_CODES.UNSUPPORTED, 'Cliente HTTP no disponible');
  if (!base) throw new NovaError(ERROR_CODES.UNSUPPORTED, 'Servidor Xtream vacio');

  function apiUrl(action, params) {
    var query = buildQuery(Object.assign({ username: username, password: password, action: action }, params || {}));
    return joinUrl(base, 'player_api.php') + '?' + query;
  }

  function call(action, params) {
    return http.getJson(apiUrl(action, params)).then(function (data) {
      if (data && data.user_info && data.user_info.auth !== 1 && data.user_info.auth !== 0) {
        throw new NovaError(ERROR_CODES.HTTP, 'Credenciales Xtream rechazadas');
      }
      return data;
    });
  }

  function normalizeLive(entry, categoryName) {
    var extension = entry.container_extension || 'ts';
    return {
      id: 'xtr_live_' + entry.stream_id,
      xtreamId: entry.stream_id,
      name: entry.name || ('Canal ' + entry.stream_id),
      logo: entry.stream_icon || '',
      group: categoryName || 'Sin categoria',
      url: joinUrl(base, 'getlive/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + entry.stream_id + '.' + extension),
      kind: 'live',
      tvgId: entry.epg_channel_id || '',
      attributes: entry.custom_sid || ''
    };
  }

  function normalizeVod(entry, categoryName) {
    var extension = entry.container_extension || 'mp4';
    return {
      id: 'xtr_vod_' + entry.stream_id,
      xtreamId: entry.stream_id,
      name: entry.name || ('Video ' + entry.stream_id),
      logo: entry.stream_icon || '',
      group: categoryName || 'Sin categoria',
      url: joinUrl(base, 'movie/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + entry.stream_id + '.' + extension),
      kind: 'vod',
      plot: entry.plot || '',
      year: entry.releaseDate || '',
      rating: entry.rating || '',
      duration: entry.duration || '',
      tvgId: ''
    };
  }

  function normalizeSeries(entry, categoryName) {
    return {
      id: 'xtr_ser_' + entry.series_id,
      xtreamId: entry.series_id,
      name: entry.title || ('Serie ' + entry.series_id),
      logo: entry.cover || '',
      group: categoryName || 'Sin categoria',
      url: '',
      kind: 'series',
      plot: entry.plot || '',
      year: entry.releaseDate || '',
      rating: entry.rating || '',
      genres: entry.genres || '',
      cast: entry.cast || '',
      tvgId: ''
    };
  }

  return {
    getLiveCategories: function () {
      return call('get_live_categories').then(function (data) {
        return (data || []).map(function (cat) {
          return { id: String(cat.category_id), name: cat.category_name || 'Sin categoria' };
        });
      });
    },
    getLiveStreams: function (categoryId) {
      var params = categoryId ? { category_id: categoryId } : {};
      return call('get_live_streams', params).then(function (data) {
        return (data || []).map(function (entry) {
          return normalizeLive(entry, entry.category_name);
        });
      });
    },
    getVodCategories: function () {
      return call('get_vod_categories').then(function (data) {
        return (data || []).map(function (cat) {
          return { id: String(cat.category_id), name: cat.category_name || 'Sin categoria' };
        });
      });
    },
    getVodStreams: function (categoryId) {
      var params = categoryId ? { category_id: categoryId } : {};
      return call('get_vod_streams', params).then(function (data) {
        return (data || []).map(function (entry) {
          return normalizeVod(entry, entry.category_name);
        });
      });
    },
    getSeriesCategories: function () {
      return call('get_series_categories').then(function (data) {
        return (data || []).map(function (cat) {
          return { id: String(cat.category_id), name: cat.category_name || 'Sin categoria' };
        });
      });
    },
    getSeries: function (categoryId) {
      var params = categoryId ? { category_id: categoryId } : {};
      return call('get_series', params).then(function (data) {
        return (data || []).map(function (entry) {
          return normalizeSeries(entry, entry.category_name);
        });
      });
    },
    getSeriesInfo: function (seriesId) {
      return call('get_series_info', { series_id: seriesId }).then(function (data) {
        var info = (data && data.info && data.info[0]) || {};
        var episodes = [];
        var seasons = (data && data.episodes && data.episodes[info.season]) || [];
        for (var i = 0; i < seasons.length; i++) {
          var ep = seasons[i];
          episodes.push({
            id: 'xtr_ep_' + info.id + '_' + ep.id,
            name: ep.title || ('Episodio ' + ep.episode_num),
            number: ep.episode_num,
            season: info.season,
            plot: ep.plot || '',
            logo: ep.movie_image || '',
            url: joinUrl(base, 'series/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + ep.id + '.' + (ep.container_extension || 'mkv')),
            kind: 'episode'
          });
        }
        return { info: normalizeSeries(Object.assign({ series_id: info.id, title: info.title, cover: info.cover, plot: info.plot, releaseDate: info.releaseDate, rating: info.rating, genres: info.genres, cast: info.cast }, info), info.category_name), episodes: episodes };
      });
    },
    getShortEpg: function (streamId, limit) {
      return call('get_short_epg', { stream_id: streamId, limit: limit || 8 }).then(function (data) {
        return (data && data.epg_listings) || [];
      });
    }
  };
}
