import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import {
  deleteProjectRlsPolicy, loadProjectDatabaseTypes, loadProjectMigrations, loadProjectRlsPolicies, loadProjectTableRows,
  importProjectTableRows, deleteProjectTableRows, mutateProjectTableRow, saveProjectRlsPolicy, serializeProjectTableRows,
  type ProjectConsoleData, type ProjectDatabaseTypes, type ProjectMigrationInventory, type ProjectPanelState,
  type ProjectRlsPolicy, type ProjectRlsPolicyInput, type ProjectTableRows, type SaasContext,
} from '../lib/saasConsole';
import type { Lang } from '../i18n';
import { editableProjectRowJson, projectRowMutationTarget, parseProjectRowValueDraft, type ProjectRowValueDraft } from '../lib/projectRowEditor';
import { ProjectRowValueEditor } from './ProjectRowValueEditor';
import { ProjectTableImport } from './ProjectTableImport';
import { ProjectTableQuery } from './ProjectTableQuery';
import { ProjectTablePublication } from './ProjectTablePublication';
import { ProjectTableRealtime } from './ProjectTableRealtime';
import type { ProjectTablePublication as Publication } from '../lib/projectTablePublication';
import type { ProjectTableQuery as TableQuery } from '../lib/projectTableQuery';
import { ProjectDatabaseOperations } from './ProjectDatabaseOperations';

const TEXT = {
  en: { title: 'Database', note: 'Inspect and change only the selected project through W-DB’s project-scoped APIs. Database credentials never enter the browser.', unlock: 'Unlock database console', locked: 'Create an in-memory 15-minute console key to continue.', tables: 'Tables', rows: 'Rows', empty: 'No visible rows.', add: 'Add row', edit: 'Edit', remove: 'Delete', values: 'Row values', save: 'Save', cancel: 'Cancel', confirm: 'Confirm exact row deletion', migrations: 'Migrations', noMigrations: 'No applied migrations.', sql: 'SQL editor', sqlMissing: 'Disabled: W-DB does not currently expose a canonical, project-scoped SQL execution API.', apply: 'Apply migration', applyMissing: 'Disabled: W-DB exposes bounded migration execution in its operator CLI, but no canonical project-console HTTP apply contract.', rls: 'RLS policies', policyName: 'Policy name', command: 'Command', rule: 'Rule', column: 'Claim-bound column', restrictive: 'Restrictive', create: 'Create policy', update: 'Update policy', deletePolicy: 'Delete policy', deleteConfirm: 'Type the exact policy name to delete.', refresh: 'Refresh', loading: 'Loading exact-project data…', failed: 'W-DB rejected the operation or returned an invalid contract.', done: 'Operation completed.', noPolicies: 'No policies on this table.', previous: 'Previous page', next: 'Next page', page: 'Page', pagination: 'Table row pages', selectRow: 'Select row', selectPage: 'Select current page', selected: 'Selected rows', clearSelection: 'Clear selection', deleteSelected: 'Delete selected rows', confirmBatch: 'Confirm deletion of all selected rows', batchNote: 'Only selected rows on this loaded page will be deleted. If a selected snapshot no longer matches, the whole batch is rejected. Refresh after an uncertain result before trying again.', countVisible: 'Count visible rows', countFailed: 'Could not count visible rows. The loaded rows are still available.', visibleRows: 'Visible rows', rowRange: 'Rows', of: 'of', types: 'TypeScript types', refreshTypes: 'Refresh types', downloadTypes: 'Download database.types.ts', typePreview: 'Generated database.types.ts', typesLoading: 'Loading published TypeScript types…', typesFailed: 'Could not refresh or download the current types. Previously loaded content is still available.', typesNote: 'Types are generated from the project’s published database schema.', stale: 'This row changed since it was loaded. Refresh before editing again.', unknown: 'The request did not finish reliably. Refresh before retrying; the server may have completed the change.', rowNumber: 'Row', actions: 'Actions', missingField: 'Missing field', structure: 'Table structure', columnName: 'Column', type: 'Type', nullable: 'Nullable', defaults: 'Has default', identity: 'Identity', generated: 'Generated', yes: 'Yes', no: 'No', noColumns: 'Column metadata is unavailable.', exportJson: 'Export page JSON', exportCsv: 'Export page CSV', exportNote: 'Downloads contain only this loaded page. JSON preserves types; CSV escapes formula-like text for spreadsheets.' },
  zh: { title: '数据库', note: '仅通过 W-DB 项目级 API 查看和修改所选项目，数据库凭证绝不会进入浏览器。', unlock: '解锁数据库控制台', locked: '创建一个仅存于内存、有效期 15 分钟的控制台密钥后继续。', tables: '数据表', rows: '数据行', empty: '没有当前账号可见的数据行。', add: '新增行', edit: '编辑', remove: '删除', values: '数据行字段值', save: '保存', cancel: '取消', confirm: '确认精确删除此行', migrations: '迁移', noMigrations: '尚无已应用迁移。', sql: 'SQL 编辑器', sqlMissing: '已禁用：W-DB 当前没有项目级 canonical SQL 执行 API。', apply: '应用迁移', applyMissing: '已禁用：W-DB 的运维 CLI 有有界迁移执行，但尚无 canonical 项目控制台 HTTP apply 契约。', rls: 'RLS 策略', policyName: '策略名称', command: '命令', rule: '规则', column: '绑定 Claim 的列', restrictive: '限制性策略', create: '创建策略', update: '更新策略', deletePolicy: '删除策略', deleteConfirm: '请输入完整策略名称以删除。', refresh: '刷新', loading: '正在加载精确项目数据…', failed: 'W-DB 拒绝了操作或返回无效契约。', done: '操作已完成。', noPolicies: '此表尚无策略。', previous: '上一页', next: '下一页', page: '页', pagination: '数据行分页', selectRow: '选择行', selectPage: '选择当前页', selected: '已选择行', clearSelection: '清除选择', deleteSelected: '删除选中行', confirmBatch: '确认删除全部选中行', batchNote: '仅删除当前已加载页中选中的数据行。若任一选中行的快照已不匹配，将拒绝整批删除。结果不确定时请刷新确认后再操作。', countVisible: '统计可见行', countFailed: '无法统计可见行，已加载的数据行仍可使用。', visibleRows: '可见行', rowRange: '行', of: '共', types: 'TypeScript 类型', refreshTypes: '刷新类型', downloadTypes: '下载 database.types.ts', typePreview: '生成的 database.types.ts', typesLoading: '正在读取已发布表结构的 TypeScript 类型…', typesFailed: '无法刷新或下载当前类型，已加载内容仍可使用。', typesNote: '类型根据此项目已发布的数据库结构生成。', stale: '此行自加载后已发生变化，请刷新后重新编辑。', unknown: '请求未可靠完成。重试前请刷新确认，服务端可能已完成修改。', rowNumber: '行', actions: '操作', missingField: '缺失字段', structure: '表结构', columnName: '列名', type: '类型', nullable: '允许空值', defaults: '有默认值', identity: '自增标识列', generated: '生成列', yes: '是', no: '否', noColumns: '列元数据不可用。', exportJson: '导出当前页 JSON', exportCsv: '导出当前页 CSV', exportNote: '下载仅包含当前已加载页。JSON 保留类型，CSV 会转义可能被电子表格解释为公式的文本。' },
} as const;

