/**
 * Avisos efimeros (toast). Solo uno visible a la vez y con timeout.
 */

import { el } from '../../core/dom.js';

export function createToaster(root) {
  var current = null;

  function show(message, type) {
    if (current && current.parentNode) current.parentNode.removeChild(current);
    current = el('div', { class: 'toast toast--' + (type || 'info'), role: 'status', text: message });
    root.appendChild(current);
    setTimeout(function () {
      if (current && current.parentNode) current.parentNode.removeChild(current);
      current = null;
    }, 3200);
    return current;
  }

  return { show: show };
}
