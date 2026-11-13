import type { ProjectMigrationFile } from './saasConsole';

export const PROJECT_TABLE_COLUMN_TYPES = ['text', 'boolean', 'integer', 'bigint', 'numeric', 'uuid', 'date', 'timestamptz', 'jsonb'] as const;
export type ProjectTableColumnDefault = { kind: 'literal'; value: string } | { kind: 'null' | 'now' | 'today' | 'uuid' };
export type ProjectTableColumnReference = { table: string; column: string; onDelete: 'restrict' | 'cascade' | 'set-null' };
export type ProjectTableColumnDefinition = { name: string; type: typeof PROJECT_TABLE_COLUMN_TYPES[number]; nullable: boolean; unique?: boolean; defaultValue?: ProjectTableColumnDefault; reference?: ProjectTableColumnReference };
export type ProjectTablePrimaryKey = { name: string; type: 'bigint' | 'uuid' };

export function validProjectTableIdentifier(value: string): boolean {
  return value.length > 0 && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\') && new TextEncoder().encode(value).byteLength <= 63 && !Array.from(value).some(char => { const code = char.charCodeAt(0); return code < 32 || (code >= 127 && code <= 159) || (char.length === 1 && code >= 0xd800 && code <= 0xdfff); });
}

export function encodeProjectTableIdentifier(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function identifier(value: string): string | null {
  const name = value.trim();
  if (!validProjectTableIdentifier(value) || !validProjectTableIdentifier(name)) return null;
  return `"${name.replaceAll('"', '""')}"`;
}

function validLiteralText(value: string): boolean {
  return !value.includes('\0') && !Array.from(value).some(char => char.length === 1 && char.charCodeAt(0) >= 0xd800 && char.charCodeAt(0) <= 0xdfff);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Defaults are typed constants or fixed built-in generators, never caller SQL. */
export function projectTableColumnDefaultSql(column: ProjectTableColumnDefinition): string | null {
  const value = column.defaultValue;
  if (value === undefined) return '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.kind === 'null') return column.nullable ? 'NULL' : null;
  if (value.kind === 'now') return column.type === 'timestamptz' ? 'pg_catalog.now()' : null;
  if (value.kind === 'today') return column.type === 'date' ? 'CURRENT_DATE' : null;
  if (value.kind === 'uuid') return column.type === 'uuid' ? 'pg_catalog.gen_random_uuid()' : null;
  if (value.kind !== 'literal' || typeof value.value !== 'string' || !validLiteralText(value.value) || new TextEncoder().encode(value.value).byteLength > 1024) return null;
  const literal = value.value;
  if (column.type === 'integer' || column.type === 'bigint') {
    if (!/^-?(0|[1-9]\d*)$/.test(literal)) return null;
    const integer = BigInt(literal);
    const bits = column.type === 'integer' ? 31n : 63n;
    if (integer < -(2n ** bits) || integer >= 2n ** bits) return null;
  } else if (column.type === 'numeric') {
    // Avoid JavaScript number coercion so decimal and bigint defaults stay exact.
    if (!/^-?(0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,4})?$/.test(literal)) return null;
  } else if (column.type === 'boolean') {
    if (literal !== 'true' && literal !== 'false') return null;
  } else if (column.type === 'uuid') {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(literal)) return null;
  } else if (column.type === 'date') {
    if (!validDate(literal)) return null;
  } else if (column.type === 'timestamptz') {
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5]):[0-5]\d)$/.test(literal) || !validDate(literal.slice(0, 10))) return null;
  } else if (column.type === 'jsonb') {
    try {
      const pending: unknown[] = [JSON.parse(literal)];
      while (pending.length) {
        const item = pending.pop();
        if (typeof item === 'string' && !validLiteralText(item)) return null;
        if (item && typeof item === 'object') {
          if (!Object.keys(item).every(validLiteralText)) return null;
          pending.push(...Object.values(item));
        }
      }
    } catch { return null; }
  } else if (column.type !== 'text') return null;
  const type = column.type === 'integer' ? 'int4' : column.type === 'bigint' ? 'int8' : column.type === 'boolean' ? 'bool' : column.type;
  return `E'${literal.replaceAll('\\', '\\\\').replaceAll("'", "''")}'::pg_catalog.${type}`;
}

/** References stay in this project's public schema; deletion actions are fixed SQL. */
export function projectTableColumnReferenceSql(column: ProjectTableColumnDefinition): string | null {
  const reference = column.reference;
  if (reference === undefined) return '';
  if (!reference || typeof reference !== 'object' || Array.isArray(reference) || typeof reference.table !== 'string' || typeof reference.column !== 'string') return null;
  const table = identifier(reference.table);
  const target = identifier(reference.column);
  const actions = { restrict: 'RESTRICT', cascade: 'CASCADE', 'set-null': 'SET NULL' } as const;
  if (!table || !target || typeof reference.onDelete !== 'string' || !Object.hasOwn(actions, reference.onDelete) || (reference.onDelete === 'set-null' && !column.nullable)) return null;
  return `REFERENCES "public".${table} (${target}) ON DELETE ${actions[reference.onDelete]}`;
}

/** Names are quoted identifiers; column types come only from the fixed menu. */
export function createProjectTableMigration(table: string, columns: ProjectTableColumnDefinition[], rowSecurity: boolean, version: string, primaryKey: ProjectTablePrimaryKey = { name: 'id', type: 'bigint' }): ProjectMigrationFile | null {
  const name = identifier(table);
  const primary = identifier(primaryKey.name);
  if (!name || !primary || !['bigint', 'uuid'].includes(primaryKey.type) || !/^\d{1,20}$/.test(version) || typeof rowSecurity !== 'boolean' || !Array.isArray(columns) || columns.length < 1 || columns.length > 16) return null;
  const names = new Set([primaryKey.name.trim()]);
  const definitions = [`  ${primary} ${primaryKey.type === 'uuid' ? 'uuid DEFAULT pg_catalog.gen_random_uuid()' : 'bigint GENERATED ALWAYS AS IDENTITY'} PRIMARY KEY`];
  for (const column of columns) {
    const columnName = identifier(column.name);
    const defaultSql = projectTableColumnDefaultSql(column);
    const referenceSql = projectTableColumnReferenceSql(column);
    if (!columnName || names.has(column.name.trim()) || !PROJECT_TABLE_COLUMN_TYPES.includes(column.type) || typeof column.nullable !== 'boolean' || (column.unique !== undefined && typeof column.unique !== 'boolean') || defaultSql === null || referenceSql === null) return null;
    names.add(column.name.trim());
    definitions.push(`  ${columnName} ${column.type}${column.nullable ? '' : ' NOT NULL'}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}${column.unique ? ' UNIQUE' : ''}${referenceSql ? ` ${referenceSql}` : ''}`);
  }
  const qualified = `"public".${name}`;
  let sql = `CREATE TABLE ${qualified} (\n${definitions.join(',\n')}\n);\n`;
  if (rowSecurity) sql += `ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY;\nALTER TABLE ${qualified} FORCE ROW LEVEL SECURITY;\n`;
  return { name: `${version}_create_table.sql`, sql };
}
