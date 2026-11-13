import { describe, expect, it } from 'vitest';
import { parseProjectTableFilterValue, projectTableQueryParams, type ProjectTableFilter, type ProjectTableQuery } from './projectTableQuery';

describe('table query input', () => {
  it('keeps empty text, zero, false and NULL distinct without numeric coercion', () => {
    expect(parseProjectTableFilterValue('text', '')).toBe('');
    expect(parseProjectTableFilterValue('text', '9007199254740993')).toBe('9007199254740993');
    expect(parseProjectTableFilterValue('number', '0')).toBe(0);
    expect(parseProjectTableFilterValue('number', '-1.25')).toBe(-1.25);
    expect(parseProjectTableFilterValue('boolean', 'false')).toBe(false);
    expect(parseProjectTableFilterValue('null', '')).toBeNull();
    for (const value of ['9007199254740992', 'Infinity', '1e999', 'true', 'null', '"1"', '[]', '', '01']) expect(parseProjectTableFilterValue('number', value)).toBeUndefined();
    expect(parseProjectTableFilterValue('boolean', 'yes')).toBeUndefined();
  });
  it('encodes opaque scalar values and right-suffixed ordering without syntax injection', () => {
    const query: ProjectTableQuery = { filters: [{ column: 'title', operator: 'eq', value: '中文,&or=(id.eq.1)\n"quote"' }, { column: 'done', operator: 'eq', value: false }, { column: 'score', operator: 'gte', value: 0 }, { column: 'nullable_note', operator: 'not.is', value: null }], order: { column: '含 点.name', descending: true, nullsFirst: true } };
    const params = new URLSearchParams(projectTableQueryParams(query)!);
    expect(params.size).toBe(2); expect(JSON.parse(params.get('filters')!)).toEqual(query.filters);
    expect(params.get('order')).toBe('含 点.name.desc.nullsfirst');
    expect(projectTableQueryParams({ filters: [] })).toBe('');
  });
  it('rejects oversized, invalid and nonscalar filters before any request', () => {
    const filter: ProjectTableFilter = { column: 'title', operator: 'eq', value: 'ok' };
    expect(projectTableQueryParams({ filters: Array.from({ length: 8 }, () => filter) })).not.toBeNull();
    expect(projectTableQueryParams({ filters: Array.from({ length: 9 }, () => filter) })).toBeNull();
    for (const patch of [{ column: '' }, { column: '界'.repeat(22) }, { column: String.fromCharCode(0) }, { operator: 'or' }, { value: [] }, { value: {} }, { value: NaN }, { value: Infinity }, { value: 9007199254740992 }, { value: null }, { operator: 'like', value: 1 }, { operator: 'is', value: 'null' }, { operator: 'not.is', value: 0 }, { value: '界'.repeat(1400) }]) expect(projectTableQueryParams({ filters: [{ ...filter, ...patch } as ProjectTableFilter] })).toBeNull();
  });
});
