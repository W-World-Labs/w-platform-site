import { dict, type Lang } from '../i18n';

export function FAQ({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <section id="faq" style={{ padding: '40px 0 56px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 22px' }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--acc)', fontWeight: 700, textAlign: 'center' }}>
          {t.faq.eyebrow}
        </div>
        <div style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, textAlign: 'center', margin: '8px 0 26px' }}>
          {t.faq.title}
        </div>
        <div>
          {t.faq.items.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary className="faq-q">{item.q}</summary>
              <p className="faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
