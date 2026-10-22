/**
 * Reproductor de video.
 * Define el contrato de un adaptador y elige el motor disponible:
 *  - "native": elemento <video> con HLS nativo (soportado por webOS TV 3.0+).
 *  - "mse":    adaptador opcional con Shaka Player (no se empaqueta por
 *               defecto; solo se usa si el proveedor exige DASH/DRM y el
 *               usuario deja el fichero del motor en el paquete).
 * La interfaz permite sustituir el motor sin tocar el resto de la app.
 */

import { NovaError, ERROR_CODES } from '../core/errors.js';
import { NET_CONFIG } from '../config.js';
import { logger } from '../core/logger.js';

export const MEDIA_ERRORS = {
  1: 'Carga abortada',
  2: 'Error de red al reproducir',
  3: 'Error de decodificacion',
  4: 'Formato o fuente no compatible'
};

function mediaErrorToNova(video) {
  var err = video && video.error;
  var code = err && err.code ? err.code : 0;
  var detail = MEDIA_ERRORS[code] || 'Fallo de reproduccion';
  var nova = new NovaError(ERROR_CODES.PLAYBACK, detail + ' (' + code + ')');
  nova.mediaCode = code;
  return nova;
}

/** Adaptador nativo: <video> + HLS del propio televisor. */
export function createNativeAdapter(video) {
  var listeners = Object.create(null);
  var currentSrc = '';
  var lastError = null;

  function emit(name, payload) {
    var list = listeners[name] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { /* ignorado */ }
    }
  }

  video.addEventListener('error', function () {
    lastError = mediaErrorToNova(video);
    emit('error', lastError);
  });
  video.addEventListener('waiting', function () { emit('buffering', true); });
  video.addEventListener('playing', function () { emit('buffering', false); });
  video.addEventListener('loadedmetadata', function () {
    emit('duration', video.duration);
  });
  video.addEventListener('timeupdate', function () {
    emit('time', video.currentTime);
  });

  return {
    name: 'native',
    get src() { return currentSrc; },
    load: function (src) {
      currentSrc = src;
      lastError = null;
      try {
        video.pause();
        video.removeAttribute('src');
        while (video.firstChild) video.removeChild(video.firstChild);
        video.load();
        video.src = src;
        video.load();
      } catch (e) {
        throw new NovaError(ERROR_CODES.PLAYBACK, 'No se pudo preparar el contenido');
      }
    },
    play: function () {
      var promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        return promise.catch(function () {
          throw new NovaError(ERROR_CODES.PLAYBACK, 'El televisor ha bloqueado la reproduccion');
        });
      }
      return Promise.resolve();
    },
    pause: function () { video.pause(); },
    stop: function () {
      video.pause();
      video.removeAttribute('src');
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
      currentSrc = '';
    },
    setVolume: function (value) {
      try { video.volume = Math.max(0, Math.min(1, value)); } catch (e) { /* ignorado */ }
    },
    setMuted: function (value) { video.muted = !!value; },
    isLive: function () {
      return video.duration === Infinity || isNaN(video.duration);
    },
    currentTime: function () { return video.currentTime || 0; },
    duration: function () { return video.duration; },
    volume: function () { return video.volume; },
    muted: function () { return video.muted; },
    audioTracks: function () {
      var tracks = [];
      if (!video.audioTracks) return tracks;
      for (var i = 0; i < video.audioTracks.length; i++) {
        tracks.push({ index: i, label: video.audioTracks[i].label || ('Audio ' + (i + 1)), active: video.audioTracks[i].enabled });
      }
      return tracks;
    },
    setAudioTrack: function (index) {
      if (!video.audioTracks) return false;
      for (var i = 0; i < video.audioTracks.length; i++) video.audioTracks[i].enabled = i === index;
      return true;
    },
    subtitleTracks: function () {
      var tracks = [];
      if (!video.textTracks) return tracks;
      for (var i = 0; i < video.textTracks.length; i++) {
        tracks.push({ index: i, label: video.textTracks[i].label || ('Subtitulo ' + (i + 1)), language: video.textTracks[i].language || '' });
      }
      return tracks;
    },
    setSubtitleTrack: function (index) {
      if (!video.textTracks) return false;
      for (var i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === index ? 'showing' : 'disabled';
      }
      return true;
    },
    on: function (eventName, handler) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(handler);
      return function () {
        var list = listeners[eventName] || [];
        var idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      };
    },
    getLastError: function () { return lastError; },
    destroy: function () { this.stop(); listeners = Object.create(null); }
  };
}

/**
 * Adaptador opcional con Shaka Player.
 * No se incluye la libreria en el paquete: si no esta presente en
 * vendor/shaka-player.compiled.js el adaptador informa de que no es
 * compatible en lugar de fallar en silencio.
 */
