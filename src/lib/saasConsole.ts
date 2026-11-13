import { parseProjectTablePublication, projectTablePublicationMatches, validProjectTablePublicationInput, type ProjectTablePublication, type ProjectTablePublicationInput } from './projectTablePublication';
import { parseProjectTableRealtime, type ProjectTableRealtime } from './projectTableRealtime';
import { encodeProjectTableIdentifier, validProjectTableIdentifier } from './projectTableDefinition';
import { projectTableQueryParams, type ProjectTableQuery } from './projectTableQuery';

export interface WorkspaceMembership {
  id: string;
  name: string;
  workspace_type?: string;
  workspaceType?: string;
  role: string;
  tier: string;
}

export interface ConsoleProject {
  id: string;
  workspaceId: string;
  name: string;
  radarProjectId?: string | null;
  workspaceRole: string;
  lifecycleStatus?: "active" | "archived";
}

export interface AppRelationship {
  clientId: string;
  name: string;
  publicUrl?: string | null;
  loginCount: number;
  lastSeenAt: number;
  status: string;
}

export interface SaasContext {
  schemaVersion: number;
  self: { userId: string };
  authorityPlanes: {
    platformRole: string;
    workspaceMemberships: WorkspaceMembership[];
    appUserRelationships: AppRelationship[];
  };
  console: { projects: ConsoleProject[] };
}

export type ConsoleLoadResult =
  | { status: 'ready'; context: SaasContext }
  | { status: 'auth' }
  | { status: 'error' };

export type ProjectCapabilityName = 'Auth' | 'Database' | 'Storage' | 'Functions';
export type UnifiedConsoleSurface = 'workspaceTeam' | 'functionsManagement' | 'storageVersions';
export interface UnifiedConsoleSurfaceState { surface: UnifiedConsoleSurface; status: 'edge-route-required'; requiredRoutes: readonly string[]; }
/** Upstream contracts are merged; these same-origin routes are not in W-Edge #11 yet. */
export interface UnifiedManagementData { members: number; invitations: number; functionsReachable: boolean; functions: Array<{ slug: string; state: string; activeVersion: number; logs: Array<{ id: number; event: string; state: string; occurredAt: string }> }>; }
export interface ProjectObservability {
  releases: Array<{ status: string; tag: string; workflow: string; finishedAt: string }>;
  deployments: Array<{ name: string; status: string; provider: string; environment: string; syncedAt: string }>;
  runtime: Array<{ source: string; scannedAt: string }>;
  healthOk: boolean;
  signalCount: number;
  errors: Array<{ layer: string; signalId: string; status: string; consecutiveFails: number; lastRunAt: string }>;
  latency: Array<{ layer: string; signalId: string; latencyMs: number; lastRunAt: string }>;
  errorCount: number;
  latencyCount: number;
  logTotal: number;
  lastLogAt?: string | null;
  radarUrl: string;
  wMonitorUrl: string;
}
/** Matches W-Monitor ONLINE_WINDOW_SECS for host freshness. */
export const MONITOR_FRESHNESS_WINDOW_SECONDS = 300;

export interface ProjectMonitorIncident {
  agentId: string;
  hostname: string;
  state: string;
  severity: string;
  summary: string;
  metric: string;
  checkedAt: number;
}

export interface ProjectMonitorFreshness {
  asOf: string | null;
  staleNodeCount: number;
  status: 'fresh' | 'stale' | 'empty';
  windowSeconds: number;
}

export interface ProjectMonitorHealth {
  summary: { nodes: number; healthy: number; degraded: number; offline: number };
  nodes: Array<{
    agentId: string;
    hostname: string;
    status: 'healthy' | 'degraded' | 'offline';
    latestCheckAt: string;
    latencyMs?: number;
    services: Array<{ name: string; status: string; description?: string }>;
    latestError?: { state: string; severity: string; summary: string; metric: string; checkedAt: number };
    stale: boolean;
  }>;
  incidents: ProjectMonitorIncident[];
  freshness: ProjectMonitorFreshness;
}
export interface ProjectLogEntry { id: string; timestamp: string; level: string; body: string; serviceName: string; traceId?: string; spanId?: string; requestId?: string; attributes: Record<string, string | number | boolean>; }
export interface ProjectLogPage { logs: ProjectLogEntry[]; nextCursor?: string; }
export interface ProjectLogFilters { level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; search?: string; traceId?: string; requestId?: string; from?: string; to?: string; cursor?: string; limit?: number; }
export const PROJECT_LOG_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export interface ProjectFunctionSummary { slug: string; activeVersion: number; auth: 'user' | 'project'; sourceSha256: string; state: string; createdAt: string; activatedAt?: string | null; }
export interface ProjectFunctionVersion { version: number; auth: 'user' | 'project'; sourceSha256: string; state: string; failureCode?: string | null; createdAt: string; activatedAt?: string | null; }
/** Browser-safe audit projection. Runtime bodies/stdout are never stored here. */
export interface ProjectFunctionEvent { id: number; version?: number | null; event: string; state: string; failureCode?: string | null; occurredAt: string; requestId?: string; traceId?: string; }
export interface ProjectFunctionDetail { summary: ProjectFunctionSummary; versions: ProjectFunctionVersion[]; logs: ProjectFunctionEvent[]; nextBeforeId?: number | null; traceId?: string; }
export interface ProjectFunctionAuditFilters { state: string; event: string; requestId: string; from: string; until: string; }

/** Match the loaded audit only; editing these filters never reads another page. */
export function filterProjectFunctionAudit(logs: ProjectFunctionEvent[], filters: ProjectFunctionAuditFilters): ProjectFunctionEvent[] {
  return logs.filter(log => (!filters.state || log.state === filters.state)
    && (!filters.event || log.event.toLowerCase().includes(filters.event.toLowerCase()))
    && (!filters.requestId || log.requestId === filters.requestId || String(log.id) === filters.requestId)
    && (!filters.from || Date.parse(log.occurredAt) >= Date.parse(filters.from))
    && (!filters.until || Date.parse(log.occurredAt) <= Date.parse(filters.until)));
}

/** Project only audit metadata, retaining the applied server trace and loaded-page boundary. */
export function serializeProjectFunctionAudit(context: SaasContext, projectId: string, detail: ProjectFunctionDetail, filters: ProjectFunctionAuditFilters, format: 'json' | 'csv'): string {
  if (!memberProject(context, projectId) || !safePathSegment(detail.summary.slug) || !['json', 'csv'].includes(format)
    || detail.logs.length > 200 || new Set(detail.logs.map(log => log.id)).size !== detail.logs.length
    || (detail.traceId !== undefined && !validProjectFunctionTraceId(detail.traceId))
    || (detail.nextBeforeId != null && (!Number.isSafeInteger(detail.nextBeforeId) || detail.nextBeforeId < 1))
    || [filters.state, filters.event, filters.requestId, filters.from, filters.until].some(value => typeof value !== 'string')) throw new Error('invalid_function_audit_export');
  const redact = (value: string) => redactFunctionInvokeBody(value, 2000).bodyPreview;
  const utc = (value: string) => value ? new Date(value).toISOString() : null;
  const events = filterProjectFunctionAudit(detail.logs, filters).map(log => {
    if (!Number.isSafeInteger(log.id) || log.id < 1 || !Number.isFinite(Date.parse(log.occurredAt))
      || (log.version != null && (!Number.isSafeInteger(log.version) || log.version < 1))) throw new Error('invalid_function_audit_export');
    return { id: log.id, version: log.version ?? null, event: redact(log.event), state: redact(log.state),
      failure_code: log.failureCode == null ? null : redact(log.failureCode), occurred_at: log.occurredAt,
      request_id: safeFunctionCorrelationId(log.requestId) ? redact(log.requestId!) : null, trace_id: validProjectFunctionTraceId(log.traceId) ? redact(log.traceId) : null };
  });
  const metadata = { schema_version: 'w-console.function-audit/v1', project_id: projectId, function_slug: detail.summary.slug,
    trace_id: detail.traceId ? redact(detail.traceId) : null, filter_state: redact(filters.state), filter_event: redact(filters.event),
    filter_request_id: redact(filters.requestId), filter_from: utc(filters.from), filter_until: utc(filters.until),
    retained_limit: 200, retained_count: detail.logs.length, exported_count: events.length, next_before_id: detail.nextBeforeId ?? null,
    has_more: detail.nextBeforeId != null, text_redacted: true };
  if (format === 'json') return `${JSON.stringify({ ...metadata, events }, null, 2)}\n`;
  return serializeProjectTableRows(events.length ? events.map(({ trace_id, ...entry }) => ({ ...metadata, ...entry, event_trace_id: trace_id })) : [metadata], 'csv');
}
export interface ProjectFunctionsReadiness { available: boolean; invoke: boolean; deploy: boolean; listVersions: boolean; logs: boolean; activate: boolean; rollback: boolean; delete: boolean; }
/** Protected invoke test result: HTTP status plus truncated, redacted body preview only. */
export interface ProjectFunctionInvokeResult { status: number; requestId?: string; traceId?: string; bodyPreview: string; bodyTruncated: boolean; }
export const PROJECT_FUNCTION_INVOKE_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ProjectFunctionInvokeMethod = (typeof PROJECT_FUNCTION_INVOKE_METHODS)[number];
export const PROJECT_FUNCTION_INVOKE_CONTENT_TYPES = ['application/json', 'text/plain', 'application/xml', 'application/x-www-form-urlencoded'] as const;
export type ProjectFunctionInvokeContentType = (typeof PROJECT_FUNCTION_INVOKE_CONTENT_TYPES)[number];
export function validProjectFunctionInvokeBody(body: string, contentType: ProjectFunctionInvokeContentType = 'application/json'): boolean {
  if (!PROJECT_FUNCTION_INVOKE_CONTENT_TYPES.includes(contentType) || new TextEncoder().encode(body).byteLength > 65_536) return false;
  if (contentType === 'application/json') { try { JSON.parse(body); } catch { return false; } }
  return true;
}

/** Matches the W-DB function controller's UTF-8 source bound. */
export const PROJECT_FUNCTION_SOURCE_LIMIT = 256 * 1024;
export function validProjectFunctionSource(source: string): boolean {
  return Boolean(source.trim()) && !source.includes('\0')
    && new TextEncoder().encode(source).byteLength <= PROJECT_FUNCTION_SOURCE_LIMIT;
}
/** Read a browser-selected module without silently replacing invalid UTF-8 bytes. */
export async function readProjectFunctionSource(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<string | null> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > PROJECT_FUNCTION_SOURCE_LIMIT) return null;
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size || bytes.byteLength > PROJECT_FUNCTION_SOURCE_LIMIT) return null;
  let source: string;
  try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return null; }
  return validProjectFunctionSource(source) ? source : null;
}
/** Max characters retained from an invoke response body for the console preview. */
export const FUNCTION_INVOKE_BODY_PREVIEW_LIMIT = 512;
const REALTIME_WORKER_STATUSES = ['initializing', 'running', 'standby', 'retrying', 'stopped', 'failed', 'unconfigured'] as const;
const REALTIME_REPLICATION_ERRORS = ['decoder_busy', 'replication_unavailable', 'worker_stopped', 'not_configured', 'lag_probe_unavailable'] as const;
export type ProjectRealtimeWorkerStatus = typeof REALTIME_WORKER_STATUSES[number];
export type ProjectRealtimeReplicationError = typeof REALTIME_REPLICATION_ERRORS[number];

export interface ProjectRealtimeStatus { projectId: string; available: boolean; protocol: 'supabase_realtime_v1'; websocketUrl: string; activeConnections: number; broadcast: boolean; presence: boolean; postgresChanges: boolean; privateChannels: boolean; workerStatus?: ProjectRealtimeWorkerStatus; lagBytes?: number | null; lastError?: ProjectRealtimeReplicationError | null; limits: { connections: number; frameBytes: number; framesPerSecond: number }; }
export type ProjectRealtimeChange = 'INSERT' | 'UPDATE' | 'DELETE';
/** Syntax and column/type authorization remain owned by the Realtime server. */
export function validProjectRealtimeSubscriptionFilter(value: unknown): value is string {
  return typeof value === 'string' && new TextEncoder().encode(value).byteLength <= 4096
    && !Array.from(value).some(char => { const code = char.charCodeAt(0); return code < 32 || (code >= 127 && code <= 159); });
}
export interface ProjectRealtimeHistoryEntry { id: number; event: ProjectRealtimeChange; table: string; receivedAt: string }
export interface ProjectRealtimeHistorySnapshot {
  table: string;
  events: ProjectRealtimeHistoryEntry[];
  eventFilter: 'all' | ProjectRealtimeChange;
  paused: boolean;
  counts: Record<ProjectRealtimeChange, number>;
  subscriptionFilter?: string;
}

