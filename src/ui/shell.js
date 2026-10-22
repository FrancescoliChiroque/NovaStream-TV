/**
 * Shell de la aplicacion: barra lateral, area de contenido, reproductor,
 * navegacion global con el mando y dialogos de salida.
 */

import { el, clear } from '../core/dom.js';
import { KEY, APP_NAME } from '../config.js';
import { createSpatialNavigator } from './spatial.js';
import { createRouter } from './router.js';
import { createToaster } from './components/toast.js';
import { createDialog, isAnyDialogOpen, closeTopDialog } from './components/dialog.js';
import { createKeyboard } from './components/keyboard.js';
import { createPlayerOverlay } from './components/playerOverlay.js';
import { createHomeView, createDemoView } from './views/home.js';
import { createChannelsView } from './views/channels.js';
import { createSearchView } from './views/search.js';
import { createFavoritesView } from './views/favorites.js';
import { createMoviesView, createSeriesView, createSeriesDetailView } from './views/catalog.js';
import { createSettingsView } from './views/settings.js';
import { createDiagnosticsView } from './views/diagnostics.js';
import { platformBack } from '../platform/webos.js';
import { hashPin } from '../core/storage.js';
import { logger } from '../core/logger.js';

var NAV_ITEMS = [
  { path: '/home', label: 'Inicio', icon: '⌂' },
  { path: '/channels', label: 'Canales', icon: '▤' },
  { path: '/movies', label: 'Peliculas', icon: '▶' },
  { path: '/series', label: 'Series', icon: '≡' },
  { path: '/favorites', label: 'Favoritos', icon: '★' },
  { path: '/search', label: 'Buscar', icon: '⌕' },
  { path: '/settings', label: 'Ajustes', icon: '⚙' },
  { path: '/diagnostics', label: 'Diagnostico', icon: 'ⓘ' }
];

