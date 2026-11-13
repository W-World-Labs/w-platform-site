import { PRODUCTS } from './data/products';
import { type Lang, DEFAULT_LANG, localizedHref } from './i18n';

export type Page =
  | { kind: 'home' }
  | { kind: 'comparison' }
  | { kind: 'console'; projectId?: string; surface?: ProjectConsoleSurface }
  | { kind: 'product'; slug: string; alias: boolean }
  | { kind: 'notFound' };

export type ProjectConsoleSurface = 'overview' | 'connect' | 'auth' | 'database' | 'backups' | 'storage' | 'functions' | 'sites' | 'realtime' | 'observability';

const PROJECT_CONSOLE_SURFACES = new Set<ProjectConsoleSurface>([
  'overview', 'connect', 'auth', 'database', 'backups', 'storage', 'functions', 'sites', 'realtime', 'observability',
]);

export interface Resolved {
  lang: Lang;
  /** Language-independent canonical route path: '/', '/w-id', '/products/w-id'. */
  routePath: string;
  page: Page;
}

const SLUGS = new Set(PRODUCTS.map((p) => p.slug));

function stripTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.replace(/\/+$/, '');
  return p;
}

/** Resolve any request pathname into a language + canonical route + page. */
export function parsePath(pathname: string): Resolved {
  let path = stripTrailingSlash(pathname || '/');

  let lang: Lang = DEFAULT_LANG;
  if (path === '/zh' || path.startsWith('/zh/')) {
    lang = 'zh';
    path = path.slice(3) || '/';
    if (!path.startsWith('/')) path = '/' + path;
  }

  // Home
  if (path === '/' || path === '/products') {
    return { lang, routePath: '/', page: { kind: 'home' } };
  }
  if (path === '/comparison') {
    return { lang, routePath: '/comparison', page: { kind: 'comparison' } };
  }
  if (path === '/console') {
    return { lang, routePath: '/console', page: { kind: 'console' } };
  }
  const projectConsoleMatch = path.match(/^\/console\/projects\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})(?:\/(overview|connect|auth|database|backups|storage|functions|sites|realtime|observability))?$/);
  if (projectConsoleMatch) {
    const projectId = projectConsoleMatch[1];
    const candidate = projectConsoleMatch[2];
    const surface = candidate && PROJECT_CONSOLE_SURFACES.has(candidate as ProjectConsoleSurface)
      ? candidate as ProjectConsoleSurface
      : 'overview';
    return {
      lang,
      routePath: `/console/projects/${projectId}${candidate ? `/${surface}` : ''}`,
      page: { kind: 'console', projectId, surface },
    };
  }

  // /products/<slug> alias
  if (path.startsWith('/products/')) {
    const slug = path.slice('/products/'.length);
    if (SLUGS.has(slug)) {
      return { lang, routePath: '/products/' + slug, page: { kind: 'product', slug, alias: true } };
    }
    return { lang, routePath: path, page: { kind: 'notFound' } };
  }

  // /<slug>
  const slug = path.slice(1);
  if (SLUGS.has(slug)) {
    return { lang, routePath: '/' + slug, page: { kind: 'product', slug, alias: false } };
  }

  return { lang, routePath: path, page: { kind: 'notFound' } };
}

/** Canonical, deduped route paths (no /products aliases) — used for sitemap. */
export function canonicalRoutePaths(): string[] {
  return ['/', '/comparison', '/console', ...PRODUCTS.map((p) => '/' + p.slug)];
}

/** Every canonical route path that should be statically generated (language-independent). */
export function routePaths(): string[] {
  const paths = ['/', '/products', '/comparison', '/console'];
  for (const p of PRODUCTS) {
    paths.push('/' + p.slug);
    paths.push('/products/' + p.slug);
    // Product projects are known at build time, so emit their authenticated
    // console shells too. This keeps the document language correct before JS
    // for direct localized deep links; authorization data remains client-only.
    paths.push('/console/projects/' + p.slug);
    for (const surface of PROJECT_CONSOLE_SURFACES) paths.push(`/console/projects/${p.slug}/${surface}`);
  }
  return paths;
}

/** Every concrete URL to prerender (route × language). */
export function allUrls(): string[] {
  const urls: string[] = [];
  for (const rp of routePaths()) {
    urls.push(localizedHref(rp, 'en'));
    urls.push(localizedHref(rp, 'zh'));
  }
  return urls;
}
