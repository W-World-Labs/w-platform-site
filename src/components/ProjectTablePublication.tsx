import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { getAccessToken } from '../lib/auth';
import { manageProjectTablePublication, type ProjectDatabaseTable, type SaasContext } from '../lib/saasConsole';
import { projectPublicationColumnKind, projectPublicationOwnerColumns, validProjectTablePublicationInput, type ProjectTablePublication as Publication } from '../lib/projectTablePublication';

const TEXT = {
  en: { title: 'REST API publication', note: 'Publish selected columns for application REST access. Rows remain protected by the authenticated owner and database RLS. Enable Realtime separately in the table controls.', refresh: 'Refresh publication', loading: 'Reading publication…', none: 'This table is not published.', managed: 'Published for REST access.', configured: 'Published by server configuration. This publication is managed on the server.', owner: 'Owner column', choose: 'Choose a non-null text column', exposed: 'Expose', writable: 'Allow writes', column: 'Column', type: 'Type', unsupportedType: 'Unsupported for REST publication', limit: 'Maximum rows per request (1–1000)', confirm: 'Type the exact table name to change publication', save: 'Publish REST API', update: 'Save publication', remove: 'Unpublish REST API', done: 'Publication saved.', removed: 'Publication removed.', failed: 'Publication could not be read or changed. Your draft is preserved.', rejected: 'Publication was rejected. Check the primary key, owner column, RLS and database grants.', conflict: 'The publication change conflicts with the current configuration. Disable table Realtime before unpublishing; refresh to check server configuration.', unsupported: 'Publication management is unavailable on this backend.', unknown: 'The write result is uncertain. Refresh publication to read the current state before making another change.', requirements: 'Requires a single non-null primary key, a non-null text owner column, ENABLE and FORCE RLS, and database grants. Primary key and owner are read-only; the owner comes from the authenticated user.', noRls: 'Enable and force row security before publishing.', noColumns: 'Column metadata is unavailable. Refresh the table catalog first.', readOnly: 'Read-only', missingOwner: 'Create a non-null text owner column and an owner RLS policy before publishing.' },
  zh: { title: 'REST API 发布', note: '选择应用 REST API 可访问的列。数据行仍受当前登录用户归属和数据库 RLS 保护。请在表控制面板单独启用 Realtime。', refresh: '刷新发布状态', loading: '正在读取发布状态…', none: '此表尚未发布。', managed: '已发布为 REST API。', configured: '此表由服务端配置发布，请在服务端管理该配置。', owner: '用户归属列', choose: '选择非空文本列', exposed: '公开此列', writable: '允许写入', column: '列', type: '类型', unsupportedType: '此类型暂不支持 REST 发布', limit: '每次请求最多返回行数（1–1000）', confirm: '输入完整表名以修改发布状态', save: '发布 REST API', update: '保存发布配置', remove: '取消 REST API 发布', done: '发布配置已保存。', removed: '已取消发布。', failed: '无法读取或修改发布状态，输入内容已保留。', rejected: '发布被拒绝，请检查主键、用户归属列、RLS 和数据库授权。', conflict: '发布修改与当前配置冲突。取消发布前请先停用表 Realtime，并刷新以检查服务端配置。', unsupported: '当前后端尚不支持发布管理。', unknown: '写入结果尚不确定。请刷新发布状态，读取当前配置后再进行修改。', requirements: '需要单列非空主键、非空文本用户归属列、启用并强制 RLS，以及数据库授权。主键和用户归属列只读；用户归属由当前登录身份赋值。', noRls: '请先启用并强制行级安全，再发布此表。', noColumns: '暂未获取列信息，请先刷新数据表目录。', readOnly: '只读', missingOwner: '请先建立非空文本用户归属列，并配置用户归属 RLS 策略。' },
};

