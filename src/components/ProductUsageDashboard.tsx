import { useEffect, useMemo, useState } from 'react';
import { localizedProducts } from '../data/localized';
import { productAppUrl } from '../data/products';
import { dict, type Lang } from '../i18n';
import {
  readProductUsage,
  recordProductUsage,
  subscribeProductUsage,
  type ProductUsage,
} from '../lib/productUsage';
import { getAccessToken, getUser, login } from '../lib/auth';

interface AppUsage {
  clientId: string;
  publicUrl: string | null;
  loginCount: number;
  lastSeenAt: number;
}

interface AccountProfile {
  user: {
    email?: string;
    displayName?: string;
    display_name?: string;
    username?: string;
    uid?: string;
    role?: string;
  };
  identities: Array<{
    provider?: string;
    providerId?: string;
    username?: string;
    displayName?: string;
    providerUserId?: string;
  }>;
  security?: { mfaEnabled?: boolean; mfa_enabled?: boolean };
}

export function ProductUsageDashboard({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const products = useMemo(() => localizedProducts(lang), [lang]);
  const [browserUsage, setBrowserUsage] = useState<ProductUsage>({});
  const [wIdUsage, setWIdUsage] = useState<ProductUsage | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [accountStatus, setAccountStatus] = useState<'anonymous' | 'loading' | 'ready' | 'reauth'>(getUser() ? 'loading' : 'anonymous');
  const usage = wIdUsage ?? browserUsage;

  useEffect(() => {
    const refresh = () => setBrowserUsage(readProductUsage());
    refresh();
    return subscribeProductUsage(refresh);
  }, []);

  useEffect(() => {
    if (!getUser()) return;
    const controller = new AbortController();
    const request = async (path: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('W-ID access token unavailable');
      const response = await fetch(path, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`W-ID request failed: ${response.status}`);
      return response.json() as Promise<unknown>;
    };
    Promise.all([request('/api/me/apps'), request('/api/me')])
      .then(([appsPayload, profilePayload]) => {
        const { apps } = appsPayload as { apps: AppUsage[] };
        const serverUsage: ProductUsage = {};
        for (const app of apps) {
          const host = app.publicUrl ? new URL(app.publicUrl).host : '';
          const product = products.find((item) => item.slug === app.clientId || item.domain === host);
          if (!product) continue;
          serverUsage[product.slug] = {
            count: app.loginCount,
            lastUsedAt: new Date(app.lastSeenAt * 1000).toISOString(),
          };
        }
        setWIdUsage(serverUsage);
        setProfile(profilePayload as AccountProfile);
        setAccountStatus('ready');
      })
      .catch(() => setAccountStatus('reauth'));
    return () => controller.abort();
  }, [products]);

  const ordered = useMemo(
    () => [...products].sort((a, b) => {
      const aTime = usage[a.slug]?.lastUsedAt || '';
      const bTime = usage[b.slug]?.lastUsedAt || '';
      return bTime.localeCompare(aTime) || a.name.localeCompare(b.name);
    }),
    [products, usage],
  );
  const usedCount = ordered.filter((product) => usage[product.slug]).length;
  const totalOpens = Object.values(usage).reduce((sum, entry) => sum + entry.count, 0);
  const localUser = getUser();
  const isAdmin = profile?.user.role === 'super_admin' || profile?.user.role === 'admin';
  const roleLabel = (role?: string) => {
    if (!role) return '';
    if (lang === 'en') return role.replaceAll('_', ' ');
    return ({ super_admin: '超级管理员', admin: '管理员', owner: '所有者', member: '成员', user: '用户' } as Record<string, string>)[role] || role;
  };

  return (
    <div>
      {localUser && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {profile?.user.displayName || profile?.user.display_name || profile?.user.username || localUser.name || localUser.email || t.suite.account}
              </div>
              <div style={{ color: 'var(--mut)', fontSize: 13, marginTop: 4 }}>
                {profile?.user.email || localUser.email}
                {profile?.user.uid ? ` · UID ${profile.user.uid}` : ''}
                {profile?.user.role ? ` · ${roleLabel(profile.user.role)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {['github', 'orcid'].map((provider) => {
                const identity = profile?.identities.find((item) => (item.provider || item.providerId || '').toLowerCase().includes(provider));
                return (
                  <span key={provider} style={{ border: '1px solid var(--line)', borderRadius: 20, padding: '5px 10px', color: identity ? 'var(--acc2)' : 'var(--mut)', fontSize: 12 }}>
                    {provider === 'github' ? 'GitHub' : 'ORCID'} · {identity ? (identity.username || identity.displayName || identity.providerUserId || t.suite.connected) : t.suite.notConnected}
                  </span>
                );
              })}
              <span style={{ border: '1px solid var(--line)', borderRadius: 20, padding: '5px 10px', color: profile?.security?.mfaEnabled || profile?.security?.mfa_enabled ? 'var(--acc2)' : 'var(--mut)', fontSize: 12 }}>
                {t.suite.mfaLabel} · {profile?.security?.mfaEnabled || profile?.security?.mfa_enabled ? t.suite.enabled : t.suite.notEnabled}
              </span>
            </div>
          </div>
          {accountStatus === 'loading' && <p style={{ color: 'var(--mut)', fontSize: 12, marginTop: 10 }}>{t.suite.loadingAccount}</p>}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <a href="https://auth.myfastools.com/admin" style={{ color: 'var(--acc2)', fontSize: 13, fontWeight: 700 }}>
                {t.suite.identityAdmin} →
              </a>
              <a href="https://radar.myfastools.com/" style={{ color: 'var(--acc2)', fontSize: 13, fontWeight: 700 }}>
                {t.suite.platformAdmin} →
              </a>
            </div>
          )}
          {accountStatus === 'reauth' && (
            <div style={{ marginTop: 12, color: '#f0b46a', fontSize: 13 }}>
              {t.suite.reauthRequired}{' '}
              <button type="button" onClick={() => void login()} style={{ color: 'var(--acc2)', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontWeight: 700 }}>
                {t.suite.reauthenticate}
              </button>
            </div>
          )}
        </div>
      )}
      {accountStatus !== 'reauth' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          [usedCount, t.suite.usedProducts],
          [totalOpens, t.suite.totalOpens],
          [products.length, t.suite.availableProducts],
        ].map(([value, label]) => (
          <div key={String(label)} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
            <div style={{ color: 'var(--mut)', fontSize: 13 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {ordered.map((product) => {
          const entry = usage[product.slug];
          return (
            <a
              key={product.slug}
              href={productAppUrl(product)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordProductUsage(product.slug)}
              className="product-usage-entry"
              style={{
                display: 'grid',
                width: '100%',
                minWidth: 0,
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                textDecoration: 'none',
              }}
            >
              <div className="product-usage-entry-info">
                <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{product.name}</div>
                <div style={{ color: 'var(--mut)', fontSize: 13, marginTop: 3 }}>{product.tagline}</div>
              </div>
              <div className="product-usage-entry-meta" style={{ textAlign: 'right' }}>
                <div style={{ color: entry ? 'var(--acc2)' : 'var(--mut)', fontSize: 13, fontWeight: 700 }}>
                  {entry ? `${entry.count} ${t.suite.opens}` : t.suite.notUsed}
                </div>
                <div style={{ color: 'var(--mut)', fontSize: 11, marginTop: 3 }}>
                  {entry ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'medium' }).format(new Date(entry.lastUsedAt)) : product.domain}
                </div>
              </div>
            </a>
          );
        })}
      </div>
      <p style={{ color: 'var(--mut)', fontSize: 12, marginTop: 14, textAlign: 'center' }}>
        {wIdUsage ? t.suite.wIdSourceNote : t.suite.privacyNote}
      </p>
      </>}
    </div>
  );
}
