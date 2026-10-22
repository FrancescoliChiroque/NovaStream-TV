/**
 * Dialogo modal con navegacion por mando.
 * Las acciones se recorren con izquierda/derecha y se confirman con ENTER.
 */

import { el, clear } from '../../core/dom.js';

/** Marca un nodo y sus descendientes con un ambito de navegacion. */
function tagScope(node, scope) {
  if (!node || !node.setAttribute) return;
  tagNode(node, scope);
  var children = node.querySelectorAll ? node.querySelectorAll('*') : [];
  for (var i = 0; i < children.length; i++) {
    tagNode(children[i], scope);
  }
}

function tagNode(node, scope) {
  node.setAttribute('data-nav-scope', scope);
  var tag = String(node.tagName || '').toUpperCase();
  // Cualquier campo de un dialogo debe poder recibir el foco con el mando.
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    node.setAttribute('data-focusable', 'true');
  }
}

/** Dialogos abiertos ahora mismo (para que el shell no robe las teclas). */
var openDialogs = [];

export function isAnyDialogOpen() {
  return openDialogs.length > 0;
}

/** Cierra el dialogo que esta encima (el ultimo abierto). */
export function closeTopDialog() {
  if (!openDialogs.length) return false;
  var dialog = openDialogs[openDialogs.length - 1];
  if (dialog && typeof dialog.close === 'function') {
    dialog.close();
    return true;
  }
  return false;
}

export function createDialog(options) {
  var opts = options || {};
  var overlay = el('div', { class: 'dialog-overlay', 'data-hidden': 'true' });
  var box = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' });
  overlay.appendChild(box);

  var actions = opts.actions || [];
  var currentIndex = 0;
  var onClose = opts.onClose || null;
  var isOpen = false;

  function render(focusFirstField) {
    clear(box);
    if (opts.title) box.appendChild(el('h2', { class: 'dialog__title', text: opts.title }));
    if (opts.message) box.appendChild(el('p', { class: 'dialog__message', text: opts.message }));
    if (opts.body) {
      // El contenido del dialogo pertenece al ambito 'dialog' para que la
      // navegacion espacial no se salga del dialogo hacia la vista de fondo.
      tagScope(opts.body, 'dialog');
      box.appendChild(opts.body);
    }
    var actionRow = el('div', { class: 'dialog__actions' });
    var nodes = [];
    actions.forEach(function (action, index) {
      var button = el('button', {
        class: 'dialog__action' + (action.primary ? ' dialog__action--primary' : ''),
        'data-focusable': 'true',
        'data-nav-scope': 'dialog',
        'data-action-index': String(index),
        type: 'button',
        text: action.label
      });
      if (index === currentIndex) button.classList.add('is-focused');
      button.addEventListener('click', function () {
        currentIndex = index;
        select();
      });
      nodes.push(button);
      actionRow.appendChild(button);
    });
    box.appendChild(actionRow);
    var toFocus = null;
    if (focusFirstField) {
      // Al abrir, el foco va al primer campo del formulario (si hay) y no al
      // boton, para poder escribir directamente con el teclado en pantalla.
      toFocus = box.querySelector('[data-focusable="true"]');
    }
    if (!toFocus) toFocus = nodes[currentIndex];
    if (toFocus && toFocus.focus) {
      try { toFocus.focus({ preventScroll: true }); } catch (e) { toFocus.focus(); }
    }
  }

  function select() {
    var action = actions[currentIndex];
    if (!action) {
      close();
      return;
    }
    if (action.onSelect) {
      var keepOpen = action.onSelect();
      if (keepOpen === false) return;
    }
    if (action.closeOnSelect !== false) close();
  }

  function open() {
    isOpen = true;
    currentIndex = 0;
    overlay.setAttribute('data-hidden', 'false');
    overlay.classList.add('is-open');
    if (openDialogs.indexOf(dialog) < 0) openDialogs.push(dialog);
    render(true);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.setAttribute('data-hidden', 'true');
    overlay.classList.remove('is-open');
    var index = openDialogs.indexOf(dialog);
    if (index >= 0) openDialogs.splice(index, 1);
    if (onClose) onClose();
  }

  function handleKey(event) {
    if (!isOpen) return false;
    var code = event.keyCode;

    if (code === 27 || code === 461) {
      event.preventDefault();
      close();
      return true;
    }

    var target = event.target;
    var isField = !!(target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    ));
    if (isField) {
      // En un campo de texto las teclas las gestiona el campo; ENTER lo
      // consume el shell para abrir el teclado en pantalla.
      return false;
    }

    if (code === 13) {
      // Se confirma el boton que tenga el foco real (no el interno), para
      // que la navegacion espacial y las flechas sigan siendo coherentes.
      var focused = typeof document !== 'undefined' ? document.activeElement : null;
      var index = focused && focused.getAttribute ? focused.getAttribute('data-action-index') : null;
      if (index !== null && index !== undefined && index !== '') {
        currentIndex = parseInt(index, 10);
      }
      event.preventDefault();
      select();
      return true;
    }

    if (code === 37 || code === 39) {
      // Las flechas horizontales recorren las acciones del dialogo.
      event.preventDefault();
      var delta = code === 39 ? 1 : -1;
      currentIndex = (currentIndex + delta + actions.length) % Math.max(1, actions.length);
      render(false);
      return true;
    }

    // Las flechas verticales las gestiona la navegacion espacial, con el
    // foco restringido al ambito del dialogo (para recorrer los campos).
    return false;
  }

  overlay.addEventListener('keydown', handleKey);

  var dialog = {
    element: overlay,
    open: open,
    close: close,
    isOpen: function () { return isOpen; },
    handleKey: handleKey,
    setActions: function (newActions) {
      actions = newActions || [];
      if (isOpen) render(false);
    },
    setBody: function (body) {
      opts.body = body || null;
      if (isOpen) render(true);
    },
    setMessage: function (message) {
      opts.message = message;
      if (isOpen) render(false);
    }
  };
  return dialog;
}
