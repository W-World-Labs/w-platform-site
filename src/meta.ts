import type { Resolved } from './routes';
import { dict, localizedHref, LANG_TAG, type Lang } from './i18n';
import { getLocalizedProduct } from './data/localized';

export const SITE_ORIGIN = 'https://myfastools.com';
const DEFAULT_OG = SITE_ORIGIN + '/_images/generated/product-ui/w-id-product-ui.png';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface PageMeta {
  title: string;
  description: string;
  /** Language-independent canonical route (dedupes /products/<slug> onto /<slug>). */
  canonicalRoute: string;
  ogImage: string;
}

function pageMeta(resolved: Resolved): PageMeta {
  const { lang, page } = resolved;
  const d = dict(lang);

  if (page.kind === 'comparison') {
    return {
      title: lang === 'zh' ? 'Cloudflare / Supabase 功能对比 · W Platform' : 'Cloudflare / Supabase feature comparison · W Platform',
      description: lang === 'zh' ? '142 项逐项核对 W 与 Supabase、Cloudflare 的对应能力、实现状态、验收证据和剩余缺口。' : '142 item-by-item comparisons of W, Supabase and Cloudflare capabilities, implementation status, evidence and remaining gaps.',
      canonicalRoute: '/comparison',
      ogImage: DEFAULT_OG,
    };
  }

  if (page.kind === 'product') {
    const product = getLocalizedProduct(page.slug, lang);
    if (product) {
      const overview = product.content?.overview ?? product.tagline;
      return {
        title: `${product.name} — ${product.tagline} · ${d.meta.productTitleSuffix}`,
        description: overview.length > 300 ? overview.slice(0, 297) + '…' : overview,
        canonicalRoute: '/' + product.slug,
        ogImage: `${SITE_ORIGIN}/_images/generated/product-ui/${product.slug}-product-ui.png`,
      };
    }
  }

  if (page.kind === 'notFound') {
    return { title: `404 · ${d.meta.productTitleSuffix}`, description: d.notFound.body, canonicalRoute: '/', ogImage: DEFAULT_OG };
  }

  return { title: d.meta.homeTitle, description: d.meta.homeDescription, canonicalRoute: '/', ogImage: DEFAULT_OG };
}

function alternates(canonicalRoute: string): string {
  const langs: Lang[] = ['en', 'zh'];
  const tags = langs.map(
    (l) => `<link rel="alternate" hreflang="${LANG_TAG[l]}" href="${esc(SITE_ORIGIN + localizedHref(canonicalRoute, l))}" />`,
  );
  tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(SITE_ORIGIN + canonicalRoute)}" />`);
  return tags.join('\n    ');
}

/** Build the contents of <head> (minus charset/viewport, which live in the template). */
export function buildHead(resolved: Resolved): string {
  const { lang } = resolved;
  const m = pageMeta(resolved);
  const canonicalUrl = SITE_ORIGIN + localizedHref(m.canonicalRoute, lang);
  const isNoindex = resolved.page.kind === 'notFound';

  const lines = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(canonicalUrl)}" />`,
    isNoindex ? `<meta name="robots" content="noindex" />` : `<meta name="robots" content="index,follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="W Platform" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(canonicalUrl)}" />`,
    `<meta property="og:image" content="${esc(m.ogImage)}" />`,
    `<meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : 'en_US'}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.ogImage)}" />`,
    alternates(m.canonicalRoute),
  ];

  if (resolved.page.kind === 'product') {
    const product = getLocalizedProduct(resolved.page.slug, lang);
    if (product) {
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: product.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: m.description,
        url: canonicalUrl,
        image: m.ogImage,
        offers: { '@type': 'Offer', price: '19.00', priceCurrency: 'USD' },
        isPartOf: { '@type': 'WebSite', name: 'W Platform', url: SITE_ORIGIN },
      };
      lines.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
    }
  }

  return lines.join('\n    ');
}
