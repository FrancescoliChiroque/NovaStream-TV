/**
 * Utilidades DOM minimas (sin framework).
 * Objetivo: reducir trabajo de render y mantener el coste de CPU bajo en
 * procesadores de Smart TV.
 */

export function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) {
    var keys = Object.keys(attrs);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = attrs[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'text') node.textContent = String(value);
      else if (key === 'html') node.innerHTML = String(value);
      else if (key === 'class') node.className = value;
      else if (key === 'dataset') {
        var dkeys = Object.keys(value);
        for (var d = 0; d < dkeys.length; d++) node.dataset[dkeys[d]] = String(value[dkeys[d]]);
      } else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
  }
  if (children) {
    var list = Array.isArray(children) ? children : [children];
    for (var c = 0; c < list.length; c++) {
      var child = list[c];
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function qs(selector, root) {
  return (root || document).querySelector(selector);
}

export function qsa(selector, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(selector));
}

/** Elementos que pueden recibir foco con el mando. */
export function focusableIn(root) {
  return qsa('[data-focusable="true"]:not([data-disabled="true"])', root).filter(function (node) {
    return !node.hidden && node.offsetParent !== null;
  });
}

/** Adds la clase de foco y hace scroll para que el elemento quede visible. */
export function revealElement(node) {
  if (!node || !node.scrollIntoView) return;
  try {
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch (e) {
    node.scrollIntoView();
  }
}

/** Texto seguro para insertar en HTML (sin depender de innerHTML). */
export function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Normaliza texto para busquedas (sin acentos, minusculas). */
export function normalizeText(value) {
  var text = String(value === null || value === undefined ? '' : value).toLowerCase();
  if (text.normalize) {
    try {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) { /* ignorado */ }
  }
  return text;
}

/** Debounce simple. */
export function debounce(fn, waitMs) {
  var timer = null;
  return function () {
    var args = arguments;
    var self = this;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      fn.apply(self, args);
    }, waitMs);
  };
}
