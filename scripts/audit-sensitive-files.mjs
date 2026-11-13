import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];
if (mode !== 'source' && mode !== 'dist') {
  console.error('usage: audit-sensitive-files.mjs <source|dist>');
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, '..');
const forbiddenNames = [
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)(?:credentials|secrets?)(?:\.[^/]*)?$/i,
];
const allowedExample = /\.env\.(?:example|sample|template)$/i;
const signatures = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['w-id-secret-key', new RegExp('wid_' + 'sk_[A-Za-z0-9_-]{12,}')],
  ['provider-secret-key', new RegExp('(?:^|[^A-Za-z0-9])s' + 'k-[A-Za-z0-9_-]{16,}')],
  ['github-token', new RegExp('gh' + '[pousr]_[A-Za-z0-9]{20,}')],
  ['jwt-value', /eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/],
];

function walk(directory, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

const files = mode === 'source'
  ? execFileSync('git', ['ls-files', '-z'], { cwd: root })
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
  : walk(path.join(root, 'dist'));
const base = mode === 'source' ? root : path.join(root, 'dist');
const violations = [];

for (const relative of files) {
  if (!allowedExample.test(relative) && forbiddenNames.some((rule) => rule.test(relative))) {
    violations.push(`${relative}: forbidden sensitive filename`);
  }
  const absolute = path.join(base, relative);
  const stat = fs.statSync(absolute);
  if (stat.size > 5 * 1024 * 1024) continue;
  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  for (const [name, signature] of signatures) {
    if (signature.test(content)) violations.push(`${relative}: ${name} signature`);
  }
}

if (violations.length > 0) {
  // Deliberately report paths and signature classes only. Never print matched data.
  console.error(`Sensitive-file audit failed (${violations.length} finding(s)):`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Sensitive-file audit OK: ${files.length} ${mode} files checked; no values printed.`);
