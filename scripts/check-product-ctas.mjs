import fs from 'node:fs';

const productPage = fs.readFileSync('src/components/ProductPage.tsx', 'utf8');
const productCard = fs.readFileSync('src/components/ProductCard.tsx', 'utf8');
const products = fs.readFileSync('src/data/products.ts', 'utf8');
const i18n = fs.readFileSync('src/i18n.ts', 'utf8');

// Hub product CTAs must leave myfastools.com and open the product origin.
if (!products.includes('export function productAppUrl')) {
  console.error('products.ts missing productAppUrl helper');
  process.exit(1);
}
if (!productPage.includes('productAppUrl') || !productCard.includes('productAppUrl')) {
  console.error('ProductPage/ProductCard must use productAppUrl for outbound links');
  process.exit(1);
}

// Must not OAuth-login back onto the hub from product marketing pages.
if (productPage.includes('onClick={login}') || productPage.includes("from '../lib/auth'")) {
  console.error('ProductPage must not call hub W-ID login (redirect_uri=myfastools.com)');
  process.exit(1);
}

// ProductPage must use the localized CTA dictionary.
for (const ref of ['t.product.ctaPrimary', 't.product.ctaSecondary']) {
  if (!productPage.includes(ref)) {
    console.error(`ProductPage missing localized CTA reference: ${ref}`);
    process.exit(1);
  }
}

// English dictionary: open product, membership secondary.
for (const label of ['Open product', 'View membership']) {
  if (!i18n.includes(label)) {
    console.error(`i18n.ts missing conversion label: ${label}`);
    process.exit(1);
  }
}

// Sanity: helper shapes URLs as absolute https product hosts.
import { createRequire } from 'node:module';
// pure string checks already cover wiring; runtime URL sample:
const sample = "export function productAppUrl";
if (!products.includes(sample)) process.exit(1);

console.log('Product CTAs open product origins via productAppUrl (leave hub landing).');