export function createShell(deps) {
  var bus = deps.bus;
  var storage = deps.storage;
  var sources = deps.sources;
  var epg = deps.epg;
  var catalog = deps.catalog;
  var player = deps.player;
  var proxy = deps.proxy;

  var root = el('div', { class: 'app' });
  var sidebar = el('nav', { class: 'sidebar', 'aria-label': 'Navegacion principal' });
  var brand = el('div', { class: 'sidebar__brand' });
  brand.appendChild(el('span', { class: 'sidebar__logo', text: 'N' }));
  brand.appendChild(el('span', { class: 'sidebar__name', text: APP_NAME }));
  sidebar.appendChild(brand);

  var navList = el('div', { class: 'sidebar__nav' });
  sidebar.appendChild(navList);
  root.appendChild(sidebar);

  var content = el('main', { class: 'content' });
  root.appendChild(content);

  var toastHost = el('div', { class: 'toast-host' });
  root.appendChild(toastHost);
  var toaster = createToaster(toastHost);

  var navigator = createSpatialNavigator(root);
  var router = createRouter(bus);
  var exitDialog = createDialog({
    title: 'Salir de ' + APP_NAME + '?',
    actions: [
      { label: 'Salir', primary: true, onSelect: function () {
        // En modo navegador el historial lo usa la app para el boton atras,
        // asi que no se toca aqui: se intenta cerrar la pagina y, si el
        // navegador no deja, se indica como salir.
        var closed = platformBack({ allowHistoryBack: false });
        if (!closed) {
          toaster.show('El navegador del televisor no permite cerrar la pagina: usa el boton SALIR del mando para salir del navegador.', 'error');
        }
      } },
      { label: 'Cancelar' }
    ]
  });
  root.appendChild(exitDialog.element);

  var pinInput = el('input', {
    class: 'field',
    type: 'password',
    inputmode: 'numeric',
    placeholder: 'PIN',
    'data-focusable': 'true',
    'data-nav-scope': 'dialog'
  });
  var pinDialog = createDialog({
    title: 'Contenido bloqueado',
    body: pinInput,
    actions: [
      { label: 'Desbloquear', primary: true },
      { label: 'Cancelar' }
    ]
  });
  root.appendChild(pinDialog.element);

  // Teclado en pantalla: en webOS el teclado del sistema no aparece solo al
  // enfocar un campo, asi que la app trae el suyo. El texto se escribe en el
  // campo de destino y cada vista sigue validando el valor al confirmar.
  var keyboard = createKeyboard();
  root.appendChild(keyboard.element);

  var overlay = createPlayerOverlay({
    video: deps.video,
    onExit: function () { stopPlayback(); },
    onTogglePlay: function () { togglePlay(); },
    onPause: function () { player.pause(); },
    onVolume: function (value) { player.setVolume(value); },
    getVolume: function () { return player.getVolume(); }
  });
  root.appendChild(overlay.element);

  var currentView = null;
  var currentItem = null;
  var seriesIndex = [];

  var ctx = {
    bus: bus,
    router: router,
    storage: storage,
    sources: sources,
    epg: epg,
    catalog: catalog,
    player: player,
    proxy: proxy,
    http: deps.http,
    toaster: toaster,
    play: play,
    focusFirstIn: focusFirstIn,
    findSeriesById: findSeriesById,
    dumpLogs: function () { return logger.dump(); }
  };

  var views = {
    '/home': createHomeView(ctx),
    '/demo': createDemoView(ctx),
    '/channels': createChannelsView(ctx),
    '/movies': createMoviesView(ctx),
    '/series': createSeriesView(ctx),
    '/series-detail': createSeriesDetailView(ctx),
    '/favorites': createFavoritesView(ctx),
    '/search': createSearchView(ctx),
    '/settings': createSettingsView(ctx),
    '/diagnostics': createDiagnosticsView(ctx)
  };

  var navButtons = Object.create(null);
  NAV_ITEMS.forEach(function (item) {
    var button = el('button', {
      class: 'sidebar__item',
      'data-focusable': 'true',
      'data-nav-scope': 'nav',
      'data-path': item.path,
      type: 'button'
    });
    button.appendChild(el('span', { class: 'sidebar__icon', text: item.icon }));
    button.appendChild(el('span', { class: 'sidebar__label', text: item.label }));
    button.addEventListener('click', function () { router.navigate(item.path); });
    navButtons[item.path] = button;
    navList.appendChild(button);
  });

  function focusFirstIn(scopes) {
    var list = scopes || ['content'];
    for (var i = 0; i < list.length; i++) {
      if (navigator.focusFirst(list[i])) return true;
    }
    return navigator.focusFirst(null);
  }

  function findSeriesById(id) {
    for (var i = 0; i < seriesIndex.length; i++) {
      if (seriesIndex[i].id === id) return seriesIndex[i];
    }
    return null;
  }

  function updateNavActive(path) {
    Object.keys(navButtons).forEach(function (key) {
      navButtons[key].classList.toggle('is-active', key === path);
    });
  }

  function showView(path, params) {
    var view = views[path];
    if (!view) {
      router.navigate('/home');
      return;
    }
    if (currentView && currentView !== view && currentView.hide) currentView.hide();
    clear(content);
    content.appendChild(view.element);
    currentView = view;
    updateNavActive(path);
    if (view.show) view.show(params || {});
  }

  router.register('/home', function () { showView('/home'); });
  router.register('/demo', function () { showView('/demo'); });
  router.register('/channels', function (params) {
    showView('/channels', params);
  });
  router.register('/movies', function () { showView('/movies'); });
  router.register('/series', function (params) {
    if (params && params.id) {
      showView('/series-detail', params);
      return;
    }
    showView('/series');
  });
  router.register('/favorites', function () { showView('/favorites'); });
  router.register('/search', function () { showView('/search'); });
  router.register('/settings', function () { showView('/settings'); });
  router.register('/diagnostics', function () { showView('/diagnostics'); });
  router.setNotFound(function () { router.navigate('/home'); });

  function isParentalLocked(item) {
    var prefs = storage.getPrefs();
    if (!prefs.parentalEnabled) return false;
    var restricted = prefs.parentalCategories || [];
    if (!restricted.length) return false;
    return restricted.indexOf(item.group) >= 0;
  }

  function requestPin(onUnlock) {
    pinDialog.setActions([
      {
        label: 'Desbloquear', primary: true, onSelect: function () {
          if (hashPin(pinInput.value) === storage.getPrefs().parentalPin) {
            onUnlock();
            return true;
          }
          toaster.show('PIN incorrecto', 'error');
          return false;
        }
      },
      { label: 'Cancelar' }
    ]);
    pinInput.value = '';
    pinDialog.open();
    setTimeout(function () {
      try { pinInput.focus({ preventScroll: true }); } catch (e) { /* ignorado */ }
    }, 50);
  }

  function play(item) {
    if (!item || !item.url) {
      toaster.show('Este elemento no se puede reproducir', 'error');
      return;
    }
    if (isParentalLocked(item)) {
      requestPin(function () { play(item); });
      return;
    }
    currentItem = item;
    storage.pushHistory(item);
    storage.setLastChannelId(item.id);
    overlay.open(item);
    overlay.setStatus('Cargando...');
    player.load(item).then(function () {
      overlay.setStatus('');
      overlay.setVolumeLabel(player.getVolume());
      var programme = epg.current(item);
      overlay.setItem(item, programme);
    }).catch(function (err) {
      overlay.setStatus('Error: ' + (err && err.message ? err.message : 'reproduccion fallida'));
      toaster.show('No se pudo reproducir: ' + (err && err.message ? err.message : 'error'), 'error');
    });
  }

  function togglePlay() {
    var adapter = player.getAdapter();
    if (!adapter) return;
    if (overlay.video.paused) player.play();
    else player.pause();
  }

  function stopPlayback() {
    player.stop();
    overlay.close();
    currentItem = null;
    focusFirstIn(['content']);
  }

  function toggleFavorite() {
    if (!currentItem) return;
    var added = storage.toggleFavorite(currentItem);
    toaster.show(added ? 'Anadido a favoritos' : 'Quitado de favoritos');
  }

  function isTextTarget(target) {
    return !!(target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ));
  }

  /** Un desplegable (select) con el foco: las flechas cambian su valor. */
  function isSelectTarget(target) {
    return !!(target && target.tagName === 'SELECT');
  }

  function changeSelect(select, step) {
    if (!select || !select.options || !select.options.length) return false;
    var index = typeof select.selectedIndex === 'number' ? select.selectedIndex : 0;
    var next = index + step;
    if (next < 0) next = select.options.length - 1;
    if (next >= select.options.length) next = 0;
    select.selectedIndex = next;
    if (typeof select.dispatchEvent === 'function') {
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignorado */ }
    }
    return true;
  }

  /** Ambito de navegacion activo: el foco no puede salirse de el. */
  function activeScope() {
    if (keyboard.isOpen()) return 'keyboard';
    if (isAnyDialogOpen()) return 'dialog';
    return null;
  }

  /**
   * Accion de "Atras": cierra el reproductor, vuelve al inicio o pregunta
   * si se quiere salir. Se usa tanto desde la tecla como desde el evento
   * 'popstate' del navegador (ver platform/history.js).
   */
  function handleBack() {
    if (keyboard.isOpen()) {
      keyboard.close(true);
      return true;
    }
    if (isAnyDialogOpen()) {
      closeTopDialog();
      return true;
    }
    if (overlay.isOpen()) {
      stopPlayback();
      return true;
    }
    var current = router.getCurrent();
    if (current && current.path !== '/home') {
      router.navigate('/home');
      return true;
    }
    exitDialog.open();
    return true;
  }

  function handleKey(event) {
    if (event.defaultPrevented) return false;
    var code = event.keyCode;

    // Teclado en pantalla abierto: ESC y ATRAS lo cierran; las flechas mueven
    // el foco entre las teclas y ENTER pulsa la tecla enfocada.
    if (keyboard.isOpen()) {
      if (keyboard.handleKey(event)) {
        event.preventDefault();
        return true;
      }
      if (code === KEY.ENTER) {
        navigator.syncCurrent();
        var key = navigator.getCurrent();
        if (key && typeof key.click === 'function') {
          key.click();
          event.preventDefault();
          return true;
        }
        return false;
      }
      if (code === KEY.LEFT || code === KEY.RIGHT || code === KEY.UP || code === KEY.DOWN) {
        var keyDirection = code === KEY.LEFT ? 'left' : code === KEY.RIGHT ? 'right' : code === KEY.UP ? 'up' : 'down';
        if (navigator.move(keyDirection, 'keyboard')) {
          event.preventDefault();
          return true;
        }
      }
      return false;
    }

    // Un dialogo abierto captura todas las teclas: el propio dialogo las
    // gestiona (y ya ha hecho preventDefault de las que consume), asi que el
    // shell no debe actuar ni impedir el comportamiento por defecto.
    if (isAnyDialogOpen()) {
      // Salir de un campo de texto con ENTER abre el teclado en pantalla,
      // tambien dentro de un dialogo (formulario de fuente, PIN).
      if (code === KEY.ENTER && isTextTarget(event.target)) {
        event.preventDefault();
        keyboard.open(event.target);
        return true;
      }
      // Las flechas si se gestionan aqui, pero con el foco restringido al
      // ambito del dialogo para no salirse de el.
      if (code === KEY.LEFT || code === KEY.RIGHT || code === KEY.UP || code === KEY.DOWN) {
        // Con un desplegable enfocado, izquierda/derecha cambian su valor.
        if ((code === KEY.LEFT || code === KEY.RIGHT) && isSelectTarget(event.target)) {
          if (changeSelect(event.target, code === KEY.LEFT ? -1 : 1)) {
            event.preventDefault();
            return true;
          }
        }
        var dialogDirection = code === KEY.LEFT ? 'left' : code === KEY.RIGHT ? 'right' : code === KEY.UP ? 'up' : 'down';
        if (navigator.move(dialogDirection, 'dialog')) {
          event.preventDefault();
          return true;
        }
      }
      return false;
    }

    // En un campo de texto (busqueda, formulario de fuente, PIN) las teclas
    // las gestiona el campo: no se mueve el foco.
    var target = event.target;
    var isTextField = isTextTarget(target);

    // ENTER sobre un campo de texto abre el teclado en pantalla.
    if (isTextField && code === KEY.ENTER) {
      event.preventDefault();
      keyboard.open(target);
      return true;
    }

    if (isTextField && code !== KEY.BACK && code !== KEY.ESCAPE && code !== KEY.UP && code !== KEY.DOWN) {
      return false;
    }

    if (overlay.isOpen()) {
      if (overlay.handleKey(event)) {
        event.preventDefault();
        return true;
      }
    }

    if (currentView && currentView.handleKey && currentView.handleKey(event)) {
      event.preventDefault();
      return true;
    }

    switch (code) {
      case KEY.LEFT:
      case KEY.RIGHT:
      case KEY.UP:
      case KEY.DOWN: {
        var direction = code === KEY.LEFT ? 'left' : code === KEY.RIGHT ? 'right' : code === KEY.UP ? 'up' : 'down';
        if (navigator.move(direction, activeScope())) {
          event.preventDefault();
          return true;
        }
        return false;
      }
      case KEY.ENTER: {
        var focused = navigator.getCurrent();
        if (focused && typeof focused.click === 'function') {
          focused.click();
          event.preventDefault();
          return true;
        }
        return false;
      }
      case KEY.BACK:
      case KEY.ESCAPE:
      case KEY.EXIT:
      case KEY.RED: {
        handleBack();
        event.preventDefault();
        return true;
      }
      case KEY.GREEN:
        toggleFavorite();
        event.preventDefault();
        return true;
      default:
        return false;
    }
  }

  bus.on('sources:loaded', function () {
    catalog.loadSeries(sources.getActiveSource()).then(function (list) {
      seriesIndex = list || [];
    }).catch(function () {
      seriesIndex = [];
    });
    // La vista actual se repinta: si el usuario esta en Canales ve la lista
    // recien descargada sin tener que cambiar de seccion.
    var path = router.getCurrent ? router.getCurrent().path : '';
    if (path && views[path] && path !== '/settings') {
      showView(path);
    }
  });

  return {
    element: root,
    router: router,
    navigator: navigator,
    play: play,
    stopPlayback: stopPlayback,
    handleKey: handleKey,
    handleBack: handleBack,
    start: function () {
      router.start();
      focusFirstIn(['nav']);
    },
    getOverlay: function () { return overlay; }
  };
}
