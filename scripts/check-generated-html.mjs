import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { urls } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
const expectedCount = urls().length + 1;

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const bootstrap = 'https://radar.myfastools.com/platform/bootstrap.js';
const code = 'data-code="W-W-LANDING-1E05DAC4"';
const project = 'data-project-id="w-landing"';
const workspace = 'data-workspace-id="ws_platform"';
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(absolute);
  }
}

walk(dist);
const failures = [];
for (const absolute of htmlFiles) {
  const html = fs.readFileSync(absolute, 'utf8');
  const relative = path.relative(dist, absolute);
  for (const [label, expected] of [
    ['Radar bootstrap', bootstrap],
    ['formal data-code', code],
    ['project id', project],
    ['workspace id', workspace],
  ]) {
    if (!html.includes(expected)) failures.push(`${relative}: missing ${label}`);
  }
}

if (htmlFiles.length !== expectedCount) failures.push(`expected ${expectedCount} HTML files (routes + 404), found ${htmlFiles.length}`);
if (failures.length > 0) {
  console.error('Generated HTML telemetry gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Generated HTML telemetry OK: all ${htmlFiles.length} files contain formal Radar bootstrap attributes.`);
