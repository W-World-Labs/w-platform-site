import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { getAccessToken } from '../lib/auth';
import { manageProjectTableRealtime, type ProjectDatabaseTable, type SaasContext } from '../lib/saasConsole';
import type { ProjectTableRealtime as Receipt } from '../lib/projectTableRealtime';

const TEXT = {
  en: { title: 'Table Realtime', note: 'Enable database change subscriptions for this table. Publish its REST API first; the project owner column, RLS and database grants must remain valid.', refresh: 'Refresh table Realtime', loading: 'Reading table Realtime…', enabled: 'Realtime is enabled for this table.', disabled: 'Realtime is disabled for this table.', degraded: 'The requested and effective states differ. Refresh or explicitly save the requested state again.', configured: 'This table’s Realtime is managed by server configuration.', desired: 'Requested state', effective: 'Effective state', on: 'Enabled', off: 'Disabled', choice: 'Enable table Realtime', confirm: 'Type the exact table name to change Realtime', save: 'Save table Realtime', done: 'Table Realtime saved.', failed: 'Table Realtime could not be read or changed. Your input is preserved.', rejected: 'The change was rejected. Check the published table’s owner column, RLS and database grants.', conflict: 'The change conflicts with the current table configuration. Refresh its state.', unsupported: 'Table Realtime management is unavailable on this backend.', unpublished: 'Publish this table’s REST API, then refresh table Realtime. If it is already published, check backend support.', unknown: 'The write result is uncertain. Refresh table Realtime before making another change.' },
  zh: { title: '数据表 Realtime', note: '为此表启用数据库变更订阅。请先发布 REST API，并保持项目用户归属列、RLS 和数据库授权有效。', refresh: '刷新表 Realtime', loading: '正在读取表 Realtime…', enabled: '此表已启用 Realtime。', disabled: '此表已停用 Realtime。', degraded: '请求状态与实际状态不一致。请刷新，或明确重新保存请求状态。', configured: '此表的 Realtime 由服务端配置管理。', desired: '请求状态', effective: '实际状态', on: '启用', off: '停用', choice: '启用表 Realtime', confirm: '输入完整表名以修改 Realtime', save: '保存表 Realtime', done: '表 Realtime 已保存。', failed: '无法读取或修改表 Realtime，输入内容已保留。', rejected: '修改被拒绝，请检查已发布表的用户归属列、RLS 和数据库授权。', conflict: '修改与当前表配置冲突，请刷新状态。', unsupported: '当前后端尚不支持表 Realtime 管理。', unpublished: '请先发布此表的 REST API，再刷新表 Realtime。若已发布，请检查后端支持情况。', unknown: '写入结果尚不确定。请刷新表 Realtime 后再修改。' },
};
type Status = 'idle' | 'loading' | 'done' | 'failed' | 'rejected' | 'conflict' | 'unsupported' | 'unpublished' | 'unknown';

function currentBearer(signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    getAccessToken().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function ProjectTableRealtime({ lang, context, projectId, publishableKey, table, disabled }: {
  lang: Lang; context: SaasContext; projectId: string; publishableKey: string; table: ProjectDatabaseTable; disabled: boolean;
}) {
  const t = TEXT[lang];
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [uncertain, setUncertain] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const run = async (write: boolean) => {
    if (pending.current || (write && (disabled || uncertain || !receipt || receipt.source === 'configured' || confirmation !== table.name))) return;
    const version = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]);
    pending.current = true; setStatus('loading');
    try {
      const bearer = await currentBearer(signal); signal.throwIfAborted();
      const result = await manageProjectTableRealtime(context, projectId, table.schema, table.name, publishableKey, bearer, write ? enabled : null, fetch, signal);
      if (version !== generation.current) return;
      if (result.status === 'ready') {
        setReceipt(result.data); setEnabled(result.data.desiredEnabled); setUncertain(false); setConfirmation('');
        setStatus(write && result.data.status !== 'degraded' ? 'done' : 'idle');
      } else {
        if (result.status === 'unknown') setUncertain(true);
        if (result.status === 'unpublished' || result.status === 'unsupported') setReceipt(null);
        setStatus(result.status === 'invalid' && write ? 'rejected' : ['unknown', 'conflict', 'unsupported', 'unpublished'].includes(result.status) ? result.status as Status : 'failed');
      }
    } catch {
      if (version === generation.current) setStatus('failed');
    } finally {
      if (version === generation.current) { pending.current = false; controller.current = null; }
    }
  };
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void run(false); });
    // The counter tracks request generations rather than a DOM node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false; generation.current++; pending.current = false; controller.current?.abort(); };
    // The parent remounts on table, publication or session identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const locked = disabled || status === 'loading' || uncertain || !receipt || receipt.source === 'configured';
  return <section className="console-key-management console-table-realtime" aria-labelledby="database-realtime-title">
    <div className="console-panel-heading"><h3 id="database-realtime-title">{t.title}</h3><button type="button" disabled={disabled || status === 'loading'} onClick={() => void run(false)}>{t.refresh}</button></div>
    <p className="console-note">{t.note}</p>
    {receipt && <><p role={receipt.status === 'degraded' ? 'alert' : undefined}>{t[receipt.status]}</p><dl><dt>{t.desired}</dt><dd>{receipt.desiredEnabled ? t.on : t.off}</dd><dt>{t.effective}</dt><dd>{receipt.effectiveEnabled ? t.on : t.off}</dd></dl></>}
    {receipt?.source === 'configured' ? <p>{t.configured}</p> : <>
      <label><input type="checkbox" checked={enabled} disabled={locked} onChange={event => { setEnabled(event.target.checked); setConfirmation(''); }} />{t.choice}</label>
      <label>{t.confirm}<input value={confirmation} disabled={locked} onChange={event => setConfirmation(event.target.value)} /></label>
      <button type="button" className="site-nav-button" disabled={locked || confirmation !== table.name} onClick={() => void run(true)}>{t.save}</button>
    </>}
    {uncertain && status !== 'unknown' && <p role="alert" className="console-status is-error">{t.unknown}</p>}
    {status !== 'idle' && <p role={['done', 'loading'].includes(status) ? 'status' : 'alert'} className={['done', 'loading'].includes(status) ? undefined : 'console-status is-error'}>{t[status]}</p>}
  </section>;
}