/** Export the bounded, filtered browser history; never retain row or transport fields. */
export function serializeProjectRealtimeHistory(context: SaasContext, projectId: string, snapshot: ProjectRealtimeHistorySnapshot, format: 'json' | 'csv'): string {
  const kinds: ProjectRealtimeChange[] = ['INSERT', 'UPDATE', 'DELETE'];
  if (!memberProject(context, projectId) || !validProjectTableIdentifier(snapshot.table)
    || !['all', ...kinds].includes(snapshot.eventFilter) || !['json', 'csv'].includes(format)
    || typeof snapshot.paused !== 'boolean' || snapshot.events.length > 100
    || (snapshot.subscriptionFilter !== undefined && !validProjectRealtimeSubscriptionFilter(snapshot.subscriptionFilter))
    || new Set(snapshot.events.map(entry => entry.id)).size !== snapshot.events.length
    || kinds.some(kind => !Number.isSafeInteger(snapshot.counts[kind]) || snapshot.counts[kind] < snapshot.events.filter(entry => entry.event === kind).length)) throw new Error('invalid_realtime_history_export');
  const events = snapshot.events.map(entry => {
    if (!Number.isSafeInteger(entry.id) || entry.id < 1 || entry.table !== snapshot.table || !kinds.includes(entry.event)
      || typeof entry.receivedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.receivedAt)
      || !Number.isFinite(Date.parse(entry.receivedAt)) || new Date(entry.receivedAt).toISOString() !== entry.receivedAt) throw new Error('invalid_realtime_history_export');
    return { received_at: entry.receivedAt, event_type: entry.event, schema: 'public', table: entry.table };
  }).filter(entry => snapshot.eventFilter === 'all' || entry.event_type === snapshot.eventFilter);
  const metadata = {
    schema_version: 'w-console.realtime-history/v1', project_id: projectId, schema: 'public', table: snapshot.table,
    event_filter: snapshot.eventFilter, history_paused: snapshot.paused, history_limit: 100,
    retained_count: snapshot.events.length, exported_count: events.length,
    count_insert: snapshot.counts.INSERT, count_update: snapshot.counts.UPDATE, count_delete: snapshot.counts.DELETE,
    ...(snapshot.subscriptionFilter ? { subscription_filter: snapshot.subscriptionFilter } : {}),
  };
  return format === 'json' ? `${JSON.stringify({ ...metadata, events }, null, 2)}\n`
    : serializeProjectTableRows(events.map(entry => ({ ...metadata, ...entry })), 'csv');
}
export interface ProjectRealtimeBroadcast { event: string; payload: Record<string, unknown> }
export const PROJECT_REALTIME_BROADCAST_BYTES = 8192;
export function parseProjectRealtimeBroadcast(event: string, source: string, frameBytes: number, channelName = ''): ProjectRealtimeBroadcast | null {
  if (typeof event !== 'string' || typeof source !== 'string' || !event || Array.from(event).some(char => /\s/.test(char) || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || event === '*' || new TextEncoder().encode(event).length > 64 || new TextEncoder().encode(source).length > PROJECT_REALTIME_BROADCAST_BYTES || !Number.isSafeInteger(frameBytes)) return null;
  try {
    const payload = record(JSON.parse(source));
    // Leave room for the SDK's Phoenix references and framing in either wire format.
    if (!payload || new TextEncoder().encode(JSON.stringify({ event, payload, topic: channelName })).length + 512 > frameBytes) return null;
    return { event, payload };
  } catch { return null; }
}
export interface ProjectRealtimeController { sendTestEvent: (input?: ProjectRealtimeBroadcast) => Promise<'ok' | 'error'>; setPresenceTracked: (tracked: boolean) => Promise<'ok' | 'error'>; stop: () => Promise<void>; }

export async function loadProjectObservability(context: SaasContext, projectId: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectObservability>> {
  const project = memberProject(context, projectId); const radarId = project && safeRadarProjectId(project.radarProjectId); if (!project || !radarId) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  try {
    const response = await request(`/api/project-radar/api/projects/${encodeURIComponent(radarId)}/management`, { method: 'GET', headers: { Authorization: `Bearer ${management.token.accessToken}` }, credentials: 'same-origin', cache: 'no-store', signal }); const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json()); const releases = Array.isArray(root?.releases) ? root.releases : null; const deployments = Array.isArray(root?.deployments) ? root.deployments : null; const runtime = Array.isArray(root?.runtime) ? root.runtime : null; const health = record(root?.health); const errors = record(root?.errors); const latency = record(root?.latency); const logs = record(root?.logs); const links = record(root?.links);
    const errorSignals = Array.isArray(errors?.signals) ? errors.signals : null; const latencySignals = Array.isArray(latency?.signals) ? latency.signals : null;
    if (root?.project_id !== radarId || !releases || releases.length > 25 || !deployments || deployments.length > 50 || !runtime || runtime.length > 20 || !health || !errorSignals || errorSignals.length > 50 || !latencySignals || latencySignals.length > 50 || !logs || logs.raw_logs !== false) return { status: 'invalid' };
    return { status: 'ready', data: { releases: releases.map((v) => { const x = record(v); return { status: text(x?.status), tag: text(x?.tag), workflow: text(x?.workflow), finishedAt: text(x?.finished_at) }; }), deployments: deployments.map((v) => { const x = record(v); return { name: text(x?.name), status: text(x?.status), provider: text(x?.provider), environment: text(x?.environment), syncedAt: text(x?.synced_at) }; }), runtime: runtime.map((v) => { const x = record(v); return { source: text(x?.source), scannedAt: text(x?.scanned_at) }; }), healthOk: health.ok === true, signalCount: typeof health.signal_count === 'number' ? health.signal_count : 0, errors: errorSignals.map((v) => { const x = record(v); return { layer: text(x?.layer), signalId: text(x?.signal_id), status: text(x?.status), consecutiveFails: Number(x?.consecutive_fails) || 0, lastRunAt: text(x?.last_run_at) }; }), latency: latencySignals.map((v) => { const x = record(v); return { layer: text(x?.layer), signalId: text(x?.signal_id), latencyMs: Number(x?.latency_ms) || 0, lastRunAt: text(x?.last_run_at) }; }), errorCount: errorSignals.length, latencyCount: latencySignals.length, logTotal: typeof logs.total === 'number' ? logs.total : 0, lastLogAt: typeof logs.last_seen_at === 'string' || logs.last_seen_at === null ? logs.last_seen_at : undefined, radarUrl: safeHttpsUrl(text(links?.radar_project)) || '', wMonitorUrl: safeHttpsUrl(text(links?.w_monitor_infrastructure)) || '' } };
  } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

function redactBrowserLog(value: string): string {
  const compact = value.toLowerCase().replace(/[\s"]/g, '');
  if (/(bearer\s|sk-|wid_sk_|postgres:\/\/|redis:\/\/|-----begin|private_key)/i.test(value) || /(authorization:|password[=:]|secret[=:]|api_?key[=:]|token[=:])/.test(compact)) return '[REDACTED]';
  return [...value].slice(0, 2000).join('');
}

const PROJECT_LOG_ATTRIBUTES = ['deployment.environment', 'http.method', 'http.route', 'http.status_code', 'rpc.method', 'rpc.service'] as const;

/** Export only the authorized loaded snapshot, with applied filters and no collector fields. */
export function serializeProjectLogs(context: SaasContext, projectId: string, filters: ProjectLogFilters, page: ProjectLogPage, format: 'json' | 'csv'): string {
  const project = memberProject(context, projectId);
  if (!project || !safeRadarProjectId(project.radarProjectId) || page.logs.length > 200 || new Set(page.logs.map((entry) => entry.id)).size !== page.logs.length || !['json', 'csv'].includes(format)) throw new Error('invalid_log_export');
  const applied = { from: filters.from || '', to: filters.to || '', level: filters.level || '', search: redactBrowserLog(filters.search || ''), trace_id: redactBrowserLog(filters.traceId || ''), request_id: redactBrowserLog(filters.requestId || '') };
  const logs = page.logs.map((entry) => ({
    id: redactBrowserLog(entry.id), timestamp: redactBrowserLog(entry.timestamp), level: redactBrowserLog(entry.level), service_name: redactBrowserLog(entry.serviceName),
    trace_id: redactBrowserLog(entry.traceId || ''), span_id: redactBrowserLog(entry.spanId || ''), request_id: redactBrowserLog(entry.requestId || ''), body: redactBrowserLog(entry.body),
    attributes: Object.fromEntries(PROJECT_LOG_ATTRIBUTES.flatMap<[string, string | number | boolean]>((key) => {
      const value = entry.attributes[key];
      return typeof value === 'string' ? [[key, redactBrowserLog(value)]] : typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ? [[key, value]] : [];
    })),
  }));
  if (format === 'json') return `${JSON.stringify({ project_id: projectId, filters: applied, loaded_count: logs.length, has_more: Boolean(page.nextCursor), logs }, null, 2)}\n`;
  return serializeProjectTableRows(logs.map((entry) => ({ project_id: projectId, range_from: applied.from, range_to: applied.to, filter_level: applied.level, filter_search: applied.search, filter_trace_id: applied.trace_id, filter_request_id: applied.request_id, loaded_count: logs.length, has_more: Boolean(page.nextCursor), ...entry })), 'csv');
}

export async function loadProjectLogs(context: SaasContext, projectId: string, filters: ProjectLogFilters, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectLogPage>> {
  const project = memberProject(context, projectId); const radarId = project && safeRadarProjectId(project.radarProjectId); if (!project || !radarId) return { status: 'forbidden' }; if (!bearerToken) return { status: 'auth' };
  const limit = filters.limit ?? 50; if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (filters.search?.length ?? 0) > 200 || (filters.traceId?.length ?? 0) > 128 || (filters.requestId?.length ?? 0) > 128 || (filters.cursor?.length ?? 0) > 1024) return { status: 'invalid' };
  const to = filters.to ? Date.parse(filters.to) : Date.now();
  const from = filters.from ? Date.parse(filters.from) : to - 24 * 60 * 60 * 1000;
  const validTime = (value?: string) => !value || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === value.slice(0, 10));
  if (!validTime(filters.from) || !validTime(filters.to) || !Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > PROJECT_LOG_WINDOW_MS || (filters.level && !['debug', 'info', 'warn', 'error', 'fatal'].includes(filters.level))) return { status: 'invalid' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal); if (management.status !== 'ready') return management;
  const query = new URLSearchParams({ limit: String(limit) }); for (const [key, value] of [['level', filters.level], ['search', filters.search], ['trace_id', filters.traceId], ['request_id', filters.requestId], ['from', filters.from], ['to', filters.to], ['cursor', filters.cursor]] as const) if (value) query.set(key, value);
  try { const response = await request(`/api/project-radar/api/projects/${encodeURIComponent(radarId)}/management/logs?${query}`, { headers: { Authorization: `Bearer ${management.token.accessToken}` }, credentials: 'same-origin', cache: 'no-store', signal }); const failure = panelFailure(response); if (failure) return failure; const root = record(await response.json()); if (root?.project_id !== radarId || !Array.isArray(root?.logs) || root.logs.length > limit || (root.next_cursor != null && (typeof root.next_cursor !== 'string' || root.next_cursor.length > 1024))) return { status: 'invalid' }; const allowedAttributes = new Set<string>(PROJECT_LOG_ATTRIBUTES); const parsed = root.logs.map((value) => { const item = record(value); const attrs = record(item?.attributes); const id = text(item?.id); const timestamp = text(item?.timestamp); const level = text(item?.level); const serviceName = text(item?.service_name); if (!id || !timestamp || !level || !serviceName || !attrs) return null; const attributes: Record<string, string | number | boolean> = {}; for (const [key, attr] of Object.entries(attrs)) if (allowedAttributes.has(key) && (typeof attr === 'string' || typeof attr === 'number' || typeof attr === 'boolean')) attributes[key] = typeof attr === 'string' ? redactBrowserLog(attr) : attr; return { id, timestamp, level, serviceName, body: redactBrowserLog(text(item?.body)), traceId: optionalText(item?.trace_id) || undefined, spanId: optionalText(item?.span_id) || undefined, requestId: optionalText(item?.request_id) || undefined, attributes }; }); if (parsed.some((item) => item === null) || new Set(parsed.map((item) => item?.id)).size !== parsed.length) return { status: 'invalid' }; return { status: 'ready', data: { logs: parsed as ProjectLogEntry[], nextCursor: optionalText(root.next_cursor) || undefined } }; } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

export async function loadProjectMonitorHealth(context: SaasContext, projectId: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectMonitorHealth>> {
  const project = memberProject(context, projectId); if (!project) return { status: 'forbidden' }; if (!bearerToken) return { status: 'auth' }; const management = await exchangeProjectManagementToken(project, bearerToken, request, signal); if (management.status !== 'ready') return management;
  try {
    const response = await request(`/api/project-monitor/api/v1/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/health`, { headers: { Authorization: `Bearer ${management.token.accessToken}` }, credentials: 'same-origin', cache: 'no-store', signal });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json()); const summary = record(root?.summary);
    if (root?.schema_version !== 'w.monitor.project-health.v1' || root.workspace_id !== project.workspaceId || root.project_id !== project.id || !summary || !Array.isArray(root.nodes) || root.nodes.length > 512) return { status: 'invalid' };
    const now = Date.now();
    const windowMs = MONITOR_FRESHNESS_WINDOW_SECONDS * 1000;
    const nodes: ProjectMonitorHealth['nodes'] = [];
    for (const value of root.nodes) {
      const item = record(value); const status = text(item?.status);
      if (!item || !['healthy', 'degraded', 'offline'].includes(status) || !Array.isArray(item.services) || item.services.length > 128) return { status: 'invalid' };
      const latestCheckAt = text(item.latest_check_at);
      const checkedMs = Date.parse(latestCheckAt);
      const stale = !Number.isFinite(checkedMs) || now - checkedMs > windowMs || status === 'offline';
      const latestErrorRoot = record(item.latest_error);
      nodes.push({
        agentId: text(item.agent_id),
        hostname: text(item.hostname),
        status: status as 'healthy' | 'degraded' | 'offline',
        latestCheckAt,
        ...(typeof item.latency_ms === 'number' ? { latencyMs: item.latency_ms } : {}),
        services: item.services.map((serviceValue) => {
          const service = record(serviceValue);
          return { name: text(service?.name), status: text(service?.status), ...(typeof service?.description === 'string' ? { description: service.description } : {}) };
        }),
        ...(latestErrorRoot ? { latestError: { state: text(latestErrorRoot.state), severity: text(latestErrorRoot.severity), summary: redactBrowserLog(text(latestErrorRoot.summary)), metric: text(latestErrorRoot.metric), checkedAt: Number(latestErrorRoot.checked_at) || 0 } } : {}),
        stale,
      });
    }
    const incidents: ProjectMonitorIncident[] = nodes.flatMap((node) => node.latestError
      ? [{ agentId: node.agentId, hostname: node.hostname, state: node.latestError.state, severity: node.latestError.severity, summary: node.latestError.summary, metric: node.latestError.metric, checkedAt: node.latestError.checkedAt }]
      : []);
    let asOf: string | null = null;
    let asOfMs = Number.NEGATIVE_INFINITY;
    let staleNodeCount = 0;
    for (const node of nodes) {
      if (node.stale) staleNodeCount += 1;
      const checkedMs = Date.parse(node.latestCheckAt);
      if (Number.isFinite(checkedMs) && checkedMs > asOfMs) {
        asOfMs = checkedMs;
        asOf = node.latestCheckAt;
      }
    }
    const freshness: ProjectMonitorFreshness = {
      asOf,
      staleNodeCount,
      status: nodes.length === 0 ? 'empty' : staleNodeCount > 0 ? 'stale' : 'fresh',
      windowSeconds: MONITOR_FRESHNESS_WINDOW_SECONDS,
    };
    return {
      status: 'ready',
      data: {
        summary: { nodes: Number(summary.nodes) || 0, healthy: Number(summary.healthy) || 0, degraded: Number(summary.degraded) || 0, offline: Number(summary.offline) || 0 },
        nodes,
        incidents,
        freshness,
      },
    };
  } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

function parseFunctionSummary(value: unknown): ProjectFunctionSummary | null { const item = record(value); const slug = text(item?.slug); const auth = text(item?.auth); if (!safePathSegment(slug) || (auth !== 'user' && auth !== 'project') || typeof item?.active_version !== 'number' || !Number.isSafeInteger(item.active_version)) return null; return { slug, activeVersion: item.active_version, auth, sourceSha256: text(item.source_sha256), state: text(item.state), createdAt: text(item.created_at), activatedAt: optionalText(item.activated_at) }; }
function parseFunctionVersion(value: unknown): ProjectFunctionVersion | null { const item = record(value); const auth = text(item?.auth); if ((auth !== 'user' && auth !== 'project') || typeof item?.version !== 'number' || !Number.isSafeInteger(item.version)) return null; return { version: item.version, auth, sourceSha256: text(item.source_sha256), state: text(item.state), failureCode: optionalText(item.failure_code), createdAt: text(item.created_at), activatedAt: optionalText(item.activated_at) }; }
function safeFunctionCorrelationId(value: unknown): string | undefined {
  const candidate = text(value);
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : undefined;
}
export function validProjectFunctionTraceId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value); }
function parseFunctionEvent(value: unknown): ProjectFunctionEvent | null {
  const item = record(value);
  if (typeof item?.id !== 'number' || !Number.isSafeInteger(item.id)) return null;
  // Prefer request_id when upstream projects it; never invent one from bodies or tokens.
  const requestId = safeFunctionCorrelationId(item.request_id) || safeFunctionCorrelationId(item.correlation_id);
  const traceId = validProjectFunctionTraceId(item.marker) ? item.marker : undefined;
  return {
    id: item.id,
    version: typeof item.version === 'number' || item.version === null ? item.version : undefined,
    event: text(item.event),
    state: text(item.state),
    failureCode: optionalText(item.failure_code),
    occurredAt: text(item.occurred_at),
    ...(requestId ? { requestId } : {}),
    ...(traceId ? { traceId } : {}),
  };
}

/** Truncate and defensively redact invoke response bodies before any UI render. */
export function redactFunctionInvokeBody(value: string, limit = FUNCTION_INVOKE_BODY_PREVIEW_LIMIT): { bodyPreview: string; bodyTruncated: boolean } {
  const compact = value.toLowerCase().replace(/[\s"]/g, '');
  if (/(bearer\s|sk-|wid_sk_|wid_pk_|postgres:\/\/|redis:\/\/|-----begin|private_key)/i.test(value)
    || /(authorization:|password[=:]|secret[=:]|api_?key[=:]|token[=:])/.test(compact)) {
    return { bodyPreview: '[REDACTED]', bodyTruncated: true };
  }
  const chars = [...value];
  if (chars.length <= limit) return { bodyPreview: value, bodyTruncated: false };
  return { bodyPreview: `${chars.slice(0, limit).join('')}…`, bodyTruncated: true };
}

async function readFunctionInvokeBody(response: Response, limit = FUNCTION_INVOKE_BODY_PREVIEW_LIMIT): Promise<{ bodyPreview: string; bodyTruncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { bodyPreview: '', bodyTruncated: false };
  const decoder = new TextDecoder();
  let raw = '';
  let truncated = false;
  // Read slightly past the preview limit so truncation is accurate, then cancel the stream.
  const readCap = limit + 64;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      if ([...raw].length > readCap) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    await reader.cancel().catch(() => undefined);
    return { bodyPreview: '', bodyTruncated: true };
  }
  const redacted = redactFunctionInvokeBody(raw, limit);
  return { bodyPreview: redacted.bodyPreview, bodyTruncated: truncated || redacted.bodyTruncated };
}

async function functionManagementRequest<T>(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, invoke: (project: ConsoleProject, headers: Record<string, string>) => Promise<Response>, parse: (response: Response) => Promise<T | null>, signal?: AbortSignal): Promise<ProjectPanelState<T>> {
  const project = memberProject(context, projectId); if (!project) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' }; if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  signal?.throwIfAborted(); const management = await exchangeProjectManagementToken(project, bearer, request, signal); signal?.throwIfAborted(); if (management.status !== 'ready') return management;
  try { const response = await invoke(project, { Authorization: `Bearer ${management.token.accessToken}`, apikey: key }); const failure = panelFailure(response); if (failure) return failure; const data = await parse(response); return data === null ? { status: 'invalid' } : { status: 'ready', data }; } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

export async function loadProjectFunctions(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectFunctionSummary[]>> {
  return functionManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions`, { headers, cache: 'no-store', signal }), async (response) => { const root = record(await response.json()); if (!Array.isArray(root?.functions) || root.functions.length > 100) return null; const functions = root.functions.map(parseFunctionSummary); return functions.some((item) => item === null) ? null : functions as ProjectFunctionSummary[]; }, signal);
}

export async function loadProjectFunctionsReadiness(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectFunctionsReadiness>> {
  return functionManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions`, { headers, cache: 'no-store', signal }), async (response) => { const root = record(await response.json()); const capabilities = record(root?.capabilities); const functions = record(capabilities?.functions); if (root?.project_id !== projectId || !functions) return null; return { available: functions.status === 'available', invoke: functions.invoke === true, deploy: functions.deploy === true, listVersions: functions.listVersions === true, logs: functions.logs === true, activate: functions.activate === true, rollback: functions.rollback === true, delete: functions.delete === true }; }, signal);
}

export async function loadProjectFunctionDetail(context: SaasContext, projectId: string, summary: ProjectFunctionSummary, key: string, bearer: string | null, request: typeof fetch, beforeId?: number, signal?: AbortSignal, traceId?: string): Promise<ProjectPanelState<ProjectFunctionDetail>> {
  if (!safePathSegment(summary.slug) || (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId < 1)) || (traceId !== undefined && !validProjectFunctionTraceId(traceId))) return { status: 'invalid' };
  return functionManagementRequest(context, projectId, key, bearer, request, async (project, headers) => {
    const base = `/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions/${encodeURIComponent(summary.slug)}`;
    const query = new URLSearchParams({ limit: '50' });
    if (beforeId !== undefined) query.set('before_id', String(beforeId));
    if (traceId !== undefined) query.set('trace_id', traceId);
    const [versions, logs] = await Promise.all([request(`${base}/versions`, { headers, cache: 'no-store', signal }), request(`${base}/logs?${query}`, { headers, cache: 'no-store', signal })]);
    if (!versions.ok) return versions;
    if (!logs.ok) return logs;
    return Response.json({ versions: await versions.json(), logs: await logs.json() });
  }, async (response) => {
    const combined = record(await response.json()); const versionsRoot = record(combined?.versions); const logsRoot = record(combined?.logs);
    if (!Array.isArray(versionsRoot?.versions) || versionsRoot.versions.length > 100 || !Array.isArray(logsRoot?.logs) || logsRoot.logs.length > 50) return null;
    if ((logsRoot.project_id !== undefined && logsRoot.project_id !== projectId) || (logsRoot.function_slug !== undefined && logsRoot.function_slug !== summary.slug)) return null;
    const versions = versionsRoot.versions.map(parseFunctionVersion); const logs = logsRoot.logs.map(parseFunctionEvent);
    if (versions.some((item) => item === null) || logs.some((item) => item === null)) return null;
    const next = logsRoot.next_before_id;
    if (next !== null && next !== undefined && (typeof next !== 'number' || !Number.isSafeInteger(next) || next < 1)) return null;
    if (beforeId !== undefined && logs.some(item => item!.id >= beforeId)) return null;
    if (traceId !== undefined) {
      if (logsRoot.schema_version !== 'w-db.function-logs/v1' || logsRoot.project_id !== projectId || logsRoot.function_slug !== summary.slug || logs.some(item => item!.traceId !== traceId)) return null;
      if (logs.some((item, index) => item!.id < 1 || (index > 0 && item!.id >= logs[index - 1]!.id)) || next !== (logs.at(-1)?.id ?? null)) return null;
    }
    return { summary, versions: versions as ProjectFunctionVersion[], logs: logs as ProjectFunctionEvent[], nextBeforeId: next as number | null | undefined, ...(traceId ? { traceId } : {}) };
  }, signal);
}

export async function deployProjectFunction(context: SaasContext, projectId: string, slug: string, source: string, auth: 'user' | 'project', key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectFunctionSummary>> {
  if (!safePathSegment(slug) || !validProjectFunctionSource(source) || !['user', 'project'].includes(auth)) return { status: 'invalid' };
  return functionManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions/${encodeURIComponent(slug)}/deploy`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ source, auth }), cache: 'no-store', signal }), async (response) => {
    const root = record(await response.json()); const summary = parseFunctionSummary(root?.function);
    return summary?.slug === slug && summary.auth === auth && summary.activeVersion > 0 && summary.state === 'active' ? summary : null;
  }, signal);
}

export async function activateProjectFunctionVersion(context: SaasContext, projectId: string, slug: string, version: number, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectFunctionSummary>> {
  if (!safePathSegment(slug) || !Number.isSafeInteger(version) || version < 1) return { status: 'invalid' };
  return functionManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions/${encodeURIComponent(slug)}/versions/${version}/activate`, { method: 'POST', headers, cache: 'no-store', signal }), async (response) => { const root = record(await response.json()); const summary = parseFunctionSummary(root); return (root?.project_id === undefined || root.project_id === projectId) && summary?.slug === slug && summary.activeVersion === version && summary.state === 'active' ? summary : null; }, signal);
}

export async function deleteProjectFunction(context: SaasContext, projectId: string, slug: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<{ slug: string }>> {
  if (!safePathSegment(slug)) return { status: 'invalid' };
  return functionManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions/${encodeURIComponent(slug)}`, { method: 'DELETE', headers, cache: 'no-store', signal }), async (response) => response.status === 204 ? { slug } : null, signal);
}

export const FUNCTION_INVOKE_QUERY_LIMIT = 4096;

/** Normalize form-style query parameters without changing the fixed invocation path. */
export function parseProjectFunctionQuery(value: string): string | null {
  if (new TextEncoder().encode(value).byteLength > FUNCTION_INVOKE_QUERY_LIMIT || value.includes('#') || /%(?![0-9a-f]{2})/i.test(value)) return null;
  try {
    const query = value.startsWith('?') ? value.slice(1) : value;
    const decoded = decodeURIComponent(query.replace(/\+/g, ' '));
    if ([...decoded].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
    const normalized = new URLSearchParams(query).toString();
    return normalized.length <= FUNCTION_INVOKE_QUERY_LIMIT ? normalized : null;
  } catch { return null; }
}

/**
 * Protected invoke test against the exact-project Functions gateway.
 * Returns HTTP status plus a truncated, redacted body preview only — never full
 * response bodies, secrets, or platform-admin material.
 */
export async function invokeProtectedProjectFunction(
  context: SaasContext,
  projectId: string,
  slug: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
  signal?: AbortSignal,
  requestBody = '{}',
  method: ProjectFunctionInvokeMethod = 'POST',
  requestQuery = '',
  traceId?: string,
  contentType: ProjectFunctionInvokeContentType = 'application/json',
): Promise<ProjectPanelState<ProjectFunctionInvokeResult>> {
  if (traceId !== undefined && !validProjectFunctionTraceId(traceId)) return { status: 'invalid' };
  const query = parseProjectFunctionQuery(requestQuery);
  if (query === null) return { status: 'invalid' };
  if (!safePathSegment(slug) || !PROJECT_FUNCTION_INVOKE_METHODS.includes(method)) return { status: 'invalid' };
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody && !validProjectFunctionInvokeBody(requestBody, contentType)) return { status: 'invalid' };
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const management = await exchangeProjectManagementToken(project, bearer, request, requestSignal);
  if (management.status !== 'ready') return management;
  try {
    const response = await request(`/api/project-data/project/${encodeURIComponent(project.id)}/functions/v1/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${management.token.accessToken}`,
        apikey: key,
        ...(traceId ? { 'x-w-trace-marker': traceId } : {}),
        ...(hasBody ? { 'Content-Type': contentType } : {}),
      },
      ...(hasBody ? { body: requestBody } : {}),
      cache: 'no-store',
      signal: requestSignal,
    });
    // After management-token exchange, every completed HTTP status is the invoke test result
    // (including 401/403/5xx). Membership denials are handled before the request is issued.
    const requestId = safeFunctionCorrelationId(response.headers.get('x-request-id'));
    const body = await readFunctionInvokeBody(response);
    return {
      status: 'ready',
      data: {
        status: response.status,
        ...(requestId ? { requestId } : {}),
        ...(traceId ? { traceId } : {}),
        bodyPreview: body.bodyPreview,
        bodyTruncated: body.bodyTruncated,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

function safeRealtimeWebsocket(value: string, projectId: string): string | null { try { const url = new URL(value); return url.protocol === 'wss:' && url.pathname === `/project/${encodeURIComponent(projectId)}/realtime/v1/websocket` && !url.username && !url.password && !url.search && !url.hash ? url.toString() : null; } catch { return null; } }

export async function loadProjectRealtimeStatus(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectRealtimeStatus>> {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  return functionManagementRequest(context, projectId, key, bearer, request, async (project, headers) => {
    const base = `/api/project-data/v1/projects/${encodeURIComponent(project.id)}`;
    const [discovery, status] = await Promise.all([
      request(`${base}/discovery`, { headers, cache: 'no-store', signal: requestSignal }),
      request(`${base}/realtime/status`, { headers, cache: 'no-store', signal: requestSignal }),
    ]);
    if (!discovery.ok) return discovery;
    if (!status.ok) return status;
    return Response.json({ discovery: await discovery.json(), status: await status.json() });
  }, async (response) => {
    const root = record(await response.json()); const discovery = record(root?.discovery); const status = record(root?.status);
    const capability = record(discovery?.capabilities)?.realtime;
    const realtime = record(capability); const features = record(status?.features); const limits = record(status?.limits);
    const websocketUrl = safeRealtimeWebsocket(text(status?.websocket_url), projectId);
    // Authenticated W-DB discovery exposes a boolean capability. Detailed
    // feature flags belong to realtime-status, not the public discovery shape.
    if (discovery?.project_id !== projectId || status?.schema_version !== 'w-db.realtime-status/v1' || status?.project_id !== projectId || status?.protocol !== 'supabase_realtime_v1' || !websocketUrl || !features || !limits || (typeof capability !== 'boolean' && !realtime)) return null;
    // Only public diagnostic codes may reach the console; raw provider errors are never rendered.
    if ((status.worker_status !== undefined && !REALTIME_WORKER_STATUSES.includes(status.worker_status as ProjectRealtimeWorkerStatus))
      || (status.lag_bytes !== undefined && status.lag_bytes !== null && (!Number.isSafeInteger(status.lag_bytes) || Number(status.lag_bytes) < 0))
      || (status.last_error !== undefined && status.last_error !== null && !REALTIME_REPLICATION_ERRORS.includes(status.last_error as ProjectRealtimeReplicationError))) return null;
    const allowed = (feature: string, discoveryFeature: string) => features[feature] === true && (capability === true || realtime?.[discoveryFeature] === true);
    return {
      projectId, available: status.status === 'available' && (capability === true || realtime?.status === 'available'),
      protocol: 'supabase_realtime_v1', websocketUrl, activeConnections: typeof status.active_connections === 'number' ? status.active_connections : 0,
      broadcast: allowed('broadcast', 'broadcast'), presence: allowed('presence', 'presence'), postgresChanges: allowed('postgres_changes', 'postgresChanges'), privateChannels: allowed('private_channels', 'privateChannels'),
      ...(status.worker_status !== undefined ? { workerStatus: status.worker_status as ProjectRealtimeWorkerStatus } : {}),
      ...(status.lag_bytes !== undefined ? { lagBytes: status.lag_bytes as number | null } : {}),
      ...(status.last_error !== undefined ? { lastError: status.last_error as ProjectRealtimeReplicationError | null } : {}),
      limits: { connections: Number(limits.connections_per_project) || 0, frameBytes: Number(limits.frame_bytes) || 0, framesPerSecond: Number(limits.frames_per_second) || 0 },
    };
  }, requestSignal);
}

function inMemoryRealtimeStorage(): Storage { const values = new Map<string, string>(); return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } }; }

export async function startProjectRealtimeChannel(context: SaasContext, projectId: string, status: ProjectRealtimeStatus, channelName: string, key: string, bearer: string | null, request: typeof fetch, callbacks: { onConnection: (state: string) => void; onPresence: (count: number) => void; onTestEvent: (event: string) => void; onPostgresChange?: (event: ProjectRealtimeChange) => void }, options: { table?: string; filter?: string; signal?: AbortSignal } = {}): Promise<ProjectPanelState<ProjectRealtimeController>> {
  const project = memberProject(context, projectId);
  if (!project || status.projectId !== projectId || !status.available || !status.broadcast || !status.presence || !status.privateChannels || !/^[A-Za-z0-9_-]{1,64}$/.test(channelName)) return { status: 'forbidden' };
  if (options.table !== undefined && (!status.postgresChanges || !validProjectTableIdentifier(options.table))) return { status: 'invalid' };
  if (options.filter !== undefined && (!options.table || !validProjectRealtimeSubscriptionFilter(options.filter))) return { status: 'invalid' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  options.signal?.throwIfAborted();
  const requestSignal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const management = await exchangeProjectManagementToken(project, bearer, request, requestSignal);
  if (management.status !== 'ready') return management;
  options.signal?.throwIfAborted();
  const websocketUrl = safeRealtimeWebsocket(status.websocketUrl, projectId); if (!websocketUrl) return { status: 'invalid' };
  const { RealtimeClient } = await import('@supabase/realtime-js');
  options.signal?.throwIfAborted();
  // The official SDK appends /websocket to its endpoint base.
  const client = new RealtimeClient(websocketUrl.slice(0, -'/websocket'.length), { params: { apikey: key }, timeout: 5_000, heartbeatIntervalMs: 10_000, sessionStorage: inMemoryRealtimeStorage(), logger: () => {} });
  const channel = client.channel(channelName, { config: { private: true, broadcast: { self: true, ack: true }, presence: { key: 'w-platform-console', enabled: true } } });
  let stopped = false; let cleanup: Promise<void> | undefined;
  const stop = () => {
    if (cleanup) return cleanup;
    stopped = true; options.signal?.removeEventListener('abort', abort);
    cleanup = (async () => {
      // Close the transport first so SDK reconnect timers cannot reuse this grant.
      // Closing the connection also removes its tracked Presence membership.
      try { await client.disconnect(); } finally { await client.removeChannel(channel); }
    })().catch(() => { /* cleanup remains safe after a transport failure */ });
    return cleanup;
  };
  let cancelSubscription: (() => void) | undefined;
  const abort = () => { cancelSubscription?.(); void stop(); };
  options.signal?.addEventListener('abort', abort, { once: true });
  const presenceCount = () => Object.values(channel.presenceState() as Record<string, unknown[]>).reduce((count, entries) => count + entries.length, 0);
  const reportPresence = () => { if (!stopped) callbacks.onPresence(presenceCount()); };
  channel.on('presence', { event: 'sync' }, reportPresence);
  channel.on('presence', { event: 'join' }, reportPresence);
  channel.on('presence', { event: 'leave' }, reportPresence);
  const setPresenceTracked = async (tracked: boolean): Promise<'ok' | 'error'> => {
    if (stopped) return 'error';
    try {
      const result = tracked ? await channel.track({ online_at: new Date().toISOString(), client: 'w-platform-console' }) : await channel.untrack();
      return !stopped && result === 'ok' ? 'ok' : 'error';
    } catch { return 'error'; }
  };
  let expectedEvent = 'w_console_test';
  channel.on('broadcast', { event: '*' }, (payload) => { if (!stopped && record(payload)?.event === expectedEvent) callbacks.onTestEvent(expectedEvent); });
  if (options.table) channel.on('postgres_changes', { event: '*', schema: 'public', table: options.table, ...(options.filter ? { filter: options.filter } : {}) }, (payload) => {
    // Project only the event kind; never retain or render payload.new/old.
    if (!stopped && payload.schema === 'public' && payload.table === options.table && ['INSERT', 'UPDATE', 'DELETE'].includes(payload.eventType)) callbacks.onPostgresChange?.(payload.eventType as ProjectRealtimeChange);
  });
  try {
    await client.setAuth(management.token.accessToken);
    if (stopped) throw new Error('realtime_cancelled');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('realtime_subscribe_timeout')), 6_000);
      const finish = (error?: Error) => { clearTimeout(timer); cancelSubscription = undefined; if (error) reject(error); else resolve(); };
      cancelSubscription = () => finish(new Error('realtime_cancelled'));
      channel.subscribe((next) => {
        if (stopped) return;
        callbacks.onConnection(next);
        if (next === 'SUBSCRIBED') finish();
        else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') { finish(new Error(next)); void stop(); }
      });
    });
    if (await setPresenceTracked(true) !== 'ok') throw new Error('presence_track_failed');
    if (stopped) throw new Error('realtime_cancelled');
    return { status: 'ready', data: {
      sendTestEvent: async (input = { event: 'w_console_test', payload: { kind: 'controlled_test' } }) => {
        if (stopped) return 'error';
        try {
          const checked = parseProjectRealtimeBroadcast(input.event, JSON.stringify(input.payload), status.limits.frameBytes, channelName);
          if (!checked) return 'error';
          expectedEvent = checked.event;
          return await channel.send({ type: 'broadcast', ...checked }) === 'ok' ? 'ok' : 'error';
        } catch { return 'error'; }
      },
      setPresenceTracked,
      stop,
    } };
  } catch { await stop(); return { status: 'network' }; }
}

export async function loadUnifiedManagement(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<UnifiedManagementData>> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearer, request, signal);
  if (management.status !== 'ready') return management;
  try {
    const headers = { Authorization: `Bearer ${management.token.accessToken}`, apikey: key };
    const [membersResponse, invitationsResponse, functionsResponse] = await Promise.all([
      request(`/api/console/workspaces/${encodeURIComponent(project.workspaceId)}/members`, { headers: { Authorization: `Bearer ${bearer}` }, cache: 'no-store', signal }),
      request(`/api/console/workspaces/${encodeURIComponent(project.workspaceId)}/invitations`, { headers: { Authorization: `Bearer ${bearer}` }, cache: 'no-store', signal }),
      request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions`, { headers, cache: 'no-store', signal }),
    ]);
    for (const response of [membersResponse, invitationsResponse]) { const failure = panelFailure(response); if (failure) return failure; }
    const functionsReachable = functionsResponse.status !== 404;
    if (functionsReachable) { const failure = panelFailure(functionsResponse); if (failure) return failure; }
    const membersRoot = record(await membersResponse.json()); const invitationsRoot = record(await invitationsResponse.json()); const functionsRoot = functionsReachable ? record(await functionsResponse.json()) : { functions: [] };
    const members = Array.isArray(membersRoot?.members) ? membersRoot.members : Array.isArray(membersRoot?.data) ? membersRoot.data : null;
    const invitations = Array.isArray(invitationsRoot?.invitations) ? invitationsRoot.invitations : Array.isArray(invitationsRoot?.data) ? invitationsRoot.data : null;
    const rawFunctions = Array.isArray(functionsRoot?.functions) ? functionsRoot.functions : null;
    if (!members || !invitations || !rawFunctions || members.length > 500 || invitations.length > 500 || rawFunctions.length > 100) return { status: 'invalid' };
    const functions = await Promise.all(rawFunctions.map(async (value) => { const item = record(value); const slug = text(item?.slug); if (!slug || !safePathSegment(slug)) throw new Error('invalid'); const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/functions/${encodeURIComponent(slug)}/logs?limit=20`, { headers, cache: 'no-store', signal }); if (!response.ok) throw new Error('network'); const root = record(await response.json()); if (!Array.isArray(root?.logs) || root.logs.length > 20) throw new Error('invalid'); return { slug, state: text(item?.state), activeVersion: typeof item?.active_version === 'number' ? item.active_version : 0, logs: root.logs.map((entry) => { const log = record(entry); return { id: Number(log?.id), event: text(log?.event), state: text(log?.state), occurredAt: text(log?.occurred_at) }; }) }; }));
    return { status: 'ready', data: { members: members.length, invitations: invitations.length, functionsReachable, functions } };
  } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

export interface ProjectCapability {
  name: ProjectCapabilityName;
  available: boolean;
  url?: string;
}

export interface PublishableKeyMetadata {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  allowedOrigins: string[];
  revokedAt?: number | null;
  expiresAt?: number | null;
  overlapExpiresAt?: number | null;
  publishableKey?: string;
  requiresRotation: boolean;
}
export interface ProjectKeyMetadata { id: string; name: string; kind: 'publishable' | 'server'; keyPrefix: string; scopes: string[]; allowedOrigins: string[]; lastUsedAt?: number | null; expiresAt?: number | null; revokedAt?: number | null; rotatedAt?: number | null; overlapExpiresAt?: number | null; createdAt: number; }
export type ProjectServerKeyMutationResult = { status: 'ready'; metadata: ProjectKeyMetadata; oneTimeKey: string } | { status: 'ready' } | { status: 'error'; reason: DiscoveryFailure };

export interface ProjectAuthUser {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  status: string;
  appRole: string;
  effectiveTier: string;
  loginCount: number;
  lastSeenAt: number;
}

export interface ProjectAuthIdentity {
  provider: string;
  providerUserId: string;
  username?: string | null;
  displayName?: string | null;
}

export interface ProjectAuthUserDetail {
  user: ProjectAuthUser;
  identities: ProjectAuthIdentity[];
  mfaEnabled?: boolean;
  workspaceMemberRole?: string | null;
}

export interface ProjectAuthInvitation {
  id: string;
  email: string;
  appRole: 'user' | 'admin';
  expiresAt: number;
  createdAt: number;
}

export interface ProjectAuthSession {
  id: string;
  userAgent: string | null;
  createdAt: number;
  expiresAt: number;
}

export const PROJECT_AUTH_PAGE_SIZE = 25;

export interface ProjectAuthDirectoryQuery {
  offset: number;
  status: 'all' | 'active' | 'blocked';
}

export interface ProjectAuthConsoleData {
  offset: number;
  hasMore: boolean;
  users: ProjectAuthUser[];
  total: number;
  active: number;
  blocked: number;
  invitations: ProjectAuthInvitation[];
  canManage: boolean;
}

export interface ProjectDatabaseColumn { name: string; ordinal: number; dataType: string; nullable: boolean; hasDefault: boolean; identity: boolean; generated: boolean; }

export interface ProjectDatabaseTable {
  schema: string;
  name: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  columnCount: number;
  policyCount: number;
  columns?: ProjectDatabaseColumn[];
}

export interface ProjectMigrationSummary {
  initialized: boolean;
  count: number;
  lastAppliedAt?: string | null;
}

export interface ProjectAppliedMigration { version: string; checksum: string; appliedAt: string; }
export interface ProjectMigrationInventory { initialized: boolean; count: number; truncated: boolean; lastAppliedAt?: string | null; migrations: ProjectAppliedMigration[]; }
export interface ProjectSqlPreview { valid: true; projectId: string; limits: { rows: number; columns: number; bytes: number; statementTimeoutMs: number; lockTimeoutMs: number }; }
export interface ProjectSqlResult { rows: Array<Record<string, unknown>>; truncated: boolean; bytes: number; }
export interface ProjectMigrationFile { name: string; sql: string; }
export interface ProjectMigrationReport { mode: 'preview' | 'apply'; versions: string[]; checksums: string[]; totalBytes?: number; applied: string[]; alreadyApplied: string[]; }
export type ProjectDatabaseOperation<T> = ProjectPanelState<T> | { status: 'drift' | 'rolled_back' | 'rejected' };
export interface ProjectRlsPolicy { name: string; permissive: boolean; roles: string[]; command: string; usingExpression?: string | null; checkExpression?: string | null; }
export interface ProjectRlsPolicyInput { name: string; command: 'all' | 'select' | 'insert' | 'update' | 'delete'; restrictive: boolean; rule: { kind: 'w_id_subject_column' | 'w_project_column'; column: string }; }

export interface ProjectStorageBucket {
  id: string;
  name: string;
  public: boolean;
  fileSizeLimit?: number | null;
  objectMimeTypes: string[];
  quotaBytes?: number | null;
}

export interface ProjectTableRows {
  schema: string;
  table: string;
  rows: Record<string, unknown>[];
  hasMore: boolean;
  nextOffset?: number | null;
  totalRows?: number;
}

export interface ProjectDatabaseTypes {
  filename: 'database.types.ts';
  content: string;
}

/** Export the already authorized page; CSV quotes cells and escapes formula-like strings. */
export function serializeProjectTableRows(rows: ProjectTableRows['rows'], format: 'json' | 'csv'): string {
  if (format === 'json') return `${JSON.stringify(rows, null, 2)}\n`;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!columns.length) return '';
  const cell = (value: unknown): string => {
    let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value) ?? '';
    // Quoting alone does not prevent spreadsheet formula interpretation.
    if (typeof value === 'string' && (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text))) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [columns.map(cell).join(','), ...rows.map((row) => columns.map((column) => cell(Object.hasOwn(row, column) ? row[column] : null)).join(','))].join('\r\n') + '\r\n';
}

export type ProjectRowMutation =
  | { operation: 'insert'; values: Record<string, unknown> }
  | { operation: 'update'; id: string; expected: Record<string, unknown>; values: Record<string, unknown> }
  | { operation: 'delete'; id: string; expected: Record<string, unknown> };

export type ProjectRowMutationResult =
  | { status: 'ready'; data: { mutationId: string; operation: ProjectRowMutation['operation']; row: Record<string, unknown> } }
  | { status: 'stale' | 'unsupported' | 'locked' | 'auth' | 'forbidden' | 'network' | 'invalid' };

export interface ProjectStorageObject {
  bucket: string;
  path: string;
  size: number;
  contentType: string;
  versionId: string;
  updatedAt: number;
}
export interface ProjectStorageObjectPage {
  bucket: string;
  objects: ProjectStorageObject[];
  offset: number;
  hasMore: boolean;
}

/** Export only the loaded, authorized object page, preserving its query scope. */
export function serializeProjectStoragePage(context: SaasContext, projectId: string, prefix: string, page: ProjectStorageObjectPage, capturedAt: string, format: 'json' | 'csv'): string {
  const project = memberProject(context, projectId);
  if (!project || !safePathSegment(page.bucket) || !['json', 'csv'].includes(format)
    || typeof prefix !== 'string' || prefix.includes('\0') || new TextEncoder().encode(prefix).length > 1024
    || !Number.isSafeInteger(page.offset) || page.offset < 0 || page.offset > 1_000_000
    || typeof page.hasMore !== 'boolean' || page.objects.length > 50
    || new Set(page.objects.map(object => object.path)).size !== page.objects.length
    || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString() !== capturedAt) throw new Error('invalid_storage_page_export');
  const objects = page.objects.map(object => {
    if (object.bucket !== page.bucket || !safeStorageObjectPath(object.path) || !object.path.startsWith(prefix)
      || !Number.isSafeInteger(object.size) || object.size < 0
      || !Number.isSafeInteger(object.updatedAt) || object.updatedAt < 0
      || typeof object.contentType !== 'string' || typeof object.versionId !== 'string') throw new Error('invalid_storage_page_export');
    return { path: object.path, size_bytes: object.size, content_type: object.contentType, version_id: object.versionId, updated_at_unix: object.updatedAt };
  });
  const metadata = {
    schema_version: 'w-console.storage-page/v1', workspace_id: project.workspaceId, project_id: projectId,
    bucket: page.bucket, prefix, page_offset: page.offset, page_limit: 50,
    has_more: page.hasMore, returned_count: objects.length, captured_at: capturedAt,
  };
  return format === 'json' ? `${JSON.stringify({ ...metadata, objects }, null, 2)}\n`
    : serializeProjectTableRows(objects.length ? objects.map(object => ({ ...metadata, ...object })) : [metadata], 'csv');
}
export interface ProjectStorageVersion { versionId: string; size: number; contentType: string; modified: string; current: boolean; }

export interface ProjectStorageUsage {
  bucket: string;
  bytesUsed: number;
  objectCount: number;
  quotaBytes?: number | null;
  bytesRemaining?: number | null;
}

export interface ProjectStorageAuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  bucket: string;
  objectPath?: string | null;
  occurredAt: string;
}

export interface ProjectStorageAudit {
  events: ProjectStorageAuditEvent[];
  truncated: boolean;
}

export interface ProjectStorageSignedRead {
  url: string;
  expiresAt: number;
}

/** Exact W-Storage discovery capabilities (camelCase wire form). Lifecycle is currently false upstream. */
export interface ProjectStorageDiscoveryCapabilities {
  objectCrud: boolean;
  bucketCrud: boolean;
  objectBrowser: boolean;
  multipartUploads: boolean;
  versioning: boolean;
  presignedUrls: boolean;
  lifecycle: boolean;
  quotas: boolean;
  managementQuotas: boolean;
  managementObjectVersions: boolean;
  managementObjectRestore: boolean;
  managementAudit: boolean;
}

export interface ProjectStorageDiscovery {
  projectId: string;
  capabilities: ProjectStorageDiscoveryCapabilities;
}

/** One retention/lifecycle rule when upstream lifecycle is available. Never invented when unsupported. */
export interface ProjectStorageLifecycleRule {
  id: string;
  enabled: boolean;
  prefix: string;
  expirationDays?: number | null;
  noncurrentExpirationDays?: number | null;
}

export interface ProjectStorageLifecycle {
  bucket: string;
  supported: boolean;
  unavailableReason?: string;
  rules: ProjectStorageLifecycleRule[];
}

export interface ProjectStorageLifecycleInput {
  bucket: string;
  rules: ProjectStorageLifecycleRule[];
}

/** Allowed signed-read TTLs (seconds) matching W-Storage 1..=3600 contract; console default remains 300. */
export const PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS = [60, 300, 900, 3600] as const;
export type ProjectStorageSignedExpiresIn = (typeof PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS)[number];

export interface ProjectStorageBucketInput {
  id: string;
  name: string;
  public: boolean;
  fileSizeLimit?: number | null;
  objectMimeTypes?: string[] | null;
  quotaBytes?: number | null;
}

export interface ProjectDatabaseBackup {
  backupId: string;
  resourceId: string;
  format: string;
  state: string;
  sizeBytes?: number | null;
  createdAt: string;
  expiresAt?: string | null;
}
export interface ProjectDatabaseBackupDownload { blob: Blob; fileName: string; }

export interface ProjectDatabaseBackups {
  projectId: string;
  resourceId: string;
  backendStatus: 'available' | 'not_configured' | 'unsupported';
  restoreSupported: boolean;
  usage: { items: number; bytes: number; maximumItems: number; quotaExceeded: boolean };
  retentionDays: number;
  capabilities: Record<'create' | 'download' | 'pitr' | 'rollback', { supported: boolean; unavailableReason?: string }>;
  backups: ProjectDatabaseBackup[];
}

export interface ProjectDatabaseRestorePreview { backup: ProjectDatabaseBackup; currentResourceId: string; destructive: boolean; rollbackSupported: boolean; }
export interface ProjectDatabaseAuditEvent { eventKind: 'backup.recorded' | 'backup.created' | 'backup.downloaded' | 'restore.previewed' | 'restore.executed'; objectId: string; state: string; actorId?: string | null; errorCode?: string | null; createdAt: string; }
export interface ProjectDatabaseAudit { events: ProjectDatabaseAuditEvent[]; bounded: true; }

export interface ProjectDatabaseRestore {
  operationId: string;
  backupId: string;
  state: string;
  replayed: boolean;
  errorCode?: string;
  rollbackAvailable?: boolean;
}

export type ProjectPanelState<T> =
  | { status: 'ready'; data: T }
  | { status: 'locked' }
  | { status: 'auth' | 'forbidden' | 'network' | 'invalid' };

export interface ProjectConsoleData {
  auth: ProjectPanelState<{ users: ProjectAuthUser[]; total: number; active: number; blocked: number }>;
  database: ProjectPanelState<{ tables: ProjectDatabaseTable[]; migrations: ProjectMigrationSummary }>;
  storage: ProjectPanelState<{ buckets: ProjectStorageBucket[] }>;
}

export type ProjectKeyMutationResult =
  | { status: 'ready'; metadata?: PublishableKeyMetadata; oneTimeKey?: string }
  | { status: 'error'; reason: DiscoveryFailure };

export interface PageResult<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export interface ProjectListItem extends ConsoleProject {
  workspaceName: string;
}

const CAPABILITY_NAMES: ProjectCapabilityName[] = ['Auth', 'Database', 'Storage', 'Functions'];
export const CONSOLE_PAGE_SIZE = 12;

export type DiscoveryFailure = 'key' | 'auth' | 'forbidden' | 'network' | 'invalid';

export type DiscoveryResult =
  | { status: 'ready'; capabilities: ProjectCapability[]; projectUrl?: string; publishableKeys?: PublishableKeyMetadata[] }
  | { status: 'error'; reason: DiscoveryFailure };

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

export function safeRadarProjectId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ? value : undefined;
}

export function radarProjectUrl(project: ConsoleProject): string | undefined {
  const projectId = safeRadarProjectId(project.radarProjectId);
  return projectId
    ? `https://radar.myfastools.com/dashboard/projects/${encodeURIComponent(projectId)}`
    : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function paginate<T>(items: T[], requestedPage: number, pageSize = CONSOLE_PAGE_SIZE): PageResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  return {
    items: items.slice((page - 1) * safePageSize, page * safePageSize),
    page,
    pageCount,
    total: items.length,
  };
}

/** Pure list projection used by both desktop and mobile project views. */
export function listMemberProjects(
  projects: ConsoleProject[],
  workspaces: WorkspaceMembership[],
  workspaceId: string,
  query: string,
  page: number,
  pageSize = CONSOLE_PAGE_SIZE,
): PageResult<ProjectListItem> {
  const workspaceNames = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const needle = query.trim().toLocaleLowerCase();
  const filtered = projects
    .filter((project) => !workspaceId || project.workspaceId === workspaceId)
    .map((project) => ({ ...project, workspaceName: workspaceNames.get(project.workspaceId) || project.workspaceId }))
    .filter((project) => !needle || [project.name, project.id, project.workspaceName]
      .some((value) => value.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return paginate(filtered, page, pageSize);
}

/** End-user relationships are kept separate and ranked by actual use. */
export function listUsedApps(
  apps: AppRelationship[],
  query: string,
  page: number,
  pageSize = CONSOLE_PAGE_SIZE,
): PageResult<AppRelationship> {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = apps
    .filter((app) => !needle || [app.name, app.clientId].some((value) => value.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => b.loginCount - a.loginCount || b.lastSeenAt - a.lastSeenAt || a.name.localeCompare(b.name));
  return paginate(filtered, page, pageSize);
}

/**
 * Fail closed to current-subject workspace membership. Platform roles never
 * widen project visibility, and unknown fields (including secret-shaped ones)
 * are discarded instead of being retained in browser state.
 */
export function normalizeSaasContext(payload: unknown): SaasContext {
  const root = record(payload);
  const self = record(root?.self);
  const selfUser = record(self?.user);
  const planes = record(root?.authorityPlanes);
  const consoleValue = record(root?.console);
  const memberships = Array.isArray(planes?.workspaceMemberships)
    ? planes.workspaceMemberships.flatMap((value): WorkspaceMembership[] => {
      const item = record(value);
      const id = text(item?.id);
      if (!id) return [];
      return [{
        id,
        name: text(item?.name) || id,
        workspace_type: optionalText(item?.workspace_type) ?? undefined,
        workspaceType: optionalText(item?.workspaceType) ?? undefined,
        role: text(item?.role),
        tier: text(item?.tier),
      }];
    })
    : [];
  const workspaceIds = new Set(memberships.map((workspace) => workspace.id));
  const projects = Array.isArray(consoleValue?.projects)
    ? consoleValue.projects.flatMap((value): ConsoleProject[] => {
      const item = record(value);
      const id = text(item?.id);
      const workspaceId = text(item?.workspaceId);
      if (!id || !workspaceIds.has(workspaceId)) return [];
      return [{
        id,
        workspaceId,
        name: text(item?.name) || id,
        radarProjectId: safeRadarProjectId(item?.radarProjectId),
        workspaceRole: text(item?.workspaceRole),
      }];
    })
    : [];
  const apps = Array.isArray(planes?.appUserRelationships)
    ? planes.appUserRelationships.flatMap((value): AppRelationship[] => {
      const item = record(value);
      const clientId = text(item?.clientId);
      if (!clientId) return [];
      return [{
        clientId,
        name: text(item?.name) || clientId,
        publicUrl: optionalText(item?.publicUrl),
        loginCount: typeof item?.loginCount === 'number' ? item.loginCount : 0,
        lastSeenAt: typeof item?.lastSeenAt === 'number' ? item.lastSeenAt : 0,
        status: text(item?.status),
      }];
    })
    : [];

  return {
    schemaVersion: typeof root?.schemaVersion === 'number' ? root.schemaVersion : 0,
    self: { userId: text(selfUser?.id) },
    authorityPlanes: {
      platformRole: text(planes?.platformRole),
      workspaceMemberships: memberships,
      appUserRelationships: apps,
    },
    console: { projects },
  };
}

export async function loadSaasContext(
  tokenProvider: () => Promise<string | null>,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ConsoleLoadResult> {
  const token = await tokenProvider();
  if (!token) return { status: 'auth' };
  try {
    const response = await request('/api/me/saas-context', {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (response.status === 401) return { status: 'auth' };
    if (!response.ok) return { status: 'error' };
    return { status: 'ready', context: normalizeSaasContext(await response.json()) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'error' };
  }
}

/**
 * Before an explicit authenticated discovery succeeds, deterministic URLs or
 * project membership alone must never be presented as verified capability.
 */
export function undiscoveredProjectCapabilities(): ProjectCapability[] {
  return CAPABILITY_NAMES.map((name) => ({ name, available: false }));
}

function browserSafePublishableKeys(value: unknown): PublishableKeyMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PublishableKeyMetadata[] => {
    const item = record(entry);
    if (!item || item.kind !== 'publishable') return [];
    const id = text(item.id);
    const keyPrefix = text(item.key_prefix);
    if (!id || !keyPrefix || !keyPrefix.startsWith('wid_pk_')) return [];
    return [{
      id,
      name: text(item.name) || id,
      keyPrefix,
      scopes: Array.isArray(item.scopes) ? item.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
      allowedOrigins: Array.isArray(item.allowed_origins) ? item.allowed_origins.filter((origin): origin is string => typeof origin === 'string') : [],
      revokedAt: typeof item.revoked_at === 'number' || item.revoked_at === null ? item.revoked_at : undefined,
      expiresAt: typeof item.expires_at === 'number' || item.expires_at === null ? item.expires_at : undefined,
      overlapExpiresAt: typeof item.overlap_expires_at === 'number' || item.overlap_expires_at === null ? item.overlap_expires_at : undefined,
      ...(/^wid_pk_[A-Za-z0-9_-]+$/.test(text(item.publishable_key)) ? { publishableKey: text(item.publishable_key) } : {}),
      requiresRotation: item.requires_rotation === true,
    }];
  });
}

function browserSafeProjectKeyMetadata(value: unknown): ProjectKeyMetadata[] {
  if (!Array.isArray(value) || value.length > 200) return [];
  return value.flatMap((entry): ProjectKeyMetadata[] => { const item = record(entry); const kind = text(item?.kind); const prefix = text(item?.key_prefix); if (!item || !['publishable', 'server'].includes(kind) || !/^pkey_[A-Za-z0-9_-]+$/.test(text(item.id)) || (kind === 'publishable' ? !prefix.startsWith('wid_pk_') : !prefix.startsWith('wid_sk_'))) return []; return [{ id: text(item.id), name: text(item.name), kind: kind as ProjectKeyMetadata['kind'], keyPrefix: prefix, scopes: Array.isArray(item.scopes) ? item.scopes.filter((scope): scope is string => typeof scope === 'string') : [], allowedOrigins: Array.isArray(item.allowed_origins) ? item.allowed_origins.filter((origin): origin is string => typeof origin === 'string') : [], lastUsedAt: typeof item.last_used_at === 'number' || item.last_used_at === null ? item.last_used_at : undefined, expiresAt: typeof item.expires_at === 'number' || item.expires_at === null ? item.expires_at : undefined, revokedAt: typeof item.revoked_at === 'number' || item.revoked_at === null ? item.revoked_at : undefined, rotatedAt: typeof item.rotated_at === 'number' || item.rotated_at === null ? item.rotated_at : undefined, overlapExpiresAt: typeof item.overlap_expires_at === 'number' || item.overlap_expires_at === null ? item.overlap_expires_at : undefined, createdAt: Number(item.created_at) || 0 }]; });
}

const DEFAULT_BROWSER_KEY_SCOPES = [
  'auth:use',
  'data:read',
  'data:write',
  'storage:read',
  'storage:write',
  'realtime:connect',
  'functions:invoke',
  'sites:read',
  'sites:write',
];

function memberProject(context: SaasContext, projectId: string): ConsoleProject | undefined {
  const project = context.console.projects.find((item) => item.id === projectId);
  return project && context.authorityPlanes.workspaceMemberships.some(
    (workspace) => workspace.id === project.workspaceId,
  ) ? project : undefined;
}

function panelFailure(response: Response): ProjectPanelState<never> | undefined {
  if (response.status === 401) return { status: 'auth' };
  if (response.status === 403 || response.status === 404) return { status: 'forbidden' };
  if (!response.ok) return { status: 'network' };
  return undefined;
}

async function loadProjectAuthUsers(
  project: ConsoleProject,
  bearerToken: string,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectConsoleData['auth']> {
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users?limit=25`, {
      headers: { Authorization: `Bearer ${bearerToken}` }, signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const counts = record(root?.counts);
    if (!root || !Array.isArray(root.data) || root.data.length > 25 || !counts) return { status: 'invalid' };
    const users = root.data.flatMap((value): ProjectAuthUser[] => {
      const item = record(value);
      const userId = text(item?.userId);
      if (!userId) return [];
      return [{
        userId,
        email: optionalText(item?.email),
        displayName: optionalText(item?.displayName),
        status: text(item?.status),
        appRole: text(item?.appRole),
        effectiveTier: text(item?.effectiveTier),
        loginCount: typeof item?.loginCount === 'number' ? item.loginCount : 0,
        lastSeenAt: typeof item?.lastSeenAt === 'number' ? item.lastSeenAt : 0,
      }];
    });
    if (users.length !== root.data.length) return { status: 'invalid' };
    return { status: 'ready', data: {
      users,
      total: typeof counts.total === 'number' ? counts.total : users.length,
      active: typeof counts.active === 'number' ? counts.active : 0,
      blocked: typeof counts.blocked === 'number' ? counts.blocked : 0,
    } };
  } catch {
    return { status: 'network' };
  }
}

function parseProjectAuthUser(value: unknown): ProjectAuthUser | null {
  const item = record(value);
  const userId = text(item?.userId);
  if (!userId) return null;
  return {
    userId,
    email: optionalText(item?.email),
    displayName: optionalText(item?.displayName),
    status: text(item?.status),
    appRole: text(item?.appRole),
    effectiveTier: text(item?.effectiveTier),
    loginCount: typeof item?.loginCount === 'number' ? item.loginCount : 0,
    lastSeenAt: typeof item?.lastSeenAt === 'number' ? item.lastSeenAt : 0,
  };
}

/** Load the exact project's Auth directory and pending SaaS-user invitations. */
export async function loadProjectAuthConsole(
  context: SaasContext,
  projectId: string,
  bearer: string | null,
  request: typeof fetch,
  signal = AbortSignal.timeout(30_000),
  directory: ProjectAuthDirectoryQuery = { offset: 0, status: 'all' },
): Promise<ProjectPanelState<ProjectAuthConsoleData>> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!Number.isSafeInteger(directory.offset) || directory.offset < 0 || !['all', 'active', 'blocked'].includes(directory.status)) return { status: 'invalid' };
  if (!bearer) return { status: 'auth' };
  try {
    signal.throwIfAborted();
    const query = new URLSearchParams({ limit: String(PROJECT_AUTH_PAGE_SIZE + 1), offset: String(directory.offset) });
    if (directory.status !== 'all') query.set('status', directory.status);
    const headers = { Authorization: `Bearer ${bearer}` };
    const usersResponse = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users?${query}`, { headers, credentials: 'same-origin', cache: 'no-store', signal });
    const failure = panelFailure(usersResponse);
    if (failure) return failure;
    const usersRoot = record(await usersResponse.json());
    signal.throwIfAborted();
    if ((usersRoot?.workspaceId !== undefined && usersRoot.workspaceId !== project.workspaceId) || (usersRoot?.projectId !== undefined && usersRoot.projectId !== project.id)) return { status: 'invalid' };
    const counts = record(usersRoot?.counts);
    if (!Array.isArray(usersRoot?.data) || usersRoot.data.length > PROJECT_AUTH_PAGE_SIZE + 1 || !counts) return { status: 'invalid' };
    const users = usersRoot.data.map(parseProjectAuthUser);
    if (users.some((user) => user === null || (directory.status !== 'all' && user.status !== directory.status)) || new Set(users.map((user) => user?.userId)).size !== users.length) return { status: 'invalid' };
    const canManage = project.workspaceRole === 'owner' || project.workspaceRole === 'admin';
    let invitations: ProjectAuthInvitation[] = [];
    if (canManage) {
      const invitationResponse = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/invitations`, { headers, credentials: 'same-origin', cache: 'no-store', signal });
      const invitationFailure = panelFailure(invitationResponse);
      if (invitationFailure) return invitationFailure;
      const invitationRoot = record(await invitationResponse.json());
      if (!Array.isArray(invitationRoot?.data) || invitationRoot.data.length > 500) return { status: 'invalid' };
      invitations = invitationRoot.data.flatMap((value): ProjectAuthInvitation[] => {
        const item = record(value);
        const id = text(item?.id); const email = text(item?.email); const appRole = text(item?.appRole);
        if (!id || !email || (appRole !== 'user' && appRole !== 'admin') || typeof item?.expiresAt !== 'number' || typeof item?.createdAt !== 'number') return [];
        if (text(item?.status) !== 'pending') return [];
        return [{ id, email, appRole, expiresAt: item.expiresAt, createdAt: item.createdAt }];
      });
    }
    return { status: 'ready', data: { users: users.slice(0, PROJECT_AUTH_PAGE_SIZE) as ProjectAuthUser[], offset: directory.offset, hasMore: users.length > PROJECT_AUTH_PAGE_SIZE, total: Number(counts.total) || 0, active: Number(counts.active) || 0, blocked: Number(counts.blocked) || 0, invitations, canManage } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

/** W-ID Auth controls require the live first-party identity bearer and tenant membership. */
export async function loadProjectAuthUserDetail(context: SaasContext, projectId: string, userId: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectAuthUserDetail>> {
  const project = memberProject(context, projectId);
  if (!project || !/^[A-Za-z0-9._-]+$/.test(userId)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${bearer}` }, credentials: 'same-origin', cache: 'no-store', signal });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json()); const data = record(root?.data); const appUser = record(data?.appUser); const policy = record(data?.policy);
    const user = parseProjectAuthUser({ ...appUser, effectiveTier: policy?.effectiveTier });
    if (!user || user.userId !== userId || !Array.isArray(data?.identities) || data.identities.length > 25) return { status: 'invalid' };
    const identities = data.identities.flatMap((value): ProjectAuthIdentity[] => { const item = record(value); const provider = text(item?.providerId); const providerUserId = text(item?.providerUserId); return provider && providerUserId ? [{ provider, providerUserId }] : []; });
    if (identities.length !== data.identities.length) return { status: 'invalid' };
    return { status: 'ready', data: { user, identities, workspaceMemberRole: optionalText(policy?.workspaceMemberRole) } };
  } catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; return { status: 'network' }; }
}

/** Read only the selected app user's project sessions, never token or cookie values. */
export async function loadProjectAuthSessions(context: SaasContext, projectId: string, userId: string, bearer: string | null, request: typeof fetch, signal = AbortSignal.timeout(30_000)): Promise<ProjectPanelState<ProjectAuthSession[]>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || !/^[A-Za-z0-9_-]{1,255}$/.test(userId)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  try {
    signal.throwIfAborted();
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users/${encodeURIComponent(userId)}/sessions`, {
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json());
    if (root?.success !== true || root.schemaVersion !== 1 || root.workspaceId !== project.workspaceId || root.projectId !== project.id || !Array.isArray(root.data) || root.data.length > 100) return { status: 'invalid' };
    const ids = new Set<string>();
    const sessions: ProjectAuthSession[] = [];
    for (const value of root.data) {
      const item = record(value); const id = text(item?.sessionId);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || ids.has(id) || (item?.userAgent !== null && (typeof item?.userAgent !== 'string' || item.userAgent.length > 2048)) || !Number.isSafeInteger(item?.createdAt) || !Number.isSafeInteger(item?.expiresAt) || Number(item?.createdAt) < 0 || Number(item?.expiresAt) <= Number(item?.createdAt) || Number(item?.expiresAt) > 8_640_000_000_000) return { status: 'invalid' };
      ids.add(id); sessions.push({ id, userAgent: item!.userAgent as string | null, createdAt: Number(item!.createdAt), expiresAt: Number(item!.expiresAt) });
    }
    return { status: 'ready', data: sessions };
  } catch { return { status: 'network' }; }
}

/** Revoke one exact-project OAuth session; W-ID also removes its refresh tokens. */
export async function revokeProjectAuthSession(context: SaasContext, projectId: string, userId: string, sessionId: string, bearer: string | null, request: typeof fetch, signal = AbortSignal.timeout(30_000)): Promise<ProjectPanelState<{ sessionId: string }>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || !/^[A-Za-z0-9_-]{1,255}$/.test(userId)) return { status: 'forbidden' };
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) return { status: 'invalid' };
  if (!bearer) return { status: 'auth' };
  try {
    signal.throwIfAborted();
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json());
    return root?.success === true ? { status: 'ready', data: { sessionId } } : { status: 'invalid' };
  } catch { return { status: 'network' }; }
}

/** Change only this project's end-user status; W-ID owns session revocation. */
export async function changeProjectAuthUserStatus(
  context: SaasContext, projectId: string, userId: string, action: 'disable' | 'restore',
  bearer: string | null, request: typeof fetch, signal = AbortSignal.timeout(30_000),
): Promise<ProjectPanelState<{ userId: string; status: 'active' | 'blocked'; revokedSessions: number; revokedRefreshTokens: number }>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || !/^[A-Za-z0-9._-]{1,255}$/.test(userId) || !['disable', 'restore'].includes(action)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users/${encodeURIComponent(userId)}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json()); const data = record(root?.data);
    const status = action === 'disable' ? 'blocked' : 'active';
    const revokedSessions = data?.revokedSessions; const revokedRefreshTokens = data?.revokedRefreshTokens;
    if (root?.success !== true || root.schemaVersion !== 1 || root.workspaceId !== project.workspaceId || root.projectId !== project.id || data?.userId !== userId || data.status !== status || !Number.isSafeInteger(revokedSessions) || Number(revokedSessions) < 0 || !Number.isSafeInteger(revokedRefreshTokens) || Number(revokedRefreshTokens) < 0) return { status: 'invalid' };
    return { status: 'ready', data: { userId, status, revokedSessions: Number(revokedSessions), revokedRefreshTokens: Number(revokedRefreshTokens) } };
  } catch { return { status: 'network' }; }
}

export async function updateProjectAuthUserRole(context: SaasContext, projectId: string, userId: string, appRole: 'user' | 'admin', bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ userId: string; appRole: 'user' | 'admin' }>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || !/^[A-Za-z0-9._-]+$/.test(userId)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/users/${encodeURIComponent(userId)}/app-role`, { method: 'PUT', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ appRole }) }); const failure = panelFailure(response); if (failure) return failure; const root = record(await response.json()); const data = record(root?.data); return data?.userId === userId && data?.appRole === appRole ? { status: 'ready', data: { userId, appRole } } : { status: 'invalid' }; } catch { return { status: 'network' }; }
}

