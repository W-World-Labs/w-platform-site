import { renderToString } from 'react-dom/server';
import { App } from './App';
import { parsePath, allUrls, canonicalRoutePaths } from './routes';
import { buildHead, SITE_ORIGIN } from './meta';
import { LANG_TAG, LANGS, localizedHref } from './i18n';
import { SaasConsolePage } from './components/SaasConsolePage';
import { ProjectRealtimeConsole } from './components/ProjectRealtimeConsole';
import { PlatformComparisonPage } from './components/PlatformComparisonPage';

export interface RenderResult {
  html: string;
  head: string;
  lang: string;
  dataScript: string;
}

/** Render a single route to static HTML + head metadata. */
export function render(path: string): RenderResult {
  const resolved = parsePath(path);
  const html = renderToString(<App resolved={resolved} consolePage={SaasConsolePage} comparisonPage={PlatformComparisonPage} realtimeConsole={ProjectRealtimeConsole} />);
  const head = buildHead(resolved);
  const data = JSON.stringify({ path }).replace(/</g, '\\u003c');
  return {
    html,
    head,
    lang: LANG_TAG[resolved.lang],
    dataScript: `<script>window.__APP__=${data}</script>`,
  };
}

/** All concrete URLs the prerenderer should emit. */
export function urls(): string[] {
  return allUrls();
}

/** Absolute canonical URLs (deduped, no /products aliases) for sitemap.xml. */
export function sitemapUrls(): string[] {
  const out: string[] = [];
  for (const rp of canonicalRoutePaths()) {
    for (const l of LANGS) out.push(SITE_ORIGIN + localizedHref(rp, l));
  }
  return out;
}
