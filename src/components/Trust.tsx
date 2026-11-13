import { dict, type Lang } from '../i18n';

export function Trust({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <section id="trust" style={{ padding: '40px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--acc)', fontWeight: 700, textAlign: 'center' }}>
          {t.trust.eyebrow}
        </div>
        <div style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, textAlign: 'center', margin: '8px 0' }}>
          {t.trust.title}
        </div>
        <p style={{ color: 'var(--mut)', textAlign: 'center', maxWidth: 620, margin: '0 auto 28px' }}>{t.trust.subtitle}</p>
        <div className="trust-grid">
          {t.trust.items.map((item) => (
            <div className="trust-item" key={item.title}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: 'var(--acc2)', marginRight: 8, fontWeight: 800 }}>✓</span>
                {item.title}
              </h3>
              <p style={{ color: 'var(--mut)', fontSize: 14, lineHeight: 1.6 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
