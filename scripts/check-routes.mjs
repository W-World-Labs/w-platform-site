import fs from 'node:fs';

const products = fs.readFileSync('src/data/products.ts', 'utf8');
const routes = fs.readFileSync('src/routes.ts', 'utf8');
const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const auth = fs.readFileSync('src/lib/auth.ts', 'utf8');

const slugs = [...products.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);

if (slugs.includes('w-design')) {
  console.error('W-Design should be delisted from the public catalog.');
  process.exit(1);
}

if (slugs.includes('products')) {
  console.error('Product slug "products" conflicts with the /products index route.');
  process.exit(1);
}

if (!slugs.length || new Set(slugs).size !== slugs.length) {
  console.error('Product slugs must be non-empty and unique.');
  process.exit(1);
}

for (const fn of ['parsePath', 'routePaths', 'allUrls', 'canonicalRoutePaths']) {
  if (!routes.includes(`export function ${fn}`)) {
    console.error(`routes.ts missing export: ${fn}`);
    process.exit(1);
  }
}

if (layout.includes('location.replace(')) {
  console.error('Localized URLs must be authoritative; Layout must not redirect from a language effect.');
  process.exit(1);
}

if (!auth.includes('callbackInFlight ??= processCallback()')) {
  console.error('OAuth callback handling must remain single-flight under React StrictMode.');
  process.exit(1);
}

console.log(`Route model covers ${slugs.length} products (W-Design delisted).`);
