import { PRODUCTS, type Product } from './products';
import { PRODUCTS_ZH } from './products.zh';
import type { Lang } from '../i18n';

/** Return a product with its copy localized for the given language. */
export function localizeProduct(p: Product, lang: Lang): Product {
  if (lang === 'en') return p;
  const z = PRODUCTS_ZH[p.slug];
  if (!z) return p;
  return { ...p, tagline: z.tagline, features: z.features, content: z.content };
}

export function localizedProducts(lang: Lang): Product[] {
  return PRODUCTS.map((p) => localizeProduct(p, lang));
}

export function getLocalizedProduct(slug: string, lang: Lang): Product | undefined {
  const p = PRODUCTS.find((x) => x.slug === slug);
  return p ? localizeProduct(p, lang) : undefined;
}
