import { validProjectTableIdentifier } from './projectTableDefinition';
import type { ProjectDatabaseColumn } from './saasConsole';

export interface ProjectTablePublicationInput {
  ownerColumn: string;
  columns: Array<{ name: string; writable: boolean }>;
  maxRows: number;
}
export interface ProjectTablePublication {
  projectId: string;
  schema: string;
  table: string;
  published: boolean;
  source: 'configured' | 'managed' | 'none';
  publication?: {
    primaryKey: string;
    ownerColumn: string;
    columns: Array<{ name: string; kind: 'text' | 'integer' | 'boolean' | 'uuid' | 'json' | 'tsvector'; nullable: boolean; writable: boolean }>;
    maxRows: number;
  };
}

export function projectPublicationColumnKind(dataType: string): 'text' | 'integer' | 'boolean' | 'uuid' | 'json' | 'tsvector' | null {
  if (/^(text|character varying(?:\(\d+\))?|character(?:\(\d+\))?|name)$/.test(dataType)) return 'text';
  if (['smallint', 'integer', 'bigint'].includes(dataType)) return 'integer';
  if (dataType === 'boolean') return 'boolean';
  if (dataType === 'uuid') return 'uuid';
  if (['json', 'jsonb'].includes(dataType)) return 'json';
  if (dataType === 'tsvector') return 'tsvector';
  return null;
}

export function projectPublicationOwnerColumns(columns: ProjectDatabaseColumn[]): ProjectDatabaseColumn[] {
  return columns.filter(column => !column.nullable && !column.identity && !column.generated && projectPublicationColumnKind(column.dataType) === 'text');
}

export function validProjectTablePublicationInput(input: ProjectTablePublicationInput): boolean {
  return validProjectTableIdentifier(input.ownerColumn)
    && Number.isSafeInteger(input.maxRows) && input.maxRows >= 1 && input.maxRows <= 1000
    && input.columns.length >= 1 && input.columns.length <= 64
    && new Set(input.columns.map(column => column.name)).size === input.columns.length
    && input.columns.every(column => validProjectTableIdentifier(column.name) && typeof column.writable === 'boolean')
    && input.columns.some(column => column.name === input.ownerColumn && !column.writable);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function identifier(value: unknown): value is string { return typeof value === 'string' && validProjectTableIdentifier(value); }

/** Retain only the exact table's documented publication projection. */
export function parseProjectTablePublication(value: unknown, projectId: string, schema: string, table: string): ProjectTablePublication | null {
  const root = record(value);
  if (!root || root.schema_version !== 'w-db.table-publication/v1' || root.project_id !== projectId || root.schema !== schema || root.table !== table || typeof root.published !== 'boolean') return null;
  if (!root.published) return root.source === 'none' && root.publication == null ? { projectId, schema, table, published: false, source: 'none' } : null;
  if (root.source !== 'configured' && root.source !== 'managed') return null;
  const spec = record(root.publication);
  if (!spec || !identifier(spec.primary_key) || !identifier(spec.owner_column) || spec.primary_key === spec.owner_column
    || !Number.isSafeInteger(spec.max_rows) || Number(spec.max_rows) < 1 || Number(spec.max_rows) > 1000
    || !Array.isArray(spec.columns) || spec.columns.length < 1 || spec.columns.length > 64) return null;
  const columns: NonNullable<ProjectTablePublication['publication']>['columns'] = [];
  const names = new Set<string>();
  for (const value of spec.columns) {
    const column = record(value);
    if (!column || !identifier(column.name) || names.has(column.name) || !['text', 'integer', 'boolean', 'uuid', 'json', 'tsvector'].includes(String(column.kind)) || typeof column.nullable !== 'boolean' || typeof column.writable !== 'boolean') return null;
    names.add(column.name);
    columns.push({ name: column.name, kind: column.kind as typeof columns[number]['kind'], nullable: column.nullable, writable: column.writable });
  }
  const primary = columns.find(column => column.name === spec.primary_key);
  const owner = columns.find(column => column.name === spec.owner_column);
  if (!primary || primary.nullable || primary.writable || !owner || owner.kind !== 'text' || owner.nullable || owner.writable) return null;
  return { projectId, schema, table, published: true, source: root.source, publication: { primaryKey: spec.primary_key, ownerColumn: spec.owner_column, columns, maxRows: spec.max_rows as number } };
}

export function projectTablePublicationMatches(result: ProjectTablePublication, input: ProjectTablePublicationInput): boolean {
  const spec = result.publication;
  return result.published && result.source === 'managed' && !!spec
    && spec.ownerColumn === input.ownerColumn && spec.maxRows === input.maxRows && spec.columns.length === input.columns.length
    && input.columns.every(desired => spec.columns.some(actual => actual.name === desired.name && actual.writable === (desired.name === spec.primaryKey || desired.name === spec.ownerColumn ? false : desired.writable)));
}
