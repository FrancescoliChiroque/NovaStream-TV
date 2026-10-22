/**
 * Verifica el contenido de build/app antes de empaquetar.
 * Comprueba que existen los ficheros obligatorios y que el bundle no usa
 * sintaxis que el motor de webOS TV 6.0 (Chromium 79 / ES2019) no soporta.
 *
 * Uso: node tools/verify-build.mjs
 */

import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'build', 'app');

const REQUIRED = [
  'index.html',
  'appinfo.json',
  'app.bundle.js',
  'styles/main.css',
  'assets/icons/icon80.png',
  'assets/icons/icon130.png'
];

/** Sintaxis no disponible en Chromium 79 (webOS TV 6.0). */
const FORBIDDEN = [
  { pattern: /\?\./g, label: 'optional chaining (?.)' },
  { pattern: /\?\?/g, label: 'nullish coalescing (??)' },
  { pattern: /\.replaceAll\(/g, label: 'String.replaceAll' },
  { pattern: /\.at\(/g, label: 'Array/String.at' },
  { pattern: /structuredClone/g, label: 'structuredClone' },
  { pattern: /Object\.hasOwn\(/g, label: 'Object.hasOwn' },
  { pattern: /\bawait\s+import\(/g, label: 'import dinamico' }
];

async function main() {
  const problems = [];

  for (const file of REQUIRED) {
    const full = path.join(BUILD_DIR, file);
    if (!existsSync(full)) {
      problems.push(`falta ${file}`);
      continue;
    }
    const info = await stat(full);
    if (info.size === 0) problems.push(`${file} esta vacio`);
  }

  if (existsSync(path.join(BUILD_DIR, 'appinfo.json'))) {
    try {
      const info = JSON.parse(await readFile(path.join(BUILD_DIR, 'appinfo.json'), 'utf8'));
      if (!info.id) problems.push('appinfo.json sin id');
      if (!info.main) problems.push('appinfo.json sin main');
      if (info.disableBackHistoryAPI !== true) {
        problems.push('appinfo.json deberia usar disableBackHistoryAPI: true (boton Back propio)');
      }
    } catch (err) {
      problems.push(`appinfo.json no es JSON valido: ${err.message}`);
    }
  }

  const bundlePath = path.join(BUILD_DIR, 'app.bundle.js');
  if (existsSync(bundlePath)) {
    const code = await readFile(bundlePath, 'utf8');
    for (const rule of FORBIDDEN) {
      const match = rule.pattern.exec(code);
      if (match) {
        const index = match.index;
        problems.push(`el bundle usa ${rule.label} -> ${JSON.stringify(code.slice(Math.max(0, index - 40), index + 40))}`);
      }
      rule.pattern.lastIndex = 0;
    }
    if (/^\s*import\s/m.test(code) || /^\s*export\s/m.test(code)) {
      problems.push('el bundle contiene sentencias import/export (debe ser un IIFE clasico)');
    }
    if (!/NovaStream TV/.test(code)) problems.push('el bundle no parece contener el codigo de la app');
  }

  if (problems.length) {
    console.error('Verificacion fallida:');
    problems.forEach((problem) => console.error('  - ' + problem));
    process.exit(1);
  }
  console.log('build/app verificado correctamente.');
}

main().catch((err) => {
  console.error('error en verify-build.mjs:', err.message);
  process.exit(1);
});
