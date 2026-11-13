import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, 'build-provenance.json');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && absolute !== manifestPath) files.push(absolute);
  }
  return files;
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('build commit must be a full Git SHA');
const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const files = Object.fromEntries(
  walk(dist)
    .sort()
    .map((absolute) => [path.relative(dist, absolute), sha256(fs.readFileSync(absolute))]),
);
const manifest = {
  schema: 'w-static-build-provenance/v1',
  repository: process.env.GITHUB_REPOSITORY || 'W-World-Labs/w-platform-site',
  commit,
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  node: process.version,
  npm: npmVersion,
  package_lock_sha256: sha256(fs.readFileSync(path.join(root, 'package-lock.json'))),
  files,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
console.log(`Build provenance OK: ${Object.keys(files).length} files bound to ${commit.slice(0, 12)}.`);
