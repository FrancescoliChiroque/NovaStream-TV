/**
 * DOM minimo para probar los componentes de interfaz sin navegador.
 * Solo implementa lo que usa src/core/dom.js y los componentes de la UI.
 */

class FakeClassList {
  constructor(node) {
    this.node = node;
    this.set = new Set();
  }
  add() {
    Array.prototype.forEach.call(arguments, (name) => this.set.add(name));
    this.sync();
  }
  remove() {
    Array.prototype.forEach.call(arguments, (name) => this.set.delete(name));
    this.sync();
  }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    var shouldAdd = force === undefined ? !this.set.has(name) : !!force;
    if (shouldAdd) this.set.add(name); else this.set.delete(name);
    this.sync();
    return shouldAdd;
  }
  sync() {
    this.node._className = Array.from(this.set).join(' ');
  }
}

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this.hidden = false;
    this.offsetParent = {};
    this.focused = false;
    this._className = '';
    this._text = '';
    this.classList = new FakeClassList(this);
  }
  get className() { return this._className; }
  set className(value) {
    this._className = String(value);
    this.classList.set = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get textContent() { return this._text; }
  set textContent(value) {
    this._text = String(value);
    this.childNodes = [];
  }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(child) {
    if (!child) return child;
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    var index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }
  removeEventListener(type, handler) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((fn) => fn !== handler);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    var node = this;
    while (node) {
      var handlers = node.listeners[event.type] || [];
      handlers.slice().forEach((handler) => handler(event));
      node = node.parentNode;
    }
    return true;
  }
  focus() { this.focused = true; }
  matches(selector) {
    var value = String(selector).trim();
    if (value === '*') return true;
    var attr = /^\[([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"\]$/.exec(value);
    if (attr) return this.getAttribute(attr[1]) === attr[2];
    var tag = value.toLowerCase();
    return this.tagName.toLowerCase() === tag;
  }
  querySelectorAll(selector) {
    var parts = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
    var found = [];
    var walk = (node) => {
      node.childNodes.forEach((child) => {
        if (parts.some((part) => child.matches(part))) found.push(child);
        walk(child);
      });
    };
    walk(this);
    return found;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  contains(node) {
    if (node === this) return true;
    var child = this;
    while (child) {
      if (child === node) return true;
      child = child.childNodes;
      if (!child) break;
      for (var i = 0; i < child.length; i++) {
        if (child[i].contains(node)) return true;
      }
      break;
    }
    return false;
  }
}

/** Instala un document falso en globalThis y devuelve las utilidades. */
export function installFakeDom() {
  var doc = {
    createElement: (tag) => new FakeNode(tag),
    createTextNode: (text) => {
      var node = new FakeNode('#text');
      node._text = String(text);
      return node;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body')
  };
  globalThis.document = doc;
  // El enrutador y la app escuchan eventos en la ventana.
  var win = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    location: { hash: '', href: '' },
    navigator: { userAgent: 'node-test' }
  };
  globalThis.window = globalThis.window || win;
  if (!globalThis.addEventListener) globalThis.addEventListener = win.addEventListener;
  if (!globalThis.removeEventListener) globalThis.removeEventListener = win.removeEventListener;
  return doc;
}

export function createKeyEvent(type, keyCode, target) {
  return {
    type: type,
    keyCode: keyCode,
    target: target || null,
    defaultPrevented: false,
    preventDefault: function () { this.defaultPrevented = true; }
  };
}
