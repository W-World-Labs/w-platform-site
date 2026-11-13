import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrEntry = pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href;

const SITE_ORIGIN = 'https://myfastools.com';

function outFileFor(url) {
  if (url === '/') return path.join(distDir, 'index.html');
  return path.join(distDir, url.replace(/^\//, ''), 'index.html');
}

async function main() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html missing — run the client build first.');
  }
  // Read the client-built template BEFORE we start overwriting files.
  const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  for (const marker of ['<!--app-head-->', '<!--app-html-->', '<!--app-data-->']) {
    if (!template.includes(marker)) throw new Error(`template missing marker ${marker}`);
  }

  const { render, urls, sitemapUrls } = await import(ssrEntry);
  const allUrls = urls();
  let count = 0;

  for (const url of allUrls) {
    const r = render(url);
    const html = template
      .replace('<html lang="en">', `<html lang="${r.lang}">`)
      .replace('<!--app-head-->', r.head)
      .replace('<!--app-html-->', r.html)
      .replace('<!--app-data-->', r.dataScript);

    const outFile = outFileFor(url);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    count++;
  }

  // sitemap.xml (canonical URLs only)
  const sm = sitemapUrls();
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sm.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);

  // robots.txt
  fs.writeFileSync(
    path.join(distDir, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
  );

  // 404.html (English not-found, for hosts that support it)
  const nf = render('/__not_found__');
  const html404 = template
    .replace('<html lang="en">', `<html lang="${nf.lang}">`)
    .replace('<!--app-head-->', nf.head)
    .replace('<!--app-html-->', nf.html)
    .replace('<!--app-data-->', nf.dataScript);
  fs.writeFileSync(path.join(distDir, '404.html'), html404);

  console.log(`Prerendered ${count} pages + sitemap.xml (${sm.length} urls) + robots.txt + 404.html`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
