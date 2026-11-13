import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import { validProjectTableIdentifier } from '../lib/projectTableDefinition';
import { loadProjectRealtimeStatus, startProjectRealtimeChannel, serializeProjectRealtimeHistory, validProjectRealtimeSubscriptionFilter, parseProjectRealtimeBroadcast, type ProjectPanelState, type ProjectRealtimeController, type ProjectRealtimeStatus, type ProjectRealtimeChange, type ProjectRealtimeHistoryEntry, type SaasContext } from '../lib/saasConsole';
import type { Lang } from '../i18n';

const COPY = {
  en: { title: 'Realtime', note: 'Inspect and test this project’s official-compatible private Realtime channel. Tokens and row data are never rendered.', unlock: 'Unlock Realtime console', locked: 'Create an in-memory 15-minute Realtime-only key to continue.', status: 'Project status', available: 'Available', unavailable: 'Unavailable', connections: 'Active connections', broadcast: 'Broadcast', presence: 'Presence', postgres: 'Postgres Changes', worker: 'Replication worker', lag: 'WAL lag (bytes)', lastError: 'Last replication error', lagUnknown: 'Measurement unavailable', noError: 'No current error', lagNote: 'WAL bytes between the current database position and this project’s acknowledged replication slot. This is not a row count or a time estimate.', workerStates: { initializing: 'Initializing', running: 'Running', standby: 'Standby', retrying: 'Retrying', stopped: 'Stopped', failed: 'Failed', unconfigured: 'Not configured' }, replicationErrors: { decoder_busy: 'Another worker owns the decoder', replication_unavailable: 'Replication unavailable', worker_stopped: 'Worker stopped', not_configured: 'Replication not configured', lag_probe_unavailable: 'Lag measurement unavailable' }, missingStatus: 'The canonical W-DB status contract does not expose this field.', postgresDisabled: 'Postgres Changes is unavailable for this project.', channel: 'Private channel', channelName: 'Channel name', connect: 'Connect', disconnect: 'Disconnect', connection: 'Connection state', presenceCount: 'Presence members', ownPresence: 'This browser’s Presence', presenceTracked: 'Joined (acknowledged)', presenceUntracked: 'Left (acknowledged)', presenceUnknown: 'Unknown — acknowledgement missing', presenceJoin: 'Join Presence', presenceLeave: 'Leave Presence', presenceNote: 'Leave or rejoin Presence while keeping this private channel connected. Only member counts are displayed. A missing acknowledgement leaves your membership unknown; no automatic retry.', presenceSending: 'Waiting for Presence acknowledgement…', presenceOk: 'Presence change acknowledged.', presenceFailed: 'Presence was not acknowledged. Membership is unknown; check the channel before deliberately retrying.', test: 'Send controlled test event', testCount: 'Received test events', loading: 'Loading exact-project Realtime status…', failed: 'Realtime status or channel authorization failed closed.', interrupted: 'The channel connection failed or ended. Connect again for fresh project authorization; saved history stays until reconnecting.', connected: 'Official Realtime channel connected.', testOk: 'Controlled Broadcast acknowledged.', broadcastEvent: 'Broadcast event name', broadcastPayload: 'Broadcast JSON object', broadcastNote: 'Send a test object to this authorized private channel. Event names: 1–64 UTF-8 bytes without spaces; JSON: up to 8 KiB, within the project frame limit. ACK confirms server acceptance. A missing ACK may still mean delivery; retry only deliberately. Only the current test event name is counted, and received payloads are not displayed.', broadcastInvalid: 'Enter a valid event name and JSON object within the byte and project frame limits.', broadcastSending: 'Waiting for Broadcast acknowledgement…', broadcastFailed: 'The Broadcast was not acknowledged. Delivery is unknown; inspect the receiver before sending again.', lastBroadcast: 'Last received test event', subscribeTable: 'Subscribe to table changes', table: 'Table in public schema', subscriptionFilter: 'Server subscription filter (optional)', subscriptionNote: 'For example: status=eq.open,priority=gte.2. The server combines up to 16 conditions with AND and checks the published scalar columns and values. Maximum 4 KiB; disconnect to change the subscription. Leave empty for all authorized changes.', subscriptionInvalid: 'The subscription filter must fit within 4 KiB and contain no control characters.', subscriptionApplied: 'History subscription filter', subscriptionAll: 'All authorized changes', events: 'Database events received', rowNote: 'Counts reflect authorized events from the server. Row contents are never displayed.', refresh: 'Refresh status', refreshing: 'Refreshing status…', checkedAt: 'Last checked (UTC)', staleStatus: 'Status refresh failed. Showing the last successful status; refresh successfully before opening a new channel.', history: 'Recent database events', historyNote: 'Newest 100 events received by this browser, newest first. Filtering does not change the subscription.', eventFilter: 'Event type', allEvents: 'All event types', pause: 'Pause history', resume: 'Resume history', paused: 'History paused. Events are still counted but are not saved; resuming does not replay them.', clear: 'Clear history', emptyHistory: 'No saved events match this filter.', received: 'Received at (UTC)', eventTable: 'Table', stored: 'Saved events', exportJson: 'Export filtered history JSON', exportCsv: 'Export filtered history CSV', exportNote: 'Download the saved events matching this filter, with the table, retained count and cumulative totals. Downloads contain event metadata only. CSV escapes formula-like text for spreadsheets.', exportFailed: 'The history download could not be prepared. Saved events are still available.' },
  zh: { title: '实时', note: '查看并测试当前项目的官方兼容私有 Realtime Channel。页面绝不渲染令牌或数据行内容。', unlock: '解锁实时控制台', locked: '创建一个仅存于内存、有效期 15 分钟的 Realtime 专用密钥后继续。', status: '项目状态', available: '可用', unavailable: '不可用', connections: '活跃连接', broadcast: '广播', presence: '在线状态', postgres: 'Postgres Changes', worker: '复制 Worker', lag: 'WAL 延迟（字节）', lastError: '最近复制错误', lagUnknown: '暂时无法测量', noError: '当前无错误', lagNote: '当前数据库 WAL 位置与本项目复制槽已确认位置之间的字节差，不代表行数或时间估算。', workerStates: { initializing: '初始化中', running: '运行中', standby: '待命', retrying: '重试中', stopped: '已停止', failed: '故障', unconfigured: '未配置' }, replicationErrors: { decoder_busy: '其他 Worker 正在持有解码器', replication_unavailable: '复制暂不可用', worker_stopped: 'Worker 已停止', not_configured: '尚未配置复制', lag_probe_unavailable: '暂时无法测量延迟' }, missingStatus: 'Canonical W-DB 状态契约尚未暴露此字段。', postgresDisabled: '当前项目的 Postgres Changes 不可用。', channel: '私有 Channel', channelName: 'Channel 名称', connect: '连接', disconnect: '断开', connection: '连接状态', presenceCount: '在线成员', ownPresence: '此浏览器的 Presence', presenceTracked: '已加入（已确认）', presenceUntracked: '已离开（已确认）', presenceUnknown: '未知——未收到确认', presenceJoin: '加入 Presence', presenceLeave: '离开 Presence', presenceNote: '保持私有频道连接时，可离开或重新加入 Presence。仅显示成员数；未收到确认时，成员状态未知，不会自动重试。', presenceSending: '正在等待 Presence 确认…', presenceOk: 'Presence 变更已确认。', presenceFailed: 'Presence 未收到确认，成员状态未知；请检查频道后再决定是否重试。', test: '发送受控测试事件', testCount: '收到的测试事件', loading: '正在加载精确项目 Realtime 状态…', failed: 'Realtime 状态或 Channel 授权已默认拒绝。', interrupted: 'Channel 连接失败或已结束。重新连接以获取新的项目授权；已保存记录会保留到重新连接时。', connected: '官方 Realtime Channel 已连接。', testOk: '受控 Broadcast 已确认。', broadcastEvent: 'Broadcast 事件名', broadcastPayload: 'Broadcast JSON 对象', broadcastNote: '向此已授权私有频道发送测试对象。事件名为 1–64 个 UTF-8 字节且不含空白；JSON 最多 8 KiB，并须符合项目帧限制。ACK 表示服务端已接受；缺少 ACK 时仍可能已经送达，仅在明确需要时重试。只统计当前测试事件名，不展示收到的消息内容。', broadcastInvalid: '请输入有效事件名和 JSON 对象，并符合字节及项目帧限制。', broadcastSending: '正在等待 Broadcast 确认…', broadcastFailed: 'Broadcast 未收到确认，是否送达未知；再次发送前请检查接收端。', lastBroadcast: '最近收到的测试事件', subscribeTable: '订阅表变更', table: 'public schema 中的表', subscriptionFilter: '服务端订阅筛选（可选）', subscriptionNote: '例如 status=eq.open,priority=gte.2。服务端以 AND 连接最多 16 个条件，并检查已发布的标量字段和值。最多 4 KiB；断开后可修改订阅。留空则接收全部已授权变更。', subscriptionInvalid: '订阅条件须在 4 KiB 内，且不能含控制字符。', subscriptionApplied: '记录的订阅条件', subscriptionAll: '全部已授权变更', events: '收到的数据库事件', rowNote: '计数来自服务端授权的真实事件。页面不显示数据行内容。', refresh: '刷新状态', refreshing: '正在刷新状态…', checkedAt: '最近检查（UTC）', staleStatus: '状态刷新失败，当前显示最近一次成功读取的状态；请成功刷新后再建立新连接。', history: '最近数据库事件', historyNote: '保留此浏览器收到的最近 100 条事件，最新事件在前。筛选不会改变订阅。', eventFilter: '事件类型', allEvents: '全部事件类型', pause: '暂停记录', resume: '继续记录', paused: '已暂停记录。事件仍会计数，但不会保存；继续记录不会重放暂停期间的事件。', clear: '清空记录', emptyHistory: '当前筛选没有已保存的事件。', received: '接收时间（UTC）', eventTable: '表', stored: '已保存事件', exportJson: '导出筛选记录 JSON', exportCsv: '导出筛选记录 CSV', exportNote: '下载当前筛选匹配的已保存事件，并附表名、保留记录数和累计计数。下载仅包含事件元数据。CSV 会转义可能被电子表格作为公式的文本。', exportFailed: '无法准备记录下载，已保存的事件仍可使用。' },
} as const;

