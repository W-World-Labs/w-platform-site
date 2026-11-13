import { productAppUrl, type Product, slugGradient } from '../data/products';
import { dict, localizedHref, type Lang } from '../i18n';
import { ProductImage } from './ProductImage';
import { recordProductUsage } from '../lib/productUsage';

const SECTION_IMAGE_KINDS = ['s1', 's2', 's3'] as const;

export function ProductPage({ product, lang }: { product: Product; lang: Lang }) {
  const { slug, name, tagline, category, features, content } = product;
  const t = dict(lang);
  const home = localizedHref('/', lang);
  // Jump to the live product origin — do not OAuth back onto myfastools.com.
  const appUrl = productAppUrl(product);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
      <div className="product-hero-grid">
        {/* Left: text */}
        <div>
          <span
            style={{
              display: 'inline-block',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              color: 'var(--mut)',
              fontSize: 12,
              padding: '4px 11px',
              borderRadius: 20,
              marginBottom: 14,
            }}
          >
            {t.categories[category]}
          </span>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}>{name}</h1>
          <p style={{ color: 'var(--mut)', fontSize: 19, margin: '14px 0 4px' }}>{tagline}</p>
          <ul style={{ listStyle: 'none', margin: '22px 0' }}>
            {features.map((f) => (
              <li key={f} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)', color: 'var(--fg)' }}>
                <span style={{ color: 'var(--acc2)', marginRight: 10, fontWeight: 700 }}>→</span>
                {f}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordProductUsage(slug)}
              style={{
                background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                color: '#0a0b10',
                fontWeight: 700,
                padding: '11px 22px',
                borderRadius: 11,
                fontSize: 15,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {t.product.ctaPrimary}
            </a>
            <a
              href={`${home}#pricing`}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--fg)',
                padding: '11px 22px',
                borderRadius: 11,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {t.product.ctaSecondary}
            </a>
          </div>
          <a href={home} style={{ color: 'var(--mut)', fontSize: 14 }}>
            {t.product.allProducts}
          </a>
        </div>

        {/* Right: visual */}
        <div className="product-hero-visual" style={{ background: slugGradient(slug) }}>
          <ProductImage alt={`${name} product UI preview`} className="product-media" eager kind="product-ui" slug={slug} />
          <span className="preview-badge">{product.visual === 'identity' ? product.name : t.product.previewNote}</span>
        </div>
      </div>

      {/* Rich content (when present) */}
      {content && (
        <div style={{ paddingBottom: 60 }}>
          {content.overview && (
            <div className="product-overview-grid">
              <p style={{ color: 'var(--mut)', fontSize: 17 }}>{content.overview}</p>
              <div className="product-detail-visual" style={{ background: slugGradient(slug) }}>
                <ProductImage alt={`${name} overview visual`} className="product-media" kind="overview" slug={slug} />
              </div>
            </div>
          )}
          {content.sections.map((sec, index) => {
            const imageKind = SECTION_IMAGE_KINDS[index];
            return (
              <div
                className={imageKind ? 'product-detail-section product-detail-section-with-media' : 'product-detail-section'}
                key={sec.title}
              >
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--fg)' }}>{sec.title}</h2>
                  <p style={{ color: 'var(--mut)', fontSize: 15, lineHeight: 1.7 }}>{sec.body}</p>
                </div>
                {imageKind && (
                  <div className="product-section-visual" style={{ background: slugGradient(slug) }}>
                    <ProductImage alt={`${name}: ${sec.title}`} className="product-media" kind={imageKind} slug={slug} />
                  </div>
                )}
              </div>
            );
          })}
          {content.useCases && content.useCases.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--fg)' }}>{t.product.useCases}</h2>
              <ul style={{ listStyle: 'none' }}>
                {content.useCases.map((uc) => (
                  <li key={uc} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--mut)', fontSize: 15 }}>
                    <span style={{ color: 'var(--acc2)', marginRight: 10, fontWeight: 700 }}>→</span>
                    {uc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Closing CTA */}
          <div className="product-cta-band">
            <div style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, marginBottom: 6 }}>{t.suite.title}</div>
            <p style={{ color: 'var(--mut)', marginBottom: 18 }}>{t.pricing.subtitle}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordProductUsage(slug)}
                style={{
                  background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                  color: '#0a0b10',
                  fontWeight: 700,
                  padding: '11px 22px',
                  borderRadius: 11,
                  fontSize: 15,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                {t.product.ctaPrimary}
              </a>
              <a
                href={`${home}#pricing`}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                  padding: '11px 22px',
                  borderRadius: 11,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {t.product.ctaSecondary}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
