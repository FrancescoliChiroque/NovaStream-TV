import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectPlatformFamily, platformBack, getBrowserInfo } from '../src/platform/webos.js';

test('la numeracion 04.xx.xx se identifica como webOS Hub', function () {
  var info = detectPlatformFamily('04.56.35', 'HYLED43UHD');
  assert.equal(info.family.indexOf('webOS Hub') >= 0, true);
  assert.equal(info.family.indexOf('HYLED') >= 0, true);
  assert.equal(info.version, '04.56.35');
  assert.equal(info.major, 4);
  assert.equal(info.minor, 56);
});

test('un firmware con numeracion 04.0x se trata como webOS TV 4', function () {
  var info = detectPlatformFamily('04.00.06', '42LB6500');
  assert.equal(info.family, 'webOS TV 4');
});

test('los firmwares 06.x corresponden a webOS TV 6.0', function () {
  var info = detectPlatformFamily('06.00.15', 'OLED55C14LB');
  assert.equal(info.family, 'webOS TV 6.0');
});

test('los firmwares 22.x o posteriores se identifican con su numero', function () {
  assert.equal(detectPlatformFamily('22.10.15', 'SMUTV1').family, 'webOS 22');
  assert.equal(detectPlatformFamily('24.05.10', 'SMUTV2').family, 'webOS 24');
});

test('un firmware desconocido no rompe la deteccion', function () {
  var info = detectPlatformFamily('sin-version', '');
  assert.equal(info.family, 'desconocido');
  assert.equal(info.major, 0);
});

test('platformBack usa el popup del sistema cuando la app esta instalada', function () {
  var originalWebOS = globalThis.webOS;
  var called = false;
  globalThis.webOS = {
    service: function () { return Promise.resolve({}); },
    platformBack: function () { called = true; }
  };
  try {
    assert.equal(platformBack(), true);
    assert.equal(called, true);
  } finally {
    globalThis.webOS = originalWebOS;
  }
});

test('platformBack recurre al historial del navegador cuando no hay webOS', function () {
  var originalWebOS = globalThis.webOS;
  var originalHistory = globalThis.history;
  var originalClose = globalThis.close;
  var back = 0;
  delete globalThis.webOS;
  globalThis.history = { length: 3, back: function () { back += 1; } };
  globalThis.close = function () { /* el navegador puede bloquearlo */ };
  try {
    assert.equal(platformBack(), true);
    assert.equal(back, 1);
  } finally {
    globalThis.webOS = originalWebOS;
    globalThis.history = originalHistory;
    globalThis.close = originalClose;
  }
});

test('platformBack avisa cuando no hay forma de salir', function () {
  var originalWebOS = globalThis.webOS;
  var originalHistory = globalThis.history;
  var originalClose = globalThis.close;
  delete globalThis.webOS;
  globalThis.history = { length: 1, back: function () { throw new Error('no'); } };
  globalThis.close = function () { /* bloqueado */ };
  try {
    assert.equal(platformBack(), false);
  } finally {
    globalThis.webOS = originalWebOS;
    globalThis.history = originalHistory;
    globalThis.close = originalClose;
  }
});

test('getBrowserInfo deduce la version del user agent del navegador del TV', function () {
  var originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.41 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.41 WebAppManager webOS/04.56.35'
    }
  });
  try {
    var info = getBrowserInfo();
    assert.equal(info.version, '04.56.35');
    assert.equal(info.family.indexOf('webOS Hub') !== -1, true);
    assert.equal(info.userAgent.indexOf('Web0S') !== -1, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator
    });
  }
});

test('getBrowserInfo no falla sin datos de webOS', function () {
  var originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' }
  });
  try {
    var info = getBrowserInfo();
    assert.equal(info.version, '');
    assert.equal(info.family.indexOf('navegador webOS') !== -1, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator
    });
  }
});

test('getBrowserInfo deduce la version del formato SmartTV del user agent', function () {
  var originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV; 4.56.35) AppleWebKit/537.41 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.41 WebAppManager'
    }
  });
  try {
    var info = getBrowserInfo();
    assert.equal(info.version, '4.56.35');
    assert.equal(info.family.indexOf('webOS Hub') !== -1, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});

test('getBrowserInfo reconoce el user agent de NetCast/Colt', function () {
  var originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Mozilla/5.0 (Linux; NetCast; U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.3945.79 Safari/537.36 SmartTV/10.0 Colt/2.0'
    }
  });
  try {
    var info = getBrowserInfo();
    assert.equal(info.version, '', 'NetCast no incluye la version de webOS');
    assert.equal(info.tokens.indexOf('NetCast') !== -1, true);
    assert.equal(info.tokens.indexOf('SmartTV 10.0') !== -1, true);
    assert.equal(info.tokens.indexOf('Colt 2.0') !== -1, true);
    assert.equal(info.family.indexOf('NetCast') !== -1, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});
