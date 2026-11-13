import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import { executeProjectSql, parseProjectMigrationFiles, previewProjectSql, processProjectMigrations, serializeProjectTableRows, type ProjectDatabaseOperation, type ProjectMigrationReport, type ProjectSqlPreview, type ProjectSqlResult, type SaasContext } from '../lib/saasConsole';
import type { Lang } from '../i18n';
import { ProjectTableDefinition } from './ProjectTableDefinition';

const COPY = {
  en: { sql: 'SQL editor', sqlNote: 'Preview or execute one bounded read-only statement through the exact project. W-ID and the publishable project key authorize every request; no database URL or server key enters the browser.', preview: 'Preview', execute: 'Execute read-only SQL', cancel: 'Cancel SQL request', cancelled: 'SQL request cancelled. The server may continue until its execution timeout.', sqlLoading: 'Authorizing or processing read-only SQL…', limits: 'Limits', rows: 'rows', columns: 'columns', bytes: 'bytes', truncated: 'Result truncated at the published bound.', noRows: 'Statement returned no rows.', exportJson: 'Download result JSON', exportCsv: 'Download result CSV', exportNote: 'Downloads contain this loaded result only; the query is not run again. JSON includes project and truncation metadata. CSV escapes spreadsheet formulas; truncated downloads are marked in the filename.', exportFailed: 'Could not download the result. The loaded result is still available.', missing: 'Missing field', migrations: 'Migration bundle', migrationNote: 'Enter a JSON array of migration files. Preview validates names, checksums and resource limits. Apply is transactional and requires the exact project ID.', bundle: 'Migration files JSON', migrationHelp: '1–16 files; each name must be `<version>_<name>.sql`; each file ≤64 KiB; bundle ≤256 KiB.', applyConfirm: 'Type the exact project ID to apply', apply: 'Apply transactionally', versions: 'Versions', applied: 'Applied', unchanged: 'Already applied', ready: 'Operation completed.', loading: 'Authorizing the exact project…', auth: 'Your W-ID session expired.', locked: 'The browser project key is missing or revoked.', forbidden: 'Owner/admin membership or the required project scope is missing.', invalid: 'W-DB returned an invalid bounded response.', network: 'W-DB is unavailable.', unknown: 'Migration result is unknown. Refresh migration history before retrying; the server may have committed the bundle.', rejected: 'W-DB rejected this SQL statement or migration bundle.', drift: 'Checksum drift detected (409). No migration was applied.', rolled_back: 'Migration transaction rolled back (422). Earlier files in this bundle were not committed.' },
  zh: { sql: 'SQL 编辑器', sqlNote: '通过精确项目预览或执行一条有界只读语句。每次请求均由 W-ID 与项目发布密钥授权；数据库 URL 和服务器密钥绝不会进入浏览器。', preview: '预览', execute: '执行只读 SQL', cancel: '取消 SQL 请求', cancelled: 'SQL 请求已取消。服务端可能继续运行至执行超时。', sqlLoading: '正在授权或处理只读 SQL…', limits: '限制', rows: '行', columns: '列', bytes: '字节', truncated: '结果已在发布的边界处截断。', noRows: '语句未返回数据行。', exportJson: '下载结果 JSON', exportCsv: '下载结果 CSV', exportNote: '下载仅包含当前已加载结果，不会再次执行查询。JSON 包含项目与截断信息；CSV 会转义电子表格公式，截断下载会在文件名中标明。', exportFailed: '无法下载结果，已加载的结果仍可使用。', missing: '缺失字段', migrations: '迁移 Bundle', migrationNote: '输入迁移文件 JSON 数组。预览会校验名称、Checksum 和资源限制；应用是事务性的，且必须输入完整项目 ID。', bundle: '迁移文件 JSON', migrationHelp: '1–16 个文件；名称必须为 `<version>_<name>.sql`；单文件不超过 64 KiB，Bundle 不超过 256 KiB。', applyConfirm: '输入完整项目 ID 以应用', apply: '事务性应用', versions: '版本', applied: '已应用', unchanged: '已存在', ready: '操作已完成。', loading: '正在授权精确项目…', auth: 'W-ID 会话已过期。', locked: '浏览器项目密钥缺失或已撤销。', forbidden: '缺少 Owner/Admin 成员关系或所需项目 Scope。', invalid: 'W-DB 返回了无效的有界响应。', network: 'W-DB 暂时不可用。', unknown: '迁移结果未知。重试前请刷新迁移历史，服务端可能已提交此 Bundle。', rejected: 'W-DB 拒绝了这条 SQL 或迁移 Bundle。', drift: '检测到 Checksum Drift（409），未应用任何迁移。', rolled_back: '迁移事务已回滚（422），此 Bundle 中先前文件也未提交。' },
} as const;