type Status = 'idle' | 'loading' | 'done' | 'removed' | 'failed' | 'rejected' | 'conflict' | 'unsupported' | 'unknown';
export function ProjectTablePublication({ lang, context, projectId, publishableKey, table, disabled, onRead }: {
  lang: Lang; context: SaasContext; projectId: string; publishableKey: string; table: ProjectDatabaseTable; disabled: boolean; onRead?: (publication: Publication) => void;
}) {
  const t = TEXT[lang];
  const columns = table.columns || [];
  const ownerColumns = projectPublicationOwnerColumns(columns);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const [receipt, setReceipt] = useState<Publication | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [uncertain, setUncertain] = useState(false);
  const [owner, setOwner] = useState('');
  const [selection, setSelection] = useState<Array<{ name: string; writable: boolean }>>([]);
  const [maxRows, setMaxRows] = useState('100');
  const [confirmation, setConfirmation] = useState('');

  const run = async (operation: 'GET' | 'PUT' | 'DELETE') => {
    if (pending.current || (operation !== 'GET' && (uncertain || !receipt || receipt.source === 'configured' || confirmation !== table.name))) return;
    const input = { ownerColumn: owner, columns: selection, maxRows: Number(maxRows) };
    if (operation === 'PUT' && !validProjectTablePublicationInput(input)) return;
    const version = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]);
    pending.current = true; setStatus('loading');
    try {
      const bearer = await getAccessToken(); signal.throwIfAborted();
      const result = await manageProjectTablePublication(context, projectId, table.schema, table.name, publishableKey, bearer, operation, operation === 'PUT' ? input : null, fetch, signal);
      if (version !== generation.current) return;
      if (result.status === 'ready') {
        setReceipt(result.data); onRead?.(result.data); setUncertain(false); setConfirmation('');
        const spec = result.data.publication;
        const defaultOwner = ownerColumns.find(column => ['owner_id', 'user_id'].includes(column.name))?.name || '';
        setOwner(spec?.ownerColumn || defaultOwner);
        setSelection(spec?.columns.map(column => ({ name: column.name, writable: column.writable })) || columns.filter(column => projectPublicationColumnKind(column.dataType)).slice(0, 64).map(column => ({ name: column.name, writable: false })));
        setMaxRows(String(spec?.maxRows || 100));
        setStatus(operation === 'GET' ? 'idle' : operation === 'DELETE' ? 'removed' : 'done');
      } else {
        if (result.status === 'unknown') setUncertain(true);
        setStatus(result.status === 'invalid' && operation !== 'GET' ? 'rejected' : ['unknown', 'conflict', 'unsupported'].includes(result.status) ? result.status as Status : 'failed');
      }
    } catch {
      if (version === generation.current) setStatus('failed');
    } finally {
      if (version === generation.current) { pending.current = false; controller.current = null; }
    }
  };
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void run('GET'); });
    // This counter invalidates requests rather than referring to a DOM node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false; generation.current++; pending.current = false; controller.current?.abort(); };
    // The parent remounts this component for a new session or table identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const locked = disabled || status === 'loading' || uncertain || !receipt || receipt.source === 'configured';
  const primaryKey = receipt?.publication?.primaryKey;
  const valid = validProjectTablePublicationInput({ ownerColumn: owner, columns: selection, maxRows: Number(maxRows) });
  const changeOwner = (name: string) => {
    setOwner(name); setConfirmation('');
    setSelection(current => current.some(column => column.name === name) ? current.map(column => column.name === name ? { ...column, writable: false } : column) : [...current, { name, writable: false }]);
  };
  return <section className="console-key-management console-table-publication" aria-labelledby="database-publication-title">
    <div className="console-panel-heading"><h3 id="database-publication-title">{t.title}</h3><button type="button" disabled={disabled || status === 'loading'} onClick={() => void run('GET')}>{t.refresh}</button></div>
    <p className="console-note">{t.note}</p>
    {receipt && <p>{t[receipt.source === 'none' ? 'none' : receipt.source]}</p>}
    {receipt?.source === 'configured' ? <p className="console-note">{receipt.publication?.columns.map(column => column.name).join(', ')}</p> : <>
      <p className="console-note">{t.requirements}</p>
      {!table.rlsEnabled || !table.rlsForced ? <p>{t.noRls}</p> : null}
      {!columns.length && <p>{t.noColumns}</p>}
      {columns.length > 0 && !ownerColumns.length && <p>{t.missingOwner}</p>}
      <label>{t.owner}<select aria-label={t.owner} value={owner} disabled={locked} onChange={event => changeOwner(event.target.value)}><option value="">{t.choose}</option>{ownerColumns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select></label>
      <div className="console-publication-columns" role="region" aria-label={t.title} tabIndex={0}><table><thead><tr><th scope="col">{t.column}</th><th scope="col">{t.type}</th><th scope="col">{t.exposed}</th><th scope="col">{t.writable}</th></tr></thead><tbody>{columns.map(column => {
        const selected = selection.find(item => item.name === column.name);
        const eligible = projectPublicationColumnKind(column.dataType) !== null;
        const readOnly = column.identity || column.generated || column.name === owner || column.name === primaryKey;
        return <tr key={column.name}><th scope="row"><code>{column.name}</code></th><td>{column.dataType}{!eligible && <small>{t.unsupportedType}</small>}</td><td><input type="checkbox" aria-label={`${t.exposed} · ${column.name}`} checked={!!selected} disabled={locked || !eligible || column.name === owner || column.name === primaryKey || (!selected && selection.length >= 64)} onChange={event => { setConfirmation(''); setSelection(current => event.target.checked ? [...current, { name: column.name, writable: false }] : current.filter(item => item.name !== column.name)); }} /></td><td><input type="checkbox" aria-label={`${t.writable} · ${column.name}`} checked={selected?.writable === true} disabled={locked || !selected || readOnly} onChange={event => { setConfirmation(''); setSelection(current => current.map(item => item.name === column.name ? { ...item, writable: event.target.checked } : item)); }} />{readOnly && <small>{t.readOnly}</small>}</td></tr>;
      })}</tbody></table></div>
      <label>{t.limit}<input type="number" min={1} max={1000} step={1} value={maxRows} disabled={locked} onChange={event => { setMaxRows(event.target.value); setConfirmation(''); }} /></label>
      <label>{t.confirm}<input value={confirmation} disabled={locked} onChange={event => setConfirmation(event.target.value)} /></label>
      <div className="console-row-actions"><button type="button" className="site-nav-button" disabled={locked || !valid || !table.rlsEnabled || !table.rlsForced || confirmation !== table.name} onClick={() => void run('PUT')}>{receipt?.published ? t.update : t.save}</button><button type="button" disabled={locked || !receipt?.published || confirmation !== table.name} onClick={() => void run('DELETE')}>{t.remove}</button></div>
    </>}
    {uncertain && status !== 'unknown' && <p role="alert" className="console-status is-error">{t.unknown}</p>}
    {status !== 'idle' && <p role={['done', 'removed', 'loading'].includes(status) ? 'status' : 'alert'} className={['done', 'removed', 'loading'].includes(status) ? undefined : 'console-status is-error'}>{t[status]}</p>}
  </section>;
}
