import fs from 'node:fs';
import path from 'node:path';

const products = fs.readFileSync('src/data/products.ts', 'utf8');
const productImage = fs.readFileSync('src/components/ProductImage.tsx', 'utf8');
const productCard = fs.readFileSync('src/components/ProductCard.tsx', 'utf8');
const productPage = fs.readFileSync('src/components/ProductPage.tsx', 'utf8');

const slugs = [...products.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
const missing = [];

const identities = new Set([...products.matchAll(/slug: '([^']+)',(?:(?!slug:)[\s\S])*?visual: 'identity'/g)].map((match) => match[1]));
for (const slug of slugs) {
    if (identities.has(slug)) continue;
    const imagePath = path.join('public', '_images', 'generated', 'product-ui', `${slug}-product-ui.png`);
    if (!fs.existsSync(imagePath)) {
        missing.push(imagePath);
    }
}

if (missing.length) {
    console.error(`Missing product UI images:\n${missing.join('\n')}`);
    process.exit(1);
}

const requiredSnippets = [
    ['ProductImage supports product-ui', productImage, "'product-ui'"],
    ['ProductImage maps product-ui path', productImage, 'generated/product-ui'],
    ['ProductCard uses product-ui', productCard, 'kind="product-ui"'],
    ['ProductPage uses product-ui', productPage, 'kind="product-ui"'],
];

const missingSnippets = requiredSnippets.filter(([, source, snippet]) => !source.includes(snippet));
if (missingSnippets.length) {
    console.error(
        `Missing product UI wiring:\n${missingSnippets
            .map(([label, , snippet]) => `${label}: ${snippet}`)
            .join('\n')}`,
    );
    process.exit(1);
}

console.log(`Product UI images wired for ${slugs.length} products.`);
