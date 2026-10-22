/*
 * NovaStream TV - JS Service (Luna) de descarga.
 *
 * Motivo: una app web empaquetada se sirve desde file:// y su origen es
 * "null", por lo que fetch() contra un servidor IPTV habitual falla por
 * CORS. Este servicio hace la peticion desde el propio televisor (Node.js)
 * y devuelve el cuerpo de la respuesta a la app.
 *
 * Limitaciones y seguridad:
 *  - Solo se admiten http:// y https://.
 *  - Tiempos de espera y tamano maximo de respuesta acotados.
 *  - Se siguen hasta 3 redirecciones.
 *  - El servicio es local del televisor: cualquier app instalada en el mismo
 *    televisor, en teoria, podria usarlo como proxy. Se limita a GET sin cabeceras
 *    de autenticacion y con un limite de tamano, y la app es la unica que
 *    lo usa. Para un uso domestico es aceptable; en un entorno corporativo
 *    conviene revisar la lista de destinos permitidos.
 *
 * Compatible con el Node.js de webOS 6.0 (Node 12): sin sintaxis moderna
 * (optional chaining, nullish coalescing, fetch nativo, etc.).
 */

/* eslint-disable no-var */
/* eslint-disable import/no-unresolved */
var pkgInfo = require('./package.json');
var Service = require('webos-service');
var http = require('http');
var https = require('https');
var urlModule = require('url');
var zlib = require('zlib');

var service = new Service(pkgInfo.name);

var MAX_BYTES = 12 * 1024 * 1024;
var TIMEOUT_MS = 20000;
var MAX_REDIRECTS = 3;

/** Comprueba que la URL es http/https y normaliza el formato. */
function parseTarget(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) {
    throw new Error('Falta el parametro url');
  }
  var parsed = urlModule.parse(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se admiten URLs http y https');
  }
  if (!parsed.hostname) {
    throw new Error('URL invalida');
  }
  return parsed;
}

function decompress(buffer, encoding) {
  return new Promise(function (resolve, reject) {
    if (!encoding) {
      resolve(buffer);
      return;
    }
    var enc = String(encoding).toLowerCase();
    if (enc === 'gzip') {
      zlib.gunzip(buffer, function (err, out) { err ? reject(err) : resolve(out); });
      return;
    }
    if (enc === 'deflate') {
      zlib.inflate(buffer, function (err, out) { err ? reject(err) : resolve(out); });
      return;
    }
    if (enc === 'br' && zlib.brotliDecompress) {
      zlib.brotliDecompress(buffer, function (err, out) { err ? reject(err) : resolve(out); });
      return;
    }
    resolve(buffer);
  });
}

/** Descarga una URL y devuelve el texto de la respuesta. */
function download(rawUrl, redirectsLeft) {
  var parsed = parseTarget(rawUrl);
  var client = parsed.protocol === 'https:' ? https : http;

  return new Promise(function (resolve, reject) {
    var settled = false;
    function finish(err, value) {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve(value);
    }

    var request = client.get({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      headers: {
        'User-Agent': 'NovaStreamTV/1.0 (webOS)',
        'Accept': '*/*'
      },
      rejectUnauthorized: false
    }, function (response) {
      var status = response.statusCode;

      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (!redirectsLeft) {
          finish(new Error('Demasiadas redirecciones'));
          return;
        }
        var next = urlModule.resolve(rawUrl, response.headers.location);
        download(next, redirectsLeft - 1).then(function (text) { finish(null, text); }, finish);
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        finish(new Error('HTTP ' + status));
        return;
      }

      var chunks = [];
      var received = 0;
      response.on('data', function (chunk) {
        received += chunk.length;
        if (received > MAX_BYTES) {
          request.abort();
          finish(new Error('Respuesta demasiado grande'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', finish);
      response.on('end', function () {
        decompress(Buffer.concat(chunks), response.headers['content-encoding'])
          .then(function (buffer) { finish(null, buffer.toString('utf8')); }, finish);
      });
    });

    request.setTimeout(TIMEOUT_MS, function () {
      request.abort();
      finish(new Error('Tiempo de espera agotado'));
    });
    request.on('error', function (err) {
      finish(new Error(err && err.message ? err.message : 'Error de red'));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Metodos del servicio                                                */
/* ------------------------------------------------------------------ */

service.register('ping', function (message) {
  message.respond({ returnValue: true, service: pkgInfo.name, version: pkgInfo.version });
});

service.register('fetchText', function (message) {
  var payload = message.payload || {};
  download(payload.url, MAX_REDIRECTS).then(function (text) {
    message.respond({ returnValue: true, text: text });
  }).catch(function (err) {
    message.respond({
      returnValue: false,
      errorText: err && err.message ? err.message : 'Error desconocido',
      errorCode: 1
    });
  });
});
