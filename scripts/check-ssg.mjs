import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = 'dist';
const fail = (msg) => {
  console.error(`SSG check failed: ${msg}`);
  process.exit(1);
};

function read(rel) {
  const p = path.join(dist, rel);
  if (!fs.existsSync(p)) fail(`missing file ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function mustContain(rel, html, needle) {
  if (!html.includes(needle)) fail(`${rel} does not contain ${JSON.stringify(needle)}`);
}

// Home (EN)
{
  const h = read('index.html');
  mustContain('index.html', h, '<title>W Platform');
  mustContain('index.html', h, 'og:locale" content="en_US"');
  mustContain('index.html', h, 'rel="canonical" href="https://myfastools.com/"');
  mustContain('index.html', h, 'On shared internet foundations.');
  mustContain('index.html', h, 'hreflang="zh-Hans"');
  // Formal W-Radar code must survive vite build + prerender (no strip)
  mustContain('index.html', h, 'data-code="W-W-LANDING-1E05DAC4"');
  mustContain('index.html', h, 'data-project-id="w-landing"');
  mustContain('index.html', h, 'https://radar.myfastools.com/platform/bootstrap.js');
  if (h.includes('<!--app-html-->')) fail('index.html still has unrendered placeholder');
}

// Home (ZH)
{
  const h = read('zh/index.html');
  mustContain('zh/index.html', h, '<html lang="zh-Hans">');
  mustContain('zh/index.html', h, 'og:locale" content="zh_CN"');
  mustContain('zh/index.html', h, 'rel="canonical" href="https://myfastools.com/zh"');
  mustContain('zh/index.html', h, '找到适合你的工具。');
}

// Product page (EN) — real content, not empty shell
{
  const h = read('w-id/index.html');
  mustContain('w-id/index.html', h, 'W-ID');
  mustContain('w-id/index.html', h, 'identity');
  mustContain('w-id/index.html', h, 'rel="canonical" href="https://myfastools.com/w-id"');
  mustContain('w-id/index.html', h, 'application/ld+json');
  mustContain('w-id/index.html', h, 'window.__APP__');
}

// Product page (ZH)
{
  const h = read('zh/w-id/index.html');
  mustContain('zh/w-id/index.html', h, '身份');
  mustContain('zh/w-id/index.html', h, 'rel="canonical" href="https://myfastools.com/zh/w-id"');
}

// Alias dedup: /products/w-id canonical points to /w-id
{
  const h = read('products/w-id/index.html');
  mustContain('products/w-id/index.html', h, 'rel="canonical" href="https://myfastools.com/w-id"');
}

// Unified SaaS console remains an additive, localized route.
{
  const en = read('console/index.html');
  mustContain('console/index.html', en, 'Loading your verified SaaS context');
  const zh = read('zh/console/index.html');
  mustContain('zh/console/index.html', zh, '正在加载已验证的 SaaS 上下文');
}

// Known project deep links are real static documents, not the English SPA fallback.
{
  const zh = read('zh/console/projects/w-id/index.html');
  mustContain('zh/console/projects/w-id/index.html', zh, '<html lang="zh-Hans">');
  mustContain('zh/console/projects/w-id/index.html', zh, '正在加载已验证的 SaaS 上下文');
}

// Supabase-style project subroutes are localized static shells.
{
  const en = read('console/projects/w-id/auth/index.html');
  mustContain('console/projects/w-id/auth/index.html', en, 'Loading your verified SaaS context');
  mustContain('console/projects/w-id/auth/index.html', en, '/console/projects/w-id/auth');
  const zh = read('zh/console/projects/w-id/auth/index.html');
  mustContain('zh/console/projects/w-id/auth/index.html', zh, '<html lang="zh-Hans">');
  mustContain('zh/console/projects/w-id/auth/index.html', zh, '正在加载已验证的 SaaS 上下文');
  mustContain('zh/console/projects/w-id/auth/index.html', zh, '/zh/console/projects/w-id/auth');
  const database = read('console/projects/w-id/database/index.html');
  mustContain('console/projects/w-id/database/index.html', database, '/console/projects/w-id/database');
  const databaseZh = read('zh/console/projects/w-id/database/index.html');
  mustContain('zh/console/projects/w-id/database/index.html', databaseZh, '/zh/console/projects/w-id/database');
  const functions = read('console/projects/w-id/functions/index.html');
  mustContain('console/projects/w-id/functions/index.html', functions, '/console/projects/w-id/functions');
  const functionsZh = read('zh/console/projects/w-id/functions/index.html');
  mustContain('zh/console/projects/w-id/functions/index.html', functionsZh, '/zh/console/projects/w-id/functions');
  const realtime = read('console/projects/w-id/realtime/index.html');
  mustContain('console/projects/w-id/realtime/index.html', realtime, '/console/projects/w-id/realtime');
  const realtimeZh = read('zh/console/projects/w-id/realtime/index.html');
  mustContain('zh/console/projects/w-id/realtime/index.html', realtimeZh, '/zh/console/projects/w-id/realtime');
  const sites = read('console/projects/w-id/sites/index.html');
  mustContain('console/projects/w-id/sites/index.html', sites, '/console/projects/w-id/sites');
  const sitesZh = read('zh/console/projects/w-id/sites/index.html');
  mustContain('zh/console/projects/w-id/sites/index.html', sitesZh, '<html lang="zh-Hans">');
  mustContain('zh/console/projects/w-id/sites/index.html', sitesZh, '/zh/console/projects/w-id/sites');
}

// sitemap + robots
{
  const sm = read('sitemap.xml');
  mustContain('sitemap.xml', sm, 'https://myfastools.com/w-id');
  mustContain('sitemap.xml', sm, 'https://myfastools.com/zh/w-id');
  if (sm.includes('/products/w-id')) fail('sitemap must not include /products alias');
  read('robots.txt');
  read('404.html');
}

// Check every generated route against the server build, including new products.
const { urls } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
const expectedUrls = urls();
const htmlFiles = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === 'index.html') htmlFiles.push(full);
  }
};
walk(dist);
if (htmlFiles.length !== expectedUrls.length) fail(`expected ${expectedUrls.length} index.html pages, found ${htmlFiles.length}`);
for (const url of expectedUrls) read(`${url.replace(/^\//, '').replace(/\/$/, '')}${url === '/' ? '' : '/'}index.html`);

console.log(`SSG OK: ${htmlFiles.length} static pages, both languages, canonical dedup, sitemap + robots + 404.`);
