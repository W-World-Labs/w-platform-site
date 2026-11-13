import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import { createProjectDatabaseBackup, downloadProjectDatabaseBackup, loadProjectDatabaseAudit, loadProjectDatabaseBackups, loadProjectObservability, previewProjectDatabaseRestore, restoreProjectDatabaseBackup, rollbackProjectDatabaseRestore, type ProjectDatabaseBackup, type ProjectDatabaseRestore, type ProjectDatabaseAudit, type ProjectDatabaseBackups, type ProjectDatabaseRestorePreview, type ProjectObservability, type ProjectPanelState, type SaasContext } from '../lib/saasConsole';
import type { Lang } from '../i18n';

const copy = {
  en: { title: 'Backups & recovery', note: 'Exact-project W-DB inventory, quotas, retention, restore preview and bounded audit. No database, storage or provider credential is exposed.', unlock: 'Unlock backup control', locked: 'Create a short-lived in-memory console key to continue.', inventory: 'Backup inventory', usage: 'Usage', retention: 'Retention', capabilities: 'Provider capabilities', available: 'Available', planned: 'Planned — dep_w_db_backup_provider required', create: 'Create backup', creating: 'Creating backup…', created: 'Backup request confirmed:', refresh: 'Refresh', readFailed: 'Backup inventory refresh failed. Confirmed operation receipts are retained.', previewing: 'Loading restore preview…', restoring: 'Restoring database…', restoreDone: 'Restore succeeded:', restoreFailed: 'Restore failed:', restoreState: 'Restore operation:', rollback: 'Rollback restore', rollingBack: 'Rolling back restore…', rollbackDone: 'Restore rolled back:', rollbackRisk: 'Return the database to its state immediately before this restore. Changes made since the restore will be replaced.', rollbackConfirm: 'Type the exact project ID to roll back', unknown: 'The result is unknown. Refresh inventory and audit before starting a new operation; the server may have completed the change.', download: 'Download', downloading: 'Preparing download…', createFailed: 'Backup creation failed.', downloadFailed: 'Backup download failed.', restore: 'Restore', preview: 'Preview restore risk', risk: 'Destructive operation: the current database will be replaced.', noRollback: 'Rollback is unavailable for this provider.', confirm: 'Type the exact project ID to execute restore', execute: 'Execute restore', audit: 'Unified project audit', auditNote: 'Only allowlisted W-DB backup events and W-Radar project summaries are combined. W-ID has no browser-safe project audit contract yet and remains typed unavailable.', sourceUnavailable: 'Source unavailable', empty: 'No records.', loading: 'Loading exact-project backup control…', failed: 'Authorization, backend, quota, or contract validation failed closed.', quota: 'Backup quota reached', days: 'days', bytes: 'bytes', radar: 'W-Radar summary', db: 'W-DB backup audit' },
  zh: { title: '备份与恢复', note: '精确项目的 W-DB 清单、配额、保留策略、恢复预览与有界审计。页面不暴露数据库、存储或 provider 凭证。', unlock: '解锁备份控制台', locked: '创建仅存于内存的短期控制台密钥后继续。', inventory: '备份清单', usage: '用量', retention: '保留策略', capabilities: 'Provider 能力', available: '可用', planned: '计划中——需要 dep_w_db_backup_provider', create: '创建备份', creating: '正在创建备份…', created: '备份请求已确认：', refresh: '刷新', readFailed: '备份清单刷新失败，已确认的操作回执仍保留。', previewing: '正在加载恢复预览…', restoring: '正在恢复数据库…', restoreDone: '恢复成功：', restoreFailed: '恢复失败：', restoreState: '恢复操作：', rollback: '回滚恢复', rollingBack: '正在回滚恢复…', rollbackDone: '恢复已回滚：', rollbackRisk: '将数据库还原到本次恢复前的状态。恢复后产生的变更会被替换。', rollbackConfirm: '输入完整项目 ID 后回滚', unknown: '结果未知。开始新操作前请刷新清单和审计，服务端可能已完成修改。', download: '下载', downloading: '正在准备下载…', createFailed: '创建备份失败。', downloadFailed: '下载备份失败。', restore: '恢复', preview: '预览恢复风险', risk: '破坏性操作：当前数据库将被替换。', noRollback: '当前 Provider 不支持回滚。', confirm: '输入完整项目 ID 后执行恢复', execute: '执行恢复', audit: '统一项目审计', auditNote: '仅组合白名单化的 W-DB 备份事件与 W-Radar 项目摘要。W-ID 尚无浏览器安全项目审计合同，保持明确不可用。', sourceUnavailable: '来源不可用', empty: '暂无记录。', loading: '正在加载精确项目备份控制面…', failed: '授权、后端、配额或合同校验已默认拒绝。', quota: '备份配额已满', days: '天', bytes: '字节', radar: 'W-Radar 摘要', db: 'W-DB 备份审计' },
};

