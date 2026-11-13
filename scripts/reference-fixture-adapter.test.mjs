import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';

const directory = await mkdtemp(join(tmpdir(), 'w-reference-adapter-test-'));
const identity = join(directory, 'identity.mjs');
const storage = join(directory, 'storage.mjs');
const database = join(directory, 'database.mjs');
const radar = join(directory, 'radar.mjs');
const monitor = join(directory, 'monitor.mjs');
const pins = { 'w-id': 'a'.repeat(40), 'w-db': 'b'.repeat(40), 'w-storage': 'c'.repeat(40), 'w-radar': 'd'.repeat(40), 'w-monitor': 'e'.repeat(40) };
const script = async (path, source) => { await writeFile(path, `#!/usr/bin/env node\n${source}`, { mode: 0o700 }); await chmod(path, 0o700); };
await script(identity, String.raw`
import {createServer} from 'node:http';import {readSync,writeSync} from 'node:fs';
const read=fd=>{let out='';const b=Buffer.alloc(4096);for(;;){const n=readSync(fd,b,0,b.length,null);if(!n)break;out+=b.subarray(0,n)}return out};
if(read(5)!=='o'.repeat(32)||process.env.CARGO_HOME!=='/test/cargo'||process.env.RUSTUP_HOME!=='/test/rustup')process.exit(2);
const server=createServer((req,res)=>{if(/^\/auth\/v1\/(signup|verify|token|user|logout)(?:\?|$)/.test(req.url)){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.setHeader('content-type','application/json');res.statusCode=req.url.startsWith('/auth/v1/signup')?201:200;res.end(JSON.stringify({upstream:'w-id-auth',path:req.url,method:req.method,apikey:req.headers.apikey,authorization:req.headers.authorization,body}));});return}if(req.url==='/openapi.json'){res.end('{}');return}if(req.url==='/.well-known/w-project/target'){res.setHeader('content-type','application/json');res.end(JSON.stringify({data:{allowed_origins:['http://127.0.0.1:4174'],radar_project_id:'ws_target.target'}}));return}res.statusCode=404;res.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
const generation='gen_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';const actor=(name,n,fields,bearer)=>({actor:name,user_id:'user_'+String(n).repeat(32),email:name+'@mail.example',generation,proof:'proof_'+String(n).repeat(32),invitation:{setup_url:'https://auth.example/setup/'+name,workspace_invitation_url:fields.membership_active?'https://auth.example/invite/'+name:null},session:{kind:'oauth_pkce',token_type:'Bearer',bearer},...fields});const actors={alice:actor('alice',1,{platform_role:'user',workspace_id:'ws_target',workspace_role:'owner',project_id:'target',project_role:'owner',membership_active:true},'bearer_alice_123456'),bob:actor('bob',2,{platform_role:'user',workspace_id:'ws_target',workspace_role:'member',project_id:'target',project_role:'member',membership_active:true},'bearer_bob_12345678'),foreign_owner:actor('foreign_owner',3,{platform_role:'user',workspace_id:'ws_foreign',workspace_role:'owner',project_id:'foreign',project_role:'owner',membership_active:true},'bearer_foreign_12345'),platform_admin:actor('platform_admin',4,{platform_role:'super_admin',workspace_id:null,workspace_role:null,project_id:'target',project_role:null,membership_active:false},'bearer_admin_1234567')};const active={active:true},inactive={active:false};const service_keys={active_current:{key:'sk_service000',introspection:active},rotated_old:{key:'sk_old000000',introspection:inactive},rotated_new:{key:'sk_service000',introspection:active},explicitly_revoked:{key:'sk_revoked00',introspection:inactive},wrong_audience:{key:'sk_audience00',introspection:inactive},missing_scope:{key:'sk_scope0000',introspection:inactive},foreign_project:{key:'sk_foreign00',target_introspection:inactive,exact_introspection:active}};const reject={status:400,error:'service_key_rejected',proof:'proof_'+String(9).repeat(32)};
process.stdout.write(JSON.stringify({schema:'w-storage-identity-endpoints/v1',launcher_version:'1',w_id_url:base,fixture_id:'fixture_upstream'})+'\n');const fresh_browser={actor:'fresh_browser',user_id:'user_'+String(5).repeat(32),email:'fresh_browser@mail.example',platform_role:'user',workspace_id:'ws_target',workspace_role:'admin',project_id:'target',project_role:'admin',generation,proof:'proof_'+String(5).repeat(32),expires_at:Math.floor(Date.now()/1000)+600,w_id_url:base,redirect_uri:'http://127.0.0.1:4174/auth/callback',setup_url:'https://auth.example/setup/fresh',verification_code:'123456',supabase_signup_email:'wid-fixture-supabase-signup-test@mail.example',workspace_invitation_url:'https://auth.example/invite/fresh',flow:['password_setup','email_verification','workspace_invitation','oauth_pkce_s256']};writeSync(3,JSON.stringify({schema:'w-reference-identity-private-lease/v3',lease_id:'lease_abcdefghijklmnop',generation,workspace_id:'ws_target',project_id:'target',foreign_project_id:'foreign',publishable_key:'wid_pk_write00',read_only_publishable_key:'wid_pk_read000',rotated_publishable_key:'wid_pk_rotated0',revoked_publishable_key:'wid_pk_revoked0',expired_publishable_key:'wid_pk_expired0',service_api_key:'sk_service000',alice_bearer:actors.alice.session.bearer,bob_bearer:actors.bob.session.bearer,foreign_bearer:actors.foreign_owner.session.bearer,platform_admin_nonmember_bearer:actors.platform_admin.session.bearer,revoked_bearer:'bearer_revoked_12345',supabase_signup_user_id:'user_signup000000000000000000000000',supabase_signup_bearer:'bearer_signup_123456',fresh_browser,actors,service_keys,issuance_rejections:{overbroad_scope:reject,excessive_ttl:{...reject,proof:'proof_'+String(8).repeat(32)}}})+'\n');
await new Promise(r=>process.once('SIGTERM',r));await new Promise(r=>server.close(r));
`);
await script(storage, String.raw`
import {createServer} from 'node:http';import {readSync,writeSync} from 'node:fs';const read=fd=>{let out='';const b=Buffer.alloc(4096);for(;;){const n=readSync(fd,b,0,b.length,null);if(!n)break;out+=b.subarray(0,n)}return out};const input=JSON.parse(read(3));if(input.schema!=='w-storage-hermetic-launcher-input/v1'||input.fixture.service_api_key)process.exit(2);writeSync(4,JSON.stringify({...input.fixture,schema:'w-storage-hermetic-private-lease/v1'})+'\n');let bucketCreated=false;const server=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/storage/v1/projects/target/management/buckets')bucketCreated=true;if(req.method==='DELETE'&&req.url==='/storage/v1/projects/target/management/buckets/reference-private'){if(req.headers.apikey!==input.fixture.publishable_key||req.headers.authorization!=='Bearer '+input.fixture.alice_bearer){res.statusCode=403;res.end('{}');return}bucketCreated=false;res.statusCode=204;res.end();return}res.end('{}')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';process.stdout.write(JSON.stringify({schema:'w-storage-hermetic-endpoints/v1',runtime_id:'storagetest',base_url:base,health_url:base+'health'})+'\n');await new Promise(r=>process.once('SIGTERM',r));if(bucketCreated)process.exit(71);await new Promise(r=>server.close(r));
`);
await script(database, String.raw`
import {createServer} from 'node:http';import {readSync} from 'node:fs';const read=fd=>{let out='';const b=Buffer.alloc(4096);for(;;){const n=readSync(fd,b,0,b.length,null);if(!n)break;out+=b.subarray(0,n)}return out};const input=JSON.parse(read(3));if(input.schema!=='w-db-hermetic-launcher-input/v1'||!input.w_id_api_key.startsWith('sk_')||input.radar_tracking_code!=='RADARTEST')process.exit(2);let base;const server=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/v1/projects/target/resources'){res.statusCode=202;res.end(JSON.stringify({resource:{resource_id:'resource_test',observed_state:'ready'}}));return}if(req.method==='POST'&&req.url==='/v1/projects/target/functions/reference-acceptance/deploy'){res.statusCode=201;res.end('{}');return}if(req.method==='GET'&&req.url==='/project/target/.well-known/w-project'){res.end(JSON.stringify({schema_version:'1',project_id:'target',workspace_id:'ws_target',project_url:base+'project/target',backend_url:base+'project/target',data_url:base+'project/target/rest/v1',capabilities:{database:{status:'available'}}}));return}res.end('{}')});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';process.stdout.write(JSON.stringify({schema:'w-db-hermetic-endpoints/v1',runtime_id:'databasetest',base_url:base,health_url:base+'health',project_url_template:base+'project/{project_id}',capabilities:{database:'real-w-db-handler',storage:'external',functions:'real-w-db-handler',realtime:'real-w-db-handler',observability:'real-cross-product'}})+'\n');await new Promise(r=>process.once('SIGTERM',r));await new Promise(r=>server.close(r));
`);
await script(radar, String.raw`
import {createServer} from 'node:http';import {readSync,writeSync} from 'node:fs';const read=fd=>{let out='';const b=Buffer.alloc(4096);for(;;){const n=readSync(fd,b,0,b.length,null);if(!n)break;out+=b.subarray(0,n)}return out};const input=JSON.parse(read(3));if(input.schema!=='w-radar-hermetic-launcher-input/v1'||input.radar_project_id!=='ws_target.target')process.exit(2);writeSync(4,JSON.stringify({schema:'w-radar-hermetic-private/v1',tracking_code:'RADARTEST'})+'\n');const server=createServer((req,res)=>res.end('{}'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';process.stdout.write(JSON.stringify({schema:'w-radar-hermetic-endpoints/v1',runtime_id:'radartest',base_url:base,health_url:base+'health',radar_project_id:input.radar_project_id,capabilities:{project_logs:'real-w-radar-handler',otlp_ingest:'real-w-radar-handler'}})+'\n');await new Promise(r=>process.once('SIGTERM',r));await new Promise(r=>server.close(r));
`);
await script(monitor, String.raw`
import {createServer} from 'node:http';import {readSync} from 'node:fs';const read=fd=>{let out='';const b=Buffer.alloc(4096);for(;;){const n=readSync(fd,b,0,b.length,null);if(!n)break;out+=b.subarray(0,n)}return out};const input=JSON.parse(read(3));if(input.schema!=='w-monitor-hermetic-launcher-input/v1'||input.project_id!=='target')process.exit(2);const server=createServer((req,res)=>res.end('{}'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';process.stdout.write(JSON.stringify({schema:'w-monitor-hermetic-endpoints/v1',runtime_id:'monitortest',base_url:base,health_url:base+'health',capabilities:{project_health:'real-w-monitor-handler'}})+'\n');await new Promise(r=>process.once('SIGTERM',r));await new Promise(r=>server.close(r));
`);