export interface ProjectRealtimeConsoleProps { lang: Lang; context: SaasContext; projectId: string; publishableKey: string; unlock: () => Promise<void> }

export function ProjectRealtimeConsole(props: ProjectRealtimeConsoleProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectRealtimeSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role, props.publishableKey])} {...props} />;
}

function ProjectRealtimeSession({ lang, context, projectId, publishableKey, unlock }: ProjectRealtimeConsoleProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<ProjectPanelState<ProjectRealtimeStatus> | null>(null);
  const [statusLoading, setStatusLoading] = useState(Boolean(publishableKey));
  const [statusError, setStatusError] = useState(false);
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const statusPending = useRef(Boolean(publishableKey));
  const [channelName, setChannelName] = useState('console-test'); const [connection, setConnection] = useState('CLOSED'); const [presence, setPresence] = useState(0); const [testEvents, setTestEvents] = useState(0); const [message, setMessage] = useState<'idle' | 'loading' | 'sending' | 'connected' | 'test' | 'error' | 'send-error' | 'interrupted' | 'presence-sending' | 'presence-ok' | 'presence-error'>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [broadcastEvent, setBroadcastEvent] = useState('w_console_test');
  const [broadcastPayload, setBroadcastPayload] = useState('{\n  "kind": "controlled_test"\n}');
  const [lastBroadcast, setLastBroadcast] = useState('');
  const sending = useRef(false);
  const [ownPresence, setOwnPresence] = useState<'tracked' | 'untracked' | 'unknown' | null>(null);
  const [subscribeTable, setSubscribeTable] = useState(false); const [table, setTable] = useState('todos');
  const [changes, setChanges] = useState({ INSERT: 0, UPDATE: 0, DELETE: 0 });
  const [eventTable, setEventTable] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [eventSubscriptionFilter, setEventSubscriptionFilter] = useState('');
  const [history, setHistory] = useState<ProjectRealtimeHistoryEntry[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | ProjectRealtimeChange>('all');
  const [historyPaused, setHistoryPaused] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const objectUrls = useRef<Array<{ url: string; timer: number }>>([]);
  const historyPausedRef = useRef(false); const eventSequence = useRef(0);
  const [statusRevision, setStatusRevision] = useState(0);
  const controller = useRef<ProjectRealtimeController | null>(null);
  const connectAbort = useRef<AbortController | null>(null); const generation = useRef(0); const connecting = useRef(false);
  useEffect(() => {
    if (!publishableKey) return;
    const abort = new AbortController();
    let cancelled = false;
    statusPending.current = true;
    const finish = (result: ProjectPanelState<ProjectRealtimeStatus>) => {
      if (cancelled || abort.signal.aborted) return;
      window.clearTimeout(deadline);
      setStatus((previous) => result.status === 'ready' || previous?.status !== 'ready' ? result : previous);
      setStatusError(result.status !== 'ready');
      if (result.status === 'ready') setStatusCheckedAt(new Date().toISOString());
      setStatusLoading(false); statusPending.current = false;
    };
    // This bounds identity authorization as well as the subsequent status reads.
    const deadline = window.setTimeout(() => { finish({ status: 'network' }); abort.abort(); }, 30_000);
    void getAccessToken().then((bearer) => { abort.signal.throwIfAborted(); return loadProjectRealtimeStatus(context, projectId, publishableKey, bearer, fetch, abort.signal); })
      .then(finish).catch(() => finish({ status: 'network' }));
    return () => { cancelled = true; window.clearTimeout(deadline); abort.abort(); };
  }, [context, projectId, publishableKey, statusRevision]);
  useEffect(() => () => { generation.current++; connectAbort.current?.abort(); void controller.current?.stop(); controller.current = null; for (const item of objectUrls.current) { window.clearTimeout(item.timer); URL.revokeObjectURL(item.url); } objectUrls.current = []; }, []);
  const refreshStatus = () => {
    if (statusPending.current || connecting.current) return;
    statusPending.current = true; setStatusLoading(true); setStatusRevision((value) => value + 1);
  };
  const connect = async () => {
    if (statusPending.current || statusError || connecting.current || controller.current || status?.status !== 'ready' || !status.data.available || !status.data.broadcast || !status.data.presence || !status.data.privateChannels) return;
    if (subscribeTable && (!status.data.postgresChanges || !validProjectTableIdentifier(table) || !validProjectRealtimeSubscriptionFilter(subscriptionFilter))) return;
    connecting.current = true; const current = ++generation.current;
    const abort = new AbortController(); connectAbort.current = abort;
    const active = () => current === generation.current && !abort.signal.aborted;
    setMessage('loading'); setChanges({ INSERT: 0, UPDATE: 0, DELETE: 0 }); setTestEvents(0); setLastBroadcast(''); setOwnPresence(null); sending.current = false;
    setEventTable(subscribeTable ? table : ''); setEventSubscriptionFilter(subscribeTable ? subscriptionFilter : ''); setHistory([]); setEventFilter('all'); setExportFailed(false);
    historyPausedRef.current = false; setHistoryPaused(false);
    try {
      const bearer = await getAccessToken(); if (!active()) return;
      const result = await startProjectRealtimeChannel(context, projectId, status.data, channelName, publishableKey, bearer, fetch, {
        onConnection: (state) => {
          if (!active()) return;
          setConnection(state);
          if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) return;
          generation.current++; connecting.current = false; sending.current = false;
          abort.abort(); connectAbort.current = null;
          const previous = controller.current; controller.current = null;
          void previous?.stop();
          setIsConnected(false); setPresence(0); setOwnPresence(null); setMessage('interrupted');
        },
        onPresence: (count) => { if (active()) setPresence(count); },
        onTestEvent: (event) => { if (active()) { setTestEvents((value) => value + 1); setLastBroadcast(event); } },
        onPostgresChange: (event: ProjectRealtimeChange) => {
          if (!active()) return;
          setChanges((value) => ({ ...value, [event]: value[event] + 1 }));
          if (historyPausedRef.current) return;
          const entry = { id: ++eventSequence.current, event, table, receivedAt: new Date().toISOString() };
          setHistory((value) => [entry, ...value].slice(0, 100));
        },
      }, { ...(subscribeTable ? { table, filter: subscriptionFilter } : {}), signal: abort.signal });
      if (!active()) { if (result.status === 'ready') await result.data.stop(); return; }
      if (result.status === 'ready') { controller.current = result.data; setIsConnected(true); setOwnPresence('tracked'); setMessage('connected'); } else { setConnection('CLOSED'); setMessage('error'); }
    } catch { if (active()) { setConnection('CLOSED'); setMessage('error'); } }
    finally { if (current === generation.current) connecting.current = false; }
  };
  const disconnect = async () => {
    generation.current++; connecting.current = false; sending.current = false; connectAbort.current?.abort(); connectAbort.current = null;
    const previous = controller.current; controller.current = null;
    setIsConnected(false); setConnection('CLOSED'); setPresence(0); setOwnPresence(null); setMessage('idle');
    await previous?.stop();
  };
  const sendTest = async () => {
    const current = generation.current; const channel = controller.current;
    if (!channel || sending.current || status?.status !== 'ready') return;
    const input = parseProjectRealtimeBroadcast(broadcastEvent, broadcastPayload, status.data.limits.frameBytes, channelName);
    if (!input) return;
    sending.current = true; setMessage('sending');
    try { const result = await channel.sendTestEvent(input); if (current === generation.current) setMessage(result === 'ok' ? 'test' : 'send-error'); }
    catch { if (current === generation.current) setMessage('send-error'); }
    finally { if (current === generation.current) sending.current = false; }
  };
  const changePresence = async (tracked: boolean) => {
    const current = generation.current; const channel = controller.current;
    if (!channel || sending.current || ownPresence === (tracked ? 'tracked' : 'untracked')) return;
    sending.current = true; setMessage('presence-sending');
    try {
      const result = await channel.setPresenceTracked(tracked);
      if (current === generation.current) { setOwnPresence(result === 'ok' ? tracked ? 'tracked' : 'untracked' : 'unknown'); setMessage(result === 'ok' ? 'presence-ok' : 'presence-error'); }
    } catch { if (current === generation.current) { setOwnPresence('unknown'); setMessage('presence-error'); } }
    finally { if (current === generation.current) sending.current = false; }
  };
  const visibleHistory = history.filter((entry) => eventFilter === 'all' || entry.event === eventFilter);
  const exportHistory = (format: 'json' | 'csv') => {
    if (!visibleHistory.length || !eventTable) return;
    setExportFailed(false);
    let url: string | undefined;
    try {
      const content = serializeProjectRealtimeHistory(context, projectId, { table: eventTable, subscriptionFilter: eventSubscriptionFilter, events: history, eventFilter, paused: historyPaused, counts: changes }, format);
      url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)}-realtime-${eventFilter}-${visibleHistory.length}.${format}`;
      anchor.click();
      const downloadUrl = url;
      const timer = window.setTimeout(() => { URL.revokeObjectURL(downloadUrl); objectUrls.current = objectUrls.current.filter(item => item.url !== downloadUrl); }, 1000);
      objectUrls.current.push({ url, timer });
    } catch { if (url) URL.revokeObjectURL(url); setExportFailed(true); }
  };
  const busy = message === 'loading' || message === 'sending' || message === 'presence-sending';
  const broadcastValid = status?.status === 'ready' && Boolean(parseProjectRealtimeBroadcast(broadcastEvent, broadcastPayload, status.data.limits.frameBytes, channelName));
  const canConnect = !statusLoading && !statusError && status?.status === 'ready' && status.data.available && status.data.broadcast && status.data.presence && status.data.privateChannels && /^[A-Za-z0-9_-]{1,64}$/.test(channelName) && (!subscribeTable || (status.data.postgresChanges && validProjectTableIdentifier(table) && validProjectRealtimeSubscriptionFilter(subscriptionFilter)));
  if (!publishableKey) return <section className="console-view" aria-labelledby="realtime-title"><h2 id="realtime-title">{t.title}</h2><p className="console-note">{t.note}</p><div className="console-boundary-note"><p>{t.locked}</p><button className="site-nav-button" type="button" onClick={() => void unlock()}>{t.unlock}</button></div></section>;
  return <section className="console-view console-realtime" aria-labelledby="realtime-title"><h2 id="realtime-title">{t.title}</h2><p className="console-note">{t.note}</p>
    <section className="console-key-management" aria-labelledby="realtime-status-title" aria-busy={statusLoading}><h3 id="realtime-status-title">{t.status}</h3><button type="button" disabled={statusLoading || (busy && !isConnected)} onClick={refreshStatus}>{t.refresh}</button>{statusLoading && status?.status === 'ready' && <p role="status">{t.refreshing}</p>}{statusError && status?.status === 'ready' && <p role="alert" className="console-status is-error">{t.staleStatus}</p>}{statusCheckedAt && <p className="console-note">{t.checkedAt}: <time dateTime={statusCheckedAt}>{statusCheckedAt}</time></p>}{status?.status === 'ready' ? <><div className="console-realtime-stats"><div><strong>{status.data.available ? t.available : t.unavailable}</strong><span>{status.data.protocol}</span></div><div><strong>{status.data.activeConnections}</strong><span>{t.connections}</span></div><div><strong>{status.data.broadcast ? t.available : t.unavailable}</strong><span>{t.broadcast}</span></div><div><strong>{status.data.presence ? t.available : t.unavailable}</strong><span>{t.presence}</span></div></div><div className="console-realtime-missing"><article><strong>{t.worker}</strong><span>{status.data.workerStatus === undefined ? t.missingStatus : t.workerStates[status.data.workerStatus]}</span></article><article><strong>{t.lag}</strong><span>{status.data.lagBytes === undefined ? t.missingStatus : status.data.lagBytes === null ? t.lagUnknown : status.data.lagBytes}</span></article><article><strong>{t.lastError}</strong><span>{status.data.lastError === undefined ? t.missingStatus : status.data.lastError === null ? t.noError : t.replicationErrors[status.data.lastError]}</span></article></div><p className="console-note">{t.lagNote}</p><div className="console-boundary-note"><strong>{t.postgres}: {status.data.postgresChanges ? t.available : t.unavailable}</strong><p>{status.data.postgresChanges ? t.rowNote : t.postgresDisabled}</p><label><input type="checkbox" checked={subscribeTable} disabled={(!status.data.postgresChanges && !subscribeTable) || isConnected || busy} onChange={(event) => setSubscribeTable(event.target.checked)} />{t.subscribeTable}</label>{subscribeTable && <><label>{t.table}<input value={table} disabled={isConnected || busy} maxLength={63} onChange={(event) => setTable(event.target.value)} /></label><label>{t.subscriptionFilter}<input value={subscriptionFilter} disabled={isConnected || busy} maxLength={4096} aria-describedby="realtime-subscription-note" aria-invalid={!validProjectRealtimeSubscriptionFilter(subscriptionFilter)} onChange={(event) => setSubscriptionFilter(event.target.value)} /></label><p id="realtime-subscription-note" className="console-note">{t.subscriptionNote}</p>{!validProjectRealtimeSubscriptionFilter(subscriptionFilter) && <p role="alert">{t.subscriptionInvalid}</p>}</>}</div></> : <p role="status">{status ? t.failed : t.loading}</p>}</section>
    <section className="console-key-management" aria-labelledby="realtime-channel-title"><h3 id="realtime-channel-title">{t.channel}</h3><div className="console-realtime-controls"><label>{t.channelName}<input value={channelName} disabled={isConnected || busy} pattern="[A-Za-z0-9_-]{1,64}" maxLength={64} onChange={(event) => setChannelName(event.target.value)} /></label>{isConnected || busy ? <button type="button" onClick={() => void disconnect()}>{t.disconnect}</button> : <button className="site-nav-button" type="button" disabled={!canConnect} onClick={() => void connect()}>{t.connect}</button>}<button type="button" disabled={!isConnected || busy || !broadcastValid} onClick={() => void sendTest()}>{t.test}</button></div><div className="console-row-editor"><label htmlFor="realtime-broadcast-event">{t.broadcastEvent}</label><input id="realtime-broadcast-event" value={broadcastEvent} maxLength={64} disabled={busy} aria-describedby="realtime-broadcast-note" onChange={event => { setBroadcastEvent(event.target.value); if (isConnected) setMessage('connected'); }} /><label htmlFor="realtime-broadcast-payload">{t.broadcastPayload}</label><textarea id="realtime-broadcast-payload" rows={5} value={broadcastPayload} maxLength={8192} disabled={busy} spellCheck={false} aria-describedby="realtime-broadcast-note" onChange={event => { setBroadcastPayload(event.target.value); if (isConnected) setMessage('connected'); }} /><p id="realtime-broadcast-note" className="console-note">{t.broadcastNote}</p>{status?.status === 'ready' && !broadcastValid && <p role="alert">{t.broadcastInvalid}</p>}{lastBroadcast && <p>{t.lastBroadcast}: <code>{lastBroadcast}</code></p>}</div><dl><dt>{t.connection}</dt><dd>{connection}</dd><dt>{t.presenceCount}</dt><dd>{presence}</dd><dt>{t.testCount}</dt><dd>{testEvents}</dd>{isConnected && <><dt>{t.ownPresence}</dt><dd>{ownPresence === 'tracked' ? t.presenceTracked : ownPresence === 'untracked' ? t.presenceUntracked : t.presenceUnknown}</dd></>}</dl><div className="console-row-actions"><button type="button" disabled={!isConnected || busy || ownPresence === 'tracked'} onClick={() => void changePresence(true)}>{t.presenceJoin}</button><button type="button" disabled={!isConnected || busy || ownPresence === 'untracked'} onClick={() => void changePresence(false)}>{t.presenceLeave}</button></div><p className="console-note">{t.presenceNote}</p>{subscribeTable && <section aria-label={t.events}><h4>{t.events} · public.{eventTable || table}</h4><dl><dt>INSERT</dt><dd>{changes.INSERT}</dd><dt>UPDATE</dt><dd>{changes.UPDATE}</dd><dt>DELETE</dt><dd>{changes.DELETE}</dd></dl>
      <section className="console-realtime-history">
        <h5>{t.history}</h5>
        {eventTable && <p className="console-note">{t.subscriptionApplied}: {eventSubscriptionFilter ? <code>{eventSubscriptionFilter}</code> : t.subscriptionAll}</p>}
        <p className="console-note">{t.historyNote}</p>
        <div className="console-realtime-controls">
          <label>{t.eventFilter}<select value={eventFilter} onChange={(event) => { setEventFilter(event.target.value as 'all' | ProjectRealtimeChange); setExportFailed(false); }}><option value="all">{t.allEvents}</option>{(['INSERT', 'UPDATE', 'DELETE'] as const).map((event) => <option key={event} value={event}>{event}</option>)}</select></label>
          <button type="button" disabled={!isConnected} onClick={() => { const paused = !historyPausedRef.current; historyPausedRef.current = paused; setHistoryPaused(paused); }}>{historyPaused ? t.resume : t.pause}</button>
          <button type="button" disabled={!history.length} onClick={() => { setHistory([]); setExportFailed(false); }}>{t.clear}</button>
        </div>
        {historyPaused && <p role="status">{t.paused}</p>}
        <p className="console-note">{t.stored}: {history.length} / 100</p>
        <p className="console-note">{t.exportNote}</p>
        <div className="console-row-actions"><button type="button" disabled={!visibleHistory.length} onClick={() => exportHistory('json')}>{t.exportJson}</button><button type="button" disabled={!visibleHistory.length} onClick={() => exportHistory('csv')}>{t.exportCsv}</button></div>
        {exportFailed && <p role="alert" className="console-status is-error">{t.exportFailed}</p>}
        {visibleHistory.length ? <div className="console-table-rows" role="region" aria-label={t.history} tabIndex={0}><table><thead><tr><th scope="col">{t.received}</th><th scope="col">{t.eventFilter}</th><th scope="col">{t.eventTable}</th></tr></thead><tbody>{visibleHistory.map((entry) => <tr key={entry.id}><td><time dateTime={entry.receivedAt}>{entry.receivedAt}</time></td><td>{entry.event}</td><td><code>public.{entry.table}</code></td></tr>)}</tbody></table></div> : <p className="console-empty">{t.emptyHistory}</p>}
      </section>
    </section>}{message === 'loading' && <p role="status">{t.loading}</p>}{message === 'connected' && <p role="status">{t.connected}</p>}{message === 'test' && <p role="status">{t.testOk}</p>}{message === 'interrupted' && <p role="alert" className="console-status is-error">{t.interrupted}</p>}{message === 'sending' && <p role="status">{t.broadcastSending}</p>}{message === 'send-error' && <p role="alert">{t.broadcastFailed}</p>}{message === 'presence-sending' && <p role="status">{t.presenceSending}</p>}{message === 'presence-ok' && <p role="status">{t.presenceOk}</p>}{message === 'presence-error' && <p role="alert">{t.presenceFailed}</p>}{message === 'error' && <p role="alert" className="console-status is-error">{t.failed}</p>}</section>
  </section>;
}