export function createMseAdapter(video) {
  var shaka = globalThis.shaka;
  if (!shaka || !shaka.Player) {
    throw new NovaError(ERROR_CODES.UNSUPPORTED, 'El motor MSE no esta disponible en este paquete');
  }
  var player = new shaka.Player();
  var listeners = Object.create(null);
  var currentSrc = '';

  function emit(name, payload) {
    var list = listeners[name] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { /* ignorado */ }
    }
  }

  player.addEventListener('error', function (event) {
    emit('error', new NovaError(ERROR_CODES.PLAYBACK, 'Error del motor MSE'));
  });
  player.addEventListener('buffering', function (event) { emit('buffering', !!event.buffering); });

  return {
    name: 'mse',
    get src() { return currentSrc; },
    load: function (src) {
      currentSrc = src;
      return player.attach(video).then(function () {
        return player.load(src);
      });
    },
    play: function () { return player.play(); },
    pause: function () { player.pause(); },
    stop: function () { try { player.unload(); } catch (e) { /* ignorado */ } },
    setVolume: function (value) { player.configure({ volume: value }); },
    isLive: function () {
      var tracks = player.getVariantTracks ? player.getVariantTracks() : [];
      return !!(tracks && tracks.length && tracks[0].type === 'LIVE');
    },
    currentTime: function () { return player.getCurrentTime ? player.getCurrentTime() : 0; },
    duration: function () { return player.getDuration ? player.getDuration() : 0; },
    on: function (eventName, handler) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(handler);
      return function () {
        var list = listeners[eventName] || [];
        var idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      };
    },
    destroy: function () { try { player.destroy(); } catch (e) { /* ignorado */ } }
  };
}

/**
 * Reproductor de alto nivel: aplica timeout, reintentos y eventos.
 */
export function createPlayer(deps) {
  var bus = deps.bus;
  var video = deps.video;
  var getPrefs = deps.getPrefs;
  var adapter = null;
  var currentItem = null;
  var retryCount = 0;
  var maxRetries = 2;

  function currentAdapter() {
    return adapter;
  }

  function ensureAdapter() {
    var prefs = getPrefs ? getPrefs() : {};
    var mode = prefs.playerMode || 'native';
    if (adapter && adapter.name === mode) return adapter;
    if (adapter) {
      try { adapter.destroy(); } catch (e) { /* ignorado */ }
      adapter = null;
    }
    if (mode === 'mse') {
      adapter = createMseAdapter(video);
    } else {
      adapter = createNativeAdapter(video);
    }
    adapter.on('error', function (err) {
      bus.emit('player:error', { item: currentItem, error: err });
    });
    adapter.on('buffering', function (isBuffering) {
      bus.emit('player:buffering', { item: currentItem, buffering: isBuffering });
    });
    adapter.on('time', function (time) {
      bus.emit('player:time', { item: currentItem, time: time });
    });
    adapter.on('duration', function (duration) {
      bus.emit('player:duration', { item: currentItem, duration: duration });
    });
    return adapter;
  }

  function waitForReady(adapterRef, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new NovaError(ERROR_CODES.TIMEOUT, 'El contenido no ha iniciado la reproduccion'));
      }, timeoutMs);

      var offError = adapterRef.on('error', function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        offError();
        reject(err);
      });

      function check() {
        if (settled) return;
        if (video.readyState >= 3 || (video.currentTime > 0 && !video.paused)) {
          settled = true;
          clearTimeout(timer);
          offError();
          resolve(true);
        } else {
          setTimeout(check, 120);
        }
      }
      check();
    });
  }

  function load(item, options) {
    var opts = options || {};
    var prefs = getPrefs ? getPrefs() : {};
    var timeoutMs = opts.timeoutMs || prefs.playerTimeoutMs || NET_CONFIG.streamTimeoutMs;
    var adapterRef;
    try {
      adapterRef = ensureAdapter();
    } catch (err) {
      bus.emit('player:failed', { item: item, error: err });
      return Promise.reject(err);
    }
    currentItem = item;
    retryCount = 0;
    bus.emit('player:loading', { item: item });

    function attempt(remaining) {
      return Promise.resolve()
        .then(function () {
          adapterRef.load(item.url);
          return waitForReady(adapterRef, timeoutMs);
        })
        .then(function () {
          return adapterRef.play();
        })
        .then(function () {
          retryCount = 0;
          bus.emit('player:playing', { item: item, live: adapterRef.isLive() });
          return true;
        })
        .catch(function (err) {
          if (remaining > 0) {
            logger.warn('reproduccion fallida, reintento', remaining, err && err.message);
            return new Promise(function (resolve) { setTimeout(resolve, 600); }).then(function () {
              return attempt(remaining - 1);
            });
          }
          bus.emit('player:failed', { item: item, error: err });
          throw err;
        });
    }

    return attempt(maxRetries);
  }

  return {
    load: load,
    play: function () { if (adapter) adapter.play(); },
    pause: function () { if (adapter) adapter.pause(); },
    stop: function () { if (adapter) adapter.stop(); },
    setVolume: function (value) { if (adapter) adapter.setVolume(value); },
    getVolume: function () { return adapter ? adapter.volume() : 1; },
    setMuted: function (value) { if (adapter) adapter.setMuted(value); },
    isMuted: function () { return adapter ? adapter.muted() : false; },
    isLive: function () { return adapter ? adapter.isLive() : false; },
    currentTime: function () { return adapter ? adapter.currentTime() : 0; },
    duration: function () { return adapter ? adapter.duration() : 0; },
    audioTracks: function () { return adapter ? adapter.audioTracks() : []; },
    setAudioTrack: function (index) { return adapter ? adapter.setAudioTrack(index) : false; },
    subtitleTracks: function () { return adapter ? adapter.subtitleTracks() : []; },
    setSubtitleTrack: function (index) { return adapter ? adapter.setSubtitleTrack(index) : false; },
    getAdapter: currentAdapter,
    getItem: function () { return currentItem; },
    destroy: function () {
      if (adapter) {
        try { adapter.destroy(); } catch (e) { /* ignorado */ }
        adapter = null;
      }
    }
  };
}