function start() {
    const child = spawn(process.execPath, ['scripts/reference-fixture-adapter.mjs'], { env: { ...process.env, CARGO_HOME: '/test/cargo', RUSTUP_HOME: '/test/rustup', REFERENCE_W_ID_IDENTITY_LAUNCHER_JSON: JSON.stringify([identity]), REFERENCE_W_DB_LAUNCHER_COMMAND_JSON: JSON.stringify([database]), REFERENCE_W_STORAGE_LAUNCHER_COMMAND_JSON: JSON.stringify([storage]), REFERENCE_W_RADAR_LAUNCHER_COMMAND_JSON: JSON.stringify([radar]), REFERENCE_W_MONITOR_LAUNCHER_COMMAND_JSON: JSON.stringify([monitor]), REFERENCE_USER_EMAIL_DOMAIN: 'mail.example', REFERENCE_COMPONENT_PINS_JSON: JSON.stringify(pins), W_DB_TEST_DENO_BINARY: '/bin/true', W_RADAR_REFERENCE_BINARY: '/bin/true', W_MONITOR_REFERENCE_BINARY: '/bin/true' }, stdio: ['pipe', 'pipe', 'ignore', 'pipe', 'pipe'] });
    child.stdio[4].end(`${JSON.stringify({ schema: 'w-reference-operator-private/v1', operator_key: 'o'.repeat(32) })}\n`);
    const responses = []; const waiters = []; const privateResponses = [];
    createInterface({ input: child.stdout }).on('line', (line) => { const value = JSON.parse(line); const waiter = waiters.shift(); if (waiter) waiter(value); else responses.push(value); });
    createInterface({ input: child.stdio[3] }).on('line', (line) => privateResponses.push(JSON.parse(line)));
    const request = (body) => new Promise((resolve) => { if (responses.length) resolve(responses.shift()); else waiters.push(resolve); child.stdin.write(`${JSON.stringify(body)}\n`); });
    return { child, request, privateResponses };
}
const exit = (child) => new Promise((resolve) => child.once('close', resolve));
const childPids = async (pid) => (await new Promise((resolve, reject) => execFile('pgrep', ['-P', String(pid)], (error, stdout) => error && error.code !== 1 ? reject(error) : resolve(stdout)))).trim().split('\n').filter(Boolean).map(Number);
const absent = async (pids) => { const inactive = (pid) => readFile(`/proc/${pid}/stat`, 'utf8').then((stat) => stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z '), () => true); for (let attempt = 0; attempt < 160; attempt += 1) { if ((await Promise.all(pids.map(inactive))).every(Boolean)) return; await new Promise((resolve) => setTimeout(resolve, 250)); } assert.fail(`fixture processes remained active: ${pids.join(',')}`); };
const provision = async (fixtureId) => { const session = start(); const response = await session.request({ schema: 'w-reference-fixture/v1', action: 'provision', fixture_id: fixtureId }); assert.equal(response.action, 'provisioned'); return { ...session, provisioned: response }; };
try {
    const fixtureId = 'fixture_contract_1'; const session = await provision(fixtureId); const { provisioned } = session;
    assert.equal(provisioned.action, 'provisioned'); assert.equal(provisioned.fixture_id, fixtureId); assert.equal(provisioned.component_provenance['w-id'], pins['w-id']); assert.equal(provisioned.lease_id, undefined);
    const backupUrl = new URL('/v1/projects/target/database/backups', provisioned.project_url);
    const preflightHeaders = { Origin: 'http://127.0.0.1:4174', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,idempotency-key' };
    const preflight = await fetch(backupUrl, { method: 'OPTIONS', headers: preflightHeaders });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), preflightHeaders.Origin);
    assert.ok(preflight.headers.get('access-control-allow-headers').split(',').includes('idempotency-key'));
    const headPreflight = await fetch(backupUrl, { method: 'OPTIONS', headers: { ...preflightHeaders, 'Access-Control-Request-Method': 'HEAD', 'Access-Control-Request-Headers': 'authorization,apikey,prefer' } });
    assert.equal(headPreflight.status, 204);
    assert.ok(headPreflight.headers.get('access-control-allow-methods').split(',').includes('HEAD'));
    assert.ok(headPreflight.headers.get('access-control-allow-headers').split(',').includes('prefer'));
    const foreignPreflight = await fetch(backupUrl, { method: 'OPTIONS', headers: { ...preflightHeaders, Origin: 'http://127.0.0.1:4999' } });
    assert.equal(foreignPreflight.headers.get('access-control-allow-origin'), null);
    const authBase = new URL('/auth/v1/', provisioned.project_url);
    const authHeaders = { apikey: provisioned.publishable_key, Authorization: 'Bearer fixture-user-token', 'Content-Type': 'application/json', Origin: preflightHeaders.Origin };
    const authUser = await fetch(new URL('user', authBase), { headers: authHeaders });
    assert.equal(authUser.status, 200);
    assert.equal(authUser.headers.get('access-control-allow-origin'), preflightHeaders.Origin);
    assert.deepEqual(await authUser.json(), { upstream: 'w-id-auth', path: '/auth/v1/user', method: 'GET', apikey: authHeaders.apikey, authorization: authHeaders.Authorization, body: '' });
    const tokenBody = JSON.stringify({ email: 'fixture@example.test', password: 'example-password' });
    const authToken = await fetch(new URL('token?grant_type=password', authBase), { method: 'POST', headers: authHeaders, body: tokenBody });
    assert.equal(authToken.status, 200);
    assert.deepEqual(await authToken.json(), { upstream: 'w-id-auth', path: '/auth/v1/token?grant_type=password', method: 'POST', apikey: authHeaders.apikey, authorization: authHeaders.Authorization, body: tokenBody });
    const authSignup = await fetch(new URL('signup', authBase), { method: 'POST', headers: authHeaders, body: tokenBody });
    assert.equal(authSignup.status, 201);
    assert.equal((await authSignup.json()).upstream, 'w-id-auth');
    const verifyBody = JSON.stringify({ email: 'fixture@example.test', token: '123456', type: 'signup' });
    const authVerify = await fetch(new URL('verify', authBase), { method: 'POST', headers: authHeaders, body: verifyBody });
    assert.equal(authVerify.status, 200);
    assert.deepEqual(await authVerify.json(), { upstream: 'w-id-auth', path: '/auth/v1/verify', method: 'POST', apikey: authHeaders.apikey, authorization: authHeaders.Authorization, body: verifyBody });
    const authLogout = await fetch(new URL('logout?scope=local', authBase), { method: 'POST', headers: authHeaders });
    assert.equal((await authLogout.json()).path, '/auth/v1/logout?scope=local');
    const authPreflight = await fetch(new URL('token', authBase), { method: 'OPTIONS', headers: { ...preflightHeaders, 'Access-Control-Request-Headers': 'authorization,apikey,x-supabase-api-version' } });
    assert.equal(authPreflight.status, 204);
    assert.ok(authPreflight.headers.get('access-control-allow-headers').split(',').includes('x-supabase-api-version'));
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.context().grantPermissions(['local-network-access'], { origin: preflightHeaders.Origin });
        await page.route(`${preflightHeaders.Origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Auth transport</body></html>' }));
        await page.goto(preflightHeaders.Origin);
        const signup = await page.evaluate(async ({ url, headers, body }) => {
            const response = await fetch(url, { method: 'POST', headers, body });
            return { status: response.status, data: await response.json() };
        }, { url: new URL('signup', authBase).href, headers: { apikey: authHeaders.apikey, Authorization: authHeaders.Authorization, 'Content-Type': 'application/json', 'X-Client-Info': 'supabase-js-fixture', 'X-Supabase-Api-Version': '2024-01-01' }, body: tokenBody });
        assert.equal(signup.status, 201);
        assert.equal(signup.data.upstream, 'w-id-auth');
    } finally { await browser.close(); }
    for (let i = 0; i < 100 && !session.privateResponses.length; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(session.privateResponses[0].schema, 'w-reference-fixture-private/v2'); assert.equal(session.privateResponses[0].actors.platform_admin.membership_active, false); assert.equal(session.privateResponses[0].fresh_browser.actor, 'fresh_browser'); assert.match(session.privateResponses[0].otp_socket_path, /^\/tmp\/w-reference-identity-otp-[A-Za-z0-9]+\/verification\.sock$/);
    const cleaned = await session.request({ schema: 'w-reference-fixture/v1', action: 'cleanup', fixture_id: fixtureId });
    assert.deepEqual(cleaned.deleted, { keys: true, resources: true, projects: true, workspaces: true, accounts: true });
    const normalPids = await childPids(session.child.pid); session.child.stdin.end(); assert.equal(await exit(session.child), 0); await absent(normalPids);
    const invalid = start(); invalid.child.stdin.end(`${JSON.stringify({ schema: 'w-reference-fixture/v1', action: 'provision' })}\n`); assert.notEqual(await exit(invalid.child), 0);
    const terminated = await provision('fixture_contract_term'); const termPids = await childPids(terminated.child.pid); terminated.child.kill('SIGTERM'); assert.notEqual(await exit(terminated.child), 0); await absent(termPids);
    const killed = await provision('fixture_contract_kill'); const killPids = await childPids(killed.child.pid); killed.child.kill('SIGKILL'); assert.notEqual(await exit(killed.child), 0); await absent(killPids);
    process.stdout.write('Reference fixture adapter normal/failure/SIGTERM/SIGKILL lifecycle contract OK.\n');
} finally { await rm(directory, { recursive: true, force: true }); }
