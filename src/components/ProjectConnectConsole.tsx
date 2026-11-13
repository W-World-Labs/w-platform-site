import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import { issueProjectPublishableKey, issueProjectServerKey, loadProjectConnect, loadProjectKeyMetadata, revokeProjectKey, rotateProjectKey, PROJECT_SERVER_KEY_SCOPES, type ProjectServerKeyInput, type DiscoveryResult, type ProjectKeyMetadata, type ProjectPanelState, type SaasContext } from '../lib/saasConsole';
import type { Lang } from '../i18n';

const copy = {
  en: { title: 'Project Connect', note: 'W-ID automatically supplies this exact project’s browser-safe URL and publishable key. No manual key paste is required.', loading: 'Connecting the exact project…', unavailable: 'Automatic Project Connect is unavailable or denied.', config: 'Automatic browser configuration', keys: 'Project keys', publishable: 'Publishable', server: 'Server', createServer: 'Create server key', confirm: 'Type the exact project ID to create, rotate or revoke a key', rotate: 'Rotate', revoke: 'Revoke', copy: 'Copy', copied: 'Copied', oneTime: 'One-time server key — copy it now. It disappears when you leave this page and is metadata-only afterwards.', snippets: 'SDK and CLI snippets', member: 'Key lifecycle requires project owner/admin. Existing browser-safe connection remains available to members.', none: 'No keys.', failed: 'Operation failed closed.', metadata: 'Secret material is never returned by key inventory.', serverSettings: 'New server key settings', keyName: 'Key name', permissions: 'Permissions', expiry: 'Expires after', hour: '1 hour', day: '24 hours', week: '7 days', month: '30 days', never: 'No expiry', scopeHelp: 'Choose the permissions this backend needs. Server keys are shown once.', refresh: 'Refresh keys', unknown: 'The result is unknown. Refresh keys and inspect the inventory before retrying; the change may already have completed.', confirmed: 'Key created:', expiryAt: 'Expires', noExpiry: 'No expiry' },
  zh: { title: '项目连接', note: 'W-ID 自动提供当前精确项目的浏览器安全地址与 publishable key，无需手工粘贴。', loading: '正在自动连接精确项目…', unavailable: '自动 Project Connect 不可用或被拒绝。', config: '自动浏览器配置', keys: '项目密钥', publishable: '可发布', server: '服务端', createServer: '创建服务端密钥', confirm: '输入完整项目 ID 后创建、轮换或撤销密钥', rotate: '轮换', revoke: '撤销', copy: '复制', copied: '已复制', oneTime: '服务端密钥仅显示一次——请立即复制。离开页面即消失，此后仅显示元数据。', snippets: 'SDK 与 CLI 示例', member: '密钥生命周期仅限项目 owner/admin；普通成员仍可使用现有浏览器安全连接。', none: '暂无密钥。', failed: '操作已默认拒绝。', metadata: '密钥清单绝不返回 secret material。', serverSettings: '新服务端密钥设置', keyName: '密钥名称', permissions: '权限', expiry: '有效期', hour: '1 小时', day: '24 小时', week: '7 天', month: '30 天', never: '永不过期', scopeHelp: '选择此后端需要的权限。服务端密钥仅显示一次。', refresh: '刷新密钥', unknown: '结果未知。重试前请刷新密钥并检查清单，操作可能已经完成。', confirmed: '密钥已创建：', expiryAt: '到期时间', noExpiry: '永不过期' },
};

const SCOPE_LABELS = {
  en: ['Authentication', 'Read data', 'Write data', 'Read storage', 'Write storage', 'Connect Realtime', 'Invoke functions', 'Read Sites', 'Write Sites', 'Administer data', 'Write migrations', 'Administer storage', 'Deploy functions', 'Write policies'],
  zh: ['身份认证', '读取数据', '写入数据', '读取存储', '写入存储', '连接 Realtime', '调用函数', '读取网站', '修改网站', '管理数据', '写入迁移', '管理存储', '部署函数', '修改策略'],
} as const;

function readConnectBearer(signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted(); const abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
    void getAccessToken().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function activeKey(key: { revokedAt?: number | null; expiresAt?: number | null; overlapExpiresAt?: number | null }): boolean {
  const now = Math.floor(Date.now() / 1000);
  return key.revokedAt == null && [key.expiresAt, key.overlapExpiresAt].every((deadline) => deadline == null || (Number.isSafeInteger(deadline) && deadline > now));
}

type ConnectProps = { lang: Lang; context: SaasContext; projectId: string };

export function ProjectConnectConsole(props: ConnectProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectConnectSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role])} {...props} />;
}

