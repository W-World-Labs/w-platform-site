import { describe, expect, it, vi } from 'vitest';
import componentSource from '../components/SaasConsolePage.tsx?raw';
import storageComponentSource from '../components/ProjectStorageConsole.tsx?raw';
import databaseComponentSource from '../components/ProjectDatabaseConsole.tsx?raw';
import databaseOperationsSource from '../components/ProjectDatabaseOperations.tsx?raw';
import functionsComponentSource from '../components/ProjectFunctionsConsole.tsx?raw';
import realtimeComponentSource from '../components/ProjectRealtimeConsole.tsx?raw';
import observabilityComponentSource from '../components/ProjectObservabilityConsole.tsx?raw';
import backupsComponentSource from '../components/ProjectBackupsConsole.tsx?raw';
import connectComponentSource from '../components/ProjectConnectConsole.tsx?raw';
import { RealtimeClient } from '@supabase/realtime-js';
import layoutSource from '../components/Layout.tsx?raw';
import { render } from '../entry-server';
import { parsePath } from '../routes';
import {
  listMemberProjects,
  createProjectStorageUploadLink,
  PROJECT_FUNCTION_SOURCE_LIMIT,
  listUsedApps,
  issueProjectPublishableKey,
  issueProjectConsoleReadKey,
  createProjectStorageBucket,
  loadProjectStorageBuckets,
  updateProjectStorageBucket,
  deleteProjectStorageBucket,
  uploadProjectStorageObject,
  prepareProjectStorageUploads,
  deleteProjectStorageObject,
  transferProjectStorageObject,
  validProjectStorageTransfer,
  signProjectStorageObject,
  loadProjectStorageUsage,
  loadProjectStorageAudit,
  loadProjectStorageDiscovery,
  loadProjectStorageLifecycle,
  saveProjectStorageLifecycle,
  clearProjectStorageLifecycle,
  loadProjectStorageVersions,
  restoreProjectStorageVersion,
  PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS,
  loadProjectConnect,
  loadProjectKeyMetadata,
  issueProjectServerKey,
  rotateProjectKey,
  revokeProjectKey,
  loadProjectConsoleData,
  exchangeProjectManagementToken,
  changeProjectAuthUserStatus,
  loadProjectAuthConsole,
  loadProjectAuthUserDetail,
  updateProjectAuthUserRole,
  inviteProjectAuthUser,
  revokeProjectAuthInvitation,
  loadProjectAuthSessions,
  revokeProjectAuthSession,
  loadProjectMigrations,
  previewProjectSql,
  executeProjectSql,
  parseProjectMigrationFiles,
  processProjectMigrations,
  loadProjectDatabaseCatalog,
  loadProjectRlsPolicies,
  saveProjectRlsPolicy,
  deleteProjectRlsPolicy,
  loadProjectFunctions,
  loadProjectFunctionsReadiness,
  loadProjectFunctionDetail,
  serializeProjectFunctionAudit,
  filterProjectFunctionAudit,
  type ProjectFunctionDetail,
  deployProjectFunction,
  activateProjectFunctionVersion,
  deleteProjectFunction,
  invokeProtectedProjectFunction,
  parseProjectFunctionQuery,
  FUNCTION_INVOKE_QUERY_LIMIT,
  issueProjectFunctionsConsoleKey,
  redactFunctionInvokeBody,
  FUNCTION_INVOKE_BODY_PREVIEW_LIMIT,
  PROJECT_FUNCTION_INVOKE_METHODS,
  PROJECT_FUNCTION_INVOKE_CONTENT_TYPES,
  validProjectFunctionInvokeBody,
  issueProjectRealtimeConsoleKey,
  loadProjectRealtimeStatus,
  startProjectRealtimeChannel,
  parseProjectRealtimeBroadcast,
  loadProjectObservability,
  loadProjectLogs,
  serializeProjectLogs,
  loadProjectMonitorHealth,
  loadProjectDatabaseBackups,
  createProjectDatabaseBackup,
  downloadProjectDatabaseBackup,
  loadProjectDatabaseAudit,
  previewProjectDatabaseRestore,
  restoreProjectDatabaseBackup,
  rollbackProjectDatabaseRestore,
  loadProjectStorageObjects,
  loadProjectTableRows,
  loadProjectDatabaseTypes,
  serializeProjectTableRows,
  loadSaasContext,
  mutateProjectTableRow,
  importProjectTableRows,
  deleteProjectTableRows,
  parseProjectTableImport,
  normalizeSaasContext,
  parseProjectRowValues,
  radarProjectUrl,
  revokeProjectPublishableKey,
  rotateProjectPublishableKey,
  safeRadarProjectId,
  undiscoveredProjectCapabilities,
} from './saasConsole';

describe('database page downloads', () => {
  it('preserves JSON types and original formula-like strings', () => {
    const rows = [{ id: -2, text: '=1+1', nested: { hello: '中文', values: [false, null] }, quoted: '"first"\r\nsecond' }];
    expect(JSON.parse(serializeProjectTableRows(rows, 'json'))).toEqual(rows);
    expect(serializeProjectTableRows([], 'json')).toBe('[]\n');
  });

  it('quotes CSV delimiters, multiline strings and nested JSON, with UTF-8 BOM', () => {
    expect(serializeProjectTableRows([{ label: '中文,"quoted"\r\nnext', count: -2, active: false, nested: { x: [1, null] } }], 'csv'))
      .toBe('\uFEFF"label","count","active","nested"\r\n"中文,""quoted""\r\nnext","-2","false","{""x"":[1,null]}"\r\n');
  });

  it('escapes spreadsheet formula strings and headers without changing numeric values', () => {
    for (const text of ['=1+1', '+SUM(A1)', '-2', '@example', '  =1', '\ttext', '\rtext', '\ntext']) {
      const output = serializeProjectTableRows([{ [text]: text, number: -2 }], 'csv');
      expect(output).toBe(`\uFEFF"'${text}","number"\r\n"'${text}","-2"\r\n`);
    }
    expect(serializeProjectTableRows([{ text: 'ordinary - text' }], 'csv')).toContain('"ordinary - text"');
  });

  it('includes all page columns and represents missing and null cells as empty', () => {
    expect(serializeProjectTableRows([{ a: 1 }, { b: 'two', a: null }], 'csv'))
      .toBe('\uFEFF"a","b"\r\n"1",""\r\n"","two"\r\n');
    expect(serializeProjectTableRows([], 'csv')).toBe('');
    expect(serializeProjectTableRows([JSON.parse('{"__proto__":"value"}'), {}], 'csv'))
      .toBe('\uFEFF"__proto__"\r\n"value"\r\n""\r\n');
  });
});

it('synchronizes the runtime html lang for dynamic localized console routes', () => {
  expect(parsePath('/zh/console/projects/project_member').lang).toBe('zh');
  expect(layoutSource).toContain('document.documentElement.lang = LANG_TAG[lang]');
});

it('uses only bounded unified-console management routes', () => {
  expect(componentSource).toContain('loadUnifiedManagement');
  expect(storageComponentSource).toContain('loadProjectStorageVersions');
  expect(storageComponentSource).toContain('restoreProjectStorageVersion');
  expect(componentSource).toContain('loadProjectDatabaseBackups');
  expect(componentSource).toContain('ProjectBackupsConsole');
  expect(componentSource).not.toMatch(/localStorage|sessionStorage/);
});

const memberFixture = {
  schemaVersion: 1,
  authorityPlanes: {
    platformRole: 'member',
    workspaceMemberships: [{ id: 'ws_member', name: 'Member workspace', role: 'owner', tier: 'pro' }],
    appUserRelationships: [],
  },
  console: {
    projects: [
      { id: 'project_member', workspaceId: 'ws_member', name: 'Member project', workspaceRole: 'owner', radarProjectId: 'radar-member_1' },
      {
        id: 'project_foreign', workspaceId: 'ws_foreign', name: 'Foreign project', workspaceRole: 'owner',
        radarProjectId: 'radar-foreign',
        database_url: 'postgres://must-not-render', service_role_key: 'must-not-render',
      },
    ],
  },
  service_role_key: 'must-not-render',
};

function projectJwt(projectId: string, expiresAt: number, issuedAt = expiresAt - 300): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ aud: projectId, exp: expiresAt, iat: issuedAt, sub: 'usr_1' })}.signature`;
}

describe('project Auth console contract', () => {
  it('requests a bounded server page and uses one lookahead user without exposing it', async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({ userId: 'usr_' + index, status: 'blocked', appRole: 'user' }));
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: rows, counts: { total: 127, active: 84, blocked: 43 } })).mockResolvedValueOnce(Response.json({ data: [] }));
    const result = await loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_member', 'identity', request, signal, { offset: 100, status: 'blocked' });
    expect(result).toMatchObject({ status: 'ready', data: { offset: 100, hasMore: true, total: 127, blocked: 43 } });
    if (result.status === 'ready') { expect(result.data.users).toHaveLength(25); expect(result.data.users.at(-1)?.userId).toBe('usr_24'); }
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/users?limit=26&offset=100&status=blocked');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ signal, credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer identity');
  });

  it('disables next-page navigation for exactly 25, partial and empty server pages', async () => {
    for (const length of [0, 2, 25]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: Array.from({ length }, (_, i) => ({ userId: 'usr_' + i, status: 'active' })), counts: {} })).mockResolvedValueOnce(Response.json({ data: [] }));
      expect(await loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_member', 'identity', request, undefined, { offset: 125, status: 'all' })).toMatchObject({ status: 'ready', data: { hasMore: false, offset: 125 } });
    }
  });

  it('rejects unsafe directory queries before HTTP and bounds and validates returned rows', async () => {
    const context = normalizeSaasContext(memberFixture); const request = vi.fn<typeof fetch>();
    for (const offset of [-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(await loadProjectAuthConsole(context, 'project_member', 'identity', request, undefined, { offset, status: 'all' })).toEqual({ status: 'invalid' });
    await expect(loadProjectAuthConsole(context, 'project_member', 'identity', request, AbortSignal.abort())).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    const row = { userId: 'usr_1', status: 'active' };
    for (const root of [{ data: Array.from({ length: 27 }, (_, i) => ({ ...row, userId: 'usr_' + i })), counts: {} }, { data: [row, row], counts: {} }, { data: [row], counts: {}, workspaceId: 'foreign' }, { data: [row], counts: {}, projectId: 'foreign' }]) {
      expect(await loadProjectAuthConsole(context, 'project_member', 'identity', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(root)))).toEqual({ status: 'invalid' });
    }
    expect(await loadProjectAuthConsole(context, 'project_member', 'identity', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [row], counts: {} })), undefined, { offset: 0, status: 'blocked' })).toEqual({ status: 'invalid' });
  });

  it('allows members to page their own directory without fetching manager invitations', async () => {
    const context = normalizeSaasContext(memberFixture);
    const member = { ...context, console: { projects: context.console.projects.map(project => ({ ...project, workspaceRole: 'member' as const })) } };
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [], counts: {} }));
    expect(await loadProjectAuthConsole(member, 'project_member', 'identity', request, undefined, { offset: 25, status: 'active' })).toMatchObject({ status: 'ready', data: { offset: 25, hasMore: false, canManage: false, invitations: [] } });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toContain('offset=25&status=active');
  });

  it('reads only exact-project session metadata with live identity credentials', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, schemaVersion: 1, workspaceId: 'ws_member', projectId: 'project_member', data: [{ sessionId: 'ses_1', userAgent: null, createdAt: 1, expiresAt: 2000000000, token: 'discard', cookie: 'discard' }] }));
    expect(await loadProjectAuthSessions(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', 'identity', request, signal)).toEqual({ status: 'ready', data: [{ id: 'ses_1', userAgent: null, createdAt: 1, expiresAt: 2000000000 }] });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/users/usr_1/sessions');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', signal });
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer identity');
  });

  it('fails closed on foreign, malformed, duplicate or oversized session inventories', async () => {
    const row = { sessionId: 'ses_1', userAgent: 'Browser', createdAt: 1, expiresAt: 2 };
    const root = { success: true, schemaVersion: 1, workspaceId: 'ws_member', projectId: 'project_member', data: [row] };
    const invalid = [{ ...root, projectId: 'foreign' }, { ...root, workspaceId: 'foreign' }, { ...root, schemaVersion: 2 }, { ...root, success: false }, { ...root, data: [row, row] }, { ...root, data: Array.from({ length: 101 }, (_, i) => ({ ...row, sessionId: 'ses_' + i })) }, ...[{ sessionId: '../ses' }, { userAgent: 42 }, { userAgent: 'x'.repeat(2049) }, { createdAt: -1 }, { expiresAt: 1 }, { expiresAt: Infinity }].map(change => ({ ...root, data: [{ ...row, ...change }] }))];
    for (const value of invalid) {
      expect(await loadProjectAuthSessions(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', 'identity', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(value)))).toEqual({ status: 'invalid' });
    }
    expect(await loadProjectAuthSessions(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', 'identity', vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ...root, data: [] })))).toEqual({ status: 'ready', data: [] });
  });

  it('blocks session reads and revocations before HTTP for unauthorized scopes and unsafe IDs', async () => {
    const context = normalizeSaasContext(memberFixture); const request = vi.fn<typeof fetch>();
    const member = { ...context, console: { projects: context.console.projects.map(project => ({ ...project, workspaceRole: 'member' as const })) } };
    for (const scope of [context, member]) {
      const project = scope === context ? 'project_foreign' : 'project_member';
      expect(await loadProjectAuthSessions(scope, project, 'usr_1', 'identity', request)).toEqual({ status: 'forbidden' });
      expect(await revokeProjectAuthSession(scope, project, 'usr_1', 'ses_1', 'identity', request)).toEqual({ status: 'forbidden' });
    }
    for (const id of ['', '../usr', 'u'.repeat(256)]) expect(await loadProjectAuthSessions(context, 'project_member', id, 'identity', request)).toEqual({ status: 'forbidden' });
    for (const id of ['', '../ses', 's'.repeat(129)]) expect(await revokeProjectAuthSession(context, 'project_member', 'usr_1', id, 'identity', request)).toEqual({ status: 'invalid' });
    expect(await loadProjectAuthSessions(context, 'project_member', 'usr_1', null, request)).toEqual({ status: 'auth' });
    expect(await revokeProjectAuthSession(context, 'project_member', 'usr_1', 'ses_1', null, request)).toEqual({ status: 'auth' });
    expect(await loadProjectAuthSessions(context, 'project_member', 'usr_1', 'identity', request, AbortSignal.abort())).toEqual({ status: 'network' });
    expect(await revokeProjectAuthSession(context, 'project_member', 'usr_1', 'ses_1', 'identity', request, AbortSignal.abort())).toEqual({ status: 'network' });
    expect(request).not.toHaveBeenCalled();
  });

  it('revokes one session using the canonical receipt and preserves HTTP failures', async () => {
    const context = normalizeSaasContext(memberFixture); const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, future: 'ignored' }));
    expect(await revokeProjectAuthSession(context, 'project_member', 'usr_1', 'ses_1', 'identity', request, signal)).toEqual({ status: 'ready', data: { sessionId: 'ses_1' } });
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/users/usr_1/sessions/ses_1');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'same-origin', cache: 'no-store', signal });
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer identity');
    for (const [response, status] of [[Response.json({ success: false }), 'invalid'], [new Response('{}', { status: 401 }), 'auth'], [new Response('{}', { status: 403 }), 'forbidden'], [new Response('{}', { status: 404 }), 'forbidden'], [new Response('{}', { status: 503 }), 'network']] as const) {
      expect(await revokeProjectAuthSession(context, 'project_member', 'usr_1', 'ses_1', 'identity', vi.fn<typeof fetch>().mockResolvedValueOnce(response))).toEqual({ status });
    }
  });

  it('revokes only the exact pending invitation with the live W-ID bearer and supplied signal', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, future: 'ignored' }));
    await expect(revokeProjectAuthInvitation(normalizeSaasContext(memberFixture), 'project_member', 'pai_123', 'session-token', request, signal)).resolves.toEqual({ status: 'ready', data: { invitationId: 'pai_123' } });
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/invitations/pai_123');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'same-origin', cache: 'no-store', signal });
    expect(request.mock.calls[0]?.[1]?.signal).toBe(signal);
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer session-token');
    expect(request.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('prevents invitation revocation for foreign scope, member role, absent auth, unsafe ids and pre-aborted calls', async () => {
    const context = normalizeSaasContext(memberFixture);
    const request = vi.fn<typeof fetch>();
    expect(await revokeProjectAuthInvitation(context, 'project_foreign', 'pai_123', 'session-token', request)).toEqual({ status: 'forbidden' });
    const member = { ...context, console: { projects: context.console.projects.map((project) => ({ ...project, workspaceRole: 'member' as const })) } };
    expect(await revokeProjectAuthInvitation(member, 'project_member', 'pai_123', 'session-token', request)).toEqual({ status: 'forbidden' });
    expect(await revokeProjectAuthInvitation(context, 'project_member', 'pai_123', null, request)).toEqual({ status: 'auth' });
    for (const id of ['', '..', '../pai', 'pai?query', 'p'.repeat(129)]) expect(await revokeProjectAuthInvitation(context, 'project_member', id, 'session-token', request)).toEqual({ status: 'invalid' });
    expect(await revokeProjectAuthInvitation(context, 'project_member', 'pai_123', 'session-token', request, AbortSignal.abort())).toEqual({ status: 'network' });
    expect(request).not.toHaveBeenCalled();
  });

  it('requires a valid revocation receipt and fails closed on rejection, missing invitation and provider errors', async () => {
    for (const [response, status] of [[Response.json({ success: false }), 'invalid'], [Response.json({ success: 'true' }), 'invalid'], [new Response('invalid'), 'network'], [new Response('{}', { status: 403 }), 'forbidden'], [new Response('{}', { status: 404 }), 'forbidden'], [new Response('{}', { status: 503 }), 'network']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
      expect(await revokeProjectAuthInvitation(normalizeSaasContext(memberFixture), 'project_member', 'pai_123', 'session-token', request)).toEqual({ status });
    }
  });

  it('accepts the canonical 500 invitation-history bound and shows only pending entries', async () => {
    const data = Array.from({ length: 500 }, (_, index) => ({ id: `pai_${index}`, email: 'fixture@example.test', appRole: 'user', status: index === 499 ? 'pending' : 'revoked', expiresAt: 2000000000, createdAt: 1 }));
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [], counts: {} })).mockResolvedValueOnce(Response.json({ data }));
    expect(await loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_member', 'session-token', request)).toMatchObject({ status: 'ready', data: { invitations: [{ id: 'pai_499' }] } });
    const oversized = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: [], counts: {} })).mockResolvedValueOnce(Response.json({ data: [...data, data[0]] }));
    expect(await loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_member', 'session-token', oversized)).toEqual({ status: 'invalid' });
  });

  it('disables and restores an exact-project user with the live W-ID bearer and bounded revocation counts', async () => {
    for (const action of ['disable', 'restore'] as const) {
      const status = action === 'disable' ? 'blocked' : 'active';
        const request = vi.fn<typeof fetch>()

        .mockResolvedValueOnce(Response.json({ success: true, schemaVersion: 1, workspaceId: 'ws_member', projectId: 'project_member', data: { userId: 'usr_1', status, revokedSessions: 2, revokedRefreshTokens: 3, secret: 'discard' } }));
      await expect(changeProjectAuthUserStatus(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', action, 'session-token', request)).resolves.toEqual({ status: 'ready', data: { userId: 'usr_1', status, revokedSessions: 2, revokedRefreshTokens: 3 } });
      expect(request.mock.calls[0]?.[0]).toBe(`/api/workspaces/ws_member/projects/project_member/auth/users/usr_1/${action}`);
      expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: expect.any(AbortSignal) });
      expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer session-token');
    }
  });

  it('rejects foreign Auth status responses and prevents unscoped status mutations', async () => {
    const context = normalizeSaasContext(memberFixture);
    const request = vi.fn<typeof fetch>();
    await expect(changeProjectAuthUserStatus(context, 'project_foreign', 'usr_1', 'disable', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(changeProjectAuthUserStatus(context, 'project_member', '../foreign', 'disable', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    const readOnly = normalizeSaasContext(memberFixture);
    readOnly.console.projects[0]!.workspaceRole = 'member';
    await expect(changeProjectAuthUserStatus(readOnly, 'project_member', 'usr_1', 'disable', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(changeProjectAuthUserStatus(context, 'project_member', 'usr_1', 'disable', null, request)).resolves.toEqual({ status: 'auth' });
    expect(request).not.toHaveBeenCalled();
    for (const invalid of [{ projectId: 'project_foreign' }, { data: { userId: 'usr_other', status: 'blocked', revokedSessions: 0, revokedRefreshTokens: 0 } }, { data: { userId: 'usr_1', status: 'blocked', revokedSessions: -1, revokedRefreshTokens: 0 } }]) {
      request.mockResolvedValueOnce(Response.json({ success: true, schemaVersion: 1, workspaceId: 'ws_member', projectId: 'project_member', data: { userId: 'usr_1', status: 'blocked', revokedSessions: 0, revokedRefreshTokens: 0 }, ...invalid }));
      await expect(changeProjectAuthUserStatus(context, 'project_member', 'usr_1', 'disable', 'session-token', request)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('uses the live W-ID bearer for bounded users and manager invitations', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const request = vi.fn<typeof fetch>()

      .mockResolvedValueOnce(Response.json({ data: [{ userId: 'usr_1', email: 'u@example.com', status: 'active', appRole: 'user', effectiveTier: 'free', loginCount: 2, lastSeenAt: 1 }], counts: { total: 1, active: 1, blocked: 0 } }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'pai_1', email: 'next@example.com', appRole: 'user', status: 'pending', expiresAt: 2_000_000_000, createdAt: 1_900_000_000 }] }));
    const result = await loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_member', 'session-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { total: 1, canManage: true, invitations: [{ id: 'pai_1' }] } });
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/api/workspaces/ws_member/projects/project_member/auth/users?limit=26&offset=0',
      '/api/workspaces/ws_member/projects/project_member/auth/invitations',
    ]);
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer session-token');
    expect(JSON.stringify(result)).not.toContain('session-token');
    vi.useRealTimers();
  });

  it('projects user detail without provider credentials or inferred MFA state', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const request = vi.fn<typeof fetch>()

      .mockResolvedValueOnce(Response.json({ data: { appUser: { userId: 'usr_1', email: 'u@example.com', status: 'active', appRole: 'admin', loginCount: 2, lastSeenAt: 1, providerToken: 'drop' }, identities: [{ providerId: 'github', providerUserId: '42', accessToken: 'drop' }], policy: { effectiveTier: 'pro', workspaceMemberRole: null } } }));
    const result = await loadProjectAuthUserDetail(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', 'session-token', request);
    expect(result).toEqual({ status: 'ready', data: { user: { userId: 'usr_1', email: 'u@example.com', displayName: undefined, status: 'active', appRole: 'admin', effectiveTier: 'pro', loginCount: 2, lastSeenAt: 1 }, identities: [{ provider: 'github', providerUserId: '42' }], workspaceMemberRole: null } });
    expect(JSON.stringify(result)).not.toMatch(/providerToken|accessToken|mfaEnabled/);
    vi.useRealTimers();
  });

  it('role and invitation mutations retain the W-ID bearer and stay exact-project scoped', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const roleRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ data: { userId: 'usr_1', appRole: 'admin' } }));
    await expect(updateProjectAuthUserRole(normalizeSaasContext(memberFixture), 'project_member', 'usr_1', 'admin', 'session-token', roleRequest)).resolves.toEqual({ status: 'ready', data: { userId: 'usr_1', appRole: 'admin' } });
    expect(roleRequest.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/users/usr_1/app-role');
    expect(roleRequest.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', credentials: 'same-origin', cache: 'no-store' });
    const inviteRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'pai_1', email: 'new@example.com', appRole: 'user', expiresAt: 2_000_000_000, inviteUrl: 'https://auth.myfastools.com/invite/once', deliveryQueued: true } }), { status: 201 }));
    const invited = await inviteProjectAuthUser(normalizeSaasContext(memberFixture), 'project_member', 'new@example.com', 'user', 'zh-CN', 'session-token', inviteRequest);
    expect(invited).toMatchObject({ status: 'ready', data: { deliveryQueued: true, inviteUrl: 'https://auth.myfastools.com/invite/once' } });
    expect(inviteRequest.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/auth/invitations');
    expect(JSON.parse(String(inviteRequest.mock.calls[0]?.[1]?.body))).toEqual({ email: 'new@example.com', appRole: 'user', locale: 'zh-CN' });
    vi.useRealTimers();
  });

  it('fails closed before Auth APIs for a non-member project', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(loadProjectAuthConsole(normalizeSaasContext(memberFixture), 'project_foreign', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('project Database console contract', () => {
  it('does not read a catalog after cancelled management authorization returns late', async () => {
    const controller = new AbortController();
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      controller.abort();
      return Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 });
    });
    await expect(loadProjectDatabaseCatalog(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('projects ordered column metadata without default expressions or unknown provider fields', async () => {
    const column = { name: 'id', ordinal: 1, data_type: 'bigint', nullable: false, default: "nextval('private_sequence')", identity: true, generated: false, provider_token: 'drop' };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schemas: [{ name: 'public', tables: [{ name: 'items', columns: [{ ...column, name: 'computed', ordinal: 3, data_type: 'text', nullable: true, default: null, identity: false, generated: true }, column], database_url: 'drop' }] }] })).mockResolvedValueOnce(Response.json({ initialized: false, count: 0 }));
    const result = await loadProjectDatabaseCatalog(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { tables: [{ columnCount: 2, columns: [{ name: 'id', ordinal: 1, dataType: 'bigint', nullable: false, hasDefault: true, identity: true, generated: false }, { name: 'computed', ordinal: 3, dataType: 'text', nullable: true, hasDefault: false, identity: false, generated: true }] }] } });
    expect(JSON.stringify(result)).not.toMatch(/nextval|private_sequence|provider_token|database_url|drop/); expect(request).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed, duplicate or oversized column catalogs instead of inventing field requirements', async () => {
    const column = { name: 'id', ordinal: 1, data_type: 'uuid', nullable: false, default: null, identity: false, generated: false };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const columns of [undefined, [column, column], [column, { ...column, name: 'other' }], [{ ...column, nullable: 'false' }], [{ ...column, ordinal: 0 }], [{ ...column, default: {} }], [{ ...column, data_type: '' }], [{ ...column, name: 'x'.repeat(129) }], Array(1601).fill(column)]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schemas: [{ name: 'public', tables: [{ name: 'items', columns }] }] })).mockResolvedValueOnce(Response.json({ initialized: false, count: 0 }));
      expect(await loadProjectDatabaseCatalog(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request)).toEqual({ status: 'invalid' });
    }
  });

  it('loads the dedicated catalog without crossing into Auth or Storage planes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schemas: [] })).mockResolvedValueOnce(Response.json({ initialized: false, count: 0 }));
    await expect(loadProjectDatabaseCatalog(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request)).resolves.toEqual({ status: 'ready', data: { tables: [], migrations: { initialized: false, count: 0, lastAppliedAt: undefined } } });
    expect(request.mock.calls.map(([url]) => String(url))).toEqual(['/api/workspaces/ws_member/projects/project_member/management-token', '/api/project-data/v1/projects/project_member/database/schema', '/api/project-data/v1/projects/project_member/database/migrations']);
    expect(request.mock.calls.some(([url]) => /auth\/users|project-storage/.test(String(url)))).toBe(false); vi.useRealTimers();
  });
  it('lists bounded migration evidence through a fresh exact-project token', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schema_version: 'w-db.migrations/v1', initialized: true, count: 1, truncated: false, last_applied_at: '2026-08-01T00:00:00Z', migrations: [{ version: '001', checksum: 'abc', applied_at: '2026-08-01T00:00:00Z' }], sql: 'drop' }));
    const result = await loadProjectMigrations(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request);
    expect(result).toEqual({ status: 'ready', data: { initialized: true, count: 1, truncated: false, lastAppliedAt: '2026-08-01T00:00:00Z', migrations: [{ version: '001', checksum: 'abc', appliedAt: '2026-08-01T00:00:00Z' }] } });
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/migrations');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${token}`);
    expect(JSON.stringify(result)).not.toContain('drop'); vi.useRealTimers();
  });

  it('lists and mutates only closed-rule RLS policies with a fresh token each time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const policy = { name: 'own_rows', permissive: true, roles: ['public'], command: 'SELECT', using_expression: '"user_id" = current_setting(\'request.jwt.claim.sub\', true)', check_expression: null };
    const listRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ policies: [policy] }));
    await expect(loadProjectRlsPolicies(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_console', 'session-token', listRequest)).resolves.toMatchObject({ status: 'ready', data: { policies: [{ name: 'own_rows', command: 'SELECT' }] } });
    const saveRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json(policy));
    const input = { name: 'own_rows', command: 'select' as const, restrictive: false, rule: { kind: 'w_id_subject_column' as const, column: 'user_id' } };
    await expect(saveProjectRlsPolicy(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', null, input, 'wid_pk_console', 'session-token', saveRequest)).resolves.toMatchObject({ status: 'ready', data: { name: 'own_rows' } });
    expect(saveRequest.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/policies');
    expect(saveRequest.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', cache: 'no-store' });
    expect(JSON.parse(String(saveRequest.mock.calls[1]?.[1]?.body))).toEqual(input);
    const rejected = vi.fn<typeof fetch>();
    await expect(saveProjectRlsPolicy(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', null, { ...input, rule: { ...input.rule, column: 'owner/id' } }, 'wid_pk_console', 'session-token', rejected)).resolves.toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
    const deleteRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteProjectRlsPolicy(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'own_rows', 'wid_pk_console', 'session-token', deleteRequest)).resolves.toEqual({ status: 'ready', data: { name: 'own_rows' } });
    expect(deleteRequest.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE', cache: 'no-store' }); vi.useRealTimers();
  });

  it('ships canonical SQL and migrations UX without browser credentials', () => {
    expect(databaseComponentSource).toContain('ProjectDatabaseOperations');
    expect(databaseOperationsSource).toContain('Checksum Drift（409）');
    expect(databaseOperationsSource).toContain('rolled back (422)');
    expect(databaseOperationsSource).toContain('migrationConfirm !== projectId');
    expect(databaseOperationsSource).not.toMatch(/localStorage|sessionStorage|DATABASE_URL|wid_sk|client_secret/);
  });

  it('previews and executes bounded SQL through the exact canonical route', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const previewRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ valid: true, project_id: 'project_member', limits: { rows: 100, columns: 32, bytes: 262144, statement_timeout_ms: 5000, lock_timeout_ms: 1000 }, database_url: 'drop' }));
    await expect(previewProjectSql(normalizeSaasContext(memberFixture), 'project_member', 'SELECT 1', 'wid_pk_console', 'session-token', previewRequest)).resolves.toMatchObject({ status: 'ready', data: { projectId: 'project_member', limits: { rows: 100, columns: 32 } } });
    expect(previewRequest.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/sql'); expect(JSON.parse(String(previewRequest.mock.calls[1]?.[1]?.body))).toEqual({ mode: 'preview', sql: 'SELECT 1' });
    const executeRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ rows: [{ value: 1, secret_extra: 'allowed-row-value' }], truncated: false, bytes: 11, database_url: 'drop' }));
    const result = await executeProjectSql(normalizeSaasContext(memberFixture), 'project_member', 'SELECT 1 AS value', 'wid_pk_console', 'session-token', executeRequest); expect(result).toMatchObject({ status: 'ready', data: { rows: [{ value: 1 }], truncated: false, bytes: 11 } }); expect(JSON.stringify(result)).not.toContain('database_url'); vi.useRealTimers();
  });

  it('previews/applies migration bundles and maps drift and rollback exactly', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300); const files = parseProjectMigrationFiles('[{"name":"202608020001_create_items.sql","sql":"CREATE TABLE items(id bigint)"}]')!; expect(files).toHaveLength(1);
    const preview = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ mode: 'preview', report: { versions: ['202608020001'], checksums: ['abc'], total_bytes: 29, sql: 'drop' } }));
    await expect(processProjectMigrations(normalizeSaasContext(memberFixture), 'project_member', 'preview', files, 'wid_pk_console', 'session-token', preview)).resolves.toEqual({ status: 'ready', data: { mode: 'preview', versions: ['202608020001'], checksums: ['abc'], totalBytes: 29, applied: [], alreadyApplied: [] } }); expect(JSON.parse(String(preview.mock.calls[1]?.[1]?.body))).toEqual({ mode: 'preview', files });
    for (const [status, expected] of [[409, 'drift'], [422, 'rolled_back']] as const) { const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ error: 'drop' }, { status })); await expect(processProjectMigrations(normalizeSaasContext(memberFixture), 'project_member', 'apply', files, 'wid_pk_console', 'session-token', request)).resolves.toEqual({ status: expected }); }
    vi.useRealTimers();
  });

  it('fails closed for cross-tenant, member role, missing bearer, wrong key and wrong scope', async () => {
    const foreign = vi.fn<typeof fetch>(); await expect(executeProjectSql(normalizeSaasContext(memberFixture), 'project_foreign', 'SELECT 1', 'wid_pk_console', 'session-token', foreign)).resolves.toEqual({ status: 'forbidden' }); expect(foreign).not.toHaveBeenCalled();
    const memberPayload = structuredClone(memberFixture); memberPayload.authorityPlanes.workspaceMemberships[0].role = 'member'; memberPayload.console.projects[0].workspaceRole = 'member'; const memberRequest = vi.fn<typeof fetch>(); await expect(previewProjectSql(normalizeSaasContext(memberPayload), 'project_member', 'SELECT 1', 'wid_pk_console', 'session-token', memberRequest)).resolves.toEqual({ status: 'forbidden' }); expect(memberRequest).not.toHaveBeenCalled();
    const missing = vi.fn<typeof fetch>(); await expect(previewProjectSql(normalizeSaasContext(memberFixture), 'project_member', 'SELECT 1', 'wid_pk_console', null, missing)).resolves.toEqual({ status: 'auth' }); await expect(previewProjectSql(normalizeSaasContext(memberFixture), 'project_member', 'SELECT 1', 'wid_sk_server', 'session-token', missing)).resolves.toEqual({ status: 'locked' }); expect(missing).not.toHaveBeenCalled();
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300); const denied = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ error: 'scope' }, { status: 403 })); await expect(executeProjectSql(normalizeSaasContext(memberFixture), 'project_member', 'SELECT 1', 'wid_pk_wrong_scope', 'session-token', denied)).resolves.toEqual({ status: 'forbidden' }); vi.useRealTimers();
  });

  it('rejects cross-tenant Database management before token exchange', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(loadProjectMigrations(normalizeSaasContext(memberFixture), 'project_foreign', 'wid_pk_console', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectRlsPolicies(normalizeSaasContext(memberFixture), 'project_foreign', 'public', 'todos', 'wid_pk_console', 'session-token', request)).resolves.toEqual({ status: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
  });
});

