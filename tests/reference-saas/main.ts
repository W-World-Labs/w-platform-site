import { createClient } from '@supabase/supabase-js';
import { BrowserAuthError, createWClient } from '@w-id/browser';
import './style.css';

const projectUrl = import.meta.env.VITE_W_PROJECT_URL as string | undefined;
const identityUrl = import.meta.env.VITE_W_ID_URL as string | undefined;
const redirectUri = import.meta.env.VITE_W_REDIRECT_URI as string | undefined;
const publishableKey = import.meta.env.VITE_W_PUBLISHABLE_KEY as string | undefined;
const readOnlyPublishableKey = import.meta.env.VITE_W_READ_ONLY_PUBLISHABLE_KEY as string | undefined;
const revokedPublishableKey = import.meta.env.VITE_W_REVOKED_PUBLISHABLE_KEY as string | undefined;
if (!projectUrl || !identityUrl || !redirectUri || !publishableKey || !publishableKey.startsWith('wid_pk_')) throw new Error('reference_project_connect_required');
const projectOrigin = new URL(projectUrl).origin;

class ReferenceWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols ?? []);
    this.addEventListener('close', (event) => {
      const reason = /^[a-z0-9_]{1,64}$/.test(event.reason) ? event.reason : 'unspecified';
      console.info(`REFERENCE_REALTIME=socket-close-${event.code}-${reason}`);
    });
  }
}

const w = createWClient({ projectUrl, publishableKey, ssoUrl: identityUrl, redirectUri, scopes: ['openid', 'profile'], cacheLocation: 'memory' });
// W-ID owns Auth at /auth/v1; W-DB owns the project-scoped data routes.
const supabaseFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const authPrefix = `${new URL(projectUrl).pathname.replace(/\/$/, '')}/auth/v1/`;
    if (url.origin === projectOrigin && url.pathname.startsWith(authPrefix)) {
        url.pathname = `/auth/v1/${url.pathname.slice(authPrefix.length)}`;
        input = url;
    }
    const response = await fetch(input, init);
    const operation = url.pathname.match(/^\/auth\/v1\/(signup|verify|token|user|logout)$/)?.[1];
    if (operation && !response.ok) {
        const body = await response.clone().json().catch(() => null) as { error_code?: unknown; code?: unknown } | null;
        const value = body?.error_code ?? body?.code;
        const code = typeof value === 'string' && /^[a-z0-9_-]{1,64}$/.test(value) ? value : 'unknown';
        console.info(`REFERENCE_SUPABASE_AUTH=${operation}-status-${response.status}-code-${code}`);
    }
    return response;
};
const supabase = createClient(projectUrl, publishableKey, { auth: { persistSession: false, detectSessionInUrl: false }, global: { fetch: supabaseFetch } });
const supabaseForToken = (token: string) => createClient(projectUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } }, realtime: { transport: ReferenceWebSocket } });
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `<header><p data-i18n="brand">W Reference SaaS</p><button id="lang" aria-label="切换语言">中文</button></header><h1 data-i18n="title">Production acceptance</h1><p data-i18n="note">A real PKCE user exercises only this project’s public contract.</p><nav data-i18n-aria="operations" aria-label="Acceptance operations"><button id="login" data-i18n="login">Sign up / sign in</button><button id="crud" data-i18n="crud">Tenant CRUD</button><button id="storage" data-i18n="storage">Private Storage</button><button id="realtime" data-i18n="realtime">Realtime DB changes</button><button id="function" data-i18n="function">Protected Function</button><button id="diagnostics" data-i18n="diagnostics">Radar / Monitor</button><button id="backup" data-i18n="backup">Backup / restore</button><button id="keys" data-i18n="keys">Key revoke / rollback</button></nav><section aria-live="polite" aria-atomic="true"><h2 data-i18n="status">Status</h2><ol id="results"></ol></section>`;

