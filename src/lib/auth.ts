import { WIdBrowserClient } from '@w-id/browser';
import { trackEvent } from './analytics';

const RETURN_TO_KEY = 'w-id:return-to';
const W_ID_ORIGIN = 'https://auth.myfastools.com';
let callbackInFlight: Promise<void> | null = null;

const sameOriginAuthFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' || input instanceof URL ? new URL(input, location.origin) : new URL(input.url);
  if (url.origin === W_ID_ORIGIN && (url.pathname === '/oauth/token' || url.pathname === '/oauth/userinfo')) {
    url.protocol = location.protocol;
    url.host = location.host;
    url.pathname = `/w-id${url.pathname}`;
    input = url;
  }
  return globalThis.fetch(input, init);
};

const auth = new WIdBrowserClient({
  ssoUrl: W_ID_ORIGIN,
  clientId: 'w-landing',
  redirectUri: 'https://myfastools.com/',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  cacheLocation: 'localStorage',
  fetch: sameOriginAuthFetch,
});

export interface WUser {
  name?: string;
  email?: string;
  sub?: string;
}

export async function login(): Promise<void> {
  trackEvent('w_id_login_start');
  const returnTo = location.pathname + location.search + location.hash;
  localStorage.setItem(RETURN_TO_KEY, returnTo);
  await auth.loginWithRedirect({ appState: { returnTo } });
}

export async function logout(): Promise<void> {
  try {
    const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      location.assign('/auth/login');
      return;
    }
  } catch {
    location.assign('/auth/login');
    return;
  }
  localStorage.removeItem('wuser');
  localStorage.removeItem(RETURN_TO_KEY);
  window.dispatchEvent(new Event('wauth'));
  try {
    await auth.logout({ returnTo: 'https://myfastools.com/' });
  } catch {
    location.assign('/');
  }
}

export async function getGateUser(): Promise<WUser | null> {
  try {
    const response = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const session = await response.json() as { sub?: unknown; login?: unknown };
    if (typeof session.sub !== 'string' || typeof session.login !== 'string') return null;
    return { sub: session.sub, name: session.login };
  } catch {
    return null;
  }
}

export function getUser(): WUser | null {
  try {
    return JSON.parse(localStorage.getItem('wuser') || 'null') as WUser | null;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await auth.getToken({ silent: false });
  } catch {
    return null;
  }
}

async function processCallback(): Promise<void> {
  try {
    const result = await auth.handleRedirectCallback();
    const user = await auth.getUser();
    localStorage.setItem('wuser', JSON.stringify(user));
    history.replaceState({}, '', location.pathname + location.hash);
    window.dispatchEvent(new Event('wauth'));
    const appState = result.appState as { returnTo?: string } | undefined;
    const returnTo = appState?.returnTo || localStorage.getItem(RETURN_TO_KEY);
    localStorage.removeItem(RETURN_TO_KEY);
    if (returnTo && returnTo !== location.pathname + location.hash) location.href = returnTo;
  } catch {
    // A failed/stale callback must not remain in the URL and be retried on
    // every hydration. This also prevents StrictMode's second effect pass
    // from racing a successful token exchange and clearing the signed-in UI.
    history.replaceState({}, '', location.pathname + location.hash);
    localStorage.removeItem('wuser');
    window.dispatchEvent(new Event('wauth'));
  }
}

export function handleCallback(): Promise<void> {
  const query = new URLSearchParams(location.search);
  if (!query.get('code') && !query.get('error')) return Promise.resolve();
  callbackInFlight ??= processCallback();
  return callbackInFlight;
}
