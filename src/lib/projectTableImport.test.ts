import { describe, expect, it } from 'vitest';
import type { ProjectDatabaseColumn } from './saasConsole';
import { parseProjectTableCsv } from './projectTableImport';

const column = (name: string, dataType = 'text', extra: Partial<ProjectDatabaseColumn> = {}): ProjectDatabaseColumn => ({ name, dataType, ordinal: 1, nullable: true, hasDefault: false, identity: false, generated: false, ...extra });
const columns = [column('id', 'integer', { identity: true }), column('title', 'text', { nullable: false }), column('score', 'bigint', { nullable: false }), column('done', 'boolean', { nullable: false }), column('payload', 'jsonb'), column('note'), column('labels', 'ARRAY'), column('computed', 'integer', { generated: true }), column('user_id')];
const csv = (records: string[][]) => records.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');

describe('typed CSV table imports', () => {
  it('preserves Unicode, commas, escaped quotes, newlines, whitespace, zero, false and defaults', () => {
    const title = '  中文,"quoted"\r\nline\nnext  ';
    expect(parseProjectTableCsv('\uFEFF' + csv([['title', 'score', 'done', 'payload', 'labels'], [title, '0', 'false', '{"x":0,"empty":""}', '["一","two"]']]) + '\r\n', columns)).toEqual([{ title, score: 0, done: false, payload: { x: 0, empty: '' }, labels: ['一', 'two'] }]);
    expect(parseProjectTableCsv('title\n""', columns)).toEqual([{ title: '' }]);
    expect(parseProjectTableCsv('title,note\nhello,', columns)).toEqual([{ title: 'hello', note: '' }]);
    expect(parseProjectTableCsv('title\n=SUM(A1:A2)', columns)).toEqual([{ title: '=SUM(A1:A2)' }]);
  });

  it('distinguishes SQL NULL, empty text and quoted literal NULL markers', () => {
    expect(parseProjectTableCsv('note,payload\n\\N,\\N\n"\\N",null\n,"""null"""', columns)).toEqual([{ note: null, payload: null }, { note: '\\N', payload: null }, { note: '', payload: 'null' }]);
    expect(parseProjectTableCsv('title\n\\N', columns)).toBeNull();
    expect(parseProjectTableCsv('payload\nnull', [column('payload', 'jsonb', { nullable: false })])).toBeNull();
  });

  it('rejects malformed quotes, bare record CR, uneven records and header-only drafts', () => {
    for (const input of ['', 'title', 'title\r\n', 'title\rvalue', 'title\n"unfinished', 'title\n"value" tail', 'title\nva"lue', 'title,note\nvalue', 'title\nvalue,extra']) expect(parseProjectTableCsv(input, columns), input).toBeNull();
  });

  it('requires exact unique writable headers including quoted Unicode names', () => {
    for (const header of ['title,title', '', ' title', 'unknown', 'id', 'user_id', 'computed']) expect(parseProjectTableCsv(header + '\nvalue,value', columns), header).toBeNull();
    for (const header of ['id', 'user_id', 'computed']) expect(parseProjectTableCsv(header + '\n1', columns), header).toBeNull();
    expect(parseProjectTableCsv('title\nvalue', columns, ['title'])).toBeNull();
    const name = '客户.标题 "quoted"';
    expect(parseProjectTableCsv(csv([[name], ['中文']]), [column(name)], [])).toEqual([{ [name]: '中文' }]);
    expect(parseProjectTableCsv('id\nordinary', [column('id')], [])).toEqual([{ id: 'ordinary' }]);
    expect(parseProjectTableCsv('title\nvalue', [])).toBeNull();
  });

  it('rejects invalid booleans, unsafe numbers and malformed JSON without coercion', () => {
    for (const value of ['', 'True', '1', ' false']) expect(parseProjectTableCsv('done\n' + csv([[value]]), columns)).toBeNull();
    for (const value of ['', '1.5', '01', '0x10', '9007199254740992']) expect(parseProjectTableCsv('score\n' + csv([[value]]), columns)).toBeNull();
    for (const value of ['{', '1e400', '{"unsafe":9007199254740992}', '['.repeat(10_000) + '0' + ']'.repeat(10_000)]) expect(parseProjectTableCsv('payload\n' + csv([[value]]), columns)).toBeNull();
    expect(parseProjectTableCsv('score,done\n-9007199254740991,true', columns)).toEqual([{ score: -9007199254740991, done: true }]);
  });

  it('enforces UTF-8, row, column and atomic batch size limits after conversion', () => {
    expect(parseProjectTableCsv('title\n' + '汉'.repeat(11_000), columns)).toBeNull();
    expect(parseProjectTableCsv('title\n' + 'a'.repeat(1_048_576), columns)).toBeNull();
    expect(parseProjectTableCsv('title\n' + Array.from({ length: 100 }, () => 'ok').join('\n'), columns)).toHaveLength(100);
    expect(parseProjectTableCsv('title\n' + Array.from({ length: 101 }, () => 'ok').join('\n'), columns)).toBeNull();
    const wide = Array.from({ length: 65 }, (_, index) => column('c' + index));
    expect(parseProjectTableCsv(csv([wide.map(c => c.name), wide.map(() => '')]), wide)).toBeNull();
    expect(parseProjectTableCsv('title\n' + Array.from({ length: 100 }, () => 'a'.repeat(11_000)).join('\n'), columns)).toBeNull();
  });
});