const labels = {
    en: { brand: 'W Reference SaaS', title: 'Production acceptance', note: 'A real PKCE user exercises only this project’s public contract.', operations: 'Acceptance operations', login: 'Sign up / sign in', crud: 'Tenant CRUD', storage: 'Private Storage', realtime: 'Realtime DB changes', function: 'Protected Function', diagnostics: 'Radar / Monitor', backup: 'Backup / restore', keys: 'Key revoke / rollback', status: 'Status', running: 'running', passed: 'passed', failed: 'failed', 'tenant-crud': 'Tenant CRUD', 'private-storage': 'Private Storage', 'realtime-db-change': 'Realtime DB changes', 'protected-function': 'Protected Function', 'backup-restore': 'Backup / restore', 'key-revoke-rollback': 'Key revoke / rollback' },
    zh: { brand: 'W 参考 SaaS', title: '生产验收', note: '真实 PKCE 用户仅通过当前项目公开合同完成验收。', operations: '验收操作', login: '注册 / 登录', crud: '租户数据增删改查', storage: '私有存储', realtime: '实时数据库变更', function: '受保护函数', diagnostics: 'Radar / Monitor 可观测性', backup: '备份 / 恢复', keys: '密钥轮换 / 撤销', status: '状态', running: '运行中', passed: '已通过', failed: '失败', 'tenant-crud': '租户数据增删改查', 'private-storage': '私有存储', 'realtime-db-change': '实时数据库变更', 'protected-function': '受保护函数', 'backup-restore': '备份 / 恢复', 'key-revoke-rollback': '密钥轮换 / 撤销' },
};
let language: keyof typeof labels = 'en';
let lastTraceMarker: string | undefined;
let lastTraceStartedAt: number | undefined;
const status = (name: string, state: 'running' | 'passed' | 'failed', detail = '') => { const old = root.querySelector(`[data-result="${name}"]`); old?.remove(); const li = document.createElement('li'); li.dataset.result = name; li.dataset.state = state; li.dataset.detail = detail.slice(0, 160); li.textContent = `${labels[language][name as keyof typeof labels.en] || name}: ${labels[language][state]}${detail ? ` — ${detail.slice(0, 160)}` : ''}`; root.querySelector('#results')!.append(li); };
const run = async (name: string, operation: () => Promise<void>) => { status(name, 'running'); try { await operation(); status(name, 'passed'); } catch (error) { status(name, 'failed', error instanceof Error ? error.message : 'unknown'); throw error; } };
const storageFailure = (step: 'bucket-create' | 'upload' | 'sign' | 'signed-download' | 'download' | 'remove' | 'bucket-delete', error: unknown) => { const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}; const status = Number.isInteger(value.status) && Number(value.status) >= 100 && Number(value.status) <= 599 ? Number(value.status) : 0; const statusCode = String(value.statusCode || '').toLowerCase(); const message = error instanceof Error ? error.message.toLowerCase() : ''; const candidate = statusCode && !/^[1-5][0-9]{2}$/.test(statusCode) ? statusCode : message; const code = /^[a-z0-9_-]{1,64}$/.test(candidate) ? candidate : 'unknown'; console.info(`REFERENCE_STORAGE=${step}-status-${status}-code-${code}`); return error instanceof Error ? error : new Error(`storage ${step} failed`); };
const projectId = new URL(projectUrl).pathname.split('/').filter(Boolean).at(-1)!;
async function projectManagement() { const token = await w.auth.getToken({ silent: false }); const headers = new Headers({ Authorization: `Bearer ${token}`, apikey: publishableKey!, Accept: 'application/json' }); const url = `${projectOrigin}/v1/projects/${encodeURIComponent(projectId)}/discovery`; const response = await fetch(url, { headers }); if (!response.ok) throw new Error('management discovery denied'); const discovery = await response.json() as { schema_version: string; workspace_id: string; project_id: string; radar_project_id: string; links: Record<string, string>; capabilities: { functions?: Record<string, unknown>; storage?: Record<string, unknown>; database_backups?: Record<string, unknown>; observability?: Record<string, unknown> }; function_deployments_url?: string }; if (discovery.schema_version !== 'w-platform.project/v1' || discovery.project_id !== projectId || !discovery.workspace_id || !discovery.radar_project_id) throw new Error('management discovery identity mismatch'); return { token, headers, discovery }; }
type DiagnosticsPlane = "functions" | "radar" | "monitor";
type ManagementDiscovery = Awaited<ReturnType<typeof projectManagement>>["discovery"];
const diagnosticsStage = (stage: string) => console.info(`REFERENCE_DIAGNOSTICS=${stage}`);
const backupStage = (stage: string) => console.info(`REFERENCE_BACKUP=${stage}`);
const keyStage = (stage: string) => console.info(`REFERENCE_KEYS=${stage}`);

function recentDiagnosticsTimestamp(value: unknown) {
    if (typeof value !== "string" || !lastTraceStartedAt) return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= lastTraceStartedAt - 5_000 && timestamp <= Date.now() + 5_000;
}

function exactDiagnosticsEvidence(plane: DiagnosticsPlane, body: unknown, discovery: ManagementDiscovery) {
    if (!body || typeof body !== "object") return false;
    const value = body as Record<string, unknown>;
    if (plane === "functions") {
        const logs = value.logs;
        return value.schema_version === "w-db.function-logs/v1"
            && value.project_id === projectId
            && value.function_slug === "reference-acceptance"
            && Array.isArray(logs)
            && logs.some((item) => {
                const log = item as Record<string, unknown>;
                return log.marker === lastTraceMarker
                    && log.state === "succeeded"
                    && recentDiagnosticsTimestamp(log.occurred_at);
            });
    }
    if (plane === "radar") {
        const logs = value.logs;
        return value.schema_version === "w-radar.project-logs/v1"
            && value.project_id === discovery.radar_project_id
            && Array.isArray(logs)
            && logs.some((item) => {
                const log = item as Record<string, unknown>;
                return log.trace_id === lastTraceMarker && recentDiagnosticsTimestamp(log.timestamp);
            });
    }
    const summary = value.summary as Record<string, unknown> | undefined;
    const nodes = value.nodes;
    return value.schema_version === "w.monitor.project-health.v1"
        && value.workspace_id === discovery.workspace_id
        && value.project_id === projectId
        && !!summary
        && Number(summary.nodes) > 0
        && Number(summary.offline) === 0
        && Array.isArray(nodes)
        && nodes.length === Number(summary.nodes)
        && nodes.every((item) => {
            const node = item as Record<string, unknown>;
            const checked = Date.parse(String(node.latest_check_at || ""));
            return node.status === "healthy"
                && Number.isFinite(checked)
                && checked >= Date.now() - 600_000
                && checked <= Date.now() + 5_000;
        });
}

