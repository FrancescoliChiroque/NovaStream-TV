/**
 * Tarjeta de canal/pelicula para rejillas y filas.
 * Usa solo texto y clases CSS: las imagenes se cargan de forma perezosa y
 * tolerante a fallos (un logotipo roto nunca debe romper la vista).
 */

import { el, normalizeText } from '../../core/dom.js';

export function createCard(item, options) {
  var opts = options || {};
  var classes = ['card', 'card--' + (item.kind || 'live')];
  if (opts.wide) classes.push('card--wide');
  var node = el('div', {
    class: classes.join(' '),
    'data-focusable': 'true',
    'data-nav-scope': opts.scope || 'content',
    'data-id': item.id,
    'data-name': item.name,
    role: 'button',
    tabindex: '-1'
  });

  var thumb = el('div', { class: 'card__thumb' });
  if (item.logo) {
    var img = el('img', { class: 'card__logo', alt: '', loading: 'lazy', src: item.logo });
    img.addEventListener('error', function () {
      img.parentNode.removeChild(img);
      thumb.classList.add('card__thumb--empty');
    });
    thumb.appendChild(img);
  } else {
    thumb.classList.add('card__thumb--empty');
    thumb.appendChild(el('span', { class: 'card__initial', text: (item.name || '?').trim().charAt(0).toUpperCase() }));
  }
  if (item.kind === 'live') thumb.appendChild(el('span', { class: 'card__badge', text: 'DIRECTO' }));
  if (opts.badge) thumb.appendChild(el('span', { class: 'card__badge card__badge--alt', text: opts.badge }));
  node.appendChild(thumb);

  var meta = el('div', { class: 'card__meta' });
  meta.appendChild(el('span', { class: 'card__name', text: item.name || 'Sin nombre' }));
  if (opts.subtitle) meta.appendChild(el('span', { class: 'card__sub', text: opts.subtitle }));
  node.appendChild(meta);

  if (opts.onSelect) {
    node.addEventListener('click', function () { opts.onSelect(item); });
  }
  node.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (opts.onSelect) opts.onSelect(item);
    }
  });
  return node;
}

/** Coincidencia simple de texto para busquedas locales. */
export function matchesQuery(item, query) {
  if (!query) return true;
  var q = normalizeText(query);
  return normalizeText(item.name).indexOf(q) >= 0 ||
    normalizeText(item.group).indexOf(q) >= 0;
}
