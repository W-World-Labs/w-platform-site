import assert from 'node:assert/strict';

const origin = new URL(process.env.W_PLATFORM_SITE_URL || 'https://myfastools.com/');
const expectedCode = process.env.W_RADAR_CODE || 'W-W-LANDING-1E05DAC4';

assert.equal(origin.protocol, 'https:', 'production URL must use HTTPS');

const response = await fetch(origin, {
    headers: {
        Accept: 'text/html',
        'User-Agent': 'w-platform-site-production-verifier/1.0',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
});

assert.equal(response.status, 307, 'anonymous homepage must redirect to login');
assert.equal(new URL(response.headers.get('location'), origin).pathname, '/auth/login');
assert.match(response.headers.get('cache-control') || '', /private.*no-store/);
assert.ok(!(await response.text()).includes('id="fleet-framework"'), 'anonymous response exposed fleet content');

const assetResponse = await fetch(new URL('/assets/anonymous-gate-probe.js', origin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
});
assert.equal(assetResponse.status, 401, 'anonymous static assets must be protected');
const sessionResponse = await fetch(new URL('/auth/me', origin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
});
assert.equal(sessionResponse.status, 401, 'anonymous session lookup must fail closed');

const loginResponse = await fetch(new URL('/auth/login', origin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
});
assert.equal(loginResponse.status, 303);
const authorize = new URL(loginResponse.headers.get('location'));
assert.equal(authorize.origin, 'https://auth.myfastools.com');
assert.equal(authorize.pathname, '/oauth/authorize');
assert.equal(authorize.searchParams.get('client_id'), 'w-platform-site');
assert.equal(authorize.searchParams.get('redirect_uri'), 'https://myfastools.com/auth/callback');

if (!process.env.W_PLATFORM_SESSION_COOKIE) {
    console.log('Production login boundary OK: HTML redirect, assets/session denied, W-ID authorization configured.');
    process.exit(0);
}

const authenticated = await fetch(origin, {
    headers: { Accept: 'text/html', Cookie: process.env.W_PLATFORM_SESSION_COOKIE },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
});
assert.equal(authenticated.status, 200, 'authenticated homepage must be available');
assert.match(authenticated.headers.get('cache-control') || '', /private.*no-store/);

const body = await authenticated.text();
assert.match(body, /<html[\s>]/i, 'production response is not HTML');
assert.match(body, /<div id="root">[\s\S]+<\/div>/i, 'production response has no prerendered application shell');
assert.ok(body.includes('https://radar.myfastools.com/platform/bootstrap.js'), 'Radar bootstrap is absent');
assert.ok(body.includes(`data-code="${expectedCode}"`), `Radar data-code ${expectedCode} is absent`);
for (const reference of ['Supabase', 'Cloudflare', 'arXiv']) {
    assert.ok(body.includes(reference), `${reference} comparison is absent`);
}

console.log(`Production OK: authenticated homepage HTTP 200, ${body.length} bytes, fleet comparisons and Radar code present.`);
