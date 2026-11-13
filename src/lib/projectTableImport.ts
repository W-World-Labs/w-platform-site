import { projectRowFields, parseProjectRowField } from './projectRowEditor';
import { parseProjectTableImport, PROJECT_TABLE_IMPORT_MAX_BYTES, type ProjectDatabaseColumn } from './saasConsole';

/** CSV uses exact column names and types; only an unquoted \N denotes SQL NULL. */
export function parseProjectTableCsv(input: string, columns: ProjectDatabaseColumn[], readOnlyColumns?: readonly string[]): Record<string, unknown>[] | null {
  if (new TextEncoder().encode(input).byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES || !columns.length) return null;
  const source = input.startsWith('\uFEFF') ? input.slice(1) : input;
  const records: Array<Array<{ text: string; quoted: boolean }>> = [];
  let record: Array<{ text: string; quoted: boolean }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const quoted = source[cursor] === '"';
    let text = '';
    if (quoted) {
      cursor++;
      let closed = false;
      while (cursor < source.length) {
        const character = source[cursor++];
        if (character !== '"') { text += character; continue; }
        if (source[cursor] === '"') { text += '"'; cursor++; continue; }
        closed = true; break;
      }
      if (!closed) return null;
    } else {
      while (cursor < source.length && ![',', '\r', '\n'].includes(source[cursor])) {
        if (source[cursor] === '"') return null;
        text += source[cursor++];
      }
    }
    record.push({ text, quoted });
    if (record.length > 64) return null;
    const delimiter = source[cursor++];
    if (delimiter === ',') {
      if (cursor === source.length) { record.push({ text: '', quoted: false }); if (record.length > 64) return null; }
      else continue;
    } else if (delimiter === '\r') {
      if (source[cursor++] !== '\n') return null;
    } else if (delimiter !== undefined && delimiter !== '\n') return null;
    records.push(record); record = [];
    if (records.length > 101) return null;
  }
  if (records.length < 2) return null;
  const headers = records[0].map(cell => cell.text);
  if (new Set(headers).size !== headers.length) return null;
  const fields = projectRowFields('{}', columns, readOnlyColumns);
  const selected = headers.map(name => fields?.find(field => field.name === name));
  if (selected.some(field => !field || field.readOnly)) return null;
  const rows: Record<string, unknown>[] = [];
  for (const cells of records.slice(1)) {
    if (cells.length !== headers.length) return null;
    const entries: Array<[string, unknown]> = [];
    for (let index = 0; index < cells.length; index++) {
      const field = selected[index]!;
      const cell = cells[index];
      const parsed = parseProjectRowField({ ...field, text: cell.text, mode: !cell.quoted && cell.text === '\\N' ? 'null' : 'value' });
      if (!parsed || (parsed.value === null && !field.nullable)) return null;
      // JSON fields must not silently turn unsafe integers or non-finite numbers into other values.
      const values = [parsed.value];
      while (values.length) {
        const value = values.pop();
        if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) return null;
        if (value && typeof value === 'object') for (const child of Object.values(value)) values.push(child);
      }
      entries.push([field.name, parsed.value]);
    }
    rows.push(Object.fromEntries(entries));
  }
  try { return parseProjectTableImport(JSON.stringify(rows)); } catch { return null; }
}