const EMPTY_POLICY: ProjectRlsPolicyInput = { name: '', command: 'select', restrictive: false, rule: { kind: 'w_id_subject_column', column: 'user_id' } };

function editablePolicy(policy: ProjectRlsPolicy): ProjectRlsPolicyInput | null {
  const command = policy.command.toLowerCase();
  if (!['all', 'select', 'insert', 'update', 'delete'].includes(command)) return null;
  const expression = policy.usingExpression || policy.checkExpression || '';
  const match = expression.match(/^"((?:[^"]|"")+)" = current_setting\('(request\.jwt\.claim\.sub|request\.w\.project_id)', true\)$/);
  if (!match) return null;
  return { name: policy.name, command: command as ProjectRlsPolicyInput['command'], restrictive: !policy.permissive, rule: { kind: match[2] === 'request.w.project_id' ? 'w_project_column' : 'w_id_subject_column', column: match[1]!.replace(/""/g, '"') } };
}

type DatabaseProps = { lang: Lang; context: SaasContext; projectId: string; publishableKey: string; database: ProjectConsoleData['database'] | null; unlock: () => Promise<void>; refreshCatalog?: (signal: AbortSignal) => Promise<void> };
export function ProjectDatabaseConsole(props: DatabaseProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectDatabaseSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role, props.publishableKey])} {...props} />;
}
function ProjectDatabaseSession({ lang, context, projectId, publishableKey, database, unlock, refreshCatalog }: DatabaseProps) {
  const t = TEXT[lang];
  const requestGeneration = useRef(0);
  const browseController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const migrationController = useRef<AbortController | null>(null);
  const typeRequestController = useRef<AbortController | null>(null);
  const typeRequestGeneration = useRef(0);
  const objectUrls = useRef<{ url: string; timer: number }[]>([]);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<ProjectPanelState<ProjectTableRows> | null>(null);
  const [databaseTypes, setDatabaseTypes] = useState<ProjectDatabaseTypes | null>(null);
  const [typesBusy, setTypesBusy] = useState(false);
  const [typesFailed, setTypesFailed] = useState(false);
  const [exactCountEnabled, setExactCountEnabled] = useState(false);
  const [countFailed, setCountFailed] = useState(false);
  const [tableQuery, setTableQuery] = useState<TableQuery>({ filters: [] });
  const [migrations, setMigrations] = useState<ProjectPanelState<ProjectMigrationInventory> | null>(null);
  const [policies, setPolicies] = useState<Awaited<ReturnType<typeof loadProjectRlsPolicies>> | null>(null);
  const [tablePublication, setTablePublication] = useState<Publication | null>(null);
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null);
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleteConfirmed, setBatchDeleteConfirmed] = useState(false);
  const [batchNeedsRefresh, setBatchNeedsRefresh] = useState(false);
  const [rowDraft, setRowDraft] = useState<{ mode: 'insert' | 'update' | 'delete'; row?: Record<string, unknown>; values: ProjectRowValueDraft } | null>(null);
  const [policyDraft, setPolicyDraft] = useState<ProjectRlsPolicyInput>(EMPTY_POLICY);
  const [oldPolicyName, setOldPolicyName] = useState<string | null>(null);
  const [deletePolicyName, setDeletePolicyName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'stale' | 'unknown'>('idle');
  const catalogController = useRef<AbortController | null>(null);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [catalogRefreshFailed, setCatalogRefreshFailed] = useState(false);
  const refreshDatabaseCatalog = async (parentSignal?: AbortSignal) => {
    if (!refreshCatalog) return;
    catalogController.current?.abort();
    const controller = new AbortController(); catalogController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    setCatalogRefreshing(true); setCatalogRefreshFailed(false);
    try { await refreshCatalog(signal); }
    catch { if (catalogController.current === controller && !controller.signal.aborted) setCatalogRefreshFailed(true); }
    finally { if (catalogController.current === controller) { catalogController.current = null; setCatalogRefreshing(false); } }
  };

  useEffect(() => () => { requestGeneration.current += 1; typeRequestGeneration.current += 1; typeRequestController.current?.abort(); typeRequestController.current = null; catalogController.current?.abort(); catalogController.current = null; browseController.current?.abort(); actionController.current?.abort(); actionController.current = null; for (const item of objectUrls.current) { window.clearTimeout(item.timer); URL.revokeObjectURL(item.url); } objectUrls.current = []; }, []);
  const loadDatabaseTypes = async (download = false) => {
    typeRequestController.current?.abort();
    const generation = ++typeRequestGeneration.current;
    const controller = new AbortController(); typeRequestController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => typeRequestGeneration.current === generation && !controller.signal.aborted;
    setTypesBusy(true); setTypesFailed(false);
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted();
      const result = await loadProjectDatabaseTypes(context, projectId, publishableKey, bearer, request, signal);
      if (!current()) return;
      if (result.status !== 'ready') { setTypesFailed(true); return; }
      setDatabaseTypes(result.data);
      if (download) {
        try {
          const url = URL.createObjectURL(new Blob([result.data.content], { type: 'text/typescript;charset=utf-8' }));
          const timer = window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter((item) => item.url !== url); }, 1000);
          objectUrls.current.push({ url, timer });
          try {
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.data.filename; anchor.click();
          } catch (error) {
            window.clearTimeout(timer); URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter((item) => item.url !== url);
            throw error;
          }
        } catch { setTypesFailed(true); }
      }
    } catch { if (current()) setTypesFailed(true); }
    finally { if (current()) { setTypesBusy(false); typeRequestController.current = null; } }
  };
  const exportPage = (format: 'json' | 'csv') => {
    if (rows?.status !== 'ready' || !rows.data.rows.length || status === 'loading') return;
    try {
      const blob = new Blob([serializeProjectTableRows(rows.data.rows, format)], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const timer = window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter((item) => item.url !== url); }, 1000);
      objectUrls.current.push({ url, timer });
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)}-${rows.data.schema}-${rows.data.table}-page-${Math.floor(offset / 25) + 1}.${format}`;
      anchor.click();
    } catch { setStatus('error'); }
  };
  const browse = async (schema: string, table: string, nextOffset = 0, mutationController?: AbortController, requestExactCount?: boolean, queryOverride?: TableQuery) => {
    if (actionController.current && actionController.current !== mutationController) return;
    if (!mutationController) setStatus('idle');
    setSelectedRowIndices([]); setBatchDeleteOpen(false); setBatchDeleteConfirmed(false);
    const generation = ++requestGeneration.current;
    browseController.current?.abort();
    const controller = new AbortController();
    browseController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => requestGeneration.current === generation && !controller.signal.aborted;
    const sameTable = selectedTable?.schema === schema && selectedTable.table === table;
    const query = queryOverride ?? (sameTable ? tableQuery : { filters: [] });
    const sameQuery = sameTable && JSON.stringify(query) === JSON.stringify(tableQuery);
    const exactCount = requestExactCount === true || (requestExactCount !== false && sameTable && exactCountEnabled);
    const keepRows = exactCount && sameQuery && offset === nextOffset && rows?.status === 'ready';
    const countOnly = requestExactCount === true && keepRows;
    setSelectedTable({ schema, table }); setTableQuery(query); setOffset(nextOffset); setCountFailed(false);
    if (!countOnly) { setPolicies(null); setRowDraft(null); }
    if (exactCount) setExactCountEnabled(true);
    else if (!sameTable) setExactCountEnabled(false);
    setRows((previous) => keepRows && previous?.status === 'ready'
      ? { status: 'ready', data: { ...previous.data, totalRows: undefined } }
      : null);
    if (!sameTable) { setTablePublication(null); setPolicyDraft(EMPTY_POLICY); setOldPolicyName(null); setDeletePolicyName(''); }
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      await Promise.all([
        loadProjectTableRows(context, projectId, schema, table, publishableKey, bearer, request, signal, nextOffset, exactCount, query)
          .then((value) => { if (!current()) return; if (value.status === 'ready') { setRows(value); setBatchNeedsRefresh(false); } else if (!keepRows) setRows(value); if (exactCount && value.status !== 'ready') { setCountFailed(true); setExactCountEnabled(false); } })
          .catch(() => { if (current()) { if (!keepRows) setRows({ status: 'network' }); if (exactCount) { setCountFailed(true); setExactCountEnabled(false); } } }),
        countOnly ? Promise.resolve() : loadProjectRlsPolicies(context, projectId, schema, table, publishableKey, bearer, request)
          .then((value) => { if (current()) setPolicies(value); })
          .catch(() => { if (current()) setPolicies({ status: 'network' }); }),
      ]);
    } catch { if (current()) { if (!keepRows) setRows({ status: 'network' }); if (!countOnly) setPolicies({ status: 'network' }); if (exactCount) { setCountFailed(true); setExactCountEnabled(false); } } }
  };
  const loadMigrations = useCallback(async (parentSignal?: AbortSignal, initialBearer?: string | null) => {
    migrationController.current?.abort();
    const controller = new AbortController(); migrationController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => migrationController.current === controller && !controller.signal.aborted;
    try {
      const bearer = initialBearer === undefined ? await getAccessToken() : initialBearer;
      if (!current()) return;
      signal.throwIfAborted();
      const result = await loadProjectMigrations(context, projectId, publishableKey, bearer, request);
      if (current()) setMigrations(signal.aborted ? { status: 'network' } : result);
    } catch { if (current()) setMigrations({ status: 'network' }); }
  }, [context, projectId, publishableKey]);
  useEffect(() => {
    let active = true;
    if (publishableKey) void getAccessToken().then((bearer) => { if (active) return loadMigrations(undefined, bearer); }).catch(() => { if (active) setMigrations({ status: 'network' }); });
    return () => { active = false; migrationController.current?.abort(); migrationController.current = null; };
  }, [loadMigrations, publishableKey]);
  const runMutation = async <T extends { status: string },>(operation: (bearer: string | null, request: typeof fetch, signal: AbortSignal) => Promise<T>, onSuccess: (result: T) => void): Promise<T | undefined> => {
    if (!selectedTable || actionController.current) return;
    const controller = new AbortController();
    actionController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => actionController.current === controller && !controller.signal.aborted;
    let started = false;
    setStatus('loading');
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted();
      started = true;
      const result = await operation(bearer, request, signal);
      if (!current()) return;
      if (signal.aborted) { setBatchNeedsRefresh(true); setStatus('unknown'); return; }
      if (result.status === 'network' || result.status === 'unknown') { setBatchNeedsRefresh(true); setStatus('unknown'); return result; }
      if (result.status !== 'ready') { if (result.status === 'stale') setBatchNeedsRefresh(true); setStatus(result.status === 'stale' ? 'stale' : 'error'); return result; }
      onSuccess(result);
      await browse(selectedTable.schema, selectedTable.table, offset, controller);
      if (current()) setStatus('done');
      return result;
    } catch { if (current()) { if (started) setBatchNeedsRefresh(true); setStatus(started ? 'unknown' : 'error'); } }
    finally { if (actionController.current === controller) actionController.current = null; }
  };
  const currentPublication = tablePublication && selectedTable && tablePublication.schema === selectedTable.schema && tablePublication.table === selectedTable.table ? tablePublication : null;
  const writeSpec = currentPublication?.publication;
  const rowKey = writeSpec?.primaryKey || 'id';
  const rowWritesDisabled = currentPublication?.published === false;
  const commitRow = async () => {
    if (!selectedTable || !rowDraft || actionController.current || rowWritesDisabled) return;
    const target = rowDraft.row ? projectRowMutationTarget(rowDraft.row, rowKey, writeSpec?.columns.map(column => column.name)) : null;
    const values = rowDraft.mode === 'delete' ? null : parseProjectRowValueDraft(rowDraft.values);
    if ((rowDraft.mode !== 'delete' && !values) || (rowDraft.mode !== 'insert' && !target)) { setStatus('error'); return; }
    await runMutation((bearer, request, signal) => mutateProjectTableRow(context, projectId, selectedTable.schema, selectedTable.table, publishableKey, bearer,
      rowDraft.mode === 'insert' ? { operation: 'insert', values: values! } : rowDraft.mode === 'update' ? { operation: 'update', ...target!, values: values! } : { operation: 'delete', ...target! }, request, signal),
    () => setRowDraft(null));
  };
  const batchDeleteDisabled = batchNeedsRefresh || rowWritesDisabled || status === 'loading' || status === 'stale' || status === 'unknown' || rows?.status !== 'ready';
  const rowTargets = rows?.status === 'ready' ? rows.data.rows.map(row => projectRowMutationTarget(row, rowKey, writeSpec?.columns.map(column => column.name))) : [];
  const eligibleIndices = rowTargets.flatMap((target, index) => target ? [index] : []);
  const changeSelection = (indices: number[]) => { setSelectedRowIndices(indices); setBatchDeleteOpen(false); setBatchDeleteConfirmed(false); };
  const commitBatchDelete = async () => {
    if (!selectedTable || !batchDeleteConfirmed || batchDeleteDisabled || actionController.current || !selectedRowIndices.length) return;
    const targets = selectedRowIndices.map(index => rowTargets[index]);
    if (targets.some(target => !target)) { setStatus('error'); return; }
    await runMutation((bearer, request, signal) => deleteProjectTableRows(context, projectId, selectedTable.schema, selectedTable.table, publishableKey, bearer, targets.filter(target => target !== null && target !== undefined), request, signal),
      () => { changeSelection([]); });
  };
  const savePolicy = async () => {
    if (!selectedTable) return;
    await runMutation((bearer, request) => saveProjectRlsPolicy(context, projectId, selectedTable.schema, selectedTable.table, oldPolicyName, policyDraft, publishableKey, bearer, request),
      () => { setPolicyDraft(EMPTY_POLICY); setOldPolicyName(null); setDeletePolicyName(''); });
  };
  const removePolicy = async () => {
    if (!selectedTable || !oldPolicyName || deletePolicyName !== oldPolicyName) return;
    await runMutation((bearer, request) => deleteProjectRlsPolicy(context, projectId, selectedTable.schema, selectedTable.table, oldPolicyName, publishableKey, bearer, request),
      () => { setPolicyDraft(EMPTY_POLICY); setOldPolicyName(null); setDeletePolicyName(''); });
  };

  const tableMetadata = database?.status === 'ready' ? database.data.tables.find(table => table.schema === selectedTable?.schema && table.name === selectedTable.table) : undefined;
  const readOnlyColumns = writeSpec ? [...new Set([...writeSpec.columns.filter(column => !column.writable).map(column => column.name), ...(tableMetadata?.columns || []).filter(column => !writeSpec.columns.some(exposed => exposed.name === column.name && exposed.writable)).map(column => column.name)])] : undefined;
  const rowColumns = rows?.status === 'ready' ? [...new Set([...(tableMetadata?.columns?.map(column => column.name) || []), ...rows.data.rows.flatMap(row => Object.keys(row))])] : [];
  const visibleRowsPrefix = lang === 'en' ? `${t.visibleRows}: ` : `${t.visibleRows}：`;
  const countSummary = rows?.status === 'ready' && rows.data.totalRows !== undefined
    ? rows.data.totalRows === 0
      ? `${visibleRowsPrefix}0`
      : rows.data.rows.length === 0
        ? `${visibleRowsPrefix}${rows.data.totalRows}`
        : lang === 'en'
          ? `${visibleRowsPrefix}${rows.data.totalRows} · ${t.rowRange} ${offset + 1}–${Math.min(offset + rows.data.rows.length, rows.data.totalRows)} · ${t.page} ${Math.floor(offset / 25) + 1} ${t.of} ${Math.ceil(rows.data.totalRows / 25)}`
          : `${visibleRowsPrefix}${rows.data.totalRows} · ${t.rowRange} ${offset + 1}–${Math.min(offset + rows.data.rows.length, rows.data.totalRows)} · 第 ${Math.floor(offset / 25) + 1}/${Math.ceil(rows.data.totalRows / 25)} 页`
    : null;

  if (!publishableKey || database?.status === 'locked') return <section className="console-view" aria-labelledby="database-title"><h2 id="database-title">{t.title}</h2><p className="console-note">{t.note}</p><div className="console-boundary-note"><p>{t.locked}</p><button className="site-nav-button" type="button" onClick={() => void unlock()}>{t.unlock}</button></div></section>;
  return <section className="console-view console-database" aria-labelledby="database-title"><h2 id="database-title">{t.title}</h2><p className="console-note">{t.note}</p>
    <section className="console-key-management console-database-types" aria-labelledby="database-types-title"><div className="console-panel-heading"><h3 id="database-types-title">{t.types}</h3><div className="console-row-actions"><button type="button" disabled={typesBusy} onClick={() => void loadDatabaseTypes()}>{t.refreshTypes}</button><button type="button" disabled={typesBusy || databaseTypes === null} onClick={() => void loadDatabaseTypes(true)}>{t.downloadTypes}</button></div></div><p className="console-note">{t.typesNote}</p>{typesBusy && <p role="status">{t.typesLoading}</p>}{databaseTypes && <pre role="region" aria-label={t.typePreview} tabIndex={0}>{databaseTypes.content}</pre>}{typesFailed && <p role="alert" className="console-status is-error">{t.typesFailed}</p>}</section>
    <div className="console-database-grid"><aside><h3>{t.tables}</h3>{refreshCatalog && <button type="button" disabled={catalogRefreshing || status === 'loading'} onClick={() => void refreshDatabaseCatalog()}>{lang === 'en' ? 'Refresh tables' : '刷新表目录'}</button>}{catalogRefreshFailed && <p role="alert">{lang === 'en' ? 'Could not refresh tables. Retry to see the current schema.' : '无法刷新表目录，请重试以读取当前结构。'}</p>}{database?.status === 'ready' ? database.data.tables.map((table) => <button key={`${table.schema}.${table.name}`} type="button" disabled={status === 'loading'} aria-current={selectedTable?.schema === table.schema && selectedTable.table === table.name ? 'true' : undefined} onClick={() => void browse(table.schema, table.name)}>{table.schema}.{table.name}<small>RLS {table.rlsEnabled ? '✓' : '—'} · {table.policyCount}</small></button>) : <p role="status">{t.loading}</p>}</aside>
      <div>{selectedTable && <details className="console-table-structure" key={`${selectedTable.schema}.${selectedTable.table}`}><summary>{t.structure} · {selectedTable.schema}.{selectedTable.table}</summary>{tableMetadata?.columns?.length ? <div role="region" aria-label={t.structure} tabIndex={0}><table><caption>{selectedTable.schema}.{selectedTable.table}</caption><thead><tr>{[t.columnName, t.type, t.nullable, t.defaults, t.identity, t.generated].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{tableMetadata.columns.map(column => <tr key={column.name}><th scope="row"><code>{column.name}</code></th><td><code>{column.dataType}</code></td>{[column.nullable, column.hasDefault, column.identity, column.generated].map((value, index) => <td key={index}>{value ? t.yes : t.no}</td>)}</tr>)}</tbody></table></div> : <p>{t.noColumns}</p>}</details>}<section aria-labelledby="database-rows-title"><div className="console-panel-heading"><h3 id="database-rows-title">{t.rows}{selectedTable ? ` · ${selectedTable.schema}.${selectedTable.table}` : ''}</h3>{selectedTable && <button type="button" disabled={rowWritesDisabled || status === 'loading' || rows?.status !== 'ready'} onClick={() => setRowDraft({ mode: 'insert', values: { kind: 'json', json: '{\n  \n}' } })}>{t.add}</button>}</div>{selectedTable && <ProjectTableQuery key={JSON.stringify(['query', selectedTable.schema, selectedTable.table])} lang={lang} columns={tableMetadata?.columns || []} applied={tableQuery} disabled={status === 'loading'} onApply={query => void browse(selectedTable.schema, selectedTable.table, 0, undefined, undefined, query)} />}{rows?.status === 'ready' ? rows.data.rows.length ? <div className="console-table-rows" role="region" aria-label={`${t.rows} · ${selectedTable?.schema}.${selectedTable?.table}`} tabIndex={0}>
            <table><caption>{selectedTable?.schema}.{selectedTable?.table} · {t.page} {Math.floor(offset / 25) + 1}</caption>
              <thead><tr><th scope="col"><input type="checkbox" aria-label={t.selectPage} disabled={batchDeleteDisabled || !eligibleIndices.length} checked={eligibleIndices.length > 0 && eligibleIndices.every(index => selectedRowIndices.includes(index))} onChange={event => changeSelection(event.target.checked ? eligibleIndices : [])} /><span className="sr-only">{t.selectPage}</span></th><th scope="col">{t.rowNumber}</th>{rowColumns.map(column => <th key={column} scope="col"><code>{column}</code></th>)}<th scope="col">{t.actions}</th></tr></thead>
              <tbody>{rows.data.rows.map((row, index) => <tr key={index}>
                <td><input type="checkbox" aria-label={`${t.selectRow} ${offset + index + 1}`} disabled={batchDeleteDisabled || !rowTargets[index]} checked={selectedRowIndices.includes(index)} onChange={event => changeSelection(event.target.checked ? [...selectedRowIndices, index] : selectedRowIndices.filter(item => item !== index))} /></td><th scope="row">{offset + index + 1}</th>
                {rowColumns.map(column => <td key={column}>{Object.hasOwn(row, column) ? <code>{JSON.stringify(row[column])}</code> : <span aria-label={t.missingField}>—</span>}</td>)}
                <td><div className="console-row-actions"><button type="button" disabled={rowWritesDisabled || row[rowKey] == null || status === 'loading'} onClick={() => setRowDraft({ mode: 'update', row, values: { kind: 'json', json: editableProjectRowJson(row, tableMetadata?.columns || [], readOnlyColumns) } })}>{t.edit}</button><button type="button" disabled={rowWritesDisabled || row[rowKey] == null || status === 'loading'} onClick={() => setRowDraft({ mode: 'delete', row, values: { kind: 'json', json: '' } })}>{t.remove}</button></div></td>
              </tr>)}</tbody>
            </table>
          </div> : <p>{t.empty}</p> : selectedTable && <p role="status">{rows ? t.failed : t.loading}</p>}{selectedTable && <><nav aria-label={t.pagination} className="console-row-actions"><button type="button" disabled={rows?.status !== 'ready' || status === 'loading'} onClick={() => void browse(selectedTable.schema, selectedTable.table, offset, undefined, true)}>{t.countVisible}</button><button type="button" disabled={offset === 0 || rows === null || status === 'loading'} onClick={() => void browse(selectedTable.schema, selectedTable.table, Math.max(0, offset - 25))}>{t.previous}</button><span aria-live="polite">{t.page} {Math.floor(offset / 25) + 1}</span><button type="button" disabled={rows?.status !== 'ready' || !rows.data.rows.length || status === 'loading'} onClick={() => exportPage('json')}>{t.exportJson}</button><button type="button" disabled={rows?.status !== 'ready' || !rows.data.rows.length || status === 'loading'} onClick={() => exportPage('csv')}>{t.exportCsv}</button><button type="button" disabled={rows?.status !== 'ready' || !rows.data.hasMore || rows.data.nextOffset == null || status === 'loading'} onClick={() => { if (rows?.status === 'ready' && rows.data.nextOffset != null) void browse(selectedTable.schema, selectedTable.table, rows.data.nextOffset); }}>{t.next}</button><button type="button" disabled={rows === null || status === 'loading'} onClick={() => void browse(selectedTable.schema, selectedTable.table, offset)}>{t.refresh}</button></nav>{countSummary && <p aria-live="polite">{countSummary}</p>}{countFailed && <p role="alert" className="console-status is-error">{t.countFailed}</p>}</>}{selectedTable && <p className="console-note">{t.exportNote}</p>}{rowDraft && <div className="console-row-editor"><strong>{rowDraft.mode === 'delete' ? t.confirm : t.values}</strong>{rowDraft.mode !== 'delete' && <ProjectRowValueEditor lang={lang} columns={tableMetadata?.columns || []} readOnlyColumns={readOnlyColumns} draft={rowDraft.values} disabled={status === 'loading'} onChange={values => setRowDraft({ ...rowDraft, values })} />}<div className="console-row-actions"><button className="site-nav-button" type="button" disabled={rowWritesDisabled || status === 'loading' || (rowDraft.mode !== 'delete' && rowDraft.values.kind === 'fields' && !parseProjectRowValueDraft(rowDraft.values))} onClick={() => void commitRow()}>{t.save}</button><button type="button" disabled={status === 'loading'} onClick={() => setRowDraft(null)}>{t.cancel}</button></div></div>}
        {selectedTable && <div className="console-table-batch-delete"><div className="console-row-actions"><span aria-live="polite">{t.selected}: {selectedRowIndices.length}</span><button type="button" disabled={batchDeleteDisabled || !selectedRowIndices.length} onClick={() => { setRowDraft(null); setBatchDeleteOpen(true); setBatchDeleteConfirmed(false); }}>{t.deleteSelected}</button><button type="button" disabled={status === 'loading' || !selectedRowIndices.length} onClick={() => changeSelection([])}>{t.clearSelection}</button></div>{batchDeleteOpen && <div className="console-boundary-note"><p>{selectedTable.schema}.{selectedTable.table} · {t.selected}: {selectedRowIndices.length}</p><p>{t.batchNote}</p><label><input type="checkbox" disabled={batchDeleteDisabled} checked={batchDeleteConfirmed} onChange={event => setBatchDeleteConfirmed(event.target.checked)} />{t.confirmBatch}</label><div className="console-row-actions"><button type="button" disabled={batchDeleteDisabled || !batchDeleteConfirmed || !selectedRowIndices.length} onClick={() => void commitBatchDelete()}>{t.deleteSelected}</button><button type="button" disabled={status === 'loading'} onClick={() => { setBatchDeleteOpen(false); setBatchDeleteConfirmed(false); }}>{t.cancel}</button></div></div>}</div>}
        {selectedTable && <ProjectTableImport key={JSON.stringify([selectedTable.schema, selectedTable.table])} lang={lang} schema={selectedTable.schema} table={selectedTable.table} columns={tableMetadata?.columns || []} readOnlyColumns={readOnlyColumns} disabled={rowWritesDisabled || status === 'loading'} onImport={(values, onReady) => runMutation((bearer, request, signal) => importProjectTableRows(context, projectId, selectedTable.schema, selectedTable.table, publishableKey, bearer, values, request, signal), (result) => { if (result.status === 'ready') onReady(result.data); })} />}
      </section>
      {selectedTable && <section className="console-key-management" aria-labelledby="database-rls-title"><h3 id="database-rls-title">{t.rls}</h3>{policies?.status === 'ready' ? policies.data.policies.length ? <ul>{policies.data.policies.map((policy) => { const editable = editablePolicy(policy); return <li key={policy.name}><button type="button" disabled={!editable || status === 'loading'} title={!editable ? t.failed : undefined} onClick={() => { if (!editable) return; setOldPolicyName(policy.name); setDeletePolicyName(''); setPolicyDraft(editable); }}>{policy.name} · {policy.command} · {policy.permissive ? 'permissive' : 'restrictive'}</button></li>; })}</ul> : <p>{t.noPolicies}</p> : <p role="status">{policies ? t.failed : t.loading}</p>}<div className="console-policy-editor"><label>{t.policyName}<input disabled={status === 'loading'} value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} /></label><label>{t.command}<select disabled={status === 'loading'} value={policyDraft.command} onChange={(event) => setPolicyDraft({ ...policyDraft, command: event.target.value as ProjectRlsPolicyInput['command'] })}>{['all', 'select', 'insert', 'update', 'delete'].map((value) => <option key={value}>{value}</option>)}</select></label><label>{t.rule}<select disabled={status === 'loading'} value={policyDraft.rule.kind} onChange={(event) => setPolicyDraft({ ...policyDraft, rule: { ...policyDraft.rule, kind: event.target.value as ProjectRlsPolicyInput['rule']['kind'] } })}><option value="w_id_subject_column">W-ID subject</option><option value="w_project_column">W project</option></select></label><label>{t.column}<input disabled={status === 'loading'} value={policyDraft.rule.column} onChange={(event) => setPolicyDraft({ ...policyDraft, rule: { ...policyDraft.rule, column: event.target.value } })} /></label><label><input type="checkbox" disabled={status === 'loading'} checked={policyDraft.restrictive} onChange={(event) => setPolicyDraft({ ...policyDraft, restrictive: event.target.checked })} />{t.restrictive}</label><button className="site-nav-button" type="button" disabled={status === 'loading' || policies?.status !== 'ready'} onClick={() => void savePolicy()}>{oldPolicyName ? t.update : t.create}</button>{oldPolicyName && <div className="console-boundary-note"><label>{t.deleteConfirm}<input disabled={status === 'loading'} value={deletePolicyName} onChange={(event) => setDeletePolicyName(event.target.value)} /></label><button type="button" disabled={deletePolicyName !== oldPolicyName || status === 'loading'} onClick={() => void removePolicy()}>{t.deletePolicy}</button></div>}</div></section>}
      {tableMetadata && <ProjectTablePublication key={JSON.stringify(['publication', tableMetadata.schema, tableMetadata.name])} lang={lang} context={context} projectId={projectId} publishableKey={publishableKey} table={tableMetadata} disabled={status === 'loading'} onRead={setTablePublication} />}
      {tableMetadata && <ProjectTableRealtime key={JSON.stringify(['realtime', tableMetadata.schema, tableMetadata.name, currentPublication?.published])} lang={lang} context={context} projectId={projectId} publishableKey={publishableKey} table={tableMetadata} disabled={status === 'loading'} />}
      </div></div>
    <section className="console-key-management console-database-migrations" aria-labelledby="database-migrations-title"><div className="console-panel-heading"><h3 id="database-migrations-title">{t.migrations}</h3><button type="button" onClick={() => void loadMigrations()}>{t.refresh}</button></div>{migrations?.status === 'ready' ? migrations.data.migrations.length ? <ul>{migrations.data.migrations.map((migration) => <li key={migration.version}><strong>{migration.version}</strong><code>{migration.checksum}</code><small>{migration.appliedAt}</small></li>)}</ul> : <p>{t.noMigrations}</p> : <p role="status">{migrations ? t.failed : t.loading}</p>}</section>
    <ProjectDatabaseOperations lang={lang} context={context} projectId={projectId} publishableKey={publishableKey} refreshMigrations={async signal => { await Promise.all([loadMigrations(signal), refreshDatabaseCatalog(signal)]); }} />
    {status === 'loading' && <p role="status">{t.loading}</p>}{status === 'done' && <p role="status">{t.done}</p>}{(status === 'stale' || status === 'unknown') && <p role="alert" className="console-status is-error">{t[status]}</p>}{status === 'error' && <p role="alert" className="console-status is-error">{t.failed}</p>}
  </section>;
}
