import { describe, expect, it, vi } from 'vitest';
import { manageProjectTablePublication, type SaasContext } from './saasConsole';
import { parseProjectTablePublication, projectPublicationColumnKind, projectTablePublicationMatches, validProjectTablePublicationInput, type ProjectTablePublicationInput } from './projectTablePublication';

const context: SaasContext = { schemaVersion: 1, self: { userId: 'alice' }, authorityPlanes: { platformRole: 'admin', workspaceMemberships: [{ id: 'ws_a', name: 'A', role: 'owner', tier: 'pro' }], appUserRelationships: [] }, console: { projects: [{ id: 'project_a', workspaceId: 'ws_a', name: 'A', workspaceRole: 'owner' }, { id: 'project_b', workspaceId: 'ws_b', name: 'B', workspaceRole: 'owner' }] } };
const table = '客户 "记录" \'!*()';
const input: ProjectTablePublicationInput = { ownerColumn: 'owner_id', maxRows: 25, columns: [{ name: 'id', writable: true }, { name: 'owner_id', writable: false }, { name: '客户.标题', writable: true }] };
const receipt = () => ({ schema_version: 'w-db.table-publication/v1', project_id: 'project_a', schema: 'public', table, published: true, source: 'managed', publication: { primary_key: 'id', owner_column: 'owner_id', max_rows: 25, columns: [{ name: 'id', kind: 'integer', nullable: false, writable: false }, { name: 'owner_id', kind: 'text', nullable: false, writable: false }, { name: '客户.标题', kind: 'text', nullable: false, writable: true }] } });
function management(project = 'project_a') {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const issuedAt = Math.floor(Date.now() / 1000);
  return Response.json({ token_type: 'Bearer', expires_in: 300, access_token: `${encode({ alg: 'HS256' })}.${encode({ aud: project, exp: issuedAt + 300, iat: issuedAt })}.signature` });
}
const call = (request: typeof fetch, operation: 'GET' | 'PUT' | 'DELETE' = 'PUT', signal?: AbortSignal) => manageProjectTablePublication(context, 'project_a', 'public', table, 'wid_pk_fixture', 'identity', operation, operation === 'PUT' ? input : null, request, signal);