describe('project Functions console contract', () => {
  const summary = { slug: 'billing-hook', activeVersion: 2, auth: 'user' as const, sourceSha256: 'sha', state: 'active', createdAt: '2026-08-01T00:00:00Z', activatedAt: '2026-08-02T00:00:00Z' };

  it('issues only a short-lived functions:invoke browser key', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ key: 'wid_pk_functions_only', data: { id: 'key_fn', name: 'fn', kind: 'publishable', key_prefix: 'wid_pk_functions', scopes: ['functions:invoke'], allowed_origins: ['https://myfastools.com'], revoked_at: null } }));
    await expect(issueProjectFunctionsConsoleKey(normalizeSaasContext(memberFixture), 'project_member', 'session-token', 'https://myfastools.com', request)).resolves.toMatchObject({ status: 'ready', oneTimeKey: 'wid_pk_functions_only' });
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body)); expect(body.scopes).toEqual(['functions:invoke']); expect(body.expires_at).toBe(Math.floor(Date.now() / 1000) + 900); expect(JSON.stringify(body)).not.toMatch(/data:|storage:|auth:use/); vi.useRealTimers();
  });

  it('adds only explicitly opted-in data:read to a 15-minute Functions key and rejects scope expansion', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));
    try {
      for (const scopes of [['functions:invoke', 'data:read'], ['data:read', 'functions:invoke'], ['functions:invoke'], ['functions:invoke', 'data:read', 'data:write'], ['functions:invoke', 'functions:invoke']]) {
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ key: 'wid_pk_functions_read', data: { id: 'key_fn', name: 'fn', kind: 'publishable', key_prefix: 'wid_pk_functions', scopes, allowed_origins: ['https://myfastools.com'], revoked_at: null } }));
        const result = await issueProjectFunctionsConsoleKey(normalizeSaasContext(memberFixture), 'project_member', 'session-token', 'https://myfastools.com', request, true);
        expect(result.status).toBe(scopes.length === 2 && new Set(scopes).size === 2 ? 'ready' : 'error');
        const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body)); expect(body.scopes).toEqual(['functions:invoke', 'data:read']); expect(body.expires_at).toBe(Math.floor(Date.now() / 1000) + 900); expect(body.allowed_origins).toEqual(['https://myfastools.com']);
        expect(body.scopes).not.toContain('data:write'); expect(body.scopes).not.toContain('data:admin');
      }
      const forbidden = vi.fn<typeof fetch>(); expect(await issueProjectFunctionsConsoleKey(normalizeSaasContext(memberFixture), 'project_foreign', 'session-token', 'https://myfastools.com', forbidden, true)).toEqual({ status: 'error', reason: 'forbidden' }); expect(forbidden).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('loads an allowlisted inventory and capability readiness without source or secrets', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const inventoryRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ functions: [{ project_id: 'project_member', slug: 'billing-hook', active_version: 2, auth: 'user', source_sha256: 'sha', state: 'active', created_at: summary.createdAt, activated_at: summary.activatedAt, source: 'drop', publishable_key: 'drop' }] }));
    await expect(loadProjectFunctions(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', inventoryRequest)).resolves.toEqual({ status: 'ready', data: [summary] });
    expect(JSON.stringify(await loadProjectFunctions(normalizeSaasContext(memberFixture), 'project_foreign', 'wid_pk_console', 'session-token', vi.fn<typeof fetch>()))).not.toContain('drop');
    const readyRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ project_id: 'project_member', capabilities: { functions: { status: 'available', invoke: true, deploy: true, listVersions: true, logs: true, activate: true, rollback: true, delete: true } } }));
    await expect(loadProjectFunctionsReadiness(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', readyRequest)).resolves.toMatchObject({ status: 'ready', data: { available: true, rollback: true } });
    expect(readyRequest.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/functions');
    expect(readyRequest.mock.calls.some(([url]) => String(url).endsWith('/discovery'))).toBe(false);
    vi.useRealTimers();
  });

  it('rejects missing or foreign inventory capability projections without broadening Functions authorization', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const payload of [{ functions: [] }, { project_id: 'project_member', capabilities: {} }, { project_id: 'project_foreign', capabilities: { functions: { status: 'available', deploy: true } } }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json(payload));
      expect(await loadProjectFunctionsReadiness(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_functions_only', 'session-token', request)).toEqual({ status: 'invalid' });
      expect(request.mock.calls).toHaveLength(2); expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/functions');
    }
  });

  it('loads version and paginated audit projections while dropping bodies and runtime output', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ versions: [{ version: 2, auth: 'user', source_sha256: 'sha', state: 'active', failure_code: null, created_at: summary.createdAt, activated_at: summary.activatedAt, source_code: 'drop' }] })).mockResolvedValueOnce(Response.json({ logs: [{ id: 9, version: 2, event: 'invoked', state: 'success', failure_code: null, occurred_at: summary.activatedAt, request_id: 'req_from_log', body: 'drop', stdout: 'drop', stderr: 'drop', token: 'drop' }], next_before_id: 9 }));
    const result = await loadProjectFunctionDetail(normalizeSaasContext(memberFixture), 'project_member', summary, 'wid_pk_console', 'session-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { versions: [{ version: 2 }], logs: [{ id: 9, event: 'invoked', requestId: 'req_from_log' }], nextBeforeId: 9 } });
    expect(JSON.stringify(result)).not.toMatch(/source_code|stdout|stderr|"token"|drop/);
    expect(request.mock.calls[2]?.[0]).toContain('logs?limit=50'); vi.useRealTimers();
  });

  it('propagates abort signals on inventory and detail loads', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      if (init?.signal?.aborted) return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return Promise.resolve(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
    });
    controller.abort();
    await expect(loadProjectFunctions(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_console', 'session-token', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    vi.useRealTimers();
  });

  it('deploys transient source, activates and deletes through exact canonical routes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const deployedJson = { function: { slug: summary.slug, active_version: 2, auth: 'user', source_sha256: 'sha', state: 'active', created_at: summary.createdAt, activated_at: summary.activatedAt } };
    const deployRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(JSON.stringify(deployedJson), { status: 201 }));
    const deployed = await deployProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'export default () => new Response()', 'user', 'wid_pk_console', 'session-token', deployRequest);
    expect(deployed).toEqual({ status: 'ready', data: summary }); expect(JSON.stringify(deployed)).not.toContain('export default');
    expect(deployRequest.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/functions/billing-hook/deploy');
    const activateRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json(deployedJson.function));
    await expect(activateProjectFunctionVersion(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 2, 'wid_pk_console', 'session-token', activateRequest)).resolves.toEqual({ status: 'ready', data: summary });
    expect(activateRequest.mock.calls[1]?.[0]).toContain('/versions/2/activate');
    const deleteRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', deleteRequest)).resolves.toEqual({ status: 'ready', data: { slug: summary.slug } }); vi.useRealTimers();
  });

  it('rejects activation receipts for another function or version and propagates cancellation', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const receipt = { slug: summary.slug, active_version: 2, auth: 'user', state: 'active', created_at: summary.createdAt, activated_at: summary.activatedAt };
    for (const invalid of [{ project_id: 'other-project' }, { slug: 'other-function' }, { active_version: 1 }, { state: 'failed' }]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ ...receipt, ...invalid }));
      await expect(activateProjectFunctionVersion(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 2, 'wid_pk_console', 'session-token', request)).resolves.toEqual({ status: 'invalid' });
    }
    for (const kind of ['activate', 'delete'] as const) {
      const controller = new AbortController();
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(kind === 'activate' ? Response.json(receipt) : new Response(null, { status: 204 }));
      const context = normalizeSaasContext(memberFixture);
      const call = () => kind === 'activate'
        ? activateProjectFunctionVersion(context, 'project_member', summary.slug, 2, 'wid_pk_console', 'session-token', request, controller.signal)
        : deleteProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, controller.signal);
      await expect(call()).resolves.toMatchObject({ status: 'ready' });
      expect(request.mock.calls.map(([, init]) => init?.signal)).toEqual([controller.signal, controller.signal]);
      request.mockClear(); controller.abort();
      await expect(call()).rejects.toMatchObject({ name: 'AbortError' });
      expect(request).not.toHaveBeenCalled();
    }
  });

  it('bounds UTF-8 deployment source before authorization and rejects foreign deployment receipts', async () => {
    const context = normalizeSaasContext(memberFixture); const request = vi.fn<typeof fetch>();
    for (const source of [' ', 'x'.repeat(PROJECT_FUNCTION_SOURCE_LIMIT + 1), '界'.repeat(87382), 'export default () => new Response();\0']) await expect(deployProjectFunction(context, 'project_member', summary.slug, source, 'user', 'wid_pk_console', 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    expect(request).not.toHaveBeenCalled();
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const override of [{ slug: 'foreign' }, { auth: 'project' }, { active_version: 0 }, { state: 'failed' }]) {
      const deployed = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ function: { slug: summary.slug, auth: 'user', active_version: 1, state: 'active', ...override } }));
      await expect(deployProjectFunction(context, 'project_member', summary.slug, 'export default () => Response.json({ok:true})', 'user', 'wid_pk_console', 'user-token', deployed)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('sends exact-limit ASCII and multibyte source unchanged', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const prefix = 'export default () => new Response();\n//';
    const remaining = PROJECT_FUNCTION_SOURCE_LIMIT - new TextEncoder().encode(prefix).byteLength;
    for (const suffix of ['x'.repeat(remaining), '界'.repeat(Math.floor(remaining / 3)) + 'x'.repeat(remaining % 3)]) {
      const source = prefix + suffix;
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ function: { slug: summary.slug, auth: 'user', active_version: 1, state: 'active' } }));
      await expect(deployProjectFunction(context, 'project_member', summary.slug, source, 'user', 'wid_pk_console', 'user-token', request)).resolves.toMatchObject({ status: 'ready' });
      expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).source).toBe(source);
    }
  });

  it('uses one deployment cancellation signal and suppresses a cancelled late authorization', async () => {
    const context = normalizeSaasContext(memberFixture); const controller = new AbortController();
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }); });
    await expect(deployProjectFunction(context, 'project_member', summary.slug, 'export default () => Response.json({ok:true})', 'user', 'wid_pk_console', 'user-token', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('reads backend trace-filtered pages and maps the marker separately from upstream request IDs', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const logs = [{ id: 9, version: 2, event: 'invoked', state: 'succeeded', marker: 'trace.old-1', request_id: 'upstream:request', occurred_at: summary.activatedAt, source: 'drop', stdout: 'drop' }];
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ versions: [] }))
      .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.function-logs/v1', project_id: 'project_member', function_slug: summary.slug, logs, next_before_id: 9 }));
    const result = await loadProjectFunctionDetail(normalizeSaasContext(memberFixture), 'project_member', summary, 'wid_pk_console', 'session-token', request, 10, undefined, 'trace.old-1');
    expect(result).toMatchObject({ status: 'ready', data: { traceId: 'trace.old-1', nextBeforeId: 9, logs: [{ id: 9, traceId: 'trace.old-1', requestId: 'upstream:request' }] } });
    expect(request.mock.calls[2]?.[0]).toBe('/api/project-data/v1/projects/project_member/functions/billing-hook/logs?limit=50&before_id=10&trace_id=trace.old-1');
    expect(JSON.stringify(result)).not.toMatch(/stdout|"source"|drop/);
  });

  it('rejects malformed trace receipts and unsafe filters without widening the page scope', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const entry = { id: 9, version: 2, event: 'invoked', state: 'succeeded', marker: 'trace-1', occurred_at: summary.activatedAt };
    const page = { schema_version: 'w-db.function-logs/v1', project_id: 'project_member', function_slug: summary.slug, logs: [entry], next_before_id: 9 };
    for (const receipt of [{...page, project_id:'foreign'}, {...page, function_slug:'other'}, {...page, schema_version:'unknown'}, {...page, logs:[{...entry,marker:'different'}]}, {...page, next_before_id:10}, {...page,logs:[entry,entry]}, {...page,logs:[{...entry,id:8},entry]}, {...page,logs:[{...entry,id:10}],next_before_id:10}]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ versions: [] })).mockResolvedValueOnce(Response.json(receipt));
      expect(await loadProjectFunctionDetail(normalizeSaasContext(memberFixture), 'project_member', summary, 'wid_pk_console', 'session-token', request, 10, undefined, 'trace-1')).toEqual({ status:'invalid' });
    }
    for (const traceId of ['', 'bad trace', 'trace:colon', 'x'.repeat(129), 'bad\n']) {
      const request = vi.fn<typeof fetch>();
      expect(await loadProjectFunctionDetail(normalizeSaasContext(memberFixture), 'project_member', summary, 'wid_pk_console', 'session-token', request, undefined, undefined, traceId)).toEqual({status:'invalid'});
      expect(await invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, '{}', 'GET', '', traceId)).toEqual({status:'invalid'});
      expect(request).not.toHaveBeenCalled();
    }
  });

  it('sends the supplied invocation marker with no body and returns it independently of upstream headers', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, {status:202,headers:{'x-request-id':'upstream:request'}}));
    expect(await invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, '{', 'HEAD', '', 'trace.client-1')).toEqual({status:'ready',data:{status:202,requestId:'upstream:request',traceId:'trace.client-1',bodyPreview:'',bodyTruncated:false}});
    const init = request.mock.calls[1]?.[1];
    expect(new Headers(init?.headers).get('x-w-trace-marker')).toBe('trace.client-1');
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it('protected invoke exposes status, correlation id, and truncated redacted body only', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const secretBody = JSON.stringify({ ok: true, secret: 'must-not-render', token: 'wid_sk_leak' });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(secretBody, { status: 202, headers: { 'x-request-id': 'req_123' } }));
    await expect(invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', request)).resolves.toEqual({
      status: 'ready',
      data: { status: 202, requestId: 'req_123', bodyPreview: '[REDACTED]', bodyTruncated: true },
    });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/project/project_member/functions/v1/billing-hook');

    const longSafe = 'x'.repeat(FUNCTION_INVOKE_BODY_PREVIEW_LIMIT + 40);
    const longRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(longSafe, { status: 200 }));
    const longResult = await invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', longRequest);
    expect(longResult).toMatchObject({ status: 'ready', data: { status: 200, bodyTruncated: true } });
    if (longResult.status === 'ready') {
      expect(longResult.data.bodyPreview.endsWith('…')).toBe(true);
      expect([...longResult.data.bodyPreview].length).toBeLessThanOrEqual(FUNCTION_INVOKE_BODY_PREVIEW_LIMIT + 1);
      expect(longResult.data.bodyPreview).not.toContain('must-not');
    }

    const functionDenied = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'jwt_required' }), { status: 401 }));
    await expect(invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_member', summary.slug, 'wid_pk_console', 'session-token', functionDenied)).resolves.toEqual({
      status: 'ready',
      data: { status: 401, bodyPreview: '{"error":"jwt_required"}', bodyTruncated: false },
    });
    vi.useRealTimers();
  });

  it('redacts secret-like invoke bodies without inventing content', () => {
    expect(redactFunctionInvokeBody('{"ok":true}')).toEqual({ bodyPreview: '{"ok":true}', bodyTruncated: false });
    expect(redactFunctionInvokeBody('Authorization: Bearer abc.def')).toEqual({ bodyPreview: '[REDACTED]', bodyTruncated: true });
    expect(redactFunctionInvokeBody(`password=${'p'.repeat(20)}`)).toEqual({ bodyPreview: '[REDACTED]', bodyTruncated: true });
    const long = 'n'.repeat(FUNCTION_INVOKE_BODY_PREVIEW_LIMIT + 10);
    const truncated = redactFunctionInvokeBody(long);
    expect(truncated.bodyTruncated).toBe(true);
    expect(truncated.bodyPreview.endsWith('…')).toBe(true);
  });

  it('sends custom JSON with exact-project authorization and rejects malformed or oversized input before network access', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ accepted: true }));
    const body = JSON.stringify({ action: 'calculate', items: [{ amount: 7 }], note: '测试' });
    await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, body)).resolves.toMatchObject({ status: 'ready', data: { status: 200 } });
    expect(request.mock.calls[1]?.[1]?.body).toBe(body);
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${token}`);
    expect(request.mock.calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    const rejected = vi.fn<typeof fetch>();
    for (const invalid of ['{', '', JSON.stringify('界'.repeat(22_000))]) {
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', rejected, undefined, invalid)).resolves.toEqual({ status: 'invalid' });
    }
    expect(rejected).not.toHaveBeenCalled();
  });

  it('sends text, XML and encoded form bodies unchanged with the selected media type and scoped authorization', async () => {
    const context = normalizeSaasContext(memberFixture), token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const [contentType, body] of [['text/plain', '中文\n%2F + unchanged'], ['application/xml', '<item>中文 &amp; %25</item>'], ['application/x-www-form-urlencoded', 'tag=a&tag=b&name=%E4%B8%AD&plus=%2B&space=a+b']] as const) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response('ok', { status: 202 }));
        await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, body, method, 'tag=one&tag=two', 'raw-body-trace', contentType)).resolves.toMatchObject({ status: 'ready', data: { status: 202, bodyPreview: 'ok' } });
        const init = request.mock.calls[1]?.[1]; expect(init?.body).toBe(body); expect(init?.method).toBe(method);
        const headers = new Headers(init?.headers); expect(headers.get('content-type')).toBe(contentType); expect(headers.get('authorization')).toBe('Bearer ' + token); expect(headers.get('apikey')).toBe('wid_pk_console'); expect(headers.get('x-w-trace-marker')).toBe('raw-body-trace');
        expect(init?.signal).toBe(request.mock.calls[0]?.[1]?.signal);
      }
    }
  });

  it('bounds UTF-8 bytes without parsing raw bodies, refuses unlisted media types and keeps GET/HEAD bodyless', async () => {
    const context = normalizeSaasContext(memberFixture), token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300), rejected = vi.fn<typeof fetch>();
    for (const contentType of PROJECT_FUNCTION_INVOKE_CONTENT_TYPES) {
      const boundary = contentType === 'application/json' ? '"' + 'x'.repeat(65534) + '"' : '中'.repeat(21845) + 'x';
      expect(validProjectFunctionInvokeBody(boundary, contentType)).toBe(true); expect(validProjectFunctionInvokeBody(boundary + ' ', contentType)).toBe(false);
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', rejected, undefined, boundary + ' ', 'POST', '', undefined, contentType)).resolves.toEqual({ status: 'invalid' });
    }
    for (const contentType of ['text/html', 'multipart/form-data', 'text/plain\r\nAuthorization: other']) {
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', rejected, undefined, 'text', 'POST', '', undefined, contentType as never)).resolves.toEqual({ status: 'invalid' });
    }
    expect(rejected).not.toHaveBeenCalled();
    for (const contentType of ['text/plain', 'application/xml', 'application/x-www-form-urlencoded'] as const) {
      expect(validProjectFunctionInvokeBody('', contentType)).toBe(true);
      for (const method of ['GET', 'HEAD'] as const) {
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, '中'.repeat(22000), method, '', undefined, contentType)).resolves.toMatchObject({ status: 'ready' });
        expect(request.mock.calls[1]?.[1]?.body).toBeUndefined(); expect(new Headers(request.mock.calls[1]?.[1]?.headers).has('content-type')).toBe(false);
      }
    }
  });

  it('normalizes query encoding while preserving duplicates, empty values and literal plus signs', () => {
    expect(parseProjectFunctionQuery('')).toBe('');
    expect(parseProjectFunctionQuery('?name=中文&tag=a&tag=b&empty=&flag&literal=%2B&space=two+words&part=%23x'))
      .toBe('name=%E4%B8%AD%E6%96%87&tag=a&tag=b&empty=&flag=&literal=%2B&space=two+words&part=%23x');
    expect(parseProjectFunctionQuery('q=one two')).toBe('q=one+two');
    expect(parseProjectFunctionQuery('value=%26x%3Dy')).toBe('value=%26x%3Dy');
  });

  it('bounds encoded query bytes and rejects fragments, malformed UTF-8 and control characters', () => {
    expect(parseProjectFunctionQuery('q=' + 'x'.repeat(FUNCTION_INVOKE_QUERY_LIMIT - 2))).not.toBeNull();
    for (const query of ['q=' + 'x'.repeat(FUNCTION_INVOKE_QUERY_LIMIT - 1), 'q=' + '界'.repeat(500), 'q=%', 'q=%XX', 'q=%FF', 'q=%C0%AF', 'q=value#fragment', 'q=\n', 'q=%0d%0a', 'q=%00', 'q=%7f']) expect(parseProjectFunctionQuery(query)).toBeNull();
  });

  it('forwards query parameters with all six HTTP methods on the fixed scoped path', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const method of PROJECT_FUNCTION_INVOKE_METHODS) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(method === 'HEAD' ? new Response(null, { status: 200 }) : Response.json({ ok: true }));
      expect(await invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, '{"value":7}', method, 'q=中文&tag=a&tag=b&path=%2Fforeign%3Fvalue%3D1')).toMatchObject({ status: 'ready' });
      expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/project/project_member/functions/v1/billing-hook?q=%E4%B8%AD%E6%96%87&tag=a&tag=b&path=%2Fforeign%3Fvalue%3D1');
      expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${token}`);
      expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('apikey')).toBe('wid_pk_console');
    }
    const rejected = vi.fn<typeof fetch>();
    for (const query of ['q=%FF', 'q=value#fragment', 'q=' + 'x'.repeat(4096)]) expect(await invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', rejected, undefined, '{}', 'GET', query)).toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
  });

  it('uses the selected supported method and omits body and content type for GET and HEAD', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const method of PROJECT_FUNCTION_INVOKE_METHODS) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const body = hasBody ? '{"value":7}' : '{ignored-invalid-json' + 'x'.repeat(65_536);
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, body, method)).resolves.toMatchObject({ status: 'ready', data: { status: 204, bodyPreview: '' } });
      const invocation = request.mock.calls[1]?.[1];
      expect(invocation?.method).toBe(method);
      expect(invocation?.body).toBe(hasBody ? body : undefined);
      expect(new Headers(invocation?.headers).get('content-type')).toBe(hasBody ? 'application/json' : null);
      expect(new Headers(invocation?.headers).get('authorization')).toBe(`Bearer ${token}`);
      expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/project/project_member/functions/v1/billing-hook');
    }
    const rejected = vi.fn<typeof fetch>();
    for (const method of ['OPTIONS', 'CONNECT', 'get']) {
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', rejected, undefined, '{}', method as never)).resolves.toEqual({ status: 'invalid' });
    }
    expect(rejected).not.toHaveBeenCalled();
  });

  it('reports empty HEAD HTTP errors and safe correlation metadata as invocation results', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const status of [401, 403, 500]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response(null, { status, headers: { 'x-request-id': 'req_head_error' } }));
      await expect(invokeProtectedProjectFunction(context, 'project_member', summary.slug, 'wid_pk_console', 'session-token', request, undefined, '{', 'HEAD')).resolves.toEqual({ status: 'ready', data: { status, requestId: 'req_head_error', bodyPreview: '', bodyTruncated: false } });
      expect(request.mock.calls[1]?.[1]?.method).toBe('HEAD');
    }
  });

  it('fails closed for cross-tenant and revoked-key denials and never renders sensitive fields', async () => {
    const cross = vi.fn<typeof fetch>(); await expect(loadProjectFunctions(normalizeSaasContext(memberFixture), 'project_foreign', 'wid_pk_console', 'session-token', cross)).resolves.toEqual({ status: 'forbidden' }); expect(cross).not.toHaveBeenCalled();
    await expect(invokeProtectedProjectFunction(normalizeSaasContext(memberFixture), 'project_foreign', summary.slug, 'wid_pk_console', 'session-token', cross)).resolves.toEqual({ status: 'forbidden' });
    expect(cross).not.toHaveBeenCalled();
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const revoked = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(new Response('{}', { status: 403 }));
    await expect(loadProjectFunctions(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_revoked', 'session-token', revoked)).resolves.toEqual({ status: 'forbidden' });
    expect(functionsComponentSource).not.toMatch(/localStorage|sessionStorage|wid_sk|DATABASE_URL|stdout|stderr/);
    expect(functionsComponentSource).toMatch(/htmlFor|aria-labelledby|role="status"|role="alert"/);
    expect(functionsComponentSource).toMatch(/AbortController/);
    expect(functionsComponentSource).toMatch(/capDeploy|capRollback|bodyPreview|requestFilter/);
    vi.useRealTimers();
  });
});

