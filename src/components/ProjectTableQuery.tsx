import { useState } from 'react';
import type { Lang } from '../i18n';
import type { ProjectDatabaseColumn } from '../lib/saasConsole';
import { parseProjectTableFilterValue, projectTableQueryParams, PROJECT_TABLE_FILTER_OPERATORS, type ProjectTableFilter, type ProjectTableQuery as TableQuery } from '../lib/projectTableQuery';

const TEXT = {
  en: { title: 'Filter and sort rows', note: 'Up to 8 conditions, combined with AND. Apply searches the server and resets to page 1; row counts and downloads use the applied query. Editing a draft does not change the loaded rows. Text patterns use % for any characters and _ for one character.', column: 'Filter column', operator: 'Filter operator', kind: 'Filter value type', value: 'Filter value', text: 'Text', number: 'Number', boolean: 'Boolean', null: 'NULL', add: 'Add condition', remove: 'Remove condition', sort: 'Sort column', defaultOrder: 'Default primary-key order', direction: 'Sort direction', ascending: 'Ascending', descending: 'Descending', nulls: 'NULL placement', nullsFirst: 'NULL first', nullsLast: 'NULL last', apply: 'Apply filter and sort', clear: 'Clear filter and sort', invalid: 'Enter valid values within the 4 KiB filter limit. Use is or not.is for NULL; numbers must be finite and integers within the safe range.', applied: 'Applied query', unfiltered: 'All visible rows, default order', missing: 'Column metadata is required to build a query.' },
  zh: { title: '筛选与排序', note: '最多 8 个条件，以 AND 连接。点击应用后从服务端筛选并回到第 1 页，统计和下载使用已应用的条件。编辑草稿不会改变已加载的数据行。文本通配条件以 % 匹配多个字符、_ 匹配单个字符。', column: '筛选字段', operator: '筛选运算符', kind: '筛选值类型', value: '筛选值', text: '文本', number: '数字', boolean: '布尔值', null: 'NULL', add: '添加条件', remove: '移除条件', sort: '排序字段', defaultOrder: '默认主键顺序', direction: '排序方向', ascending: '升序', descending: '降序', nulls: 'NULL 位置', nullsFirst: 'NULL 在前', nullsLast: 'NULL 在后', apply: '应用筛选与排序', clear: '清除筛选与排序', invalid: '请输入有效值，筛选总量最多 4 KiB。NULL 使用 is 或 not.is；数字须有限，整数须在安全范围内。', applied: '已应用条件', unfiltered: '全部可见行，默认顺序', missing: '需要字段元数据才能构建查询。' },
};
type FilterDraft = { column: string; operator: ProjectTableFilter['operator']; kind: 'text' | 'number' | 'boolean' | 'null'; text: string };