export async function inviteProjectAuthUser(context: SaasContext, projectId: string, email: string, appRole: 'user' | 'admin', locale: 'en' | 'zh-CN', bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ invitation: ProjectAuthInvitation; inviteUrl?: string; deliveryQueued: boolean }>> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/invitations`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ email, appRole, locale }) }); const failure = panelFailure(response); if (failure) return failure; const root = record(await response.json()); const data = record(root?.data); const invitation = data && { id: text(data.id), email: text(data.email), appRole: text(data.appRole) as 'user' | 'admin', expiresAt: Number(data.expiresAt), createdAt: Math.floor(Date.now() / 1000) }; if (!invitation || !invitation.id || !invitation.email || !['user', 'admin'].includes(invitation.appRole) || !Number.isSafeInteger(invitation.expiresAt)) return { status: 'invalid' }; const inviteUrl = safeHttpsUrl(text(data?.inviteUrl)); return { status: 'ready', data: { invitation, ...(inviteUrl ? { inviteUrl } : {}), deliveryQueued: data?.deliveryQueued === true } }; } catch { return { status: 'network' }; }
}

/** Revoke an existing pending end-user invitation in this exact project. */
export async function revokeProjectAuthInvitation(context: SaasContext, projectId: string, invitationId: string, bearer: string | null, request: typeof fetch, signal = AbortSignal.timeout(30_000)): Promise<ProjectPanelState<{ invitationId: string }>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' };
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(invitationId)) return { status: 'invalid' };
  if (!bearer) return { status: 'auth' };
  try {
    signal.throwIfAborted();
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/auth/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response); if (failure) return failure;
    const root = record(await response.json());
    return root?.success === true ? { status: 'ready', data: { invitationId } } : { status: 'invalid' };
  } catch { return { status: 'network' }; }
}

async function loadProjectDatabase(
  project: ConsoleProject,
  publishableKey: string,
  bearerToken: string,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectConsoleData['database']> {
  const headers = { Authorization: `Bearer ${bearerToken}`, apikey: publishableKey };
  try {
    const base = `/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database`;
    const [schemaResponse, migrationsResponse] = await Promise.all([
      request(`${base}/schema`, { headers, signal }),
      request(`${base}/migrations`, { headers, signal }),
    ]);
    const failure = panelFailure(schemaResponse) || panelFailure(migrationsResponse);
    if (failure) return failure;
    const [schemaRoot, migrationRoot] = await Promise.all([schemaResponse.json(), migrationsResponse.json()]);
    const schema = record(schemaRoot);
    const migrations = record(migrationRoot);
    if (!schema || !Array.isArray(schema.schemas) || schema.schemas.length > 50 || !migrations) return { status: 'invalid' };
    let invalidColumns = false;
    const tables = schema.schemas.flatMap((schemaValue): ProjectDatabaseTable[] => {
      const schemaItem = record(schemaValue);
      const schemaName = text(schemaItem?.name);
      if (!schemaName || !Array.isArray(schemaItem?.tables)) return [];
      return schemaItem.tables.flatMap((tableValue): ProjectDatabaseTable[] => {
        const table = record(tableValue);
        const name = text(table?.name);
        if (!name) return [];
        const rawColumns = table?.columns;
        const columns = Array.isArray(rawColumns) && rawColumns.length <= 1600 ? rawColumns.flatMap((value): ProjectDatabaseColumn[] => {
          const column = record(value); const columnName = text(column?.name); const dataType = text(column?.data_type); const ordinal = column?.ordinal;
          if (!columnName || columnName.length > 128 || !dataType || dataType.length > 128 || !Number.isInteger(ordinal) || Number(ordinal) < 1 || Number(ordinal) > 1600 || typeof column?.nullable !== 'boolean' || typeof column.identity !== 'boolean' || typeof column.generated !== 'boolean' || (column.default !== null && typeof column.default !== 'string')) return [];
          return [{ name: columnName, ordinal: Number(ordinal), dataType, nullable: column.nullable, hasDefault: typeof column.default === 'string', identity: column.identity, generated: column.generated }];
        }) : [];
        if (!Array.isArray(rawColumns) || columns.length !== rawColumns.length || new Set(columns.map(column => column.name)).size !== columns.length || new Set(columns.map(column => column.ordinal)).size !== columns.length) invalidColumns = true;
        return [{
          schema: schemaName,
          name,
          rlsEnabled: table?.rls_enabled === true,
          rlsForced: table?.rls_forced === true,
          columnCount: Array.isArray(table?.columns) ? table.columns.length : 0,
          policyCount: Array.isArray(table?.policies) ? table.policies.length : 0,
          columns: columns.sort((a, b) => a.ordinal - b.ordinal),
        }];
      });
    });
    if (invalidColumns || tables.length > 500) return { status: 'invalid' };
    return { status: 'ready', data: {
      tables,
      migrations: {
        initialized: migrations.initialized === true,
        count: typeof migrations.count === 'number' ? migrations.count : 0,
        lastAppliedAt: optionalText(migrations.last_applied_at),
      },
    } };
  } catch {
    return { status: 'network' };
  }
}

async function loadProjectStorage(
  project: ConsoleProject,
  publishableKey: string,
  bearerToken: string,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectConsoleData['storage']> {
  try {
    const response = await request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets`, {
      headers: { Authorization: `Bearer ${bearerToken}`, apikey: publishableKey }, signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length > 200) return { status: 'invalid' };
    const buckets = payload.flatMap((value): ProjectStorageBucket[] => {
      const item = record(value);
      const id = text(item?.id);
      if (!id) return [];
      return [{
        id,
        name: text(item?.name) || id,
        public: item?.public === true,
        fileSizeLimit: typeof item?.file_size_limit === 'number' || item?.file_size_limit === null ? item.file_size_limit : undefined,
        objectMimeTypes: Array.isArray(item?.allowed_mime_types) ? item.allowed_mime_types.filter((mime): mime is string => typeof mime === 'string') : [],
        quotaBytes: typeof item?.quota_bytes === 'number' || item?.quota_bytes === null ? item.quota_bytes : undefined,
      }];
    });
    if (buckets.length !== payload.length) return { status: 'invalid' };
    return { status: 'ready', data: { buckets } };
  } catch {
    return { status: 'network' };
  }
}

