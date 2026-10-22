/**
 * Lista vertical (canales, ajustes, resultados).
 */

import { el, normalizeText } from '../../core/dom.js';

export function createList(items, options) {
  var opts = options || {};
  var list = el('div', { class: 'list' + (opts.class ? ' ' + opts.class : '') });
  var nodes = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var row = el('div', {
      class: 'list__item' + (opts.itemClass ? ' ' + opts.itemClass : ''),
      'data-focusable': 'true',
      'data-nav-scope': opts.scope || 'content',
      'data-id': item.id || '',
      role: 'button',
      tabindex: '-1'
    });
    if (item.logo) {
      var logo = el('img', { class: 'list__logo', alt: '', loading: 'lazy', src: item.logo });
      logo.addEventListener('error', function () { logo.parentNode.removeChild(logo); });
      row.appendChild(logo);
    }
    var body = el('div', { class: 'list__body' });
    body.appendChild(el('span', { class: 'list__title', text: item.name || item.title || '' }));
    var sub = opts.subtitleFor ? opts.subtitleFor(item) : item.group || '';
    if (sub) body.appendChild(el('span', { class: 'list__sub', text: sub }));
    row.appendChild(body);
    if (opts.trailing) {
      var trail = opts.trailing(item);
      if (trail) row.appendChild(trail);
    }
    if (opts.onSelect) {
      row.addEventListener('click', function () { opts.onSelect(item); });
    }
    nodes.push(row);
    list.appendChild(row);
  }
  list.getNodes = function () { return nodes; };
  list.filter = function (query) {
    var q = normalizeText(query);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var text = normalizeText(node.textContent);
      var visible = !q || text.indexOf(q) >= 0;
      node.style.display = visible ? '' : 'none';
    }
  };
  return list;
}
