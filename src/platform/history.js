/**
 * Guarda del boton "Atras" en modo navegador.
 *
 * En el navegador del televisor (webOS Hub, sin app instalada) la tecla
 * ATRAS la gestiona el propio navegador: navega por su historial y la pagina
 * no recibe el evento, asi que la app no puede cerrar el reproductor.
 *
 * La solucion es la habitual: se anade una entrada al historial al cargar la
 * pagina, de forma que la primera pulsacion de ATRAS produce un 'popstate'
 * (que la app controla) en lugar de abandonar la pagina. Despues se vuelve a
 * anadir la entrada para que el usuario pueda seguir usandola.
 */

/**
 * @param {function} onBack se llama cuando el usuario pulsa ATRAS.
 * @returns {function} funcion para desactivar la guarda.
 */
export function installBackGuard(onBack) {
  var history = globalThis.history;
  var location = globalThis.location;
  if (!history || !location || typeof history.pushState !== 'function') {
    return function () { /* sin soporte: no se hace nada */ };
  }

  var lastKeyAt = 0;
  var active = true;

  function push() {
    if (!active) return;
    try {
      history.pushState({ novastreamBack: true }, '', location.href);
    } catch (e) { /* algunos navegadores lo bloquean */ }
  }

  function onPopState() {
    if (!active) return;
    // Si la app ya recibio la tecla (el navegador entrega las dos), el
    // popstate se ignora para no gestionarlo dos veces.
    if (Date.now() - lastKeyAt < 700) {
      push();
      return;
    }
    try {
      if (typeof onBack === 'function') onBack();
    } catch (e) { /* ignorado */ }
    push();
  }

  function onKeyDown(event) {
    var code = event && event.keyCode;
    if (code === 461 || code === 10009 || code === 10182) lastKeyAt = Date.now();
  }

  // Entrada inicial: replace + push para que haya una entrada de mas.
  try {
    history.replaceState({ novastreamBack: true }, '', location.href);
  } catch (e) { /* ignorado */ }
  push();
  globalThis.addEventListener('popstate', onPopState);
  globalThis.addEventListener('keydown', onKeyDown, true);

  return function uninstall() {
    active = false;
    globalThis.removeEventListener('popstate', onPopState);
    globalThis.removeEventListener('keydown', onKeyDown, true);
  };
}
