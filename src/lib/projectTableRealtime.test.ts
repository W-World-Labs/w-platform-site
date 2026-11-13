import { describe, expect, it, vi } from 'vitest';
import { parseProjectTableRealtime } from './projectTableRealtime';
import { manageProjectTableRealtime, type SaasContext } from './saasConsole';

const context: SaasContext = { schemaVersion: 1, self: { userId: 'usr_1' }, authorityPlanes: { platformRole: 'member', workspaceMemberships: [{ id: 'ws_1', name: 'workspace', role: 'owner', tier: 'pro' }], appUserRelationships: [] }, console: { projects: [{ id: 'project_1', workspaceId: 'ws_1', workspaceRole: 'owner', name: 'project' }] } };
const table = '表"events';
const receipt = (desired = false, effective = desired) => ({ schema_version: 'w-db.table-realtime/v1', project_id: 'project_1', schema: 'public', table, source: desired ? 'managed' : 'none', desired_enabled: desired, effective_enabled: effective, status: desired !== effective ? 'degraded' : effective ? 'enabled' : 'disabled' });
const grant = () => { const issuedAt = Math.floor(Date.now() / 1000); return Response.json({ token_type: 'Bearer', expires_in: 60, access_token: `e30.${btoa(JSON.stringify({ aud: 'project_1', iat: issuedAt, exp: issuedAt + 60 })).replaceAll('=', '')}.sig` }); };
const call = (request: typeof fetch, enabled: boolean | null = null, signal?: AbortSignal) => manageProjectTableRealtime(context, 'project_1', 'public', table, 'wid_pk_fixture', 'identity', enabled, request, signal);

describe('managed table Realtime', () => {
  it('projects exact scoped desired/effective states without retaining backend internals', () => {
    expect(parseProjectTableRealtime({ ...receipt(true, false), publication_name: 'private', credential: 'discard' }, 'project_1', 'public', table)).toEqual({ projectId: 'project_1', schema: 'public', table, source: 'managed', desiredEnabled: true, effectiveEnabled: false, status: 'degraded' });
    for (const value of [{ ...receipt(), project_id: 'foreign' }, { ...receipt(), table: 'other' }, { ...receipt(true, false), status: 'enabled' }, { ...receipt(), desired_enabled: 'false' }, { ...receipt(true), source: 'none' }]) expect(parseProjectTableRealtime(value, 'project_1', 'public', table)).toBeNull();
  });
  it('reads and enables a quoted Unicode table with fresh authority, no cache and a shared deadline', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(grant()).mockResolvedValueOnce(Response.json(receipt())).mockResolvedValueOnce(grant()).mockResolvedValueOnce(Response.json(receipt(true)));
    expect(await call(request, null, signal)).toMatchObject({ status: 'ready', data: { status: 'disabled' } });
    expect(await call(request, true, signal)).toMatchObject({ status: 'ready', data: { status: 'enabled' } });
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('/management-token'))).toHaveLength(2);
    const [, options] = request.mock.calls[3];
    expect(request.mock.calls[3][0]).toBe('/api/project-data/v1/projects/project_1/database/tables/public/%E8%A1%A8%22events/realtime');
    expect(options).toMatchObject({ method: 'PUT', body: '{"enabled":true}', credentials: 'same-origin', cache: 'no-store', signal });
    expect(new Headers(options?.headers).get('apikey')).toBe('wid_pk_fixture');
    expect(new Headers(options?.headers).get('authorization')).not.toBe('Bearer identity');
    expect(request.mock.calls[0][1]).toMatchObject({ signal });
  });
  it('retains authoritative degraded receipts for an explicit retry instead of claiming success', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(grant()).mockResolvedValueOnce(Response.json(receipt(true, false)));
    expect(await call(request, true)).toMatchObject({ status: 'ready', data: { desiredEnabled: true, effectiveEnabled: false, status: 'degraded' } });
  });
  it('treats lost, malformed and wrong-desired write receipts as unknown and never replays', async () => {
    for (const response of [new Response('{}', { status: 503 }), Response.json(receipt(false)), Response.json({ ...receipt(true), project_id: 'foreign' }), new Response('invalid-json')]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(grant()).mockResolvedValueOnce(response);
      expect(await call(request, true)).toEqual({ status: 'unknown' }); expect(request).toHaveBeenCalledTimes(2);
    }
    const read = vi.fn<typeof fetch>().mockResolvedValueOnce(grant()).mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect(await call(read)).toEqual({ status: 'network' });
  });
  it('handles unavailable/unpublished/conflicting/rejected authority without false receipts', async () => {
    for (const [code, status] of [[401, 'auth'], [403, 'forbidden'], [404, 'unpublished'], [405, 'unsupported'], [409, 'conflict'], [422, 'invalid']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(grant()).mockResolvedValueOnce(new Response('{}', { status: code }));
      expect(await call(request, true)).toEqual({ status });
    }
  });
  it('prevents foreign-project calls and late authorization from reaching table writes', async () => {
    const request = vi.fn<typeof fetch>();
    expect(await manageProjectTableRealtime(context, 'foreign', 'public', table, 'wid_pk_fixture', 'identity', true, request)).toEqual({ status: 'forbidden' });
    expect(await manageProjectTableRealtime(context, 'project_1', 'public', '../table', 'wid_pk_fixture', 'identity', true, request)).toEqual({ status: 'forbidden' });
    expect(request).not.toHaveBeenCalled();
    const abort = new AbortController();
    request.mockImplementationOnce(async () => { abort.abort(); return grant(); });
    await expect(call(request, true, abort.signal)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