export interface ProjectManagementToken {
  accessToken: string;
  expiresAt: number;
}

const PROJECT_MANAGEMENT_TOKEN_CLOCK_SKEW_SECONDS = 60;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (token.length > 16_384) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const encoded = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return record(JSON.parse(atob(padded)));
  } catch {
    return null;
  }
}

/** Exchange only the current W-ID session token for a five-minute exact-project token. */
export async function exchangeProjectManagementToken(
  project: ConsoleProject,
  bearerToken: string,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<{ status: 'ready'; token: ProjectManagementToken } | { status: 'auth' | 'forbidden' | 'network' | 'invalid' }> {
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/management-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}` },
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401) return { status: 'auth' };
    if (response.status === 403 || response.status === 404) return { status: 'forbidden' };
    if (!response.ok) return { status: 'network' };
    const payload = record(await response.json());
    const accessToken = text(payload?.access_token);
    const tokenType = text(payload?.token_type);
    const expiresIn = payload?.expires_in;
    const claims = decodeJwtPayload(accessToken);
    const audience = claims?.aud;
    const issuedAt = claims?.iat;
    const expiresAt = claims?.exp;
    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = expiresIn as number;
    const issuedAtSeconds = issuedAt as number;
    const tokenLifetime = (expiresAt as number) - issuedAtSeconds;
    if (
      tokenType !== 'Bearer'
      || !Number.isInteger(expiresIn)
      || (expiresIn as number) < 1
      || (expiresIn as number) > 300
      || audience !== project.id
      || !Number.isInteger(issuedAt)
      || !Number.isInteger(expiresAt)
      || Math.abs(issuedAtSeconds - now) > PROJECT_MANAGEMENT_TOKEN_CLOCK_SKEW_SECONDS
      || (expiresAt as number) <= now
      || tokenLifetime < 1
      || tokenLifetime > 300
      || tokenLifetime !== expiresInSeconds
    ) return { status: 'invalid' };
    return { status: 'ready', token: { accessToken, expiresAt: expiresAt as number } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

/** Load allowlisted project-console projections; the one-time key stays only in caller memory. */
export async function loadProjectConsoleData(
  context: SaasContext,
  projectId: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectConsoleData> {
  const project = memberProject(context, projectId);
  if (!project) {
    const forbidden = { status: 'forbidden' as const };
    return { auth: forbidden, database: forbidden, storage: forbidden };
  }
  if (!bearerToken) {
    const auth = { status: 'auth' as const };
    return { auth, database: auth, storage: auth };
  }
  const auth = loadProjectAuthUsers(project, bearerToken, request, signal);
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    return { auth: await auth, database: { status: 'locked' }, storage: { status: 'locked' } };
  }
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') {
    return { auth: await auth, database: management, storage: management };
  }
  const [authResult, database, storage] = await Promise.all([
    auth,
    loadProjectDatabase(project, publishableKey, management.token.accessToken, request, signal),
    loadProjectStorage(project, publishableKey, management.token.accessToken, request, signal),
  ]);
  return { auth: authResult, database, storage };
}

/** Load only the Database catalog for the dedicated Database plane. */
export async function loadProjectDatabaseCatalog(context: SaasContext, projectId: string, publishableKey: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectConsoleData['database']> {
  const project = memberProject(context, projectId); if (!project) return { status: 'forbidden' }; if (!bearerToken) return { status: 'auth' }; if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal); if (management.status !== 'ready') return management;
  signal?.throwIfAborted();
  return loadProjectDatabase(project, publishableKey, management.token.accessToken, request, signal);
}

function safePathSegment(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

/** Browse one RLS-protected table through the exact project management audience. */
export async function loadProjectTableRows(
  context: SaasContext,
  projectId: string,
  schema: string,
  table: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal: AbortSignal = AbortSignal.timeout(30_000),
  offset = 0,
  exactCount = false,
  query: ProjectTableQuery = { filters: [] },
): Promise<ProjectPanelState<ProjectTableRows>> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) return { status: 'invalid' };
  const queryParams = projectTableQueryParams(query);
  if (queryParams === null) return { status: 'invalid' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  signal.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/rows?limit=25&offset=${offset}${exactCount ? '&count=exact' : ''}${queryParams ? `&${queryParams}` : ''}`, {
      headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey },
      cache: 'no-store',
      signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const payload = record(await response.json());
    if (!payload || payload.schema !== schema || payload.table !== table || payload.limit !== 25 || payload.offset !== offset || typeof payload.has_more !== 'boolean' || !Array.isArray(payload.rows) || payload.rows.length > 25) return { status: 'invalid' };
    if (payload.has_more ? payload.next_offset !== offset + 25 || Number(payload.next_offset) > 1_000_000 : payload.next_offset !== null) return { status: 'invalid' };
    const rows = payload.rows.flatMap((value): Record<string, unknown>[] => {
      const item = record(value);
      return item ? [item] : [];
    });
    if (rows.length !== payload.rows.length) return { status: 'invalid' };
    let totalRows: number | undefined;
    if (Object.hasOwn(payload, 'total_rows')) {
      if (!Number.isSafeInteger(payload.total_rows) || Number(payload.total_rows) < 0) return { status: 'invalid' };
      totalRows = payload.total_rows as number;
      const pageEnd = offset + rows.length;
      if (rows.length === 0
        ? payload.has_more || totalRows > offset
        : totalRows < pageEnd || (payload.has_more ? totalRows <= pageEnd : totalRows > pageEnd)) return { status: 'invalid' };
    } else if (exactCount) return { status: 'invalid' };
    return { status: 'ready', data: {
      schema,
      table,
      rows,
      hasMore: payload.has_more === true,
      nextOffset: typeof payload.next_offset === 'number' || payload.next_offset === null ? payload.next_offset : undefined,
      ...(totalRows === undefined ? {} : { totalRows }),
    } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

/** Read the bounded, project-scoped TypeScript projection for published database tables. */
export async function loadProjectDatabaseTypes(
  context: SaasContext,
  projectId: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal: AbortSignal = AbortSignal.timeout(30_000),
): Promise<ProjectPanelState<ProjectDatabaseTypes>> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  signal.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/types`, {
      headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey },
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const payload = record(await response.json());
    if (payload?.schema_version !== 'w-db.database-types/v1'
      || payload.project_id !== project.id
      || payload.language !== 'typescript'
      || payload.filename !== 'database.types.ts'
      || typeof payload.content !== 'string') return { status: 'invalid' };
    const contentBytes = new TextEncoder().encode(payload.content).byteLength;
    if (contentBytes === 0 || contentBytes > 512 * 1024) return { status: 'invalid' };
    return { status: 'ready', data: { filename: 'database.types.ts', content: payload.content } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

async function databaseManagementRequest<T>(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, invoke: (project: ConsoleProject, headers: Record<string, string>) => Promise<Response>, parse: (response: Response) => Promise<T | null>): Promise<ProjectPanelState<T>> {
  const project = memberProject(context, projectId); if (!project) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' }; if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearer, request); if (management.status !== 'ready') return management;
  try { const response = await invoke(project, { Authorization: `Bearer ${management.token.accessToken}`, apikey: key }); const failure = panelFailure(response); if (failure) return failure; const data = await parse(response); return data === null ? { status: 'invalid' } : { status: 'ready', data }; } catch { return { status: 'network' }; }
}

export async function loadProjectMigrations(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectMigrationInventory>> {
  return databaseManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/migrations`, { headers, cache: 'no-store' }), async (response) => { const root = record(await response.json()); if (root?.schema_version !== 'w-db.migrations/v1' || typeof root?.count !== 'number' || !Array.isArray(root?.migrations) || root.migrations.length > 100) return null; const migrations = root.migrations.flatMap((value): ProjectAppliedMigration[] => { const item = record(value); const version = text(item?.version); const checksum = text(item?.checksum); const appliedAt = text(item?.applied_at); return version && checksum && appliedAt ? [{ version, checksum, appliedAt }] : []; }); if (migrations.length !== root.migrations.length) return null; return { initialized: root.initialized === true, count: root.count, truncated: root.truncated === true, lastAppliedAt: optionalText(root.last_applied_at), migrations }; });
}

