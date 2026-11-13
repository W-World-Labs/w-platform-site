#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, writeSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';

if (process.argv[2] === '--fixture-watchdog') {
    const children = new Set(); let disarmed = false;
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of lines) {
        if (line === 'done') { disarmed = true; break; }
        if (/^[1-9][0-9]{0,9}$/.test(line)) children.add(Number(line));
    }
    if (!disarmed) {
        for (const pid of children) try { process.kill(pid, 'SIGTERM'); } catch {}
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline && [...children].some((pid) => { try { process.kill(pid, 0); return true; } catch { return false; } })) await new Promise((resolve) => setTimeout(resolve, 250));
        for (const pid of children) try { process.kill(pid, 'SIGKILL'); } catch {}
    }
    process.exit(0);
}

const protocol = 'w-reference-fixture/v1';
const run = promisify(execFile);
const parseCommand = (name) => {
    try {
        const value = JSON.parse(process.env[name] || 'null');
        if (!Array.isArray(value) || !value.length || value.some((part) => typeof part !== 'string' || !part)) throw new Error();
        return value;
    } catch { throw new Error(`${name} must be a non-empty JSON argv array`); }
};
const identityCommand = parseCommand('REFERENCE_W_ID_IDENTITY_LAUNCHER_JSON');
const databaseCommand = parseCommand('REFERENCE_W_DB_LAUNCHER_COMMAND_JSON');
const storageCommand = parseCommand('REFERENCE_W_STORAGE_LAUNCHER_COMMAND_JSON');
const radarCommand = parseCommand('REFERENCE_W_RADAR_LAUNCHER_COMMAND_JSON');
const monitorCommand = parseCommand('REFERENCE_W_MONITOR_LAUNCHER_COMMAND_JSON');
const emailDomain = process.env.REFERENCE_USER_EMAIL_DOMAIN;
if (!emailDomain || !/^[A-Za-z0-9.-]{1,253}$/.test(emailDomain)) throw new Error('REFERENCE_USER_EMAIL_DOMAIN is required');
const expectedPins = (() => { try { return JSON.parse(process.env.REFERENCE_COMPONENT_PINS_JSON || 'null'); } catch { return null; } })();
const provenanceKeys = ['w-db', 'w-id', 'w-monitor', 'w-radar', 'w-storage'];
if (!expectedPins || JSON.stringify(Object.keys(expectedPins).sort()) !== JSON.stringify(provenanceKeys) || provenanceKeys.some((name) => !/^[0-9a-f]{40}$/.test(expectedPins[name]))) throw new Error('immutable component pins are required');

const operatorInput = createReadStream('/dev/null', { fd: 4, autoClose: false });
const operatorChunks = []; let operatorBytes = 0;
for await (const chunk of operatorInput) { operatorBytes += chunk.length; if (operatorBytes > 4096) throw new Error('operator capability envelope too large'); operatorChunks.push(chunk); }
let operatorKey;
try {
    const envelope = JSON.parse(Buffer.concat(operatorChunks).toString('utf8'));
    if (JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(['operator_key', 'schema']) || envelope.schema !== 'w-reference-operator-private/v1' || typeof envelope.operator_key !== 'string' || envelope.operator_key.length < 32) throw new Error();
    operatorKey = envelope.operator_key;
} catch { throw new Error('operator capability envelope unavailable'); }

