/**
 * Navegacion espacial con el mando.
 * Calcula el elemento focusable mas cercano en la direccion indicada usando
 * la geometria real (no coordenadas fijas), de forma que funciona con
 * cualquier distribucion de rejilla.
 */

import { focusableIn, revealElement } from '../core/dom.js';

function centerX(node) {
  var rect = node.getBoundingClientRect();
  return rect.left + rect.width / 2;
}

function centerY(node) {
  var rect = node.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

function rectOf(node) {
  return node.getBoundingClientRect();
}

export function createSpatialNavigator(root) {
  var current = null;

  function candidates() {
    return focusableIn(root);
  }

  function scopeOf(node) {
    return node && node.getAttribute ? node.getAttribute('data-nav-scope') : null;
  }

  function focus(node, opts) {
    var options = opts || {};
    if (!node) return false;
    var previous = current;
    if (previous && previous !== node) previous.classList.remove('is-focused');
    current = node;
    node.classList.add('is-focused');
    try { node.focus({ preventScroll: true }); } catch (e) { try { node.focus(); } catch (e2) { /* ignorado */ } }
    revealElement(node);
    if (!options.silent && previous !== node) {
      root.dispatchEvent(new CustomEvent('nav:change', { bubbles: true, detail: { node: node } }));
    }
    return true;
  }

  /**
   * Sincroniza el elemento actual con el que tiene el foco real del
   * navegador (por ejemplo, un campo de texto enfocado directamente).
   */
  function syncCurrent() {
    if (typeof document === 'undefined') return;
    var active = document.activeElement;
    if (!active || active === current) return;
    if (!root.contains(active)) return;
    if (active.getAttribute('data-focusable') !== 'true') return;
    if (current) current.classList.remove('is-focused');
    current = active;
    current.classList.add('is-focused');
  }

  /**
   * Mueve el foco en una direccion ('left' | 'right' | 'up' | 'down').
   * @param {string} direction
   * @param {string} [scopeFilter] si se indica, solo se consideran los
   *   elementos que pertenecen a ese ambito (por ejemplo 'dialog' o
   *   'keyboard'), de forma que el foco no se salga de un dialogo abierto.
   */
  function move(direction, scopeFilter) {
    syncCurrent();
    var list = candidates();
    if (scopeFilter) {
      list = list.filter(function (node) { return scopeOf(node) === scopeFilter; });
    }
    if (!list.length) return false;
    if (!current || list.indexOf(current) < 0) {
      return focus(list[0]);
    }
    var from = rectOf(current);
    var fx = from.left + from.width / 2;
    var fy = from.top + from.height / 2;
    var scope = scopeOf(current);
    var best = null;
    var bestScore = Infinity;

    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (node === current) continue;
      var rect = rectOf(node);
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = cx - fx;
      var dy = cy - fy;
      var primary;
      var secondary;
      if (direction === 'left') {
        if (dx >= -1) continue;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (direction === 'right') {
        if (dx <= 1) continue;
        primary = dx;
        secondary = Math.abs(dy);
      } else if (direction === 'up') {
        if (dy >= -1) continue;
        primary = -dy;
        secondary = Math.abs(dx);
      } else {
        if (dy <= 1) continue;
        primary = dy;
        secondary = Math.abs(dx);
      }
      var overlap = direction === 'left' || direction === 'right'
        ? Math.max(0, Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top))
        : Math.max(0, Math.min(from.right, rect.right) - Math.max(from.left, rect.left));
      var score = primary + secondary * 0.6 - overlap * 0.25;
      if (scope && scopeOf(node) === scope) score -= 120;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }

    if (!best) {
      var sameScope = list.filter(function (node) { return scopeOf(node) === scope; });
      if (sameScope.length) {
        var fallback = direction === 'left' || direction === 'up' ? sameScope[0] : sameScope[sameScope.length - 1];
        best = fallback;
      }
    }
    if (!best) return false;
    return focus(best);
  }

  /** Primer elemento focusable del ambito indicado. */
  function focusFirst(scope) {
    var list = candidates();
    if (!list.length) return false;
    for (var i = 0; i < list.length; i++) {
      if (!scope || scopeOf(list[i]) === scope) return focus(list[i]);
    }
    return focus(list[0]);
  }

  function restore() {
    if (current && document.contains(current)) {
      current.classList.remove('is-focused');
      current = null;
    }
  }

  return {
    focus: focus,
    move: move,
    focusFirst: focusFirst,
    restore: restore,
    getCurrent: function () { return current; },
    syncCurrent: syncCurrent,
    setRoot: function (newRoot) { root = newRoot; },
    candidates: candidates
  };
}
