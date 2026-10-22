/**
 * Parser de guia electronica XMLTV (subset habitual).
 * Escaneo por indices en vez de DOMParser para que funcione igual en el
 * televisor (sin DOM) y en las pruebas de Node, y para no cargar el
 * documento completo en memoria como un arbol XML.
 */

function decodeEntities(text) {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(text) {
  var raw = String(text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeEntities(raw.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attrValue(tag, name) {
  var re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  var match = re.exec(tag);
  return match ? decodeEntities(match[1]) : '';
}

/**
 * @param {string} text contenido XMLTV
 * @returns {{channels: Array, programmes: Array}}
 */
export function parseXmltv(text) {
  if (typeof text !== 'string') {
    return { channels: [], programmes: [] };
  }
  var channels = [];
  var programmes = [];

  var channelRe = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
  var match;
  while ((match = channelRe.exec(text)) !== null) {
    var attrs = match[1];
    var body = match[2];
    var id = attrValue(attrs, 'id');
    var name = '';
    var logo = '';
    var nameMatch = /<display-name\b[^>]*>([\s\S]*?)<\/display-name>/i.exec(body);
    if (nameMatch) name = stripTags(nameMatch[1]);
    var iconMatch = /<icon\b([^>]*)\/?>/i.exec(body);
    if (iconMatch) logo = attrValue(iconMatch[1], 'src');
    channels.push({ id: id, name: name, logo: logo });
  }

  var progRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  while ((match = progRe.exec(text)) !== null) {
    var pAttrs = match[1];
    var pBody = match[2];
    var channel = attrValue(pAttrs, 'channel');
    var start = attrValue(pAttrs, 'start');
    var stop = attrValue(pAttrs, 'stop');
    var titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(pBody);
    var descMatch = /<desc\b[^>]*>([\s\S]*?)<\/desc>/i.exec(pBody);
    var iconMatch = /<icon\b([^>]*)\/?>/i.exec(pBody);
    programmes.push({
      channel: channel,
      start: start,
      stop: stop,
      title: stripTags(titleMatch ? titleMatch[1] : ''),
      description: stripTags(descMatch ? descMatch[1] : ''),
      icon: iconMatch ? attrValue(iconMatch[1], 'src') : ''
    });
  }

  return { channels: channels, programmes: programmes };
}

/** Convierte "20240101120000 +0000" a milisegundos epoch. */
export function parseXmltvTime(value) {
  if (!value || typeof value !== 'string') return null;
  var match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(value.trim());
  if (!match) return null;
  var year = parseInt(match[1], 10);
  var month = parseInt(match[2], 10) - 1;
  var day = parseInt(match[3], 10);
  var hour = parseInt(match[4], 10);
  var minute = parseInt(match[5], 10);
  var second = match[6] ? parseInt(match[6], 10) : 0;
  var offsetMinutes = 0;
  if (match[7]) {
    var sign = match[7].charAt(0) === '-' ? -1 : 1;
    var off = parseInt(match[7].slice(1, 3), 10) * 60 + parseInt(match[7].slice(3, 5), 10);
    offsetMinutes = sign * off;
  }
  return Date.UTC(year, month, day, hour, minute, second) - offsetMinutes * 60000;
}

/**
 * Indexa los programas por canal y devuelve los que estan en curso.
 */
export function buildEpgIndex(parsed) {
  var byChannel = Object.create(null);
  for (var i = 0; i < parsed.programmes.length; i++) {
    var programme = parsed.programmes[i];
    var start = parseXmltvTime(programme.start);
    var stop = parseXmltvTime(programme.stop);
    programme.startMs = start;
    programme.stopMs = stop;
    var key = programme.channel;
    if (!byChannel[key]) byChannel[key] = [];
    byChannel[key].push(programme);
  }
  for (var channelId in byChannel) {
    if (!Object.prototype.hasOwnProperty.call(byChannel, channelId)) continue;
    byChannel[channelId].sort(function (a, b) { return (a.startMs || 0) - (b.startMs || 0); });
  }
  return byChannel;
}

/** Programa en curso y siguiente para un canal. */
export function currentProgrammes(index, channelId, nowMs) {
  var list = index[channelId] || [];
  var now = nowMs || Date.now();
  var current = null;
  var next = null;
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (item.startMs === null || item.stopMs === null) continue;
    if (item.startMs <= now && item.stopMs > now) {
      current = item;
      if (list[i + 1]) next = list[i + 1];
      break;
    }
    if (item.startMs > now && !next) next = item;
  }
  return { current: current, next: next };
}
