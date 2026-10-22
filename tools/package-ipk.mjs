/**
 * Empaqueta la app web en un IPK con ares-package (@webos-tools/cli).
 *
 * Uso: node tools/package-ipk.mjs [--no-service]
 *   (por defecto incluye el JS Service; con --no-service se omite)
 *
 * Requiere el CLI oficial:
 *   npm install --save-dev @webos-tools/cli
 * o una copia local en node_modules/.bin.
 */

import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'build', 'app');
const SERVICE_DIR = path.join(ROOT, 'service', 'com.novastream.tv.fetch');
const DIST_DIR = path.join(ROOT, 'dist');

function findAresPackage() {
  const local = path.join(ROOT, 'node_modules', '.bin', 'ares-package');
  if (existsSync(local)) return local;
  return null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} termino con codigo ${code}`));
    });
  });
}

async function main() {
  if (!existsSync(BUILD_DIR)) {
    console.error('no existe build/app. Ejecuta antes: npm run build');
    process.exit(1);
  }
  await mkdir(DIST_DIR, { recursive: true });

  const ares = findAresPackage();
  if (!ares) {
    console.error(
      'no se encontro ares-package.\n' +
      'Instala el CLI oficial con:  npm install --save-dev @webos-tools/cli\n' +
      'o ejecuta el comando a mano:  npx ares-package build/app service/com.novastream.tv.fetch -o dist'
    );
    process.exit(1);
  }

  const args = [BUILD_DIR];
  const withService = process.argv.indexOf('--no-service') < 0;
  if (withService) {
    if (!existsSync(SERVICE_DIR)) {
      console.error('no existe service/com.novastream.tv.fetch');
      process.exit(1);
    }
    args.push(SERVICE_DIR);
  }
  args.push('-o', DIST_DIR);

  console.log('Empaquetando...');
  await run(ares, args);

  const files = await readdir(DIST_DIR);
  console.log('IPK generados en dist/:');
  files.filter((file) => file.endsWith('.ipk')).forEach((file) => console.log('  ' + file));
}

main().catch((err) => {
  console.error('error en package-ipk.mjs:', err.message);
  process.exit(1);
});
