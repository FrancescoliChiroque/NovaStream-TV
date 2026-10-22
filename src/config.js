/**
 * Configuracion global de NovaStream TV.
 * No contiene secretos. Los valores por defecto se pueden cambiar en
 * Ajustes dentro del televisor; este archivo solo define los limites duros.
 */

export const APP_ID = 'com.novastream.tv';
export const APP_NAME = 'NovaStream TV';
export const APP_VERSION = '1.0.0';

/** Limites de red y reproduccion. */
export const NET_CONFIG = {
  requestTimeoutMs: 12000,
  streamTimeoutMs: 15000,
  maxConcurrent: 4,
  maxRetries: 2,
  retryBaseDelayMs: 400,
  retryMaxDelayMs: 4000,
  maxPlaylistBytes: 12 * 1024 * 1024,
  maxEpGBytes: 24 * 1024 * 1024,
  maxResponseBytes: 8 * 1024 * 1024
};

/** Esquemas de URL admitidos para fuentes y streams. */
export const ALLOWED_SCHEMES = ['http:', 'https:'];

/** Tiempos de expiracion de cache (ms). */
export const CACHE_TTL = {
  playlist: 30 * 60 * 1000,
  epg: 6 * 60 * 60 * 1000,
  catalog: 60 * 60 * 1000,
  image: 24 * 60 * 60 * 1000
};

/** Tamano de pagina para listas largas (canales por carga). */
export const PAGE_SIZE = 120;

/** Prefijos de claves de almacenamiento. */
export const STORAGE_PREFIX = 'nvt_';
export const STORAGE_KEYS = {
  prefs: STORAGE_PREFIX + 'prefs',
  sources: STORAGE_PREFIX + 'sources',
  activeSource: STORAGE_PREFIX + 'active_source',
  favorites: STORAGE_PREFIX + 'favorites',
  history: STORAGE_PREFIX + 'history',
  profile: STORAGE_PREFIX + 'profile',
  epgUrl: STORAGE_PREFIX + 'epg_url',
  lastChannel: STORAGE_PREFIX + 'last_channel'
};

/** Ajustes por defecto (se sobreescriben con los del usuario). */
export const DEFAULT_PREFS = {
  language: 'es',
  theme: 'midnight',
  textScale: 'medium',
  startOnLastChannel: false,
  showHiddenChannels: false,
  playlistRefreshHours: 6,
  epgRefreshHours: 6,
  requestTimeoutMs: NET_CONFIG.requestTimeoutMs,
  playerMode: 'native',
  playerTimeoutMs: NET_CONFIG.streamTimeoutMs,
  parentalEnabled: false,
  parentalPin: '',
  parentalCategories: [],
  animations: 'full',
  serviceProxy: 'auto'
};

/** Numero maximo de elementos guardados en historial. */
export const HISTORY_LIMIT = 60;
export const FAVORITES_LIMIT = 800;

/** Codigos de tecla del Magic Remote / mando basico de webOS TV. */
export const KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  ESCAPE: 27,
  BACK: 461,
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  REWIND: 412,
  FAST_FORWARD: 417,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,
  INFO: 457,
  EXIT: 10182
};
