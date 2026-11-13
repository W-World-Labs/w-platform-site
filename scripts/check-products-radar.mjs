// Verify the marketed catalog (src/data/products.ts) against the W-Radar
// platform registry — Radar is the source of truth for which products exist,
// their status, and their public domain. Marketing copy stays here; facts
// must not drift.
//
// Needs W_RADAR_API_KEY (or RADAR_API_KEY). Without a key the online check
// is skipped (exit 0) so offline builds still work.
import fs from 'node:fs';

const products = fs.readFileSync('src/data/products.ts', 'utf8');
const pairs = [...products.matchAll(/slug: '([^']+)',[\s\S]*?domain: '([^']+)'/g)].map(
    (m) => ({ slug: m[1], domain: m[2] }),
);
const map = JSON.parse(fs.readFileSync('scripts/radar-product-map.json', 'utf8'));
delete map._comment;

const errors = [];

for (const { slug } of pairs) {
    if (!map[slug]) errors.push(`${slug}: missing from scripts/radar-product-map.json`);
}
for (const slug of Object.keys(map)) {
    if (!pairs.some((p) => p.slug === slug)) {
        errors.push(`${slug}: mapped but absent from products.ts (delisted? remove from map)`);
    }
}

const key = process.env.W_RADAR_API_KEY || process.env.RADAR_API_KEY;
const base = (process.env.W_RADAR_URL || 'https://radar.myfastools.com').replace(/\/$/, '');

if (!key) {
    console.warn('check-products-radar: no RADAR_API_KEY — offline mapping check only.');
} else {
    const res = await fetch(`${base}/api/platform/projects?workspace_id=ws_platform&limit=500`, {
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) {
        console.error(`check-products-radar: registry fetch failed (${res.status})`);
        process.exit(1);
    }
    const routesResponse = await fetch(`${base}/api/platform/routes?status=active&limit=500`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    if (!routesResponse.ok) throw new Error(`Registry routes fetch failed (${routesResponse.status})`);
    const routes = (await routesResponse.json()).routes ?? [];
    const registry = new Map(((await res.json()).projects ?? []).map((p) => [p.project_id, p]));
    for (const { slug, domain } of pairs) {
        const entry = registry.get(map[slug]);
        if (!entry) {
            errors.push(`${slug}: radar project '${map[slug]}' not found in registry`);
            continue;
        }
        const ownedRoute = routes.find((route) => route.owner === map[slug] && route.status === 'active' && route.public_path === `https://${domain}/`);
        const publicPath = entry.public_path?.startsWith('/') && ownedRoute ? ownedRoute.public_path : entry.public_path || '';
        if (publicPath.startsWith('https://')) {
            const host = publicPath.replace('https://', '').replace(/\/.*$/, '');
            if (host !== domain) {
                errors.push(`${slug}: domain '${domain}' != radar public_path host '${host}'`);
            }
        } else {
            errors.push(`${slug}: radar '${map[slug]}' has no https public_path ('${publicPath}')`);
        }
        if (entry.status !== 'active') {
            console.warn(`check-products-radar: ${slug} radar status is '${entry.status}' (marketed anyway)`);
        }
    }
}

if (errors.length) {
    console.error(`Catalog / Radar registry drift:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
}
console.log(`Catalog verified against Radar registry: ${pairs.length} products.`);
