import { parseProjectRowValues, type ProjectDatabaseColumn } from './saasConsole';

export interface ProjectRowField {
  name: string;
  kind: 'text' | 'integer' | 'boolean' | 'json';
  dataType?: string;
  nullable: boolean;
  readOnly: boolean;
  mode: 'omit' | 'value' | 'null';
  text: string;
}
export type ProjectRowValueDraft = { kind: 'json'; json: string } | { kind: 'fields'; fields: ProjectRowField[] };
const PROTECTED = ['id', 'user_id', 'owner_id'];

export function editableProjectRowJson(row: Record<string, unknown>, columns: ProjectDatabaseColumn[], readOnlyColumns: readonly string[] = PROTECTED): string {
  const generated = new Set(columns.filter(column => column.identity || column.generated).map(column => column.name));
  return JSON.stringify(Object.fromEntries(Object.entries(row).filter(([name]) => !readOnlyColumns.includes(name) && !generated.has(name))), null, 2);
}

/** Preserve the typed JSON draft, including unknown fields; metadata grants no write access. */
export function projectRowFields(json: string, columns: ProjectDatabaseColumn[], readOnlyColumns: readonly string[] = PROTECTED): ProjectRowField[] | null {
  if (new TextEncoder().encode(json).byteLength > 32_768) return null;
  let values: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    values = parsed as Record<string, unknown>;
    if (Object.keys(values).length && !parseProjectRowValues(json)) return null;
  } catch { return null; }
  const names = [...new Set([...columns.map(column => column.name), ...Object.keys(values)])];
  return names.map(name => {
    const column = columns.find(column => column.name === name);
    const present = Object.hasOwn(values, name);
    const value = values[name];
    let kind: ProjectRowField['kind'] = column?.dataType === 'boolean' ? 'boolean'
      : ['smallint', 'integer', 'bigint'].includes(column?.dataType || '') ? 'integer'
      : ['text', 'character varying', 'character', 'uuid', 'date', 'timestamp without time zone', 'timestamp with time zone', 'tsvector'].includes(column?.dataType || '') ? 'text' : 'json';
    // Switching input modes must never coerce a draft value into another type.
    if (present && value !== null && ((kind === 'text' && typeof value !== 'string') || (kind === 'integer' && typeof value !== 'number') || (kind === 'boolean' && typeof value !== 'boolean'))) kind = 'json';
    return { name, kind, dataType: column?.dataType, nullable: column?.nullable ?? true,
      readOnly: readOnlyColumns.includes(name) || Boolean(column?.identity || column?.generated),
      mode: present ? value === null ? 'null' : 'value' : 'omit',
      text: present && value !== null ? kind === 'text' ? String(value) : JSON.stringify(value) : kind === 'boolean' ? 'false' : kind === 'integer' ? '0' : kind === 'json' ? '{}' : '' };
  });
}

export function parseProjectRowField(field: ProjectRowField): { value: unknown } | null {
  if (field.mode === 'null') return field.nullable ? { value: null } : null;
  if (field.kind === 'text') return { value: field.text };
  if (field.kind === 'boolean') return ['true', 'false'].includes(field.text) ? { value: field.text === 'true' } : null;
  if (field.kind === 'integer') {
    if (!/^-?(0|[1-9]\d*)$/.test(field.text) || !Number.isSafeInteger(Number(field.text))) return null;
    return { value: Number(field.text) };
  }
  try { return { value: JSON.parse(field.text) as unknown }; } catch { return null; }
}

export function parseProjectRowValueDraft(draft: ProjectRowValueDraft, allowEmpty = false): Record<string, unknown> | null {
  if (draft.kind === 'json') return parseProjectRowValues(draft.json);
  const entries: Array<[string, unknown]> = [];
  for (const field of draft.fields) {
    if (field.mode === 'omit') continue;
    const parsed = parseProjectRowField(field);
    if (!parsed) return null;
    entries.push([field.name, parsed.value]);
  }
  if (new Set(entries.map(([name]) => name)).size !== entries.length) return null;
  if (!entries.length && allowEmpty) return {};
  return parseProjectRowValues(JSON.stringify(Object.fromEntries(entries)));
}

/** Capture the same bounded published snapshot for single and batch mutations. */
export function projectRowMutationTarget(row: Record<string, unknown>, primaryKey: string, publishedColumns?: readonly string[]): { id: string; expected: Record<string, unknown> } | null {
  const id = row[primaryKey];
  if ((typeof id !== 'string' && typeof id !== 'number') || (typeof id === 'number' && !Number.isSafeInteger(id)) || !String(id).length || String(id).length > 512 || (publishedColumns && !publishedColumns.includes(primaryKey))) return null;
  const expected = Object.fromEntries([[primaryKey, id], ...Object.entries(row).filter(([name]) => name !== primaryKey && (!publishedColumns || publishedColumns.includes(name))).slice(0, 7)]);
  return parseProjectRowValues(JSON.stringify(expected), 8) ? { id: String(id), expected } : null;
}
