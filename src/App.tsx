import type { Resolved } from './routes';
import { getLocalizedProduct } from './data/localized';
import { Layout } from './components/Layout';
import { HomePage } from './components/HomePage';
import { ProductPage } from './components/ProductPage';
import { NotFound } from './components/NotFound';
import type { ComponentType } from 'react';
import type { ProjectRealtimeConsoleProps } from './components/ProjectRealtimeConsole';

type ConsolePageProps = { lang: Resolved['lang']; projectId?: string; projectSurface?: Extract<Resolved['page'], { kind: 'console' }>['surface']; realtimeConsole?: ComponentType<ProjectRealtimeConsoleProps> };

export function App({ resolved, consolePage: ConsolePage, comparisonPage: ComparisonPage, realtimeConsole }: { resolved: Resolved; consolePage?: ComponentType<ConsolePageProps>; comparisonPage?: ComponentType<{ lang: Resolved['lang'] }>; realtimeConsole?: ComponentType<ProjectRealtimeConsoleProps> }) {
  const { lang, routePath, page } = resolved;

  let body: React.ReactNode;
  if (page.kind === 'home') {
    body = <HomePage lang={lang} />;
  } else if (page.kind === 'comparison') {
    body = ComparisonPage ? <ComparisonPage lang={lang} /> : <NotFound lang={lang} />;
  } else if (page.kind === 'console') {
    body = ConsolePage ? <ConsolePage lang={lang} projectId={page.projectId} projectSurface={page.surface} realtimeConsole={realtimeConsole} /> : <NotFound lang={lang} />;
  } else if (page.kind === 'product') {
    const product = getLocalizedProduct(page.slug, lang);
    body = product ? <ProductPage product={product} lang={lang} /> : <NotFound lang={lang} />;
  } else {
    body = <NotFound lang={lang} />;
  }

  return (
    <Layout lang={lang} routePath={routePath}>
      {body}
    </Layout>
  );
}