export function ProjectTableQuery({ lang, columns, applied, disabled, onApply }: { lang: Lang; columns: ProjectDatabaseColumn[]; applied: TableQuery; disabled: boolean; onApply: (query: TableQuery) => void }) {
  const t = TEXT[lang];
  const [filters, setFilters] = useState<FilterDraft[]>([]);
  const [sortColumn, setSortColumn] = useState('');
  const [descending, setDescending] = useState(false);
  const [nullsFirst, setNullsFirst] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const query: TableQuery = { filters: [], ...(sortColumn ? { order: { column: sortColumn, descending, nullsFirst } } : {}) };
  let valid = true;
  for (const filter of filters) {
    const value = parseProjectTableFilterValue(filter.kind, filter.text);
    if (value === undefined) valid = false;
    else query.filters.push({ column: filter.column, operator: filter.operator, value });
  }
  valid = valid && projectTableQueryParams(query) !== null;
  const defaultFilter = (column = columns[0]?.name || ''): FilterDraft => {
    const type = columns.find(item => item.name === column)?.dataType || '';
    const kind = /^(?:boolean|bool)$/i.test(type) ? 'boolean' : /^(?:smallint|integer|bigint|numeric|decimal|real|double precision|int[248]|float[48])(?:$|\s|\()/i.test(type) ? 'number' : 'text';
    return { column, operator: 'eq', kind, text: kind === 'boolean' ? 'false' : kind === 'number' ? '0' : '' };
  };
  const update = (index: number, patch: Partial<FilterDraft>) => { setInvalid(false); setFilters(filters.map((item, i) => i === index ? { ...item, ...patch } : item)); };
  const clear = () => { setFilters([]); setSortColumn(''); setDescending(false); setNullsFirst(false); setInvalid(false); onApply({ filters: [] }); };
  return <details className="console-table-query">
    <summary>{t.title}</summary><p className="console-note">{t.note}</p>
    <p className="console-table-query-applied">{t.applied}: {applied.filters.length || applied.order ? <code>{JSON.stringify(applied)}</code> : t.unfiltered}</p>
    {!columns.length ? <p>{t.missing}</p> : <form onSubmit={event => { event.preventDefault(); if (valid) { setInvalid(false); onApply(query); } else setInvalid(true); }}>
      {filters.map((filter, index) => <fieldset key={index} disabled={disabled}>
        <legend>{index + 1}</legend>
        <label>{t.column}<select aria-label={t.column} value={filter.column} onChange={event => { setInvalid(false); setFilters(filters.map((item, i) => i === index ? defaultFilter(event.target.value) : item)); }}>{columns.map(column => <option key={column.name}>{column.name}</option>)}</select></label>
        <label>{t.operator}<select aria-label={t.operator} value={filter.operator} onChange={event => { const operator = event.target.value as FilterDraft['operator']; update(index, { operator, ...((operator === 'is' || operator === 'not.is') && !['null', 'boolean'].includes(filter.kind) ? { kind: 'null', text: '' } : {}), ...((operator === 'like' || operator === 'ilike') ? { kind: 'text' } : {}) }); }}>{PROJECT_TABLE_FILTER_OPERATORS.map(operator => <option key={operator}>{operator}</option>)}</select></label>
        <label>{t.kind}<select aria-label={t.kind} value={filter.kind} onChange={event => { const kind = event.target.value as FilterDraft['kind']; update(index, { kind, text: kind === 'boolean' ? 'false' : kind === 'number' ? '0' : '' }); }}>{(['text', 'number', 'boolean', 'null'] as const).map(kind => <option key={kind} value={kind}>{t[kind]}</option>)}</select></label>
        {filter.kind === 'boolean' ? <label>{t.value}<select aria-label={t.value} value={filter.text} onChange={event => update(index, { text: event.target.value })}><option>false</option><option>true</option></select></label> : filter.kind !== 'null' && <label>{t.value}<input value={filter.text} inputMode={filter.kind === 'number' ? 'decimal' : 'text'} onChange={event => update(index, { text: event.target.value })} /></label>}
        <button type="button" onClick={() => { setInvalid(false); setFilters(filters.filter((_, i) => i !== index)); }}>{t.remove}</button>
      </fieldset>)}
      <button type="button" disabled={disabled || filters.length >= 8} onClick={() => { setInvalid(false); setFilters([...filters, defaultFilter()]); }}>{t.add}</button>
      <div className="console-table-query-sort">
        <label>{t.sort}<select aria-label={t.sort} disabled={disabled} value={sortColumn} onChange={event => { setSortColumn(event.target.value); setInvalid(false); }}><option value="">{t.defaultOrder}</option>{columns.map(column => <option key={column.name}>{column.name}</option>)}</select></label>
        <label>{t.direction}<select aria-label={t.direction} disabled={disabled || !sortColumn} value={descending ? 'desc' : 'asc'} onChange={event => setDescending(event.target.value === 'desc')}><option value="asc">{t.ascending}</option><option value="desc">{t.descending}</option></select></label>
        <label>{t.nulls}<select aria-label={t.nulls} disabled={disabled || !sortColumn} value={nullsFirst ? 'first' : 'last'} onChange={event => setNullsFirst(event.target.value === 'first')}><option value="last">{t.nullsLast}</option><option value="first">{t.nullsFirst}</option></select></label>
      </div>
      {(!valid || invalid) && <p role="alert">{t.invalid}</p>}
      <div className="console-row-actions"><button type="submit" disabled={disabled || !valid}>{t.apply}</button><button type="button" disabled={disabled} onClick={clear}>{t.clear}</button></div>
    </form>}
  </details>;
}
