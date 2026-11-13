import { login } from '../lib/auth';
import { dict, type Lang } from '../i18n';

export function Pricing({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const p = t.pricing;

  return (
    <section id="pricing" style={{ padding: '40px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--acc)', fontWeight: 700, textAlign: 'center' }}>
          {p.eyebrow}
        </div>
        <div style={{ fontSize: 'clamp(25px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', margin: '8px 0' }}>{p.title}</div>
        <p style={{ color: 'var(--mut)', textAlign: 'center', maxWidth: 560, margin: '0 auto 30px' }}>{p.subtitle}</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          {/* Monthly */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 30 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>{p.monthly}</h3>
            <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0 2px' }}>
              {p.monthlyPrice}
              <small style={{ fontSize: 15, color: 'var(--mut)', fontWeight: 500 }}>/mo</small>
            </div>
            <div style={{ color: 'var(--acc2)', fontSize: 13, fontWeight: 600 }}>{p.monthlyNote}</div>
            <ul style={{ listStyle: 'none', margin: '18px 0', color: 'var(--mut)', fontSize: 14 }}>
              {p.monthlyFeatures.map((item) => (
                <li key={item} style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--acc2)', fontWeight: 800, marginRight: 9 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              style={{
                background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                color: '#0a0b10',
                fontWeight: 700,
                padding: '11px 22px',
                borderRadius: 11,
                cursor: 'pointer',
                border: 0,
                fontSize: 15,
                width: '100%',
              }}
            >
              {p.monthlyCta}
            </button>
          </div>

          {/* Yearly */}
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--acc)',
              borderRadius: 18,
              padding: 30,
              position: 'relative',
              boxShadow: '0 0 0 1px var(--acc)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -12,
                right: 22,
                background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                color: '#0a0b10',
                fontSize: 12,
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              {p.yearlyBadge}
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>{p.yearly}</h3>
            <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0 2px' }}>
              {p.yearlyPrice}
              <small style={{ fontSize: 15, color: 'var(--mut)', fontWeight: 500 }}>/yr</small>
            </div>
            <div style={{ color: 'var(--acc2)', fontSize: 13, fontWeight: 600 }}>{p.yearlyNote}</div>
            <ul style={{ listStyle: 'none', margin: '18px 0', color: 'var(--mut)', fontSize: 14 }}>
              {p.yearlyFeatures.map((item) => (
                <li key={item} style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--acc2)', fontWeight: 800, marginRight: 9 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              style={{
                background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                color: '#0a0b10',
                fontWeight: 700,
                padding: '11px 22px',
                borderRadius: 11,
                cursor: 'pointer',
                border: 0,
                fontSize: 15,
                width: '100%',
              }}
            >
              {p.yearlyCta}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--mut)', textAlign: 'center', fontSize: 13, marginTop: 18 }}>{p.guarantee}</p>
      </div>
    </section>
  );
}
