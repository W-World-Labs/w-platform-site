export const PROJECT_TABLE_FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'not.is'] as const;
export type ProjectTableFilter = { column: string; operator: typeof PROJECT_TABLE_FILTER_OPERATORS[number]; value: string | number | boolean | null };
export type ProjectTableQuery = { filters: ProjectTableFilter[]; order?: { column: string; descending: boolean; nullsFirst: boolean } };

function columnName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).byteLength <= 63 && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

/** Encode only bounded typed predicates; values never become SQL or filter syntax. */
export function projectTableQueryParams(query: ProjectTableQuery): string | null {
  if (!Array.isArray(query.filters) || query.filters.length > 8) return null;
  for (const filter of query.filters) {
    if (!columnName(filter.column) || !PROJECT_TABLE_FILTER_OPERATORS.includes(filter.operator)) return null;
    const { value, operator } = filter;
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) return null;
    if (operator === 'is' || operator === 'not.is') { if (value !== null && typeof value !== 'boolean') return null; }
    else if (value === null || ((operator === 'like' || operator === 'ilike') && typeof value !== 'string')) return null;
  }
  const params = new URLSearchParams();
  if (query.filters.length) {
    const filters = JSON.stringify(query.filters);
    if (new TextEncoder().encode(filters).byteLength > 4096) return null;
    params.set('filters', filters);
  }
  if (query.order) {
    const { column, descending, nullsFirst } = query.order;
    if (!columnName(column) || typeof descending !== 'boolean' || typeof nullsFirst !== 'boolean') return null;
    params.set('order', `${column}.${descending ? 'desc' : 'asc'}.${nullsFirst ? 'nullsfirst' : 'nullslast'}`);
  }
  return params.toString();
}

export function parseProjectTableFilterValue(kind: 'text' | 'number' | 'boolean' | 'null', input: string): ProjectTableFilter['value'] | undefined {
  if (kind === 'null') return null;
  if (kind === 'text') return input;
  if (kind === 'boolean') return input === 'true' ? true : input === 'false' ? false : undefined;
  try {
    const value: unknown = JSON.parse(input);
    return typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) ? value : undefined;
  } catch { return undefined; }
}