const cleanEnvironment = (extra = {}) => Object.fromEntries(Object.entries({ PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, TMPDIR: process.env.TMPDIR, CI: process.env.CI, CARGO_HOME: process.env.CARGO_HOME, RUSTUP_HOME: process.env.RUSTUP_HOME, ...extra }).filter(([, value]) => typeof value === 'string' && value));
const firstJsonLine = (stream, label, child, limit = 64 * 1024, timeoutMs = 600_000) => new Promise((resolve, reject) => {
    let bytes = 0; let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill('SIGKILL'); reject(new Error(`${label} timed out`)); } }, timeoutMs);
    const lines = createInterface({ input: stream });
    lines.once('line', (line) => {
        if (settled) return; settled = true; clearTimeout(timer); lines.close();
        try { bytes += Buffer.byteLength(line); if (bytes > limit) throw new Error(); resolve(JSON.parse(line)); } catch { reject(new Error(`${label} returned invalid JSON`)); }
    });
    child.once('close', (code, signal) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`${label} exited before manifest (${code ?? signal})`)); } });
});
const start = (command, options) => {
    const child = spawn(command[0], command.slice(1), options);
    child.fixtureExit = new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
    return child;
};
const watchdog = spawn(process.execPath, [process.argv[1], '--fixture-watchdog'], { stdio: ['pipe', 'ignore', 'ignore'], detached: true });
watchdog.unref();
const watch = (child) => { watchdog.stdin.write(`${child.pid}\n`); return child; };
const stop = async (child, label) => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const result = await child.fixtureExit;
    if (![0, 143].includes(result.code) && !['SIGTERM', 'SIGINT'].includes(result.signal)) throw new Error(`${label} cleanup failed`);
};
const endpointUnavailable = async (url) => {
    try { await fetch(url, { signal: AbortSignal.timeout(1_000) }); return false; } catch { return true; }
};
const dockerAbsent = async (name) => {
    try { await run('docker', ['inspect', name], { maxBuffer: 1024 }); return false; } catch { return true; }
};
const runtimeAbsent = async (prefix) => !(await readdir(tmpdir(), { withFileTypes: true })).some((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
const exactRequest = async (url, init, statuses) => {
    const response = await fetch(url, init); const body = await response.text();
    if (!statuses.includes(response.status)) throw new Error(`reference resource request failed (${response.status})`);
    return body ? JSON.parse(body) : {};
};
const prepareReferenceResource = async (databaseBase, storageBase, identity) => {
    const managerHeaders = { Authorization: `Bearer ${identity.alice_bearer}`, 'x-w-workspace-id': identity.workspace_id, 'content-type': 'application/json', 'idempotency-key': `fixture-resource-${identity.generation}` };
    const resource = await exactRequest(new URL(`v1/projects/${identity.project_id}/resources`, databaseBase), { method: 'POST', headers: managerHeaders, body: JSON.stringify({ api_version: 'w-db.resource/v1', workspace_id: identity.workspace_id, spec: { api_version: 'w-db.resource/v1', environment_id: 'production', kind: 'postgres', provider: 'local-postgres', region: 'local', plan: 'development', postgres_version: '18', capacity: { storage_mib: 1024, max_connections: 100 }, policy: { backup_retention_days: 7, deletion_grace_hours: 0 } } }) }, [202]);
    if (resource.resource?.observed_state !== 'ready' || typeof resource.resource.resource_id !== 'string' || !resource.resource.resource_id) throw new Error('reference database resource is not ready');
    const projectHeaders = { Authorization: `Bearer ${identity.alice_bearer}`, apikey: identity.publishable_key, 'content-type': 'application/json' };
    const migration = { name: '202608020001_reference_acceptance.sql', sql: 'ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY; ALTER TABLE public.todos FORCE ROW LEVEL SECURITY;' };
    await exactRequest(new URL(`v1/projects/${identity.project_id}/database/migrations`, databaseBase), { method: 'POST', headers: projectHeaders, body: JSON.stringify({ mode: 'apply', files: [migration] }) }, [200]);
    await exactRequest(new URL(`storage/v1/projects/${identity.project_id}/management/buckets`, storageBase), { method: 'POST', headers: projectHeaders, body: JSON.stringify({ id: 'reference-private', name: 'Reference private', public: false, file_size_limit: 1_048_576, allowed_mime_types: ['text/plain'], quota_bytes: 8_388_608 }) }, [200, 201]);
    active.referenceBucketCreated = true;
    const source = "export default async (request) => { const body = await request.json(); console.log(JSON.stringify({ event: 'reference-acceptance', marker: body.marker })); return new Response(JSON.stringify({ ok: true, marker: body.marker }), { headers: { 'content-type': 'application/json' } }); };";
    await exactRequest(new URL(`v1/projects/${identity.project_id}/functions/reference-acceptance/deploy`, databaseBase), { method: 'POST', headers: projectHeaders, body: JSON.stringify({ source, auth: 'user' }) }, [200, 201]);
    return resource.resource.resource_id;
};
const startUnifiedEdge = async (databaseBase, storageBase, identityBase, allowedOrigins) => {
    const database = new URL(databaseBase); const storage = new URL(storageBase); const identity = new URL(identityBase);
    const sockets = new Set();
    const server = createServer(async (request, response) => {
        try {
            const incoming = new URL(request.url, 'http://127.0.0.1');
            const requestOrigin = typeof request.headers.origin === 'string' && allowedOrigins.includes(request.headers.origin) ? request.headers.origin : null;
            if (request.method === 'OPTIONS' && requestOrigin) { response.writeHead(204, { 'access-control-allow-origin': requestOrigin, 'access-control-allow-methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,apikey,content-type,prefer,idempotency-key,x-client-info,x-supabase-api-version,x-w-trace-marker', vary: 'Origin' }); return response.end(); }
            const storageMatch = incoming.pathname.match(/^\/project\/([^/]+)\/storage\/v1\/(.*)$/);
            const storagePath = storageMatch?.[2] || '';
            const authMatch = /^\/auth\/v1\/(?:signup|verify|token|user|logout)$/.test(incoming.pathname);
            const target = authMatch ? new URL(`${incoming.pathname}${incoming.search}`, identity) : storageMatch
                ? new URL(storagePath.startsWith('signed/') ? `/storage/v1/${storagePath}${incoming.search}` : `/storage/v1/projects/${encodeURIComponent(decodeURIComponent(storageMatch[1]))}/supabase/${storagePath}${incoming.search}`, storage)
                : new URL(`${incoming.pathname}${incoming.search}`, database);
            const headers = new Headers(); for (const [name, value] of Object.entries(request.headers)) if (value !== undefined && !['host', 'connection', 'transfer-encoding'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
            const init = { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) };
            if (!['GET', 'HEAD'].includes(request.method)) { init.body = request; init.duplex = 'half'; }
            const upstream = await fetch(target, init);
            response.statusCode = upstream.status; for (const [name, value] of upstream.headers) if (!['connection', 'transfer-encoding', 'content-encoding', 'content-length'].includes(name)) response.setHeader(name, value);
            if (requestOrigin) { response.setHeader('access-control-allow-origin', requestOrigin); response.setHeader('vary', 'Origin'); }
            let body = Buffer.from(await upstream.arrayBuffer());
            if (incoming.pathname.endsWith('/.well-known/w-project') && upstream.ok) {
                const publicOrigin = `http://127.0.0.1:${server.address().port}`;
                const normalized = JSON.parse(body.toString('utf8'), (_key, value) => typeof value === 'string' && value.startsWith(database.origin) ? `${publicOrigin}${value.slice(database.origin.length)}` : value);
                body = Buffer.from(JSON.stringify(normalized));
            }
            response.end(body);
        } catch { if (!response.headersSent) response.writeHead(502); response.end(); }
    });
    server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    server.on('upgrade', (request, socket, head) => {
        const upstream = connect(Number(database.port), database.hostname, () => {
            const headers = Object.entries(request.headers).filter(([name]) => name !== 'host').map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\r\n');
            upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\nHost: ${database.host}\r\n${headers}\r\n\r\n`); if (head.length) upstream.write(head); socket.pipe(upstream).pipe(socket);
        });
        upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return { server, sockets, baseUrl: `http://127.0.0.1:${server.address().port}/` };
};
const exactKeys = (value, keys) => value && typeof value === 'object' && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const unique = (values) => values.length === new Set(values).size;
const fixtureStage = (stage) => process.stderr.write(`REFERENCE_FIXTURE_STAGE=${stage}\n`);
const validateIdentity = (identity, publicManifest) => {
    const identityKeys = ['actors', 'alice_bearer', 'bob_bearer', 'expired_publishable_key', 'foreign_bearer', 'foreign_project_id', 'fresh_browser', 'generation', 'issuance_rejections', 'lease_id', 'platform_admin_nonmember_bearer', 'project_id', 'publishable_key', 'read_only_publishable_key', 'revoked_bearer', 'revoked_publishable_key', 'rotated_publishable_key', 'schema', 'service_api_key', 'service_keys', 'supabase_signup_bearer', 'supabase_signup_user_id', 'workspace_id'];
    const actors = ['alice', 'bob', 'foreign_owner', 'platform_admin'];
    if (!exactKeys(identity, identityKeys) || identity.schema !== 'w-reference-identity-private-lease/v3' || !exactKeys(identity.actors, actors) || publicManifest.schema !== 'w-storage-identity-endpoints/v1' || publicManifest.fixture_id === '' || !/^https:\/\/|^http:\/\/(?:127\.0\.0\.1|\[::1\]):/.test(publicManifest.w_id_url || '')) throw new Error('W-ID long-lived identity transport mismatch');
    if (!/^lease_[A-Za-z0-9_-]{16,}$/.test(identity.lease_id || '') || !/^gen_[a-f0-9]{32}$/.test(identity.generation || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.project_id || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.foreign_project_id || '') || identity.project_id === identity.foreign_project_id) throw new Error('W-ID identity/resource declaration mismatch');
    const publishable = [identity.publishable_key, identity.read_only_publishable_key, identity.rotated_publishable_key, identity.revoked_publishable_key, identity.expired_publishable_key];
    const bearers = [identity.alice_bearer, identity.bob_bearer, identity.foreign_bearer, identity.platform_admin_nonmember_bearer, identity.revoked_bearer, identity.supabase_signup_bearer];
    if (!publishable.every((key) => /^wid_pk_[A-Za-z0-9_-]{6,}$/.test(key || '')) || !unique(publishable) || !bearers.every((token) => typeof token === 'string' && token.length >= 16) || !unique(bearers) || !/^sk_[A-Za-z0-9_-]{6,}$/.test(identity.service_api_key || '') || typeof identity.supabase_signup_user_id !== 'string' || identity.supabase_signup_user_id.length < 8) throw new Error('W-ID key declaration mismatch');
    const expectedActors = { alice: ['user', identity.workspace_id, 'owner', identity.project_id, 'owner', true, identity.alice_bearer], bob: ['user', identity.workspace_id, 'member', identity.project_id, 'member', true, identity.bob_bearer], foreign_owner: ['user', null, 'owner', identity.foreign_project_id, 'owner', true, identity.foreign_bearer], platform_admin: ['super_admin', null, null, identity.project_id, null, false, identity.platform_admin_nonmember_bearer] };
    const actorKeys = ['actor', 'email', 'generation', 'invitation', 'membership_active', 'platform_role', 'project_id', 'project_role', 'proof', 'session', 'user_id', 'workspace_id', 'workspace_role'];
    for (const actor of actors) {
        const value = identity.actors[actor]; const expected = expectedActors[actor];
        if (!exactKeys(value, actorKeys) || value.actor !== actor || value.platform_role !== expected[0] || value.workspace_role !== expected[2] || value.project_id !== expected[3] || value.project_role !== expected[4] || value.membership_active !== expected[5] || value.generation !== identity.generation || value.session?.kind !== 'oauth_pkce' || value.session?.token_type !== 'Bearer' || value.session?.bearer !== expected[6] || typeof value.invitation?.setup_url !== 'string' || !value.email.endsWith(`@${emailDomain}`)) throw new Error(`W-ID ${actor} identity mismatch`);
        if (actor !== 'foreign_owner' && value.workspace_id !== expected[1]) throw new Error(`W-ID ${actor} workspace mismatch`);
    }
    if (!identity.actors.foreign_owner.workspace_id || identity.actors.foreign_owner.workspace_id === identity.workspace_id) throw new Error('W-ID foreign Workspace is not independent');
    const freshKeys = ['actor', 'email', 'expires_at', 'flow', 'generation', 'platform_role', 'project_id', 'project_role', 'proof', 'redirect_uri', 'setup_url', 'supabase_signup_email', 'user_id', 'verification_code', 'w_id_url', 'workspace_id', 'workspace_invitation_url', 'workspace_role'];
    const fresh = identity.fresh_browser;
    if (!exactKeys(fresh, freshKeys) || fresh.actor !== 'fresh_browser' || fresh.platform_role !== 'user' || fresh.workspace_id !== identity.workspace_id || fresh.workspace_role !== 'admin' || fresh.project_id !== identity.project_id || fresh.project_role !== 'admin' || fresh.generation !== identity.generation || !fresh.email.endsWith(`@${emailDomain}`) || !/^proof_[A-Za-z0-9_-]{32,}$/.test(fresh.proof || '') || !/^\d{6}$/.test(fresh.verification_code || '') || !Number.isSafeInteger(fresh.expires_at) || typeof fresh.setup_url !== 'string' || typeof fresh.workspace_invitation_url !== 'string' || typeof fresh.redirect_uri !== 'string' || typeof fresh.w_id_url !== 'string' || !/^wid-fixture-supabase-signup-/.test(fresh.supabase_signup_email || '') || !fresh.supabase_signup_email.endsWith(`@${emailDomain}`) || JSON.stringify(fresh.flow) !== JSON.stringify(['password_setup', 'email_verification', 'workspace_invitation', 'oauth_pkce_s256'])) throw new Error('W-ID fresh-browser contract mismatch');
    const serviceKeys = ['active_current', 'explicitly_revoked', 'foreign_project', 'missing_scope', 'rotated_new', 'rotated_old', 'wrong_audience'];
    if (!exactKeys(identity.service_keys, serviceKeys) || !exactKeys(identity.issuance_rejections, ['excessive_ttl', 'overbroad_scope'])) throw new Error('W-ID service-key negative matrix missing');
    if (identity.service_keys.active_current?.key !== identity.service_api_key || identity.service_keys.active_current?.introspection?.active !== true || identity.service_keys.rotated_new?.key !== identity.service_api_key || identity.service_keys.rotated_new?.introspection?.active !== true || identity.service_keys.rotated_old?.introspection?.active !== false || identity.service_keys.explicitly_revoked?.introspection?.active !== false || identity.service_keys.wrong_audience?.introspection?.active !== false || identity.service_keys.missing_scope?.introspection?.active !== false || identity.service_keys.foreign_project?.target_introspection?.active !== false || identity.service_keys.foreign_project?.exact_introspection?.active !== true) throw new Error('W-ID service-key lifecycle evidence mismatch');
    for (const rejection of Object.values(identity.issuance_rejections)) if (rejection?.status !== 400 || typeof rejection.error !== 'string' || !/^proof_[A-Za-z0-9_-]{32,}$/.test(rejection.proof || '') || 'key' in rejection) throw new Error('W-ID issuance rejection mismatch');
};

let active;
async function provision(fixtureId) {
    if (active) throw new Error('fixture already provisioned');
    fixtureStage('identity-start');
    const supervisorId = `wplatform-${process.pid}-${randomBytes(8).toString('hex')}`;
    const identityOtpDirectory = await mkdtemp(join(tmpdir(), 'w-reference-identity-otp-'));
    const identityOtpSocket = join(identityOtpDirectory, 'verification.sock');
    const identity = watch(start(identityCommand, { env: cleanEnvironment({ W_STORAGE_IDENTITY_LEASE_MODE: '1', W_REFERENCE_SUPERVISOR_ID: supervisorId, W_REFERENCE_OPERATOR_KEY_FD: '5', W_REFERENCE_OTP_SOCKET_PATH: identityOtpSocket }), stdio: ['ignore', 'pipe', 'ignore', 'pipe', 'ignore', 'pipe'] }));
    active = { fixtureId, supervisorId, identity, identityOtpDirectory, identityOtpSocket };
    identity.stdio[5].end(operatorKey); operatorKey = undefined;
    const [identityPublic, identityPrivate] = await Promise.all([firstJsonLine(identity.stdout, 'W-ID public manifest', identity), firstJsonLine(identity.stdio[3], 'W-ID private v3 lease', identity, 256 * 1024)]);
    validateIdentity(identityPrivate, identityPublic);
    fixtureStage('identity-ready');
    Object.assign(active, { identityPublic, identityPrivate });
    const storageFixture = Object.fromEntries(['lease_id', 'workspace_id', 'project_id', 'foreign_project_id', 'publishable_key', 'rotated_publishable_key', 'revoked_publishable_key', 'alice_bearer', 'bob_bearer', 'foreign_bearer', 'platform_admin_nonmember_bearer', 'revoked_bearer'].map((key) => [key, identityPrivate[key]]));
    const storage = watch(start(storageCommand, { env: cleanEnvironment({ W_STORAGE_LAUNCHER_INPUT_FD: '3', W_STORAGE_LAUNCHER_PRIVATE_OUTPUT_FD: '4' }), stdio: ['ignore', 'pipe', 'ignore', 'pipe', 'pipe'] }));
    fixtureStage('storage-start');
    active.storage = storage;
    const storageInput = { schema: 'w-storage-hermetic-launcher-input/v1', w_id_url: identityPublic.w_id_url, fixture: storageFixture };
    if (process.env.W_STORAGE_REFERENCE_BINARY) storageInput.binary = process.env.W_STORAGE_REFERENCE_BINARY;
    storage.stdio[3].end(`${JSON.stringify(storageInput)}\n`);
    const [storagePublic, storagePrivate] = await Promise.all([firstJsonLine(storage.stdout, 'W-Storage public manifest', storage), firstJsonLine(storage.stdio[4], 'W-Storage private lease', storage)]);
    if (storagePublic.schema !== 'w-storage-hermetic-endpoints/v1' || storagePrivate.schema !== 'w-storage-hermetic-private-lease/v1') throw new Error('W-Storage launcher contract mismatch');
    fixtureStage('storage-ready');
    active.storagePublic = storagePublic;
    fixtureStage('discovery-start');
    const discovery = await fetch(new URL(`.well-known/w-project/${identityPrivate.project_id}`, identityPublic.w_id_url)).then((response) => response.json());
    const freshRedirectOrigin = new URL(identityPrivate.fresh_browser.redirect_uri).origin;
    if (!discovery.data?.allowed_origins?.includes(freshRedirectOrigin)) throw new Error('W-ID fresh-browser redirect origin is absent from project CORS origins');
    const allowedOrigins = discovery.data?.allowed_origins?.filter((origin) => /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)) || [];
    if (!allowedOrigins.length || !allowedOrigins.includes(freshRedirectOrigin)) throw new Error('W-ID fixture omitted browser acceptance origin');
    const radarProjectId = discovery.data?.radar_project_id;
    if (typeof radarProjectId !== 'string' || !/^[A-Za-z0-9._-]{1,255}$/.test(radarProjectId)) throw new Error('W-ID Radar project identity unavailable');
    fixtureStage('discovery-ready');
    const radar = watch(start(radarCommand, { env: cleanEnvironment({ W_RADAR_LAUNCHER_INPUT_FD: '3', W_RADAR_LAUNCHER_PRIVATE_OUTPUT_FD: '4' }), stdio: ['ignore', 'pipe', 'ignore', 'pipe', 'pipe'] }));
    fixtureStage('radar-start');
    active.radar = radar;
    radar.stdio[3].end(`${JSON.stringify({ schema: 'w-radar-hermetic-launcher-input/v1', w_id_url: identityPublic.w_id_url, workspace_id: identityPrivate.workspace_id, project_id: identityPrivate.project_id, radar_project_id: radarProjectId, allowed_origin: freshRedirectOrigin, binary: process.env.W_RADAR_REFERENCE_BINARY })}\n`);
    const [radarPublic, radarPrivate] = await Promise.all([firstJsonLine(radar.stdout, 'W-Radar public manifest', radar), firstJsonLine(radar.stdio[4], 'W-Radar private manifest', radar)]);
    if (radarPublic.schema !== 'w-radar-hermetic-endpoints/v1' || radarPublic.radar_project_id !== radarProjectId || radarPublic.capabilities?.project_logs !== 'real-w-radar-handler' || radarPrivate.schema !== 'w-radar-hermetic-private/v1' || !/^[A-Za-z0-9._-]{1,255}$/.test(radarPrivate.tracking_code || '')) throw new Error('W-Radar launcher contract mismatch');
    fixtureStage('radar-ready');
    active.radarPublic = radarPublic;
    const monitor = watch(start(monitorCommand, { env: cleanEnvironment({ W_MONITOR_LAUNCHER_INPUT_FD: '3' }), stdio: ['ignore', 'pipe', 'ignore', 'pipe'] }));
    fixtureStage('monitor-start');
    active.monitor = monitor;
    monitor.stdio[3].end(`${JSON.stringify({ schema: 'w-monitor-hermetic-launcher-input/v1', w_id_url: identityPublic.w_id_url, workspace_id: identityPrivate.workspace_id, project_id: identityPrivate.project_id, allowed_origin: freshRedirectOrigin, binary: process.env.W_MONITOR_REFERENCE_BINARY })}\n`);
    const monitorPublic = await firstJsonLine(monitor.stdout, 'W-Monitor public manifest', monitor);
    if (monitorPublic.schema !== 'w-monitor-hermetic-endpoints/v1' || monitorPublic.capabilities?.project_health !== 'real-w-monitor-handler') throw new Error('W-Monitor launcher contract mismatch');
    fixtureStage('monitor-ready');
    active.monitorPublic = monitorPublic;
    const databaseInput = { schema: 'w-db-hermetic-launcher-input/v1', host_project_id: identityPrivate.project_id, w_id_url: identityPublic.w_id_url, w_id_api_key: identityPrivate.service_api_key, allowed_origins: allowedOrigins, storage_url: storagePublic.base_url, radar_url: radarPublic.base_url, radar_tracking_code: radarPrivate.tracking_code, monitor_url: monitorPublic.base_url };
    if (process.env.W_DB_REFERENCE_BINARY) databaseInput.binary = process.env.W_DB_REFERENCE_BINARY;
    if (process.env.W_DB_TEST_DENO_BINARY) databaseInput.deno_binary = process.env.W_DB_TEST_DENO_BINARY;
    const database = watch(start(databaseCommand, { env: cleanEnvironment({ W_DB_LAUNCHER_INPUT_FD: '3' }), stdio: ['ignore', 'pipe', 'ignore', 'pipe'] }));
    fixtureStage('database-start');
    active.database = database;
    database.stdio[3].end(`${JSON.stringify(databaseInput)}\n`);
    const databasePublic = await firstJsonLine(database.stdout, 'W-DB public manifest', database);
    if (databasePublic.schema !== 'w-db-hermetic-endpoints/v1' || databasePublic.capabilities?.database !== 'real-w-db-handler' || databasePublic.capabilities?.storage !== 'external' || databasePublic.capabilities?.functions !== 'real-w-db-handler' || databasePublic.capabilities?.realtime !== 'real-w-db-handler' || databasePublic.capabilities?.observability !== 'real-cross-product') throw new Error('W-DB launcher capability mismatch');
    fixtureStage('database-ready');
    fixtureStage('resource-start');
    active.resourceId = await prepareReferenceResource(databasePublic.base_url, storagePublic.base_url, identityPrivate);
    fixtureStage('resource-ready');
    fixtureStage('edge-start');
    const edge = await startUnifiedEdge(databasePublic.base_url, storagePublic.base_url, identityPublic.w_id_url, allowedOrigins); active.edge = edge;
    const projectUrl = new URL(`project/${identityPrivate.project_id}`, edge.baseUrl).href;
    const foreignProjectUrl = new URL(`project/${identityPrivate.foreign_project_id}`, edge.baseUrl).href;
    const discoveryHeaders = { apikey: identityPrivate.publishable_key, Authorization: `Bearer ${identityPrivate.alice_bearer}` };
    const internalDiscovery = await exactRequest(new URL(`project/${identityPrivate.project_id}/.well-known/w-project`, databasePublic.base_url), { headers: discoveryHeaders }, [200]);
    const edgeDiscovery = await exactRequest(new URL('.well-known/w-project', projectUrl.endsWith('/') ? projectUrl : `${projectUrl}/`), { headers: discoveryHeaders }, [200]);
    const expectedEdgeDiscovery = JSON.parse(JSON.stringify(internalDiscovery), (_key, value) => typeof value === 'string' && value.startsWith(new URL(databasePublic.base_url).origin) ? `${new URL(edge.baseUrl).origin}${value.slice(new URL(databasePublic.base_url).origin.length)}` : value);
    if (JSON.stringify(edgeDiscovery) !== JSON.stringify(expectedEdgeDiscovery) || new URL(edgeDiscovery.project_url).origin !== new URL(edge.baseUrl).origin || JSON.stringify(edgeDiscovery).includes(new URL(databasePublic.base_url).origin)) throw new Error('unified edge discovery origin normalization mismatch');
    fixtureStage('edge-ready');
    active.databasePublic = databasePublic;
    const resources = { workspace_id: identityPrivate.workspace_id, target_project_id: identityPrivate.project_id, foreign_workspace_id: identityPrivate.actors.foreign_owner.workspace_id, foreign_project_id: identityPrivate.foreign_project_id };
    const privateResources = { workspace_id: identityPrivate.workspace_id, project_id: identityPrivate.project_id, foreign_workspace_id: identityPrivate.actors.foreign_owner.workspace_id, foreign_project_id: identityPrivate.foreign_project_id };
    writeSync(3, `${JSON.stringify({ schema: 'w-reference-fixture-private/v2', fixture_id: fixtureId, generation: identityPrivate.generation, resources: privateResources, fresh_browser: identityPrivate.fresh_browser, actors: identityPrivate.actors, bearers: { alice: identityPrivate.alice_bearer, bob: identityPrivate.bob_bearer, foreign_owner: identityPrivate.foreign_bearer, platform_admin: identityPrivate.platform_admin_nonmember_bearer, revoked: identityPrivate.revoked_bearer }, otp_socket_path: identityOtpSocket })}\n`);
    fixtureStage('provision-ready');
    return { schema: protocol, action: 'provisioned', fixture_id: fixtureId, project_url: projectUrl, identity_url: identityPublic.w_id_url, publishable_key: identityPrivate.publishable_key, read_only_publishable_key: identityPrivate.read_only_publishable_key, revoked_publishable_key: identityPrivate.revoked_publishable_key, foreign_project_url: foreignProjectUrl, email_domain: emailDomain, generation: identityPrivate.generation, resources, component_provenance: expectedPins };
}
async function cleanup(fixtureId) {
    if (!active || active.fixtureId !== fixtureId) throw new Error('fixture cleanup handle unavailable');
    const state = active; active = undefined;
    const failures = [];
    try { if (state.edge) { state.edge.server.closeAllConnections?.(); for (const socket of state.edge.sockets) socket.destroy(); await Promise.race([new Promise((resolve, reject) => state.edge.server.close((error) => error ? reject(error) : resolve())), new Promise((_, reject) => setTimeout(() => reject(new Error('unified edge close timed out')), 5_000))]); } } catch (error) { failures.push(error); }
    try { if (state.edge && !(await endpointUnavailable(state.edge.baseUrl))) throw new Error('unified edge absence proof failed'); } catch (error) { failures.push(error); }
    try { if (state.database) await stop(state.database, 'W-DB'); } catch (error) { failures.push(error); }
    try { if (state.databasePublic && (!(await dockerAbsent(`w-db-hermetic-${state.databasePublic.runtime_id}`)) || !(await runtimeAbsent(`w-db-hermetic.${state.databasePublic.runtime_id}.`)) || !(await endpointUnavailable(state.databasePublic.health_url)))) throw new Error('W-DB absence proof failed'); } catch (error) { failures.push(error); }
    try { if (state.monitor) await stop(state.monitor, 'W-Monitor'); } catch (error) { failures.push(error); }
    try { if (state.monitorPublic && (!(await runtimeAbsent(`w-monitor-hermetic.${state.monitorPublic.runtime_id}.`)) || !(await endpointUnavailable(state.monitorPublic.health_url)))) throw new Error('W-Monitor absence proof failed'); } catch (error) { failures.push(error); }
    try { if (state.radar) await stop(state.radar, 'W-Radar'); } catch (error) { failures.push(error); }
    try { if (state.radarPublic && (!(await dockerAbsent(`w-radar-hermetic-${state.radarPublic.runtime_id}`)) || !(await runtimeAbsent(`w-radar-hermetic.${state.radarPublic.runtime_id}.`)) || !(await endpointUnavailable(state.radarPublic.health_url)))) throw new Error('W-Radar absence proof failed'); } catch (error) { failures.push(error); }
    try {
        if (state.referenceBucketCreated) {
            const identity = state.identityPrivate;
            await exactRequest(new URL(`storage/v1/projects/${identity.project_id}/management/buckets/reference-private`, state.storagePublic.base_url), { method: 'DELETE', headers: { Authorization: `Bearer ${identity.alice_bearer}`, apikey: identity.publishable_key }, signal: AbortSignal.timeout(10_000) }, [200, 204]);
        }
    } catch (error) { failures.push(error); }
    try { if (state.storage) await stop(state.storage, 'W-Storage'); } catch (error) { failures.push(error); }
    try { if (state.storagePublic && (!(await runtimeAbsent(`w-storage-hermetic.${state.storagePublic.runtime_id}.`)) || !(await endpointUnavailable(state.storagePublic.health_url)))) throw new Error('W-Storage absence proof failed'); } catch (error) { failures.push(error); }
    try { await stop(state.identity, 'W-ID'); } catch (error) { failures.push(error); }
    try { if (!(await dockerAbsent(`wid-fixture-e2e-${state.supervisorId}`)) || (state.identityPublic && !(await endpointUnavailable(new URL('openapi.json', state.identityPublic.w_id_url))))) throw new Error('W-ID absence proof failed'); } catch (error) { failures.push(error); }
    try { if (state.identityOtpDirectory) await rm(state.identityOtpDirectory, { recursive: true, force: true }); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'fixture cleanup absence proof failed');
    return { keys: true, resources: true, projects: true, workspaces: true, accounts: true };
}
async function emergencyCleanup() { if (active) { try { await cleanup(active.fixtureId); } catch { process.exitCode = 1; } } }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void emergencyCleanup().finally(() => process.exit(process.exitCode || 128 + (signal === 'SIGINT' ? 2 : 15))); });

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
try {
    for await (const line of lines) {
        if (Buffer.byteLength(line) > 16_384) throw new Error('fixture request too large');
        let input; try { input = JSON.parse(line); } catch { throw new Error('invalid fixture request JSON'); }
        if (!exactKeys(input, ['action', 'fixture_id', 'schema']) || input.schema !== protocol || !['provision', 'cleanup'].includes(input.action) || !/^fixture_[A-Za-z0-9_-]{1,56}$/.test(input.fixture_id || '')) throw new Error('unsupported fixture request');
        if (input.action === 'provision') process.stdout.write(`${JSON.stringify(await provision(input.fixture_id))}\n`);
        else process.stdout.write(`${JSON.stringify({ schema: protocol, action: 'cleaned', fixture_id: input.fixture_id, deleted: await cleanup(input.fixture_id) })}\n`);
    }
} finally { await emergencyCleanup(); }
watchdog.stdin.end('done\n');