async function databaseManagerOperation<T>(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, invoke: (project: ConsoleProject, headers: Record<string, string>) => Promise<Response>, parse: (response: Response) => Promise<T | null>): Promise<ProjectDatabaseOperation<T>> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' }; if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearer, request); if (management.status !== 'ready') return management;
  try { const response = await invoke(project, { Authorization: `Bearer ${management.token.accessToken}`, apikey: key }); if (response.status === 409) return { status: 'drift' }; if (response.status === 422) return { status: 'rolled_back' }; if (response.status === 400) return { status: 'rejected' }; const failure = panelFailure(response); if (failure) return failure; const data = await parse(response); return data === null ? { status: 'invalid' } : { status: 'ready', data }; } catch { return { status: 'network' }; }
}

function boundedSqlRows(value: unknown, reportedBytes: unknown): ProjectSqlResult | null { const root = record(value); if (!root || !Array.isArray(root.rows) || root.rows.length > 100 || typeof root.truncated !== 'boolean' || typeof reportedBytes !== 'number' || !Number.isSafeInteger(reportedBytes) || reportedBytes < 0 || reportedBytes > 262_144) return null; const rows = root.rows.flatMap((value): Array<Record<string, unknown>> => { const item = record(value); return item && Object.keys(item).length <= 32 ? [item] : []; }); if (rows.length !== root.rows.length) return null; try { if (new TextEncoder().encode(JSON.stringify(rows)).byteLength > 262_144) return null; } catch { return null; } return { rows, truncated: root.truncated, bytes: reportedBytes }; }

export async function previewProjectSql(context: SaasContext, projectId: string, sql: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectDatabaseOperation<ProjectSqlPreview>> { if (sql.trim().length < 1 || new TextEncoder().encode(sql).byteLength > 65_536) return { status: 'invalid' }; return databaseManagerOperation(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/sql`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ mode: 'preview', sql }) }), async (response) => { const root = record(await response.json()); const limits = record(root?.limits); return root?.valid === true && root?.project_id === projectId && limits && limits.rows === 100 && limits.columns === 32 && limits.bytes === 262144 ? { valid: true, projectId, limits: { rows: 100, columns: 32, bytes: 262_144, statementTimeoutMs: Number(limits.statement_timeout_ms) || 0, lockTimeoutMs: Number(limits.lock_timeout_ms) || 0 } } : null; }); }

export async function executeProjectSql(context: SaasContext, projectId: string, sql: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectDatabaseOperation<ProjectSqlResult>> { if (sql.trim().length < 1 || new TextEncoder().encode(sql).byteLength > 65_536) return { status: 'invalid' }; return databaseManagerOperation(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/sql`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ mode: 'execute', sql }) }), async (response) => { const root = record(await response.json()); return boundedSqlRows(root, root?.bytes); }); }

function validMigrationFiles(files: ProjectMigrationFile[]): boolean { if (files.length < 1 || files.length > 16) return false; let total = 0; const names = new Set<string>(); for (const file of files) { const bytes = new TextEncoder().encode(file.sql).byteLength; total += bytes; if (!/^\d{1,20}_[A-Za-z0-9_-]{1,96}\.sql$/.test(file.name) || names.has(file.name) || bytes < 1 || bytes > 65_536 || total > 262_144) return false; names.add(file.name); } return true; }
export function parseProjectMigrationFiles(value: string): ProjectMigrationFile[] | null { try { const parsed: unknown = JSON.parse(value); if (!Array.isArray(parsed)) return null; const files = parsed.flatMap((entry): ProjectMigrationFile[] => { const item = record(entry); return item && typeof item.name === 'string' && typeof item.sql === 'string' ? [{ name: item.name, sql: item.sql }] : []; }); return files.length === parsed.length && validMigrationFiles(files) ? files : null; } catch { return null; } }

export async function processProjectMigrations(context: SaasContext, projectId: string, mode: 'preview' | 'apply', files: ProjectMigrationFile[], key: string, bearer: string | null, request: typeof fetch): Promise<ProjectDatabaseOperation<ProjectMigrationReport>> { if (!validMigrationFiles(files)) return { status: 'invalid' }; return databaseManagerOperation(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/migrations`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ mode, files }) }), async (response) => { const root = record(await response.json()); const report = record(root?.report); if (root?.mode !== mode || !report) return null; if (mode === 'preview') { if (!Array.isArray(report.versions) || !Array.isArray(report.checksums) || report.versions.length !== report.checksums.length || report.versions.length > 16 || report.versions.some((item) => typeof item !== 'string') || report.checksums.some((item) => typeof item !== 'string') || typeof report.total_bytes !== 'number' || report.total_bytes > 262_144) return null; return { mode, versions: report.versions as string[], checksums: report.checksums as string[], totalBytes: report.total_bytes, applied: [], alreadyApplied: [] }; } if (!Array.isArray(report.applied) || !Array.isArray(report.already_applied) || report.applied.length > 16 || report.already_applied.length > 16 || [...report.applied, ...report.already_applied].some((item) => typeof item !== 'string')) return null; return { mode, versions: [], checksums: [], applied: report.applied as string[], alreadyApplied: report.already_applied as string[] }; }); }

function parseRlsPolicy(value: unknown): ProjectRlsPolicy | null { const item = record(value); const name = text(item?.name); const command = text(item?.command); if (!name || !command || !Array.isArray(item?.roles) || item.roles.some((role) => typeof role !== 'string')) return null; return { name, permissive: item?.permissive === true, roles: item.roles as string[], command, usingExpression: optionalText(item.using_expression), checkExpression: optionalText(item.check_expression) }; }

export async function loadProjectRlsPolicies(context: SaasContext, projectId: string, schema: string, table: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ schema: string; table: string; policies: ProjectRlsPolicy[] }>> {
  if (!validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  return databaseManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/policies`, { headers, cache: 'no-store' }), async (response) => { const root = record(await response.json()); if (!Array.isArray(root?.policies) || root.policies.length > 100) return null; const policies = root.policies.map(parseRlsPolicy); return policies.some((policy) => policy === null) ? null : { schema, table, policies: policies as ProjectRlsPolicy[] }; });
}

function validRlsInput(input: ProjectRlsPolicyInput): boolean { return validProjectTableIdentifier(input.name) && validProjectTableIdentifier(input.rule.column) && ['all', 'select', 'insert', 'update', 'delete'].includes(input.command) && ['w_id_subject_column', 'w_project_column'].includes(input.rule.kind); }

export async function saveProjectRlsPolicy(context: SaasContext, projectId: string, schema: string, table: string, oldName: string | null, input: ProjectRlsPolicyInput, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectRlsPolicy>> {
  if (!validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table) || (oldName !== null && !validProjectTableIdentifier(oldName)) || !validRlsInput(input)) return { status: 'invalid' };
  return databaseManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/policies${oldName === null ? '' : `/${encodeProjectTableIdentifier(oldName)}`}`, { method: oldName === null ? 'POST' : 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store' }), async (response) => parseRlsPolicy(await response.json()));
}

export async function deleteProjectRlsPolicy(context: SaasContext, projectId: string, schema: string, table: string, name: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ name: string }>> {
  if (!validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table) || !validProjectTableIdentifier(name)) return { status: 'invalid' };
  return databaseManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/policies/${encodeProjectTableIdentifier(name)}`, { method: 'DELETE', headers, cache: 'no-store' }), async (response) => response.status === 204 ? { name } : null);
}

function boundedRowObject(value: Record<string, unknown>, maxFields: number): boolean {
  const keys = Object.keys(value);
  if (keys.length < 1 || keys.length > maxFields || keys.some((key) => !validProjectTableIdentifier(key))) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 32_768;
  } catch {
    return false;
  }
}

export type ProjectTableImportReceipt = { mutationId: string; schema: string; table: string; affectedRows: number };
export type ProjectTableImportResult = ProjectPanelState<ProjectTableImportReceipt> | { status: 'unsupported' | 'unknown' };
export const PROJECT_TABLE_IMPORT_MAX_BYTES = 1_048_576;

