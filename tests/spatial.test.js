import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSpatialNavigator } from '../src/ui/spatial.js';

/** Nodo DOM simulado con la geometria que necesita el navegador espacial. */
class FakeNode {
  constructor(rect, attrs) {
    this.rect = rect;
    this.attrs = attrs || {};
    this.classes = new Set();
    this.focused = false;
    this.scrolled = false;
    this.hidden = false;
    this.offsetParent = {};
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name)
    };
  }
  getBoundingClientRect() {
    return {
      left: this.rect.x,
      top: this.rect.y,
      width: this.rect.w,
      height: this.rect.h,
      right: this.rect.x + this.rect.w,
      bottom: this.rect.y + this.rect.h
    };
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
}

function createRoot(nodes) {
  return {
    querySelectorAll: function (selector) {
      if (selector.indexOf('data-focusable') >= 0) {
        return nodes.filter((node) => node.getAttribute('data-focusable') === 'true');
      }
      return nodes;
    },
    dispatchEvent: function () { return true; }
  };
}

function layout() {
  const a = new FakeNode({ x: 0, y: 0, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'content' });
  const b = new FakeNode({ x: 200, y: 0, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'content' });
  const c = new FakeNode({ x: 0, y: 100, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'content' });
  const d = new FakeNode({ x: 200, y: 100, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'content' });
  return { a, b, c, d, nodes: [a, b, c, d] };
}

test('el foco se mueve en la direccion indicada', () => {
  const l = layout();
  const nav = createSpatialNavigator(createRoot(l.nodes));
  nav.focus(l.a);
  assert.equal(nav.move('right'), true);
  assert.equal(nav.getCurrent(), l.b);
  nav.move('down');
  assert.equal(nav.getCurrent(), l.d);
  nav.move('up');
  assert.equal(nav.getCurrent(), l.b);
  nav.move('left');
  assert.equal(nav.getCurrent(), l.a);
});

test('sin foco previo se enfoca el primer elemento', () => {
  const l = layout();
  const nav = createSpatialNavigator(createRoot(l.nodes));
  nav.move('right');
  assert.equal(nav.getCurrent(), l.a);
});

test('el elemento enfocado recibe la clase is-focused', () => {
  const l = layout();
  const nav = createSpatialNavigator(createRoot(l.nodes));
  nav.focus(l.a);
  assert.equal(l.a.classes.has('is-focused'), true);
  nav.focus(l.b);
  assert.equal(l.a.classes.has('is-focused'), false);
  assert.equal(l.b.classes.has('is-focused'), true);
});

test('focusFirst elige el primer elemento del ambito', () => {
  const navItem = new FakeNode({ x: 0, y: 0, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'nav' });
  const contentItem = new FakeNode({ x: 0, y: 100, w: 100, h: 50 }, { 'data-focusable': 'true', 'data-nav-scope': 'content' });
  const nav = createSpatialNavigator(createRoot([navItem, contentItem]));
  assert.equal(nav.focusFirst('content'), true);
  assert.equal(nav.getCurrent(), contentItem);
});

test('se ignoran los elementos deshabilitados u ocultos', () => {
  const visible = new FakeNode({ x: 0, y: 0, w: 10, h: 10 }, { 'data-focusable': 'true' });
  const disabled = new FakeNode({ x: 100, y: 0, w: 10, h: 10 }, { 'data-focusable': 'true', 'data-disabled': 'true' });
  const nav = createSpatialNavigator(createRoot([visible, disabled]));
  nav.focusFirst();
  assert.equal(nav.getCurrent(), visible);
});
