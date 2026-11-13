import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const products = JSON.parse(execFileSync(process.execPath, ['scripts/export-products.mjs'], { encoding: 'utf8' }));
const root = path.resolve('dist');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}/`) && file !== root) throw new Error('outside root');
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'zh']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const missingImages = [];
    page.on('response', (response) => { if (response.url().includes('/_images/') && response.status() !== 200) missingImages.push(response.url()); });
    await page.route('https://**/*', (route) => route.abort());
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${origin}${lang === 'zh' ? '/zh' : '/'}`);
    const cards = page.locator('#products article[data-product]');
    await page.waitForFunction(() => document.querySelector('#products input')?.value === '');
    assert.equal(await cards.count(), products.length);
    for (const product of products) {
      const card = page.locator(`[data-product="${product.slug}"]`);
      assert.equal(await card.locator('a[target="_blank"]').getAttribute('href'), `https://${product.domain}/`);
    }
    const search = page.locator('#products input');
    await search.fill('patent');
    await page.waitForFunction(() => document.querySelectorAll('#products article').length === 1);
    assert.equal(await cards.first().getAttribute('data-product'), 'w-patent');
    await search.fill('unmatched-product-xyz');
    await page.waitForFunction(() => document.querySelectorAll('#products article').length === 0);
    await page.getByRole('button', { name: lang === 'zh' ? '重置筛选' : 'Reset filters' }).click();
    assert.equal(await cards.count(), products.length);
    await page.getByRole('button', { name: lang === 'zh' ? /研究与分析/ : /Research & analysis/ }).click();
    assert.equal(await cards.count(), products.filter((p) => p.category === 'Analysis').length);
    await page.getByRole('button', { name: lang === 'zh' ? /全部产品/ : /All products/ }).click();
    await search.fill('OpenDrop');
    await page.locator('[data-product="w-opendrop"] .product-card-actions a').first().click();
    await page.waitForURL(`**/${lang === 'zh' ? 'zh/' : ''}w-opendrop`);
    assert.equal(await page.locator('h1').textContent(), 'OpenDrop');
    assert.equal(await page.locator('a[target="_blank"]').first().getAttribute('href'), 'https://opendrop.myfastools.com/');
    await page.goto(`${origin}${lang === 'zh' ? '/zh' : '/'}`);
    await page.locator('#products').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/product-catalog-${lang}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#products').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${lang}: mobile overflow`);
    await page.screenshot({ path: `/tmp/product-catalog-${lang}-mobile.png` });
    await page.locator('#roadmap > summary').click();
    await page.locator('#roadmap-content').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#roadmap').count(), 1, 'Roadmap navigation must have a unique anchor after lazy expansion');
    assert.deepEqual(missingImages, []);
    await page.close();
  }
  console.log(`Catalog UI OK: ${products.length} product links, EN/ZH search, categories, reset, detail navigation and mobile layout.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
