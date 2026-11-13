import { dict, localizedHref, type Lang } from '../i18n';
import { Hero } from './Hero';
import { ProductUsageDashboard } from './ProductUsageDashboard';
import { Trust } from './Trust';
import { Pricing } from './Pricing';
import { FAQ } from './FAQ';
import { ProductCatalog, ArchitectureLabel } from './ProductCatalog';
import { lazy, Suspense, useState } from 'react';
const FleetFramework = lazy(() => import('./FleetFramework').then((module) => ({ default: module.FleetFramework })));

export function HomePage({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  return (
    <>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
        <Hero lang={lang} />
      </div>

      <ProductCatalog lang={lang} />

      <section className="comparison-home-link">
        <div><h2>{lang === 'zh' ? '与 Supabase、Cloudflare 逐项对比' : 'Compare with Supabase and Cloudflare'}</h2><p>{lang === 'zh' ? '142 项功能、验收证据与剩余缺口，查看 W 平台已经交付到哪一步。' : '142 capabilities, evidence and gaps. See exactly what W has delivered.'}</p></div>
        <a href={localizedHref('/comparison', lang)}>{lang === 'zh' ? '查看详细对比 →' : 'View detailed comparison →'}</a>
      </section>

      <section id="usage" style={{ padding: '40px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
          <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--acc)', fontWeight: 700, textAlign: 'center' }}>
            {t.suite.eyebrow}
          </div>
          <div style={{ fontSize: 'clamp(25px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', margin: '8px 0' }}>
            {t.suite.title}
          </div>
          <p style={{ color: 'var(--mut)', textAlign: 'center', maxWidth: 560, margin: '0 auto 30px' }}>{t.suite.subtitle}</p>

          <ProductUsageDashboard lang={lang} />
        </div>
      </section>

      <details id="roadmap" className="catalog-architecture" onToggle={(event) => setArchitectureOpen(event.currentTarget.open)}><summary><ArchitectureLabel lang={lang} /></summary>{architectureOpen && <Suspense fallback={null}><FleetFramework lang={lang} /></Suspense>}</details>

      <Trust lang={lang} />
      <Pricing lang={lang} />
      <FAQ lang={lang} />
    </>
  );
}
