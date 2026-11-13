import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const assets = path.join(dist, 'assets');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const entryMatch = html.match(/<script type="module" crossorigin src="\/assets\/([^\"]+\.js)"><\/script>/);
const failures = [];

if (!entryMatch) {
  failures.push('index.html has no hashed module entry');
} else {
  const entryName = entryMatch[1];
  const entry = fs.readFileSync(path.join(assets, entryName));
  const rawBytes = entry.byteLength;
  const gzipBytes = gzipSync(entry).byteLength;
  if (rawBytes > 360_000) failures.push(`home entry raw budget exceeded: ${rawBytes} > 360000 bytes`);
  if (gzipBytes > 115_000) failures.push(`home entry gzip budget exceeded: ${gzipBytes} > 115000 bytes`);

  const javascript = fs.readdirSync(assets).filter((name) => name.endsWith('.js'));
  const invalidHashes = javascript.filter((name) => !/-[A-Za-z0-9_-]{8}\.js$/.test(name));
  if (invalidHashes.length) failures.push(`unhashed JavaScript assets: ${invalidHashes.join(', ')}`);

  const contents = new Map(javascript.map((name) => [name, fs.readFileSync(path.join(assets, name), 'utf8')]));
  const realtimeSdkChunks = javascript.filter((name) => /export\{[^}]+as RealtimeClient\}/.test(contents.get(name)));
  const realtimeUiChunks = javascript.filter((name) => contents.get(name).includes('realtime-status-title'));
  if (realtimeSdkChunks.length !== 1) failures.push(`expected one isolated Realtime SDK chunk, found ${realtimeSdkChunks.length}`);
  if (realtimeUiChunks.length !== 1) failures.push(`expected one isolated Realtime UI chunk, found ${realtimeUiChunks.length}`);
  if (realtimeSdkChunks.includes(entryName) || realtimeUiChunks.includes(entryName)) failures.push('home entry contains Realtime SDK or UI');

  const homePreloads = [...html.matchAll(/<link rel="modulepreload"[^>]+href="\/assets\/([^\"]+\.js)"/g)].map((match) => match[1]);
  const eagerRealtime = homePreloads.filter((name) => realtimeSdkChunks.includes(name) || realtimeUiChunks.includes(name));
  if (eagerRealtime.length) failures.push(`home eagerly preloads Realtime chunks: ${eagerRealtime.join(', ')}`);

  if (!failures.length) console.log(`Bundle budget OK: home entry ${rawBytes} bytes raw / ${gzipBytes} bytes gzip; Realtime SDK and UI are lazy hashed chunks.`);
}

if (failures.length) {
  console.error('Bundle budget gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