describe('project Realtime console contract', () => {
  const realtimeStatus = { projectId: 'project_member', available: true, protocol: 'supabase_realtime_v1' as const, websocketUrl: 'wss://db.myfastools.com/project/project_member/realtime/v1/websocket', activeConnections: 2, broadcast: true, presence: true, postgresChanges: false, privateChannels: true, limits: { connections: 100, frameBytes: 16384, framesPerSecond: 20 } };

  it('issues only the scopes required by authenticated discovery and Realtime', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ key: 'wid_pk_realtime_only', data: { id: 'key_rt', name: 'rt', kind: 'publishable', key_prefix: 'wid_pk_realtime', scopes: ['auth:use', 'realtime:connect'], allowed_origins: ['https://myfastools.com'], revoked_at: null } }));
    await expect(issueProjectRealtimeConsoleKey(normalizeSaasContext(memberFixture), 'project_member', 'session-token', 'https://myfastools.com', request)).resolves.toMatchObject({ status: 'ready', oneTimeKey: 'wid_pk_realtime_only' });
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body)); expect(body.scopes).toEqual(['auth:use', 'realtime:connect']); expect(body.expires_at).toBe(Math.floor(Date.now() / 1000) + 900); expect(JSON.stringify(body)).not.toMatch(/data:|storage:|functions:/); vi.useRealTimers();
  });

  it('cross-validates authenticated discovery and status without inventing worker state', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ project_id: 'project_member', capabilities: { realtime: { status: 'available', broadcast: true, presence: true, privateChannels: true, postgresChanges: false } } })).mockResolvedValueOnce(Response.json({ schema_version: 'w-db.realtime-status/v1', project_id: 'project_member', status: 'available', protocol: 'supabase_realtime_v1', websocket_url: realtimeStatus.websocketUrl, active_connections: 2, features: { broadcast: true, presence: true, postgres_changes: false, private_channels: true }, limits: { connections_per_project: 100, frame_bytes: 16384, frames_per_second: 20 }, worker_secret: 'drop', row: { secret: 'drop' } }));
    const result = await loadProjectRealtimeStatus(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_realtime', 'session-token', request);
    expect(result).toEqual({ status: 'ready', data: realtimeStatus }); expect(JSON.stringify(result)).not.toMatch(/worker_secret|row|drop|token/);
    expect(request.mock.calls.map(([url]) => String(url))).toEqual(['/api/workspaces/ws_member/projects/project_member/management-token', '/api/project-data/v1/projects/project_member/discovery', '/api/project-data/v1/projects/project_member/realtime/status']); vi.useRealTimers();
  });

  it('projects bounded nullable replication diagnostics while keeping Broadcast and Presence available', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const read = async (diagnostics: Record<string, unknown>) => {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ project_id: 'project_member', capabilities: { realtime: true } }))
        .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.realtime-status/v1', project_id: 'project_member', status: 'available', protocol: 'supabase_realtime_v1', websocket_url: realtimeStatus.websocketUrl, active_connections: 2, features: { broadcast: true, presence: true, postgres_changes: false, private_channels: true }, limits: { connections_per_project: 100, frame_bytes: 16384, frames_per_second: 20 }, ...diagnostics }));
      return loadProjectRealtimeStatus(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_realtime', 'session-token', request);
    };
    for (const workerStatus of ['initializing', 'running', 'standby', 'retrying', 'stopped', 'failed', 'unconfigured']) {
      expect(await read({ worker_status: workerStatus, lag_bytes: null, last_error: null })).toMatchObject({ status: 'ready', data: { workerStatus, lagBytes: null, lastError: null, broadcast: true, presence: true, postgresChanges: false } });
    }
    for (const lastError of ['decoder_busy', 'replication_unavailable', 'worker_stopped', 'not_configured', 'lag_probe_unavailable']) {
      expect(await read({ worker_status: 'retrying', lag_bytes: 0, last_error: lastError })).toMatchObject({ status: 'ready', data: { lagBytes: 0, lastError } });
    }
    expect(await read({ worker_status: 'running', lag_bytes: Number.MAX_SAFE_INTEGER, last_error: null })).toMatchObject({ status: 'ready', data: { lagBytes: Number.MAX_SAFE_INTEGER } });
    for (const invalid of [{ worker_status: 'postgres://private-provider-secret' }, { worker_status: null }, { last_error: 'raw SQL password=private-provider-secret' }, { last_error: {} }, ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '12', {}].map(lag_bytes => ({ lag_bytes }))]) {
      const result = await read(invalid); expect(result).toEqual({ status: 'invalid' }); expect(JSON.stringify(result)).not.toContain('private-provider-secret');
    }
  });

  it('bounds UTF-8 broadcast names, JSON objects and serialized project frame size', () => {
    expect(parseProjectRealtimeBroadcast('消息.created', '{"nested":{"title":"雪"},"count":2}', 16384, 'room')).toEqual({ event: '消息.created', payload: { nested: { title: '雪' }, count: 2 } });
    for (const event of ['', '*', 'has space', 'line\nfeed', 'nul\0name', '雪'.repeat(22)]) expect(parseProjectRealtimeBroadcast(event, '{}', 16384)).toBeNull();
    for (const source of ['null', '[]', '42', '{broken', JSON.stringify({ value: '雪'.repeat(2731) })]) expect(parseProjectRealtimeBroadcast('valid', source, 16384)).toBeNull();
    expect(parseProjectRealtimeBroadcast('valid', JSON.stringify({ value: 'a'.repeat(900) }), 1024, 'room')).toBeNull();
    expect(parseProjectRealtimeBroadcast('valid', '{}', NaN)).toBeNull();
  });

  it('sends custom Broadcast through the SDK, rejects invalid sends and exposes only the current event name', async () => {
    const handlers: Array<{ type: string; filter: Record<string, string>; callback: (payload: unknown) => void }> = [];
    const fakeChannel = { on(type: string, filter: Record<string, string>, callback: (payload: unknown) => void) { handlers.push({ type, filter, callback }); return this; }, subscribe(callback: (state: string) => void) { callback('SUBSCRIBED'); return this; }, presenceState: () => ({}), track: vi.fn().mockResolvedValue('ok'), send: vi.fn().mockResolvedValue('ok') };
    vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never); vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    try {
      const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
      const received = vi.fn(); const result = await startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', realtimeStatus, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent: received });
      expect(result.status).toBe('ready'); if (result.status !== 'ready') return;
      const broadcast = handlers.find(handler => handler.type === 'broadcast')!; expect(broadcast.filter).toEqual({ event: '*' });
      await expect(result.data.sendTestEvent({ event: '消息.created', payload: { nested: { title: '雪' }, count: 2 } })).resolves.toBe('ok');
      expect(fakeChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: '消息.created', payload: { nested: { title: '雪' }, count: 2 } });
      broadcast.callback({ event: 'other', payload: { secret: 'private-other-event' } }); expect(received).not.toHaveBeenCalled();
      broadcast.callback({ event: '消息.created', payload: { secret: 'private-payload' } }); expect(received.mock.calls).toEqual([['消息.created']]);
      for (const input of [{ event: 'bad name', payload: {} }, { event: 'valid', payload: [] }, { event: 'valid', payload: { value: '雪'.repeat(2731) } }]) await expect(result.data.sendTestEvent(input as never)).resolves.toBe('error');
      const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic; await expect(result.data.sendTestEvent({ event: 'valid', payload: cyclic })).resolves.toBe('error');
      expect(fakeChannel.send).toHaveBeenCalledTimes(1);
      fakeChannel.send.mockResolvedValueOnce('timed out'); await expect(result.data.sendTestEvent({ event: 'retry', payload: {} })).resolves.toBe('error');
      await result.data.stop(); broadcast.callback({ event: 'retry', payload: {} }); expect(received).toHaveBeenCalledTimes(1);
      await expect(result.data.sendTestEvent({ event: 'retry', payload: {} })).resolves.toBe('error'); expect(fakeChannel.send).toHaveBeenCalledTimes(2);
    } finally { vi.restoreAllMocks(); }
  });

  it('changes Presence through the authorized SDK without replay or accepting late acknowledgements', async () => {
    const fakeChannel = { on() { return this; }, subscribe(callback: (state: string) => void) { callback('SUBSCRIBED'); return this; }, presenceState: () => ({}), track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok') };
    vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never); vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    try {
      const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
      const result = await startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', realtimeStatus, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {} });
      expect(result.status).toBe('ready'); if (result.status !== 'ready') return;
      await expect(result.data.setPresenceTracked(false)).resolves.toBe('ok');
      await expect(result.data.setPresenceTracked(true)).resolves.toBe('ok');
      expect(fakeChannel.track).toHaveBeenCalledTimes(2);
      expect(fakeChannel.track).toHaveBeenLastCalledWith({ online_at: expect.any(String), client: 'w-platform-console' });
      expect(request).toHaveBeenCalledTimes(1);
      fakeChannel.untrack.mockResolvedValueOnce('timed out');
      await expect(result.data.setPresenceTracked(false)).resolves.toBe('error');
      expect(fakeChannel.untrack).toHaveBeenCalledTimes(2);
      fakeChannel.track.mockRejectedValueOnce(new Error('transport failed'));
      await expect(result.data.setPresenceTracked(true)).resolves.toBe('error');
      let acknowledge!: (value: string) => void;
      fakeChannel.untrack.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
      const pending = result.data.setPresenceTracked(false); await result.data.stop(); acknowledge('ok');
      await expect(pending).resolves.toBe('error');
      await expect(result.data.setPresenceTracked(true)).resolves.toBe('error');
      await expect(result.data.setPresenceTracked(false)).resolves.toBe('error');
      expect(fakeChannel.track).toHaveBeenCalledTimes(3); expect(fakeChannel.untrack).toHaveBeenCalledTimes(3);
    } finally { vi.restoreAllMocks(); }
  });

  it('uses the official RealtimeClient for private Broadcast and Presence with memory-only state', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z')); const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const handlers: Array<{ type: string; filter: Record<string, string>; callback: () => void }> = [];
    const fakeChannel = { on(type: string, filter: Record<string, string>, callback: () => void) { handlers.push({ type, filter, callback }); return this; }, subscribe(callback: (state: string) => void) { callback('SUBSCRIBED'); return this; }, presenceState() { return { usr: [{}] }; }, track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok'), send: vi.fn().mockResolvedValue('ok') };
    const setAuth = vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); const channel = vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never); const remove = vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); const disconnect = vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })); const connection = vi.fn(); const presence = vi.fn(); const testEvent = vi.fn();
    const result = await startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', realtimeStatus, 'room_1', 'wid_pk_realtime', 'session-token', request, { onConnection: connection, onPresence: presence, onTestEvent: testEvent });
    expect(result.status).toBe('ready'); expect(setAuth).toHaveBeenCalledWith(token); expect(channel).toHaveBeenCalledWith('room_1', expect.objectContaining({ config: expect.objectContaining({ private: true }) })); expect(fakeChannel.track).toHaveBeenCalled(); expect(connection).toHaveBeenCalledWith('SUBSCRIBED');
    expect(new URL((channel.mock.instances[0] as RealtimeClient).endpointURL()).pathname).toBe('/project/project_member/realtime/v1/websocket');
    if (result.status === 'ready') { await expect(result.data.sendTestEvent()).resolves.toBe('ok'); await result.data.stop(); }
    expect(fakeChannel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'w_console_test', payload: { kind: 'controlled_test' } }); expect(remove).toHaveBeenCalled(); expect(disconnect).toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain(token); vi.restoreAllMocks(); vi.useRealTimers();
  });

  it('reads the actual authenticated boolean capability and never overrides an explicit denial', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const capability of [true, false, undefined, 'available']) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ project_id: 'project_member', capabilities: { realtime: capability } }))
        .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.realtime-status/v1', project_id: 'project_member', status: 'available', protocol: 'supabase_realtime_v1', websocket_url: realtimeStatus.websocketUrl, active_connections: 2, features: { broadcast: true, presence: true, postgres_changes: true, private_channels: true }, limits: { connections_per_project: 100, frame_bytes: 16384, frames_per_second: 20 } }));
      const result = await loadProjectRealtimeStatus(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_realtime', 'session-token', request);
      if (typeof capability === 'boolean') expect(result).toMatchObject({ status: 'ready', data: { available: capability, broadcast: capability, presence: capability, postgresChanges: capability, privateChannels: capability } });
      else expect(result).toEqual({ status: 'invalid' });
    }
  });

  it.each([['todos', undefined], ['表"events', undefined], ['public.todos', undefined], ['todos', 'done=eq.true'], ['todos', 'status=in.("a,b",open),priority=gte.2'], ['todos', 'title=eq.你好']] as const)('subscribes to exact table %s and server filter %s while projecting only event kinds and cleaning up on scope cancellation', async (table, filter) => {
    const handlers: Array<{ type: string; filter: Record<string, string>; callback: (payload?: unknown) => void }> = [];
    const fakeChannel = { on(type: string, filter: Record<string, string>, callback: (payload?: unknown) => void) { handlers.push({ type, filter, callback }); return this; }, subscribe(callback: (state: string) => void) { callback('SUBSCRIBED'); return this; }, presenceState: () => ({}), track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok'), send: vi.fn().mockResolvedValue('ok') };
    vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never);
    const remove = vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); const disconnect = vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
    const changed = vi.fn(); const abort = new AbortController();
    const result = await startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', { ...realtimeStatus, postgresChanges: true }, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {}, onPostgresChange: changed }, { table, filter, signal: abort.signal });
    expect(result.status).toBe('ready');
    const handler = handlers.find(item => item.type === 'postgres_changes')!;
    expect(handler.filter).toEqual({ event: '*', schema: 'public', table, ...(filter ? { filter } : {}) });
    for (const eventType of ['INSERT', 'UPDATE', 'DELETE']) handler.callback({ schema: 'public', table, eventType, new: { secret: 'never-render' }, old: { secret: 'never-render' } });
    handler.callback({ schema: 'public', table: 'other', eventType: 'INSERT' });
    handler.callback({ schema: 'private', table, eventType: 'INSERT' });
    handler.callback({ schema: 'public', table, eventType: 'TRUNCATE' });
    expect(changed.mock.calls).toEqual([['INSERT'], ['UPDATE'], ['DELETE']]);
    abort.abort(); handler.callback({ schema: 'public', table, eventType: 'INSERT' });
    if (result.status === 'ready') { await result.data.stop(); await result.data.stop(); await expect(result.data.sendTestEvent()).resolves.toBe('error'); }
    expect(changed).toHaveBeenCalledTimes(3); expect(fakeChannel.send).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('retires a subscribed channel after %s and ignores late callbacks', async (failure) => {
    const handlers: Array<{ type: string; callback: (payload?: unknown) => void }> = [];
    let subscription: ((state: string) => void) | undefined;
    const fakeChannel = { on(type: string, _filter: unknown, callback: (payload?: unknown) => void) { handlers.push({ type, callback }); return this; }, subscribe(callback: (state: string) => void) { subscription = callback; callback('SUBSCRIBED'); return this; }, presenceState: () => ({ user: [{}] }), track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok'), send: vi.fn().mockResolvedValue('ok') };
    vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never);
    const remove = vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); const disconnect = vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
    const connection = vi.fn(), presence = vi.fn(), testEvent = vi.fn(), changed = vi.fn();
    try {
      const result = await startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', { ...realtimeStatus, postgresChanges: true }, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection: connection, onPresence: presence, onTestEvent: testEvent, onPostgresChange: changed }, { table: 'todos' });
      expect(result.status).toBe('ready');
      subscription!(failure);
      await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
      expect(disconnect).toHaveBeenCalledOnce();
      expect(disconnect.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!);
      subscription!('SUBSCRIBED');
      for (const handler of handlers) handler.callback({ schema: 'public', table: 'todos', eventType: 'INSERT', new: { secret: 'private-row' } });
      expect(connection.mock.calls).toEqual([['SUBSCRIBED'], [failure]]);
      expect(presence).not.toHaveBeenCalled(); expect(testEvent).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
      if (result.status === 'ready') { await expect(result.data.sendTestEvent()).resolves.toBe('error'); await result.data.stop(); await result.data.stop(); }
      expect(fakeChannel.send).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce();
    } finally { vi.restoreAllMocks(); }
  });

  it('rejects invalid or unavailable table subscriptions before token exchange', async () => {
    const request = vi.fn<typeof fetch>(); const context = normalizeSaasContext(memberFixture);
    for (const table of ['', 'public/todos', '../other', 'todos\u0000', 'a'.repeat(64), '表'.repeat(22)]) {
      await expect(startProjectRealtimeChannel(context, 'project_member', { ...realtimeStatus, postgresChanges: true }, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {} }, { table })).resolves.toEqual({ status: 'invalid' });
    }
    await expect(startProjectRealtimeChannel(context, 'project_member', realtimeStatus, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {} }, { table: 'todos' })).resolves.toEqual({ status: 'invalid' });
    for (const options of [{ filter: 'done=eq.true' }, { table: 'todos', filter: '表'.repeat(1366) }, { table: 'todos', filter: 'id=eq.1\0' }, { table: 'todos', filter: 'id=eq.1\n' }]) {
      await expect(startProjectRealtimeChannel(context, 'project_member', { ...realtimeStatus, postgresChanges: true }, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {} }, options)).resolves.toEqual({ status: 'invalid' });
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('cancels an in-flight subscription without retaining a live channel', async () => {
    let subscribed: ((state: string) => void) | undefined;
    const fakeChannel = { on() { return this; }, subscribe(callback: (state: string) => void) { subscribed = callback; return this; }, presenceState: () => ({}), track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok') };
    vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(); vi.spyOn(RealtimeClient.prototype, 'channel').mockReturnValue(fakeChannel as never);
    const remove = vi.spyOn(RealtimeClient.prototype, 'removeChannel').mockResolvedValue('ok'); vi.spyOn(RealtimeClient.prototype, 'disconnect').mockResolvedValue('ok');
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300); const abort = new AbortController(); const connection = vi.fn();
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
    const pending = startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_member', realtimeStatus, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection: connection, onPresence() {}, onTestEvent() {} }, { signal: abort.signal });
    await vi.waitFor(() => expect(subscribed).toBeDefined()); abort.abort(); subscribed!('SUBSCRIBED');
    await expect(pending).resolves.toEqual({ status: 'network' }); expect(connection).not.toHaveBeenCalled(); expect(fakeChannel.track).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce(); vi.restoreAllMocks();
  });

  it('keeps Postgres Changes and absent worker telemetry explicitly disabled', async () => {
    expect(realtimeComponentSource).toContain('disabled={(!status.data.postgresChanges && !subscribeTable) || isConnected || busy}'); expect(realtimeComponentSource).toContain('t.postgresDisabled'); expect(realtimeComponentSource).toContain('t.missingStatus'); expect(realtimeComponentSource).not.toMatch(/localStorage|sessionStorage|wid_sk|row\.secret|accessToken/);
    const request = vi.fn<typeof fetch>(); await expect(startProjectRealtimeChannel(normalizeSaasContext(memberFixture), 'project_foreign', { ...realtimeStatus, projectId: 'project_foreign' }, 'room', 'wid_pk_realtime', 'session-token', request, { onConnection() {}, onPresence() {}, onTestEvent() {} })).resolves.toEqual({ status: 'forbidden' }); expect(request).not.toHaveBeenCalled();
  });
});

