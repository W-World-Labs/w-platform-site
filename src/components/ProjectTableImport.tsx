import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { parseProjectTableImport, PROJECT_TABLE_IMPORT_MAX_BYTES, type ProjectDatabaseColumn, type ProjectTableImportReceipt, type ProjectTableImportResult } from '../lib/saasConsole';
import { parseProjectTableCsv } from '../lib/projectTableImport';

const TEXT = {
  en: { title: 'Import JSON rows', note: 'Import 1–100 objects in one transaction, up to 1 MiB total, 64 fields and 32 KiB per row. Omitted fields use database defaults; NULL, empty text, zero and false retain their values. Access policies still apply.', input: 'Import rows JSON', file: 'Choose JSON file', preview: 'Preview import', confirm: 'Type the exact table name to import', submit: 'Import rows', reset: 'Start a new import', sample: 'Preview of the first 3 rows', invalid: 'Choose a valid JSON array within the import limits.', failed: 'The import was rejected. Your draft is still available.', unsupported: 'Batch import is unavailable on this backend. Your draft is still available.', unknown: 'The import result is uncertain. Refresh the table and check for inserted rows before starting a new import.', done: 'Import committed', rows: 'rows', receipt: 'Mutation ID' },
  zh: { title: '导入 JSON 数据行', note: '一次事务导入 1–100 个对象，总量最多 1 MiB，每行最多 64 个字段、32 KiB。省略字段使用数据库默认值；NULL、空文本、零和 false 保留原值。访问策略仍然生效。', input: '导入行 JSON', file: '选择 JSON 文件', preview: '预览导入', confirm: '输入完整表名以导入', submit: '导入数据行', reset: '开始新的导入', sample: '前 3 行预览', invalid: '请选择符合导入限制的 JSON 数组。', failed: '导入被拒绝，输入内容仍已保留。', unsupported: '当前后端尚不支持批量导入，输入内容仍已保留。', unknown: '导入结果尚不确定。请刷新数据表并核对新增行，再开始新的导入。', done: '导入已提交', rows: '行', receipt: '操作 ID' },
};
const CSV_TEXT = {
  en: { title: 'Import CSV rows', format: 'Import format', input: 'Import rows CSV', file: 'Choose CSV file', note: 'Use exact column names in the header. Omitted columns use defaults. Values follow column types; empty text stays empty, and unquoted \\N means NULL. Quote commas, newlines and double quotes; escape quotes by doubling them. Identity, generated and read-only columns cannot be imported. The same transaction and size limits apply.', invalid: 'Choose valid CSV with writable column headers and values matching the table types and import limits.', unavailable: 'Refresh the database schema to enable CSV import.' },
  zh: { title: '导入 CSV 数据行', format: '导入格式', input: '导入行 CSV', file: '选择 CSV 文件', note: '首行使用完整列名，省略列使用默认值。数值按列类型解析；空文本保持为空，未加引号的 \\N 表示 NULL。逗号、换行和双引号需要加引号，内部双引号写成两个。不能导入自增列、生成列和只读列。事务和大小限制与 JSON 相同。', invalid: '请选择包含可写列名、字段类型正确且符合导入限制的 CSV。', unavailable: '请刷新数据库结构以启用 CSV 导入。' },
};

