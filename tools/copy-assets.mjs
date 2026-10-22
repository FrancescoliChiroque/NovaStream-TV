/**
 * Copia los ficheros necessaryos al directorio de build de la app web.
 *
 * Uso: node tools/copy-assets.mjs
 */

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'build', 'app');

const FILES = ['index.html', 'appinfo.json'];
const DIRS = ['styles', 'vendor', 'assets'];

async function main() {
  await mkdir(BUILD_DIR, { recursive: true });

  for (const file of FILES) {
    const src = path.join(ROOT, file);
    if (!existsSync(src)) {
      console.error(`falta ${file}`);
      process.exit(1);
    }
    await cp(src, path.join(BUILD_DIR, file));
  }

  for (const dir of DIRS) {
    const src = path.join(ROOT, dir);
    if (!existsSync(src)) continue;
    await cp(src, path.join(BUILD_DIR, dir), { recursive: true });
  }

  const bundle = path.join(BUILD_DIR, 'app.bundle.js');
  if (!existsSync(bundle)) {
    console.error('falta app.bundle.js (ejecuta antes: node tools/bundle.mjs --out build/app/app.bundle.js)');
    process.exit(1);
  }

  const info = JSON.parse(await readFile(path.join(BUILD_DIR, 'appinfo.json'), 'utf8'));
  await writeFile(
    path.join(BUILD_DIR, 'appinfo.json'),
    JSON.stringify(info, null, 2) + '\n',
    'utf8'
  );

  console.log(`build/app preparado (${info.id} ${info.version})`);
}

main().catch((err) => {
  console.error('error en copy-assets.mjs:', err.message);
  process.exit(1);
});