describe('W-ID SaaS context boundary', () => {
  it('loads only bounded exact-project Radar aggregates and preserves W-Monitor separation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project_id: 'radar-member_1', releases: [{ status: 'success', tag: 'v1', raw_log: 'drop' }], deployments: [], runtime: [], health: { ok: true, signal_count: 2 }, errors: { signals: [] }, latency: { signals: [] }, logs: { raw_logs: false, total: 3, last_seen_at: null }, links: { radar_project: 'https://radar.myfastools.com/projects/radar-member_1', w_monitor_infrastructure: 'https://serverstatus-rs.myfastools.com/dashboard?project_id=x' }, secret: 'drop' }), { status: 200 }));
    const result = await loadProjectObservability(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { healthOk: true, signalCount: 2, logTotal: 3, releases: [{ status: 'success', tag: 'v1' }] } });
    expect(JSON.stringify(result)).not.toContain('raw_log'); expect(JSON.stringify(result)).not.toContain('secret');
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer user-token');
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-radar/api/projects/radar-member_1/management');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(JSON.stringify(result)).not.toContain(managementToken);
    vi.useRealTimers();
  });

  it('requires current W-ID auth and surfaces exact-project authorization denial', async () => {
    const context = normalizeSaasContext(memberFixture);
    const missing = vi.fn<typeof fetch>();
    await expect(loadProjectObservability(context, 'project_member', null, missing)).resolves.toEqual({ status: 'auth' });
    expect(missing).not.toHaveBeenCalled();
    for (const [status, expected] of [[401, 'auth'], [403, 'forbidden']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status }));
      await expect(loadProjectObservability(context, 'project_member', 'user-token', request)).resolves.toEqual({ status: expected });
      expect(request).toHaveBeenCalledOnce();
      expect(String(request.mock.calls[0]?.[0])).toContain('/management-token');
      expect(request.mock.calls.some(([url]) => String(url).includes('/api/project-radar/'))).toBe(false);
    }
  });

  it('rejects wrong audience or over-five-minute observability tokens before Radar', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const now = Math.floor(Date.now() / 1000);
    for (const token of [projectJwt('project_foreign', now + 300), projectJwt('project_member', now + 361)]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
      await expect(loadProjectObservability(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request)).resolves.toEqual({ status: 'invalid' });
      expect(request).toHaveBeenCalledOnce();
      expect(request.mock.calls.some(([url]) => String(url).includes('/api/project-radar/'))).toBe(false);
    }
    const wrongProject = vi.fn<typeof fetch>();
    await expect(loadProjectObservability(normalizeSaasContext(memberFixture), 'project_foreign', 'user-token', wrongProject)).resolves.toEqual({ status: 'forbidden' });
    expect(wrongProject).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('accepts bounded management-token clock skew while enforcing expiry, TTL, and exact audience', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const now = Math.floor(Date.now() / 1000);
    const context = normalizeSaasContext(memberFixture);
    const project = context.console.projects.find((item) => item.id === 'project_member')!;
    const exchange = (accessToken: string, expiresIn = 300) => exchangeProjectManagementToken(
      project,
      'user-token',
      vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: expiresIn })),
    );

    for (const skew of [-60, 60]) {
      await expect(exchange(projectJwt('project_member', now + skew + 300, now + skew))).resolves.toMatchObject({ status: 'ready' });
    }
    for (const skew of [-61, 61]) {
      await expect(exchange(projectJwt('project_member', now + skew + 300, now + skew))).resolves.toEqual({ status: 'invalid' });
    }
    await expect(exchange(projectJwt('project_member', now, now - 300))).resolves.toEqual({ status: 'invalid' });
    await expect(exchange(projectJwt('project_member', now + 360, now))).resolves.toEqual({ status: 'invalid' });
    await expect(exchange(projectJwt('project_member', now + 299, now), 300)).resolves.toEqual({ status: 'invalid' });
    await expect(exchange(projectJwt('project_member', now + 300), 0)).resolves.toEqual({ status: 'invalid' });
    await expect(exchange(projectJwt('project_member', now + 300), 301)).resolves.toEqual({ status: 'invalid' });
    await expect(exchange(projectJwt('project_foreign', now + 300))).resolves.toEqual({ status: 'invalid' });
    vi.useRealTimers();
  });

  it('surfaces Radar 401 and 403 without a platform or cookie-token fallback', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const [status, expected] of [[401, 'auth'], [403, 'forbidden']] as const) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(new Response('{}', { status }));
      await expect(loadProjectObservability(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request)).resolves.toEqual({ status: expected });
      expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    }
    vi.useRealTimers();
  });

  it('loads bounded cursor logs, filters by trace/request and redacts secrets again', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ project_id: 'radar-member_1', logs: [{ id: 'l1', timestamp: '2026-08-02T11:00:00Z', level: 'ERROR', body: 'authorization: Bearer exposed', service_name: 'api', trace_id: 'trace-1', request_id: 'request-1', attributes: { 'http.status_code': 500, token: 'must-drop' } }], next_cursor: 'cursor-1' }));
    const result = await loadProjectLogs(normalizeSaasContext(memberFixture), 'project_member', { level: 'error', traceId: 'trace-1', requestId: 'request-1', limit: 50 }, 'user-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { logs: [{ body: '[REDACTED]', traceId: 'trace-1', requestId: 'request-1' }], nextCursor: 'cursor-1' } });
    expect(String(request.mock.calls[1]?.[0])).toContain('level=error'); expect(String(request.mock.calls[1]?.[0])).toContain('trace_id=trace-1'); expect(String(request.mock.calls[1]?.[0])).toContain('request_id=request-1');
    expect(JSON.stringify(result)).not.toContain('Bearer exposed'); expect(JSON.stringify(result)).not.toContain('must-drop'); expect(JSON.stringify(result)).not.toContain(token);
    const excessive = vi.fn<typeof fetch>(); await expect(loadProjectLogs(normalizeSaasContext(memberFixture), 'project_member', { limit: 101 }, 'user-token', excessive)).resolves.toEqual({ status: 'invalid' }); expect(excessive).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('exports only member-project loaded logs with applied filters, typed attributes and redaction', () => {
    const context = normalizeSaasContext(memberFixture);
    const page = { logs: [{ id: 'log-1', timestamp: '2026-10-03T12:00:00Z', level: 'ERROR', serviceName: 'api', traceId: 'trace-1', requestId: 'authorization: Bearer private', body: 'password=private', attributes: { 'http.status_code': 500, 'rpc.service': false, 'http.route': '/中文', 'rpc.method': 'token=private', 'deployment.environment': Number.NaN, private_field: 'never-export' }, collector: 'never-export' }], nextCursor: 'opaque-private-cursor' };
    const filters = { from: '2026-10-02T12:00:00Z', to: '2026-10-03T12:00:00Z', level: 'error' as const, search: '中文', traceId: 'trace-1', requestId: 'token=private', cursor: 'opaque-private-cursor' };
    const text = serializeProjectLogs(context, 'project_member', filters, page, 'json');
    expect(JSON.parse(text)).toEqual({ project_id: 'project_member', filters: { from: filters.from, to: filters.to, level: 'error', search: '中文', trace_id: 'trace-1', request_id: '[REDACTED]' }, loaded_count: 1, has_more: true, logs: [{ id: 'log-1', timestamp: page.logs[0].timestamp, level: 'ERROR', service_name: 'api', trace_id: 'trace-1', span_id: '', request_id: '[REDACTED]', body: '[REDACTED]', attributes: { 'http.status_code': 500, 'http.route': '/中文', 'rpc.method': '[REDACTED]', 'rpc.service': false } }] });
    expect(text).not.toMatch(/opaque-private-cursor|never-export|password=|token=|Bearer private|collector|private_field/);
    expect(JSON.parse(serializeProjectLogs(context, 'project_member', filters, { logs: page.logs }, 'json')).has_more).toBe(false);
  });

  it('exports UTF-8 CSV with loaded snapshot metadata, quoted multiline text and formula escaping', () => {
    const page = { logs: [{ id: 'log-1', timestamp: '2026-10-03T12:00:00Z', level: 'INFO', serviceName: 'api', body: '=SUM(1,2)\n"中文"', attributes: { 'http.status_code': 200 } }] };
    const csv = serializeProjectLogs(normalizeSaasContext(memberFixture), 'project_member', { search: '+中文' }, page, 'csv');
    expect(csv.startsWith('\uFEFF"project_id","range_from","range_to"')).toBe(true);
    expect(csv).toContain('"filter_search"'); expect(csv).toContain('"loaded_count","has_more"');
    expect(csv).toContain('"project_member"'); expect(csv).toContain("\"'+中文\"");
    expect(csv).toContain("\"'=SUM(1,2)\n\"\"中文\"\"\"");
    expect(csv).toContain('"1","false"'); expect(csv).toContain('"{""http.status_code"":200}"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('rejects nonmember, invalid Radar scope, duplicate and excessive log exports', () => {
    const context = normalizeSaasContext(memberFixture);
    const entry = { id: 'log-1', timestamp: '2026-10-03T12:00:00Z', level: 'INFO', serviceName: 'api', body: 'safe', attributes: {} };
    expect(() => serializeProjectLogs(context, 'project_foreign', {}, { logs: [entry] }, 'json')).toThrow('invalid_log_export');
    const invalid = normalizeSaasContext(memberFixture); invalid.console.projects.find(project => project.id === 'project_member')!.radarProjectId = 'https://foreign.example';
    expect(() => serializeProjectLogs(invalid, 'project_member', {}, { logs: [entry] }, 'json')).toThrow('invalid_log_export');
    expect(() => serializeProjectLogs(context, 'project_member', {}, { logs: [entry, entry] }, 'csv')).toThrow('invalid_log_export');
    const logs = Array.from({ length: 201 }, (_, i) => ({ ...entry, id: String(i) }));
    expect(() => serializeProjectLogs(context, 'project_member', {}, { logs }, 'json')).toThrow('invalid_log_export');
    expect(JSON.parse(serializeProjectLogs(context, 'project_member', {}, { logs: logs.slice(0, 200) }, 'json')).loaded_count).toBe(200);
  });

  it('rejects invalid log intervals before authorization and preserves an exact seven-day offset interval', async () => {
    const context = normalizeSaasContext(memberFixture);
    for (const filters of [
      { from: 'not-a-time' }, { from: '2026-02-30T00:00:00Z' }, { from: '2026-10-03' },
      { from: '2026-10-03T00:00:00Z', to: '2026-10-02T00:00:00Z' },
      { from: '2026-09-25T00:00:00Z', to: '2026-10-03T00:00:00Z' },
      { level: 'unknown' as 'info' },
    ]) {
      const request = vi.fn<typeof fetch>();
      await expect(loadProjectLogs(context, 'project_member', filters, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
      expect(request).not.toHaveBeenCalled();
    }
    const filters = { from: '2026-09-26T08:00:00+08:00', to: '2026-10-03T08:00:00+08:00', cursor: 'opaque+cursor/value', limit: 50 };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ project_id: 'radar-member_1', logs: [], next_cursor: null }));
    await expect(loadProjectLogs(context, 'project_member', filters, 'user-token', request)).resolves.toMatchObject({ status: 'ready' });
    const url = new URL(String(request.mock.calls[1][0]), 'https://fixture.example');
    expect(url.searchParams.get('from')).toBe(filters.from);
    expect(url.searchParams.get('to')).toBe(filters.to);
    expect(url.searchParams.get('cursor')).toBe(filters.cursor);
  });

  it('rejects duplicate log IDs and oversized response cursors', async () => {
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const row = { id: 'l1', timestamp: '2026-10-03T00:00:00Z', level: 'INFO', body: 'Safe message', service_name: 'api', attributes: {} };
    for (const reply of [{ logs: [row, row], next_cursor: null }, { logs: [row], next_cursor: 'x'.repeat(1025) }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ project_id: 'radar-member_1', ...reply }));
      await expect(loadProjectLogs(normalizeSaasContext(memberFixture), 'project_member', {}, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('uses the W-Monitor exact-project user-token route with no machine-key fallback', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schema_version: 'w.monitor.project-health.v1', workspace_id: 'ws_member', project_id: 'project_member', summary: { nodes: 1, healthy: 1, degraded: 0, offline: 0 }, nodes: [{ agent_id: 'a1', hostname: 'node-1', status: 'healthy', latest_check_at: '2026-08-02T11:59:00Z', latency_ms: 12, services: [{ name: 'api', status: 'active' }] }] }));
    await expect(loadProjectMonitorHealth(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request)).resolves.toMatchObject({
      status: 'ready',
      data: {
        summary: { nodes: 1 },
        nodes: [{ hostname: 'node-1', stale: false }],
        incidents: [],
        freshness: { status: 'fresh', staleNodeCount: 0, windowSeconds: 300, asOf: '2026-08-02T11:59:00Z' },
      },
    });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-monitor/api/v1/workspaces/ws_member/projects/project_member/health'); expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${token}`); expect(JSON.stringify(request.mock.calls)).not.toMatch(/monitor[_-]?(?:api[_-]?)?key|radar_api_key/i);
    const foreign = vi.fn<typeof fetch>(); await expect(loadProjectMonitorHealth(normalizeSaasContext(memberFixture), 'project_foreign', 'user-token', foreign)).resolves.toEqual({ status: 'forbidden' }); expect(foreign).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('projects W-Monitor incidents and stale freshness without machine keys', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({
        schema_version: 'w.monitor.project-health.v1',
        workspace_id: 'ws_member',
        project_id: 'project_member',
        summary: { nodes: 2, healthy: 0, degraded: 1, offline: 1 },
        nodes: [
          {
            agent_id: 'a1',
            hostname: 'node-stale',
            status: 'offline',
            latest_check_at: '2026-08-02T11:00:00Z',
            services: [{ name: 'api', status: 'inactive' }],
            latest_error: { state: 'firing', severity: 'critical', summary: 'cpu high authorization: Bearer secret', metric: 'cpu', checked_at: 1_754_136_000 },
          },
          {
            agent_id: 'a2',
            hostname: 'node-fresh',
            status: 'healthy',
            latest_check_at: '2026-08-02T11:59:30Z',
            services: [{ name: 'web', status: 'active' }],
          },
        ],
      }));
    const result = await loadProjectMonitorHealth(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request);
    expect(result).toMatchObject({
      status: 'ready',
      data: {
        incidents: [{ agentId: 'a1', hostname: 'node-stale', severity: 'critical', summary: '[REDACTED]', metric: 'cpu' }],
        freshness: { status: 'stale', staleNodeCount: 1, asOf: '2026-08-02T11:59:30Z' },
        nodes: [{ hostname: 'node-stale', stale: true }, { hostname: 'node-fresh', stale: false }],
      },
    });
    expect(JSON.stringify(result)).not.toContain('Bearer secret');
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/monitor[_-]?(?:api[_-]?)?key|W_RADAR_API_KEY|radar_api_key/i);
    vi.useRealTimers();
  });

  it('renders bilingual accessible observability controls without durable tokens', () => {
    expect(observabilityComponentSource).toContain("title: '可观测性'");
    expect(observabilityComponentSource).toContain('aria-labelledby="logs-heading"');
    expect(observabilityComponentSource).toContain('aria-labelledby="monitor-heading"');
    expect(observabilityComponentSource).toContain('aria-labelledby="radar-heading"');
    expect(observabilityComponentSource).toContain('id="releases-heading"');
    expect(observabilityComponentSource).toContain('id="errors-heading"');
    expect(observabilityComponentSource).toContain('id="latency-heading"');
    expect(observabilityComponentSource).toContain('id="monitor-incidents-heading"');
    expect(observabilityComponentSource).toContain('id="monitor-freshness-heading"');
    expect(observabilityComponentSource).toContain('t.openRadar');
    expect(observabilityComponentSource).toContain('t.openMonitor');
    expect(observabilityComponentSource).toContain('t.forbidden');
    expect(observabilityComponentSource).toContain('t.freshnessStale');
    expect(observabilityComponentSource).toContain('maxLength={128}');
    expect(observabilityComponentSource).toContain('rel="noopener noreferrer"');
    expect(observabilityComponentSource).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)|W_RADAR_API_KEY|MONITOR_API_KEY/);
  });
  it('keeps only projects joined through the current subject membership', () => {
    const context = normalizeSaasContext(memberFixture);
    expect(context.console.projects.map((project) => project.id)).toEqual(['project_member']);
    expect(JSON.stringify(context)).not.toMatch(/foreign|postgres|service.role|must-not-render/i);
  });

  it('exposes the member project workspace-project Radar surface', () => {
    const [project] = normalizeSaasContext(memberFixture).console.projects;
    expect(project && radarProjectUrl(project)).toBe('https://radar.myfastools.com/dashboard/projects/radar-member_1');
    expect(radarProjectUrl.toString()).not.toContain('/dashboard/platform/projects/');
    expect(radarProjectUrl.toString()).not.toContain('/api/platform/');
  });

  it('omits Radar when the member project has no radarProjectId', () => {
    const context = normalizeSaasContext({
      ...memberFixture,
      console: { projects: [{ id: 'project_member', workspaceId: 'ws_member', name: 'Member project', workspaceRole: 'owner' }] },
    });
    expect(radarProjectUrl(context.console.projects[0]!)).toBeUndefined();
  });

  it('drops URL, slash, and control-character Radar identifiers', () => {
    for (const value of ['https://evil.example/x', 'workspace/project', '../platform', 'project\nother', 'project\u0000other']) {
      expect(safeRadarProjectId(value)).toBeUndefined();
    }
  });

  it('drops a cross-workspace project together with its Radar identifier', () => {
    const context = normalizeSaasContext(memberFixture);
    expect(context.console.projects.some((project) => project.radarProjectId === 'radar-foreign')).toBe(false);
  });

  it('does not turn a platform administrator into a customer project member', () => {
    const context = normalizeSaasContext({
      ...memberFixture,
      authorityPlanes: { ...memberFixture.authorityPlanes, platformRole: 'super_admin', workspaceMemberships: [] },
    });
    expect(context.authorityPlanes.platformRole).toBe('super_admin');
    expect(context.console.projects).toEqual([]);
  });

  it('makes a missing token explicit without issuing a request', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(loadSaasContext(async () => null, request)).resolves.toEqual({ status: 'auth' });
    expect(request).not.toHaveBeenCalled();
  });

  it('distinguishes unauthorized and failed context requests', async () => {
    const unauthorized = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 }));
    const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(loadSaasContext(async () => 'token', unauthorized)).resolves.toEqual({ status: 'auth' });
    await expect(loadSaasContext(async () => 'token', failed)).resolves.toEqual({ status: 'error' });
  });
});

describe('separated console list views', () => {
  const workspaces = [
    { id: 'ws_alpha', name: 'Alpha team', role: 'owner', tier: 'pro' },
    { id: 'ws_beta', name: 'Beta team', role: 'developer', tier: 'free' },
  ];
  const projects = Array.from({ length: 25 }, (_, index) => ({
    id: `project_${String(index).padStart(2, '0')}`,
    workspaceId: index % 2 ? 'ws_alpha' : 'ws_beta',
    name: index === 7 ? 'Needle service' : `Project ${index}`,
    workspaceRole: index % 2 ? 'owner' : 'developer',
  }));

  it('filters member projects by workspace and keyword and caps every page at 12', () => {
    const first = listMemberProjects(projects, workspaces, '', '', 1);
    const third = listMemberProjects(projects, workspaces, '', '', 3);
    expect(first.items).toHaveLength(12);
    expect(first.total).toBe(25);
    expect(first.pageCount).toBe(3);
    expect(third.items).toHaveLength(1);

    const workspace = listMemberProjects(projects, workspaces, 'ws_alpha', '', 1);
    expect(workspace.items.every((project) => project.workspaceId === 'ws_alpha')).toBe(true);
    const search = listMemberProjects(projects, workspaces, '', 'needle', 1);
    expect(search.items.map((project) => project.id)).toEqual(['project_07']);
    expect(search.items[0]?.workspaceName).toBe('Alpha team');
  });

  it('searches app relationships and ranks them by login count before pagination', () => {
    const apps = Array.from({ length: 15 }, (_, index) => ({
      clientId: `client_${index}`,
      name: index === 9 ? 'Needle app' : `App ${index}`,
      loginCount: index,
      lastSeenAt: index,
      status: 'active',
    }));
    const first = listUsedApps(apps, '', 1);
    expect(first.items).toHaveLength(12);
    expect(first.items[0]?.loginCount).toBe(14);
    expect(first.items[11]?.loginCount).toBe(3);
    expect(listUsedApps(apps, 'needle', 1).items.map((app) => app.clientId)).toEqual(['client_9']);
  });

  it('renders four mutually selected views without unverified project service shortcuts', () => {
    expect(componentSource).toContain("type ConsoleView = 'overview' | 'projects' | 'apps' | 'platform'");
    expect(componentSource).toContain("view === 'overview'");
    expect(componentSource).toContain("view === 'projects'");
    expect(componentSource).toContain("view === 'apps'");
    expect(componentSource).toContain("view === 'platform' && isPlatformAdmin");
    expect(componentSource).not.toContain('href="https://db.myfastools.com/"');
    expect(componentSource).not.toContain('href="https://opendrop.myfastools.com/"');
    expect(componentSource).toContain('selectedProject &&');
    expect(componentSource).toContain("setSelectedProjectId('')");
  });
});

