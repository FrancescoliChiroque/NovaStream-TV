/**
 * Fila horizontal de tarjetas con desplazamiento suave.
 * El contenedor de la fila se puede desplazar con el mando cuando el foco
 * llega al ultimo elemento.
 */

import { el, revealElement } from '../../core/dom.js';
import { createCard } from './card.js';

export function createRow(title, items, options) {
  var opts = options || {};
  var row = el('section', { class: 'row' + (opts.hidden ? ' row--hidden' : ''), 'data-row': title });
  if (title) {
    var header = el('header', { class: 'row__header' });
    header.appendChild(el('h2', { class: 'row__title', text: title }));
    if (opts.count !== undefined) {
      header.appendChild(el('span', { class: 'row__count', text: String(opts.count) }));
    }
    if (opts.action) {
      var button = el('button', {
        class: 'row__action', 'data-focusable': 'true', 'data-nav-scope': 'content', type: 'button', text: opts.action.label
      });
      button.addEventListener('click', function () { opts.action.onClick(); });
      header.appendChild(button);
    }
    row.appendChild(header);
  }
  var track = el('div', { class: 'row__track' });
  var cards = [];
  for (var i = 0; i < items.length; i++) {
    var card = createCard(items[i], {
      onSelect: opts.onSelect,
      badge: opts.badgeFor ? opts.badgeFor(items[i]) : '',
      subtitle: opts.subtitleFor ? opts.subtitleFor(items[i]) : '',
      wide: opts.wide
    });
    cards.push(card);
    track.appendChild(card);
  }
  row.appendChild(track);
  row.getCards = function () { return cards; };
  row.getTrack = function () { return track; };
  row.scrollToCard = function (card) { revealElement(card); };
  return row;
}
