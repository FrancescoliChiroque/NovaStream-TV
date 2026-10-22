/**
 * Vista de favoritos.
 */

import { el, clear } from '../../core/dom.js';
import { createList } from '../components/list.js';

export function createFavoritesView(ctx) {
  var element = el('section', { class: 'view view--favorites' });
  var header = el('header', { class: 'view__header' });
  header.appendChild(el('h1', { class: 'view__title', text: 'Favoritos' }));
  var count = el('span', { class: 'view__count', text: '' });
  header.appendChild(count);
  element.appendChild(header);
  var body = el('div', { class: 'view__body' });
  element.appendChild(body);

  function show() {
    clear(body);
    var favorites = ctx.storage.getFavorites();
    count.textContent = favorites.length + (favorites.length === 1 ? ' favorito' : ' favoritos');
    if (!favorites.length) {
      body.appendChild(el('p', { class: 'empty', text: 'No hay favoritos guardados. Usa el boton verde durante la reproduccion para anadir uno.' }));
      ctx.focusFirstIn(['content']);
      return;
    }
    body.appendChild(createList(favorites, {
      onSelect: function (item) { ctx.play(item); },
      scope: 'content',
      subtitleFor: function (item) { return item.group || ''; }
    }));
    ctx.focusFirstIn(['content']);
  }

  return { element: element, show: show };
}