describe('authenticated Project Connect contract', () => {
  it('starts fail closed before authenticated Project Connect loads', () => {
    expect(undiscoveredProjectCapabilities()).toEqual([
      { name: 'Auth', available: false },
      { name: 'Database', available: false },
      { name: 'Storage', available: false },
      { name: 'Functions', available: false },
    ]);
  });

  it('loads only the member-scoped browser-safe W-ID projection without a pasted key', async () => {
    const context = normalizeSaasContext(memberFixture);
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      data: {
        workspace_id: 'ws_member',
        project_id: 'project_member',
        project_url: 'https://db.myfastools.com/project/project_member',
        issuer: 'https://auth.myfastools.com/',
        data_url: 'https://db.myfastools.com/project/project_member/rest/v1',
        storage_url: 'https://opendrop.myfastools.com/api/v1/projects/project_member/storage/v1',
        functions_url: 'https://db.myfastools.com/project/project_member/functions/v1',
        capabilities: {
          auth: true,
          data: true,
          storage: { available: true },
          functions: { available: false },
        },
        publishable_keys: [{ id: 'pkey_1', name: 'web', kind: 'publishable', key_prefix: 'wid_pk_abcd', publishable_key: 'wid_pk_usable_browser_value', requires_rotation: false, scopes: ['auth:use'], revoked_at: null, expires_at: 200, overlap_expires_at: 150 }],
        server_keys: [{ key_prefix: 'wid_sk_forbidden' }],
        database_url: 'postgres://must-not-render',
      },
    }));

    const result = await loadProjectConnect(context, 'project_member', 'user-token', request);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/connect');
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).has('apikey')).toBe(false);
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer user-token');
    expect(result.status).toBe('ready');
    expect(JSON.stringify(result)).not.toMatch(/wid_sk|postgres|must-not-render/i);
    if (result.status === 'ready') {
      expect(result.projectUrl).toBe('https://db.myfastools.com/project/project_member');
      expect(result.publishableKeys).toEqual([{ id: 'pkey_1', name: 'web', keyPrefix: 'wid_pk_abcd', publishableKey: 'wid_pk_usable_browser_value', requiresRotation: false, scopes: ['auth:use'], allowedOrigins: [], revokedAt: null, expiresAt: 200, overlapExpiresAt: 150 }]);
      expect(result.capabilities.map(({ name, available }) => ({ name, available }))).toEqual([
        { name: 'Auth', available: true },
        { name: 'Database', available: true },
        { name: 'Storage', available: true },
        { name: 'Functions', available: false },
      ]);
    }
  });

  it('never calls W-ID for a project outside current membership', async () => {
    const request = vi.fn<typeof fetch>();
    const result = await loadProjectConnect(
      normalizeSaasContext(memberFixture), 'project_foreign', 'user-token', request,
    );
    expect(result).toEqual({ status: 'error', reason: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
  });

  it('makes auth, authorization, and network failures explicit without response-body leakage', async () => {
    const context = normalizeSaasContext(memberFixture);
    const call = (request: typeof fetch) => loadProjectConnect(
      context, 'project_member', 'user-token', request,
    );
    await expect(call(vi.fn<typeof fetch>().mockResolvedValue(new Response('secret', { status: 401 })))).resolves.toEqual({ status: 'error', reason: 'auth' });
    await expect(call(vi.fn<typeof fetch>().mockResolvedValue(new Response('secret', { status: 403 })))).resolves.toEqual({ status: 'error', reason: 'forbidden' });
    await expect(call(vi.fn<typeof fetch>().mockRejectedValue(new Error('secret network detail')))).resolves.toEqual({ status: 'error', reason: 'network' });
  });

  it('removes the manual publishable-key field and browser persistence', () => {
    expect(componentSource).not.toContain('type="password"');
    expect(componentSource).toContain('loadProjectConnect');
    expect(componentSource).toContain('reconnectableKey?.publishableKey');
    expect(componentSource).toContain('key.allowedOrigins.includes(window.location.origin)');
    expect(componentSource).toContain('W_PROJECT_URL=');
    expect(componentSource).toContain('W_PUBLISHABLE_KEY=');
    expect(componentSource).not.toMatch(/localStorage|sessionStorage|URLSearchParams|trackEvent|console\.(?:log|error)\s*\(/);
  });

  it('keeps legacy hash-only keys visible for rotation but never invents usable key material', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: {
      workspace_id: 'ws_member', project_id: 'project_member', project_url: 'https://db.myfastools.com/project/project_member',
      issuer: 'https://auth.myfastools.com/', data_url: 'https://db.myfastools.com/rest/v1', storage_url: 'https://storage.myfastools.com/storage/v1', functions_url: 'https://db.myfastools.com/functions/v1',
      capabilities: { auth: true, data: true, storage: true, functions: true },
      publishable_keys: [{ id: 'legacy', name: 'legacy', kind: 'publishable', key_prefix: 'wid_pk_legacy', publishable_key: null, requires_rotation: true, scopes: ['auth:use'] }],
    } }));
    const result = await loadProjectConnect(normalizeSaasContext(memberFixture), 'project_member', 'user-token', request);
    expect(result).toMatchObject({ status: 'ready', publishableKeys: [{ id: 'legacy', requiresRotation: true }] });
    if (result.status === 'ready') expect(result.publishableKeys?.[0]?.publishableKey).toBeUndefined();
  });

  it('issues a publishable key once, scoped to the current browser origin', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      key: 'wid_pk_once_123',
      data: { id: 'pkey_new', name: 'web', kind: 'publishable', key_prefix: 'wid_pk_once', scopes: ['auth:use'], allowed_origins: ['https://myfastools.com'], revoked_at: null },
    }));
    const result = await issueProjectPublishableKey(normalizeSaasContext(memberFixture), 'project_member', 'user-token', 'https://myfastools.com', request);
    expect(result).toMatchObject({ status: 'ready', oneTimeKey: 'wid_pk_once_123' });
    const init = request.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({ kind: 'publishable', allowed_origins: ['https://myfastools.com'] });
    expect(JSON.stringify(result)).not.toContain('wid_sk_');
  });

  it('rotates and revokes only safe exact key identifiers', async () => {
    const context = normalizeSaasContext(memberFixture);
    const rotateRequest = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      success: true,
      key: 'wid_pk_rotated_123',
      data: { id: 'pkey_rotated', name: 'web', kind: 'publishable', key_prefix: 'wid_pk_rotated', scopes: [], allowed_origins: [], revoked_at: null },
    }));
    await expect(rotateProjectPublishableKey(context, 'project_member', 'pkey_1', 'user-token', rotateRequest)).resolves.toMatchObject({ status: 'ready', oneTimeKey: 'wid_pk_rotated_123' });
    expect(String(rotateRequest.mock.calls[0]?.[0])).toMatch(/\/pkey_1\/rotate$/);
    const revokeRequest = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    await expect(revokeProjectPublishableKey(context, 'project_member', 'pkey_1', 'user-token', revokeRequest)).resolves.toEqual({ status: 'ready' });
    const rejected = vi.fn<typeof fetch>();
    await expect(revokeProjectPublishableKey(context, 'project_member', '../secret', 'user-token', rejected)).resolves.toEqual({ status: 'error', reason: 'forbidden' });
    expect(rejected).not.toHaveBeenCalled();
  });

  it('issues a separate short-lived in-memory console credential', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      key: 'wid_pk_console_once',
      data: { id: 'pkey_console', name: 'console', kind: 'publishable', key_prefix: 'wid_pk_console', scopes: ['auth:use', 'data:read', 'storage:read'], allowed_origins: ['https://myfastools.com'], revoked_at: null },
    }));
    const result = await issueProjectConsoleReadKey(normalizeSaasContext(memberFixture), 'project_member', 'user-token', 'https://myfastools.com', request);
    expect(result).toMatchObject({ status: 'ready', oneTimeKey: 'wid_pk_console_once' });
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body.scopes).toEqual(['auth:use', 'data:read', 'data:write', 'storage:read', 'storage:write', 'functions:invoke']);
    expect(body.expires_at).toBe(Math.floor(Date.now() / 1000) + 900);
    vi.useRealTimers();
  });

  it('mutates rows with a new exact-project token and handles stale or absent edge methods honestly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({
        schema_version: 'w-db.row-mutation/v1', mutation_id: '4f6dfc11-33ce-4c35-940c-b2e655420d61',
        operation: 'update', affected_rows: 1, row: { id: 'row-1', title: 'new', done: true },
      }));
    const result = await mutateProjectTableRow(
      normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token',
      { operation: 'update', id: 'row-1', expected: { title: 'old', done: false }, values: { title: 'new', done: true } }, request,
    );
    expect(result).toMatchObject({ status: 'ready', data: { operation: 'update', row: { title: 'new' } } });
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH', credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('apikey')).toBe('wid_pk_once_123');
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ id: 'row-1', expected: { title: 'old', done: false }, values: { title: 'new', done: true } });
    expect(JSON.stringify(result)).not.toContain(managementToken);

    for (const [response, status] of [
      [new Response('{}', { status: 412 }), 'stale'],
      [new Response('{}', { status: 405 }), 'unsupported'],
    ] as const) {
      const edge = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(response);
      await expect(mutateProjectTableRow(
        normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token',
        { operation: 'delete', id: 'row-1', expected: { title: 'new' } }, edge,
      )).resolves.toEqual({ status });
    }
    vi.useRealTimers();
  });

  it('preserves typed JSON row values and rejects arrays, empty objects, oversized expectations, and unsafe paths', async () => {
    expect(parseProjectRowValues('{"title":"one","done":false,"count":2,"meta":{"x":null}}')).toEqual({ title: 'one', done: false, count: 2, meta: { x: null } });
    expect(parseProjectRowValues('[]')).toBeNull();
    expect(parseProjectRowValues('{}')).toBeNull();
    expect(parseProjectRowValues('{broken')).toBeNull();
    const request = vi.fn<typeof fetch>();
    await expect(mutateProjectTableRow(
      normalizeSaasContext(memberFixture), 'project_member', '../public', 'todos', 'wid_pk_once_123', 'user-token',
      { operation: 'insert', values: { title: 'x' } }, request,
    )).resolves.toEqual({ status: 'forbidden' });
    await expect(mutateProjectTableRow(
      normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token',
      { operation: 'delete', id: 'row-1', expected: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`field_${index}`, index])) }, request,
    )).resolves.toEqual({ status: 'invalid' });
    expect(request).not.toHaveBeenCalled();
  });

  it('maps explicit insert and delete actions to bounded W-DB methods', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const cases = [
      { mutation: { operation: 'insert' as const, values: { title: 'typed', done: false } }, method: 'POST' },
      { mutation: { operation: 'delete' as const, id: 'row-1', expected: { title: 'typed', done: false } }, method: 'DELETE' },
    ];
    for (const { mutation, method } of cases) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({
          schema_version: 'w-db.row-mutation/v1', mutation_id: '4f6dfc11-33ce-4c35-940c-b2e655420d61',
          operation: mutation.operation, affected_rows: 1, row: { id: 'row-1', title: 'typed', done: false },
        }));
      await expect(mutateProjectTableRow(
        normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', mutation, request,
      )).resolves.toMatchObject({ status: 'ready', data: { operation: mutation.operation } });
      expect(request.mock.calls[1]?.[1]?.method).toBe(method);
      expect(request).toHaveBeenCalledTimes(2);
    }
    vi.useRealTimers();
  });

  it('loads only allowlisted Auth, Database, and Storage console projections', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        data: [{ userId: 'usr_1', email: 'member@example.com', displayName: 'Member', status: 'active', appRole: 'admin', effectiveTier: 'pro', loginCount: 4, lastSeenAt: 10 }],
        counts: { total: 1, active: 1, blocked: 0 },
      }))
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schemas: [{ name: 'public', tables: [{ name: 'todos', rls_enabled: true, rls_forced: true, columns: [{ name: 'id', ordinal: 1, data_type: 'uuid', nullable: false, default: null, identity: false, generated: false }], policies: [{ name: 'own_rows' }] }] }] }))
      .mockResolvedValueOnce(Response.json({ initialized: true, count: 2, last_applied_at: '2026-08-02T00:00:00Z', migrations: [] }))
      .mockResolvedValueOnce(Response.json([{ id: 'private', name: 'Private files', public: false, file_size_limit: 1024, allowed_mime_types: ['image/png'] }]));
    const result = await loadProjectConsoleData(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_once_123', 'user-token', request);
    expect(result).toMatchObject({
      auth: { status: 'ready', data: { total: 1, users: [{ userId: 'usr_1', appRole: 'admin' }] } },
      database: { status: 'ready', data: { tables: [{ schema: 'public', name: 'todos', rlsEnabled: true, columnCount: 1, policyCount: 1 }], migrations: { count: 2 } } },
      storage: { status: 'ready', data: { buckets: [{ id: 'private', public: false }] } },
    });
    expect(JSON.stringify(result)).not.toMatch(/provider_token|database_url|provider_key|credential_ref|\bsql\b/i);
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls[1]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe('Bearer user-token');
    for (const call of request.mock.calls.slice(2)) {
      expect(new Headers(call[1]?.headers).get('apikey')).toBe('wid_pk_once_123');
      expect(new Headers(call[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    }
    expect(JSON.stringify(result)).not.toContain(managementToken);
    vi.useRealTimers();
  });

  it('rejects wrong-audience or invalid-expiry exchanges without calling data services', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const now = Math.floor(Date.now() / 1000);
    for (const token of [projectJwt('project_foreign', now + 300), projectJwt('project_member', now + 361)]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ data: [], counts: { total: 0, active: 0, blocked: 0 } }))
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }));
      await expect(loadProjectConsoleData(
        normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_once_123', 'user-token', request,
      )).resolves.toEqual({
        auth: { status: 'ready', data: { users: [], total: 0, active: 0, blocked: 0 } },
        database: { status: 'invalid' },
        storage: { status: 'invalid' },
      });
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls.some(([url]) => String(url).includes('/api/project-data/'))).toBe(false);
      expect(request.mock.calls.some(([url]) => String(url).includes('/api/project-storage/'))).toBe(false);
    }
    vi.useRealTimers();
  });

  it('fails closed when token exchange is denied and still uses the current token only for Auth', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [], counts: { total: 0, active: 0, blocked: 0 } }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }));
    const result = await loadProjectConsoleData(
      normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_once_123', 'user-token', request,
    );
    expect(result.database).toEqual({ status: 'forbidden' });
    expect(result.storage).toEqual({ status: 'forbidden' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer user-token');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe('Bearer user-token');
  });

  it('loads Auth but keeps data services locked when no one-time key is in memory', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], counts: { total: 0, active: 0, blocked: 0 } }));
    const result = await loadProjectConsoleData(normalizeSaasContext(memberFixture), 'project_member', '', 'user-token', request);
    expect(result).toEqual({
      auth: { status: 'ready', data: { users: [], total: 0, active: 0, blocked: 0 } },
      database: { status: 'locked' },
      storage: { status: 'locked' },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('browses an RLS-protected table with a fresh exact-project token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: false, next_offset: null, rows: [{ id: 1, owner_id: 'usr_1', title: 'safe' }] }));
    const result = await loadProjectTableRows(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', request);
    expect(result).toEqual({ status: 'ready', data: { schema: 'public', table: 'todos', rows: [{ id: 1, owner_id: 'usr_1', title: 'safe' }], hasMore: false, nextOffset: null } });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows?limit=25&offset=0');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('apikey')).toBe('wid_pk_once_123');
    expect(JSON.stringify(result)).not.toContain(managementToken);
    vi.useRealTimers();
  });

  it('browses quoted Unicode table names with fully encoded path segments and rejects path traversal', async () => {
    const table = `中文表 "quoted" '!*()`;
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema: 'public', table, limit: 25, offset: 0, has_more: false, next_offset: null, rows: [] }));
    expect(await loadProjectTableRows(normalizeSaasContext(memberFixture), 'project_member', 'public', table, 'wid_pk_once_123', 'user-token', request)).toMatchObject({ status: 'ready', data: { table, rows: [] } });
    const url = String(request.mock.calls[1]?.[0]);
    expect(url).toContain('%E4%B8%AD%E6%96%87');
    expect(url).toContain('%22quoted%22%20%27%21%2A%28%29');
    expect(url).not.toMatch(/[!'()*]/);
    request.mockClear();
    for (const name of ['..', '.', '../other', 'bad\\path', '\0bad', '中'.repeat(22)]) expect(await loadProjectTableRows(normalizeSaasContext(memberFixture), 'project_member', 'public', name, 'wid_pk_once_123', 'user-token', request)).toEqual({ status: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
  });

  it('loads an advancing table page with fresh exact-project authorization', async () => {
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema: 'public', table: 'todos', limit: 25, offset: 25, has_more: true, next_offset: 50, rows: [{ id: 26, title: 'page two' }], future_field: true }));
    const result = await loadProjectTableRows(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', request, signal, 25);
    expect(result).toMatchObject({ status: 'ready', data: { rows: [{ id: 26, title: 'page two' }], hasMore: true, nextOffset: 50 } });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows?limit=25&offset=25');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(request.mock.calls[1]?.[1]?.signal).toBe(signal);
    expect(JSON.stringify(result)).not.toContain(managementToken);
  });

  it('loads bounded generated database types with a fresh exact-project management token', async () => {
    const context = normalizeSaasContext(memberFixture);
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const signal = new AbortController().signal;
    const content = 'export type Database = { public: { Tables: { todos: { Row: { id: string; title: string } } } } };\n// 中文';
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.database-types/v1', project_id: 'project_member', language: 'typescript', filename: 'database.types.ts', content, future_field: true }));
    const result = await loadProjectDatabaseTypes(context, 'project_member', 'wid_pk_once_123', 'user-token', request, signal);
    expect(result).toEqual({ status: 'ready', data: { filename: 'database.types.ts', content } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[1]?.signal).toBe(signal);
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/types');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', signal });
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('apikey')).toBe('wid_pk_once_123');
    expect(JSON.stringify(result)).not.toContain(managementToken);
  });

  it('rejects mismatched or oversized generated type contracts before exposing content', async () => {
    const context = normalizeSaasContext(memberFixture);
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const valid = { schema_version: 'w-db.database-types/v1', project_id: 'project_member', language: 'typescript', filename: 'database.types.ts', content: 'export type Database = {};\n' };
    for (const change of [
      { schema_version: 'w-db.database-types/v2' },
      { project_id: 'project_other' },
      { language: 'javascript' },
      { filename: '../database.types.ts' },
      { content: '' },
      { content: '中'.repeat(175_000) },
    ]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ ...valid, ...change }));
      expect(await loadProjectDatabaseTypes(context, 'project_member', 'wid_pk_once_123', 'user-token', request)).toEqual({ status: 'invalid' });
    }
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ ...valid, content: 'a'.repeat(512 * 1024) }));
    const atLimit = await loadProjectDatabaseTypes(context, 'project_member', 'wid_pk_once_123', 'user-token', request);
    expect(atLimit.status).toBe('ready');
  });

  it('rejects non-member and missing-auth type requests without making network calls', async () => {
    const request = vi.fn<typeof fetch>();
    const context = normalizeSaasContext(memberFixture);
    expect(await loadProjectDatabaseTypes(context, 'foreign', 'wid_pk_once_123', 'user-token', request)).toEqual({ status: 'forbidden' });
    expect(await loadProjectDatabaseTypes(context, 'project_member', 'wid_pk_once_123', null, request)).toEqual({ status: 'auth' });
    expect(await loadProjectDatabaseTypes(context, 'project_member', 'wid_sk_wrong', 'user-token', request)).toEqual({ status: 'locked' });
    expect(request).not.toHaveBeenCalled();
  });

  it('opts into exact visible row totals and validates the total against its page', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const load = async (offset: number, payload: Record<string, unknown>) => {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json(payload));
      const result = await loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', request, undefined, offset, true);
      return { result, request };
    };
    const first = await load(0, { schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: true, next_offset: 25, rows: Array.from({ length: 25 }, (_, id) => ({ id: id + 1 })), total_rows: 28, future_field: true });
    expect(first.result).toMatchObject({ status: 'ready', data: { totalRows: 28, hasMore: true } });
    if (first.result.status !== 'ready') throw new Error('counted page unavailable');
    expect(first.result.data.rows).toHaveLength(25);
    expect(first.result.data.rows[0]).toEqual({ id: 1 });
    expect(first.request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows?limit=25&offset=0&count=exact');
    const second = await load(25, { schema: 'public', table: 'todos', limit: 25, offset: 25, has_more: false, next_offset: null, rows: [{ id: 26 }, { id: 27 }, { id: 28 }], total_rows: 28 });
    expect(second.result).toMatchObject({ status: 'ready', data: { totalRows: 28, rows: [{ id: 26 }, { id: 27 }, { id: 28 }], hasMore: false } });
    const empty = await load(50, { schema: 'public', table: 'todos', limit: 25, offset: 50, has_more: false, next_offset: null, rows: [], total_rows: 28 });
    expect(empty.result).toMatchObject({ status: 'ready', data: { totalRows: 28, rows: [], hasMore: false } });
    const exactBoundary = await load(25, { schema: 'public', table: 'todos', limit: 25, offset: 25, has_more: false, next_offset: null, rows: [], total_rows: 25 });
    expect(exactBoundary.result).toMatchObject({ status: 'ready', data: { totalRows: 25, rows: [], hasMore: false } });
    const zero = await load(0, { schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: false, next_offset: null, rows: [], total_rows: 0 });
    expect(zero.result).toMatchObject({ status: 'ready', data: { totalRows: 0, rows: [], hasMore: false } });
    for (const total_rows of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, 25, 24]) {
      const invalid = await load(0, { schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: true, next_offset: 25, rows: Array.from({ length: 25 }, (_, id) => ({ id })), total_rows });
      expect(invalid.result).toEqual({ status: 'invalid' });
    }
    const missing = await load(0, { schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: false, next_offset: null, rows: [] });
    expect(missing.result).toEqual({ status: 'invalid' });
    const contradictory = await load(0, { schema: 'public', table: 'todos', limit: 25, offset: 0, has_more: false, next_offset: null, rows: [], total_rows: 1 });
    expect(contradictory.result).toEqual({ status: 'invalid' });
  });

  it('rejects invalid table offsets and foreign scope before requesting a token', async () => {
    const context = normalizeSaasContext(memberFixture);
    const request = vi.fn<typeof fetch>();
    for (const offset of [-1, 0.5, 1_000_001, Number.NaN, Infinity]) {
      expect(await loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', request, undefined, offset)).toEqual({ status: 'invalid' });
    }
    expect(await loadProjectTableRows(context, 'foreign', 'public', 'todos', 'wid_pk_once_123', 'user-token', request, undefined, 25)).toEqual({ status: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects table page mismatches and non-advancing or out-of-bound cursors', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const page = { schema: 'public', table: 'todos', limit: 25, offset: 25, has_more: true, next_offset: 50, rows: [{ id: 26 }] };
    for (const change of [{ schema: 'private' }, { table: 'other' }, { offset: 0 }, { limit: 100 }, { has_more: 'true' }, { next_offset: 25 }, { next_offset: 50.5 }, { next_offset: 1_000_025 }, { has_more: false, next_offset: 50 }, { rows: [null] }]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ ...page, ...change }));
      expect(await loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_once_123', 'user-token', request, undefined, 25)).toEqual({ status: 'invalid' });
    }
  });

  it('pages Storage metadata with one lookahead object and forwards the exact prefix and offset', async () => {
    const context = normalizeSaasContext(memberFixture);
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const object = (index: number) => ({ bucket: 'private', path: `assets/file-${index}.png`, size: 120, content_type: 'image/png', version_id: 'v1', updated_at_unix: 10, provider_secret: 'omitted' });
    const requestFor = (rows: unknown[]) => vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json(rows));
    const request = requestFor(Array.from({ length: 51 }, (_, index) => object(index)));
    const first = await loadProjectStorageObjects(context, 'project_member', 'private', 'wid_pk_once_123', 'user-token', request, undefined, 0, 'assets/');
    expect(first).toMatchObject({ status: 'ready', data: { offset: 0, hasMore: true } });
    if (first.status !== 'ready') throw new Error('page unavailable');
    expect(first.data.objects).toHaveLength(50);
    expect(JSON.stringify(first)).not.toContain('provider_secret');
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ prefix: 'assets/', limit: 51, offset: 0 });
    const lastRequest = requestFor([object(50)]);
    await expect(loadProjectStorageObjects(context, 'project_member', 'private', 'wid_pk_once_123', 'user-token', lastRequest, undefined, 50, 'assets/')).resolves.toMatchObject({ status: 'ready', data: { offset: 50, hasMore: false } });
    expect(JSON.parse(String(lastRequest.mock.calls[1]?.[1]?.body))).toEqual({ prefix: 'assets/', limit: 51, offset: 50 });
    await expect(loadProjectStorageObjects(context, 'project_member', 'private', 'wid_pk_once_123', 'user-token', requestFor(Array.from({ length: 50 }, (_, i) => object(i))))).resolves.toMatchObject({ status: 'ready', data: { hasMore: false } });
    for (const [offset, prefix] of [[-50, ''], [1, ''], [1_000_050, ''], [0, '文'.repeat(342)], [0, 'bad\0prefix']] as const) {
      const rejected = vi.fn<typeof fetch>();
      await expect(loadProjectStorageObjects(context, 'project_member', 'private', 'wid_pk_once_123', 'user-token', rejected, undefined, offset, prefix)).resolves.toEqual({ status: 'invalid' });
      expect(rejected).not.toHaveBeenCalled();
    }
    for (const rows of [[{ ...object(0), bucket: 'foreign' }], [{ ...object(0), path: 'foreign/file.png' }], [{ ...object(0), size: -1 }], Array.from({ length: 52 }, (_, i) => object(i))]) {
      await expect(loadProjectStorageObjects(context, 'project_member', 'private', 'wid_pk_once_123', 'user-token', requestFor(rows), undefined, 0, 'assets/')).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('lists only allowlisted object metadata and rejects unsafe bucket paths', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json([{ bucket: 'private', path: 'avatar.png', size: 120, content_type: 'image/png', version_id: 'v1', updated_at_unix: 10 }]));
    const result = await loadProjectStorageObjects(normalizeSaasContext(memberFixture), 'project_member', 'private', 'wid_pk_once_123', 'user-token', request);
    expect(result).toEqual({ status: 'ready', data: { bucket: 'private', offset: 0, hasMore: false, objects: [{ bucket: 'private', path: 'avatar.png', size: 120, contentType: 'image/png', versionId: 'v1', updatedAt: 10 }] } });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/management/buckets/private/objects/search');
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ prefix: '', limit: 51, offset: 0 });
    const rejected = vi.fn<typeof fetch>();
    await expect(loadProjectStorageObjects(normalizeSaasContext(memberFixture), 'project_member', '../private', 'wid_pk_once_123', 'user-token', rejected)).resolves.toEqual({ status: 'forbidden' });
    expect(rejected).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('loads a bounded secret-free database backup inventory with a fresh exact-project token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'a'.repeat(32)}`;
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({
        schema_version: 'w-db.backup-inventory/v1', project_id: 'project_member', resource_id: resourceId, status: 'available',
        backups: [{ backup_id: backupId, resource_id: resourceId, format: 'custom', state: 'ready', size_bytes: 42, created_at: '2026-08-02T00:00:00Z', expires_at: null, provider_ref: 'must-drop' }],
        usage: { items: 1, bytes: 42, maximum_items: 100, quota_exceeded: false }, retention: { days: 7 }, capabilities: { create: { supported: false, unavailable_reason: 'backup_create_provider_missing' }, download: { supported: false, unavailable_reason: 'backup_download_provider_missing' }, pitr: { supported: false, unavailable_reason: 'pitr_provider_missing' }, rollback: { supported: false, unavailable_reason: 'restore_rollback_provider_missing' } }, limits: { maximum_items: 100 }, restore: { supported: true, confirmation: 'RESTORE', idempotency_header: 'idempotency-key' },
      }));
    const result = await loadProjectDatabaseBackups(normalizeSaasContext(memberFixture), 'project_member', 'wid_pk_once_123', 'user-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { projectId: 'project_member', resourceId, backendStatus: 'available', restoreSupported: true, usage: { items: 1, bytes: 42, maximumItems: 100, quotaExceeded: false }, retentionDays: 7, capabilities: { create: { supported: false, unavailableReason: 'backup_create_provider_missing' }, pitr: { supported: false } }, backups: [{ backupId, resourceId, format: 'custom', state: 'ready', sizeBytes: 42, createdAt: '2026-08-02T00:00:00Z', expiresAt: null }] } });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/backups');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(JSON.stringify(result)).not.toMatch(/provider_ref|must-drop|postgres:\/\//);
    vi.useRealTimers();
  });

  it('creates and downloads only exact-project backups through authenticated same-origin requests', async () => {
    const context = normalizeSaasContext(memberFixture);
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'d'.repeat(32)}`;
    const created = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ schema_version: 'w-db.backup/v1', backup: { backup_id: backupId, resource_id: resourceId, format: 'custom', state: 'available', size_bytes: 42, created_at: '2026-08-02T00:00:00Z', expires_at: null, provider_ref: 'drop' } }), { status: 202, headers: { 'content-type': 'application/json' } }));
    const result = await createProjectDatabaseBackup(context, 'project_member', resourceId, 'wid_pk_once_123', 'user-token', created);
    expect(result).toEqual({ status: 'ready', data: { backupId, resourceId, format: 'custom', state: 'available', sizeBytes: 42, createdAt: '2026-08-02T00:00:00Z', expiresAt: null } });
    expect(created.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/backups');
    expect(created.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(new Headers(created.mock.calls[1]?.[1]?.headers).get('idempotency-key')).toMatch(/^console-backup-[0-9a-f-]{36}$/i);
    expect(new Headers(created.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${managementToken}`);
    expect(JSON.stringify(result)).not.toMatch(/provider_ref|drop|wid_pk/);

    const download = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(new Response(new Blob(['backup bytes']), { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${backupId}.dump"` } }));
    const downloaded = await downloadProjectDatabaseBackup(context, 'project_member', { backupId, resourceId, format: 'custom', state: 'available', createdAt: '2026-08-02T00:00:00Z' }, 'wid_pk_once_123', 'user-token', download);
    expect(downloaded).toMatchObject({ status: 'ready', data: { fileName: `${backupId}.dump` } });
    if (downloaded.status === 'ready') expect(await downloaded.data.blob.text()).toBe('backup bytes');
    expect(download.mock.calls[1]?.[0]).toBe(`/api/project-data/v1/projects/project_member/database/backups/${backupId}/download`);
    expect(download.mock.calls[1]?.[1]?.credentials).toBe('same-origin');
    expect(JSON.stringify(downloaded, (_key, value) => value instanceof Blob ? '[blob]' : value)).not.toMatch(/wid_pk|provider_ref/);
  });

  it('requires exact RESTORE confirmation and sends all exact identifiers with an idempotency key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'b'.repeat(32)}`;
    const rejected = vi.fn<typeof fetch>();
    await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'restore', 'wid_pk_once_123', 'user-token', rejected)).resolves.toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
    const managementToken = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const operationId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: managementToken, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ schema_version: 'w-db.restore-operation/v1', project_id: 'project_member', operation: { operation_id: operationId, resource_id: resourceId, backup_id: backupId, state: 'succeeded', replayed: false } }), { status: 202, headers: { 'content-type': 'application/json' } }));
    await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: 'ready', data: { operationId, backupId, state: 'succeeded', replayed: false } });
    expect(request.mock.calls[1]?.[0]).toBe(`/api/project-data/v1/projects/project_member/database/backups/${backupId}/restore`);
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ confirmation: 'RESTORE', project_id: 'project_member', resource_id: resourceId, backup_id: backupId });
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('idempotency-key')).toMatch(/^console-restore-[0-9a-f-]{36}$/i);
    vi.useRealTimers();
  });

  it('previews destructive restore risk and loads only bounded redacted backup audit', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const context = normalizeSaasContext(memberFixture); const resourceId = '11111111-2222-4333-8444-555555555555'; const backupId = `bkp_${'c'.repeat(32)}`; const backup = { backupId, resourceId, format: 'custom', state: 'available', createdAt: '2026-08-02T00:00:00Z' }; const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const previewRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-preview/v1', confirmation: 'RESTORE', preview: { backup: { backup_id: backupId, resource_id: resourceId }, current_resource_id: resourceId, destructive: true, rollback_supported: false, provider_ref: 'drop' } }));
    await expect(previewProjectDatabaseRestore(context, 'project_member', backup, 'wid_pk_once_123', 'user-token', previewRequest)).resolves.toEqual({ status: 'ready', data: { backup, currentResourceId: resourceId, destructive: true, rollbackSupported: false } });
    const eventKinds = ['backup.recorded', 'backup.created', 'backup.downloaded', 'restore.previewed', 'restore.executed'] as const;
    const auditEvents = eventKinds.map((event_kind, index) => ({ event_kind, object_id: `object-${index}`, state: index === 0 ? 'available' : event_kind === 'restore.executed' ? 'failed' : 'succeeded', actor_id: index === 0 ? null : 'user-1', error_code: event_kind === 'restore.executed' ? 'backup_restore_failed' : null, created_at: '2026-08-02T01:00:00Z', credential_ref: 'drop' }));
    const auditRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schema_version: 'w-db.backup-audit/v1', bounded: true, events: auditEvents }));
    const audit = await loadProjectDatabaseAudit(context, 'project_member', 50, 'wid_pk_once_123', 'user-token', auditRequest); expect(audit).toMatchObject({ status: 'ready', data: { bounded: true, events: eventKinds.map((eventKind, index) => ({ eventKind, objectId: `object-${index}` })) } }); expect(audit).toMatchObject({ data: { events: [{ state: 'available', actorId: null }, {}, {}, {}, { state: 'failed', errorCode: 'backup_restore_failed' }] } }); expect(JSON.stringify(audit)).not.toMatch(/credential_ref|provider_ref|drop/); expect(String(auditRequest.mock.calls[1]?.[0]).endsWith('audit?limit=50')).toBe(true);

    const unknownAuditRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 })).mockResolvedValueOnce(Response.json({ schema_version: 'w-db.backup-audit/v1', bounded: true, events: [{ event_kind: 'backup.future-kind', object_id: 'object-future', state: 'succeeded', created_at: '2026-08-02T01:00:00Z' }] }));
    await expect(loadProjectDatabaseAudit(context, 'project_member', 50, 'wid_pk_once_123', 'user-token', unknownAuditRequest)).resolves.toEqual({ status: 'invalid' });
    vi.useRealTimers();
  });

  it('shares cancellation across restore authorization and execution', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'c'.repeat(32)}`;
    const backup = { backupId, resourceId, format: 'custom', state: 'available', createdAt: '2026-08-02T00:00:00Z' };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const controller = new AbortController();
    const preview = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-preview/v1', confirmation: 'RESTORE', preview: { backup: { backup_id: backupId, resource_id: resourceId }, current_resource_id: resourceId, destructive: true, rollback_supported: false } }));
    expect((await previewProjectDatabaseRestore(context, 'project_member', backup, 'wid_pk_once_123', 'user-token', preview, controller.signal)).status).toBe('ready');
    expect(preview.mock.calls[0]?.[1]?.signal).toBe(preview.mock.calls[1]?.[1]?.signal);
    const restore = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-operation/v1', project_id: 'project_member', operation: { operation_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', resource_id: resourceId, backup_id: backupId, state: 'running', replayed: false } }));
    await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', restore, controller.signal)).resolves.toMatchObject({ status: 'ready', data: { state: 'running' } });
    expect(restore.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(restore.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
    controller.abort();
    expect(preview.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  });

  it('never sends restore or preview after cancelled or deliberately late authorization', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'c'.repeat(32)}`;
    const backup = { backupId, resourceId, format: 'custom', state: 'available', createdAt: '2026-08-02T00:00:00Z' };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const kind of ['preview', 'restore'] as const) {
      for (const alreadyAborted of [true, false]) {
        const controller = new AbortController();
        if (alreadyAborted) controller.abort();
        const request = vi.fn<typeof fetch>().mockImplementation(async () => {
          controller.abort(); // Simulate authorization that ignores cancellation and still resolves.
          return Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 });
        });
        if (kind === 'preview') await expect(previewProjectDatabaseRestore(context, 'project_member', backup, 'wid_pk_once_123', 'user-token', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        else await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request, controller.signal)).resolves.toEqual({ status: 'network' });
        expect(request).toHaveBeenCalledTimes(alreadyAborted ? 0 : 1);
      }
    }
  });

  it('keeps failed restore receipts distinct and rejects unknown or foreign operation receipts', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'c'.repeat(32)}`;
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const patch of [{ state: 'failed' }, { state: 'future' }, { resource_id: '11111111-2222-4333-8444-666666666666' }, { backup_id: `bkp_${'d'.repeat(32)}` }]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-operation/v1', project_id: 'project_member', operation: { operation_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', resource_id: resourceId, backup_id: backupId, state: 'succeeded', replayed: false, ...patch } }));
      const result = await restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request);
      expect(result).toEqual(patch.state === 'failed' ? { status: 'ready', data: { operationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', backupId, state: 'failed', replayed: false } } : { status: 'invalid' });
    }
  });

  it('retains canonical failed restore receipts on provider error responses without trusting other failures', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const backupId = `bkp_${'c'.repeat(32)}`;
    const operationId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const operation = { operation_id: operationId, resource_id: resourceId, backup_id: backupId, state: 'failed', replayed: false, error_code: 'backup_restore_failed', provider_ref: 'must-drop' };
    const receipt = { schema_version: 'w-db.restore-operation/v1', project_id: 'project_member', operation };
    for (const status of [501, 502, 503]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json(receipt, { status }));
      await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: 'ready', data: { operationId, backupId, state: 'failed', replayed: false, errorCode: 'backup_restore_failed' } });
    }
    for (const [status, body, expected] of [
      [401, receipt, 'auth'], [403, receipt, 'forbidden'], [409, receipt, 'network'],
      [502, { ...receipt, project_id: 'project_foreign' }, 'network'],
      [502, { ...receipt, operation: { ...operation, resource_id: '11111111-2222-4333-8444-666666666666' } }, 'network'],
      [503, { ...receipt, operation: { ...operation, state: 'succeeded' } }, 'network'],
      [502, { error: 'backup_restore_failed' }, 'network'],
    ] as const) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json(body, { status }));
      await expect(restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: expected });
    }
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ ...receipt, operation: { ...operation, error_code: 'postgres://must-drop' } }, { status: 502 }));
    const result = await restoreProjectDatabaseBackup(context, 'project_member', resourceId, backupId, 'project_member', 'wid_pk_once_123', 'user-token', request);
    expect(result).toMatchObject({ status: 'ready', data: { state: 'failed' } });
    expect(JSON.stringify(result)).not.toMatch(/provider_ref|must-drop|postgres:/);
  });

  it('rolls back only a confirmed successful restore with fresh project authorization and exact receipt IDs', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const restore = { operationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', backupId: `bkp_${'c'.repeat(32)}`, state: 'succeeded', replayed: false, rollbackAvailable: true };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
      .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-operation/v1', operation: { operation_id: restore.operationId, resource_id: resourceId, backup_id: restore.backupId, state: 'rolled_back', replayed: false, rollback_available: true, rollback_provider_ref: 'must-drop' } }));
    const controller = new AbortController();
    await expect(rollbackProjectDatabaseRestore(context, 'project_member', resourceId, restore, 'project_member', 'wid_pk_once_123', 'user-token', request, controller.signal)).resolves.toEqual({ status: 'ready', data: { ...restore, state: 'rolled_back' } });
    expect(request.mock.calls[1]?.[0]).toBe(`/api/project-data/v1/projects/project_member/database/restores/${restore.operationId}/rollback`);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(request.mock.calls[1]?.[1]?.body).toBeUndefined();
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${token}`);
    expect(request.mock.calls[1]?.[1]?.signal).toBe(request.mock.calls[0]?.[1]?.signal);
    controller.abort(); expect(request.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  });

  it('rejects wrong rollback confirmation, unsupported receipts, members and cancelled late authorization before rollback', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const restore = { operationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', backupId: `bkp_${'c'.repeat(32)}`, state: 'succeeded', replayed: false, rollbackAvailable: true };
    const rejected = vi.fn<typeof fetch>();
    await expect(rollbackProjectDatabaseRestore(context, 'project_member', resourceId, restore, 'wrong', 'wid_pk_once_123', 'user-token', rejected)).resolves.toEqual({ status: 'invalid' });
    for (const patch of [{ state: 'failed' }, { state: 'running' }, { state: 'rolled_back' }, { rollbackAvailable: false }, { rollbackAvailable: undefined }, { operationId: '../wrong' }]) {
      await expect(rollbackProjectDatabaseRestore(context, 'project_member', resourceId, { ...restore, ...patch }, 'project_member', 'wid_pk_once_123', 'user-token', rejected)).resolves.toEqual({ status: 'invalid' });
    }
    const member = normalizeSaasContext(memberFixture); member.console.projects[0]!.workspaceRole = 'member';
    await expect(rollbackProjectDatabaseRestore(member, 'project_member', resourceId, restore, 'project_member', 'wid_pk_once_123', 'user-token', rejected)).resolves.toEqual({ status: 'forbidden' });
    expect(rejected).not.toHaveBeenCalled();
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    const controller = new AbortController();
    const late = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }); });
    await expect(rollbackProjectDatabaseRestore(context, 'project_member', resourceId, restore, 'project_member', 'wid_pk_once_123', 'user-token', late, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('rejects foreign, nonterminal and malformed rollback receipts', async () => {
    const context = normalizeSaasContext(memberFixture);
    const resourceId = '11111111-2222-4333-8444-555555555555';
    const restore = { operationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', backupId: `bkp_${'c'.repeat(32)}`, state: 'succeeded', replayed: false, rollbackAvailable: true };
    const token = projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
    for (const patch of [{ operation_id: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee' }, { resource_id: '11111111-2222-4333-8444-666666666666' }, { backup_id: `bkp_${'d'.repeat(32)}` }, { state: 'succeeded' }, { state: 'running' }, { replayed: 'false' }]) {
      const request = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 }))
        .mockResolvedValueOnce(Response.json({ schema_version: 'w-db.restore-operation/v1', operation: { operation_id: restore.operationId, resource_id: resourceId, backup_id: restore.backupId, state: 'rolled_back', replayed: false, ...patch } }));
      await expect(rollbackProjectDatabaseRestore(context, 'project_member', resourceId, restore, 'project_member', 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('denies backup control to non-owner members before token exchange and never renders provider credentials', async () => {
    const context = normalizeSaasContext(memberFixture); context.console.projects[0]!.workspaceRole = 'member'; const request = vi.fn<typeof fetch>();
    await expect(loadProjectDatabaseBackups(context, 'project_member', 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: 'forbidden' }); await expect(loadProjectDatabaseAudit(context, 'project_member', 50, 'wid_pk_once_123', 'user-token', request)).resolves.toEqual({ status: 'forbidden' }); expect(request).not.toHaveBeenCalled();
    expect(backupsComponentSource).toContain('dep_w_db_backup_provider'); expect(backupsComponentSource).toContain('confirmation !== projectId'); expect(backupsComponentSource).not.toMatch(/postgres:\/\/|provider_ref|credential_ref|localStorage|sessionStorage|console\.(?:log|error)/);
  });
});

describe('automatic Project Connect key lifecycle', () => {
  const context = normalizeSaasContext(memberFixture);
  const serverMetadata = { id: 'pkey_server_1', name: 'backend', kind: 'server', key_prefix: 'wid_sk_abcd', scopes: ['data:admin'], allowed_origins: [], last_used_at: null, expires_at: null, revoked_at: null, rotated_at: null, created_at: 100 };

  it('lists publishable and server metadata without returning reusable server material', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [{ ...serverMetadata, overlap_expires_at: 150 }, { ...serverMetadata, id: 'pkey_web_1', kind: 'publishable', key_prefix: 'wid_pk_abcd', scopes: ['auth:use'], encrypted_key: 'must-drop' }] }));
    const result = await loadProjectKeyMetadata(context, 'project_member', 'fresh-user-token', request); expect(result).toMatchObject({ status: 'ready', data: [{ kind: 'server', keyPrefix: 'wid_sk_abcd', expiresAt: null, overlapExpiresAt: 150 }, { kind: 'publishable', keyPrefix: 'wid_pk_abcd' }] }); expect(JSON.stringify(result)).not.toMatch(/encrypted_key|must-drop|wid_sk_[A-Za-z0-9_-]{10}/); expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer fresh-user-token');
  });

  it('creates and rotates a server key only after exact project confirmation and returns it once', async () => {
    const rejected = vi.fn<typeof fetch>(); await expect(issueProjectServerKey(context, 'project_member', 'wrong', 'fresh-token', rejected)).resolves.toEqual({ status: 'error', reason: 'forbidden' }); expect(rejected).not.toHaveBeenCalled();
    const oneTime = ['wid', 'sk', 'once', '123'].join('_'); const create = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, key: oneTime, data: serverMetadata })); const issued = await issueProjectServerKey(context, 'project_member', 'project_member', 'fresh-token', create); expect(issued).toMatchObject({ status: 'ready', oneTimeKey: oneTime, metadata: { kind: 'server' } }); expect(JSON.parse(String(create.mock.calls[0]?.[1]?.body))).toMatchObject({ kind: 'server', allowed_origins: [] });
    const key = issued.status === 'ready' && 'metadata' in issued ? issued.metadata : null; expect(key).not.toBeNull(); const rotated = ['wid', 'sk', 'rotated', 'once'].join('_'); const rotate = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, key: rotated, data: { ...serverMetadata, id: 'pkey_server_2' } })); await expect(rotateProjectKey(context, 'project_member', key!, 'project_member', 'fresh-token', rotate)).resolves.toMatchObject({ status: 'ready', oneTimeKey: rotated });
  });

  it('creates a named least-privilege server key with a checked expiry and canonical receipt', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const input = { name: '  数据导出  ', scopes: ['storage:read', 'data:read'], expiresAt };
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, key: ['wid', 'sk', 'configured', 'once'].join('_'), data: { ...serverMetadata, name: '数据导出', scopes: ['data:read', 'storage:read'], expires_at: expiresAt } }));
    const result = await issueProjectServerKey(context, 'project_member', 'project_member', 'fresh-token', request, input);
    expect(result).toMatchObject({ status: 'ready', metadata: { name: '数据导出', expiresAt, scopes: ['data:read', 'storage:read'] } });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ name: '数据导出', kind: 'server', scopes: ['data:read', 'storage:read'], allowed_origins: [], expires_at: expiresAt });
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer fresh-token');
  });

  it('rejects invalid server-key settings before any HTTP request', async () => {
    const request = vi.fn<typeof fetch>();
    const base = { name: 'export', scopes: ['data:read'], expiresAt: null };
    for (const input of [{ ...base, name: ' ' }, { ...base, name: 'a'.repeat(129) }, { ...base, name: 'bad\nname' }, { ...base, scopes: [] }, { ...base, scopes: ['data:read', 'data:read'] }, { ...base, scopes: ['platform:admin'] }, { ...base, expiresAt: Math.floor(Date.now() / 1000) - 1 }, { ...base, expiresAt: NaN }, { ...base, expiresAt: 1.5 }]) {
      await expect(issueProjectServerKey(context, 'project_member', 'project_member', 'fresh-token', request, input)).resolves.toEqual({ status: 'error', reason: 'invalid' });
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('does not expose a key whose receipt grants unrequested permissions or a different expiry/name', async () => {
    const input = { name: 'export', scopes: ['data:read'], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    for (const override of [{ scopes: ['data:read', 'data:admin'] }, { scopes: ['data:read', 'data:read'] }, { name: 'another-key' }, { expires_at: null }, { kind: 'publishable', key_prefix: 'wid_pk_abcd' }, { allowed_origins: ['https://unexpected.example'] }, { revoked_at: 123 }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ key: ['wid', 'sk', 'invalid', 'receipt'].join('_'), data: { ...serverMetadata, name: input.name, scopes: input.scopes, expires_at: input.expiresAt, ...override } }));
      await expect(issueProjectServerKey(context, 'project_member', 'project_member', 'fresh-token', request, input)).resolves.toEqual({ status: 'error', reason: 'invalid' });
    }
  });

  it('fails closed for no token, cross tenant, member key management and revoke mismatch', async () => {
    const request = vi.fn<typeof fetch>(); await expect(loadProjectKeyMetadata(context, 'project_member', null, request)).resolves.toEqual({ status: 'auth' }); await expect(loadProjectKeyMetadata(context, 'project_foreign', 'token', request)).resolves.toEqual({ status: 'forbidden' }); await expect(revokeProjectKey(context, 'project_member', 'pkey_server_1', 'wrong', 'token', request)).resolves.toEqual({ status: 'error', reason: 'forbidden' });
    const member = normalizeSaasContext(memberFixture); member.console.projects[0]!.workspaceRole = 'member'; await expect(loadProjectKeyMetadata(member, 'project_member', 'token', request)).resolves.toEqual({ status: 'forbidden' }); expect(request).not.toHaveBeenCalled();
  });

  it('ships automatic bilingual accessible snippets without persistent or URL secret handling', () => {
    expect(connectComponentSource).toContain("zh: { title: '项目连接'"); expect(connectComponentSource).toContain("createWClient"); expect(connectComponentSource).toContain("@supabase/supabase-js"); expect(connectComponentSource).toContain('aria-live="polite"'); expect(connectComponentSource).toContain('confirmation !== projectId'); expect(connectComponentSource).not.toMatch(/localStorage|sessionStorage|URLSearchParams|trackEvent|console\.(?:log|error)|DATABASE_URL|RADAR_API_KEY|provider_ref/);
  });
});

