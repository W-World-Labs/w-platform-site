import { describe, expect, it } from 'vitest';
import { serializeProjectStoragePage, type ProjectStorageObjectPage, type SaasContext } from './saasConsole';

const context: SaasContext = { schemaVersion: 1, self: { userId: 'usr_1' }, authorityPlanes: { platformRole: 'member', workspaceMemberships: [{ id: 'ws_1', name: 'workspace', role: 'owner', tier: 'pro' }], appUserRelationships: [] }, console: { projects: [{ id: 'project_1', workspaceId: 'ws_1', workspaceRole: 'owner', name: 'project' }] } };
const capturedAt = '2026-10-04T11:00:00.003Z';
const page: ProjectStorageObjectPage = { bucket: 'assets', offset: 50, hasMore: true, objects: [{ bucket: 'assets', path: 'images/雪.png', size: 123, contentType: 'image/png', versionId: 'version_1', updatedAt: 1780000000 }] };
const serialize = (value = page, format: 'json' | 'csv' = 'json', prefix = 'images/') => serializeProjectStoragePage(context, 'project_1', prefix, value, capturedAt, format);

describe('authorized Storage page export', () => {
  it('captures page scope and whitelists metadata without exporting transport fields', () => {
    const value = { ...page, credentials: 'private-placeholder', objects: [{ ...page.objects[0], signedUrl: 'private-placeholder', token: 'private-placeholder' }] };
    const output = serialize(value);
    expect(JSON.parse(output)).toEqual({ schema_version: 'w-console.storage-page/v1', workspace_id: 'ws_1', project_id: 'project_1', bucket: 'assets', prefix: 'images/', page_offset: 50, page_limit: 50, has_more: true, returned_count: 1, captured_at: capturedAt, objects: [{ path: 'images/雪.png', size_bytes: 123, content_type: 'image/png', version_id: 'version_1', updated_at_unix: 1780000000 }] });
    expect(output).not.toContain('private-placeholder');
    expect(value.objects[0].signedUrl).toBe('private-placeholder');
  });
  it('quotes Unicode punctuation and escapes spreadsheet formulas in every text field', () => {
    const csv = serialize({ ...page, objects: [{ ...page.objects[0], path: '=雪,"quoted".png', contentType: '@formula', versionId: '-version' }] }, 'csv', '');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=雪,""quoted"".png"');
    expect(csv).toContain('"\'@formula"');
    expect(csv).toContain('"\'-version"');
    expect(csv).toContain(capturedAt);
  });
  it('preserves empty-page query metadata and the exact 50-object bound', () => {
    expect(JSON.parse(serialize({ ...page, hasMore: false, objects: [] }))).toMatchObject({ returned_count: 0, has_more: false, objects: [] });
    expect(serialize({ ...page, objects: [] }, 'csv')).toContain('"returned_count"');
    const objects = Array.from({ length: 50 }, (_, index) => ({ ...page.objects[0], path: `images/${index}.png` }));
    expect(JSON.parse(serialize({ ...page, objects })).objects).toHaveLength(50);
    expect(() => serialize({ ...page, objects: [...objects, { ...page.objects[0], path: 'images/extra.png' }] })).toThrow();
  });
  it('rejects foreign scope, mixed buckets, mismatched prefixes and malformed metadata', () => {
    expect(() => serializeProjectStoragePage(context, 'foreign', '', page, capturedAt, 'json')).toThrow();
    for (const patch of [{ bucket: 'other' }, { path: '../outside' }, { path: 'outside.png' }, { size: -1 }, { size: 1.5 }, { updatedAt: NaN }]) expect(() => serialize({ ...page, objects: [{ ...page.objects[0], ...patch }] })).toThrow();
    for (const patch of [{ offset: -1 }, { offset: 1_000_001 }, { bucket: '..' }, { objects: [page.objects[0], page.objects[0]] }]) expect(() => serialize({ ...page, ...patch })).toThrow();
    expect(() => serializeProjectStoragePage(context, 'project_1', 'images/', page, '2026-02-30T11:00:00.003Z', 'json')).toThrow();
  });
});
