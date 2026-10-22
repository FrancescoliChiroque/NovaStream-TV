/**
 * Parser de listas M3U/M3U8.
 * Formato soportado: el habitual de proveedores IPTV
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Nombre
 *   http://servidor/canal.ts
 *
 * No descarga nada: solo transforma texto en estructura.
 */

import { NovaError, ERROR_CODES } from '../core/errors.js';

var VOD_GROUP_RE = /(vod|filmes|peliculas|pel[ií]culas|movies|series[\s-]*\/?\s*vod)/i;

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parsea los atributos key="value" de una linea #EXTINF. */
export function parseAttributes(input) {
  var attrs = {};
  var re = /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/g;
  var match;
  while ((match = re.exec(input)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  var single = /([A-Za-z0-9_-]+)\s*=\s*'([^']*)'/g;
  while ((match = single.exec(input)) !== null) {
    if (!Object.prototype.hasOwnProperty.call(attrs, match[1].toLowerCase())) {
      attrs[match[1].toLowerCase()] = match[2];
    }
  }
  return attrs;
}

/** Normaliza un nombre de canal: quita etiquetas y espacios sobrantes. */
export function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text contenido de la playlist
 * @returns {{channels: Array, groups: Array, stats: Object}}
 */
export function parseM3U(text) {
  if (typeof text !== 'string') {
    throw new NovaError(ERROR_CODES.PARSE, 'La playlist no es texto');
  }
  var content = stripBom(text);
  var lines = content.split(/\r?\n/);
  var channels = [];
  var groups = [];
  var seenGroups = Object.create(null);
  var pending = null;
  var pendingGroup = '';
  var pendingOpts = null;
  var index = 0;
  var malformed = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    if (line.charAt(0) === '#') {
      var upper = line.toUpperCase();
      if (upper.indexOf('#EXTINF:') === 0) {
        var payload = line.slice(8);
        var commaAt = payload.indexOf(',');
        var head = commaAt >= 0 ? payload.slice(0, commaAt) : payload;
        var title = commaAt >= 0 ? payload.slice(commaAt + 1) : '';
        var attrs = parseAttributes(head);
        pending = {
          title: cleanName(title),
          attrs: attrs,
          duration: (head.split(/\s+/)[0] || '').replace('-', '')
        };
        pendingGroup = attrs['group-title'] || '';
        pendingOpts = null;
      } else if (upper.indexOf('#EXTGRP:') === 0) {
        pendingGroup = line.slice(8).trim();
      } else if (upper.indexOf('#EXTVLCOPT:') === 0 || upper.indexOf('#EXT-X-') === 0 || upper.indexOf('#KODIPROP:') === 0) {
        pendingOpts = pendingOpts || {};
        pendingOpts[line.slice(line.indexOf(':') + 1).split('=')[0]] = line.slice(line.indexOf('=') + 1);
      }
      continue;
    }

    // URL
    var channel = {
      id: '',
      name: pending ? (pending.title || pending.attrs['tvg-name'] || 'Canal ' + (index + 1)) : 'Canal ' + (index + 1),
      logo: pending ? (pending.attrs['tvg-logo'] || '') : '',
      group: pendingGroup || (pending ? (pending.attrs['group-title'] || '') : ''),
      url: line,
      tvgId: pending ? (pending.attrs['tvg-id'] || '') : '',
      attrs: pending ? pending.attrs : {},
      options: pendingOpts || {},
      kind: 'live',
      index: index
    };
    if (!channel.name) channel.name = 'Canal ' + (index + 1);
    if (VOD_GROUP_RE.test(channel.group)) channel.kind = 'vod';
    if (pending && pending.attrs['radio'] === 'true') channel.kind = 'radio';
    channel.id = buildChannelId(channel, index);
    channels.push(channel);

    if (channel.group && !seenGroups[channel.group]) {
      seenGroups[channel.group] = true;
      groups.push(channel.group);
    }
    index++;
    pending = null;
    pendingGroup = '';
    pendingOpts = null;
  }

  return {
    channels: channels,
    groups: groups.sort(function (a, b) { return a.localeCompare(b, 'es'); }),
    stats: {
      total: channels.length,
      groups: groups.length,
      malformed: malformed
    }
  };
}

/** Id estable: tvg-id si existe, si no hash del nombre+url. */
export function buildChannelId(channel, index) {
  if (channel.tvgId) return 'tvg:' + channel.tvgId;
  var raw = (channel.name || '') + '|' + (channel.url || '') + '|' + (index === undefined ? '' : index);
  var hash = 5381;
  for (var i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
  }
  return 'ch:' + hash.toString(36);
}

/** Agrupa canales por grupo, ordenado alfabeticamente. */
export function groupChannels(channels) {
  var map = Object.create(null);
  var order = [];
  for (var i = 0; i < channels.length; i++) {
    var group = channels[i].group || 'Sin grupo';
    if (!map[group]) {
      map[group] = [];
      order.push(group);
    }
    map[group].push(channels[i]);
  }
  order.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  var result = [];
  for (var g = 0; g < order.length; g++) {
    result.push({ name: order[g], channels: map[order[g]] });
  }
  return result;
}
