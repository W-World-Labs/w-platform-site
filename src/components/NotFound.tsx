import { dict, localizedHref, type Lang } from '../i18n';

export function NotFound({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 22px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 16 }}>{t.notFound.title}</h1>
      <p style={{ color: 'var(--mut)', fontSize: 18, marginBottom: 32 }}>{t.notFound.body}</p>
      <a
        href={localizedHref('/', lang)}
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
        {t.notFound.back}
      </a>
    </div>
  );
}