describe('project table REST publication', () => {
  it('supports only current REST types, including text typmods', () => {
    for (const type of ['text', 'character varying(120)', 'character(2)', 'name']) expect(projectPublicationColumnKind(type)).toBe('text');
    expect(projectPublicationColumnKind('bigint')).toBe('integer');
    expect(projectPublicationColumnKind('jsonb')).toBe('json');
    expect(projectPublicationColumnKind('tsvector')).toBe('tsvector');
    for (const type of ['numeric', 'date', 'timestamp with time zone', 'text[]']) expect(projectPublicationColumnKind(type)).toBeNull();
  });
  it('bounds columns/UTF-8 names/rows and requires a selected read-only owner', () => {
    expect(validProjectTablePublicationInput(input)).toBe(true);
    for (const maxRows of [0, 1001, NaN, 1.5]) expect(validProjectTablePublicationInput({ ...input, maxRows })).toBe(false);
    for (const columns of [[], [...input.columns, input.columns[0]!], input.columns.filter(c => c.name !== 'owner_id'), input.columns.map(c => ({ ...c, writable: true })), [...input.columns, { name: '中'.repeat(22), writable: false }]]) expect(validProjectTablePublicationInput({ ...input, columns })).toBe(false);
    expect(validProjectTablePublicationInput({ ...input, ownerColumn: '../owner' })).toBe(false);
  });
  it('checks exact receipt scope and strips unknown provider fields', () => {
    const parsed = parseProjectTablePublication({ ...receipt(), credentials: 'must-not-return', publication: { ...receipt().publication, secret: 'must-not-return' } }, 'project_a', 'public', table)!;
    expect(projectTablePublicationMatches(parsed, input)).toBe(true);
    expect(JSON.stringify(parsed)).not.toContain('must-not-return');
    for (const change of [{ project_id: 'project_b' }, { table: 'other' }, { schema_version: 'other' }, { source: 'none' }]) expect(parseProjectTablePublication({ ...receipt(), ...change }, 'project_a', 'public', table)).toBeNull();
    for (const change of [{ primary_key: 'missing' }, { owner_column: 'id' }, { columns: receipt().publication.columns.map(c => ({ ...c, writable: true })) }, { columns: [...receipt().publication.columns, receipt().publication.columns[0]] }]) expect(parseProjectTablePublication({ ...receipt(), publication: { ...receipt().publication, ...change } }, 'project_a', 'public', table)).toBeNull();
  });
  it('accepts published tsvector columns while keeping owner and primary-key rules intact', () => {
    const payload = receipt();
    payload.publication.columns.push({ name: 'search_vector', kind: 'tsvector', nullable: true, writable: true });
    const parsed = parseProjectTablePublication(payload, 'project_a', 'public', table);
    expect(parsed?.publication?.columns.at(-1)).toEqual({ name: 'search_vector', kind: 'tsvector', nullable: true, writable: true });
  });
  it('uses fresh exact-project authority and preserves escaped Unicode path identifiers', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockResolvedValueOnce(Response.json(receipt()));
    expect((await call(request)).status).toBe('ready');
    expect(request.mock.calls[0]?.[0]).toBe('/api/workspaces/ws_a/projects/project_a/management-token');
    expect(request.mock.calls[1]?.[0]).toBe('/api/project-data/v1/projects/project_a/database/tables/public/%E5%AE%A2%E6%88%B7%20%22%E8%AE%B0%E5%BD%95%22%20%27%21%2A%28%29/publication');
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', cache: 'no-store', credentials: 'same-origin', headers: { apikey: 'wid_pk_fixture' } });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ owner_column: input.ownerColumn, columns: input.columns, max_rows: input.maxRows });
  });
  it('does not mistake a different successful configuration for its write receipt', async () => {
    for (const change of [{ max_rows: 99 }, { columns: receipt().publication.columns.map(c => c.name === '客户.标题' ? { ...c, writable: false } : c) }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockResolvedValueOnce(Response.json({ ...receipt(), publication: { ...receipt().publication, ...change } }));
      expect(await call(request)).toEqual({ status: 'unknown' });
    }
  });
  it('distinguishes a failed authorization exchange from uncertain writes without retry', async () => {
    const before = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network'));
    expect(await call(before)).toEqual({ status: 'network' }); expect(before).toHaveBeenCalledTimes(1);
    for (const response of [new Response('', { status: 503 }), Response.json({ wrong: true })]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockResolvedValueOnce(response);
      expect(await call(request)).toEqual({ status: 'unknown' }); expect(request).toHaveBeenCalledTimes(2);
    }
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    expect(await call(request)).toEqual({ status: 'unknown' });
  });
  it('returns known rejections distinctly and checks DELETE receipts', async () => {
    for (const [http, status] of [[401, 'auth'], [403, 'forbidden'], [409, 'conflict'], [422, 'invalid'], [405, 'unsupported']] as const) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockResolvedValueOnce(new Response('', { status: http }));
      expect(await call(request)).toEqual({ status });
    }
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(management()).mockResolvedValueOnce(Response.json({ ...receipt(), published: false, source: 'none', publication: null }));
    expect(await call(request, 'DELETE')).toMatchObject({ status: 'ready', data: { published: false } });
  });
  it('prevents foreign membership, invalid drafts and late aborted exchanges from issuing a write', async () => {
    const request = vi.fn<typeof fetch>();
    expect(await manageProjectTablePublication(context, 'project_b', 'public', table, 'wid_pk_fixture', 'identity', 'GET', null, request)).toEqual({ status: 'forbidden' });
    expect(await manageProjectTablePublication(context, 'project_a', 'public', table, 'wid_pk_fixture', 'identity', 'PUT', { ...input, maxRows: 0 }, request)).toEqual({ status: 'invalid' });
    expect(request).not.toHaveBeenCalled();
    const abort = new AbortController();
    request.mockImplementationOnce(async () => { abort.abort(); return management(); });
    await expect(call(request, 'PUT', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
