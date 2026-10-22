/**
 * Vista de inicio: acceso rapido, favoritos, grupos y ultimos canais.
 * Si no hay ninguna fuente configurada, muestra el estado inicial con las
 * acciones para anadir una o probar los streams de demostracion.
 */

import { el, clear } from '../../core/dom.js';
import { createRow } from '../components/row.js';
import { createCard } from '../components/card.js';
import { DEMO_CHANNELS, DEMO_MOVIES, DEMO_SERIES, DEMO_EPISODES } from '../../data/demo.js';

export function createHomeView(ctx) {
  var element = el('section', { class: 'view view--home' });
  var body = el('div', { class: 'view__body view__body--rows' });
  element.appendChild(body);

  function renderWelcome() {
    var card = el('div', { class: 'welcome', 'data-focusable': 'true', 'data-nav-scope': 'content', tabindex: '-1' });
    card.appendChild(el('h2', { class: 'welcome__title', text: 'Bienvenido a NovaStream TV' }));
    card.appendChild(el('p', {
      class: 'welcome__text',
      text: 'Anade una lista M3U o un servicio Xtream Codes para empezar. Tambien puedes probar los streams de demostracion.'
    }));
    var actions = el('div', { class: 'welcome__actions' });
    var add = el('button', { class: 'btn btn--primary', 'data-focusable': 'true', 'data-nav-scope': 'content', type: 'button', text: 'Anadir fuente' });
    add.addEventListener('click', function () { ctx.router.navigate('/settings'); });
    var demo = el('button', { class: 'btn', 'data-focusable': 'true', 'data-nav-scope': 'content', type: 'button', text: 'Ver demostracion' });
    demo.addEventListener('click', function () { ctx.router.navigate('/demo'); });
    actions.appendChild(add);
    actions.appendChild(demo);
    card.appendChild(actions);
    body.appendChild(card);
  }

  function show() {
    clear(body);
    var state = ctx.sources.getState();
    var channels = state.channels || [];

    if (!channels.length) {
      renderWelcome();
      ctx.focusFirstIn(['content']);
      return;
    }

    var lastId = ctx.storage.getLastChannelId();
    var last = null;
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id === lastId) { last = channels[i]; break; }
    }
    if (last) {
      var hero = el('div', { class: 'hero', 'data-focusable': 'true', 'data-nav-scope': 'content', tabindex: '-1' });
      hero.appendChild(el('span', { class: 'hero__label', text: 'Ultimo canal' }));
      hero.appendChild(el('h2', { class: 'hero__title', text: last.name }));
      hero.appendChild(el('p', { class: 'hero__group', text: last.group || '' }));
      hero.addEventListener('click', function () { ctx.play(last); });
      body.appendChild(hero);
    }

    var favorites = ctx.storage.getFavorites();
    if (favorites.length) {
      body.appendChild(createRow('Favoritos', favorites, {
        onSelect: function (item) { ctx.play(item); },
        subtitleFor: function (item) { return item.group || ''; }
      }));
    }

    var history = ctx.storage.getHistory().slice(0, 20);
    if (history.length) {
      body.appendChild(createRow('Visto recientemente', history, {
        onSelect: function (item) { ctx.play(item); },
        subtitleFor: function (item) { return item.group || ''; }
      }));
    }

    var groups = state.groups || [];
    if (groups.length) {
      var groupRow = el('div', { class: 'groupbar groupbar--home' });
      groups.slice(0, 30).forEach(function (group) {
        var chip = el('button', { class: 'chip', 'data-focusable': 'true', 'data-nav-scope': 'groups', type: 'button', text: group });
        chip.addEventListener('click', function () { ctx.router.navigate('/channels?group=' + encodeURIComponent(group)); });
        groupRow.appendChild(chip);
      });
      body.appendChild(groupRow);
    }

    body.appendChild(createRow('Todos los canales', channels.slice(0, 30), {
      onSelect: function (item) { ctx.play(item); },
      subtitleFor: function (item) {
        var programme = ctx.epg.current(item);
        return programme ? programme.title : (item.group || '');
      }
    }));

    ctx.focusFirstIn(['content']);
  }

  return { element: element, show: show };
}

/** Vista de demostracion con los streams publicos de prueba. */
export function createDemoView(ctx) {
  var element = el('section', { class: 'view view--demo' });
  var header = el('header', { class: 'view__header' });
  header.appendChild(el('h1', { class: 'view__title', text: 'Demostracion' }));
  element.appendChild(header);
  var body = el('div', { class: 'view__body view__body--rows' });
  element.appendChild(body);

  function show() {
    clear(body);
    // Secciones de demostracion: mas canales, peliculas y series para probar
    // la app sin configurar una fuente.
    body.appendChild(createRow('Canales de demostracion', DEMO_CHANNELS, {
      onSelect: function (item) { ctx.play(item); }
    }));
    body.appendChild(createRow('Peliculas de demostracion', DEMO_MOVIES, {
      onSelect: function (item) { ctx.play(item); }
    }));
    body.appendChild(createRow('Series de demostracion', DEMO_SERIES, {
      onSelect: function (item) {
        var episodes = DEMO_EPISODES.filter(function (ep) { return ep.seriesId === item.id; });
        if (episodes.length) {
          ctx.play(episodes[0]);
          return;
        }
        ctx.play(DEMO_EPISODES[0]);
      }
    }));
    ctx.focusFirstIn(['content']);
  }

  return { element: element, show: show };
}
