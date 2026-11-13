import { createConnection } from 'node:net';
import type { Page } from '@playwright/test';
const protocol = 'w-reference-fixture/v1';
export function requestVerificationCode(socketPath: string, email: string) {
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection(socketPath);
    const output: Buffer[] = [];
    let size = 0;
    socket.on('connect', () => socket.end(`${JSON.stringify({ schema: protocol, action: 'verification_code', email })}\n`));
    socket.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024) socket.destroy(); else output.push(chunk); });
    socket.on('error', reject);
    socket.on('close', () => { try { const response = JSON.parse(Buffer.concat(output).toString('utf8')) as { schema?: string; action?: string; verification_code?: string }; if (size > 1024 || response.schema !== protocol || response.action !== 'verification_code' || !/^\d{6}$/.test(response.verification_code || '')) return reject(new Error('invalid verification callback')); resolve(response.verification_code!); } catch { reject(new Error('verification callback unavailable')); } });
  });
}

/** Serve the reference app at the project's already registered browser origin. */
export async function mountReferenceApp(page: Page, registered: URL, allowKeyMutations = false) {
  const observed = { callbackStaticStatus: 0, callbackMainLoaded: false };
  // Routed fixture documents need Chromium permission to contact the real loopback services.
  if (process.env.REFERENCE_HERMETIC_MODE === '1' && registered.protocol === 'http:' && registered.hostname === '127.0.0.1') {
    await page.context().grantPermissions(['local-network-access'], { origin: registered.origin });
  }
  await page.route(`${registered.origin}/**`, async (route) => {
    const incoming = new URL(route.request().url());
    const keyMutation = allowKeyMutations && route.request().method() === 'POST' && /^\/api\/workspaces\/[^/]+\/projects\/[^/]+\/keys(?:\/[^/]+\/(?:rotate|revoke))?$/.test(incoming.pathname);
    if (!['GET', 'HEAD'].includes(route.request().method()) && !keyMutation) return route.abort();
    const response = await route.fetch({ url: `http://127.0.0.1:4174${incoming.pathname}${incoming.search}`, ...(keyMutation ? { headers: { ...await route.request().allHeaders(), cookie: '' } } : {}), timeout: 10_000, maxRedirects: 0 });
    if (incoming.pathname === registered.pathname) observed.callbackStaticStatus = response.status();
    if (incoming.pathname === '/main.ts' && observed.callbackStaticStatus) observed.callbackMainLoaded = response.status() === 200;
    await route.fulfill({ response });
  });
  return observed;
}

