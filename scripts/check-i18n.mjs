import fs from 'node:fs';

const products = fs.readFileSync('src/data/products.ts', 'utf8');
const zh = fs.readFileSync('src/data/products.zh.ts', 'utf8');
const i18n = fs.readFileSync('src/i18n.ts', 'utf8');

const enSlugs = [...products.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
// Top-level keys in PRODUCTS_ZH are indented exactly two spaces.
const zhSlugs = [...zh.matchAll(/^ {2}'([^']+)': \{$/gm)].map((m) => m[1]);

const missing = enSlugs.filter((s) => !zhSlugs.includes(s));
if (missing.length) {
  console.error(`Missing zh translation for: ${missing.join(', ')}`);
  process.exit(1);
}

const extra = zhSlugs.filter((s) => !enSlugs.includes(s));
if (extra.length) {
  console.error(`Stale zh translation (no matching product): ${extra.join(', ')}`);
  process.exit(1);
}

// Both languages must be wired in the dictionary.
for (const key of ['en:', 'zh:']) {
  if (!i18n.includes(key)) {
    console.error(`i18n.ts missing dictionary: ${key}`);
    process.exit(1);
  }
}

console.log(`i18n: ${zhSlugs.length}/${enSlugs.length} products translated to zh; EN + ZH dictionaries present.`);
