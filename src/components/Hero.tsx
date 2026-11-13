import { PRODUCTS } from '../data/products';
import { dict, localizedHref, type Lang } from '../i18n';
import { ProductImage } from './ProductImage';

const PREVIEW_SLUGS = ['w-id', 'w-radar', 'w-modelgw', 'w-translate', 'w-omnisense', 'w-daas'];

export function Hero({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const home = localizedHref('/', lang);

  return (
    <div style={{ textAlign: 'center', padding: '56px 0 36px' }}>
      <h1
        style={{
          fontSize: 'clamp(32px, 6vw, 56px)',
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        {t.hero.titleA}
        <br />
        <span
          style={{
            background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {t.hero.titleB}
        </span>
      </h1>
      <p
        style={{
          color: 'var(--mut)',
          fontSize: 'clamp(16px, 2.3vw, 20px)',
          maxWidth: 640,
          margin: '18px auto 28px',
        }}
      >
        {t.hero.subtitle}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          href={`${home}#products`}
          style={{
            background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
            color: '#0a0b10',
            fontWeight: 700,
            padding: '11px 22px',
            borderRadius: 11,
            fontSize: 15,
            display: 'inline-block',
          }}
        >
          {t.hero.ctaPrimary}
        </a>
        <a
          href={localizedHref('/console', lang)}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--fg)',
            padding: '11px 22px',
            borderRadius: 11,
            fontSize: 15,
            fontWeight: 700,
            display: 'inline-block',
          }}
        >
          {t.hero.ctaSecondary}
        </a>
      </div>

      <div className="hero-preview">
        {PREVIEW_SLUGS.map((slug, i) => (
          <div className="hero-preview-tile" key={slug}>
            <ProductImage alt="" className="product-media" eager={i < 2} kind="product-ui" slug={slug} />
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 36,
          justifyContent: 'center',
          marginTop: 36,
          color: 'var(--mut)',
          fontSize: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <b style={{ display: 'block', color: 'var(--fg)', fontSize: 25, fontWeight: 800 }}>{PRODUCTS.length}</b>
          {t.hero.statProducts}
        </div>
        <div>
          <b style={{ display: 'block', color: 'var(--fg)', fontSize: 25, fontWeight: 800 }}>1</b>
          {t.hero.statSso}
        </div>
        <div>
          <b style={{ display: 'block', color: 'var(--fg)', fontSize: 25, fontWeight: 800 }}>8</b>
          {t.hero.statAccess}
        </div>
      </div>
    </div>
  );
}