/** A bounded JSON array; omitted fields, explicit null and typed values stay distinct. */
export function parseProjectTableImport(input: string): Record<string, unknown>[] | null {
  if (new TextEncoder().encode(input).byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES) return null;
  try {
    const values: unknown = JSON.parse(input);
    if (!Array.isArray(values) || values.length < 1 || values.length > 100) return null;
    const rows = values.map(record);
    if (rows.some((row) => !row || !boundedRowObject(row, 64)) || new TextEncoder().encode(JSON.stringify({ rows })).byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES) return null;
    return rows as Record<string, unknown>[];
  } catch { return null; }
}

/** One atomic write; an uncertain response must be reconciled before a new import. */
export async function importProjectTableRows(context: SaasContext, projectId: string, schema: string, table: string, publishableKey: string, bearerToken: string | null, rows: Record<string, unknown>[], request: typeof fetch, signal?: AbortSignal): Promise<ProjectTableImportResult> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  let body: string;
  try {
    body = JSON.stringify({ rows });
    if (!parseProjectTableImport(JSON.stringify(rows)) || new TextEncoder().encode(body).byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES) return { status: 'invalid' };
  } catch { return { status: 'invalid' }; }
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  signal?.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/rows/batch`, {
      method: 'POST', headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey, 'Content-Type': 'application/json' }, body, credentials: 'same-origin', cache: 'no-store', signal,
    });
    if ([404, 405, 501].includes(response.status)) return { status: 'unsupported' };
    if (response.status === 401) return { status: 'auth' };
    if (response.status === 403) return { status: 'forbidden' };
    if ([400, 413, 415, 422].includes(response.status)) return { status: 'invalid' };
    if (!response.ok) return { status: 'unknown' };
    const payload = record(await response.json());
    const mutationId = text(payload?.mutation_id);
    if (payload?.schema_version !== 'w-db.row-batch-mutation/v1' || payload.operation !== 'insert_batch'
      || payload.schema !== schema || payload.table !== table || payload.affected_rows !== rows.length
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationId)
      || !Array.isArray(payload.rows) || payload.rows.length !== rows.length || payload.rows.some((row) => !record(row))) return { status: 'unknown' };
    return { status: 'ready', data: { mutationId, schema, table, affectedRows: rows.length } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'unknown' };
  }
}

export type ProjectTableDeleteTarget = { id: string; expected: Record<string, unknown> };
export type ProjectTableDeleteResult = ProjectPanelState<ProjectTableImportReceipt> | { status: 'stale' | 'unsupported' | 'unknown' };

/** One atomic deletion with per-row snapshots; never replay an uncertain write. */
export async function deleteProjectTableRows(context: SaasContext, projectId: string, schema: string, table: string, publishableKey: string, bearerToken: string | null, rows: readonly ProjectTableDeleteTarget[], request: typeof fetch, signal?: AbortSignal): Promise<ProjectTableDeleteResult> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  let body: string;
  try {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100 || new Set(rows.map(row => row.id)).size !== rows.length
      || rows.some(row => typeof row.id !== 'string' || row.id.length < 1 || row.id.length > 512 || !record(row.expected) || !boundedRowObject(row.expected, 8))) return { status: 'invalid' };
    body = JSON.stringify({ operation: 'delete_batch', rows });
    if (new TextEncoder().encode(body).byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES) return { status: 'invalid' };
  } catch { return { status: 'invalid' }; }
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  signal?.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/rows/batch`, {
      method: 'POST', headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey, 'Content-Type': 'application/json' }, body, credentials: 'same-origin', cache: 'no-store', signal,
    });
    if (response.status === 412) return { status: 'stale' };
    if ([404, 405, 501].includes(response.status)) return { status: 'unsupported' };
    if (response.status === 401) return { status: 'auth' };
    if (response.status === 403) return { status: 'forbidden' };
    if ([400, 413, 415, 422].includes(response.status)) return { status: 'invalid' };
    if (!response.ok) return { status: 'unknown' };
    const payload = record(await response.json());
    const mutationId = text(payload?.mutation_id);
    if (payload?.schema_version !== 'w-db.row-batch-mutation/v1' || payload.operation !== 'delete_batch'
      || payload.schema !== schema || payload.table !== table || payload.affected_rows !== rows.length
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationId)
      || !Array.isArray(payload.rows) || payload.rows.length !== rows.length || payload.rows.some(row => !record(row))) return { status: 'unknown' };
    return { status: 'ready', data: { mutationId, schema, table, affectedRows: rows.length } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'unknown' };
  }
}

/** Parse a typed JSON object without coercing strings, numbers, booleans or null. */
export function parseProjectRowValues(input: string, maxFields = 64): Record<string, unknown> | null {
  try {
    const value = record(JSON.parse(input));
    return value && boundedRowObject(value, maxFields) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Mutate one RLS-protected row. Every call exchanges the current W-ID session
 * for a new <=5 minute exact-project token; neither token nor row values are
 * retained outside the caller's React memory.
 */
export async function mutateProjectTableRow(
  context: SaasContext,
  projectId: string,
  schema: string,
  table: string,
  publishableKey: string,
  bearerToken: string | null,
  mutation: ProjectRowMutation,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectRowMutationResult> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  if (
    (mutation.operation === 'insert' && !boundedRowObject(mutation.values, 64))
    || (mutation.operation === 'update' && (
      mutation.id.length < 1 || mutation.id.length > 512
      || !boundedRowObject(mutation.expected, 8)
      || !boundedRowObject(mutation.values, 64)
    ))
    || (mutation.operation === 'delete' && (
      mutation.id.length < 1 || mutation.id.length > 512
      || !boundedRowObject(mutation.expected, 8)
    ))
  ) return { status: 'invalid' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  signal?.throwIfAborted();
  const method = mutation.operation === 'insert' ? 'POST' : mutation.operation === 'update' ? 'PATCH' : 'DELETE';
  const body = mutation.operation === 'insert'
    ? { values: mutation.values }
    : mutation.operation === 'update'
      ? { id: mutation.id, expected: mutation.expected, values: mutation.values }
      : { id: mutation.id, expected: mutation.expected };
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/rows`, {
      method,
      headers: {
        Authorization: `Bearer ${management.token.accessToken}`,
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (response.status === 412) return { status: 'stale' };
    if ([404, 405, 501].includes(response.status)) return { status: 'unsupported' };
    const failure = panelFailure(response);
    if (failure) return failure;
    const payload = record(await response.json());
    const row = record(payload?.row);
    const mutationId = text(payload?.mutation_id);
    if (
      payload?.schema_version !== 'w-db.row-mutation/v1'
      || payload?.operation !== mutation.operation
      || payload?.affected_rows !== 1
      || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(mutationId)
      || !row
    ) return { status: 'invalid' };
    return { status: 'ready', data: { mutationId, operation: mutation.operation, row } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

/** List allowlisted object metadata; object bodies and provider credentials never enter this response. */
export async function loadProjectStorageObjects(
  context: SaasContext,
  projectId: string,
  bucket: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal?: AbortSignal,
  offset = 0,
  prefix = '',
): Promise<ProjectPanelState<ProjectStorageObjectPage>> {
  const project = memberProject(context, projectId);
  if (!project || !safePathSegment(bucket)) return { status: 'forbidden' };
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000 || offset % 50 !== 0 || new TextEncoder().encode(prefix).byteLength > 1024 || prefix.includes('\0')) return { status: 'invalid' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  try {
    const response = await request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 51, offset }),
      cache: 'no-store',
      signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length > 51) return { status: 'invalid' };
    const objects = payload.flatMap((value): ProjectStorageObject[] => {
      const item = record(value);
      const path = text(item?.path);
      if (!safeStorageObjectPath(path) || !path.startsWith(prefix) || item?.bucket !== bucket || typeof item?.size !== 'number' || !Number.isSafeInteger(item.size) || item.size < 0) return [];
      return [{
        bucket,
        path,
        size: item.size,
        contentType: text(item.content_type),
        versionId: text(item.version_id),
        updatedAt: typeof item.updated_at_unix === 'number' ? item.updated_at_unix : 0,
      }];
    });
    if (objects.length !== payload.length) return { status: 'invalid' };
    return { status: 'ready', data: { bucket, objects: objects.slice(0, 50), offset, hasMore: objects.length > 50 && offset < 1_000_000 } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

export async function loadProjectStorageVersions(context: SaasContext, projectId: string, bucket: string, path: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<{ bucket: string; path: string; versions: ProjectStorageVersion[]; truncated?: boolean }>> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path)) return { status: 'forbidden' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const boundedRequest: typeof fetch = (input, init) => { requestSignal.throwIfAborted(); return request(input, { ...init, signal: requestSignal }); };
  return storageManagementRequest(context, projectId, key, bearer, boundedRequest, (project, headers) => boundedRequest(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/versions/${path.split('/').map(encodeURIComponent).join('/')}`, { headers, cache: 'no-store' }), async (response) => {
    const root = record(await response.json());
    if (root?.bucket !== bucket || root?.path !== path || !Array.isArray(root?.versions) || root.versions.length > 100 || (root.truncated !== undefined && typeof root.truncated !== 'boolean')) return null;
    const versions: ProjectStorageVersion[] = [];
    const ids = new Set<string>();
    for (const entry of root.versions) {
      const item = record(entry); const versionId = text(item?.version_id);
      if (!item || !/^[a-fA-F0-9]{32}$/.test(versionId) || ids.has(versionId.toLowerCase()) || typeof item.size !== 'number' || !Number.isSafeInteger(item.size) || item.size < 0 || typeof item.current !== 'boolean') return null;
      ids.add(versionId.toLowerCase()); versions.push({ versionId, size: item.size, contentType: text(item.content_type), modified: text(item.modified), current: item.current });
    }
    if (versions.filter((version) => version.current).length > 1) return null;
    return { bucket, path, versions, ...(root.truncated === true ? { truncated: true } : {}) };
  }, requestSignal);
}

export async function restoreProjectStorageVersion(context: SaasContext, projectId: string, bucket: string, path: string, versionId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<{ versionId: string }>> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path) || !/^[a-fA-F0-9]{32}$/.test(versionId)) return { status: 'forbidden' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const boundedRequest: typeof fetch = (input, init) => { requestSignal.throwIfAborted(); return request(input, { ...init, signal: requestSignal }); };
  return storageManagementRequest(context, projectId, key, bearer, boundedRequest, (project, headers) => boundedRequest(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/restore/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ version_id: versionId }), cache: 'no-store' }), async (response) => {
    const root = record(await response.json()); const restored = text(root?.version_id);
    return /^[a-fA-F0-9]{32}$/.test(restored) ? { versionId: restored } : null;
  }, requestSignal);
}

function safeStorageObjectPath(path: string): boolean {
  return path.length > 0 && new TextEncoder().encode(path).byteLength <= 1024 && !path.includes('\0') && !path.split('/').some((part) => part === '.' || part === '..');
}

function storageHeaders(token: string, key: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, apikey: key };
}

async function storageManagementRequest<T>(
  context: SaasContext,
  projectId: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
  invoke: (project: ConsoleProject, headers: Record<string, string>) => Promise<Response>,
  parse: (response: Response) => Promise<T | null>,
  signal?: AbortSignal,
): Promise<ProjectPanelState<T>> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearer, request, signal);
  if (management.status !== 'ready') return management;
  try {
    const response = await invoke(project, storageHeaders(management.token.accessToken, key));
    const failure = panelFailure(response);
    if (failure) return failure;
    const data = await parse(response);
    return data == null ? { status: 'invalid' } : { status: 'ready', data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

function parseStorageBucket(value: unknown): ProjectStorageBucket | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const rawMimeTypes = item?.allowed_mime_types == null ? [] : item.allowed_mime_types;
  if (!id || !safePathSegment(id) || !name || !Array.isArray(rawMimeTypes) || rawMimeTypes.length > 100 || rawMimeTypes.some((mime) => typeof mime !== 'string')) return null;
  const fileSizeLimit = item?.file_size_limit;
  const quotaBytes = item?.quota_bytes;
  if (!(fileSizeLimit == null || (typeof fileSizeLimit === 'number' && Number.isSafeInteger(fileSizeLimit) && fileSizeLimit > 0))) return null;
  if (!(quotaBytes == null || (typeof quotaBytes === 'number' && Number.isSafeInteger(quotaBytes) && quotaBytes > 0))) return null;
  return { id, name, public: item?.public === true, fileSizeLimit, objectMimeTypes: rawMimeTypes as string[], quotaBytes };
}

function validBucketInput(input: ProjectStorageBucketInput): boolean {
  return safePathSegment(input.id)
    && input.name.length > 0 && input.name.length <= 128
    && (input.fileSizeLimit == null || (Number.isSafeInteger(input.fileSizeLimit) && input.fileSizeLimit > 0))
    && (input.quotaBytes == null || (Number.isSafeInteger(input.quotaBytes) && input.quotaBytes > 0))
    && (input.objectMimeTypes == null || (input.objectMimeTypes.length <= 100 && input.objectMimeTypes.every((mime) => mime.length > 0 && mime.length <= 128)));
}

/** Read the current inventory for explicit management-write reconciliation. */
export async function loadProjectStorageBuckets(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectStorageBucket[]>> {
  return storageManagementRequest(context, projectId, key, bearer, request,
    (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets`, { headers, cache: 'no-store' }),
    async response => {
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || payload.length > 200) return null;
      const buckets = payload.map(parseStorageBucket);
      if (buckets.some(bucket => !bucket) || new Set(buckets.map(bucket => bucket?.id)).size !== buckets.length) return null;
      return buckets as ProjectStorageBucket[];
    });
}

export async function createProjectStorageBucket(context: SaasContext, projectId: string, input: ProjectStorageBucketInput, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectStorageBucket>> {
  if (!validBucketInput(input)) return { status: 'invalid' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: input.id, name: input.name, public: input.public, file_size_limit: input.fileSizeLimit ?? null, allowed_mime_types: input.objectMimeTypes?.length ? input.objectMimeTypes : null, quota_bytes: input.quotaBytes ?? null }), cache: 'no-store' }), async (response) => { const bucket = parseStorageBucket(await response.json()); return bucket?.id === input.id ? bucket : null; });
}

export async function updateProjectStorageBucket(context: SaasContext, projectId: string, input: ProjectStorageBucketInput, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectStorageBucket>> {
  if (!validBucketInput(input)) return { status: 'invalid' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(input.id)}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, public: input.public, file_size_limit: input.fileSizeLimit ?? null, allowed_mime_types: input.objectMimeTypes?.length ? input.objectMimeTypes : null, quota_bytes: input.quotaBytes ?? null }), cache: 'no-store' }), async (response) => { const bucket = parseStorageBucket(await response.json()); return bucket?.id === input.id ? bucket : null; });
}

export async function deleteProjectStorageBucket(context: SaasContext, projectId: string, bucket: string, confirmation: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ bucket: string }>> {
  if (!safePathSegment(bucket) || confirmation !== bucket) return { status: 'invalid' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}`, { method: 'DELETE', headers, cache: 'no-store' }), async (response) => response.status === 204 ? { bucket } : null);
}

export async function loadProjectStorageUsage(context: SaasContext, projectId: string, bucket: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectStorageUsage>> {
  if (!safePathSegment(bucket)) return { status: 'forbidden' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/usage`, { headers, cache: 'no-store' }), async (response) => {
    const root = record(await response.json());
    if (root?.bucket !== bucket || typeof root?.bytes_used !== 'number' || typeof root?.object_count !== 'number' || !Number.isSafeInteger(root.bytes_used) || !Number.isSafeInteger(root.object_count)) return null;
    if (!(root.quota_bytes == null || (typeof root.quota_bytes === 'number' && Number.isSafeInteger(root.quota_bytes)))) return null;
    if (!(root.bytes_remaining == null || (typeof root.bytes_remaining === 'number' && Number.isSafeInteger(root.bytes_remaining)))) return null;
    return { bucket, bytesUsed: root.bytes_used, objectCount: root.object_count, quotaBytes: root.quota_bytes, bytesRemaining: root.bytes_remaining };
  });
}

export interface ProjectStorageUploadItem { path: string; file: File; }

/** Files use an exact key or flat prefix; folders retain the selected root and hierarchy. */
export function prepareProjectStorageUploads(files: readonly File[], destination: string, folder = false): ProjectStorageUploadItem[] | null {
  if (files.length < 1 || files.length > 100) return null;
  const prefix = destination.trim().replace(/\/$/, '');
  const relative = (path: string) => safeStorageObjectPath(path) && !path.includes('\\') && !Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && path.split('/').every(part => part.length > 0);
  if ((files.length > 1 || folder) && destination.trim() && !(folder ? relative(prefix) : safeStorageObjectPath(prefix))) return null;
  if (folder && files.some(file => !relative(file.webkitRelativePath) || !file.webkitRelativePath.includes('/') || file.webkitRelativePath.split('/').at(-1) !== file.name)) return null;
  const items = files.map(file => ({ file, path: !folder && files.length === 1 ? destination.trim() : `${prefix ? `${prefix}/` : ''}${folder ? file.webkitRelativePath : file.name}` }));
  if (items.some(({ path, file }) => !safeStorageObjectPath(path) || !Number.isSafeInteger(file.size) || file.size < 0)) return null;
  if (new Set(items.map(item => item.path)).size !== items.length || items.reduce((sum, item) => sum + item.file.size, 0) > 64 * 1024 * 1024) return null;
  return items;
}

export type ProjectStorageUploadRejection = 'object_already_exists' | 'object_too_large' | 'bucket_quota_exceeded' | 'mime_type_not_allowed';

async function storageUploadRejection(response: Response, signal: AbortSignal): Promise<ProjectStorageUploadRejection | undefined> {
  if (![412, 413, 415].includes(response.status)) return;
  const reader = response.body?.getReader();
  if (!reader) return;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let body = '', size = 0;
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) return;
      body += decoder.decode(value, { stream: true });
    }
    const code = record(JSON.parse(body + decoder.decode()))?.error;
    if ((response.status === 412 && code === 'object_already_exists')
      || (response.status === 413 && (code === 'object_too_large' || code === 'bucket_quota_exceeded'))
      || (response.status === 415 && code === 'mime_type_not_allowed')) return code;
  } catch {
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function uploadProjectStorageObject(context: SaasContext, projectId: string, bucket: string, path: string, file: Blob, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal, upsert = false): Promise<ProjectPanelState<ProjectStorageObject> & { rejection?: ProjectStorageUploadRejection }> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path) || file.size > 64 * 1024 * 1024 || typeof upsert !== 'boolean') return { status: 'invalid' };
  signal?.throwIfAborted();
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  let rejection: ProjectStorageUploadRejection | undefined;
  const result = await storageManagementRequest(context, projectId, key, bearer, request, async (project, headers) => {
    const response = await request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { ...headers, 'Content-Type': file.type || 'application/octet-stream', ...(!upsert ? { 'If-None-Match': '*' } : {}) }, body: file, cache: 'no-store', signal: requestSignal });
    rejection = await storageUploadRejection(response, requestSignal);
    return response;
  }, async (response) => {
    const root = record(await response.json());
    if (root?.bucket !== bucket || root?.path !== path || typeof root?.size !== 'number' || root.size !== file.size || !text(root?.version_id)) return null;
    return { bucket, path, size: root.size, contentType: text(root.content_type), versionId: text(root.version_id), updatedAt: typeof root.updated_at_unix === 'number' ? root.updated_at_unix : 0 };
  }, requestSignal);
  return rejection && result.status !== 'ready' ? { ...result, rejection } : result;
}

export async function deleteProjectStorageObject(context: SaasContext, projectId: string, bucket: string, path: string, confirmation: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<{ path: string }>> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path) || confirmation !== path) return { status: 'invalid' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE', headers, cache: 'no-store' }), async (response) => response.status === 204 ? { path } : null);
}

export interface ProjectStorageTransferInput { action: 'copy' | 'move'; bucket: string; path: string; destinationBucket: string; destinationPath: string; }
export function validProjectStorageTransfer(input: ProjectStorageTransferInput): boolean {
  return ['copy', 'move'].includes(input.action) && safePathSegment(input.bucket) && safePathSegment(input.destinationBucket)
    && safeStorageObjectPath(input.path) && safeStorageObjectPath(input.destinationPath) && (input.bucket !== input.destinationBucket || input.path !== input.destinationPath);
}
export async function transferProjectStorageObject(context: SaasContext, projectId: string, input: ProjectStorageTransferInput, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectStorageTransferInput>> {
  if (!validProjectStorageTransfer(input)) return { status: 'invalid' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const boundedRequest: typeof fetch = (url, init) => { requestSignal.throwIfAborted(); return request(url, { ...init, signal: requestSignal }); };
  return storageManagementRequest(context, projectId, key, bearer, boundedRequest, (project, headers) => boundedRequest(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/supabase/object/${input.action}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ bucketId: input.bucket, sourceKey: input.path, destinationKey: input.destinationPath, destinationBucket: input.destinationBucket }),
  }), async response => record(await response.json())?.message === (input.action === 'copy' ? 'Successfully copied' : 'Successfully moved') ? { ...input } : null, requestSignal);
}

export async function signProjectStorageObject(context: SaasContext, projectId: string, bucket: string, path: string, key: string, bearer: string | null, request: typeof fetch, expiresIn: ProjectStorageSignedExpiresIn = 300): Promise<ProjectPanelState<ProjectStorageSignedRead>> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path) || !(PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS as readonly number[]).includes(expiresIn)) return { status: 'invalid' };
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/objects/sign`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, expires_in: expiresIn }), cache: 'no-store' }), async (response) => {
    const root = record(await response.json()); const signed = text(root?.signedUrl); const expiresAt = root?.expiresAtUnix;
    if (!/^\/storage\/v1\/signed\/[0-9a-f]{32}$/.test(signed) || typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= 0 || expiresAt > 8_640_000_000_000) return null;
    return { url: `/api/project-storage${signed}`, expiresAt };
  });
}