type OperationState = ProjectDatabaseOperation<ProjectSqlPreview | ProjectSqlResult | ProjectMigrationReport> | { status: 'unknown' | 'cancelled' } | null;

export function ProjectDatabaseOperations({ lang, context, projectId, publishableKey, refreshMigrations }: { lang: Lang; context: SaasContext; projectId: string; publishableKey: string; refreshMigrations: (signal?: AbortSignal) => Promise<void> }) {
  const t = COPY[lang]; const [sql, setSql] = useState('SELECT 1 AS value'); const [sqlState, setSqlState] = useState<OperationState>(null); const [migrationJson, setMigrationJson] = useState('[\n  {\n    "name": "202608020001_create_items.sql",\n    "sql": "CREATE TABLE items (id bigint PRIMARY KEY)"\n  }\n]'); const [migrationConfirm, setMigrationConfirm] = useState(''); const [migrationState, setMigrationState] = useState<OperationState>(null); const [pending, setPending] = useState<'sql' | 'migration' | null>(null); const [exportFailed, setExportFailed] = useState(false);
  const busy = pending !== null;
  const actionController = useRef<{ controller: AbortController; kind: 'sql' | 'migration' } | null>(null);
  const objectUrls = useRef<Array<{ url: string; timer: number }>>([]);
  useEffect(() => () => { actionController.current?.controller.abort(); actionController.current = null; for (const { url, timer } of objectUrls.current) { window.clearTimeout(timer); URL.revokeObjectURL(url); } objectUrls.current = []; }, []);
  const runOperation = async (operation: (bearer: string | null, request: typeof fetch) => Promise<NonNullable<OperationState>>, setResult: (state: OperationState) => void, kind: 'sql' | 'migration', apply = false) => {
    if (actionController.current) return;
    const controller = new AbortController(); actionController.current = { controller, kind };
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); return fetch(input, { ...init, signal }); };
    const current = () => actionController.current?.controller === controller && !controller.signal.aborted;
    let started = false;
    setPending(kind); setResult(null);
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted(); started = true;
      const result = await operation(bearer, request);
      if (!current()) return;
      if (signal.aborted || result.status === 'network') { setResult({ status: apply ? 'unknown' : 'network' }); return; }
      setResult(result);
      if (apply && result.status === 'ready') {
        setMigrationConfirm('');
        // A verified commit remains successful if refreshing its history fails.
        await refreshMigrations(signal).catch(() => {});
      }
    } catch { if (current()) setResult({ status: started ? apply ? 'unknown' : 'network' : 'auth' }); }
    finally { if (current()) { actionController.current = null; setPending(null); } }
  };
  const runSql = (mode: 'preview' | 'execute') => { setExportFailed(false); return runOperation((bearer, request) => mode === 'preview' ? previewProjectSql(context, projectId, sql, publishableKey, bearer, request) : executeProjectSql(context, projectId, sql, publishableKey, bearer, request), setSqlState, 'sql'); };
  const cancelSql = () => {
    const action = actionController.current;
    if (action?.kind !== 'sql') return;
    // Release before aborting so late results/finalizers cannot affect a new action.
    actionController.current = null;
    action.controller.abort();
    setPending(null); setSqlState({ status: 'cancelled' }); setExportFailed(false);
  };
  const runMigrations = async (mode: 'preview' | 'apply') => {
    if (actionController.current) return;
    const files = parseProjectMigrationFiles(migrationJson);
    if (!files || (mode === 'apply' && migrationConfirm !== projectId)) { setMigrationState({ status: 'invalid' }); return; }
    await runOperation((bearer, request) => processProjectMigrations(context, projectId, mode, files, publishableKey, bearer, request), setMigrationState, 'migration', mode === 'apply');
  };
  const message = (state: OperationState) => state && state.status !== 'ready' ? t[state.status] : null;
  const sqlResult = sqlState?.status === 'ready' && 'rows' in sqlState.data ? sqlState.data as ProjectSqlResult : null; const sqlPreview = sqlState?.status === 'ready' && 'limits' in sqlState.data ? sqlState.data as ProjectSqlPreview : null; const migrationResult = migrationState?.status === 'ready' && 'mode' in migrationState.data ? migrationState.data as ProjectMigrationReport : null;
  const sqlColumns = [...new Set(sqlResult?.rows.flatMap(row => Object.keys(row)) || [])];
  const exportResult = (format: 'json' | 'csv') => {
    if (!sqlResult || busy || actionController.current || (format === 'csv' && !sqlResult.rows.length)) return;
    setExportFailed(false);
    try {
      const content = format === 'json' ? `${JSON.stringify({ project_id: projectId, ...sqlResult }, null, 2)}\n` : serializeProjectTableRows(sqlResult.rows, 'csv');
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const timer = window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter(item => item.url !== url); }, 1000);
      objectUrls.current.push({ url, timer });
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)}-sql-result${sqlResult.truncated ? '-truncated' : ''}.${format}`;
      anchor.click();
    } catch { setExportFailed(true); }
  };
  return <div className="console-database-operations"><section className="console-key-management" aria-labelledby="database-sql-title"><h3 id="database-sql-title">{t.sql}</h3><p className="console-note">{t.sqlNote}</p><label><span className="sr-only">SQL</span><textarea rows={8} disabled={busy} value={sql} maxLength={65536} spellCheck={false} onChange={(event) => { setSql(event.target.value); setSqlState(null); setExportFailed(false); }} /></label><div className="console-row-actions"><button type="button" disabled={busy || !sql.trim()} onClick={() => void runSql('preview')}>{t.preview}</button><button className="site-nav-button" type="button" disabled={busy || !sql.trim()} onClick={() => void runSql('execute')}>{t.execute}</button>{pending === 'sql' && <button type="button" onClick={cancelSql}>{t.cancel}</button>}</div>{sqlPreview && <p role="status"><strong>{t.limits}:</strong> {sqlPreview.limits.rows} {t.rows} · {sqlPreview.limits.columns} {t.columns} · {sqlPreview.limits.bytes} {t.bytes}</p>}{sqlResult && <div className="console-sql-result">{sqlResult.rows.length ? <div role="region" aria-label={t.rows} tabIndex={0}><table><thead><tr>{sqlColumns.map(key => <th key={key} scope="col">{key}</th>)}</tr></thead><tbody>{sqlResult.rows.map((row, index) => <tr key={index}>{sqlColumns.map(key => <td key={key}>{Object.hasOwn(row, key) ? <code>{JSON.stringify(row[key])}</code> : <span aria-label={t.missing}>—</span>}</td>)}</tr>)}</tbody></table></div> : <p>{t.noRows}</p>}<p>{sqlResult.bytes} {t.bytes}{sqlResult.truncated ? ` · ${t.truncated}` : ''}</p><div className="console-row-actions"><button type="button" disabled={busy} onClick={() => exportResult('json')}>{t.exportJson}</button><button type="button" disabled={busy || !sqlResult.rows.length} onClick={() => exportResult('csv')}>{t.exportCsv}</button></div><p className="console-note">{t.exportNote}</p>{exportFailed && <p role="alert">{t.exportFailed}</p>}</div>}{message(sqlState) && <p role={sqlState?.status === 'cancelled' ? 'status' : 'alert'} className={sqlState?.status === 'cancelled' ? 'console-status' : 'console-status is-error'}>{message(sqlState)}</p>}</section>
    <section className="console-key-management" aria-labelledby="database-migration-apply-title"><h3 id="database-migration-apply-title">{t.migrations}</h3><p className="console-note">{t.migrationNote}</p><ProjectTableDefinition lang={lang} disabled={busy} onPrepare={file => { setMigrationJson(JSON.stringify([file], null, 2)); setMigrationState(null); setMigrationConfirm(''); }} /><label>{t.bundle}<textarea rows={12} disabled={busy} value={migrationJson} maxLength={280000} spellCheck={false} onChange={(event) => { setMigrationJson(event.target.value); setMigrationState(null); }} /></label><small>{t.migrationHelp}</small><div className="console-row-actions"><button type="button" disabled={busy} onClick={() => void runMigrations('preview')}>{t.preview}</button></div><label>{t.applyConfirm}<input disabled={busy} value={migrationConfirm} autoComplete="off" onChange={(event) => setMigrationConfirm(event.target.value)} /></label><button className="site-nav-button" type="button" disabled={busy || migrationConfirm !== projectId} onClick={() => void runMigrations('apply')}>{t.apply}</button>{migrationResult && <dl><dt>{t.versions}</dt><dd>{migrationResult.versions.join(', ') || '—'}</dd><dt>{t.applied}</dt><dd>{migrationResult.applied.join(', ') || '—'}</dd><dt>{t.unchanged}</dt><dd>{migrationResult.alreadyApplied.join(', ') || '—'}</dd></dl>}{message(migrationState) && <p role="alert" className="console-status is-error">{message(migrationState)}</p>}</section>{busy && <p role="status" aria-live="polite">{pending === 'sql' ? t.sqlLoading : t.loading}</p>}</div>;
}
