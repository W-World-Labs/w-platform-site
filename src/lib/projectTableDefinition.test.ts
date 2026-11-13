import { describe, expect, it } from 'vitest';
import { createProjectTableMigration, projectTableColumnDefaultSql, projectTableColumnReferenceSql, PROJECT_TABLE_COLUMN_TYPES, type ProjectTableColumnDefinition } from './projectTableDefinition';
import { parseProjectMigrationFiles } from './saasConsole';

describe('create-table migration preparation', () => {
  it('quotes Unicode, spaces and SQL-looking identifiers without executing fragments', () => {
    const file = createProjectTableMigration(' 中文"; DROP TABLE todos;-- ', [{ name: '字段" name', type: 'text', nullable: false }], true, '20261004021830123');
    expect(file?.sql).toContain('CREATE TABLE "public"."中文""; DROP TABLE todos;--"');
    expect(file?.sql).toContain('"字段"" name" text NOT NULL');
    expect(file?.sql).toContain('"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    expect(file?.sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(file?.sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(parseProjectMigrationFiles(JSON.stringify([file]))).toEqual([file]);
  });
  it('supports the fixed type menu, nullable fields and explicitly disabled RLS', () => {
    const file = createProjectTableMigration('items', PROJECT_TABLE_COLUMN_TYPES.map(type => ({ name: type, type, nullable: true })), false, '1');
    expect(file?.sql).not.toContain('NOT NULL');
    expect(file?.sql).not.toContain('ALTER TABLE');
    expect(file?.sql).toContain('"jsonb" jsonb');
  });
  it('prepares quoted custom integer and UUID primary keys while allowing an ordinary id column', () => {
    const columns = [{ name: 'id', type: 'text' as const, nullable: false }];
    const integer = createProjectTableMigration('items', columns, true, '1', { name: ' 记录"编号 ', type: 'bigint' });
    expect(integer?.sql).toContain('"记录""编号" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    expect(integer?.sql).toContain('"id" text NOT NULL');
    const uuid = createProjectTableMigration('items', columns, true, '1', { name: 'record_key', type: 'uuid' });
    expect(uuid?.sql).toContain('"record_key" uuid DEFAULT pg_catalog.gen_random_uuid() PRIMARY KEY');
    expect(uuid?.sql).not.toContain('IDENTITY');
    expect(parseProjectMigrationFiles(JSON.stringify([uuid]))).toEqual([uuid]);
  });
  it('rejects primary key collisions, invalid identifiers and unsupported generation types', () => {
    const columns = [{ name: 'record_key', type: 'text' as const, nullable: false }];
    for (const name of [' record_key ', '', ' ', 'bad/path', '中'.repeat(22), '\ud800']) expect(createProjectTableMigration('items', columns, true, '1', { name, type: 'uuid' })).toBeNull();
    expect(createProjectTableMigration('items', columns, true, '1', { name: '中'.repeat(21), type: 'uuid' })).not.toBeNull();
    expect(createProjectTableMigration('items', columns, true, '1', { name: 'key', type: 'text); DROP TABLE items;--' as 'uuid' })).toBeNull();
  });
  it('rejects ambiguous names, truncated UTF-8 identifiers, raw types and invalid bounds', () => {
    const column = { name: 'title', type: 'text' as const, nullable: false };
    for (const name of ['', ' ', '.', '..', '../bad', 'bad\\path', 'a\n', 'a\u0085b', '中'.repeat(22)]) expect(createProjectTableMigration(name, [column], true, '1')).toBeNull();
    expect(createProjectTableMigration('中'.repeat(21), [column], true, '1')).not.toBeNull();
    for (const columns of [[], Array(17).fill(column), [column, column], [{ ...column, name: ' id ' }], [{ ...column, name: '\0bad' }], [{ ...column, type: 'text); DROP TABLE todos;--' as 'text' }]]) expect(createProjectTableMigration('items', columns, true, '1')).toBeNull();
    expect(createProjectTableMigration('items', [column], true, '1_bad')).toBeNull();
  });
  it('prepares defaults and uniqueness while keeping SQL NULL separate from JSON null', () => {
    const file = createProjectTableMigration('items', [
      { name: 'email', type: 'text', nullable: false, unique: true, defaultValue: { kind: 'literal', value: '' } },
      { name: 'optional', type: 'text', nullable: true, unique: true, defaultValue: { kind: 'null' } },
      { name: 'payload', type: 'jsonb', nullable: false, defaultValue: { kind: 'literal', value: 'null' } },
    ], true, '1');
    expect(file?.sql).toContain('"email" text NOT NULL DEFAULT E\'\'::pg_catalog.text UNIQUE');
    expect(file?.sql).toContain('"optional" text DEFAULT NULL UNIQUE');
    expect(file?.sql).toContain('"payload" jsonb NOT NULL DEFAULT E\'null\'::pg_catalog.jsonb');
    expect(parseProjectMigrationFiles(JSON.stringify([file]))).toEqual([file]);
    expect(createProjectTableMigration('items', [{ name: 'title', type: 'text', nullable: false, defaultValue: { kind: 'null' } }], true, '1')).toBeNull();
    expect(createProjectTableMigration('items', [{ name: 'title', type: 'text', nullable: false, unique: 'UNIQUE); DROP TABLE items' as unknown as boolean }], true, '1')).toBeNull();
  });
  it('limits built-in generators to their exact matching column types', () => {
    for (const [kind, type, sql] of [['now', 'timestamptz', 'pg_catalog.now()'], ['today', 'date', 'CURRENT_DATE'], ['uuid', 'uuid', 'pg_catalog.gen_random_uuid()']] as const) {
      expect(projectTableColumnDefaultSql({ name: 'value', type, nullable: false, defaultValue: { kind } })).toBe(sql);
      expect(projectTableColumnDefaultSql({ name: 'value', type: 'text', nullable: false, defaultValue: { kind } })).toBeNull();
    }
    expect(projectTableColumnDefaultSql({ name: 'value', type: 'text', nullable: true, defaultValue: { kind: 'pg_sleep(30)' } } as unknown as ProjectTableColumnDefinition)).toBeNull();
  });
  it('escapes apostrophes and backslashes as text and preserves whitespace and empty values', () => {
    const literal = (value: string) => projectTableColumnDefaultSql({ name: 'value', type: 'text', nullable: false, defaultValue: { kind: 'literal', value } });
    expect(literal("  中文\\' ; DROP TABLE items; --\n")).toBe("E'  中文\\\\'' ; DROP TABLE items; --\n'::pg_catalog.text");
    expect(literal('')).toBe("E''::pg_catalog.text");
    expect(literal('x\0y')).toBeNull();
    expect(literal('\ud800')).toBeNull();
    expect(literal('😀')).toBe("E'😀'::pg_catalog.text");
    expect(literal('a'.repeat(1024))).not.toBeNull();
    expect(literal('a'.repeat(1025))).toBeNull();
    expect(literal('中'.repeat(342))).toBeNull();
  });
  it('checks PostgreSQL integer ranges without rounding large bigint literals', () => {
    const literal = (type: 'integer' | 'bigint', value: string) => projectTableColumnDefaultSql({ name: 'value', type, nullable: false, defaultValue: { kind: 'literal', value } });
    for (const value of ['-2147483648', '2147483647']) expect(literal('integer', value)).toBe(`E'${value}'::pg_catalog.int4`);
    for (const value of ['-9223372036854775808', '9223372036854775807', '9007199254740993']) expect(literal('bigint', value)).toBe(`E'${value}'::pg_catalog.int8`);
    for (const value of ['-2147483649', '2147483648', '01', '1.0', '1e3', ' 1', '1;SELECT 1']) expect(literal('integer', value)).toBeNull();
    for (const value of ['-9223372036854775809', '9223372036854775808']) expect(literal('bigint', value)).toBeNull();
  });
  it('retains exact decimal and exponent values and rejects expressions and non-finite values', () => {
    const literal = (value: string) => projectTableColumnDefaultSql({ name: 'value', type: 'numeric', nullable: false, defaultValue: { kind: 'literal', value } });
    for (const value of ['0', '-0.5', '9007199254740993.1234567890123456789', '1.2e-3', '3E+2']) expect(literal(value)).toBe(`E'${value}'::pg_catalog.numeric`);
    for (const value of ['NaN', 'Infinity', '1/2', '1);SELECT 1', '1e99999', 'true', '.1', '1.']) expect(literal(value)).toBeNull();
  });
  it('validates boolean, UUID, ISO dates and timestamps including timezone and leap days', () => {
    const literal = (type: ProjectTableColumnDefinition['type'], value: string) => projectTableColumnDefaultSql({ name: 'value', type, nullable: false, defaultValue: { kind: 'literal', value } });
    expect(literal('boolean', 'false')).toBe("E'false'::pg_catalog.bool");
    expect(literal('boolean', 'FALSE')).toBeNull();
    expect(literal('uuid', '9e881bd6-e046-419f-9a19-c8d34e47c0cf')).not.toBeNull();
    expect(literal('uuid', 'random()')).toBeNull();
    for (const value of ['2024-02-29', '2000-02-29', '0001-01-01']) expect(literal('date', value)).not.toBeNull();
    for (const value of ['2023-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-01-00', '10/04/2026']) expect(literal('date', value)).toBeNull();
    for (const value of ['2024-02-29T23:59:59.123456Z', '2026-10-04T00:00:00+08:00']) expect(literal('timestamptz', value)).not.toBeNull();
    for (const value of ['2023-02-29T00:00:00Z', '2026-10-04T24:00:00Z', '2026-10-04T00:00:00', '2026-10-04T00:00:00+16:00', '2026-10-04T00:00:00+00:60']) expect(literal('timestamptz', value)).toBeNull();
  });
  it('validates nested JSON strings for PostgreSQL jsonb without rewriting the source', () => {
    const literal = (value: string) => projectTableColumnDefaultSql({ name: 'value', type: 'jsonb', nullable: false, defaultValue: { kind: 'literal', value } });
    const value = '{"exact":9007199254740993,"text":"中文","nested":[false,null]}';
    expect(literal(value)).toBe(`E'${value}'::pg_catalog.jsonb`);
    for (const value of ['{', '{"bad":"\\u0000"}', '{"bad":["\\ud800"]}', '{"\\u0000":"key"}']) expect(literal(value)).toBeNull();
  });
  it('quotes public foreign-key targets and preserves defaults and uniqueness', () => {
    const file = createProjectTableMigration('children', [{
      name: 'parent_key', type: 'uuid', nullable: false, unique: true,
      defaultValue: { kind: 'literal', value: '9e881bd6-e046-419f-9a19-c8d34e47c0cf' },
      reference: { table: ' 父表"; DROP TABLE todos;-- ', column: '键"名', onDelete: 'restrict' },
    }], true, '1');
    expect(file?.sql).toContain('REFERENCES "public"."父表""; DROP TABLE todos;--" ("键""名") ON DELETE RESTRICT');
    expect(file?.sql).toContain("NOT NULL DEFAULT E'9e881bd6-e046-419f-9a19-c8d34e47c0cf'::pg_catalog.uuid UNIQUE REFERENCES");
    expect(file?.sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(parseProjectMigrationFiles(JSON.stringify([file]))).toEqual([file]);
  });
  it('supports self-references and fixed deletion actions with nullable SET NULL', () => {
    for (const [onDelete, action] of [['restrict', 'RESTRICT'], ['cascade', 'CASCADE'], ['set-null', 'SET NULL']] as const) {
      const column: ProjectTableColumnDefinition = { name: 'parent', type: 'uuid', nullable: true, reference: { table: 'tree', column: 'record_key', onDelete } };
      const file = createProjectTableMigration('tree', [column], true, '1', { name: 'record_key', type: 'uuid' });
      expect(file?.sql).toContain(`REFERENCES "public"."tree" ("record_key") ON DELETE ${action}`);
      expect(createProjectTableMigration('tree', [{ ...column, nullable: false }], true, '1')).toEqual(onDelete === 'set-null' ? null : expect.any(Object));
    }
    expect(projectTableColumnReferenceSql({ name: 'plain', type: 'text', nullable: false })).toBe('');
  });
  it('rejects invalid reference names and untrusted deletion actions without producing SQL', () => {
    const column: ProjectTableColumnDefinition = { name: 'parent', type: 'bigint', nullable: true, reference: { table: 'parents', column: 'id', onDelete: 'restrict' } };
    const invalid: unknown[] = [null, [], 'parents(id)', {}, { table: 1, column: 'id', onDelete: 'restrict' }];
    for (const name of ['', ' ', '.', '..', 'bad/path', 'bad\\path', 'x\n', '中'.repeat(22), '\ud800']) {
      invalid.push({ ...column.reference, table: name }, { ...column.reference, column: name });
    }
    for (const onDelete of ['CASCADE', 'cascade; DROP TABLE parents;--', 'set-default', 'toString', '__proto__', null, { toString: () => 'cascade' }]) invalid.push({ ...column.reference, onDelete });
    for (const reference of invalid) {
      expect(projectTableColumnReferenceSql({ ...column, reference } as ProjectTableColumnDefinition)).toBeNull();
      expect(createProjectTableMigration('children', [{ ...column, reference } as ProjectTableColumnDefinition], true, '1')).toBeNull();
    }
    expect(projectTableColumnReferenceSql({ ...column, reference: { ...column.reference!, table: '中'.repeat(21), column: '😀' } })).not.toBeNull();
  });
});
