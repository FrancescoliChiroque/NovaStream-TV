/**
 * Teclado en pantalla para escribir con el mando.
 *
 * En webOS el teclado del sistema NO aparece solo al enfocar un <input>:
 * hay que pedirlo al servicio IME, y en el navegador de los televisores con
 * webOS Hub directamente no existe. Por eso la app trae su propio teclado,
 * que funciona igual en modo instalado y en modo navegador.
 *
 * Las teclas se recorren con las flechas (navegacion espacial) y se pulsan
 * con ENTER. El texto se escribe directamente en el campo de destino.
 */

import { el, clear } from '../../core/dom.js';

var LAYOUT_LETTERS = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z', 'ñ', '-']
];

var LAYOUT_NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7'],
  ['8', '9', '0', '.', ',', '/', ':'],
  ['@', '_', '-', '+', '#', '&', '?'],
  ['=', '%', '!', '$', '*', "'", '"']
];

export function createKeyboard(options) {
  var opts = options || {};
  var overlay = el('div', { class: 'keyboard-overlay', 'data-hidden': 'true' });
  var box = el('div', { class: 'keyboard', role: 'dialog', 'aria-modal': 'true' });
  var previewLabel = el('div', { class: 'keyboard__target', text: '' });
  var preview = el('div', { class: 'keyboard__preview', text: '' });
  var rowsHost = el('div', { class: 'keyboard__rows' });
  var actionsRow = el('div', { class: 'keyboard__actions' });
  box.appendChild(previewLabel);
  box.appendChild(preview);
  box.appendChild(rowsHost);
  box.appendChild(actionsRow);
  overlay.appendChild(box);

  var target = null;
  var isOpen = false;
  var shift = false;
  var symbols = false;
  var cursor = 0;

  function currentValue() {
    return target && typeof target.value === 'string' ? target.value : '';
  }

  function write(value) {
    if (!target) return;
    target.value = value;
    if (target.setSelectionRange && typeof cursor === 'number') {
      try {
        target.setSelectionRange(cursor, cursor);
      } catch (e) { /* algunos tipos de input no lo admiten */ }
    }
    if (typeof target.dispatchEvent === 'function') {
      try {
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { /* ignorado */ }
    }
    preview.textContent = value || '';
  }

  function insert(text) {
    var value = currentValue();
    if (cursor > value.length) cursor = value.length;
    if (cursor < 0) cursor = 0;
    write(value.slice(0, cursor) + text + value.slice(cursor));
    cursor += text.length;
  }

  function backspace() {
    var value = currentValue();
    if (!value.length) return;
    if (cursor <= 0) return;
    write(value.slice(0, cursor - 1) + value.slice(cursor));
    cursor -= 1;
  }

  function keyLabel(char) {
    return shift ? char.toUpperCase() : char;
  }

  function pressChar(char) {
    insert(keyLabel(char));
  }

  function makeKey(label, options) {
    var keyOptions = options || {};
    var button = el('button', {
      class: 'keyboard__key' + (keyOptions.modifier ? ' keyboard__key--mod' : '') + (keyOptions.wide ? ' keyboard__key--wide' : ''),
      'data-focusable': 'true',
      'data-nav-scope': 'keyboard',
      type: 'button',
      text: label
    });
    button.addEventListener('click', function () {
      if (keyOptions.onPress) keyOptions.onPress();
    });
    return button;
  }

  function renderRows() {
    clear(rowsHost);
    var layout = symbols ? LAYOUT_NUMBERS : LAYOUT_LETTERS;
    layout.forEach(function (row) {
      var rowNode = el('div', { class: 'keyboard__row' });
      row.forEach(function (char) {
        rowNode.appendChild(makeKey(keyLabel(char), { onPress: function () { pressChar(char); } }));
      });
      rowsHost.appendChild(rowNode);
    });
  }

  function renderActions() {
    clear(actionsRow);
    actionsRow.appendChild(makeKey('MAYÚS', {
      modifier: true,
      onPress: function () {
        shift = !shift;
        renderRows();
      }
    }));
    actionsRow.appendChild(makeKey('123', {
      modifier: true,
      onPress: function () {
        symbols = !symbols;
        renderRows();
      }
    }));
    actionsRow.appendChild(makeKey('ESPACIO', {
      wide: true,
      onPress: function () { insert(' '); }
    }));
    actionsRow.appendChild(makeKey('BORRAR', {
      wide: true,
      onPress: function () { backspace(); }
    }));
    actionsRow.appendChild(makeKey('OK', {
      modifier: true,
      onPress: function () { close(); }
    }));
    actionsRow.appendChild(makeKey('CANCELAR', {
      modifier: true,
      onPress: function () { close(true); }
    }));
  }

  function setPageFlag(active) {
    // Marca la pagina para que el dialogo se repositione y siga visible.
    var doc = overlay.ownerDocument || (typeof globalThis !== 'undefined' ? globalThis.document : null);
    if (!doc || !doc.body || !doc.body.classList) return;
    if (active) doc.body.classList.add('has-keyboard');
    else doc.body.classList.remove('has-keyboard');
  }

  /** Texto que identifica el campo que se esta editando. */
  function fieldLabel(field) {
    try {
      var node = field;
      var row = null;
      while (node && node.parentNode) {
        if (String(node.className || '').indexOf('form__row') !== -1) { row = node; break; }
        node = node.parentNode;
      }
      if (!row) return field.getAttribute ? (field.getAttribute('placeholder') || '') : '';
      var children = row.querySelectorAll ? row.querySelectorAll('*') : [];
      for (var i = 0; i < children.length; i++) {
        if (String(children[i].className || '').indexOf('form__label') !== -1) {
          return children[i].textContent || '';
        }
      }
    } catch (e) { /* sin etiqueta */ }
    return '';
  }

  function open(field) {
    if (!field) return;
    target = field;
    previewLabel.textContent = fieldLabel(field);
    shift = false;
    symbols = false;
    var value = currentValue();
    cursor = value.length;
    preview.textContent = value;
    isOpen = true;
    overlay.setAttribute('data-hidden', 'false');
    overlay.classList.add('is-open');
    renderRows();
    renderActions();
    setPageFlag(true);
    // El dialogo se desplaza para que el campo editado siga a la vista.
    try {
      if (field.scrollIntoView) field.scrollIntoView({ block: 'center' });
    } catch (e) { /* ignorado */ }
    var first = rowsHost.querySelector('button');
    if (first && first.focus) {
      try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    }
  }

  function close(cancelled) {
    if (!isOpen) return;
    isOpen = false;
    overlay.setAttribute('data-hidden', 'true');
    overlay.classList.remove('is-open');
    setPageFlag(false);
    var field = target;
    target = null;
    if (!cancelled && opts.onAccept && field) {
      opts.onAccept(field.value || '', field);
    }
    if (opts.onClose) opts.onClose(cancelled, field);
    if (field && field.focus) {
      try { field.focus({ preventScroll: true }); } catch (e) { field.focus(); }
    }
  }

  /**
   * Gestiona las teclas mientras el teclado esta abierto: ENTER pulsa la
   * tecla enfocada, BACK cierra el teclado.
   */
  function handleKey(event) {
    if (!isOpen) return false;
    var code = event.keyCode;
    if (code === 27) {
      event.preventDefault();
      close(true);
      return true;
    }
    if (code === 461) {
      // En un campo de texto el BACK cierra el teclado; en el teclado
      // abierto tambien.
      event.preventDefault();
      close(true);
      return true;
    }
    return false;
  }

  var keyboard = {
    element: overlay,
    open: open,
    close: close,
    isOpen: function () { return isOpen; },
    handleKey: handleKey,
    getTarget: function () { return target; }
  };
  return keyboard;
}
