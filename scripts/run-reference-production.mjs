import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
const runPlaywright = (environment) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/reference-saas/playwright.config.ts'], { env: environment, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = []; let bytes = 0; let timedOut = false;
  const collect = (chunk) => { bytes += chunk.length; if (bytes <= 1024 * 1024) stdout.push(chunk); else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} } };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const term = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }, 180_000);
  const kill = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 195_000);
  child.once('error', reject);
  child.once('close', (code, signal) => {
    clearTimeout(term); clearTimeout(kill);
    const output = Buffer.concat(stdout).toString('utf8');
    if (code === 0 && !timedOut && bytes <= 1024 * 1024) resolve({ stdout: output });
    else { const error = new Error(`browser acceptance ${timedOut ? 'timed out' : `failed (${code ?? signal})`}`); error.safeStage = [...output.matchAll(/REFERENCE_STAGE=([a-z0-9-]+)/g)].at(-1)?.[1] || 'startup'; reject(error); }
  });
});
const protocol = 'w-reference-fixture/v1';
const fixtureTimeoutMs = process.env.REFERENCE_HERMETIC_MODE === '1' ? 600_000 : 30_000;
let fixtureTransportStage = 'ok';
const runtimeEnvironment = (extra = {}) => Object.fromEntries(Object.entries({ PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, TMPDIR: process.env.TMPDIR, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, CI: process.env.CI, ...extra }).filter(([, value]) => typeof value === 'string' && value));
const fixtureEnvironment = runtimeEnvironment(Object.fromEntries(['REFERENCE_W_ID_IDENTITY_LAUNCHER_JSON', 'REFERENCE_W_DB_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_STORAGE_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_RADAR_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_MONITOR_LAUNCHER_COMMAND_JSON', 'REFERENCE_USER_EMAIL_DOMAIN', 'REFERENCE_COMPONENT_PINS_JSON', 'W_DB_TEST_DENO_BINARY', 'W_DB_REFERENCE_BINARY', 'W_STORAGE_REFERENCE_BINARY', 'W_RADAR_REFERENCE_BINARY', 'W_MONITOR_REFERENCE_BINARY', 'CARGO_HOME', 'RUSTUP_HOME'].flatMap((name) => process.env[name] ? [[name, process.env[name]]] : [])));
function fixtureSession(command) {
  const operatorKey = process.env.W_ID_ACCEPTANCE_OPERATOR_KEY;
  if (!operatorKey) throw new Error('W-ID acceptance operator capability required');
  const child = spawn(command, [], { env: fixtureEnvironment, stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'] });
  // The adapter deliberately closes the one-shot capability FD immediately
  // after reading it; Linux may report that successful close as ECONNRESET to
  // the writer after the complete envelope has already crossed the pipe.
  child.stdio[4].on('error', () => {});
  child.stdio[4].end(`${JSON.stringify({ schema: 'w-reference-operator-private/v1', operator_key: operatorKey })}\n`);
  const pending = [];
  const privateByFixture = new Map();
  const privateWaiters = new Map();
  let failure;
  let closed = false;
  const exit = new Promise((resolve) => child.once('close', resolve));
  const fail = (error) => {
    failure ||= error;
    while (pending.length) { const next = pending.shift(); clearTimeout(next.timer); next.reject(failure); }
    for (const waiter of privateWaiters.values()) { clearTimeout(waiter.timer); waiter.reject(failure); }
    privateWaiters.clear();
  };
  createInterface({ input: child.stdout }).on('line', (line) => {
    const next = pending.shift();
    if (!next) { fail(new Error('unexpected fixture response')); return child.kill(); }
    clearTimeout(next.timer);
    if (Buffer.byteLength(line) > 64 * 1024) { next.reject(new Error('fixture response too large')); return child.kill(); }
    try { next.resolve(JSON.parse(line)); } catch { next.reject(new Error('fixture command returned invalid JSON')); child.kill(); }
  });
  createInterface({ input: child.stdio[3] }).on('line', (line) => {
    if (Buffer.byteLength(line) > 64 * 1024) { fixtureTransportStage = 'private-oversize'; fail(new Error('private fixture response too large')); return child.kill(); }
    try {
      const value = JSON.parse(line);
      if (value.schema !== 'w-reference-fixture-private/v2' || typeof value.fixture_id !== 'string') { fixtureTransportStage = 'private-schema'; fail(new Error('private fixture response schema mismatch')); return child.kill(); }
      const waiter = privateWaiters.get(value.fixture_id);
      if (waiter) { privateWaiters.delete(value.fixture_id); clearTimeout(waiter.timer); waiter.resolve(value); }
      else privateByFixture.set(value.fixture_id, value);
    } catch { fixtureTransportStage = 'private-json'; fail(new Error('fixture private channel returned invalid JSON')); child.kill(); }
  });
  createInterface({ input: child.stderr }).on('line', (line) => {
    const stage = line.match(/^REFERENCE_FIXTURE_STAGE=([a-z0-9-]{1,64})$/)?.[1];
    if (stage) fixtureTransportStage = stage;
  });
  child.on('error', fail);
  child.on('close', (code) => { closed = true; if (code !== 0) fail(new Error(`fixture command failed (${code})`)); else if (pending.length || privateWaiters.size) fail(new Error('fixture command exited before response')); });
  return {
    request(body) { if (failure || closed) return Promise.reject(failure || new Error('fixture command closed')); if (pending.length) return Promise.reject(new Error('concurrent fixture request forbidden')); return new Promise((resolve, reject) => { const timer = setTimeout(() => { fail(new Error('fixture response timed out')); child.kill(); }, fixtureTimeoutMs); pending.push({ resolve, reject, timer }); child.stdin.write(`${JSON.stringify(body)}\n`, (error) => { if (error) { fail(error); child.kill(); } }); }); },
    takePrivate(fixtureId) { if (failure || closed) return Promise.reject(failure || new Error('fixture command closed')); const value = privateByFixture.get(fixtureId); if (value) { privateByFixture.delete(fixtureId); return Promise.resolve(value); } if (privateWaiters.has(fixtureId)) return Promise.reject(new Error('duplicate private fixture waiter')); return new Promise((resolve, reject) => { const timer = setTimeout(() => { privateWaiters.delete(fixtureId); reject(new Error('private fixture response timed out')); child.kill(); }, fixtureTimeoutMs); privateWaiters.set(fixtureId, { resolve, reject, timer }); }); },
    async close() { if (!closed) child.stdin.end(); const code = await exit; if (code !== 0) throw failure || new Error('fixture command failed'); },
  };
}
async function invitationBroker(invitations) {
  const directory = await mkdtemp(join(tmpdir(), 'w-reference-private-'));
  const socketPath = join(directory, 'invitations.sock');
  const remaining = new Map(Object.entries(invitations));
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    socket.setEncoding('utf8');
    socket.once('data', (actor) => {
      const key = actor.trim();
      const invitation = remaining.get(key);
      remaining.delete(key);
      socket.end(invitation ? `${JSON.stringify({ schema: 'w-reference-invitation/v2', ...invitation })}\n` : `${JSON.stringify({ error: 'unavailable' })}\n`);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  await chmod(socketPath, 0o600);
  return { socketPath, close: async () => { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); } };
}
async function verifyTargetDenials(fixture, privateFixture) {
  const { createClient } = await import('@supabase/supabase-js');
  const project = new URL(fixture.project_url);
  const projectId = project.pathname.split('/').filter(Boolean).at(-1);
  if (!projectId) throw new Error('target denial project identity missing');
  const target = project.href.endsWith('/') ? project.href : `${project.href}/`;
  for (const [actor, bearer] of Object.entries({ foreign_owner: privateFixture.bearers.foreign_owner, platform_admin: privateFixture.bearers.platform_admin, revoked: privateFixture.bearers.revoked })) {
    acceptanceStage = `target-denials-${actor}`;
    const headers = { apikey: fixture.publishable_key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' };
    const probe = (path, init = {}) => fetch(new URL(path, target), { ...init, headers: { ...headers, ...init.headers } }).then((response) => response.status);
    const statuses = {
      auth: await fetch(`${fixture.identity_url.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/authorize-user`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}` } }).then(async (response) => response.status === 200 ? ((await response.json()).active === false ? 403 : 200) : response.status),
      restRead: await probe('rest/v1/todos?select=id&limit=1'),
      restWrite: await probe('rest/v1/todos', { method: 'POST', body: JSON.stringify({ title: `${actor}-must-deny`, done: false }) }),
      storageRead: await probe('storage/v1/object/list/reference-private', { method: 'POST', body: JSON.stringify({ prefix: '' }) }),
      storageWrite: await probe(`storage/v1/object/reference-private/${actor}-must-deny.txt`, { method: 'POST', body: 'deny' }),
      storageSigned: await probe(`storage/v1/object/sign/reference-private/${actor}-must-deny.txt`, { method: 'POST', body: JSON.stringify({ expiresIn: 60 }) }),
      functions: await probe('functions/v1/reference-acceptance', { method: 'POST', body: JSON.stringify({ marker: `${actor}-must-deny` }) }),
      management: await fetch(`${project.origin}/v1/projects/${encodeURIComponent(projectId)}/discovery`, { headers }).then((response) => response.status),
    };
    for (const [plane, status] of Object.entries(statuses)) if (![401, 403].includes(status)) { acceptanceStage = `target-denials-${actor}-${plane}-${status}`; throw new Error(`${actor} ${plane} target boundary failed`); }
    const client = createClient(fixture.project_url, fixture.publishable_key, { auth: { persistSession: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${bearer}` } } });
    client.realtime.setAuth(bearer);
    const channel = client.channel(`target-deny-${actor}-${randomUUID()}`, { config: { private: true } }).on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {});
    const realtime = await new Promise((resolve) => { const timer = setTimeout(() => resolve('TIMED_OUT'), 10_000); channel.subscribe((state) => { if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED', 'SUBSCRIBED'].includes(state)) { clearTimeout(timer); resolve(state); } }); });
    await client.removeChannel(channel);
    if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(realtime)) { acceptanceStage = `target-denials-${actor}-realtime`; throw new Error(`${actor} realtime target boundary failed`); }
  }
}
async function verifyMemberManagementDenials(fixture, privateFixture) {
  const memberRequest = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const project = new URL(fixture.project_url);
  const projectId = project.pathname.split('/').filter(Boolean).at(-1);
  if (!projectId) throw new Error('member management project identity missing');
  const bearer = privateFixture.bearers.bob;
  const headers = { apikey: fixture.publishable_key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' };
  const discoveryResponse = await memberRequest(`${project.origin}/v1/projects/${encodeURIComponent(projectId)}/discovery`, { headers });
  if (discoveryResponse.status !== 200) { acceptanceStage = `member-management-discovery-${discoveryResponse.status}`; throw new Error('member management discovery failed'); }
  const discovery = await discoveryResponse.json();
  const authorizationResponse = await memberRequest(`${fixture.identity_url.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/authorize-user`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}` } });
  const authorization = await authorizationResponse.json();
  if (authorizationResponse.status !== 200 || authorization.active !== true || authorization.role !== 'member' || !authorization.capabilities?.includes('project:read') || authorization.capabilities.some((capability) => ['functions:deploy', 'resources:write', 'project:manage'].includes(capability))) { acceptanceStage = 'member-management-capabilities'; throw new Error('member capability boundary invalid'); }
  const storageUrl = String(discovery.capabilities?.storage?.url || '');
  const functionUrl = String(discovery.function_deployments_url || '');
  const backupUrl = String(discovery.links?.database_backups || '');
  if (!storageUrl || !functionUrl || !backupUrl || !discovery.links?.database_migrations) { acceptanceStage = 'member-management-discovery-contract'; throw new Error('member management links unavailable'); }
  const requests = {
    migration: () => memberRequest(discovery.links.database_migrations, { method: 'POST', headers, body: JSON.stringify({ mode: 'preview', files: [] }) }),
    storage: () => memberRequest(`${new URL(storageUrl).origin}/storage/v1/projects/${encodeURIComponent(projectId)}/management/buckets`, { method: 'POST', headers, body: JSON.stringify({ id: 'member-must-not-create', name: 'Denied', public: false }) }),
    functions: () => memberRequest(`${functionUrl}/member-must-not-deploy/deploy`, { method: 'POST', headers, body: JSON.stringify({ source: 'export default () => new Response("denied")', auth: 'user' }) }),
    backups: () => memberRequest(backupUrl, { method: 'POST', headers: { ...headers, 'idempotency-key': `member-backup-deny-${randomUUID()}` } }),
    keys: () => memberRequest(`${fixture.identity_url.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(privateFixture.resources.workspace_id)}/projects/${encodeURIComponent(projectId)}/keys`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'member must deny', kind: 'publishable', scopes: ['data:read'], allowed_origins: [project.origin] }) }),
  };
  for (const [plane, request] of Object.entries(requests)) {
    const status = (await request()).status;
    if (![401, 403].includes(status)) { acceptanceStage = `member-management-${plane}-${status}`; throw new Error(`member ${plane} management boundary failed`); }
  }
}
const fixtureCommand = process.env.REFERENCE_FIXTURE_COMMAND;
if (!fixtureCommand) throw new Error('REFERENCE_FIXTURE_COMMAND is required');
let fixture;
let acceptanceError;
let acceptanceStage = 'fixture-provision';
let broker;
const fixtures = fixtureSession(fixtureCommand);
try {
  fixture = await fixtures.request({ schema: protocol, action: 'provision', fixture_id: `fixture_${randomUUID().replaceAll('-', '')}` });
  fixtureTransportStage = 'ok';
  acceptanceStage = 'fixture-validation';
  if (fixture.schema !== protocol || fixture.action !== 'provisioned') throw new Error('invalid fixture response envelope');
  acceptanceStage = 'fixture-public-fields';
  for (const field of ['fixture_id', 'project_url', 'identity_url', 'publishable_key', 'read_only_publishable_key', 'revoked_publishable_key', 'foreign_project_url', 'email_domain', 'generation']) if (typeof fixture[field] !== 'string' || !fixture[field]) throw new Error(`invalid fixture field: ${field}`);
  if (!/^gen_[a-f0-9]{32}$/.test(fixture.generation) || typeof fixture.resources !== 'object' || !fixture.resources) throw new Error('fixture generation/resource declaration invalid');
  const expectedPins = JSON.parse(process.env.REFERENCE_COMPONENT_PINS_JSON || 'null');
  acceptanceStage = 'fixture-provenance';
  const provenanceKeys = ['w-db', 'w-id', 'w-monitor', 'w-radar', 'w-storage'];
  if (!expectedPins || !fixture.component_provenance || JSON.stringify(Object.keys(fixture.component_provenance).sort()) !== JSON.stringify(provenanceKeys) || provenanceKeys.some((name) => fixture.component_provenance[name] !== expectedPins[name] || !/^[0-9a-f]{40}$/.test(fixture.component_provenance[name]))) throw new Error('fixture runtime provenance differs from protected pins');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(fixture.fixture_id) || [fixture.publishable_key, fixture.read_only_publishable_key, fixture.revoked_publishable_key].some((key) => !/^wid_pk_[A-Za-z0-9_-]+$/.test(key))) throw new Error('invalid fixture identity or key');
  acceptanceStage = 'fixture-url-policy';
  for (const field of ['project_url', 'foreign_project_url', 'identity_url']) {
    const url = new URL(fixture[field]);
    const loopback = process.env.REFERENCE_HERMETIC_MODE === '1' && url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if (url.protocol !== 'https:' && !loopback) throw new Error(`fixture ${field} must use HTTPS or explicitly opted-in hermetic loopback HTTP`);
  }
  if (new URL(fixture.project_url).href === new URL(fixture.foreign_project_url).href) throw new Error('foreign project must be distinct');
  acceptanceStage = 'fixture-private-envelope';
  const privateFixture = await fixtures.takePrivate(fixture.fixture_id);
  acceptanceStage = 'fixture-private-shape';
  const actors = ['alice', 'bob', 'foreign_owner', 'platform_admin'];
  if (JSON.stringify(Object.keys(privateFixture).sort()) !== JSON.stringify(['actors', 'bearers', 'fixture_id', 'fresh_browser', 'generation', 'otp_socket_path', 'resources', 'schema'])) { acceptanceStage = 'fixture-private-top-level-keys'; throw new Error('private identity envelope unavailable'); }
  if (privateFixture.schema !== 'w-reference-fixture-private/v2') { acceptanceStage = 'fixture-private-schema'; throw new Error('private identity envelope unavailable'); }
  if (privateFixture.fixture_id !== fixture.fixture_id) { acceptanceStage = 'fixture-private-fixture-binding'; throw new Error('private identity envelope unavailable'); }
  if (privateFixture.generation !== fixture.generation) { acceptanceStage = 'fixture-private-generation-binding'; throw new Error('private identity envelope unavailable'); }
  if (JSON.stringify(privateFixture.resources) !== JSON.stringify({ workspace_id: fixture.resources.workspace_id, project_id: fixture.resources.target_project_id, foreign_workspace_id: fixture.resources.foreign_workspace_id, foreign_project_id: fixture.resources.foreign_project_id })) { acceptanceStage = 'fixture-private-resource-binding'; throw new Error('private identity envelope unavailable'); }
  if (!privateFixture.actors || JSON.stringify(Object.keys(privateFixture.actors).sort()) !== JSON.stringify([...actors].sort())) { acceptanceStage = 'fixture-private-actor-set'; throw new Error('private identity envelope unavailable'); }
  if (!/^\/tmp\/[A-Za-z0-9._/-]{1,180}\.sock$/.test(privateFixture.otp_socket_path)) { acceptanceStage = 'fixture-private-otp-socket'; throw new Error('private identity envelope unavailable'); }
  acceptanceStage = 'fixture-role-matrix';
  const expectedRoles = { alice: ['user', privateFixture.resources.workspace_id, 'owner', privateFixture.resources.project_id, 'owner', true], bob: ['user', privateFixture.resources.workspace_id, 'member', privateFixture.resources.project_id, 'member', true], foreign_owner: ['user', privateFixture.resources.foreign_workspace_id, 'owner', privateFixture.resources.foreign_project_id, 'owner', true], platform_admin: ['super_admin', null, null, privateFixture.resources.project_id, null, false] };
  for (const actor of actors) { const identity = privateFixture.actors[actor]; const expected = expectedRoles[actor]; if (!identity || identity.platform_role !== expected[0] || identity.workspace_id !== expected[1] || identity.workspace_role !== expected[2] || identity.project_id !== expected[3] || identity.project_role !== expected[4] || identity.membership_active !== expected[5] || identity.generation !== fixture.generation || !/^proof_[A-Za-z0-9_-]{32,}$/.test(identity.proof || '') || identity.session?.kind !== 'oauth_pkce' || identity.session?.token_type !== 'Bearer' || identity.session?.bearer !== privateFixture.bearers?.[actor] || typeof identity.invitation?.setup_url !== 'string') throw new Error(`private ${actor} identity mismatch`); }
  for (const field of ['user_id', 'email', 'proof']) if (new Set(actors.map((actor) => privateFixture.actors[actor][field])).size !== actors.length) throw new Error(`private actor ${field} values are not unique`);
  for (const actor of ['alice', 'bob']) { const identity = privateFixture.actors[actor]; const response = await fetch(`${fixture.identity_url.replace(/\/$/, '')}/api/projects/${encodeURIComponent(privateFixture.resources.project_id)}/authorize-user`, { method: 'POST', headers: { Authorization: `Bearer ${privateFixture.bearers[actor]}` } }); const decision = await response.json(); if (response.status !== 200 || decision.active !== true || decision.sub !== identity.user_id || decision.workspace_id !== identity.workspace_id || decision.project_id !== identity.project_id || decision.role !== identity.workspace_role) { acceptanceStage = `fixture-${actor}-role`; throw new Error(`${actor} exact role mismatch`); } }
  const fresh = privateFixture.fresh_browser;
  if (!fresh || fresh.actor !== 'fresh_browser' || fresh.workspace_id !== privateFixture.resources.workspace_id || fresh.workspace_role !== 'admin' || fresh.project_id !== privateFixture.resources.project_id || fresh.project_role !== 'admin' || fresh.generation !== fixture.generation || !/^\d{6}$/.test(fresh.verification_code || '') || !Number.isSafeInteger(fresh.expires_at) || !/^wid-fixture-supabase-signup-/.test(fresh.supabase_signup_email || '') || JSON.stringify(fresh.flow) !== JSON.stringify(['password_setup', 'email_verification', 'workspace_invitation', 'oauth_pkce_s256'])) { acceptanceStage = 'fixture-fresh-browser'; throw new Error('fresh-browser identity envelope unavailable'); }
  const callbackOrigin = new URL(fresh.redirect_uri).origin;
  const tokenPreflight = await fetch(`${fixture.identity_url.replace(/\/$/, '')}/oauth/token`, { method: 'OPTIONS', headers: { Origin: callbackOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  if (tokenPreflight.status < 200 || tokenPreflight.status >= 300 || tokenPreflight.headers.get('access-control-allow-origin') !== callbackOrigin) { acceptanceStage = `fixture-fresh-browser-token-cors-${tokenPreflight.status}-${tokenPreflight.headers.get('access-control-allow-origin') === callbackOrigin ? 'allowed' : 'missing'}`; throw new Error('fresh-browser token endpoint CORS contract unavailable'); }
  const membershipCors = [];
  for (const [plane, path, method] of [['userinfo', '/oauth/userinfo', 'GET'], ['authorize-user', `/api/projects/${encodeURIComponent(privateFixture.resources.project_id)}/authorize-user`, 'POST']]) { const preflight = await fetch(`${fixture.identity_url.replace(/\/$/, '')}${path}`, { method: 'OPTIONS', headers: { Origin: callbackOrigin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'authorization' } }); membershipCors.push(`${plane}-${preflight.status}-${preflight.headers.get('access-control-allow-origin') === callbackOrigin ? 'allowed' : 'missing'}`); }
  if (membershipCors.some((result) => !result.endsWith('-allowed') || !/-2[0-9][0-9]-/.test(result))) { acceptanceStage = `fixture-fresh-browser-membership-cors-${membershipCors.join('-')}`; throw new Error('fresh-browser membership endpoint CORS contract unavailable'); }
  acceptanceStage = 'target-denials';
  await verifyTargetDenials(fixture, privateFixture);
  acceptanceStage = 'member-management-denials';
  await verifyMemberManagementDenials(fixture, privateFixture);
  acceptanceStage = 'private-brokers';
  broker = await invitationBroker({ fresh_browser: { invitation: fresh.setup_url, email: fresh.email, verification_code: fresh.verification_code, workspace_invitation_url: fresh.workspace_invitation_url, redirect_uri: fresh.redirect_uri } });
  const browserEnvironment = runtimeEnvironment({ REFERENCE_HERMETIC_MODE: process.env.REFERENCE_HERMETIC_MODE === '1' ? '1' : '0', VITE_W_PROJECT_URL: fixture.project_url, VITE_W_ID_URL: fixture.identity_url, VITE_W_REDIRECT_URI: fresh.redirect_uri, VITE_W_PUBLISHABLE_KEY: fixture.publishable_key, VITE_W_READ_ONLY_PUBLISHABLE_KEY: fixture.read_only_publishable_key, VITE_W_REVOKED_PUBLISHABLE_KEY: fixture.revoked_publishable_key, REFERENCE_FOREIGN_PROJECT_URL: fixture.foreign_project_url, REFERENCE_PRIVATE_SOCKET: broker.socketPath, REFERENCE_OTP_SOCKET: privateFixture.otp_socket_path, REFERENCE_USER_EMAIL_DOMAIN: fixture.email_domain, REFERENCE_FIXTURE_ID: fixture.fixture_id });
  for (const forbidden of ['W_ID_ACCEPTANCE_OPERATOR_KEY', 'RESEND_API_KEY', 'CI_GITEA_READ_TOKEN', 'REFERENCE_W_ID_IDENTITY_LAUNCHER_JSON', 'REFERENCE_W_DB_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_STORAGE_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_RADAR_LAUNCHER_COMMAND_JSON', 'REFERENCE_W_MONITOR_LAUNCHER_COMMAND_JSON', 'W_RADAR_REFERENCE_BINARY', 'W_MONITOR_REFERENCE_BINARY']) if (forbidden in browserEnvironment) throw new Error('browser environment contains a privileged secret');
  acceptanceStage = 'browser-sdk-ui-matrix';
  const result = await runPlaywright(browserEnvironment);
  process.stdout.write(result.stdout.replace(/wid_(?:pk|sk)_[A-Za-z0-9_-]+/g, '[REDACTED_KEY]'));
} catch (error) { acceptanceError = error; if (acceptanceStage === 'browser-sdk-ui-matrix' && /^[a-z0-9-]+$/.test(error?.safeStage || '')) acceptanceStage = `${acceptanceStage}-${error.safeStage}`; if (fixtureTransportStage !== 'ok') acceptanceStage = `${acceptanceStage}-${fixtureTransportStage}`; }
finally {
  if (broker) { try { await broker.close(); } catch { acceptanceError ||= new Error('private invitation broker cleanup failed'); } }
  if (fixture?.fixture_id) { try { const summary = await fixtures.request({ schema: protocol, action: 'cleanup', fixture_id: fixture.fixture_id }); if (summary.schema !== protocol || summary.action !== 'cleaned' || summary.fixture_id !== fixture.fixture_id) throw new Error('invalid cleanup envelope'); for (const field of ['keys', 'resources', 'projects', 'workspaces', 'accounts']) if (summary.deleted?.[field] !== true) throw new Error('incomplete cleanup'); } catch { if (!acceptanceError) { acceptanceError = new Error('reference fixture cleanup failed closed'); acceptanceStage = 'fixture-cleanup'; } } }
  try { await fixtures.close(); } catch { if (!acceptanceError) { acceptanceError = new Error('reference fixture session failed closed'); acceptanceStage = 'fixture-session-close'; } }
}
if (acceptanceError) throw new Error(`reference production acceptance failed at ${acceptanceStage}; sensitive child output suppressed`);