export async function completeFreshInvitation(page: Page, password: string) {
  page.on('console', (message) => {
    const output = message.text();
    const auth = output.match(/^REFERENCE_AUTH_CALLBACK=(success|error-[a-z0-9_]{1,64})$/);
    if (auth) process.stdout.write(`REFERENCE_STAGE=fresh-pkce-${auth[1]}\n`);
    const storage = output.match(/^REFERENCE_STORAGE=(bucket-create|upload|sign|signed-download|download|remove|bucket-delete)-status-([1-5][0-9]{2}|0)-code-([a-z0-9_-]{1,64})$/);
    if (storage) process.stdout.write(`REFERENCE_STAGE=private-storage-${storage[1]}-status-${storage[2]}-code-${storage[3]}\n`);
    const realtime = output.match(/^REFERENCE_REALTIME=(subscribe-(?:subscribed|channel_error|timed_out|closed)|insert-(?:ok|error|missing-row)|(?:update|delete)-(?:ok|error)|event-(?:insert|update|delete|timeout)|socket-close-[0-9]{4}-[a-z0-9_]{1,64})$/);
    if (realtime) process.stdout.write(`REFERENCE_STAGE=realtime-${realtime[1].replaceAll('_', '-')}\n`);
    const diagnostics = output.match(/^REFERENCE_DIAGNOSTICS=(trace-marker-missing|discovery-(?:ok|missing|complete)|(?:functions|radar|monitor)-(?:ok|network|malformed|status-[1-5][0-9]{2}|timeout-status-(?:[1-5][0-9]{2}|0)))$/);
    if (diagnostics) process.stdout.write(`REFERENCE_STAGE=diagnostics-${diagnostics[1]}\n`);
    const backup = output.match(/^REFERENCE_BACKUP=(management-start|(?:inventory|create|preview|restore|rollback|quota|audit)-(?:start|ok)|download-ok)$/);
    if (backup) process.stdout.write(`REFERENCE_STAGE=backup-${backup[1]}\n`);
    const keys = output.match(/^REFERENCE_KEYS=((?:create|rotate|rotation-probe|revoke|revocation-probe)-(?:start|ok|status-[1-5][0-9]{2}))$/);
    if (keys) process.stdout.write(`REFERENCE_STAGE=keys-${keys[1]}\n`);
  });
  const socketPath = process.env.REFERENCE_PRIVATE_SOCKET;
  if (!socketPath) throw new Error('private invitation broker required');
  const invitation = await new Promise<{ invitation: string; email: string; verification_code: string; workspace_invitation_url: string; redirect_uri: string }>((resolve, reject) => {
    const socket = createConnection(socketPath);
    const chunks: Buffer[] = []; let bytes = 0;
    socket.on('connect', () => socket.end('fresh_browser\n'));
    socket.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 16_384) socket.destroy(); else chunks.push(chunk); });
    socket.on('error', reject);
    socket.on('close', () => { try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (value.schema !== 'w-reference-invitation/v2' || typeof value.invitation !== 'string' || typeof value.email !== 'string' || typeof value.workspace_invitation_url !== 'string' || typeof value.redirect_uri !== 'string' || !/^\d{6}$/.test(value.verification_code || '')) throw new Error(); resolve(value); } catch { reject(new Error('private invitation unavailable')); } });
  });
  const identity = new URL(invitation.invitation).origin;
  const registered = new URL(invitation.redirect_uri);
  let tokenStatus = 0; let tokenCorsAllowed = false; let tokenNetworkFailed = false;
  page.on('response', (response) => { const url = new URL(response.url()); if (url.origin === identity && url.pathname === '/oauth/token') { tokenStatus = response.status(); tokenCorsAllowed = response.headers()['access-control-allow-origin'] === registered.origin; process.stdout.write(`REFERENCE_STAGE=fresh-pkce-token-status-${response.status()}\n`); } });
  page.on('requestfailed', (request) => { const url = new URL(request.url()); if (url.origin === identity && url.pathname === '/oauth/token') { tokenNetworkFailed = true; process.stdout.write('REFERENCE_STAGE=fresh-pkce-token-network-failed\n'); } });
  let callbackObserved = false; let callbackInvalid = false; page.on('framenavigated', (frame) => { if (frame !== page.mainFrame()) return; const url = new URL(frame.url()); if (url.origin === registered.origin && url.pathname === registered.pathname) { callbackInvalid = JSON.stringify([...url.searchParams.keys()].sort()) !== JSON.stringify(['code', 'state']) || !url.searchParams.get('code') || !url.searchParams.get('state'); callbackObserved = true; } });
  const mounted = await mountReferenceApp(page, registered, true);
  const pageError = (error: Error) => process.stdout.write(`REFERENCE_STAGE=fresh-pkce-pageerror-${/^[A-Za-z]+$/.test(error.name) ? error.name.toLowerCase() : 'unknown'}\n`);
  page.on('pageerror', pageError);
  const resetToken = new URL(invitation.invitation).searchParams.get('token'); const workspaceToken = new URL(invitation.workspace_invitation_url).searchParams.get('token');
  if (!resetToken || !workspaceToken) throw new Error('fresh-browser opaque tokens unavailable');
  const reset = await page.request.post(`${identity}/api/auth/password/reset`, { data: { token: resetToken, password, confirm_password: password } }); if (reset.status() !== 200) throw new Error('fresh-browser password setup failed');
  process.stdout.write('REFERENCE_STAGE=fresh-password-reset\n'); const resetReplay = await page.request.post(`${identity}/api/auth/password/reset`, { data: { token: resetToken, password, confirm_password: password } }); if (resetReplay.status() < 400) throw new Error('fresh-browser reset token replay accepted');
  const verified = await page.request.post(`${identity}/api/auth/email/verify`, { data: { email: invitation.email, code: invitation.verification_code } }); if (verified.status() !== 200) throw new Error('fresh-browser email verification failed');
  process.stdout.write('REFERENCE_STAGE=fresh-email-verified\n'); const verifyReplay = await page.request.post(`${identity}/api/auth/email/verify`, { data: { email: invitation.email, code: invitation.verification_code } }); if (verifyReplay.status() === 200) throw new Error('fresh-browser verification replay accepted');
  const accepted = await page.request.post(`${identity}/api/workspaces/invitations/accept`, { data: { token: workspaceToken } }); if (accepted.status() !== 200) throw new Error('fresh-browser Workspace invitation failed');
  process.stdout.write('REFERENCE_STAGE=fresh-workspace-accepted\n'); const inviteReplay = await page.request.post(`${identity}/api/workspaces/invitations/accept`, { data: { token: workspaceToken } }); if (inviteReplay.status() !== 409) throw new Error('fresh-browser invitation replay was not rejected');
  await page.goto(`${registered.origin}/`); await page.getByRole('button', { name: /sign up|sign in|注册|登录/i }).click({ noWaitAfter: true, timeout: 15_000 });
  process.stdout.write('REFERENCE_STAGE=fresh-pkce-authorize\n'); await page.waitForTimeout(500);
  if (new URL(page.url()).pathname === '/login') { const next = new URL(page.url()).searchParams.get('next'); if (!next?.startsWith('/oauth/authorize?')) throw new Error('fresh-browser safe OAuth continuation unavailable'); await page.goto(`${identity}/admin/login?next=${encodeURIComponent(next)}`, { timeout: 15_000 }); process.stdout.write('REFERENCE_STAGE=fresh-pkce-login-spa\n'); }
  if (page.url().startsWith(identity)) { const email = page.locator('form input[type="email"]'); if (await email.count()) { process.stdout.write('REFERENCE_STAGE=fresh-pkce-login-form\n'); if (!(await email.isVisible())) await page.getByRole('button', { name: /email|邮箱/i }).click({ timeout: 15_000 }); await email.fill(invitation.email); await page.locator('form input[type="password"]').fill(password); await page.locator('form button[type="submit"]').click({ noWaitAfter: true, timeout: 15_000 }); await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }); process.stdout.write('REFERENCE_STAGE=fresh-pkce-signed-in\n'); } const consent = page.locator('form[action="/oauth/consent"] button[type="submit"][value="allow"]'); if (await consent.count()) { process.stdout.write('REFERENCE_STAGE=fresh-pkce-consent-form\n'); await consent.click({ noWaitAfter: true, timeout: 15_000 }); process.stdout.write('REFERENCE_STAGE=fresh-pkce-consented\n'); } else { const body = await page.locator('body').innerText(); const known = ['invalid_scope', 'invalid_redirect_uri', 'invalid_client', 'unauthorized_client', 'login_required'].find((code) => body.includes(code)); const path = new URL(page.url()).pathname; const safePath = ({ '/oauth/authorize': 'authorize', '/oauth/consent': 'consent', '/login': 'login', '/login/verify-email': 'verify-email', '/profile': 'profile', '/': 'root' } as Record<string, string>)[path] || 'identity-other'; process.stdout.write(`REFERENCE_STAGE=fresh-pkce-${known || `${safePath}-no-form`}\n`); if (known) throw new Error('fresh-browser OAuth authorize rejected'); } }
  await page.waitForURL((url) => url.origin === registered.origin && url.pathname === registered.pathname, { timeout: 15_000 }); process.stdout.write('REFERENCE_STAGE=fresh-pkce-registered-callback\n'); const transactionPresent = await page.evaluate(() => sessionStorage.getItem('w_id_browser_transaction') !== null); process.stdout.write(`REFERENCE_STAGE=fresh-pkce-transaction-${transactionPresent ? 'present' : 'missing'}\n`); if (!transactionPresent) throw new Error('fresh-browser PKCE transaction unavailable at exact callback origin'); if (!mounted.callbackStaticStatus) { await page.setContent('<!doctype html><html><head></head><body><div id="app"></div></body></html>', { waitUntil: 'domcontentloaded' }); await page.addScriptTag({ type: 'module', url: `${registered.origin}/main.ts?callback-mount=1` }); process.stdout.write('REFERENCE_STAGE=fresh-pkce-callback-app-mounted\n'); } try { await page.waitForFunction(() => location.pathname === '/' || document.documentElement.dataset.authCallback?.startsWith('error-'), undefined, { timeout: 15_000 }); } catch { process.stdout.write(`REFERENCE_STAGE=fresh-pkce-callback-static-${mounted.callbackStaticStatus || 0}-main-${mounted.callbackMainLoaded ? 'loaded' : 'missing'}\n`); throw new Error('fresh-browser callback app did not settle'); } const callbackState = await page.locator('html').getAttribute('data-auth-callback'); if (callbackState?.startsWith('error-')) { const tokenStage = tokenNetworkFailed ? 'network-failed' : `status-${tokenStatus || 0}-cors-${tokenCorsAllowed ? 'allowed' : 'missing'}`; process.stdout.write(`REFERENCE_STAGE=fresh-pkce-token-${tokenStage}\n`); throw new Error('fresh-browser SDK callback failed'); }
  if (!callbackObserved || callbackInvalid) throw new Error('fresh-browser registered callback was not observed exactly');
  process.stdout.write('REFERENCE_STAGE=fresh-pkce-complete\n');
  page.off('pageerror', pageError);
  return invitation.email;
}