function ProjectConnectSession({ lang, context, projectId }: ConnectProps) {
  const t = copy[lang]; const project = context.console.projects.find((item) => item.id === projectId); const canManage = Boolean(project && context.authorityPlanes.workspaceMemberships.some((workspace) => workspace.id === project.workspaceId) && ['owner', 'admin'].includes(project.workspaceRole)); const [connect, setConnect] = useState<DiscoveryResult | null>(null); const [keys, setKeys] = useState<ProjectPanelState<ProjectKeyMetadata[]> | null>(null); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState('');
  const [keyName, setKeyName] = useState('W Platform server key');
  const [keyScopes, setKeyScopes] = useState<string[]>(['data:read', 'storage:read']);
  const [lifetime, setLifetime] = useState('86400');
  const [unknown, setUnknown] = useState(false);
  const unknownOperation = useRef(false);
  const [serverReceipt, setServerReceipt] = useState<{ metadata: ProjectKeyMetadata; key: string } | null>(null);
  const oneTimeServerKey = serverReceipt?.key || '';
  const createdMetadata = serverReceipt?.metadata;
  const generation = useRef(0);
  const requestAbort = useRef(new AbortController());
  const operationSignal = useRef<AbortSignal>(new AbortController().signal);
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const sessionRequest = useCallback<typeof fetch>((input, init) => {
    requestAbort.current.signal.throwIfAborted(); operationSignal.current.throwIfAborted();
    return fetch(input, {
      ...init,
      signal: AbortSignal.any([requestAbort.current.signal, operationSignal.current, ...(init?.signal ? [init.signal] : [])]),
    });
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    requestAbort.current = new AbortController();
    operationSignal.current = AbortSignal.any([requestAbort.current.signal, AbortSignal.timeout(30_000)]);
    operation.current = true;
    const active = () => generation.current === current;
    queueMicrotask(() => { if (active()) { setConnect(null); setKeys(null); setServerReceipt(null); setConfirmation(''); setMessage(''); setBusy(true); } });
    void readConnectBearer(operationSignal.current).then(async (token) => {
      if (!active()) return;
      const discovered = await loadProjectConnect(context, projectId, token, sessionRequest);
      if (!active()) return;
      let connected = discovered;
      const usable = discovered.status === 'ready' && discovered.publishableKeys?.some((key) => key.publishableKey && activeKey(key));
      if (discovered.status === 'ready' && !usable && canManage) {
        operation.current = true;
        setBusy(true);
        const issued = await issueProjectPublishableKey(context, projectId, token, window.location.origin, sessionRequest);
        if (!active()) return;
        if (issued.status === 'ready' && issued.oneTimeKey && issued.metadata) connected = { ...discovered, publishableKeys: [{ ...issued.metadata, publishableKey: issued.oneTimeKey }, ...(discovered.publishableKeys || [])] };
      }
      if (!active()) return;
      setConnect(connected);
      if (canManage) {
        const metadata = await loadProjectKeyMetadata(context, projectId, token, sessionRequest);
        if (active()) setKeys(metadata);
      }
    }).catch(() => { if (active()) setConnect({ status: 'error', reason: 'network' }); })
      .finally(() => { if (active()) { operation.current = false; setBusy(false); } });
    return () => { generation.current += 1; requestAbort.current.abort(); };
  }, [context, projectId, canManage, sessionRequest]);
  const usable = connect?.status === 'ready' ? connect.publishableKeys?.find((key) => key.publishableKey && activeKey(key)) : undefined; const projectUrl = connect?.status === 'ready' ? connect.projectUrl : undefined;
  const copyText = async (value: string) => {
    const current = generation.current;
    try { await navigator.clipboard.writeText(value); if (generation.current === current) setMessage(t.copied); }
    catch { if (generation.current === current) setMessage(t.failed); }
  };
  const reconcileInventory = (metadata: ProjectPanelState<ProjectKeyMetadata[]>) => {
    setKeys(metadata);
    if (metadata.status !== 'ready') return;
    const activeIds = new Set(metadata.data.filter(activeKey).map((key) => key.id));
    setConnect((previous) => previous?.status === 'ready' ? { ...previous, publishableKeys: previous.publishableKeys?.filter((key) => activeIds.has(key.id)) } : previous);
    setServerReceipt((previous) => previous && activeIds.has(previous.metadata.id) ? previous : null);
  };
  const manageKey = async (key?: ProjectKeyMetadata, action?: 'rotate' | 'revoke' | 'publishable') => {
    if (!canManage || confirmation !== projectId || operation.current || unknownOperation.current) return;
    operation.current = true;
    const signal = AbortSignal.any([requestAbort.current.signal, AbortSignal.timeout(30_000)]); operationSignal.current = signal;
    let writeStarted = false;
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); if (init?.method === 'POST') writeStarted = true; return sessionRequest(input, init); };
    setBusy(true);
    setMessage('');
    const current = generation.current;
    const active = () => generation.current === current;
    try {
      const token = await readConnectBearer(signal);
      if (!active()) return;
      signal.throwIfAborted();
      const result = key
        ? action === 'rotate'
          ? await rotateProjectKey(context, projectId, key, confirmation, token, request)
          : await revokeProjectKey(context, projectId, key.id, confirmation, token, request)
        : action === 'publishable'
          ? await issueProjectPublishableKey(context, projectId, token, window.location.origin, request)
          : await issueProjectServerKey(context, projectId, confirmation, token, request, { name: keyName, scopes: keyScopes, expiresAt: lifetime === 'none' ? null : Math.floor(Date.now() / 1000) + Number(lifetime) } satisfies ProjectServerKeyInput);
      if (!active()) return;
      if (result.status !== 'ready') { if (writeStarted && ['network', 'invalid'].includes(result.reason)) { unknownOperation.current = true; setUnknown(true); if (key?.kind === 'publishable' || action === 'publishable') setConnect((previous) => previous?.status === 'ready' ? { ...previous, publishableKeys: [] } : previous); } setMessage(t.failed); return; }
      if ('oneTimeKey' in result && result.oneTimeKey && result.metadata && 'kind' in result.metadata && result.metadata.kind === 'server') setServerReceipt({ key: result.oneTimeKey, metadata: result.metadata });
      if (key?.kind === 'publishable' || action === 'publishable') {
        setConnect((previous) => {
          if (previous?.status !== 'ready') return previous;
          const retained = (previous.publishableKeys || []).filter((item) => item.id !== key?.id);
          return { ...previous, publishableKeys: 'oneTimeKey' in result && result.oneTimeKey && result.metadata ? [{ ...result.metadata, publishableKey: result.oneTimeKey, requiresRotation: false }, ...retained] : retained };
        });
      }
      if (key?.kind === 'server' && action === 'revoke') setServerReceipt((previous) => previous?.metadata.id === key.id ? null : previous);
      setConfirmation('');
      const metadata = await loadProjectKeyMetadata(context, projectId, token, sessionRequest);
      if (active()) reconcileInventory(metadata);
    } catch { if (active()) { if (writeStarted) { unknownOperation.current = true; setUnknown(true); if (key?.kind === 'publishable' || action === 'publishable') setConnect((previous) => previous?.status === 'ready' ? { ...previous, publishableKeys: [] } : previous); } setMessage(t.failed); } }
    finally { if (active()) { operation.current = false; setBusy(false); } }
  };
  const refreshKeys = async () => {
    if (!canManage || operation.current) return;
    operation.current = true; setBusy(true); setMessage('');
    const current = generation.current;
    const signal = AbortSignal.any([requestAbort.current.signal, AbortSignal.timeout(30_000)]); operationSignal.current = signal;
    try {
      const token = await readConnectBearer(signal); signal.throwIfAborted();
      const metadata = await loadProjectKeyMetadata(context, projectId, token, sessionRequest);
      if (generation.current !== current) return;
      reconcileInventory(metadata);
      if (metadata.status !== 'ready') { setMessage(t.failed); return; }
      const discovered = await loadProjectConnect(context, projectId, token, sessionRequest);
      if (generation.current !== current) return;
      if (discovered.status !== 'ready' || !discovered.projectUrl) { setMessage(t.failed); return; }
      const activeIds = new Set(metadata.data.filter((key) => key.kind === 'publishable' && activeKey(key)).map((key) => key.id));
      setConnect({ ...discovered, publishableKeys: discovered.publishableKeys?.filter((key) => activeIds.has(key.id) && activeKey(key)) });
      unknownOperation.current = false; setUnknown(false);
    } catch { if (generation.current === current) setMessage(t.failed); }
    finally { if (generation.current === current) { operation.current = false; setBusy(false); } }
  };
  const env = projectUrl && usable?.publishableKey ? `W_PROJECT_URL=${projectUrl}\nW_PUBLISHABLE_KEY=${usable.publishableKey}` : ''; const wSdk = projectUrl && usable?.publishableKey ? `import { createWClient } from '@w-id/browser';\nconst w = createWClient({ projectUrl: '${projectUrl}', publishableKey: '${usable.publishableKey}' });` : ''; const supabase = projectUrl && usable?.publishableKey ? `import { createClient } from '@supabase/supabase-js';\nconst supabase = createClient('${projectUrl}', '${usable.publishableKey}');` : ''; const cli = projectUrl && usable?.publishableKey ? `w project connect --url '${projectUrl}' --publishable-key '${usable.publishableKey}'` : '';
  return <section className="console-view" aria-labelledby="connect-title">
    <h2 id="connect-title">{t.title}</h2><p className="console-boundary-note">{t.note}</p>
    {!connect ? <p role="status">{t.loading}</p> : connect.status !== 'ready' || !projectUrl ? <p role="alert">{t.unavailable}</p> : <>
      {usable?.publishableKey ? <section aria-labelledby="config-title">
        <h3 id="config-title">{t.config}</h3>
        <div className="console-key-note"><strong>W_PROJECT_URL</strong><code>{projectUrl}</code></div>
        <div className="console-key-note"><strong>W_PUBLISHABLE_KEY</strong><code>{usable.publishableKey}</code></div>
        <h3>{t.snippets}</h3>
        {[['.env', env], ['W SDK', wSdk], ['supabase-js', supabase], ['W CLI', cli]].map(([label, value]) => <div className="console-boundary-note" key={label}><strong>{label}</strong><pre><code>{value}</code></pre><button type="button" onClick={() => void copyText(value)}>{t.copy}</button></div>)}
      </section> : <p role="alert">{t.unavailable}</p>}
      <section aria-labelledby="keys-title">
        <div className="console-panel-heading"><div><h3 id="keys-title">{t.keys}</h3><p>{t.metadata}</p></div>{canManage && <div className="console-row-actions">
          {!usable && <button type="button" disabled={busy || unknown || confirmation !== projectId} onClick={() => void manageKey(undefined, 'publishable')}>{lang === 'zh' ? '创建可发布密钥' : 'Create publishable key'}</button>}
          <button className="site-nav-button" type="button" disabled={busy || unknown || confirmation !== projectId || !keyName.trim() || !keyScopes.length} onClick={() => void manageKey()}>{t.createServer}</button>
        </div>}</div>
        {canManage ? <>
          <button type="button" disabled={busy} onClick={() => void refreshKeys()}>{t.refresh}</button>
          <fieldset disabled={busy}><legend>{t.serverSettings}</legend>
            <label htmlFor="server-key-name">{t.keyName}</label><input id="server-key-name" maxLength={128} value={keyName} onChange={(event) => setKeyName(event.target.value)} />
            <label htmlFor="server-key-expiry">{t.expiry}</label><select id="server-key-expiry" value={lifetime} onChange={(event) => setLifetime(event.target.value)}><option value="3600">{t.hour}</option><option value="86400">{t.day}</option><option value="604800">{t.week}</option><option value="2592000">{t.month}</option><option value="none">{t.never}</option></select>
            <fieldset><legend>{t.permissions}</legend>{PROJECT_SERVER_KEY_SCOPES.map((scope, index) => <label key={scope}><input type="checkbox" checked={keyScopes.includes(scope)} onChange={(event) => setKeyScopes((previous) => event.target.checked ? [...previous, scope] : previous.filter((value) => value !== scope))} /> {SCOPE_LABELS[lang][index]} <code>{scope}</code></label>)}</fieldset><p>{t.scopeHelp}</p>
          </fieldset>
          <label htmlFor="connect-confirmation">{t.confirm}: <code>{projectId}</code></label>
          <input id="connect-confirmation" autoComplete="off" disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          {keys?.status === 'ready' ? <div className="console-app-list">{keys.data.length ? keys.data.map((key) => <article className="console-app-card" key={key.id}>
            <strong>{key.kind === 'server' ? t.server : t.publishable} · {key.name}</strong><span>{key.keyPrefix}… · {key.scopes.join(', ')}</span><span>{t.expiryAt}: {key.expiresAt == null ? t.noExpiry : new Date(key.expiresAt * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')}</span>
            <div className="console-row-actions">
              <button type="button" disabled={busy || unknown || confirmation !== projectId || !activeKey(key)} onClick={() => void manageKey(key, 'rotate')}>{t.rotate}</button>
              <button type="button" disabled={busy || unknown || confirmation !== projectId || !activeKey(key)} onClick={() => void manageKey(key, 'revoke')}>{t.revoke}</button>
            </div>
          </article>) : <p>{t.none}</p>}</div> : <p role="status">{keys ? t.failed : t.loading}</p>}
        </> : <p role="status">{t.member}</p>}
        {createdMetadata && <p role="status">{t.confirmed} <strong>{createdMetadata.name}</strong> · <code>{createdMetadata.id}</code> · {createdMetadata.scopes.join(', ')}</p>}
        {unknown && <p role="alert">{t.unknown}</p>}
        {oneTimeServerKey && <div className="console-boundary-note" role="status"><strong>{t.oneTime}</strong><code>{oneTimeServerKey}</code><button type="button" onClick={() => void copyText(oneTimeServerKey)}>{t.copy}</button></div>}
        {busy && <p role="status">{t.loading}</p>}
        {message && <p role="status" aria-live="polite">{message}</p>}
      </section>
    </>}
  </section>;
}