describe('complete project Storage management contract', () => {
  const context = normalizeSaasContext(memberFixture);
  const key = 'wid_pk_once_123';
  const bucketPayload = { id: 'private-files', name: 'Private files', public: false, file_size_limit: 1024, allowed_mime_types: ['text/plain'], quota_bytes: 4096 };
  const managementToken = () => projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
  const exchange = (token: string) => Response.json({ access_token: token, token_type: 'Bearer', expires_in: 300 });

  it('copies and moves raw Unicode/percent paths across buckets with fresh project grants and bounded signals', async () => {
    for (const action of ['copy', 'move'] as const) {
      const input = { action, bucket: 'private-files', path: '共享/literal%2F #.txt', destinationBucket: 'assets', destinationPath: '归档/literal%25 ?.txt' };
      const token = managementToken(); const controller = new AbortController();
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(token)).mockResolvedValueOnce(Response.json({ message: action === 'copy' ? 'Successfully copied' : 'Successfully moved', provider_secret: 'drop-me' }));
      await expect(transferProjectStorageObject(context, 'project_member', input, key, 'user-token', request, controller.signal)).resolves.toEqual({ status: 'ready', data: input });
      expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
      expect(request.mock.calls[1]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/supabase/object/' + action);
      const init = request.mock.calls[1]?.[1];
      expect(init?.method).toBe('POST'); expect(init?.cache).toBe('no-store');
      expect(JSON.parse(String(init?.body))).toEqual({ bucketId: input.bucket, sourceKey: input.path, destinationKey: input.destinationPath, destinationBucket: input.destinationBucket });
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ' + token);
      expect(new Headers(init?.headers).get('apikey')).toBe(key);
      expect(init?.signal).toBe(request.mock.calls[0]?.[1]?.signal); controller.abort(); expect(init?.signal?.aborted).toBe(true);
    }
  });

  it('refuses unsafe transfer targets, same-object writes and cross-project access before dispatch', async () => {
    const base = { action: 'copy' as const, bucket: 'private-files', path: 'source.txt', destinationBucket: 'assets', destinationPath: 'target.txt' };
    const request = vi.fn<typeof fetch>();
    for (const input of [{ ...base, destinationBucket: '../foreign' }, { ...base, destinationPath: '' }, { ...base, destinationPath: 'x/../y' }, { ...base, path: 'x/./y' }, { ...base, destinationPath: '中'.repeat(342) }, { ...base, destinationPath: 'x\0y' }, { ...base, destinationBucket: base.bucket, destinationPath: base.path }]) {
      expect(validProjectStorageTransfer(input)).toBe(false);
      await expect(transferProjectStorageObject(context, 'project_member', input, key, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
    await expect(transferProjectStorageObject(context, 'project_foreign', base, key, 'user-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(transferProjectStorageObject(context, 'project_member', base, key, null, request)).resolves.toEqual({ status: 'auth' });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not retry a failed transfer or accept a mismatched acknowledgement, and stops late cancelled authorization', async () => {
    const input = { action: 'move' as const, bucket: 'private-files', path: 'source.txt', destinationBucket: 'assets', destinationPath: 'target.txt' };
    for (const response of [new Response('{}', { status: 403 }), Response.json({ message: 'Successfully copied' }), Response.json({ path: 'target.txt' })]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(response);
      const result = await transferProjectStorageObject(context, 'project_member', input, key, 'user-token', request);
      expect(result.status).not.toBe('ready'); expect(request).toHaveBeenCalledTimes(2);
    }
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => { controller.abort(); return exchange(managementToken()); });
    await expect(transferProjectStorageObject(context, 'project_member', input, key, 'user-token', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('creates and updates a bucket with a fresh exact-project token for every operation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const firstToken = managementToken(); const secondToken = managementToken();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(exchange(firstToken)).mockResolvedValueOnce(Response.json(bucketPayload))
      .mockResolvedValueOnce(exchange(secondToken)).mockResolvedValueOnce(Response.json({ ...bucketPayload, name: 'Renamed' }));
    const input = { id: 'private-files', name: 'Private files', public: false, fileSizeLimit: 1024, objectMimeTypes: ['text/plain'], quotaBytes: 4096 };
    await expect(createProjectStorageBucket(context, 'project_member', input, key, 'user-token', request)).resolves.toMatchObject({ status: 'ready', data: { id: 'private-files', quotaBytes: 4096 } });
    await expect(updateProjectStorageBucket(context, 'project_member', { ...input, name: 'Renamed' }, key, 'user-token', request)).resolves.toMatchObject({ status: 'ready', data: { name: 'Renamed' } });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/management/buckets');
    expect(request.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(request.mock.calls[3]?.[1]?.method).toBe('PATCH');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${firstToken}`);
    expect(new Headers(request.mock.calls[3]?.[1]?.headers).get('authorization')).toBe(`Bearer ${secondToken}`);
    vi.useRealTimers();
  });

  it('serializes an empty MIME allowlist as unrestricted while preserving explicit types', async () => {
    for (const save of [createProjectStorageBucket, updateProjectStorageBucket]) {
      for (const objectMimeTypes of [[], null, ['text/plain']]) {
        const request = vi.fn<typeof fetch>()
          .mockResolvedValueOnce(exchange(managementToken()))
          .mockResolvedValueOnce(Response.json({ ...bucketPayload, allowed_mime_types: objectMimeTypes ?? [] }));
        await expect(save(context, 'project_member', { id: 'private-files', name: 'Private files', public: false, objectMimeTypes }, key, 'user-token', request)).resolves.toMatchObject({ status: 'ready' });
        const body = JSON.parse(String(request.mock.calls[1]?.[1]?.body));
        expect(body.allowed_mime_types).toEqual(objectMimeTypes?.length ? objectMimeTypes : null);
      }
    }
  });

  it('rejects a bucket-write receipt for a different bucket', async () => {
    const input = { id: 'private-files', name: 'Private files', public: false };
    for (const save of [createProjectStorageBucket, updateProjectStorageBucket]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ ...bucketPayload, id: 'another-bucket' }));
      await expect(save(context, 'project_member', input, key, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('reads a bounded exact-project bucket inventory with fresh authorization and rejects partial or duplicate receipts', async () => {
    const controller = new AbortController();
    for (const payload of [[bucketPayload], [], [bucketPayload, bucketPayload], [bucketPayload, {}], Array.from({ length: 201 }, (_, index) => ({ ...bucketPayload, id: `bucket-${index}` }))]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(payload));
      const bounded: typeof fetch = (input, init) => request(input, { ...init, signal: controller.signal });
      const result = await loadProjectStorageBuckets(context, 'project_member', key, 'user-token', bounded);
      expect(result.status).toBe(payload.length <= 1 ? 'ready' : 'invalid');
      expect(request.mock.calls[1]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/management/buckets');
      expect(request.mock.calls.every(([,init]) => init?.signal === controller.signal)).toBe(true);
      expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('apikey')).toBe(key);
    }
    const rejected = vi.fn<typeof fetch>();
    await expect(loadProjectStorageBuckets(context, 'project_foreign', key, 'user-token', rejected)).resolves.toEqual({ status: 'forbidden' });
    expect(rejected).not.toHaveBeenCalled();
  });

  it('requires exact destructive confirmations before any bucket or object request', async () => {
    const rejected = vi.fn<typeof fetch>();
    await expect(deleteProjectStorageBucket(context, 'project_member', 'private-files', 'PRIVATE-FILES', key, 'user-token', rejected)).resolves.toEqual({ status: 'invalid' });
    await expect(deleteProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', 'a.txt', key, 'user-token', rejected)).resolves.toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', 'folder/a.txt', key, 'user-token', request)).resolves.toEqual({ status: 'ready', data: { path: 'folder/a.txt' } });
    expect(request.mock.calls[1]?.[0]).toContain('/objects/folder/a.txt');
    expect(request.mock.calls[1]?.[1]?.method).toBe('DELETE');
  });

  it('uploads browser File bytes and returns only an opaque same-origin signed-read route', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const uploadRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', path: 'folder/a.txt', size: 5, content_type: 'text/plain', version_id: 'a'.repeat(32), updated_at_unix: 10, provider_secret: 'drop-me' }));
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', file, key, 'user-token', uploadRequest)).resolves.toEqual({ status: 'ready', data: { bucket: 'private-files', path: 'folder/a.txt', size: 5, contentType: 'text/plain', versionId: 'a'.repeat(32), updatedAt: 10 } });
    expect(uploadRequest.mock.calls[1]?.[1]?.body).toBe(file);
    expect(new Headers(uploadRequest.mock.calls[1]?.[1]?.headers).get('if-none-match')).toBe('*');
    const signRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ signedUrl: `/storage/v1/signed/${'b'.repeat(32)}`, expiresAtUnix: Math.floor(Date.now() / 1000) + 300, provider_url: 'https://secret.invalid' }));
    const signed = await signProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', signRequest);
    expect(signed).toEqual({ status: 'ready', data: { url: `/api/project-storage/storage/v1/signed/${'b'.repeat(32)}`, expiresAt: Math.floor(Date.now() / 1000) + 300 } });
    expect(JSON.stringify(signed)).not.toMatch(/provider_url|secret\.invalid|user-token|wid_pk/);
    vi.useRealTimers();
  });

  it('keeps existing objects unless replacement is explicitly enabled and never replays a conflict', async () => {
    const file = new File(['new bytes'], 'file.txt', { type: 'text/plain' });
    const conflict = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ error: 'object_already_exists' }, { status: 412 }));
    const result = await uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', file, key, 'user-token', conflict);
    expect(result.status).not.toBe('ready');
    expect(conflict).toHaveBeenCalledTimes(2);
    expect(new Headers(conflict.mock.calls[1]?.[1]?.headers).get('if-none-match')).toBe('*');
    const replace = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', path: 'file.txt', size: file.size, content_type: file.type, version_id: 'new-version', updated_at_unix: 10 }));
    await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', file, key, 'user-token', replace, undefined, true)).resolves.toMatchObject({ status: 'ready' });
    expect(new Headers(replace.mock.calls[1]?.[1]?.headers).has('if-none-match')).toBe(false);
    expect(replace.mock.calls[1]?.[1]?.body).toBe(file);
  });

  it.each([[412, 'object_already_exists'], [413, 'object_too_large'], [413, 'bucket_quota_exceeded'], [415, 'mime_type_not_allowed']])('projects only the documented upload rejection for HTTP %s / %s', async (status, code) => {
    const file = new File(['new bytes'], 'file.txt');
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ error: code, message: 'private-provider diagnostic', credential: 'never-render-this' }, { status: Number(status) }));
    const result = await uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', file, key, 'user-token', request);
    expect(result).toEqual({ status: 'network', rejection: code });
    expect(JSON.stringify(result)).not.toMatch(/private-provider|never-render/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps unknown, malformed and mismatched upload failures generic without exposing response text', async () => {
    for (const response of [Response.json({ error: 'future_error', message: 'private diagnostic' }, { status: 413 }), Response.json({ error: 'object_too_large' }, { status: 415 }), Response.json({ error: 'mime_type_not_allowed' }, { status: 500 }), new Response('private-provider invalid JSON', { status: 413 }), new Response(new Uint8Array([255]), { status: 415 })]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(response);
      await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', new File(['x'], 'file.txt'), key, 'user-token', request)).resolves.toEqual({ status: 'network' });
      expect(request).toHaveBeenCalledTimes(2);
    }
  });

  it('stops reading an oversized upload error and cancels an unfinished response body', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: 'object_too_large', diagnostic: 'x'.repeat(4096) }))); }, cancel() { cancelled = true; } });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response(stream, { status: 413 }));
    await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', new File(['x'], 'file.txt'), key, 'user-token', request)).resolves.toEqual({ status: 'network' });
    expect(cancelled).toBe(true);
  });

  it('cancels stalled upload failure decoding with the operation signal', async () => {
    const controller = new AbortController(); let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response(stream, { status: 413 }));
    const result = uploadProjectStorageObject(context, 'project_member', 'private-files', 'file.txt', new File(['x'], 'file.txt'), key, 'user-token', request, controller.signal);
    await vi.waitFor(() => expect(stream.locked).toBe(true));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toBe(true);
  });

  it('prepares distinct bounded upload paths before any request, retaining exact single-file keys', () => {
    const files = [new File(['one'], 'a.txt'), new File(['two'], '测试.txt')];
    expect(prepareProjectStorageUploads([files[0]], 'custom/name.txt')?.map((item) => item.path)).toEqual(['custom/name.txt']);
    expect(prepareProjectStorageUploads(files, 'folder/')?.map((item) => item.path)).toEqual(['folder/a.txt', 'folder/测试.txt']);
    expect(prepareProjectStorageUploads(files, '')?.map((item) => item.path)).toEqual(['a.txt', '测试.txt']);
    expect(prepareProjectStorageUploads([], '')).toBeNull();
    expect(prepareProjectStorageUploads([files[0]], '')).toBeNull();
    expect(prepareProjectStorageUploads([files[0], new File(['duplicate'], 'a.txt')], 'folder')).toBeNull();
    for (const prefix of ['../escape', '/..', '\0bad', '界'.repeat(342)]) expect(prepareProjectStorageUploads(files, prefix)).toBeNull();
    const many = Array.from({ length: 100 }, (_, index) => new File([], `${index}.txt`));
    expect(prepareProjectStorageUploads(many, '')).toHaveLength(100);
    expect(prepareProjectStorageUploads([...many, new File([], 'extra.txt')], '')).toBeNull();
    const cap = new File([], 'cap.bin'); Object.defineProperty(cap, 'size', { value: 64 * 1024 * 1024 });
    expect(prepareProjectStorageUploads([cap], 'cap.bin')).toHaveLength(1);
    expect(prepareProjectStorageUploads([cap, new File(['x'], 'extra.txt')], '')).toBeNull();
  });

  it('retains folder hierarchy and the root name, including one-file folders, before authorization', () => {
    const file = (path: string, body = 'data') => {
      const value = new File([body], path.split('/').at(-1) || 'file');
      Object.defineProperty(value, 'webkitRelativePath', { value: path });
      return value;
    };
    const nested = [file('photos/left/same.txt'), file('photos/right/same.txt'), file('photos/中文%25+/雪.bin')];
    expect(prepareProjectStorageUploads(nested, 'archive/', true)?.map(item => item.path)).toEqual(['archive/photos/left/same.txt', 'archive/photos/right/same.txt', 'archive/photos/中文%25+/雪.bin']);
    const single = file('one-folder/only.txt');
    expect(prepareProjectStorageUploads([single], '', true)?.[0]).toEqual({ path: 'one-folder/only.txt', file: single });
    expect(prepareProjectStorageUploads([single], 'prefix', true)?.[0].path).toBe('prefix/one-folder/only.txt');
    expect(prepareProjectStorageUploads(nested, '', false)).toBeNull();
    for (const path of ['', 'file.txt', '/root/file.txt', 'root//file.txt', 'root/../file.txt', 'root/./file.txt', 'root/\\file.txt', 'root/\u0000file.txt', 'root/\nfile.txt', 'root/'+ '雪'.repeat(342)]) {
      expect(prepareProjectStorageUploads([file(path)], '', true)).toBeNull();
    }
    for (const prefix of ['/archive', 'archive//child', 'archive/../child', 'archive\\child', 'archive/\nchild']) expect(prepareProjectStorageUploads(nested, prefix, true)).toBeNull();
    expect(prepareProjectStorageUploads([single, single], '', true)).toBeNull();
    const mislabeled = file('root/a.txt'); Object.defineProperty(mislabeled, 'name', { value: 'b.txt' });
    expect(prepareProjectStorageUploads([mislabeled], '', true)).toBeNull();
    expect(prepareProjectStorageUploads(Array.from({ length: 101 }, (_, index) => file(`root/${index}.txt`)), '', true)).toBeNull();
    const large = file('root/large.bin'); Object.defineProperty(large, 'size', { value: 64 * 1024 * 1024 });
    expect(prepareProjectStorageUploads([large], '', true)).toHaveLength(1);
    expect(prepareProjectStorageUploads([large, single], '', true)).toBeNull();
  });

  it('uses one bounded abort signal for upload authorization and bytes, and rejects incorrect receipt sizes', async () => {
    const controller = new AbortController();
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', path: 'folder/a.txt', size: 4, version_id: 'v1' }));
    await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', file, key, 'user-token', request, controller.signal)).resolves.toEqual({ status: 'invalid' });
    expect(request.mock.calls[0]?.[1]?.signal).toBe(request.mock.calls[1]?.[1]?.signal);
    expect(request.mock.calls[1]?.[1]?.body).toBe(file);
    controller.abort();
    expect(request.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    const rejected = vi.fn<typeof fetch>();
    await expect(uploadProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', file, key, 'user-token', rejected, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(rejected).not.toHaveBeenCalled();
  });

  it('loads bounded quota usage and newest-200 secret-free audit projections', async () => {
    const usageRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', bytes_used: 5, object_count: 1, quota_bytes: 4096, bytes_remaining: 4091, credential_ref: 'drop-me' }));
    await expect(loadProjectStorageUsage(context, 'project_member', 'private-files', key, 'user-token', usageRequest)).resolves.toEqual({ status: 'ready', data: { bucket: 'private-files', bytesUsed: 5, objectCount: 1, quotaBytes: 4096, bytesRemaining: 4091 } });
    const auditRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ events: [{ id: 'evt-1', actor_id: 'user-1', action: 'object.put', resource_type: 'object', bucket: 'private-files', object_path: 'folder/a.txt', occurred_at: '2026-08-02T12:00:00Z', provider_secret: 'drop-me' }], truncated: false, workspace_id: 'drop-me' }));
    const audit = await loadProjectStorageAudit(context, 'project_member', key, 'user-token', auditRequest);
    expect(audit).toEqual({ status: 'ready', data: { events: [{ id: 'evt-1', actorId: 'user-1', action: 'object.put', resourceType: 'object', bucket: 'private-files', objectPath: 'folder/a.txt', occurredAt: '2026-08-02T12:00:00Z' }], truncated: false } });
    expect(JSON.stringify(audit)).not.toMatch(/provider_secret|workspace_id|drop-me|wid_pk/);
  });

  const discoveryPayload = {
    schemaVersion: 1,
    service: { name: 'w-storage' },
    project: { id: 'project_member' },
    capabilities: {
      objectCrud: true, bucketCrud: true, objectBrowser: true, multipartUploads: true, versioning: true, presignedUrls: true,
      lifecycle: false, quotas: false, managementQuotas: true, managementObjectVersions: true, managementObjectRestore: true, managementAudit: true,
      provider_secret: 'drop-me',
    },
    credential_ref: 'drop-me',
  };

  it('loads discovery capabilities without inventing lifecycle or leaking secrets', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(discoveryPayload));
    const result = await loadProjectStorageDiscovery(context, 'project_member', key, 'user-token', request);
    expect(result).toEqual({
      status: 'ready',
      data: {
        projectId: 'project_member',
        capabilities: {
          objectCrud: true, bucketCrud: true, objectBrowser: true, multipartUploads: true, versioning: true, presignedUrls: true,
          lifecycle: false, quotas: false, managementQuotas: true, managementObjectVersions: true, managementObjectRestore: true, managementAudit: true,
        },
      },
    });
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/discovery');
    expect(JSON.stringify(result)).not.toMatch(/provider_secret|credential_ref|drop-me|wid_pk|user-token/);
  });

  it('returns explicit unsupported lifecycle without calling the lifecycle endpoint when capability is false', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(discoveryPayload));
    await expect(loadProjectStorageLifecycle(context, 'project_member', 'private-files', key, 'user-token', request)).resolves.toEqual({
      status: 'ready',
      data: { bucket: 'private-files', supported: false, unavailableReason: 'lifecycle_capability_unavailable', rules: [] },
    });
    expect(request.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/workspaces/ws_member/projects/project_member/management-token',
      '/api/project-storage/storage/v1/projects/project_member/discovery',
    ]);
    const saveRejected = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(discoveryPayload));
    await expect(saveProjectStorageLifecycle(context, 'project_member', { bucket: 'private-files', rules: [{ id: 'expire-tmp', enabled: true, prefix: 'tmp/', expirationDays: 7, noncurrentExpirationDays: null }] }, key, 'user-token', saveRejected)).resolves.toMatchObject({ status: 'ready', data: { supported: false, rules: [] } });
    expect(saveRejected.mock.calls.some(([url]) => String(url).includes('/lifecycle'))).toBe(false);
  });

  it('lists and edits lifecycle rules only when discovery advertises lifecycle support', async () => {
    const supportedDiscovery = { ...discoveryPayload, capabilities: { ...discoveryPayload.capabilities, lifecycle: true } };
    const ruleWire = { id: 'expire-tmp', enabled: true, prefix: 'tmp/', expiration_days: 7, noncurrent_expiration_days: 3 };
    const listRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(supportedDiscovery))
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', rules: [ruleWire], provider_secret: 'drop-me' }));
    await expect(loadProjectStorageLifecycle(context, 'project_member', 'private-files', key, 'user-token', listRequest)).resolves.toEqual({
      status: 'ready',
      data: { bucket: 'private-files', supported: true, rules: [{ id: 'expire-tmp', enabled: true, prefix: 'tmp/', expirationDays: 7, noncurrentExpirationDays: 3 }] },
    });
    expect(listRequest.mock.calls[3]?.[0]).toBe('/api/project-storage/storage/v1/projects/project_member/management/buckets/private-files/lifecycle');
    const saveRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(supportedDiscovery))
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', rules: [ruleWire] }));
    await expect(saveProjectStorageLifecycle(context, 'project_member', { bucket: 'private-files', rules: [{ id: 'expire-tmp', enabled: true, prefix: 'tmp/', expirationDays: 7, noncurrentExpirationDays: 3 }] }, key, 'user-token', saveRequest)).resolves.toMatchObject({ status: 'ready', data: { supported: true, rules: [{ id: 'expire-tmp' }] } });
    expect(saveRequest.mock.calls[3]?.[1]?.method).toBe('PUT');
    expect(JSON.parse(String(saveRequest.mock.calls[3]?.[1]?.body))).toEqual({ rules: [ruleWire] });
    const clearRejected = vi.fn<typeof fetch>();
    await expect(clearProjectStorageLifecycle(context, 'project_member', 'private-files', 'PRIVATE-FILES', key, 'user-token', clearRejected)).resolves.toEqual({ status: 'invalid' });
    expect(clearRejected).not.toHaveBeenCalled();
    const clearRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(supportedDiscovery))
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(clearProjectStorageLifecycle(context, 'project_member', 'private-files', 'private-files', key, 'user-token', clearRequest)).resolves.toEqual({ status: 'ready', data: { bucket: 'private-files', supported: true, rules: [] } });
    const endpointMissing = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json(supportedDiscovery))
      .mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response('{}', { status: 501 }));
    await expect(loadProjectStorageLifecycle(context, 'project_member', 'private-files', key, 'user-token', endpointMissing)).resolves.toEqual({
      status: 'ready',
      data: { bucket: 'private-files', supported: false, unavailableReason: 'lifecycle_endpoint_unavailable', rules: [] },
    });
  });

  it('lists versions and restores only with exact version-id confirmation contracts', async () => {
    const versionId = 'c'.repeat(32);
    const versionsRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({
      bucket: 'private-files', path: 'folder/a.txt', versions: [
        { version_id: 'd'.repeat(32), size: 5, content_type: 'text/plain', modified: '2026-08-02T12:00:00Z', current: true },
        { version_id: versionId, size: 4, content_type: 'text/plain', modified: '2026-08-01T12:00:00Z', current: false, provider_secret: 'drop-me' },
      ],
    }));
    const versions = await loadProjectStorageVersions(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', versionsRequest);
    expect(versions).toMatchObject({
      status: 'ready',
      data: { bucket: 'private-files', path: 'folder/a.txt', versions: [{ versionId: 'd'.repeat(32), current: true }, { versionId, current: false }] },
    });
    expect(JSON.stringify(versions)).not.toMatch(/provider_secret|drop-me/);
    const badRestore = vi.fn<typeof fetch>();
    await expect(restoreProjectStorageVersion(context, 'project_member', 'private-files', 'folder/a.txt', 'not-hex', key, 'user-token', badRestore)).resolves.toEqual({ status: 'forbidden' });
    expect(badRestore).not.toHaveBeenCalled();
    const restoreRequest = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ version_id: versionId }));
    await expect(restoreProjectStorageVersion(context, 'project_member', 'private-files', 'folder/a.txt', versionId, key, 'user-token', restoreRequest)).resolves.toEqual({ status: 'ready', data: { versionId } });
    expect(restoreRequest.mock.calls[1]?.[0]).toContain('/objects/restore/folder/a.txt');
    expect(restoreRequest.mock.calls[1]?.[1]?.method).toBe('POST');
  });

  it('loads retained versions for deleted Unicode paths and rejects malformed or ambiguous version lists', async () => {
    const path = '已删除/文档 #1.txt';
    const version = { version_id: 'c'.repeat(32), size: 0, content_type: 'text/plain', modified: '2026-08-02T12:00:00Z', current: false };
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', path, versions: [version], truncated: true }));
    const controller = new AbortController();
    await expect(loadProjectStorageVersions(context, 'project_member', 'private-files', path, key, 'user-token', request, controller.signal)).resolves.toMatchObject({ status: 'ready', data: { path, truncated: true, versions: [{ versionId: version.version_id, current: false, size: 0 }] } });
    expect(request.mock.calls[1]?.[0]).toContain('/objects/versions/%E5%B7%B2%E5%88%A0%E9%99%A4/%E6%96%87%E6%A1%A3%20%231.txt');
    expect(request.mock.calls[1]?.[1]?.signal).toBe(request.mock.calls[0]?.[1]?.signal);
    controller.abort(); expect(request.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    for (const versions of [[version, version], [{ ...version, size: -1 }], [{ ...version, size: 0.5 }], [{ ...version, version_id: '../wrong' }], [{ ...version, current: 'false' }], [{ ...version, current: true }, { ...version, version_id: 'd'.repeat(32), current: true }], Array.from({ length: 101 }, () => version)]) {
      const invalid = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ bucket: 'private-files', path, versions }));
      await expect(loadProjectStorageVersions(context, 'project_member', 'private-files', path, key, 'user-token', invalid)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('rejects unsafe recovery paths and prevents reads or restores after cancelled authorization', async () => {
    const rejected = vi.fn<typeof fetch>();
    for (const path of ['folder/../private.txt', './private.txt', '中'.repeat(342)]) {
      await expect(loadProjectStorageVersions(context, 'project_member', 'private-files', path, key, 'user-token', rejected)).resolves.toEqual({ status: 'forbidden' });
      await expect(restoreProjectStorageVersion(context, 'project_member', 'private-files', path, 'c'.repeat(32), key, 'user-token', rejected)).resolves.toEqual({ status: 'forbidden' });
    }
    expect(rejected).not.toHaveBeenCalled();
    for (const restore of [false, true]) {
      const controller = new AbortController();
      const late = vi.fn<typeof fetch>().mockImplementation(async () => { controller.abort(); return exchange(managementToken()); });
      const result = restore ? restoreProjectStorageVersion(context, 'project_member', 'private-files', 'gone.txt', 'c'.repeat(32), key, 'user-token', late, controller.signal) : loadProjectStorageVersions(context, 'project_member', 'private-files', 'gone.txt', key, 'user-token', late, controller.signal);
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(late).toHaveBeenCalledTimes(1);
    }
  });

  it('binds upload links to the selected object and fixes issuance overwrite permission', async () => {
    const path = 'folder/雪 %2F +.txt'; const token = 'c'.repeat(32);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ url: `/object/upload/sign/private-files/${path.split('/').map(encodeURIComponent).join('/')}?token=${token}`, ignored: 'unknown field' }));
    const controller = new AbortController();
    await expect(createProjectStorageUploadLink(context, 'project_member', 'private-files', path, false, key, 'user-token', request, controller.signal)).resolves.toEqual({ status: 'ready', data: { url: `/api/project-storage/storage/v1/projects/project_member/supabase/object/upload/sign/private-files/${path.split('/').map(encodeURIComponent).join('/')}?token=${token}` } });
    expect(request.mock.calls[1]?.[0]).toContain('/project_member/supabase/object/upload/sign/private-files/folder/');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: '{}', headers: { 'x-upsert': 'false', apikey: key } });
    const signal = request.mock.calls[1]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal); controller.abort(); expect(signal?.aborted).toBe(true);
  });

  it('rejects unsafe upload targets and mismatched, malformed, or substituted link receipts', async () => {
    const request = vi.fn<typeof fetch>();
    for (const path of ['', 'folder/../private.txt', '雪'.repeat(342)]) await expect(createProjectStorageUploadLink(context, 'project_member', 'private-files', path, false, key, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    expect(request).not.toHaveBeenCalled();
    for (const url of [
      'https://provider.example/object/upload/sign/private-files/file.txt?token='+ 'c'.repeat(32),
      '/object/upload/sign/other/file.txt?token='+ 'c'.repeat(32),
      '/object/upload/sign/private-files/other.txt?token='+ 'c'.repeat(32),
      '/object/upload/sign/private-files/file.txt?token=invalid',
      '/object/upload/sign/private-files/file.txt?token='+ 'c'.repeat(32)+'&token='+ 'd'.repeat(32),
      '/object/upload/sign/private-files/file.txt?token='+ 'c'.repeat(32)+'#fragment',
      '/object/upload/sign/private-files/%FF?token='+ 'c'.repeat(32),
      '/storage/v1/signed/'+ 'c'.repeat(32),
    ]) {
      const response = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ url }));
      await expect(createProjectStorageUploadLink(context, 'project_member', 'private-files', 'file.txt', true, key, 'user-token', response)).resolves.toEqual({ status: 'invalid' });
    }
    const late = vi.fn<typeof fetch>(); const controller = new AbortController(); controller.abort();
    await expect(createProjectStorageUploadLink(context, 'project_member', 'private-files', 'file.txt', false, key, 'user-token', late, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(late).not.toHaveBeenCalled();
  });

  it('accepts only allowlisted signed-url expiry values and keeps default 300s', async () => {
    expect(PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS).toEqual([60, 300, 900, 3600]);
    await expect(signProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', vi.fn<typeof fetch>(), 120 as never)).resolves.toEqual({ status: 'invalid' });
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ signedUrl: `/storage/v1/signed/${'e'.repeat(32)}`, expiresAtUnix: expiresAt }));
    await expect(signProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', request, 900)).resolves.toEqual({ status: 'ready', data: { url: `/api/project-storage/storage/v1/signed/${'e'.repeat(32)}`, expiresAt } });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ path: 'folder/a.txt', expires_in: 900 });
    vi.useRealTimers();
  });

  it('rejects signed receipts with invalid browser dates or unsafe link targets', async () => {
    for (const expiresAtUnix of [0, -1, 8_640_000_000_001, Number.MAX_SAFE_INTEGER, 1.5, '123']) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ signedUrl: `/storage/v1/signed/${'e'.repeat(32)}`, expiresAtUnix }));
      await expect(signProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
    for (const signedUrl of ['https://provider.example/private', '//other.example/read', '/storage/v1/signed/../private']) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(Response.json({ signedUrl, expiresAtUnix: Math.floor(Date.now() / 1000) + 300 }));
      await expect(signProjectStorageObject(context, 'project_member', 'private-files', 'folder/a.txt', key, 'user-token', request)).resolves.toEqual({ status: 'invalid' });
    }
  });

  it('fails closed for cross-project membership and revoked-key denials on Storage surfaces', async () => {
    const foreign = vi.fn<typeof fetch>();
    await expect(loadProjectStorageDiscovery(context, 'project_foreign', key, 'user-token', foreign)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectStorageLifecycle(context, 'project_foreign', 'private-files', key, 'user-token', foreign)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectStorageUsage(context, 'project_foreign', 'private-files', key, 'user-token', foreign)).resolves.toEqual({ status: 'forbidden' });
    expect(foreign).not.toHaveBeenCalled();
    const revoked = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange(managementToken())).mockResolvedValueOnce(new Response('{}', { status: 403 }));
    await expect(loadProjectStorageDiscovery(context, 'project_member', 'wid_pk_revoked', 'user-token', revoked)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectStorageAudit(context, 'project_member', key, null, vi.fn<typeof fetch>())).resolves.toEqual({ status: 'auth' });
  });

  it('keeps Storage UI browser state free of durable storage and secret logging with lifecycle and a11y gates', () => {
    expect(storageComponentSource).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)|provider_secret|credential_ref/);
    expect(storageComponentSource).toContain('typeBucketId');
    expect(storageComponentSource).toContain('typeObjectPath');
    expect(storageComponentSource).toContain('typeVersionId');
    expect(storageComponentSource).toContain('loadProjectStorageLifecycle');
    expect(storageComponentSource).toContain('loadProjectStorageDiscovery');
    expect(storageComponentSource).toContain('storageLifecycleUnsupported');
    expect(storageComponentSource).toContain('PROJECT_STORAGE_SIGNED_EXPIRES_OPTIONS');
    expect(storageComponentSource).toContain('role="alertdialog"');
    expect(storageComponentSource).toContain('aria-live="polite"');
    expect(storageComponentSource).toContain('restoreConfirmation !== version.versionId');
    expect(storageComponentSource).toContain('lifecycleClearConfirmation !== selectedBucket');
    expect(storageComponentSource).toContain('bucketDeleteConfirmation !== editingBucket');
    expect(storageComponentSource).toContain('objectDeleteConfirmation !== objectDelete.path');
  });
});

describe('route compatibility', () => {
  it('keeps homepage, usage, marketing product, and console routes', () => {
    expect(parsePath('/').page.kind).toBe('home');
    expect(parsePath('/products').page.kind).toBe('home');
    expect(parsePath('/w-id').page.kind).toBe('product');
    expect(parsePath('/console').page.kind).toBe('console');
    expect(parsePath('/console/projects/project_member')).toMatchObject({
      routePath: '/console/projects/project_member',
      page: { kind: 'console', projectId: 'project_member' },
    });
    expect(parsePath('/zh/console/projects/project_member')).toMatchObject({
      lang: 'zh',
      page: { kind: 'console', projectId: 'project_member' },
    });
    expect(parsePath('/console/projects/../../admin').page.kind).toBe('notFound');
    expect(parsePath('/zh/console/projects/project_member/observability')).toMatchObject({ lang: 'zh', page: { kind: 'console', projectId: 'project_member', surface: 'observability' } });
    expect(parsePath('/zh/console/projects/project_member/backups')).toMatchObject({ lang: 'zh', page: { kind: 'console', projectId: 'project_member', surface: 'backups' } });

    const home = render('/').html;
    expect(home).toContain('id="products"');
    expect(home).toContain('Products you use');
    expect(home).toContain('Membership');
    expect(render('/w-id').html).toContain('Open product');
    expect(render('/console').html).toContain('Loading your verified SaaS context');
  });
});


describe('atomic project table import', () => {
  const context = normalizeSaasContext(memberFixture);
  const rows = [{ title: '', score: 0, done: false, payload: null }, { title: '中文', payload: { values: [0, false, null] } }];
  const receipt = { schema_version: 'w-db.row-batch-mutation/v1', operation: 'insert_batch', mutation_id: '00000000-0000-0000-0000-000000000001', schema: 'public', table: 'todos', affected_rows: 2, rows };
  const authorize = () => Response.json({ access_token: projectJwt('project_member', Math.floor(Date.now() / 1000) + 300), token_type: 'Bearer', expires_in: 300 });
  const call = (request: typeof fetch, values = rows, signal?: AbortSignal) => importProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', values, request, signal);

  it('preserves typed values and rejects malformed or oversized batches before authorization', async () => {
    expect(parseProjectTableImport(JSON.stringify(rows))).toEqual(rows);
    expect(Object.hasOwn(parseProjectTableImport(JSON.stringify(rows))![1]!, 'score')).toBe(false);
    expect(parseProjectTableImport(JSON.stringify(Array.from({ length: 100 }, () => ({ title: 'ok' }))))).toHaveLength(100);
    for (const input of ['{', '{}', '[]', '[null]', '[[]]', '[{}]', '[1]', JSON.stringify(Array.from({ length: 101 }, () => ({ title: 'ok' }))), JSON.stringify([{ title: '中'.repeat(11000) }]), JSON.stringify([Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['col' + i, i]))]), ' '.repeat(1_048_577)]) expect(parseProjectTableImport(input)).toBeNull();
    const request = vi.fn<typeof fetch>();
    expect(await call(request, [])).toEqual({ status: 'invalid' });
    expect(await importProjectTableRows(context, 'project_foreign', 'public', 'todos', 'wid_pk_console', 'identity', rows, request)).toEqual({ status: 'forbidden' });
    expect(await importProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', null, rows, request)).toEqual({ status: 'auth' });
    expect(await importProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_sk_server', 'identity', rows, request)).toEqual({ status: 'locked' });
    expect(request).not.toHaveBeenCalled();
  });

  it('uses fresh exact-project management authorization and submits exactly one batch', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => authorize()).mockResolvedValueOnce(Response.json({ ...receipt, unknown_future_field: 'ignored' }));
    expect(await call(request, rows, signal)).toEqual({ status: 'ready', data: { mutationId: receipt.mutation_id, schema: 'public', table: 'todos', affectedRows: 2 } });
    expect(request.mock.calls).toHaveLength(2);
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_member/projects/project_member/management-token');
    const [url, init] = request.mock.calls[1]!;
    expect(url).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows/batch');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', signal });
    expect(new Headers(init?.headers).get('apikey')).toBe('wid_pk_console');
    expect(JSON.parse(String(init?.body))).toEqual({ rows });
  });

  it('retains definite rejection versus uncertain commit outcomes without retrying', async () => {
    for (const [http, status] of [[400, 'invalid'], [413, 'invalid'], [401, 'auth'], [403, 'forbidden'], [404, 'unsupported'], [405, 'unsupported'], [501, 'unsupported'], [503, 'unknown']] as const) {
      const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => authorize()).mockResolvedValueOnce(new Response('{}', { status: http }));
      expect(await call(request)).toEqual({ status }); expect(request.mock.calls).toHaveLength(2);
    }
    for (const payload of [{ ...receipt, affected_rows: 1 }, { ...receipt, table: 'other' }, { ...receipt, schema: 'private' }, { ...receipt, rows: [rows[0]] }, { ...receipt, rows: [null, null] }, { ...receipt, mutation_id: '' }, {}]) {
      const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => authorize()).mockResolvedValueOnce(Response.json(payload));
      expect(await call(request)).toEqual({ status: 'unknown' }); expect(request.mock.calls).toHaveLength(2);
    }
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => authorize()).mockRejectedValueOnce(new TypeError('network'));
    expect(await call(request)).toEqual({ status: 'unknown' }); expect(request.mock.calls).toHaveLength(2);
  });

  it('never posts after cancellation during the management-token exchange', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => { controller.abort(); return authorize(); });
    await expect(call(request, rows, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request.mock.calls).toHaveLength(1);
  });
});


describe('server-filtered table pages', () => {
  const context = normalizeSaasContext(memberFixture);
  const query = { filters: [{ column: 'done', operator: 'eq' as const, value: false }], order: { column: 'title', descending: true, nullsFirst: false } };
  const authorize = () => Response.json({ access_token: projectJwt('project_member', Math.floor(Date.now() / 1000) + 300), token_type: 'Bearer', expires_in: 300 });
  it('preserves typed filters and sorting on every page and exact-count request', async () => {
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => authorize()).mockResolvedValueOnce(Response.json({ schema: 'public', table: 'todos', limit: 25, offset: 25, has_more: false, next_offset: null, total_rows: 28, rows: [{ id: 26 }, { id: 27 }, { id: 28 }] }));
    expect(await loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', request, new AbortController().signal, 25, true, query)).toMatchObject({ status: 'ready', data: { totalRows: 28, rows: [{ id: 26 }, { id: 27 }, { id: 28 }] } });
    const url = new URL(String(request.mock.calls[1]?.[0]), 'https://example.test');
    expect(url.searchParams.get('offset')).toBe('25'); expect(url.searchParams.get('count')).toBe('exact');
    expect(JSON.parse(url.searchParams.get('filters')!)).toEqual(query.filters); expect(url.searchParams.get('order')).toBe('title.desc.nullslast');
  });
  it('rejects invalid query before auth and prevents a late read after cancellation', async () => {
    const rejected = vi.fn<typeof fetch>();
    expect(await loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', rejected, new AbortController().signal, 0, false, { filters: [{ column: 'done', operator: 'eq', value: null }] })).toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => { controller.abort(); return authorize(); });
    await expect(loadProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', request, controller.signal, 0, false, query)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request.mock.calls).toHaveLength(1);
  });
});


it('accepts bounded literal catalog column names in row edits/imports and rejects unsafe identifiers', () => {
  const row = { '中文.列 "quoted"': '', 'single\'quote !*()': false, value: 0, nested: { 'any/key': [false, null] } };
  expect(parseProjectRowValues(JSON.stringify(row))).toEqual(row);
  expect(parseProjectTableImport(JSON.stringify([row]))).toEqual([row]);
  for (const name of ['', '.', '..', 'bad/name', 'bad\\name', 'bad\nname', '汉'.repeat(22), '\uD800']) {
    expect(parseProjectRowValues(JSON.stringify({ [name]: 1 }))).toBeNull();
    expect(parseProjectTableImport(JSON.stringify([{ [name]: 1 }]))).toBeNull();
  }
});

it('does not send a row mutation after a cancelled management exchange returns late', async () => {
  const controller = new AbortController();
  const request = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
    controller.abort();
    return Response.json({ access_token: projectJwt('project_member', Math.floor(Date.now() / 1000) + 300), token_type: 'Bearer', expires_in: 300 });
  });
  await expect(mutateProjectTableRow(normalizeSaasContext(memberFixture), 'project_member', 'public', 'todos', 'wid_pk_once_123', 'identity', { operation: 'insert', values: { '标题': '中文' } }, request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).toHaveBeenCalledTimes(1);
});

describe('atomic selected-row deletion', () => {
  const context = normalizeSaasContext(memberFixture);
  const rows = [{ id: '1', expected: { id: 1, title: '雪' } }, { id: '2', expected: { id: 2, title: '' } }];
  const receipt = { schema_version: 'w-db.row-batch-mutation/v1', operation: 'delete_batch', mutation_id: '00000000-0000-0000-0000-000000000001', schema: 'public', table: 'todos', affected_rows: 2, rows: rows.map(row => row.expected) };
  const token = () => projectJwt('project_member', Math.floor(Date.now() / 1000) + 300);
  const exchange = () => Response.json({ access_token: token(), token_type: 'Bearer', expires_in: 300 });
  const call = (request: typeof fetch, signal?: AbortSignal) => deleteProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', rows, request, signal);
  it('exchanges one current exact-project grant and sends one atomic bounded POST', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(Response.json({ ...receipt, credential_ref: 'must-not-return' }));
    expect(await call(request, controller.signal)).toEqual({ status: 'ready', data: { mutationId: receipt.mutation_id, schema: 'public', table: 'todos', affectedRows: 2 } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_member/database/tables/public/todos/rows/batch');
    const init = request.mock.calls[1]?.[1];
    expect(init?.method).toBe('POST'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('same-origin');
    expect(init?.signal).toBe(controller.signal); expect(request.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(JSON.parse(String(init?.body))).toEqual({ operation: 'delete_batch', rows });
    expect(new Headers(init?.headers).get('authorization')).toMatch(/^Bearer /);
  });
  it('rejects foreign membership, missing auth, duplicates and unbounded snapshots before reading a grant', async () => {
    const request = vi.fn<typeof fetch>();
    expect(await deleteProjectTableRows(context, 'project_foreign', 'public', 'todos', 'wid_pk_console', 'identity', rows, request)).toEqual({ status: 'forbidden' });
    expect(await deleteProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', null, rows, request)).toEqual({ status: 'auth' });
    for (const invalid of [[], [rows[0]!, rows[0]!], [{ id: '', expected: { id: 1 } }], [{ id: '1', expected: {} }], Array.from({ length: 101 }, (_, index) => ({ id: String(index), expected: { id: index } }))]) {
      expect(await deleteProjectTableRows(context, 'project_member', 'public', 'todos', 'wid_pk_console', 'identity', invalid, request)).toEqual({ status: 'invalid' });
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('distinguishes stale, unsupported and uncertain results without retries or raw errors', async () => {
    for (const [code, status] of [[412, 'stale'], [404, 'unsupported'], [400, 'invalid'], [403, 'forbidden'], [503, 'unknown']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(new Response('private-provider-error', { status: code }));
      expect(await call(request)).toEqual({ status }); expect(request).toHaveBeenCalledTimes(2);
    }
    for (const invalid of [{ ...receipt, affected_rows: 1 }, { ...receipt, operation: 'insert_batch' }, { ...receipt, table: 'foreign' }, { ...receipt, rows: [] }]) {
      expect(await call(vi.fn<typeof fetch>().mockResolvedValueOnce(exchange()).mockResolvedValueOnce(Response.json(invalid)))).toEqual({ status: 'unknown' });
    }
    expect(await call(vi.fn<typeof fetch>().mockResolvedValueOnce(exchange()).mockRejectedValueOnce(new Error('private-network-details')))).toEqual({ status: 'unknown' });
  });
});

describe('loaded Function audit downloads', () => {
  const context = normalizeSaasContext(memberFixture);
  const filters = { state: '', event: '', requestId: '', from: '', until: '' };
  const detail: ProjectFunctionDetail = {
    summary: { slug: 'echo', activeVersion: 2, auth: 'user', sourceSha256: 'private-source-digest', state: 'active', createdAt: '2026-10-03T00:00:00Z' },
    versions: [], traceId: 'applied-trace', nextBeforeId: 7,
    logs: [
      { id: 9, version: 2, event: 'invoked', state: 'succeeded', occurredAt: '2026-10-03T08:00:00+08:00', requestId: 'req_9', traceId: 'applied-trace' },
      { id: 8, version: 1, event: 'deployed', state: 'failed', occurredAt: '2026-10-02T23:00:00Z', failureCode: 'build_failed' },
    ],
  };
  it('captures the applied trace, loaded boundary and selected event metadata without source or transport fields', () => {
    const extra = { ...detail, logs: detail.logs.map(log => ({ ...log, stdout: 'private-runtime-output', authorization: 'private-credential', source: 'private-source' })) };
    const exported = JSON.parse(serializeProjectFunctionAudit(context, 'project_member', extra, { ...filters, event: 'INVOK' }, 'json'));
    expect(exported).toMatchObject({ schema_version: 'w-console.function-audit/v1', project_id: 'project_member', function_slug: 'echo', trace_id: 'applied-trace', retained_count: 2, exported_count: 1, retained_limit: 200, next_before_id: 7, has_more: true, events: [{ id: 9, version: 2, occurred_at: '2026-10-03T08:00:00+08:00', request_id: 'req_9' }] });
    expect(JSON.stringify(exported)).not.toMatch(/private-|stdout|authorization|sourceSha256|versions/);
    expect(detail.logs[0].occurredAt).toBe('2026-10-03T08:00:00+08:00');
    const precise = { ...detail, logs: [{ ...detail.logs[0], occurredAt: '2026-10-03 00:00:00.123456+00' }] };
    expect(JSON.parse(serializeProjectFunctionAudit(context, 'project_member', precise, filters, 'json')).events[0].occurred_at).toBe(precise.logs[0].occurredAt);
  });
  it('uses the same inclusive time, state, event and correlation filters as the visible list', () => {
    const query = { ...filters, state: 'succeeded', event: 'INVOKED', requestId: '9', from: '2026-10-02T17:00:00-07:00', until: '2026-10-03T00:00:00Z' };
    expect(filterProjectFunctionAudit(detail.logs, query)).toEqual([detail.logs[0]]);
    const exported = JSON.parse(serializeProjectFunctionAudit(context, 'project_member', detail, query, 'json'));
    expect(exported.filter_from).toBe('2026-10-03T00:00:00.000Z');
    expect(exported.filter_until).toBe(exported.filter_from);
    expect(exported.exported_count).toBe(1);
    expect(filterProjectFunctionAudit(detail.logs, { ...query, requestId: 'req_9' })).toHaveLength(1);
    expect(filterProjectFunctionAudit(detail.logs, { ...query, state: 'failed' })).toEqual([]);
  });
  it('exports empty matches and the 200-event cap without claiming the whole server history', () => {
    const capped = { ...detail, logs: Array.from({ length: 200 }, (_, n) => ({ ...detail.logs[0], id: n + 1 })), nextBeforeId: 1 };
    const empty = JSON.parse(serializeProjectFunctionAudit(context, 'project_member', capped, { ...filters, event: 'not-loaded' }, 'json'));
    expect(empty).toMatchObject({ retained_count: 200, exported_count: 0, has_more: true, next_before_id: 1, events: [] });
    const csv = serializeProjectFunctionAudit(context, 'project_member', { ...detail, logs: [], nextBeforeId: null }, filters, 'csv');
    expect(csv).toContain('"exported_count"'); expect(csv).toContain('"0"'); expect(csv.split('\r\n')).toHaveLength(3);
  });
  it('redacts sensitive-looking metadata, drops private fields and escapes quoted Unicode and formula text in CSV', () => {
    const snapshot = { ...detail, traceId: 'wid_sk_synthetic', logs: [{ ...detail.logs[0], event: '=SUM(1,2)', state: '中文,"quoted"\nline', failureCode: 'password=synthetic', requestId: 'wid_pk_synthetic', traceId: 'wid_sk_synthetic' }] };
    const json = serializeProjectFunctionAudit(context, 'project_member', snapshot, filters, 'json');
    expect(json).not.toContain('synthetic'); expect(json).toContain('[REDACTED]');
    const csv = serializeProjectFunctionAudit(context, 'project_member', snapshot, filters, 'csv');
    expect(csv).toContain('"\'=SUM(1,2)"'); expect(csv).toContain('"中文,""quoted""\nline"');
    expect(csv).toContain('"event_trace_id"'); expect(csv).not.toContain('synthetic');
  });
  it('refuses unauthorized, ambiguous, oversized or invalid export snapshots', () => {
    for (const project of ['project_foreign', 'missing']) expect(() => serializeProjectFunctionAudit(context, project, detail, filters, 'json')).toThrow();
    for (const snapshot of [{ ...detail, summary: { ...detail.summary, slug: '../other' } }, { ...detail, logs: [detail.logs[0], detail.logs[0]] }, { ...detail, logs: Array.from({ length: 201 }, (_, n) => ({ ...detail.logs[0], id: n + 1 })) }, { ...detail, nextBeforeId: 0 }, { ...detail, logs: [{ ...detail.logs[0], id: Number.MAX_SAFE_INTEGER + 1 }] }, { ...detail, logs: [{ ...detail.logs[0], occurredAt: 'invalid' }] }, { ...detail, logs: [{ ...detail.logs[0], version: 1.5 }] }]) expect(() => serializeProjectFunctionAudit(context, 'project_member', snapshot, filters, 'json')).toThrow();
    expect(() => serializeProjectFunctionAudit(context, 'project_member', detail, { ...filters, from: 'invalid' }, 'json')).toThrow();
  });
});