export async function createProjectStorageUploadLink(context: SaasContext, projectId: string, bucket: string, path: string, upsert: boolean, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<{ url: string }>> {
  if (!safePathSegment(bucket) || !safeStorageObjectPath(path) || typeof upsert !== 'boolean') return { status: 'invalid' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const boundedRequest: typeof fetch = (input, init) => { requestSignal.throwIfAborted(); return request(input, { ...init, signal: requestSignal }); };
  const prefix = `/object/upload/sign/${encodeURIComponent(bucket)}/`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return storageManagementRequest(context, projectId, key, bearer, boundedRequest, (project, headers) => boundedRequest(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/supabase${prefix}${encodedPath}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': String(upsert) }, body: '{}', cache: 'no-store' }), async (response) => {
    const root = record(await response.json()); const value = text(root?.url);
    if (!value.startsWith(prefix) || value.length > 6144) return null;
    try {
      const url = new URL(value, 'https://storage.invalid');
      const token = url.searchParams.get('token');
      if (url.hash || !url.pathname.startsWith(prefix) || decodeURIComponent(url.pathname.slice(prefix.length)) !== path || url.searchParams.size !== 1 || !token || !/^[0-9a-f]{32}$/.test(token)) return null;
      return { url: `/api/project-storage/storage/v1/projects/${encodeURIComponent(projectId)}/supabase${prefix}${encodedPath}?token=${token}` };
    } catch { return null; }
  }, requestSignal);
}

export async function loadProjectStorageAudit(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectStorageAudit>> {
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/audit`, { headers, cache: 'no-store' }), async (response) => {
    const root = record(await response.json()); const raw = Array.isArray(root?.events) ? root.events : null;
    if (!raw || raw.length > 200 || typeof root?.truncated !== 'boolean') return null;
    const events = raw.flatMap((value): ProjectStorageAuditEvent[] => { const item = record(value); const id = text(item?.id); const action = text(item?.action); const bucket = text(item?.bucket); const occurredAt = text(item?.occurred_at); if (!id || !action || !bucket || !occurredAt) return []; return [{ id, actorId: text(item?.actor_id), action, resourceType: text(item?.resource_type), bucket, objectPath: optionalText(item?.object_path), occurredAt }]; });
    return events.length === raw.length ? { events, truncated: root.truncated } : null;
  });
}

function parseStorageDiscoveryCapabilities(value: unknown): ProjectStorageDiscoveryCapabilities | null {
  const caps = record(value);
  if (!caps) return null;
  const flags: Array<keyof ProjectStorageDiscoveryCapabilities> = [
    'objectCrud', 'bucketCrud', 'objectBrowser', 'multipartUploads', 'versioning', 'presignedUrls',
    'lifecycle', 'quotas', 'managementQuotas', 'managementObjectVersions', 'managementObjectRestore', 'managementAudit',
  ];
  const out = {} as ProjectStorageDiscoveryCapabilities;
  for (const flag of flags) {
    if (typeof caps[flag] !== 'boolean') return null;
    out[flag] = caps[flag] as boolean;
  }
  return out;
}

/** Authenticated project discovery; capability flags only — never invents lifecycle support. */
export async function loadProjectStorageDiscovery(
  context: SaasContext,
  projectId: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
): Promise<ProjectPanelState<ProjectStorageDiscovery>> {
  return storageManagementRequest(context, projectId, key, bearer, request, (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/discovery`, { headers, cache: 'no-store' }), async (response) => {
    const root = record(await response.json());
    const project = record(root?.project);
    const capabilities = parseStorageDiscoveryCapabilities(root?.capabilities);
    const discoveredId = text(project?.id);
    if (!capabilities || discoveredId !== projectId) return null;
    return { projectId: discoveredId, capabilities };
  });
}

function parseLifecycleRule(value: unknown): ProjectStorageLifecycleRule | null {
  const item = record(value);
  const id = text(item?.id);
  if (!id || id.length > 128 || typeof item?.enabled !== 'boolean') return null;
  const prefix = typeof item?.prefix === 'string' && item.prefix.length <= 1024 ? item.prefix : null;
  if (prefix == null) return null;
  const expirationDays = item?.expiration_days;
  const noncurrent = item?.noncurrent_expiration_days;
  if (!(expirationDays == null || (typeof expirationDays === 'number' && Number.isSafeInteger(expirationDays) && expirationDays > 0 && expirationDays <= 36500))) return null;
  if (!(noncurrent == null || (typeof noncurrent === 'number' && Number.isSafeInteger(noncurrent) && noncurrent > 0 && noncurrent <= 36500))) return null;
  if (expirationDays == null && noncurrent == null) return null;
  return { id, enabled: item.enabled, prefix, expirationDays: expirationDays ?? null, noncurrentExpirationDays: noncurrent ?? null };
}

function validLifecycleInput(input: ProjectStorageLifecycleInput): boolean {
  return safePathSegment(input.bucket)
    && input.rules.length <= 100
    && input.rules.every((rule) => {
      if (!rule.id || rule.id.length > 128 || !/^[A-Za-z0-9._-]{1,128}$/.test(rule.id)) return false;
      if (rule.prefix.length > 1024 || rule.prefix.includes('\0')) return false;
      if (!(rule.expirationDays == null || (Number.isSafeInteger(rule.expirationDays) && rule.expirationDays > 0 && rule.expirationDays <= 36500))) return false;
      if (!(rule.noncurrentExpirationDays == null || (Number.isSafeInteger(rule.noncurrentExpirationDays) && rule.noncurrentExpirationDays > 0 && rule.noncurrentExpirationDays <= 36500))) return false;
      return rule.expirationDays != null || rule.noncurrentExpirationDays != null;
    });
}

async function withStorageLifecycleSupport(
  context: SaasContext,
  projectId: string,
  bucket: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
  whenSupported: (project: ConsoleProject, headers: Record<string, string>) => Promise<Response>,
  parseSupported: (response: Response) => Promise<ProjectStorageLifecycle | null>,
): Promise<ProjectPanelState<ProjectStorageLifecycle>> {
  if (!safePathSegment(bucket)) return { status: 'forbidden' };
  const discovery = await loadProjectStorageDiscovery(context, projectId, key, bearer, request);
  if (discovery.status !== 'ready') return discovery;
  if (!discovery.data.capabilities.lifecycle) {
    return { status: 'ready', data: { bucket, supported: false, unavailableReason: 'lifecycle_capability_unavailable', rules: [] } };
  }
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearer, request);
  if (management.status !== 'ready') return management;
  try {
    const response = await whenSupported(project, storageHeaders(management.token.accessToken, key));
    if ([404, 405, 501].includes(response.status)) {
      return { status: 'ready', data: { bucket, supported: false, unavailableReason: 'lifecycle_endpoint_unavailable', rules: [] } };
    }
    const failure = panelFailure(response);
    if (failure) return failure;
    const data = await parseSupported(response);
    return data == null ? { status: 'invalid' } : { status: 'ready', data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

function parseLifecycleDocument(bucket: string, value: unknown): ProjectStorageLifecycle | null {
  const root = record(value);
  const raw = Array.isArray(root?.rules) ? root.rules : null;
  if (root?.bucket !== bucket || !raw || raw.length > 100) return null;
  const rules = raw.flatMap((entry): ProjectStorageLifecycleRule[] => {
    const parsed = parseLifecycleRule(entry);
    return parsed ? [parsed] : [];
  });
  if (rules.length !== raw.length) return null;
  return { bucket, supported: true, rules };
}

/**
 * Load lifecycle/retention policies for one bucket.
 * When discovery.capabilities.lifecycle is false, returns an explicit unsupported projection
 * without calling a lifecycle endpoint (W-Storage currently advertises lifecycle:false).
 */
export async function loadProjectStorageLifecycle(
  context: SaasContext,
  projectId: string,
  bucket: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
): Promise<ProjectPanelState<ProjectStorageLifecycle>> {
  return withStorageLifecycleSupport(
    context,
    projectId,
    bucket,
    key,
    bearer,
    request,
    (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/lifecycle`, { headers, cache: 'no-store' }),
    async (response) => parseLifecycleDocument(bucket, await response.json()),
  );
}

/** Replace lifecycle rules only when upstream lifecycle is supported; never fabricates success. */
export async function saveProjectStorageLifecycle(
  context: SaasContext,
  projectId: string,
  input: ProjectStorageLifecycleInput,
  key: string,
  bearer: string | null,
  request: typeof fetch,
): Promise<ProjectPanelState<ProjectStorageLifecycle>> {
  if (!validLifecycleInput(input)) return { status: 'invalid' };
  return withStorageLifecycleSupport(
    context,
    projectId,
    input.bucket,
    key,
    bearer,
    request,
    (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(input.bucket)}/lifecycle`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: input.rules.map((rule) => ({
          id: rule.id,
          enabled: rule.enabled,
          prefix: rule.prefix,
          expiration_days: rule.expirationDays ?? null,
          noncurrent_expiration_days: rule.noncurrentExpirationDays ?? null,
        })),
      }),
      cache: 'no-store',
    }),
    async (response) => parseLifecycleDocument(input.bucket, await response.json()),
  );
}

/** Clear all lifecycle rules; requires exact bucket ID confirmation. */
export async function clearProjectStorageLifecycle(
  context: SaasContext,
  projectId: string,
  bucket: string,
  confirmation: string,
  key: string,
  bearer: string | null,
  request: typeof fetch,
): Promise<ProjectPanelState<ProjectStorageLifecycle>> {
  if (!safePathSegment(bucket) || confirmation !== bucket) return { status: 'invalid' };
  return withStorageLifecycleSupport(
    context,
    projectId,
    bucket,
    key,
    bearer,
    request,
    (project, headers) => request(`/api/project-storage/storage/v1/projects/${encodeURIComponent(project.id)}/management/buckets/${encodeURIComponent(bucket)}/lifecycle`, { method: 'DELETE', headers, cache: 'no-store' }),
    async (response) => (response.status === 204 ? { bucket, supported: true, rules: [] } : parseLifecycleDocument(bucket, await response.json())),
  );
}

/** Load bounded, provider-secret-free database backup metadata for one exact member project. */
export async function loadProjectDatabaseBackups(
  context: SaasContext,
  projectId: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<ProjectPanelState<ProjectDatabaseBackups>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
  if (management.status !== 'ready') return management;
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups`, {
      headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey },
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const resourceId = text(root?.resource_id);
    const backendStatus = text(root?.status);
    const restore = record(root?.restore);
    const usage = record(root?.usage); const retention = record(root?.retention); const capabilities = record(root?.capabilities);
    const rawBackups = Array.isArray(root?.backups) ? root.backups : null;
    if (
      root?.schema_version !== 'w-db.backup-inventory/v1'
      || root?.project_id !== project.id
      || !/^[0-9a-f-]{36}$/i.test(resourceId)
      || !['available', 'not_configured', 'unsupported'].includes(backendStatus)
      || !rawBackups || rawBackups.length > 100 || !usage || !retention || !capabilities
      || restore?.confirmation !== 'RESTORE'
      || restore?.idempotency_header !== 'idempotency-key'
    ) return { status: 'invalid' };
    const backups = rawBackups.flatMap((value): ProjectDatabaseBackup[] => {
      const item = record(value);
      const backupId = text(item?.backup_id);
      if (!/^bkp_[0-9a-f]{32}$/.test(backupId) || item?.resource_id !== resourceId) return [];
      return [{
        backupId, resourceId, format: text(item?.format), state: text(item?.state),
        sizeBytes: typeof item?.size_bytes === 'number' || item?.size_bytes === null ? item.size_bytes : undefined,
        createdAt: text(item?.created_at), expiresAt: optionalText(item?.expires_at),
      }];
    });
    if (backups.length !== rawBackups.length) return { status: 'invalid' };
    const parsedCapabilities = Object.fromEntries((['create', 'download', 'pitr', 'rollback'] as const).map((name) => { const capability = record(capabilities[name]); return [name, { supported: capability?.supported === true, ...(typeof capability?.unavailable_reason === 'string' ? { unavailableReason: capability.unavailable_reason } : {}) }]; })) as ProjectDatabaseBackups['capabilities'];
    return { status: 'ready', data: {
      projectId: project.id, resourceId,
      backendStatus: backendStatus as ProjectDatabaseBackups['backendStatus'],
      restoreSupported: restore?.supported === true,
      usage: { items: Number(usage.items) || 0, bytes: Number(usage.bytes) || 0, maximumItems: Number(usage.maximum_items) || 0, quotaExceeded: usage.quota_exceeded === true },
      retentionDays: Number(retention.days) || 0, capabilities: parsedCapabilities,
      backups,
    } };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  }
}

async function databaseBackupRequest<T>(context: SaasContext, projectId: string, key: string, bearer: string | null, request: typeof fetch, invoke: (project: ConsoleProject, headers: Record<string, string>, signal?: AbortSignal) => Promise<Response>, parse: (response: Response) => Promise<T | null>, signal?: AbortSignal): Promise<ProjectPanelState<T>> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' }; if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  try {
    requestSignal.throwIfAborted();
    const management = await exchangeProjectManagementToken(project, bearer, request, requestSignal); if (management.status !== 'ready') return management;
    requestSignal.throwIfAborted();
    const response = await invoke(project, { Authorization: `Bearer ${management.token.accessToken}`, apikey: key }, requestSignal); const failure = panelFailure(response); if (failure) return failure; const data = await parse(response); return data ? { status: 'ready', data } : { status: 'invalid' };
  } catch (error) { if (error instanceof Error && error.name === 'AbortError' && signal?.aborted) throw error; return { status: 'network' }; }
}

export async function createProjectDatabaseBackup(context: SaasContext, projectId: string, resourceId: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectDatabaseBackup>> {
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return { status: 'invalid' };
  return databaseBackupRequest(context, projectId, key, bearer, request, (project, headers, requestSignal) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups`, { method: 'POST', headers: { ...headers, 'idempotency-key': `console-backup-${crypto.randomUUID()}` }, credentials: 'same-origin', cache: 'no-store', signal: requestSignal }), async (response) => {
    const root = record(await response.json()); const raw = record(root?.backup);
    const backupId = text(raw?.backup_id); const actualResourceId = text(raw?.resource_id);
    if (root?.schema_version !== 'w-db.backup/v1' || !raw || !/^bkp_[0-9a-f]{32}$/.test(backupId) || actualResourceId !== resourceId) return null;
    return { backupId, resourceId: actualResourceId, format: text(raw.format), state: text(raw.state), sizeBytes: typeof raw.size_bytes === 'number' || raw.size_bytes === null ? raw.size_bytes : undefined, createdAt: text(raw.created_at), expiresAt: optionalText(raw.expires_at) };
  }, signal);
}

export async function downloadProjectDatabaseBackup(context: SaasContext, projectId: string, backup: ProjectDatabaseBackup, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectDatabaseBackupDownload>> {
  if (!/^bkp_[0-9a-f]{32}$/.test(backup.backupId) || !/^[0-9a-f-]{36}$/i.test(backup.resourceId) || backup.state !== 'available') return { status: 'invalid' };
  return databaseBackupRequest(context, projectId, key, bearer, request, (project, headers, requestSignal) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups/${encodeURIComponent(backup.backupId)}/download`, { headers, credentials: 'same-origin', cache: 'no-store', signal: requestSignal }), async (response) => {
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/octet-stream')) return null;
    return { blob: await response.blob(), fileName: `${backup.backupId}.dump` };
  }, signal);
}

export async function previewProjectDatabaseRestore(context: SaasContext, projectId: string, backup: ProjectDatabaseBackup, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectDatabaseRestorePreview>> {
  if (!/^bkp_[0-9a-f]{32}$/.test(backup.backupId) || !/^[0-9a-f-]{36}$/i.test(backup.resourceId)) return { status: 'invalid' };
  return databaseBackupRequest(context, projectId, key, bearer, request, (project, headers, requestSignal) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups/${encodeURIComponent(backup.backupId)}/restore/preview`, { method: 'POST', headers, credentials: 'same-origin', cache: 'no-store', signal: requestSignal }), async (response) => { const root = record(await response.json()); const preview = record(root?.preview); const raw = record(preview?.backup); if (root?.schema_version !== 'w-db.restore-preview/v1' || root?.confirmation !== 'RESTORE' || !preview || !raw || raw.backup_id !== backup.backupId || raw.resource_id !== backup.resourceId || preview.current_resource_id !== backup.resourceId || typeof preview.destructive !== 'boolean' || typeof preview.rollback_supported !== 'boolean') return null; return { backup, currentResourceId: backup.resourceId, destructive: preview.destructive, rollbackSupported: preview.rollback_supported }; }, signal);
}

export async function loadProjectDatabaseAudit(context: SaasContext, projectId: string, limit: number, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectDatabaseAudit>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { status: 'invalid' };
  return databaseBackupRequest(context, projectId, key, bearer, request, (project, headers, requestSignal) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups/audit?limit=${limit}`, { headers, credentials: 'same-origin', cache: 'no-store', signal: requestSignal }), async (response) => { const root = record(await response.json()); if (root?.schema_version !== 'w-db.backup-audit/v1' || root?.bounded !== true || !Array.isArray(root.events) || root.events.length > limit) return null; const eventKinds: ProjectDatabaseAuditEvent['eventKind'][] = ['backup.recorded', 'backup.created', 'backup.downloaded', 'restore.previewed', 'restore.executed']; const events = root.events.map((value) => { const item = record(value); const kind = text(item?.event_kind); if (!item || !eventKinds.includes(kind as ProjectDatabaseAuditEvent['eventKind'])) return null; return { eventKind: kind as ProjectDatabaseAuditEvent['eventKind'], objectId: text(item.object_id), state: text(item.state), actorId: optionalText(item.actor_id), errorCode: optionalText(item.error_code), createdAt: text(item.created_at) }; }); return events.some((event) => !event) ? null : { events: events as ProjectDatabaseAuditEvent[], bounded: true }; }, signal);
}

/** Restore only after an explicit exact phrase and fresh exact-project token exchange. */
export async function restoreProjectDatabaseBackup(
  context: SaasContext,
  projectId: string,
  resourceId: string,
  backupId: string,
  confirmation: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
  signal = AbortSignal.timeout(30_000),
): Promise<ProjectPanelState<ProjectDatabaseRestore>> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || !/^[0-9a-f-]{36}$/i.test(resourceId) || !/^bkp_[0-9a-f]{32}$/.test(backupId)) return { status: 'forbidden' };
  if (confirmation !== project.id) return { status: 'invalid' };
  if (!bearerToken) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'locked' };
  try {
    signal.throwIfAborted();
    const management = await exchangeProjectManagementToken(project, bearerToken, request, signal);
    if (management.status !== 'ready') return management;
    signal.throwIfAborted();
    const idempotencyKey = `console-restore-${crypto.randomUUID()}`;
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/backups/${encodeURIComponent(backupId)}/restore`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${management.token.accessToken}`, apikey: publishableKey,
        'Content-Type': 'application/json', 'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ confirmation: 'RESTORE', project_id: project.id, resource_id: resourceId, backup_id: backupId }),
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    const failure = panelFailure(response);
    if (failure && response.status < 500) return failure;
    const root = record(await response.json());
    const operation = record(root?.operation);
    const operationId = text(operation?.operation_id);
    if (
      root?.schema_version !== 'w-db.restore-operation/v1' || root?.project_id !== project.id
      || !/^[0-9a-f-]{36}$/i.test(operationId) || operation?.resource_id !== resourceId
      || operation?.backup_id !== backupId || typeof operation?.replayed !== 'boolean'
      || !['accepted', 'running', 'succeeded', 'failed', 'rolled_back'].includes(text(operation?.state))
    ) return failure ?? { status: 'invalid' };
    if (failure && operation.state !== 'failed') return failure;
    const errorCode = text(operation.error_code);
    return { status: 'ready', data: { operationId, backupId, state: text(operation.state), replayed: operation.replayed, ...(/^[a-z][a-z0-9_]{0,127}$/.test(errorCode) ? { errorCode } : {}), ...(typeof operation.rollback_available === 'boolean' ? { rollbackAvailable: operation.rollback_available } : {}) } };
  } catch { return { status: 'network' }; }
}

export async function rollbackProjectDatabaseRestore(context: SaasContext, projectId: string, resourceId: string, restore: ProjectDatabaseRestore, confirmation: string, key: string, bearer: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<ProjectDatabaseRestore>> {
  if (confirmation !== projectId || restore.state !== 'succeeded' || restore.rollbackAvailable !== true || !/^[0-9a-f-]{36}$/i.test(resourceId) || !/^[0-9a-f-]{36}$/i.test(restore.operationId) || !/^bkp_[0-9a-f]{32}$/.test(restore.backupId)) return { status: 'invalid' };
  return databaseBackupRequest(context, projectId, key, bearer, request, (project, headers, requestSignal) => request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/restores/${encodeURIComponent(restore.operationId)}/rollback`, { method: 'POST', headers, credentials: 'same-origin', cache: 'no-store', signal: requestSignal }), async (response) => {
    const root = record(await response.json()); const operation = record(root?.operation);
    if (root?.schema_version !== 'w-db.restore-operation/v1' || (root.project_id !== undefined && root.project_id !== projectId) || operation?.operation_id !== restore.operationId || operation?.resource_id !== resourceId || operation?.backup_id !== restore.backupId || operation?.state !== 'rolled_back' || typeof operation?.replayed !== 'boolean') return null;
    return { operationId: restore.operationId, backupId: restore.backupId, state: 'rolled_back', replayed: operation.replayed, ...(typeof operation.rollback_available === 'boolean' ? { rollbackAvailable: operation.rollback_available } : {}) };
  }, signal);
}

