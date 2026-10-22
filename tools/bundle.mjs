/**
 * Empaquetador ESM -> IIFE.
 *
 * Por que no se usa un bundler externo: el paquete tiene que funcionar
 * en TVs con webOS 6.0 (Chromium 79) y el build debe ser reproducible sin
 * descargar dependencias. El codigo fuente usa un subconjunto estricto de
 * ES Modules (solo exports nombrados, sin export *, sin default, sin
 * imports dinamicos), lo que permite un empaquetado simple y seguro.
 *
 * Uso: node tools/bundle.mjs [--entry src/main.js] [--out build/app.bundle.js]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/;
const EXPORT_DECL_RE = /^(\s*)export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_PREFIX_RE = /^(\s*)export\s+(?=(const|let|var|function|class)\s)/;

function parseArgs(argv) {
  const args = { entry: 'src/main.js', out: 'build/app.bundle.js' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--entry') args.entry = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

async function collect(entryFile) {
  const modules = new Map();
  const order = [];

  async function visit(file) {
    const abs = path.resolve(file);
    if (modules.has(abs)) return;
    const source = await readFile(abs, 'utf8');
    const module = { file: abs, source, deps: [], exports: [] };
    modules.set(abs, module);

    const lines = source.split('\n');
    const body = [];
    for (const line of lines) {
      const importMatch = IMPORT_RE.exec(line);
      if (importMatch) {
        const names = importMatch[1]
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => part.replace(/\s+as\s+/, ' as '));
        const specifier = importMatch[2];
        if (!specifier.startsWith('.')) {
          throw new Error(`Import externo no permitido en ${abs}: ${specifier}`);
        }
        const depPath = path.resolve(path.dirname(abs), specifier);
        if (!existsSync(depPath)) {
          throw new Error(`No existe el modulo importado: ${specifier} (en ${abs})`);
        }
        module.deps.push({ specifier, names, file: depPath });
        await visit(depPath);
        continue;
      }
      const exportMatch = EXPORT_DECL_RE.exec(line);
      if (exportMatch) {
        module.exports.push(exportMatch[3]);
        body.push(line.replace(EXPORT_PREFIX_RE, '$1'));
        continue;
      }
      if (/^\s*export\s/.test(line)) {
        throw new Error(`Forma de export no soportada en ${abs}: ${line.trim()}`);
      }
      body.push(line);
    }
    module.body = body.join('\n');
    order.push(module);
  }

  await visit(path.resolve(ROOT, entryFile));
  return { modules, order };
}

function emitModule(module, idByFile) {
  const parts = [];
  for (const dep of module.deps) {
    const depId = idByFile.get(dep.file);
    const bindings = dep.names
      .map((name) => {
        const [source, alias] = name.split(/\s+as\s+/).map((part) => part.trim());
        return alias ? `${source}: ${alias}` : source;
      })
      .join(', ');
    parts.push(`  var { ${bindings} } = __ns_${depId};`);
  }
  const exported = module.exports.map((name) => `${name}: ${name}`).join(', ');
  return [
    `/* ---- ${path.relative(ROOT, module.file)} ---- */`,
    `__ns_${idByFile.get(module.file)} = (function () {`,
    ...parts,
    module.body,
    `  return { ${exported} };`,
    `})();`
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const { order } = await collect(args.entry);
  const idByFile = new Map();
  order.forEach((module, index) => idByFile.set(module.file, index));

  const chunks = [
    '/* NovaStream TV - bundle generado por tools/bundle.mjs. No editar a mano. */',
    '(function () {',
    "'use strict';"
  ];
  order.forEach((module) => {
    chunks.push(`var __ns_${idByFile.get(module.file)};`);
  });
  order.forEach((module) => {
    chunks.push(emitModule(module, idByFile));
  });
  chunks.push('})();');

  const outPath = path.resolve(ROOT, args.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, chunks.join('\n\n'), 'utf8');

  const bytes = Buffer.byteLength(chunks.join('\n\n'), 'utf8');
  console.log(`bundle: ${path.relative(ROOT, outPath)} (${order.length} modulos, ${(bytes / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('error en bundle.mjs:', err.message);
  process.exit(1);
});