export function ProjectTableImport({ lang, schema, table, columns, readOnlyColumns, disabled, onImport }: {
  lang: Lang; schema: string; table: string; disabled: boolean;
  columns: ProjectDatabaseColumn[]; readOnlyColumns?: readonly string[];
  onImport: (rows: Record<string, unknown>[], onReady: (receipt: ProjectTableImportReceipt) => void) => Promise<ProjectTableImportResult | undefined>;
}) {
  const t = TEXT[lang];
  const csv = CSV_TEXT[lang];
  const scope = `${schema}.${table}`;
  const generation = useRef(0);
  const pending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [previewDraft, setPreview] = useState<{ rows: Record<string, unknown>[]; metadata: string } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'invalid' | 'failed' | 'unsupported' | 'unknown'>('idle');
  const [receipt, setReceipt] = useState<ProjectTableImportReceipt | null>(null);
  useEffect(() => () => { generation.current++; }, []);
  const locked = disabled || reading;
  const metadata = JSON.stringify([columns, readOnlyColumns]);
  const preview = previewDraft && (format === 'json' || previewDraft.metadata === metadata) ? previewDraft.rows : null;
  const parse = (value: string) => format === 'csv' ? parseProjectTableCsv(value, columns, readOnlyColumns) : parseProjectTableImport(value);
  const changeInput = (value: string) => { setInput(value); setPreview(null); setConfirmation(''); setStatus('idle'); };
  const readFile = async (file: File | undefined) => {
    const current = ++generation.current;
    changeInput('');
    if (!file) return;
    if (file.size > PROJECT_TABLE_IMPORT_MAX_BYTES) { setStatus('invalid'); return; }
    setReading(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const bytes = await Promise.race([file.arrayBuffer(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('file read timeout')), 30_000); })]);
      if (bytes.byteLength > PROJECT_TABLE_IMPORT_MAX_BYTES) throw new Error('file too large');
      const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (current !== generation.current) return;
      changeInput(value);
      if (!parse(value)) setStatus('invalid');
    } catch { if (current === generation.current) setStatus('invalid'); }
    finally { clearTimeout(timer); if (current === generation.current) setReading(false); }
  };
  const submit = async () => {
    if (locked || pending.current || status === 'unknown' || !preview || confirmation !== scope) return;
    pending.current = true;
    const current = generation.current;
    try {
      const result = await onImport(preview, (value) => {
        if (current !== generation.current) return;
        setReceipt(value); setInput(''); setPreview(null); setConfirmation(''); setStatus('idle');
        if (fileInput.current) fileInput.current.value = '';
      });
      if (current !== generation.current) return;
      if (result?.status !== 'ready') setStatus(result?.status === 'unsupported' ? 'unsupported' : !result || result.status === 'unknown' || result.status === 'network' ? 'unknown' : 'failed');
    } catch { if (current === generation.current) setStatus('unknown'); }
    finally { pending.current = false; }
  };
  return <div className="console-table-import">
    <h4>{format === 'csv' ? csv.title : t.title}</h4><p className="console-note">{t.note}</p>
    <label>{csv.format}<select value={format} disabled={locked || status === 'unknown'} onChange={event => { if (pending.current) return; generation.current++; setFormat(event.target.value as 'json' | 'csv'); changeInput(''); if (fileInput.current) fileInput.current.value = ''; }}><option value="json">JSON</option><option value="csv" disabled={!columns.length}>CSV</option></select></label>
    {!columns.length && <p className="console-note">{csv.unavailable}</p>}
    {format === 'csv' && <p className="console-note">{csv.note}</p>}
    {receipt && <p role="status">{t.done}: <strong>{receipt.affectedRows} {t.rows}</strong> · <code>{receipt.schema}.{receipt.table}</code> · {t.receipt}: <code>{receipt.mutationId}</code></p>}
    <label>{format === 'csv' ? csv.file : t.file}<input ref={fileInput} type="file" accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'} disabled={locked || status === 'unknown'} onChange={event => void readFile(event.target.files?.[0])} /></label>
    <label>{format === 'csv' ? csv.input : t.input}<textarea rows={6} value={input} disabled={locked || status === 'unknown'} onChange={event => { generation.current++; changeInput(event.target.value); }} /></label>
    <button type="button" disabled={locked || status === 'unknown'} onClick={() => { const rows = parse(input); setPreview(rows ? { rows, metadata } : null); setConfirmation(''); setStatus(rows ? 'idle' : 'invalid'); }}>{t.preview}</button>
    {preview && <>
      <p><strong>{preview.length} {t.rows}</strong> → <code>{scope}</code></p>
      <p>{t.sample}</p><pre tabIndex={0} role="region" aria-label={t.sample}>{JSON.stringify(preview.slice(0, 3), null, 2)}</pre>
      <label>{t.confirm}<input value={confirmation} placeholder={scope} disabled={locked || status === 'unknown'} onChange={event => setConfirmation(event.target.value)} /></label>
      <button type="button" className="site-nav-button" disabled={locked || status === 'unknown' || confirmation !== scope} onClick={() => void submit()}>{t.submit}</button>
    </>}
    {status !== 'idle' && <p role="alert">{status === 'invalid' && format === 'csv' ? csv.invalid : t[status]}</p>}
    {status === 'unknown' && <button type="button" disabled={locked} onClick={() => { generation.current++; changeInput(''); if (fileInput.current) fileInput.current.value = ''; }}>{t.reset}</button>}
  </div>;
}
