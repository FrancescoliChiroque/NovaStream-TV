/**
 * Vista de busqueda global sobre canales, peliculas y series.
 */

import { el, clear, normalizeText, debounce } from '../../core/dom.js';
import { createList } from '../components/list.js';

export function createSearchView(ctx) {
  var element = el('section', { class: 'view view--search' });
  var header = el('header', { class: 'view__header' });
  header.appendChild(el('h1', { class: 'view__title', text: 'Buscar' }));
  element.appendChild(header);

  var input = el('input', {
    class: 'search__input',
    'data-focusable': 'true',
    'data-nav-scope': 'search',
    type: 'search',
    placeholder: 'Escribe el nombre de un canal o pelicula',
    autocomplete: 'off',
    spellcheck: 'false'
  });
  element.appendChild(el('div', { class: 'search' }, input));

  var results = el('div', { class: 'view__body' });
  element.appendChild(results);

  var items = [];

  function search(query) {
    var q = normalizeText(query);
    clear(results);
    if (!q) {
      results.appendChild(el('p', { class: 'empty', text: 'Introduce texto para buscar en la lista actual.' }));
      return;
    }
    var state = ctx.sources.getState();
    var pool = (state.channels || []).slice();
    items = pool.filter(function (item) {
      return normalizeText(item.name).indexOf(q) >= 0 || normalizeText(item.group).indexOf(q) >= 0;
    });
    if (!items.length) {
      results.appendChild(el('p', { class: 'empty', text: 'Sin resultados para "' + query + '".' }));
      return;
    }
    results.appendChild(el('p', { class: 'view__count', text: items.length + ' resultados' }));
    results.appendChild(createList(items, {
      onSelect: function (item) { ctx.play(item); },
      scope: 'content',
      subtitleFor: function (item) { return item.group || ''; }
    }));
  }

  var runSearch = debounce(function () { search(input.value); }, 180);
  input.addEventListener('input', runSearch);

  return {
    element: element,
    show: function () {
      input.value = '';
      clear(results);
      results.appendChild(el('p', { class: 'empty', text: 'Introduce texto para buscar en la lista actual.' }));
      try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    },
    handleKey: function (event) {
      if (event.keyCode === 27 && input.value) {
        input.value = '';
        search('');
        return true;
      }
      return false;
    }
  };
}