function mutationFailure(response: Response): ProjectKeyMutationResult | undefined {
  if (response.status === 401) return { status: 'error', reason: 'auth' };
  if (response.status === 403 || response.status === 404) return { status: 'error', reason: 'forbidden' };
  if (!response.ok) return { status: 'error', reason: 'network' };
  return undefined;
}

export async function issueProjectPublishableKey(
  context: SaasContext,
  projectId: string,
  bearerToken: string | null,
  browserOrigin: string,
  request: typeof fetch,
): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'error', reason: 'forbidden' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };
  const origin = safeHttpsUrl(browserOrigin);
  if (!origin) return { status: 'error', reason: 'invalid' };
  let response: Response;
  try {
    response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'W Platform web client',
        kind: 'publishable',
        scopes: DEFAULT_BROWSER_KEY_SCOPES,
        allowed_origins: [new URL(origin).origin],
        expires_at: null,
      }),
    });
  } catch {
    return { status: 'error', reason: 'network' };
  }
  const failure = mutationFailure(response);
  if (failure) return failure;
  try {
    const root = record(await response.json());
    const oneTimeKey = text(root?.key);
    const metadata = browserSafePublishableKeys([root?.data])[0];
    if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(oneTimeKey) || !metadata) return { status: 'error', reason: 'invalid' };
    return { status: 'ready', oneTimeKey, metadata };
  } catch {
    return { status: 'error', reason: 'invalid' };
  }
}

/** Issue a 15-minute in-memory credential dedicated to authorized console operations. */
export async function issueProjectConsoleReadKey(
  context: SaasContext,
  projectId: string,
  bearerToken: string | null,
  browserOrigin: string,
  request: typeof fetch,
): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'error', reason: 'forbidden' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };
  const origin = safeHttpsUrl(browserOrigin);
  if (!origin) return { status: 'error', reason: 'invalid' };
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'W Platform console (15 minute management)',
        kind: 'publishable',
        scopes: ['auth:use', 'data:read', 'data:write', 'storage:read', 'storage:write', 'functions:invoke'],
        allowed_origins: [new URL(origin).origin],
        expires_at: Math.floor(Date.now() / 1000) + 900,
      }),
    });
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const oneTimeKey = text(root?.key);
    const metadata = browserSafePublishableKeys([root?.data])[0];
    if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(oneTimeKey) || !metadata) return { status: 'error', reason: 'invalid' };
    return { status: 'ready', oneTimeKey, metadata };
  } catch {
    return { status: 'error', reason: 'network' };
  }
}

/** Functions-only by default; data reads require an explicit opt-in. */
export async function issueProjectFunctionsConsoleKey(context: SaasContext, projectId: string, bearerToken: string | null, browserOrigin: string, request: typeof fetch, allowDataRead = false): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId); if (!project) return { status: 'error', reason: 'forbidden' }; if (!bearerToken) return { status: 'error', reason: 'auth' }; const origin = safeHttpsUrl(browserOrigin); if (!origin) return { status: 'error', reason: 'invalid' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, { method: 'POST', headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'W Platform Functions console (15 minute)', kind: 'publishable', scopes: allowDataRead ? ['functions:invoke', 'data:read'] : ['functions:invoke'], allowed_origins: [new URL(origin).origin], expires_at: Math.floor(Date.now() / 1000) + 900 }) }); const failure = mutationFailure(response); if (failure) return failure; const root = record(await response.json()); const oneTimeKey = text(root?.key); const metadata = browserSafePublishableKeys([root?.data])[0]; return /^wid_pk_[A-Za-z0-9_-]+$/.test(oneTimeKey) && metadata && metadata.scopes.length === (allowDataRead ? 2 : 1) && new Set(metadata.scopes).size === metadata.scopes.length && metadata.scopes.every(scope => scope === 'functions:invoke' || (allowDataRead && scope === 'data:read')) ? { status: 'ready', oneTimeKey, metadata } : { status: 'error', reason: 'invalid' }; } catch { return { status: 'error', reason: 'network' }; }
}

/** Short-lived key for authenticated discovery plus official Realtime only. */
export async function issueProjectRealtimeConsoleKey(context: SaasContext, projectId: string, bearerToken: string | null, browserOrigin: string, request: typeof fetch): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId); if (!project) return { status: 'error', reason: 'forbidden' }; if (!bearerToken) return { status: 'error', reason: 'auth' }; const origin = safeHttpsUrl(browserOrigin); if (!origin) return { status: 'error', reason: 'invalid' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, { method: 'POST', headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'W Platform Realtime console (15 minute)', kind: 'publishable', scopes: ['auth:use', 'realtime:connect'], allowed_origins: [new URL(origin).origin], expires_at: Math.floor(Date.now() / 1000) + 900 }) }); const failure = mutationFailure(response); if (failure) return failure; const root = record(await response.json()); const oneTimeKey = text(root?.key); const metadata = browserSafePublishableKeys([root?.data])[0]; return /^wid_pk_[A-Za-z0-9_-]+$/.test(oneTimeKey) && metadata ? { status: 'ready', oneTimeKey, metadata } : { status: 'error', reason: 'invalid' }; } catch { return { status: 'error', reason: 'network' }; }
}

export async function rotateProjectPublishableKey(
  context: SaasContext,
  projectId: string,
  keyId: string,
  bearerToken: string | null,
  request: typeof fetch,
): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId);
  if (!project || !/^[A-Za-z0-9._-]+$/.test(keyId)) return { status: 'error', reason: 'forbidden' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };
  let response: Response;
  try {
    response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys/${encodeURIComponent(keyId)}/rotate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlap_seconds: 300 }),
    });
  } catch {
    return { status: 'error', reason: 'network' };
  }
  const failure = mutationFailure(response);
  if (failure) return failure;
  try {
    const root = record(await response.json());
    const oneTimeKey = text(root?.key);
    const metadata = browserSafePublishableKeys([root?.data])[0];
    if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(oneTimeKey) || !metadata) return { status: 'error', reason: 'invalid' };
    return { status: 'ready', oneTimeKey, metadata };
  } catch {
    return { status: 'error', reason: 'invalid' };
  }
}

export async function revokeProjectPublishableKey(
  context: SaasContext,
  projectId: string,
  keyId: string,
  bearerToken: string | null,
  request: typeof fetch,
): Promise<ProjectKeyMutationResult> {
  const project = memberProject(context, projectId);
  if (!project || !/^[A-Za-z0-9._-]+$/.test(keyId)) return { status: 'error', reason: 'forbidden' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys/${encodeURIComponent(keyId)}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    return mutationFailure(response) || { status: 'ready' };
  } catch {
    return { status: 'error', reason: 'network' };
  }
}

export async function loadProjectKeyMetadata(context: SaasContext, projectId: string, bearer: string | null, request: typeof fetch): Promise<ProjectPanelState<ProjectKeyMetadata[]>> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole)) return { status: 'forbidden' }; if (!bearer) return { status: 'auth' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, { headers: { Authorization: `Bearer ${bearer}` }, credentials: 'same-origin', cache: 'no-store' }); const failure = panelFailure(response); if (failure) return failure; const root = record(await response.json()); const data = Array.isArray(root?.data) ? root.data : null; if (!data || data.length > 200) return { status: 'invalid' }; const keys = browserSafeProjectKeyMetadata(data); return keys.length === data.length ? { status: 'ready', data: keys } : { status: 'invalid' }; } catch { return { status: 'network' }; }
}

export const PROJECT_SERVER_KEY_SCOPES = [
  'auth:use', 'data:read', 'data:write', 'storage:read', 'storage:write',
  'realtime:connect', 'functions:invoke', 'sites:read', 'sites:write',
  'data:admin', 'migrations:write', 'storage:admin', 'functions:deploy', 'policies:write',
] as const;

export type ProjectServerKeyInput = { name: string; scopes: string[]; expiresAt: number | null };

export async function issueProjectServerKey(context: SaasContext, projectId: string, confirmation: string, bearer: string | null, request: typeof fetch, input?: ProjectServerKeyInput): Promise<ProjectServerKeyMutationResult> {
  const project = memberProject(context, projectId);
  if (!project || !['owner', 'admin'].includes(project.workspaceRole) || confirmation !== project.id) return { status: 'error', reason: 'forbidden' };
  if (!bearer) return { status: 'error', reason: 'auth' };
  const settings = input || { name: 'W Platform server key', scopes: ['data:admin', 'migrations:write', 'storage:admin', 'functions:deploy', 'policies:write'], expiresAt: null };
  if (typeof settings.name !== 'string' || !settings.name.trim() || settings.name.length > 128 || Array.from(settings.name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || !Array.isArray(settings.scopes) || !settings.scopes.length || settings.scopes.length > PROJECT_SERVER_KEY_SCOPES.length
    || settings.scopes.some((scope) => !PROJECT_SERVER_KEY_SCOPES.some((allowed) => allowed === scope))
    || new Set(settings.scopes).size !== settings.scopes.length
    || !(settings.expiresAt === null || (Number.isSafeInteger(settings.expiresAt) && settings.expiresAt > Math.floor(Date.now() / 1000)))) return { status: 'error', reason: 'invalid' };
  const name = settings.name.trim();
  const scopes = [...settings.scopes].sort();
  try {
    const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys`, {
      method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify({ name, kind: 'server', scopes, allowed_origins: [], expires_at: settings.expiresAt }),
    });
    const failure = mutationFailure(response); if (failure) return failure;
    const root = record(await response.json()); const key = text(root?.key); const metadata = browserSafeProjectKeyMetadata([root?.data])[0];
    if (!/^wid_sk_[A-Za-z0-9_-]+$/.test(key) || metadata?.kind !== 'server') return { status: 'error', reason: 'invalid' };
    if (input && (metadata.allowedOrigins.length !== 0 || metadata.revokedAt != null || metadata.name !== name || metadata.expiresAt !== settings.expiresAt || JSON.stringify([...metadata.scopes].sort()) !== JSON.stringify(scopes))) return { status: 'error', reason: 'invalid' };
    return { status: 'ready', metadata, oneTimeKey: key };
  } catch { return { status: 'error', reason: 'network' }; }
}

export async function rotateProjectKey(context: SaasContext, projectId: string, key: ProjectKeyMetadata, confirmation: string, bearer: string | null, request: typeof fetch): Promise<ProjectServerKeyMutationResult> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole) || confirmation !== project.id || !/^pkey_[A-Za-z0-9_-]+$/.test(key.id)) return { status: 'error', reason: 'forbidden' }; if (!bearer) return { status: 'error', reason: 'auth' };
  try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys/${encodeURIComponent(key.id)}/rotate`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ overlap_seconds: 300 }) }); const failure = mutationFailure(response); if (failure) return failure; const root = record(await response.json()); const oneTimeKey = text(root?.key); const metadata = browserSafeProjectKeyMetadata([root?.data])[0]; const expected = key.kind === 'server' ? /^wid_sk_[A-Za-z0-9_-]+$/ : /^wid_pk_[A-Za-z0-9_-]+$/; return expected.test(oneTimeKey) && metadata?.kind === key.kind ? { status: 'ready', metadata, oneTimeKey } : { status: 'error', reason: 'invalid' }; } catch { return { status: 'error', reason: 'network' }; }
}

export async function revokeProjectKey(context: SaasContext, projectId: string, keyId: string, confirmation: string, bearer: string | null, request: typeof fetch): Promise<ProjectServerKeyMutationResult> {
  const project = memberProject(context, projectId); if (!project || !['owner', 'admin'].includes(project.workspaceRole) || confirmation !== project.id || !/^pkey_[A-Za-z0-9_-]+$/.test(keyId)) return { status: 'error', reason: 'forbidden' }; if (!bearer) return { status: 'error', reason: 'auth' }; try { const response = await request(`/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/keys/${encodeURIComponent(keyId)}/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}` }, credentials: 'same-origin', cache: 'no-store' }); return mutationFailure(response) || { status: 'ready' }; } catch { return { status: 'error', reason: 'network' }; }
}

/**
 * Load the authenticated member's browser-safe Project Connect projection.
 * The same-origin route is an exact Caddy proxy to W-ID; it never returns key
 * server-key material, database credentials, or Radar control data. A usable
 * publishable key may be returned because it is explicitly browser-safe and
 * encrypted at rest; legacy hash-only keys are marked for rotation.
 */
export async function loadProjectConnect(
  context: SaasContext,
  projectId: string,
  bearerToken: string | null,
  request: typeof fetch,
): Promise<DiscoveryResult> {
  const project = context.console.projects.find((item) => item.id === projectId);
  const member = project && context.authorityPlanes.workspaceMemberships.some(
    (workspace) => workspace.id === project.workspaceId,
  );
  if (!project || !member) return { status: 'error', reason: 'forbidden' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };

  let response: Response;
  try {
    response = await request(
      `/api/workspaces/${encodeURIComponent(project.workspaceId)}/projects/${encodeURIComponent(project.id)}/connect`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
  } catch {
    return { status: 'error', reason: 'network' };
  }
  if (response.status === 401) return { status: 'error', reason: 'auth' };
  if (response.status === 403 || response.status === 404) return { status: 'error', reason: 'forbidden' };
  if (!response.ok) return { status: 'error', reason: 'network' };

  let root: Record<string, unknown> | null;
  try {
    root = record(await response.json());
  } catch {
    return { status: 'error', reason: 'invalid' };
  }
  const data = record(root?.data);
  if (!data || data.project_id !== project.id || data.workspace_id !== project.workspaceId) {
    return { status: 'error', reason: 'invalid' };
  }
  const capabilityMap = record(data.capabilities);
  if (!capabilityMap) return { status: 'error', reason: 'invalid' };
  const endpoints = record(capabilityMap.endpoints);
  const fields: Array<[ProjectCapabilityName, string, unknown]> = [
    ['Auth', 'auth', data.issuer],
    ['Database', 'data', data.data_url],
    ['Storage', 'storage', data.storage_url],
    ['Functions', 'functions', data.functions_url],
  ];
  const capabilities = fields.map(([name, key, fallback]) => {
    const value = capabilityMap[key];
    const details = record(value);
    const url = safeHttpsUrl(details?.url ?? endpoints?.[key] ?? fallback);
    const available = value === true || details?.available === true || details?.ready === true;
    return { name, available: Boolean(available && url), ...(url ? { url } : {}) };
  });
  return {
    status: 'ready',
    capabilities,
    projectUrl: safeHttpsUrl(data.project_url),
    publishableKeys: browserSafePublishableKeys(data.publishable_keys),
  };
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve only an already-normalized member project, then project the W-DB
 * response onto four browser-safe capability fields. The key is used only in
 * the request header and is never returned, persisted, logged, or interpolated
 * into an error.
 */
export async function discoverProjectCapabilities(
  context: SaasContext,
  projectId: string,
  publishableKey: string,
  bearerToken: string | null,
  request: typeof fetch,
): Promise<DiscoveryResult> {
  const project = context.console.projects.find((item) => item.id === projectId);
  const member = project && context.authorityPlanes.workspaceMemberships.some(
    (workspace) => workspace.id === project.workspaceId,
  );
  if (!project || !member) return { status: 'error', reason: 'forbidden' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(publishableKey)) return { status: 'error', reason: 'key' };
  if (!bearerToken) return { status: 'error', reason: 'auth' };

  let response: Response;
  try {
    response = await request(
      `https://db.myfastools.com/v1/projects/${encodeURIComponent(project.id)}/discovery`,
      { headers: { Authorization: `Bearer ${bearerToken}`, apikey: publishableKey } },
    );
  } catch {
    return { status: 'error', reason: 'network' };
  }
  if (response.status === 401) return { status: 'error', reason: 'auth' };
  if (response.status === 403) return { status: 'error', reason: 'forbidden' };
  if (!response.ok) return { status: 'error', reason: 'network' };

  let root: Record<string, unknown> | null;
  try {
    root = record(await response.json());
  } catch {
    return { status: 'error', reason: 'invalid' };
  }
  if (!root || root.project_id !== project.id || root.workspace_id !== project.workspaceId) {
    return { status: 'error', reason: 'invalid' };
  }
  const links = record(root.links);
  const capabilities = record(root.capabilities);
  if (!links || !capabilities) return { status: 'error', reason: 'invalid' };

  const fields: Array<[ProjectCapabilityName, string, string]> = [
    ['Auth', 'auth', 'auth'],
    ['Database', 'database', 'database'],
    ['Storage', 'storage', 'storage'],
    ['Functions', 'functions', 'functions'],
  ];
  return {
    status: 'ready',
    capabilities: fields.map(([name, capability, link]) => {
      const url = safeHttpsUrl(links[link]);
      return {
        name,
        available: capabilities[capability] === true && Boolean(url),
        ...(url ? { url } : {}),
      };
    }),
  };
}


export type ProjectTablePublicationResult = ProjectPanelState<ProjectTablePublication> | { status: 'unsupported' | 'conflict' | 'unknown' };

/** Fresh project management authority for each publication read or desired-state write. */
export async function manageProjectTablePublication(
  context: SaasContext, projectId: string, schema: string, table: string,
  key: string, bearer: string | null, operation: 'GET' | 'PUT' | 'DELETE',
  input: ProjectTablePublicationInput | null, request: typeof fetch,
  signal: AbortSignal = AbortSignal.timeout(30_000),
): Promise<ProjectTablePublicationResult> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  if (operation === 'PUT' ? !input || !validProjectTablePublicationInput(input) : input !== null) return { status: 'invalid' };
  const management = await exchangeProjectManagementToken(project, bearer, request, signal);
  if (management.status !== 'ready') return management;
  signal.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/publication`, {
      method: operation, headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: key, ...(operation === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
      ...(input ? { body: JSON.stringify({ owner_column: input.ownerColumn, columns: input.columns, max_rows: input.maxRows }) } : {}),
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    if (response.status === 401) return { status: 'auth' };
    if (response.status === 403) return { status: 'forbidden' };
    if ([404, 405, 501].includes(response.status)) return { status: 'unsupported' };
    if (response.status === 409) return { status: 'conflict' };
    if ([400, 413, 415, 422].includes(response.status)) return { status: 'invalid' };
    const uncertain = operation === 'GET' ? 'network' : 'unknown';
    if (!response.ok) return { status: uncertain };
    const result = parseProjectTablePublication(await response.json(), projectId, schema, table);
    if (!result || (operation === 'PUT' && !projectTablePublicationMatches(result, input!)) || (operation === 'DELETE' && result.published)) return { status: operation === 'GET' ? 'invalid' : 'unknown' };
    return { status: 'ready', data: result };
  } catch {
    return { status: operation === 'GET' ? 'network' : 'unknown' };
  }
}

export type ProjectTableRealtimeResult = ProjectPanelState<ProjectTableRealtime> | { status: 'unsupported' | 'unpublished' | 'conflict' | 'unknown' };

/** Each table read/write obtains fresh, exact-project management authority. */
export async function manageProjectTableRealtime(
  context: SaasContext, projectId: string, schema: string, table: string,
  key: string, bearer: string | null, enabled: boolean | null, request: typeof fetch,
  signal: AbortSignal = AbortSignal.timeout(30_000),
): Promise<ProjectTableRealtimeResult> {
  const project = memberProject(context, projectId);
  if (!project || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return { status: 'forbidden' };
  if (!bearer) return { status: 'auth' };
  if (!/^wid_pk_[A-Za-z0-9_-]+$/.test(key)) return { status: 'locked' };
  if (enabled !== null && typeof enabled !== 'boolean') return { status: 'invalid' };
  signal.throwIfAborted();
  const management = await exchangeProjectManagementToken(project, bearer, request, signal);
  if (management.status !== 'ready') return management;
  signal.throwIfAborted();
  try {
    const response = await request(`/api/project-data/v1/projects/${encodeURIComponent(project.id)}/database/tables/${encodeProjectTableIdentifier(schema)}/${encodeProjectTableIdentifier(table)}/realtime`, {
      method: enabled === null ? 'GET' : 'PUT',
      headers: { Authorization: `Bearer ${management.token.accessToken}`, apikey: key, ...(enabled === null ? {} : { 'Content-Type': 'application/json' }) },
      ...(enabled === null ? {} : { body: JSON.stringify({ enabled }) }),
      credentials: 'same-origin', cache: 'no-store', signal,
    });
    if (response.status === 401) return { status: 'auth' };
    if (response.status === 403) return { status: 'forbidden' };
    if ([405, 501].includes(response.status)) return { status: 'unsupported' };
    if (response.status === 404) return { status: 'unpublished' };
    if (response.status === 409) return { status: 'conflict' };
    if ([400, 413, 415, 422].includes(response.status)) return { status: 'invalid' };
    if (!response.ok) return { status: enabled === null ? 'network' : 'unknown' };
    const result = parseProjectTableRealtime(await response.json(), projectId, schema, table);
    if (!result || (enabled !== null && (result.desiredEnabled !== enabled || result.source === 'configured'))) return { status: enabled === null ? 'invalid' : 'unknown' };
    return { status: 'ready', data: result };
  } catch {
    return { status: enabled === null ? 'network' : 'unknown' };
  }
}
