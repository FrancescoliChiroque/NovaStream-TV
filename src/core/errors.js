/**
 * Errores centralizados de la aplicacion.
 * Cada error tiene un codigo estable, un mensaje para el usuario y un
 * detalle tecnico que NUNCA incluye credenciales ni URLs con token.
 */

export const ERROR_CODES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  HTTP: 'http',
  PARSE: 'parse',
  UNSUPPORTED: 'unsupported',
  NOT_FOUND: 'not_found',
  STORAGE: 'storage',
  PLAYBACK: 'playback',
  EMPTY: 'empty',
  UNKNOWN: 'unknown'
};

var MESSAGES = {
  es: {
    network: 'Sin conexion con el servidor de la fuente.',
    timeout: 'El servidor ha tardado demasiado en responder.',
    http: 'El servidor ha rechazado la peticion.',
    parse: 'El contenido recibido no tiene un formato valido.',
    unsupported: 'Este contenido no es compatible con el televisor.',
    not_found: 'No se ha encontrado el elemento solicitado.',
    storage: 'No se han podido guardar los datos en el televisor.',
    playback: 'No se ha podido reproducir el contenido.',
    empty: 'No hay contenido disponible.',
    unknown: 'Se ha producido un error inesperado.'
  },
  en: {
    network: 'Network error while contacting the source.',
    timeout: 'The source took too long to respond.',
    http: 'The source rejected the request.',
    parse: 'The received content is not valid.',
    unsupported: 'This content is not supported by the TV.',
    not_found: 'The requested item was not found.',
    storage: 'Could not store data on the TV.',
    playback: 'The content could not be played.',
    empty: 'There is no content available.',
    unknown: 'An unexpected error occurred.'
  }
};

export function NovaError(code, detail, cause) {
  var err = Error.call(this, code + (detail ? ': ' + detail : ''));
  this.name = 'NovaError';
  this.code = code || ERROR_CODES.UNKNOWN;
  this.detail = detail || '';
  // 'message' se define para que los avisos de la interfaz (y el log)
  // muestren la causa real y no un 'NovaError' sin texto.
  this.message = this.detail ? this.code + ': ' + this.detail : this.code;
  this.cause = cause || null;
  this.isNovaError = true;
  if (Error.captureStackTrace) Error.captureStackTrace(this, NovaError);
  else this.stack = err.stack;
}
NovaError.prototype = Object.create(Error.prototype);
NovaError.prototype.constructor = NovaError;

export function isNovaError(value) {
  return !!(value && value.isNovaError);
}

/** Normaliza cualquier error thrown a un NovaError. */
export function toNovaError(err) {
  if (isNovaError(err)) return err;
  var detail = '';
  if (err && err.message) detail = String(err.message).slice(0, 300);
  return new NovaError(ERROR_CODES.UNKNOWN, detail, err);
}

/** Mensaje listo para mostrar, en el idioma pedido. */
export function userMessage(err, lang) {
  var novaErr = toNovaError(err);
  var table = MESSAGES[lang] || MESSAGES.es;
  var base = table[novaErr.code] || table.unknown;
  return novaErr.detail ? base + ' ' + novaErr.detail : base;
}
