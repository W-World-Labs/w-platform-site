import { describe, expect, it } from 'vitest';
import { projectRowMutationTarget, editableProjectRowJson, parseProjectRowValueDraft, projectRowFields, type ProjectRowField } from './projectRowEditor';
import type { ProjectDatabaseColumn } from './saasConsole';

const column = (name: string, dataType: string, extra: Partial<ProjectDatabaseColumn> = {}): ProjectDatabaseColumn => ({ name, dataType, ordinal: 1, nullable: true, hasDefault: false, identity: false, generated: false, ...extra });
const columns = [column('id', 'integer', { identity: true }), column('title', 'text'), column('score', 'bigint'), column('done', 'boolean'), column('payload', 'jsonb'), column('computed', 'integer', { generated: true })];

describe('schema-guided row values', () => {
  it('round-trips literal strings, numbers, booleans, null and unknown columns without coercion', () => {
    const values = { title: '', score: 0, done: false, payload: { literal: '<script>not markup</script>', values: [null, 'true', 2] }, extra: [true, 0], optional: null };
    const fields = projectRowFields(JSON.stringify(values), columns)!;
    expect(parseProjectRowValueDraft({ kind: 'fields', fields })).toEqual(values);
    expect(fields.find(field => field.name === 'id')).toMatchObject({ readOnly: true, mode: 'omit' });
    expect(fields.find(field => field.name === 'computed')).toMatchObject({ readOnly: true, mode: 'omit' });
    const mismatched = projectRowFields('{"title":false,"score":"12"}', columns)!;
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: mismatched })).toEqual({ title: false, score: '12' });
  });

  it('distinguishes omitted defaults, empty text, explicit null, zero and false', () => {
    const fields = projectRowFields('{}', columns)!.map(field => ({ ...field, mode: ['title', 'score', 'done', 'payload'].includes(field.name) ? 'value' : 'omit' } as ProjectRowField));
    expect(parseProjectRowValueDraft({ kind: 'fields', fields })).toEqual({ title: '', score: 0, done: false, payload: {} });
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: fields.map(field => field.name === 'payload' ? { ...field, mode: 'null' } : field) })).toEqual({ title: '', score: 0, done: false, payload: null });
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: fields.map(field => ({ ...field, mode: 'omit' })) })).toBeNull();
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: fields.map(field => ({ ...field, mode: 'omit' })) }, true)).toEqual({});
  });

  it('rejects invalid or unsafe values and enforces the existing payload bounds', () => {
    const field = projectRowFields('{"score":1}', columns)!.find(field => field.name === 'score')!;
    for (const text of ['', '-', '1.5', '0x10', '9007199254740992']) expect(parseProjectRowValueDraft({ kind: 'fields', fields: [{ ...field, text }] })).toBeNull();
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: [{ ...field, text: '-9007199254740991' }] })).toEqual({ score: -9007199254740991 });
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: [{ ...field, mode: 'null', nullable: false }] })).toBeNull();
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: [{ ...field, kind: 'json', text: '{' }] })).toBeNull();
    expect(projectRowFields('[]', columns)).toBeNull();
    expect(projectRowFields(`{${' '.repeat(32_768)}}`, columns)).toBeNull();
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: Array.from({ length: 65 }, (_, n) => ({ ...field, name: `c${n}` })) })).toBeNull();
    expect(parseProjectRowValueDraft({ kind: 'fields', fields: [{ ...field, kind: 'text', text: '汉'.repeat(11_000) }] })).toBeNull();
  });

  it('omits bound/generated row columns from edit initialization without changing the original snapshot', () => {
    const row = { id: 1, user_id: 'user', owner_id: 'owner', computed: 5, title: '', done: false, extra: { count: 0 } };
    expect(JSON.parse(editableProjectRowJson(row, columns))).toEqual({ title: '', done: false, extra: { count: 0 } });
    expect(row.computed).toBe(5);
  });
});


it('preserves quoted Unicode keys and uses explicit publication read-only columns', () => {
  const columns = [column('记录编号', 'integer'), column('用户归属', 'text'), column('客户.标题 "quoted"', 'text'), column('id', 'text'), column('generated', 'text', { generated: true })];
  const row = { '记录编号': 4, '用户归属': 'alice', '客户.标题 "quoted"': '  中文\n', id: 'ordinary writable value', generated: 'computed' };
  const readOnly = ['记录编号', '用户归属'];
  const draft = editableProjectRowJson(row, columns, readOnly);
  expect(JSON.parse(draft)).toEqual({ '客户.标题 "quoted"': '  中文\n', id: 'ordinary writable value' });
  const fields = projectRowFields(draft, columns, readOnly)!;
  expect(fields.find(field => field.name === '用户归属')).toMatchObject({ readOnly: true, mode: 'omit' });
  expect(fields.find(field => field.name === 'id')?.readOnly).toBe(false);
  expect(fields.find(field => field.name === 'generated')?.readOnly).toBe(true);
  expect(parseProjectRowValueDraft({ kind: 'fields', fields })).toEqual(JSON.parse(draft));
});

it('edits PostgreSQL tsvector wire text as a string instead of JSON', () => {
  const search = column('search_vector', 'tsvector');
  const fields = projectRowFields('{"search_vector":"\'cloud\':1A \'flare\':2B"}', [search]);
  expect(fields?.[0]).toMatchObject({ kind: 'text', dataType: 'tsvector', text: "'cloud':1A 'flare':2B" });
  expect(parseProjectRowValueDraft({ kind: 'fields', fields: fields! })).toEqual({ search_vector: "'cloud':1A 'flare':2B" });
});

it('captures the primary key even when it follows eight loaded columns', () => {
  const row = Object.fromEntries([...Array.from({ length: 9 }, (_, index) => [`field_${index}`, index]), ['主键', '雪']]);
  const target = projectRowMutationTarget(row, '主键');
  expect(target?.id).toBe('雪'); expect(target?.expected['主键']).toBe('雪');
  expect(Object.keys(target!.expected)).toHaveLength(8);
  expect(projectRowMutationTarget({ id: 0, hidden: 'private', title: '' }, 'id', ['id', 'title'])).toEqual({ id: '0', expected: { id: 0, title: '' } });
  expect(projectRowMutationTarget({ id: 1 }, 'id', ['title'])).toBeNull();
  expect(projectRowMutationTarget({ id: 1.5 }, 'id')).toBeNull();
});