function getBackupBearer(signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void getAccessToken().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

type BackupProps = { lang: Lang; context: SaasContext; projectId: string; publishableKey: string; unlock: () => Promise<void> };
export function ProjectBackupsConsole(props: BackupProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectBackupsSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role, props.publishableKey])} {...props} />;
}
function ProjectBackupsSession({ lang, context, projectId, publishableKey, unlock }: BackupProps) {
  const t = copy[lang];
  const [inventory, setInventory] = useState<ProjectPanelState<ProjectDatabaseBackups> | null>(null);
  const [audit, setAudit] = useState<ProjectPanelState<ProjectDatabaseAudit> | null>(null);
  const [radar, setRadar] = useState<ProjectPanelState<ProjectObservability> | null>(null);
  const [preview, setPreview] = useState<ProjectPanelState<ProjectDatabaseRestorePreview> | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [operation, setOperation] = useState<'create' | 'download' | 'preview' | 'restore' | 'rollback' | null>(null);
  const [message, setMessage] = useState<'idle' | 'failed' | 'unknown'>('idle');
  const [created, setCreated] = useState<ProjectDatabaseBackup | null>(null);
  const [restored, setRestored] = useState<ProjectDatabaseRestore | null>(null);
  const [restoreResourceId, setRestoreResourceId] = useState<string | null>(null);
  const [rollbackConfirmation, setRollbackConfirmation] = useState('');
  const restorePending = restored?.state === 'accepted' || restored?.state === 'running';
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const actionController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const active = useRef(true);
  const objectUrls = useRef<Array<{ url: string; timer: number }>>([]);

  const reload = useCallback(async (parentSignal?: AbortSignal, initialBearer?: string | null) => {
    if (!active.current || !publishableKey) return;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && listController.current === controller && !controller.signal.aborted;
    setReading(true); setPreview(null); setConfirmation(''); setRollbackConfirmation('');
    try {
      const bearer = initialBearer === undefined ? await getBackupBearer(signal) : initialBearer;
      if (!current()) return;
      signal.throwIfAborted();
      const [nextInventory, nextAudit, nextRadar] = await Promise.all([
        loadProjectDatabaseBackups(context, projectId, publishableKey, bearer, request, signal),
        loadProjectDatabaseAudit(context, projectId, 50, publishableKey, bearer, request, signal),
        loadProjectObservability(context, projectId, bearer, request, signal),
      ]);
      if (!current()) return;
      setInventory(signal.aborted ? { status: 'network' } : nextInventory);
      setAudit(signal.aborted ? { status: 'network' } : nextAudit);
      setRadar(signal.aborted ? { status: 'network' } : nextRadar);
      if (!signal.aborted && nextAudit.status === 'ready') setRestored((value) => {
        if (!value || !['accepted', 'running', 'succeeded'].includes(value.state)) return value;
        const events = nextAudit.data.events.filter((event) => event.eventKind === 'restore.executed' && event.objectId === value.operationId);
        const event = events.length === 1 ? events[0] : undefined;
        if (!event || !['running', 'succeeded', 'failed', 'rolled_back'].includes(event.state) || (value.state === 'succeeded' && event.state !== 'rolled_back')) return value;
        return { ...value, state: event.state, ...(/^[a-z][a-z0-9_]{0,127}$/.test(event.errorCode || '') ? { errorCode: event.errorCode! } : {}) };
      });
      if (!signal.aborted && nextInventory.status === 'ready' && nextAudit.status === 'ready') setMessage((value) => value === 'unknown' ? 'idle' : value);
    } catch {
      if (current()) { setInventory({ status: 'network' }); setAudit({ status: 'network' }); setRadar({ status: 'network' }); }
    } finally { if (current()) { setReading(false); listController.current = null; } }
  }, [context, projectId, publishableKey]);
  useEffect(() => {
    active.current = true;
    let initial = true;
    const initialController = new AbortController();
    const initialSignal = AbortSignal.any([initialController.signal, AbortSignal.timeout(30_000)]);
    if (publishableKey) void getBackupBearer(initialSignal).then((bearer) => { if (initial) { setOperation(null); return reload(initialSignal, bearer); } }).catch(() => { if (initial) { setOperation(null); setReading(false); setInventory({ status: 'network' }); } });
    return () => {
      initial = false; initialController.abort(); active.current = false; listController.current?.abort(); listController.current = null;
      actionController.current?.abort(); actionController.current = null;
      for (const item of objectUrls.current) { window.clearTimeout(item.timer); URL.revokeObjectURL(item.url); }
      objectUrls.current = [];
    };
  }, [publishableKey, reload]);

  const runOperation = async <T,>(kind: NonNullable<typeof operation>, invoke: (bearer: string | null, request: typeof fetch, signal: AbortSignal) => Promise<ProjectPanelState<T>>, onSuccess: (value: T, signal: AbortSignal) => Promise<void>) => {
    if (!active.current || actionController.current || listController.current) return;
    const controller = new AbortController(); actionController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && actionController.current === controller && !controller.signal.aborted;
    const writes = kind === 'create' || kind === 'restore' || kind === 'rollback';
    let started = false;
    setOperation(kind); setMessage('idle');
    try {
      const bearer = await getBackupBearer(signal);
      if (!current()) return;
      signal.throwIfAborted(); started = true;
      const response = await invoke(bearer, request, signal);
      if (!current()) return;
      if (signal.aborted || response.status !== 'ready') {
        setMessage(writes && (signal.aborted || response.status === 'network' || response.status === 'invalid') ? 'unknown' : 'failed');
        return;
      }
      await onSuccess(response.data, signal);
    } catch { if (current()) setMessage(writes && started ? 'unknown' : 'failed'); }
    finally { if (current()) { setOperation(null); setDownloadId(null); actionController.current = null; } }
  };
  const validBackup = (backup: ProjectDatabaseBackup) => inventory?.status === 'ready' && inventory.data.projectId === projectId && backup.resourceId === inventory.data.resourceId && backup.state === 'available' && inventory.data.backups.some((item) => item.backupId === backup.backupId && item.resourceId === backup.resourceId && item.state === 'available');
  const createBackup = async () => {
    if (inventory?.status !== 'ready' || !inventory.data.capabilities.create.supported || inventory.data.usage.quotaExceeded || message === 'unknown' || restorePending) return;
    await runOperation('create', (bearer, request, signal) => createProjectDatabaseBackup(context, projectId, inventory.data.resourceId, publishableKey, bearer, request, signal), async (value, signal) => { setCreated(value); await reload(signal); });
  };
  const downloadBackup = async (backup: ProjectDatabaseBackup) => {
    if (!validBackup(backup) || inventory?.status !== 'ready' || !inventory.data.capabilities.download.supported) return;
    await runOperation('download', async (bearer, request, signal) => { setDownloadId(backup.backupId); return downloadProjectDatabaseBackup(context, projectId, backup, publishableKey, bearer, request, signal); }, async (value, signal) => {
      const url = URL.createObjectURL(value.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = value.fileName; anchor.click();
      const timer = window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter((item) => item.url !== url); }, 1000);
      objectUrls.current.push({ url, timer }); await reload(signal);
    });
  };
  const inspect = async (backup: ProjectDatabaseBackup) => {
    if (!validBackup(backup) || inventory?.status !== 'ready' || !inventory.data.restoreSupported || restorePending) return;
    await runOperation('preview', (bearer, request, signal) => { setPreview(null); setConfirmation(''); setRestored(null); setRestoreResourceId(null); setRollbackConfirmation(''); return previewProjectDatabaseRestore(context, projectId, backup, publishableKey, bearer, request, signal); }, async (value) => { setPreview({ status: 'ready', data: value }); });
  };
  const execute = async () => {
    if (preview?.status !== 'ready' || confirmation !== projectId || restored || message === 'unknown' || !validBackup(preview.data.backup) || inventory?.status !== 'ready' || !inventory.data.restoreSupported) return;
    const backup = preview.data.backup;
    await runOperation('restore', (bearer, request, signal) => restoreProjectDatabaseBackup(context, projectId, backup.resourceId, backup.backupId, confirmation, publishableKey, bearer, request, signal), async (value, signal) => { setRestored(value); setRestoreResourceId(backup.resourceId); setConfirmation(''); await reload(signal); });
  };
  const canRollback = restored?.state === 'succeeded' && restored.rollbackAvailable === true && inventory?.status === 'ready' && inventory.data.capabilities.rollback.supported && inventory.data.resourceId === restoreResourceId;
  const rollback = async () => {
    if (!canRollback || !restored || !restoreResourceId || rollbackConfirmation !== projectId || message === 'unknown') return;
    await runOperation('rollback', (bearer, request, signal) => rollbackProjectDatabaseRestore(context, projectId, restoreResourceId, restored, rollbackConfirmation, publishableKey, bearer, request, signal), async (value, signal) => { setRestored(value); setRollbackConfirmation(''); await reload(signal); });
  };
  const busy = operation !== null || reading;
  if (!publishableKey) return <section className="console-view" aria-labelledby="backup-title"><h2 id="backup-title">{t.title}</h2><p>{t.note}</p><p role="status">{t.locked}</p><button className="site-nav-button" type="button" onClick={() => void unlock()}>{t.unlock}</button></section>;
  return <section className="console-view" aria-labelledby="backup-title">
    <div className="console-panel-heading"><h2 id="backup-title">{t.title}</h2><button type="button" disabled={busy} onClick={() => { if (!actionController.current) void reload(); }}>{t.refresh}</button></div>
    <p className="console-boundary-note">{t.note}</p>
    {(!inventory || reading) && <p role="status">{t.loading}</p>}
    {created && <p role="status">{t.created} <code>{created.backupId}</code> · {created.state}</p>}
    {restored && <p role={restored.state === 'failed' ? 'alert' : 'status'}>{restored.state === 'succeeded' ? t.restoreDone : restored.state === 'failed' ? t.restoreFailed : restored.state === 'rolled_back' ? t.rollbackDone : t.restoreState} <code>{restored.operationId}</code> · {restored.state}{restored.errorCode && <> · {restored.errorCode}</>}</p>}
    {operation === 'preview' && <p role="status">{t.previewing}</p>}
    {operation === 'rollback' && <p role="status">{t.rollingBack}</p>}
    {operation === 'restore' && <p role="status">{t.restoring}</p>}
    {message === 'unknown' && <p role="alert">{t.unknown}</p>}
    {message === 'failed' && <p role="alert">{t.failed}</p>}
    {inventory && inventory.status !== 'ready' && <p role="alert">{t.readFailed}</p>}
    {inventory?.status === 'ready' && <>
      <section aria-labelledby="inventory-title"><h3 id="inventory-title">{t.inventory}</h3>
        <div className="console-capabilities"><article className="console-capability"><strong>{t.usage}</strong><span>{inventory.data.usage.items}/{inventory.data.usage.maximumItems} · {inventory.data.usage.bytes} {t.bytes}</span>{inventory.data.usage.quotaExceeded && <small role="alert">{t.quota}</small>}</article><article className="console-capability"><strong>{t.retention}</strong><span>{inventory.data.retentionDays} {t.days}</span></article></div>
        {inventory.data.capabilities.create.supported && <button className="site-nav-button" type="button" onClick={() => void createBackup()} disabled={busy || message === 'unknown' || restorePending || inventory.data.usage.quotaExceeded}>{operation === 'create' ? t.creating : t.create}</button>}
        <h4>{t.capabilities}</h4><div className="console-capabilities">{Object.entries(inventory.data.capabilities).map(([name, capability]) => <article className="console-capability" key={name}><strong>{name}</strong><span className={capability.supported ? 'is-available' : ''}>{capability.supported ? t.available : t.planned}</span>{!capability.supported && <small>{capability.unavailableReason}</small>}</article>)}</div>
        <div className="console-app-list">{inventory.data.backups.length ? inventory.data.backups.map((backup) => <article className="console-app-card" key={backup.backupId}><strong>{backup.backupId}</strong><span>{backup.state} · {backup.format} · {backup.createdAt}</span>{inventory.data.capabilities.download.supported && backup.state === 'available' && <button type="button" disabled={busy} onClick={() => void downloadBackup(backup)}>{downloadId === backup.backupId ? t.downloading : t.download}</button>}{inventory.data.restoreSupported && backup.state === 'available' && <button type="button" disabled={busy || restorePending} onClick={() => void inspect(backup)}>{t.preview}</button>}</article>) : <p>{t.empty}</p>}</div>
      </section>
      {preview?.status === 'ready' && <section aria-labelledby="restore-title"><h3 id="restore-title">{t.restore}</h3><form className="console-form-grid" onSubmit={(event) => { event.preventDefault(); void execute(); }}><p role="alert">{preview.data.destructive && t.risk} {!preview.data.rollbackSupported && t.noRollback}</p><label htmlFor="backup-project-confirm">{t.confirm}: <code>{projectId}</code></label><input id="backup-project-confirm" autoComplete="off" disabled={busy || message === 'unknown'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><button className="site-nav-button" type="submit" disabled={busy || confirmation !== projectId || restored !== null || message === 'unknown'}>{t.execute}</button></form></section>}
      {canRollback && <section aria-labelledby="rollback-title"><h3 id="rollback-title">{t.rollback}</h3><form className="console-form-grid" onSubmit={(event) => { event.preventDefault(); void rollback(); }}><p role="alert">{t.rollbackRisk}</p><label htmlFor="backup-rollback-confirm">{t.rollbackConfirm}: <code>{projectId}</code></label><input id="backup-rollback-confirm" autoComplete="off" disabled={busy || message === 'unknown'} value={rollbackConfirmation} onChange={(event) => setRollbackConfirmation(event.target.value)} /><button className="site-nav-button" type="submit" disabled={busy || message === 'unknown' || rollbackConfirmation !== projectId}>{t.rollback}</button></form></section>}
      <section aria-labelledby="audit-title"><h3 id="audit-title">{t.audit}</h3><p className="console-note">{t.auditNote}</p><h4>{t.db}</h4>{audit?.status === 'ready' ? <div className="console-app-list">{audit.data.events.map((event) => <article className="console-app-card" key={`${event.eventKind}-${event.objectId}-${event.createdAt}`}><strong>{event.eventKind}</strong><span>{event.state} · {event.createdAt}</span>{event.errorCode && <small>{event.errorCode}</small>}</article>)}</div> : <p role="status">{t.sourceUnavailable}</p>}<h4>{t.radar}</h4>{radar?.status === 'ready' ? <div className="console-capabilities"><article className="console-capability"><strong>{t.radar}</strong><span>{radar.data.releases.length} releases · {radar.data.deployments.length} deployments · {radar.data.errors.length} errors</span></article></div> : <p role="status">{t.sourceUnavailable}</p>}<h4>W-ID</h4><p role="status">{t.sourceUnavailable}</p></section>
    </>}
  </section>;
}
