// Builds a standalone preview of the roadmap on synthetic data into the given
// directory (default ./preview, gitignored) and prints how to serve it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'preview'));
fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: [path.join(root, 'test-support/preview-entry.js')], outfile: path.join(out, 'preview.js'), bundle: true, format: 'iife', target: ['es2020'], platform: 'browser', sourcemap: 'inline', logLevel: 'error' });
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><title>preview</title><body><script src="preview.js"></script></body>');
console.log(`preview ready: ${out}`);
