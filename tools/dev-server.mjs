/**
 * Servidor estatico para desarrollo.
 * Sirve la raiz del repositorio para que los ES Modules funcionen
 * (en webOS, desde file:// los modulos estan bloqueados por CORS).
 *
 * Ademas expone /api/fetch?url=... : descarga en el PC la URL indicada y
 * devuelve el cuerpo. Es el equivalente en modo navegador del JS Service del
 * IPK y sirve para probar en TVs con webOS Hub donde no se puede instalar
 * el paquete (no hay daemon SSH en el puerto 9922).
 *
 * Uso: node tools/dev-server.mjs [--port 3000]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PROXY_BYTES = 12 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.m3u': 'text/plain; charset=utf-8',
  '.m3u8': 'text/plain; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
  '.woff2': 'font/woff2'
};

/**
 * Mock minimo de la API Xtream Codes para probar el camino Xtream sin
 * proveedor real. Se usa con:
 *   URL base : http://<ip-pc>:3000/xtream
 *   usuario : demo
 *   clave   : demo
 */
const XTREAM_STREAMS = [
  { stream_id: 101, name: 'Demo BipBop', category_id: 1, category_name: 'Demostracion', epg_channel_id: 'demo-bipbop', container_extension: 'm3u8' },
  { stream_id: 102, name: 'Demo Mux', category_id: 1, category_name: 'Demostracion', epg_channel_id: 'demo-mux', container_extension: 'm3u8' }
];

const XTREAM_VOD = [
  { stream_id: 201, name: 'Demo Pelicula', category_id: 5, category_name: 'Peliculas', plot: 'Pelicula de prueba', releaseDate: '2024', rating: '7', container_extension: 'mp4' }
];

const XTREAM_SERIES = [
  { series_id: 301, title: 'Demo Serie', category_id: 9, category_name: 'Series', plot: 'Serie de prueba', releaseDate: '2023', rating: '8', cover: '' }
];

function xtreamMock(action) {
  switch (action) {
    case 'get_live_categories':
      return [{ category_id: 1, category_name: 'Demostracion', parent_id: 0 }];
    case 'get_live_streams':
      return XTREAM_STREAMS.map((entry) => Object.assign({}, entry, {
        num: 1,
        stream_icon: '',
        added: '1700000000',
        tv_archive: 0,
        direct_source: '',
        tv_archive_duration: 0
      }));
    case 'get_vod_categories':
      return [{ category_id: 5, category_name: 'Peliculas', parent_id: 0 }];
    case 'get_vod_streams':
      return XTREAM_VOD.map((entry) => Object.assign({}, entry, {
        stream_icon: '',
        duration_secs: 5400,
        video: { video_path: '' }
      }));
    case 'get_series_categories':
      return [{ category_id: 9, category_name: 'Series', parent_id: 0 }];
    case 'get_series':
      return XTREAM_SERIES.map((entry) => Object.assign({}, entry, {
        cover: '',
        cast: '',
        genres: 'Demo',
        releaseDate: '2023',
        rating: '8'
      }));
    case 'get_series_info':
      return {
        info: [{
          id: 301,
          title: 'Demo Serie',
          season: 1,
          cover: '',
          plot: 'Serie de prueba',
          releaseDate: '2023',
          rating: '8',
          genres: 'Demo',
          cast: '',
          category_name: 'Series'
        }],
        episodes: {
          1: [
            { id: 401, episode_num: 1, title: 'Episodio 1', plot: 'Primer episodio', container_extension: 'mp4', movie_image: '' },
            { id: 402, episode_num: 2, title: 'Episodio 2', plot: 'Segundo episodio', container_extension: 'mp4', movie_image: '' }
          ]
        }
      };
    case 'get_short_epg':
      return {
        epg_listings: [
          { id: 1, title: 'Demo en emision', start_timestamp: '1700000000', stop_timestamp: '2000000000', description: 'Emision de prueba permanente' }
        ]
      };
    case 'get_simple_data_table':
      return { data: [] };
    default:
      return { user_info: { auth: 1, status: 'Active', message: 'OK' } };
  }
}

function getPort() {
  const index = process.argv.indexOf('--port');
  if (index >= 0 && process.argv[index + 1]) return parseInt(process.argv[index + 1], 10);
  return 3000;
}

function localAddresses() {
  const found = [];
  const interfaces = networkInterfaces();
  Object.keys(interfaces).forEach((name) => {
    (interfaces[name] || []).forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address);
    });
  });
  return found;
}

/** Descarga una URL desde el PC y devuelve el cuerpo como texto. */
async function proxyFetch(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return { status: 400, body: 'URL no valida' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { status: 400, body: 'Solo se permiten http y https' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'NovaStreamTV-devproxy/1.0' }
    });
    if (!response.ok) {
      return { status: response.status, body: 'Error HTTP ' + response.status };
    }
    const text = await response.text();
    if (text.length > MAX_PROXY_BYTES) {
      return { status: 413, body: 'Respuesta demasiado grande' };
    }
    return { status: 200, body: text };
  } catch (err) {
    const message = err && err.name === 'AbortError' ? 'Tiempo de espera agotado' : String(err && err.message || err);
    return { status: 502, body: 'No se pudo descargar: ' + message };
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const started = Date.now();
    res.on('finish', () => {
      // Registro de peticiones: permite ver en el log que esta pidiendo el
      // televisor (util para depurar desde el PC).
      const target = url.pathname === '/api/fetch'
        ? url.searchParams.get('url')
        : null;
      const extra = target ? ' -> ' + target : '';
      console.log(
        new Date().toISOString().slice(11, 19),
        req.method,
        url.pathname + (target ? '?url=' + encodeURIComponent(target) : ''),
        res.statusCode,
        (Date.now() - started) + 'ms' + extra
      );
    });

    if (url.pathname === '/api/fetch') {
      const target = url.searchParams.get('url');
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Falta el parametro url');
        return;
      }
      const result = await proxyFetch(target);
      res.writeHead(result.status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }).end(result.body);
      return;
    }

    if (url.pathname === '/xtream/player_api.php') {
      const action = url.searchParams.get('action') || '';
      const body = JSON.stringify(xtreamMock(action));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }).end(body);
      return;
    }

    // Las URLs de stream del mock Xtream (getlive/movie/series) se
    // redirigen a streams publicos de prueba para que se puedan reproducir.
    if (url.pathname.indexOf('/xtream/getlive/') === 0) {
      const id = url.pathname.split('/').pop();
      const target = id.indexOf('102') !== -1
        ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
        : 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8';
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' }).end();
      return;
    }

    if (url.pathname.indexOf('/xtream/movie/') === 0 || url.pathname.indexOf('/xtream/series/') === 0) {
      const target = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' }).end();
      return;
    }

    let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Prohibido');
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado: ' + url.pathname);
      return;
    }
    const body = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Error: ' + err.message);
  }
});

server.listen(getPort(), () => {
  const port = getPort();
  console.log(`NovaStream TV en desarrollo: http://localhost:${port}/`);
  localAddresses().forEach((address) => {
    console.log(`Desde el televisor (misma red): http://${address}:${port}/`);
  });
  console.log('Proxy de descarga: /api/fetch?url=<url>');
  console.log('Ctrl+C para parar.');
});
