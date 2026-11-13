import { useEffect, useState } from 'react';
import { logout, getGateUser, handleCallback, type WUser } from '../lib/auth';
import { dict, LANG_TAG, localizedHref, type Lang } from '../i18n';
import { persistLanguage } from '../lib/languagePreference';

const SHORT_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文' };

export function Layout({
  children,
  lang,
  routePath,
}: {
  children: React.ReactNode;
  lang: Lang;
  routePath: string;
}) {
  const [user, setUser] = useState<WUser | null>(null);
  const t = dict(lang);
  const home = localizedHref('/', lang);
  const otherLang: Lang = lang === 'en' ? 'zh' : 'en';

  useEffect(() => {
    document.documentElement.lang = LANG_TAG[lang];
    // The localized URL is authoritative. Redirecting from an English URL
    // based on browser/storage preference can race the OAuth callback and is
    // re-entered by React StrictMode, producing an / <-> /zh navigation loop.
    // Persist the current explicit choice, but never navigate from this effect.
    persistLanguage(lang);
    let active = true;
    let sessionEstablished = false;
    const refreshSession = () => {
      void getGateUser().then((session) => {
        if (!active) return;
        if (!session && sessionEstablished) {
          location.assign('/auth/login');
          return;
        }
        if (session) sessionEstablished = true;
        setUser(session);
      });
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshSession(); };
    handleCallback().then(() => {
      if (active) refreshSession();
    });
    const onAuth = () => refreshSession();
    window.addEventListener('wauth', onAuth);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; window.removeEventListener('wauth', onAuth); document.removeEventListener('visibilitychange', onVisibility); };
  }, [lang, routePath]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="site-header-wrap">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px', width: '100%' }}>
          <header
            className="site-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0' }}
          >
            <a
              className="site-brand"
              href={home}
              style={{ fontWeight: 800, fontSize: 21, letterSpacing: '-0.5px', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {t.brand.split('·')[0]}<span style={{ color: 'var(--acc2)' }}>·</span>{t.brand.split('·')[1]}
            </a>
            <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end', minWidth: 0 }}>
              <a className="site-nav-link" href={`${home}#products`} style={{ color: 'var(--mut)', fontSize: 14, whiteSpace: 'nowrap' }}>
                {t.nav.products}
              </a>
              <a className="site-nav-link" href={localizedHref('/comparison', lang)} style={{ color: 'var(--mut)', fontSize: 14, whiteSpace: 'nowrap' }}>
                {lang === 'zh' ? '功能对比' : 'Comparison'}
              </a>
              <a className="site-nav-link" href={`${home}#roadmap`} style={{ color: 'var(--mut)', fontSize: 14, whiteSpace: 'nowrap' }}>
                {t.nav.roadmap}
              </a>
              <a className="site-nav-link site-nav-link-membership" href={`${home}#pricing`} style={{ color: 'var(--mut)', fontSize: 14, whiteSpace: 'nowrap' }}>
                {t.nav.membership}
              </a>
              {user && (
                <a className="site-nav-link" href={localizedHref('/console', lang)} style={{ color: 'var(--acc2)', fontSize: 14, whiteSpace: 'nowrap', fontWeight: 700 }}>
                  {t.nav.console}
                </a>
              )}
              <a
                className="site-lang-switch"
                href={localizedHref(routePath, otherLang)}
                onClick={() => persistLanguage(otherLang)}
                aria-label={`Switch language to ${otherLang === 'zh' ? '简体中文' : 'English'}`}
                style={{ color: 'var(--mut)', fontSize: 13, whiteSpace: 'nowrap', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px' }}
              >
                {SHORT_LABEL[otherLang]}
              </a>
              {user ? (
                <>
                  <span className="site-user" style={{ color: 'var(--mut)', fontSize: 14, marginRight: 4 }}>
                    {user.name || user.email || t.nav.signedIn}
                  </span>
                  <button
                    className="site-nav-button"
                    onClick={() => { void logout(); }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      color: 'var(--fg)',
                      padding: '8px 12px',
                      borderRadius: 11,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.nav.signOut}
                  </button>
                </>
              ) : (
                <a
                  className="site-nav-button"
                  href="/auth/login"
                  style={{
                    background: 'linear-gradient(90deg, var(--acc), var(--acc2))',
                    color: '#0a0b10',
                    fontWeight: 700,
                    padding: '8px 12px',
                    borderRadius: 11,
                    cursor: 'pointer',
                    border: 0,
                    fontSize: 13,
                    lineHeight: 1.15,
                    minWidth: 68,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.nav.signIn}
                </a>
              )}
            </nav>
          </header>
        </div>
      </div>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '30px 0',
          color: 'var(--mut)',
          fontSize: 13,
          textAlign: 'center',
          marginTop: 20,
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px' }}>
          © 2026 {t.brand} · {t.footer.tagline} ·{' '}
          <a href={`${home}#pricing`} style={{ color: 'var(--acc)' }}>
            {t.footer.cta}
          </a>
        </div>
      </footer>
    </div>
  );
}
