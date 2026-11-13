import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const inventory = JSON.parse(await fs.readFile('src/data/platform-comparison.json', 'utf8'));
assert.equal(inventory.length, 142);
assert.equal(new Set(inventory.map((row) => row.id)).size, inventory.length);
for (const row of inventory) {
  assert.ok(row.feature.en && row.feature.zh && row.detail.en && row.detail.zh);
  assert.ok(row.official.startsWith('https://'));
  if (row.status === 'verified') assert.equal(row.level, 'production');
}
const root = path.resolve('dist');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/auth/me') { res.writeHead(401); res.end('{}'); return; }
    let file = path.resolve(root, `.${pathname}`);
    assert.ok(file.startsWith(`${root}/`) || file === root);
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const lang of ['en', 'zh']) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://**/*', (route) => route.abort());
    const route = `${lang === 'zh' ? '/zh' : ''}/comparison`;
    await page.goto(origin + route);
    const tableRows = page.locator('[data-comparison-row]');
    assert.equal(await tableRows.count(), inventory.length, 'prerender must include every row');
    const platform = page.getByLabel(lang === 'zh' ? '平台' : 'Platform', { exact: true });
    await platform.selectOption('Cloudflare');
    await page.waitForFunction(() => document.querySelectorAll('[data-comparison-row]').length === 47);
    const search = page.getByRole('searchbox');
    await search.fill('D1');
    await page.waitForFunction(() => document.querySelectorAll('[data-comparison-row]').length === 1);
    assert.match(await tableRows.first().textContent(), /D1/);
    await search.fill('does-not-match-xyz');
    await page.waitForFunction(() => document.querySelectorAll('[data-comparison-row]').length === 0);
    await page.getByRole('button', { name: lang === 'zh' ? '重置筛选' : 'Reset filters' }).click();
    assert.equal(await tableRows.count(), inventory.length);
    await platform.selectOption('Supabase');
    assert.equal(await tableRows.count(), 87);
    const category = page.getByLabel(lang === 'zh' ? '功能分类' : 'Category', { exact: true });
    await category.selectOption('realtime');
    assert.equal(await tableRows.count(), inventory.filter((row) => row.platform === 'Supabase' && row.group === 'realtime').length);
    await platform.selectOption('Acceptance');
    assert.equal(await category.inputValue(), 'all', 'platform change must clear incompatible category');
    assert.equal(await tableRows.count(), 8);
    const status = page.getByLabel(lang === 'zh' ? 'W 状态' : 'W status', { exact: true });
    await status.selectOption('verified');
    assert.equal(await tableRows.count(), 3);
    await page.getByRole('button', { name: lang === 'zh' ? '重置筛选' : 'Reset filters' }).click();
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://myfastools.com${route}`);
    const violations = (await new AxeBuilder({ page }).include('.platform-comparison').analyze()).violations;
    assert.deepEqual(violations.map((item) => ({ id: item.id, impact: item.impact })), []);
    await page.screenshot({ path: `/tmp/w-platform-comparison-20261006/${lang}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${lang}: mobile overflow`);
    await page.locator('#comparison-table').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/w-platform-comparison-20261006/${lang}-mobile.png` });
    await page.goto(origin + route + '#cloudflare-117');
    assert.equal(await tableRows.count(), inventory.length);
    assert.ok(await page.locator('#cloudflare-117').count());
    assert.deepEqual(errors, [], 'no browser or hydration errors');
    await page.goto(origin + (lang === 'zh' ? '/zh' : '/'));
    await page.locator('.comparison-home-link a').click();
    await page.waitForURL(`**${route}`);
    assert.equal(await tableRows.count(), inventory.length);
    await context.close();
  }
  console.log('Comparison UI OK: 142 prerendered bilingual rows, filters, reset, navigation, canonical URLs, a11y and mobile layout.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