async function pollDiagnostics(url: string, plane: DiagnosticsPlane, headers: Headers, discovery: ManagementDiscovery) {
    const deadline = Date.now() + 30_000;
    let lastStatus = 0;
    let reportedStatus = 0;
    do {
        let response: Response;
        try {
            const requestUrl = new URL(url);
            if (plane === "functions") requestUrl.searchParams.set("project_id", projectId);
            if (plane !== "monitor") requestUrl.searchParams.set("trace_id", lastTraceMarker!);
            const requestHeaders = new Headers(headers);
            if (plane !== "functions") requestHeaders.delete("apikey");
            response = await fetch(requestUrl, { headers: requestHeaders, signal: AbortSignal.timeout(3_000) });
        } catch {
            diagnosticsStage(`${plane}-network`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
        }
        lastStatus = response.status;
        if (!response.ok && response.status !== reportedStatus) {
            reportedStatus = response.status;
            diagnosticsStage(`${plane}-status-${response.status}`);
        }
        if (response.ok) {
            let body: unknown;
            try {
                body = await response.json();
            } catch {
                diagnosticsStage(`${plane}-malformed`);
                throw new Error(`${plane} diagnostics response malformed`);
            }
            if (exactDiagnosticsEvidence(plane, body, discovery)) {
                diagnosticsStage(`${plane}-ok`);
                return;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    } while (Date.now() < deadline);
    diagnosticsStage(`${plane}-timeout-status-${lastStatus}`);
    throw new Error(`exact ${plane} diagnostics evidence timed out`);
}
async function exactJson<T>(url: string, headers: Headers, init: RequestInit = {}, statuses = [200]) { const response = await fetch(url, { ...init, headers: new Headers({ ...Object.fromEntries(headers), ...(init.headers ? Object.fromEntries(new Headers(init.headers)) : {}) }) }); if (!statuses.includes(response.status)) throw new Error(`exact project request rejected: ${response.status}`); return response.status === 204 ? null as T : await response.json() as T; }
async function seedTenantRow() { const title = `alice-${crypto.randomUUID()}`; await w.request('/rest/v1/todos', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title, done: false }) }); return title; }
async function tenantRows() { return w.request<Array<{ title: string }>>('/rest/v1/todos?select=title'); }
async function accessToken() { return w.auth.getToken({ silent: false }); }
async function officialSupabaseSignUp(email: string, password: string) {
    const created = await supabase.auth.signUp({ email, password });
    if (created.error || !created.data.user) throw created.error || new Error('supabase sign-up user missing');
    return { needsVerification: !created.data.session, userId: created.data.user.id };
}
async function officialSupabaseVerify(email: string, code: string) {
    const verified = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (verified.error || !verified.data.session?.access_token) throw verified.error || new Error('supabase verification session missing');
}
async function officialSupabaseTenantRows() {
    const result = await supabase.from('todos').select('title');
    if (result.error) throw result.error;
    return result.data;
}
async function officialSupabaseCrudRls() {
    const title = `supabase-${crypto.randomUUID()}`;
    // Mutation responses use W-DB's supported wildcard; GET still checks column projection.
    const created = await supabase.from('todos').insert({ title, done: false }).select('*').single();
    if (created.error || !created.data?.id || created.data.title !== title) throw created.error || new Error('supabase insert failed');
    const updatedTitle = `${title}-updated`;
    const updated = await supabase.from('todos').update({ title: updatedTitle }).eq('id', created.data.id).select('*').single();
    if (updated.error || updated.data?.title !== updatedTitle) throw updated.error || new Error('supabase update failed');
    const selected = await supabase.from('todos').select('id,title').eq('id', created.data.id).single();
    if (selected.error || selected.data?.title !== updatedTitle) throw selected.error || new Error('supabase select failed');
    const deleted = await supabase.from('todos').delete().eq('id', created.data.id).select('*').single();
    if (deleted.error || deleted.data?.id !== created.data.id) throw deleted.error || new Error('supabase delete failed');
    const absent = await supabase.from('todos').select('id').eq('id', created.data.id);
    if (absent.error || absent.data.length !== 0) throw absent.error || new Error('supabase delete absence failed');
    return { title: updatedTitle, created: true, updated: true, deleted: true };
}
async function officialSupabaseAuthLifecycle(email: string, password: string) {
    const localOut = await supabase.auth.signOut({ scope: 'local' });
    if (localOut.error) throw localOut.error;
    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session?.access_token) throw signedIn.error || new Error('supabase sign-in session missing');
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw refreshed.error || new Error('supabase refresh session missing');
    const current = await supabase.auth.getUser();
    if (current.error || current.data.user?.email !== email) throw current.error || new Error('supabase getUser identity mismatch');
    const signedOut = await supabase.auth.signOut();
    if (signedOut.error) throw signedOut.error;
    return { signedIn: true, refreshed: true, gotUser: true, signedOut: true };
}
async function projectBoundaries(candidateProjectUrl: string, relationship: 'foreign' | 'target-nonmember') {
    const token = await accessToken();
    const foreign = new URL(candidateProjectUrl);
    const foreignProjectId = foreign.pathname.split('/').filter(Boolean).at(-1);
    if (!foreignProjectId || (relationship === 'foreign' && foreignProjectId === projectId) || (relationship === 'target-nonmember' && foreignProjectId !== projectId)) throw new Error('boundary project identity invalid');
    const headers = { apikey: publishableKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const foreignBase = foreign.href.endsWith('/') ? foreign.href : `${foreign.href}/`;
    const probe = (path: string, init: RequestInit = {}) => fetch(new URL(path, foreignBase), { ...init, headers: { ...headers, ...init.headers } }).then((response) => response.status);
    const authResponse = await fetch(`${identityUrl!.replace(/\/$/, '')}/api/projects/${encodeURIComponent(foreignProjectId)}/authorize-user`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    let auth = authResponse.status;
    if (authResponse.ok) {
        const decision = await authResponse.json() as { schema_version?: unknown; project_id?: unknown; active?: unknown; capabilities?: unknown };
        if (decision.schema_version !== '1' || decision.project_id !== foreignProjectId || decision.active !== false || !Array.isArray(decision.capabilities) || decision.capabilities.length) throw new Error('foreign Auth authorization contract did not deny');
        // Formal authorization returns 200 with active=false; normalize the denial like the runner.
        auth = 403;
    }
    const restRead = await probe('rest/v1/todos?select=id&limit=1');
    const restWrite = await probe('rest/v1/todos', { method: 'POST', body: JSON.stringify({ title: 'foreign-must-deny', done: false }) });
    const storageRead = await probe('storage/v1/object/list/reference-private', { method: 'POST', body: JSON.stringify({ prefix: '' }) });
    const storageWrite = await probe('storage/v1/object/reference-private/foreign-must-deny.txt', { method: 'POST', body: 'deny' });
    const storageSigned = await probe('storage/v1/object/sign/reference-private/foreign-must-deny.txt', { method: 'POST', body: JSON.stringify({ expiresIn: 60 }) });
    const functions = await probe('functions/v1/reference-acceptance', { method: 'POST', body: JSON.stringify({ marker: 'foreign-must-deny' }) });
    const management = await fetch(`${foreign.origin}/v1/projects/${encodeURIComponent(foreignProjectId)}/discovery`, { headers }).then((response) => response.status);
    const foreignSupabase = createClient(candidateProjectUrl, publishableKey!, { auth: { persistSession: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    foreignSupabase.realtime.setAuth(token);
    const realtime = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve('TIMED_OUT'), 10_000);
        const channel = foreignSupabase.channel(`foreign-deny-${crypto.randomUUID()}`, { config: { private: true } }).on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => resolve('EVENT_LEAKED'));
        channel.subscribe((state) => {
            if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') { clearTimeout(timer); resolve(state); }
            if (state === 'SUBSCRIBED') { clearTimeout(timer); resolve('SUBSCRIBED'); }
        });
    });
    return { auth, restRead, restWrite, storageRead, storageWrite, storageSigned, functions, management, realtime };
}
async function foreignProjectBoundaries(foreignProjectUrl: string) { return projectBoundaries(foreignProjectUrl, 'foreign'); }
async function keyBoundaries() {
    if (!readOnlyPublishableKey || !revokedPublishableKey) throw new Error('additive fixture keys required');
    const token = await w.auth.getToken({ silent: false });
    const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const status = async (request: Promise<Response>) => { try { return (await request).status; } catch { return 0; } };
    const read = await status(fetch(`${projectUrl}/rest/v1/todos?select=id&limit=1`, { headers: headers(readOnlyPublishableKey) }));
    const write = await status(fetch(`${projectUrl}/rest/v1/todos`, { method: 'POST', headers: headers(readOnlyPublishableKey), body: JSON.stringify({ title: 'must-not-write', done: false }) }));
    const revoked = await status(fetch(`${projectOrigin}/v1/projects/${encodeURIComponent(projectId)}/discovery`, { headers: headers(revokedPublishableKey) }));
    return { read, write, revoked };
}
async function backupLifecycle() {
    backupStage('management-start');
    const { headers, discovery } = await projectManagement();
    const actor = await w.auth.getUser();
    const base = discovery.links.database_backups;
    const capability = discovery.capabilities.database_backups;
    if (!base || new URL(base).pathname !== `/v1/projects/${encodeURIComponent(projectId)}/database/backups` || capability?.create !== true || capability.restore !== true || capability.rollback !== true || capability.audit !== true || capability.download !== true) throw new Error('backup capability unavailable');
    backupStage('inventory-start');
    const inventory = await exactJson<{ schema_version: string; project_id: string; resource_id: string; usage: { items: number; maximum_items: number; quota_exceeded: boolean } }>(base, headers);
    if (inventory.schema_version !== 'w-db.backup-inventory/v1' || inventory.project_id !== projectId || !inventory.resource_id || !Number.isInteger(inventory.usage.maximum_items) || inventory.usage.maximum_items < 1 || inventory.usage.maximum_items > 100 || !Number.isInteger(inventory.usage.items) || inventory.usage.items < 0 || inventory.usage.items >= inventory.usage.maximum_items || inventory.usage.quota_exceeded) throw new Error('fixture backup quota contract unavailable');
    backupStage('inventory-ok');
    const beforeMarker = `before-backup-${crypto.randomUUID()}`;
    const afterMarker = `after-backup-${crypto.randomUUID()}`;
    await w.request('/rest/v1/todos', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title: beforeMarker, done: false }) });
    backupStage('create-start');
    const created = await exactJson<{ backup: { backup_id: string; resource_id: string; state: string } }>(base, headers, { method: 'POST', headers: { 'idempotency-key': `reference-create-${crypto.randomUUID()}` } }, [202]);
    let backup = created.backup;
    const deadline = Date.now() + 30_000;
    while (!['available', 'failed'].includes(backup.state)) {
        if (Date.now() >= deadline) throw new Error('backup readiness timed out');
        await new Promise((resolve) => setTimeout(resolve, 250));
        backup = (await exactJson<{ backup: typeof backup }>(`${base}/${encodeURIComponent(backup.backup_id)}`, headers)).backup;
    }
    if (backup.state !== 'available' || backup.resource_id !== inventory.resource_id) throw new Error('backup creation failed');
    backupStage('create-ok');
    await w.request('/rest/v1/todos', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title: afterMarker, done: false }) });
    const downloaded = await fetch(`${base}/${encodeURIComponent(backup.backup_id)}/download`, { headers });
    if (!downloaded.ok || !(await downloaded.arrayBuffer()).byteLength) throw new Error('backup download failed');
    backupStage('download-ok');
    backupStage('preview-start');
    const preview = await exactJson<{ schema_version: string; confirmation: string; preview: { backup: { backup_id: string; resource_id: string }; current_resource_id: string; destructive: boolean; rollback_supported: boolean } }>(`${base}/${encodeURIComponent(backup.backup_id)}/restore/preview`, headers, { method: 'POST' });
    if (preview.schema_version !== 'w-db.restore-preview/v1' || preview.confirmation !== 'RESTORE' || preview.preview.backup.backup_id !== backup.backup_id || preview.preview.backup.resource_id !== backup.resource_id || preview.preview.current_resource_id !== backup.resource_id || preview.preview.destructive !== true || preview.preview.rollback_supported !== true) throw new Error('restore preview mismatch');
    backupStage('preview-ok');
    backupStage('restore-start');
    const restored = await exactJson<{ schema_version: string; project_id: string; operation: { operation_id: string; resource_id: string; backup_id: string; state: string } }>(`${base}/${encodeURIComponent(backup.backup_id)}/restore`, headers, { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': `reference-restore-${crypto.randomUUID()}` }, body: JSON.stringify({ confirmation: 'RESTORE', project_id: projectId, resource_id: backup.resource_id, backup_id: backup.backup_id }) }, [202]);
    if (restored.schema_version !== 'w-db.restore-operation/v1' || restored.project_id !== projectId || restored.operation.backup_id !== backup.backup_id || restored.operation.resource_id !== backup.resource_id || restored.operation.state !== 'succeeded') throw new Error('restore did not succeed');
    backupStage('restore-ok');
    const afterRestore = await tenantRows();
    if (!afterRestore.some((row) => row.title === beforeMarker) || afterRestore.some((row) => row.title === afterMarker)) throw new Error('restore row semantics mismatch');
    const rollbackUrl = `${new URL(base).origin}/v1/projects/${encodeURIComponent(projectId)}/database/restores/${encodeURIComponent(restored.operation.operation_id)}/rollback`;
    backupStage('rollback-start');
    const rolledBack = await exactJson<{ operation: { operation_id: string; state: string } }>(rollbackUrl, headers, { method: 'POST' });
    if (rolledBack.operation.operation_id !== restored.operation.operation_id || rolledBack.operation.state !== 'rolled_back') throw new Error('backup rollback state mismatch');
    backupStage('rollback-ok');
    const afterRollback = await tenantRows();
    if (!afterRollback.some((row) => row.title === beforeMarker) || !afterRollback.some((row) => row.title === afterMarker)) throw new Error('rollback row semantics mismatch');
    backupStage('audit-start');
    // Check the exact objects before quota filling can evict them from this bounded timeline.
    const audit = await exactJson<{ schema_version: string; bounded: boolean; events: Array<{ event_kind: string; object_id: string; state: string; actor_id?: string | null }> }>(`${base}/audit?limit=50`, headers);
    if (audit.schema_version !== 'w-db.backup-audit/v1' || audit.bounded !== true || audit.events.length > 50) throw new Error('backup audit identity mismatch');
    const exact = (kind: string, objectId: string, state?: string) => audit.events.some((event) => event.event_kind === kind && event.object_id === objectId && (!state || event.state === state) && event.actor_id === actor.sub);
    if (!audit.events.some((event) => event.event_kind === 'backup.recorded' && event.object_id === backup.backup_id && event.state === 'available') || !exact('backup.created', backup.backup_id, 'succeeded') || !exact('restore.executed', restored.operation.operation_id, 'rolled_back')) throw new Error('backup audit actor/object evidence missing');
    backupStage('audit-ok');
    backupStage('quota-start');
    for (let index = inventory.usage.items + 1; index < inventory.usage.maximum_items; index += 1) await exactJson(base, headers, { method: 'POST', headers: { 'idempotency-key': `reference-quota-${index}-${crypto.randomUUID()}` } }, [202]);
    const quota = await fetch(base, { method: 'POST', headers: new Headers({ ...Object.fromEntries(headers), 'idempotency-key': `reference-quota-deny-${crypto.randomUUID()}` }) });
    if (quota.status !== 429) throw new Error(`backup quota did not fail closed: ${quota.status}`);
    backupStage('quota-ok');
}
Object.assign(globalThis, { referenceAcceptance: { seedTenantRow, tenantRows, accessToken, officialSupabaseSignUp, officialSupabaseVerify, officialSupabaseTenantRows, officialSupabaseCrudRls, officialSupabaseAuthLifecycle, foreignProjectBoundaries, keyBoundaries, membershipDiscoveryProbe: async () => { const token = await w.auth.getToken({ silent: false }); const response = await fetch(`${projectUrl}/.well-known/w-project`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` } }); if (!response.ok) return { status: response.status, schema: false, project: false, url: false }; const discovery = await response.json() as { schema_version?: unknown; project_id?: unknown; project_url?: unknown }; return { status: response.status, schema: discovery.schema_version === '1', project: discovery.project_id === projectId, url: typeof discovery.project_url === 'string' && new URL(discovery.project_url).href.replace(/\/$/, '') === new URL(projectUrl).href.replace(/\/$/, '') }; }, membershipDiscovery: async () => { const discovery = await w.discovery(); return { project_id: discovery.project_id, workspace_id: discovery.workspace_id }; }, identityUser: async () => { const user = await w.auth.getUser(); if (!user.sub) throw new Error('formal W-ID userinfo contract mismatch'); }, projectAuthorization: async () => { const decision = await w.auth.authorizeProjectUser(projectId); if (decision.active !== true || decision.project_id !== projectId || decision.role !== 'admin' || !decision.capabilities.includes('resources:write') || !decision.capabilities.includes('functions:deploy')) throw new Error('formal W-ID admin contract mismatch'); } } });

root.querySelector('#lang')!.addEventListener('click', () => { language = language === 'en' ? 'zh' : 'en'; document.documentElement.lang = language; for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) { const key = element.dataset.i18n as keyof typeof labels.en; element.textContent = labels[language][key]; } const nav = root.querySelector<HTMLElement>('[data-i18n-aria="operations"]'); if (nav) nav.setAttribute('aria-label', labels[language].operations); for (const result of root.querySelectorAll<HTMLElement>('[data-result]')) { const name = result.dataset.result!; const state = result.dataset.state as 'running' | 'passed' | 'failed'; const detail = result.dataset.detail || ''; result.textContent = `${labels[language][name as keyof typeof labels.en] || name}: ${labels[language][state]}${detail ? ` — ${detail}` : ''}`; } root.querySelector('#lang')!.textContent = language === 'en' ? '中文' : 'EN'; });
root.querySelector('#login')!.addEventListener('click', () => void w.auth.loginWithRedirect({ appState: { reference: true } }));
if (location.pathname === new URL(redirectUri).pathname && location.search.includes('code=')) void w.auth.handleRedirectCallback().then(() => { document.documentElement.dataset.authCallback = 'success'; console.info('REFERENCE_AUTH_CALLBACK=success'); history.replaceState({}, '', '/'); }).catch((error) => { const candidate = error instanceof BrowserAuthError ? error.error : error instanceof TypeError ? 'network_error' : typeof error === 'object' && error ? String(('error' in error && error.error) || ('code' in error && error.code) || '') : ''; const code = /^[a-z0-9_]{1,64}$/.test(candidate) ? candidate : 'unknown'; document.documentElement.dataset.authCallback = `error-${code}`; console.info(`REFERENCE_AUTH_CALLBACK=error-${code}`); });
root.querySelector('#crud')!.addEventListener('click', () => void run('tenant-crud', async () => { const title = crypto.randomUUID(); const created = await w.request<Array<{ id: string }>>('/rest/v1/todos', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title, done: false }) }); const id = created[0]?.id; if (!id) throw new Error('tenant create did not return a row'); await w.request(`/rest/v1/todos?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${title}-updated` }) }); const rows = await w.request<Array<{ id: string; title: string }>>(`/rest/v1/todos?id=eq.${encodeURIComponent(id)}&select=id,title`); if (rows.length !== 1 || rows[0].title !== `${title}-updated`) throw new Error('tenant update was not isolated'); await w.request(`/rest/v1/todos?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); }));
root.querySelector('#storage')!.addEventListener('click', () => void run('private-storage', async () => { const token = await w.auth.getToken({ silent: false }); const supabase = supabaseForToken(token); const bucketName = `reference-${crypto.randomUUID()}`; const createdBucket = await supabase.storage.createBucket(bucketName, { public: false, fileSizeLimit: 1_048_576, allowedMimeTypes: ['text/plain'] }); if (createdBucket.error) throw storageFailure('bucket-create', createdBucket.error); const path = `acceptance/${crypto.randomUUID()}.txt`; const expected = `reference-${crypto.randomUUID()}`; const bucket = supabase.storage.from(bucketName); const uploaded = await bucket.upload(path, new Blob([expected], { type: 'text/plain' })); if (uploaded.error) throw storageFailure('upload', uploaded.error); const signed = await bucket.createSignedUrl(path, 60); if (signed.error || !signed.data.signedUrl) throw storageFailure('sign', signed.error || new Error('signed URL missing')); const signedResponse = await fetch(new URL(signed.data.signedUrl, projectOrigin)); if (!signedResponse.ok) throw storageFailure('signed-download', { status: signedResponse.status, statusCode: 'http' }); if (await signedResponse.text() !== expected) throw storageFailure('signed-download', new Error('signed private download mismatch')); const downloaded = await bucket.download(path); if (downloaded.error) throw storageFailure('download', downloaded.error); if (await downloaded.data.text() !== expected) throw storageFailure('download', new Error('authenticated private download mismatch')); const removed = await bucket.remove([path]); if (removed.error) throw storageFailure('remove', removed.error); const deletedBucket = await supabase.storage.deleteBucket(bucketName); if (deletedBucket.error) throw storageFailure('bucket-delete', deletedBucket.error); }));
root.querySelector('#realtime')!.addEventListener('click', () => void run('realtime-db-change', async () => {
  const token = await w.auth.getToken({ silent: false });
  const supabase = supabaseForToken(token);
  await supabase.realtime.setAuth(token);
  const marker = `realtime-${crypto.randomUUID()}`;
  const events = new Set<string>();
  const realtimeStage = (stage: string) => console.info(`REFERENCE_REALTIME=${stage}`);
  let receive!: () => void;
  let rejectReceive!: (reason?: unknown) => void;
  const received = new Promise<void>((resolve, reject) => { receive = resolve; rejectReceive = reject; });
  const channel = supabase
    .channel(`reference-${crypto.randomUUID()}`, { config: { private: true } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
      const row = { ...(payload.new as Record<string, unknown>), ...(payload.old as Record<string, unknown>) };
      if (!String(row.title || '').startsWith(marker)) return;
      events.add(payload.eventType);
      realtimeStage(`event-${payload.eventType.toLowerCase()}`);
      if (['INSERT', 'UPDATE', 'DELETE'].every((event) => events.has(event))) receive();
    });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        realtimeStage('subscribe-timed_out');
        reject(new Error('realtime_subscribe_timeout'));
      }, 10_000);
      channel.subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          clearTimeout(timer);
          realtimeStage('subscribe-subscribed');
          resolve();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          clearTimeout(timer);
          if (state !== 'CLOSED') realtimeStage(`subscribe-${state.toLowerCase()}`);
          reject(new Error(`realtime_subscribe_${state.toLowerCase()}`));
        }
      });
    });
    const created = await supabase.from('todos').insert({ title: marker, done: false }).select('*').single();
    if (created.error) {
      realtimeStage('insert-error');
      throw created.error;
    }
    if (!created.data?.id) {
      realtimeStage('insert-missing-row');
      throw new Error('realtime insert did not return a row');
    }
    realtimeStage('insert-ok');
    const updated = await supabase.from('todos').update({ title: `${marker}-updated` }).eq('id', created.data.id);
    realtimeStage(`update-${updated.error ? 'error' : 'ok'}`);
    if (updated.error) throw updated.error;
    const deleted = await supabase.from('todos').delete().eq('id', created.data.id);
    realtimeStage(`delete-${deleted.error ? 'error' : 'ok'}`);
    if (deleted.error) throw deleted.error;
    const eventTimer = setTimeout(() => {
      realtimeStage('event-timeout');
      rejectReceive(new Error('realtime_event_timeout'));
    }, 10_000);
    try {
      await received;
    } finally {
      clearTimeout(eventTimer);
    }
    if (!['INSERT', 'UPDATE', 'DELETE'].every((event) => events.has(event))) throw new Error('realtime authorized I/U/D events missing');
  } finally {
    await supabase.removeChannel(channel);
  }
}));
root.querySelector('#function')!.addEventListener('click', () => void run('protected-function', async () => { const token = await w.auth.getToken({ silent: false }); const supabase = supabaseForToken(token); lastTraceMarker = `reference-trace-${crypto.randomUUID()}`; lastTraceStartedAt = Date.now(); const invocation = await supabase.functions.invoke('reference-acceptance', { body: { marker: lastTraceMarker }, headers: { 'x-w-trace-marker': lastTraceMarker } }); if (invocation.error) throw invocation.error; const result = invocation.data as { ok?: boolean; marker?: string }; if (result.ok !== true || result.marker !== lastTraceMarker) throw new Error('protected function response mismatch'); }));
root.querySelector("#diagnostics")!.addEventListener("click", () => void run("diagnostics", async () => {
    if (!lastTraceMarker || !lastTraceStartedAt) {
        diagnosticsStage("trace-marker-missing");
        throw new Error("trace marker unavailable");
    }
    const { headers, discovery } = await projectManagement();
    diagnosticsStage("discovery-ok");
    const diagnostics = discovery.capabilities.observability as {
        radar_url?: string;
        monitor_url?: string;
        function_logs_url?: string;
    } | undefined;
    if (!diagnostics?.radar_url || !diagnostics.monitor_url || !diagnostics.function_logs_url) {
        diagnosticsStage("discovery-missing");
        throw new Error("diagnostics_discovery_required");
    }
    diagnosticsStage("discovery-complete");
    await pollDiagnostics(diagnostics.function_logs_url, "functions", headers, discovery);
    await pollDiagnostics(diagnostics.radar_url, "radar", headers, discovery);
    await pollDiagnostics(diagnostics.monitor_url, "monitor", headers, discovery);
}));
root.querySelector('#backup')!.addEventListener('click', () => void run('backup-restore', backupLifecycle));
root.querySelector('#keys')!.addEventListener('click', () => void run('key-revoke-rollback', async () => {
    const token = await w.auth.getToken({ silent: false });
    const discovery = await w.discovery();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const keyUrl = `/api/workspaces/${encodeURIComponent(discovery.workspace_id)}/projects/${encodeURIComponent(projectId)}/keys`;
    keyStage('create-start');
    const createResponse = await fetch(keyUrl, { method: 'POST', credentials: 'omit', headers, body: JSON.stringify({ name: 'reference rollback', kind: 'publishable', scopes: ['auth:use', 'data:read'], allowed_origins: [location.origin], expires_at: Math.floor(Date.now() / 1000) + 900 }) });
    if (!createResponse.ok) { keyStage(`create-status-${createResponse.status}`); throw new Error('key_create_failed'); }
    const created = await createResponse.json() as { key: string; data: { id: string } };
    if (!/^wid_pk_/.test(created.key)) throw new Error('created key missing');
    keyStage('create-ok');
    keyStage('rotate-start');
    const rotateResponse = await fetch(`${keyUrl}/${encodeURIComponent(created.data.id)}/rotate`, { method: 'POST', credentials: 'omit', headers, body: JSON.stringify({ overlap_seconds: 0 }) });
    if (!rotateResponse.ok) { keyStage(`rotate-status-${rotateResponse.status}`); throw new Error('key_rotate_failed'); }
    const rotated = await rotateResponse.json() as { key: string; data: { id: string } };
    if (!/^wid_pk_/.test(rotated.key) || rotated.key === created.key) throw new Error('rotated key state invalid');
    keyStage('rotate-ok');
    const probe = (key: string) => fetch(`${projectOrigin}/v1/projects/${encodeURIComponent(projectId)}/discovery`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    keyStage('rotation-probe-start');
    const oldAfterRotate = await probe(created.key);
    if (![401, 403].includes(oldAfterRotate.status)) throw new Error('rotated old key remained active');
    if (!(await probe(rotated.key)).ok) throw new Error('rotated new key inactive');
    keyStage('rotation-probe-ok');
    keyStage('revoke-start');
    const revoked = await fetch(`${keyUrl}/${encodeURIComponent(rotated.data.id)}/revoke`, { method: 'POST', credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });
    if (!revoked.ok) { keyStage(`revoke-status-${revoked.status}`); throw new Error('key_revoke_failed'); }
    keyStage('revoke-ok');
    keyStage('revocation-probe-start');
    // W-DB documents a 15-second authorization-cache revocation bound.
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    if (![401, 403].includes((await probe(rotated.key)).status) || ![401, 403].includes((await probe(created.key)).status)) throw new Error('key rollback/revoke boundary failed');
    keyStage('revocation-probe-ok');
}));
