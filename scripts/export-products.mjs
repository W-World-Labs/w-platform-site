// Export the canonical product catalog (src/data/products.ts) as JSON on
// stdout. Downstream consumers (product-landings/_products.json in this repo) must
// regenerate from this instead of hand-copying:
//
//   npm run export:products -- > product-landings/_products.json
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/data/products.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const module_ = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
process.stdout.write(`${JSON.stringify(module_.PRODUCTS, null, 2)}\n`);
