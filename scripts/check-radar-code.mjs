/**
 * Assert formal W-Radar tracking code is present in:
 *  1) the Vite HTML shell (and dist after build when present) → w-landing
 *  2) product-landings/<slug>/index.html → per-product formal codes[]
 * Domain resolve is only a fallback; live pages must ship explicit data-code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Keep in sync with product-landings/_gen.py _RADAR_CODES
// slug -> [data-project-id, formal tracking code]
const PRODUCT_LANDING_CODES = {
  'w-hospital': ['omnihospital', 'W-OMNIHOSPITAL-3023AC8D'],
  'w-nvr': ['w-nvr', 'W-W-NVR-3C264AE4'],
  'w-omnisense': ['w-omnisense', 'W-W-OMNISENSE-4027D2C4'],
  'w-domain': ['w-domain', 'W-W-DOMAIN-D08716B8'],
  'w-search': ['w-search', 'OBS-W-SEARCH-5488B373'],
  'w-erp': ['w-erp', 'OBS-ONEMAN-ERP-B25EAFF8'],
  'w-quant': ['w-quant', 'W-W-QUANT-03A94073'],
  'w-collect': ['w-collect', 'W-W-COLLECT-38869D2E'],
  'w-maas': ['blackbox-maas', 'OBS-BLACKBOX-MAAS-DB9B17E5'],
  'w-inspector': ['w-inspector', 'W-W-INSPECTOR-D32920AE'],
  'w-daas': ['w-daas', 'W-W-DAAS-75AF96EA'],
  'w-id': ['w-id', 'W-W-ID-A39BD350'],
  'w-radar': ['radar', 'OBS-RADAR-FF2E963F'],
  'w-imagetrace': ['image-trace', 'W-IMAGE-TRACE-63349900'],
  'w-transfer': ['anytransfer-rust', 'OBS-ANYTRANSFER-RUST-B51B7D75'],
  'w-translate': ['omnitranslate', 'W-OMNITRANSLATE-E85E9EAF'],
  'w-jcr': ['jcr-query', 'W-JCR-QUERY-1F843C6E'],
  'w-netsense': ['w-netsense-ct', 'W-W-NETSENSE-CT-A3B77BC1'],
  'w-medtwin': ['medtwin-quality', 'W-MEDTWIN-QUALITY-A1C7DC82'],
  'w-knowledge': ['knowledge-unzip', 'W-KNOWLEDGE-UNZIP-9CE7E97E'],
  'w-modelgw': ['ai-gateway-cloudflare', 'OBS-AI-GATEWAY-CLOUDFLARE-055A8B75'],
};

const FORMAL_CODE = 'W-W-LANDING-1E05DAC4';
const PROJECT_ID = 'w-landing';
const BOOTSTRAP =
  'https://radar.myfastools.com/platform/bootstrap.js';

const fail = (msg) => {
  console.error(`Radar code check failed: ${msg}`);
  process.exit(1);
};

function assertBootstrap(rel, html, formalCode, projectId) {
  if (!html.includes(BOOTSTRAP)) {
    fail(`${rel} missing bootstrap.js src ${BOOTSTRAP}`);
  }
  if (!html.includes(`data-code="${formalCode}"`)) {
    fail(`${rel} missing data-code="${formalCode}"`);
  }
  if (!html.includes(`data-project-id="${projectId}"`)) {
    fail(`${rel} missing data-project-id="${projectId}"`);
  }
  if (!html.includes('data-workspace-id="ws_platform"')) {
    fail(`${rel} missing data-workspace-id="ws_platform"`);
  }
  // Guard against accidental strip / wrong formal code elsewhere in shell
  const codes = [...html.matchAll(/data-code="([^"]*)"/g)].map((m) => m[1]);
  for (const c of codes) {
    if (c !== formalCode) fail(`${rel} unexpected data-code="${c}"`);
  }
}

// Source shell (always required; cheap, no build)
{
  const rel = 'index.html';
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail(`missing ${rel}`);
  assertBootstrap(rel, fs.readFileSync(p, 'utf8'), FORMAL_CODE, PROJECT_ID);
}

// Built artifacts when present (after npm run build / prerender)
const distIndex = path.join(root, 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  assertBootstrap(
    'dist/index.html',
    fs.readFileSync(distIndex, 'utf8'),
    FORMAL_CODE,
    PROJECT_ID,
  );
  // Spot-check a few prerendered pages share the same shell attrs
  for (const rel of ['dist/zh/index.html', 'dist/w-id/index.html', 'dist/404.html']) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) {
      assertBootstrap(rel, fs.readFileSync(p, 'utf8'), FORMAL_CODE, PROJECT_ID);
    }
  }
}

// product-landings monorepo pages (per-product formal codes)
{
  const productsPath = path.join(root, 'product-landings', '_products.json');
  if (!fs.existsSync(productsPath)) fail('missing product-landings/_products.json');
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  let checked = 0;
  for (const p of products) {
    const slug = p.slug;
    const expected = PRODUCT_LANDING_CODES[slug];
    if (!expected) {
      // Unknown slug may ship project-id-only bootstrap; require bootstrap present
      const rel = `product-landings/${slug}/index.html`;
      const htmlPath = path.join(root, rel);
      if (!fs.existsSync(htmlPath)) fail(`missing ${rel}`);
      const html = fs.readFileSync(htmlPath, 'utf8');
      if (!html.includes(BOOTSTRAP)) fail(`${rel} missing bootstrap.js`);
      if (!html.includes('data-project-id="product-landings"')) {
        fail(`${rel} unknown slug must use data-project-id=product-landings`);
      }
      if (/data-code="/.test(html)) {
        fail(`${rel} unknown slug must not invent data-code`);
      }
      checked += 1;
      continue;
    }
    const [projectId, formalCode] = expected;
    const rel = `product-landings/${slug}/index.html`;
    const htmlPath = path.join(root, rel);
    if (!fs.existsSync(htmlPath)) fail(`missing ${rel}`);
    assertBootstrap(rel, fs.readFileSync(htmlPath, 'utf8'), formalCode, projectId);
    checked += 1;
  }
  console.log(
    `Radar code OK: landing=${FORMAL_CODE} + ${checked} product-landings pages` +
      (fs.existsSync(distIndex) ? ' (source + dist + landings)' : ' (source + landings; dist not required)'),
  );
}
