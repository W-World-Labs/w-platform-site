import { describe, expect, it } from 'vitest';
import { serializeProjectRealtimeHistory, type ProjectRealtimeHistorySnapshot, type SaasContext } from './saasConsole';

const context: SaasContext = { schemaVersion: 1, self: { userId: 'usr_1' }, authorityPlanes: { platformRole: 'member', workspaceMemberships: [{ id: 'ws_1', name: 'workspace', role: 'owner', tier: 'pro' }], appUserRelationships: [] }, console: { projects: [{ id: 'project_1', workspaceId: 'ws_1', workspaceRole: 'owner', name: 'project' }] } };
const snapshot: ProjectRealtimeHistorySnapshot = {
  table: '表"events', eventFilter: 'all', paused: false, counts: { INSERT: 5, UPDATE: 2, DELETE: 1 },
  events: [
    { id: 3, event: 'DELETE', table: '表"events', receivedAt: '2026-10-04T08:00:00.003Z' },
    { id: 2, event: 'UPDATE', table: '表"events', receivedAt: '2026-10-04T08:00:00.002Z' },
    { id: 1, event: 'INSERT', table: '表"events', receivedAt: '2026-10-04T08:00:00.001Z' },
  ],
};
const json = (value = snapshot) => JSON.parse(serializeProjectRealtimeHistory(context, 'project_1', value, 'json'));

describe('Realtime diagnostic history exports', () => {
  it('exports only the applied filter while preserving totals and retained-history bounds', () => {
    const exported = json({ ...snapshot, paused: true, eventFilter: 'UPDATE' });
    expect(exported).toEqual({ schema_version: 'w-console.realtime-history/v1', project_id: 'project_1', schema: 'public', table: snapshot.table, event_filter: 'UPDATE', history_paused: true, history_limit: 100, retained_count: 3, exported_count: 1, count_insert: 5, count_update: 2, count_delete: 1, events: [{ received_at: '2026-10-04T08:00:00.002Z', event_type: 'UPDATE', schema: 'public', table: snapshot.table }] });
    expect(json().events.map((entry: { event_type: string }) => entry.event_type)).toEqual(['DELETE', 'UPDATE', 'INSERT']);
    expect(snapshot.events).toHaveLength(3);
  });
  it('exports the captured server subscription condition without changing unfiltered downloads', () => {
    const subscriptionFilter = 'status=in.("a,b",open),priority=gte.2';
    expect(json({ ...snapshot, subscriptionFilter })).toMatchObject({ subscription_filter: subscriptionFilter });
    expect(json()).not.toHaveProperty('subscription_filter');
    expect(json({ ...snapshot, subscriptionFilter: '' })).not.toHaveProperty('subscription_filter');
    expect(serializeProjectRealtimeHistory(context, 'project_1', { ...snapshot, subscriptionFilter }, 'csv')).toContain('"status=in.(""a,b"",open),priority=gte.2"');
    for (const invalid of ['表'.repeat(1366), 'id=eq.1\0', 'id=eq.1\n']) expect(() => json({ ...snapshot, subscriptionFilter: invalid })).toThrow();
    expect(json({ ...snapshot, subscriptionFilter: 'a'.repeat(4096) }).subscription_filter).toHaveLength(4096);
  });
  it('drops row contents, local IDs, authorization and unknown transport fields from snapshots', () => {
    const input = { ...snapshot, token: 'private-transport', events: snapshot.events.map(entry => ({ ...entry, new: { secret: 'private-row' }, old: { password: 'private-old' }, apikey: 'private-key' })) };
    const exported = serializeProjectRealtimeHistory(context, 'project_1', input, 'json');
    expect(exported).not.toMatch(/private-|apikey|"id"|"new"|"old"|token/);
  });
  it('preserves exact Unicode/quoted names and neutralizes CSV formulas with the existing serializer', () => {
    const table = '=表,"quoted';
    const value = { ...snapshot, table, events: snapshot.events.map(entry => ({ ...entry, table })) };
    expect(json(value).events[0].table).toBe(table);
    const csv = serializeProjectRealtimeHistory(context, 'project_1', value, 'csv');
    expect(csv).toContain('"\'=表,""quoted"');
    expect(csv).toContain('"project_id","schema","table","event_filter"');
    expect(csv).toContain('"2026-10-04T08:00:00.003Z","DELETE"');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
  it('rejects foreign scope, mixed tables, malformed UTC times and contradictory or oversized snapshots', () => {
    expect(() => serializeProjectRealtimeHistory(context, 'foreign', snapshot, 'json')).toThrow();
    for (const value of [
      { ...snapshot, table: '../table' }, { ...snapshot, eventFilter: 'TRUNCATE' },
      { ...snapshot, events: [snapshot.events[0], snapshot.events[0]] },
      { ...snapshot, events: Array.from({ length: 101 }, (_, id) => ({ ...snapshot.events[0], id: id + 1 })), counts: { INSERT: 0, UPDATE: 0, DELETE: 101 } },
      { ...snapshot, counts: { INSERT: 0, UPDATE: 2, DELETE: 1 } },
      { ...snapshot, counts: { INSERT: -1, UPDATE: 2, DELETE: 1 } },
      { ...snapshot, events: [{ ...snapshot.events[0], table: 'other' }] },
      { ...snapshot, events: [{ ...snapshot.events[0], receivedAt: '2026-02-30T08:00:00.003Z' }] },
      { ...snapshot, events: [{ ...snapshot.events[0], receivedAt: '2026-10-04T08:00:00+08:00' }] },
      { ...snapshot, events: [{ ...snapshot.events[0], event: 'TRUNCATE' }] },
    ]) expect(() => serializeProjectRealtimeHistory(context, 'project_1', value as ProjectRealtimeHistorySnapshot, 'json')).toThrow();
  });
  it('exports exactly the retained 100 records and reports filter-empty snapshots without implying replay', () => {
    const value: ProjectRealtimeHistorySnapshot = { ...snapshot, events: Array.from({ length: 100 }, (_, index) => ({ ...snapshot.events[0], id: 100 - index })), counts: { INSERT: 0, UPDATE: 0, DELETE: 105 } };
    expect(json(value)).toMatchObject({ retained_count: 100, exported_count: 100, count_delete: 105 });
    expect(json({ ...value, eventFilter: 'INSERT' })).toMatchObject({ retained_count: 100, exported_count: 0, count_delete: 105, events: [] });
  });
});
