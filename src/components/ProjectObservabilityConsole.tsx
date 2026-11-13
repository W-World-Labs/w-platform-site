import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import {
  loadProjectLogs,
  serializeProjectLogs,
  loadProjectMonitorHealth,
  loadProjectObservability,
  PROJECT_LOG_WINDOW_MS,
  type ProjectLogFilters,
  type ProjectLogPage,
  type ProjectMonitorHealth,
  type ProjectObservability,
  type ProjectPanelState,
  type SaasContext,
} from '../lib/saasConsole';
import type { Lang } from '../i18n';

const copy = {
  en: {
    title: 'Observability',
    note: 'Exact-project W-Radar releases, deployments, runtime, errors, latency and redacted logs, plus a separately authorized W-Monitor infrastructure projection. Platform administrator status never grants tenant access.',
    radar: 'W-Radar (application observability)',
    radarSource: 'Source of truth: W-Radar member-scoped management projection. Raw collector payloads and platform admin APIs are never used here.',
    monitor: 'W-Monitor (infrastructure health)',
    monitorSource: 'Independent infrastructure product with its own data plane and permissions. Access uses the same exact-project W-ID bearer; W-Monitor admin or machine keys are never sent.',
    logs: 'Structured logs',
    releases: 'Releases',
    deployments: 'Deployments',
    runtime: 'Runtime',
    errors: 'Errors',
    latency: 'Latency',
    nodes: 'Nodes',
    healthy: 'healthy',
    degraded: 'degraded',
    offline: 'offline',
    incidents: 'Incidents',
    freshness: 'Freshness',
    freshnessFresh: 'All bound hosts checked within the freshness window.',
    freshnessStale: 'One or more hosts have stale checks or are offline. Treat this projection as potentially out of date.',
    freshnessEmpty: 'No hosts are bound to this project in W-Monitor yet.',
    freshnessAsOf: 'Newest check',
    freshnessWindow: 'Freshness window',
    seconds: 'seconds',
    staleHost: 'stale',
    service: 'Service',
    level: 'Minimum level',
    search: 'Message contains',
    trace: 'Trace ID',
    request: 'Request ID',
    apply: 'Apply filters',
    more: 'Load older',
    from: 'Start (UTC)',
    to: 'End (UTC)',
    range: 'Choose a range of up to 7 days. Times are UTC; older pages keep this exact range.',
    invalidRange: 'Enter valid start and end times, in order and no more than 7 days apart.',
    lastHour: 'Last hour',
    lastDay: 'Last 24 hours',
    lastWeek: 'Last 7 days',
    logLimit: 'Latest 200 loaded logs shown. Narrow the time range or filters to inspect older records.',
    logReadFailed: 'Older logs could not be loaded. The current records are retained; retry or refresh.',
    exportJson: 'Export loaded logs JSON', exportCsv: 'Export loaded logs CSV', exportNote: 'Downloads contain only loaded, redacted logs with the applied filters. They do not fetch additional records. CSV escapes formula-like text for spreadsheets.', exportFailed: 'The log download could not be prepared.',
    refresh: 'Refresh',
    empty: 'No records in this project.',
    loading: 'Loading exact-project data…',
    unavailable: 'This backend is unavailable or returned an invalid contract.',
    authRequired: 'Sign in with W-ID to load exact-project observability.',
    forbidden: 'Exact-project authorization denied. Membership is required; platform admin status is not enough.',
    invalid: 'The backend response failed the browser-safe contract and was discarded.',
    redaction: 'Log bodies are allowlisted upstream and defensively redacted again in this browser.',
    openRadar: 'Open in W-Radar',
    openMonitor: 'Open in W-Monitor',
    lastLog: 'Last log event',
    signalHealth: 'Runtime health',
    consecutiveFails: 'consecutive fails',
    ms: 'ms',
  },
  zh: {
    title: '可观测性',
    note: '仅展示当前精确项目的 W-Radar 发布、部署、运行时、错误、延迟与脱敏日志，以及独立授权的 W-Monitor 基础设施投影。平台管理员身份不会自动获得租户访问权。',
    radar: 'W-Radar（应用可观测性）',
    radarSource: '权威来源：W-Radar 成员范围管理投影。此处绝不使用原始采集载荷或平台管理员 API。',
    monitor: 'W-Monitor（基础设施健康）',
    monitorSource: '独立基础设施产品，拥有独立数据面与权限。访问仅使用同一精确项目 W-ID 令牌；绝不发送 W-Monitor 管理员或机器密钥。',
    logs: '结构化日志',
    releases: '发布',
    deployments: '部署',
    runtime: '运行时',
    errors: '错误',
    latency: '延迟',
    nodes: '节点',
    healthy: '健康',
    degraded: '降级',
    offline: '离线',
    incidents: '事件',
    freshness: '新鲜度',
    freshnessFresh: '所有绑定主机均在新鲜度窗口内完成检查。',
    freshnessStale: '至少一个主机检查已过期或离线。请将此投影视为可能过期。',
    freshnessEmpty: 'W-Monitor 中尚未绑定任何主机到此项目。',
    freshnessAsOf: '最近检查',
    freshnessWindow: '新鲜度窗口',
    seconds: '秒',
    staleHost: '过期',
    service: '服务',
    level: '最低级别',
    search: '消息包含',
    trace: 'Trace ID',
    request: 'Request ID',
    apply: '应用筛选',
    more: '加载更早日志',
    from: '开始时间（UTC）',
    to: '结束时间（UTC）',
    range: '最多选择 7 天。时间使用 UTC；后续分页保持同一时间范围。',
    invalidRange: '请输入有效的起止时间，结束不早于开始，间隔不超过 7 天。',
    lastHour: '最近一小时',
    lastDay: '最近 24 小时',
    lastWeek: '最近 7 天',
    logLimit: '已显示最近加载的 200 条日志。请缩小时间范围或筛选条件以查看更早记录。',
    logReadFailed: '更早日志加载失败。当前记录已保留；可重试或刷新。',
    exportJson: '导出已加载日志 JSON', exportCsv: '导出已加载日志 CSV', exportNote: '下载仅包含已加载、已脱敏的日志及实际应用的筛选条件，不会另行读取记录。CSV 会转义可能被电子表格解释为公式的文本。', exportFailed: '无法生成日志下载。',
    refresh: '刷新',
    empty: '当前项目暂无记录。',
    loading: '正在加载精确项目数据…',
    unavailable: '该后端不可用，或返回了无效契约。',
    authRequired: '请使用 W-ID 登录以加载精确项目可观测性。',
    forbidden: '精确项目授权被拒绝。需要成员资格；平台管理员身份不足。',
    invalid: '后端响应未通过浏览器安全契约，已被丢弃。',
    redaction: '日志正文已在上游经过白名单处理，并在浏览器中再次防御性脱敏。',
    openRadar: '在 W-Radar 中打开',
    openMonitor: '在 W-Monitor 中打开',
    lastLog: '最近日志事件',
    signalHealth: '运行健康',
    consecutiveFails: '连续失败',
    ms: '毫秒',
  },
} as const;

type Copy = (typeof copy)[Lang];

function stateMessage(state: ProjectPanelState<unknown> | null, t: Copy): { role: 'status' | 'alert'; text: string } {
  if (!state) return { role: 'status', text: t.loading };
  if (state.status === 'auth') return { role: 'alert', text: t.authRequired };
  if (state.status === 'forbidden') return { role: 'alert', text: t.forbidden };
  if (state.status === 'invalid') return { role: 'alert', text: t.invalid };
  return { role: 'status', text: t.unavailable };
}

function StateMessage({ state, t }: { state: ProjectPanelState<unknown> | null; t: Copy }) {
  const message = stateMessage(state, t);
  return <p role={message.role}>{message.text}</p>;
}

function RecordList({ empty, children }: { empty: string; children: React.ReactNode[] }) {
  if (!children.length) return <p>{empty}</p>;
  return <div className="console-app-list">{children}</div>;
}

type ObservabilityProps = { lang: Lang; context: SaasContext; projectId: string };

async function readBearer(signal: AbortSignal): Promise<string | null> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    void getAccessToken().then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

export function ProjectObservabilityConsole(props: ObservabilityProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectObservabilitySession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, project?.radarProjectId, membership?.role])} {...props} />;
}

function ProjectObservabilitySession({ lang, context, projectId }: ObservabilityProps) {
  const t = copy[lang];
  const [radar, setRadar] = useState<ProjectPanelState<ProjectObservability> | null>(null);
  const [monitor, setMonitor] = useState<ProjectPanelState<ProjectMonitorHealth> | null>(null);
  const [logs, setLogs] = useState<ProjectPanelState<ProjectLogPage> | null>(null);
  const [filters, setFilters] = useState<ProjectLogFilters>(() => {
    const to = new Date();
    return { level: 'info', limit: 50, from: new Date(to.getTime() - 24 * 60 * 60 * 1000).toISOString(), to: to.toISOString() };
  });
  const [draft, setDraft] = useState<ProjectLogFilters>(() => ({ ...filters, from: filters.from?.slice(0, 19), to: filters.to?.slice(0, 19) }));
  const [reloadToken, setReloadToken] = useState(0);
  const [pending, setPending] = useState(true);
  const [invalidRange, setInvalidRange] = useState(false);
  const [logReadFailure, setLogReadFailure] = useState<ProjectPanelState<unknown> | null>(null);
  const readAbort = useRef<AbortController | null>(null);
  const [exportFailed, setExportFailed] = useState(false);
  const objectUrls = useRef<Array<{ url: string; timer: number }>>([]);
  useEffect(() => () => { for (const { url, timer } of objectUrls.current) { window.clearTimeout(timer); URL.revokeObjectURL(url); } objectUrls.current = []; }, []);

  const exportLogs = (format: 'json' | 'csv') => {
    if (pending || readAbort.current || logs?.status !== 'ready' || !logs.data.logs.length) return;
    setExportFailed(false);
    try {
      const content = serializeProjectLogs(context, projectId, filters, logs.data, format);
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const timer = window.setTimeout(() => { URL.revokeObjectURL(url); objectUrls.current = objectUrls.current.filter((item) => item.url !== url); }, 1000);
      objectUrls.current.push({ url, timer });
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)}-logs-${logs.data.logs.length}.${format}`;
      anchor.click();
    } catch { setExportFailed(true); }
  };

  const loadOlder = async () => {
    if (readAbort.current || logs?.status !== 'ready' || !logs.data.nextCursor || logs.data.logs.length >= 200) return;
    const previous = logs.data;
    const controller = new AbortController();
    readAbort.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); return fetch(input, { ...init, signal }); };
    setPending(true);
    setLogReadFailure(null);
    try {
      const token = await readBearer(signal);
      const result = await loadProjectLogs(context, projectId, { ...filters, cursor: previous.nextCursor, limit: Math.min(50, 200 - previous.logs.length) }, token, request, signal);
      if (controller.signal.aborted || readAbort.current !== controller) return;
      signal.throwIfAborted();
      if (result.status !== 'ready') { setLogReadFailure(result); return; }
      if (result.data.nextCursor === previous.nextCursor) { setLogReadFailure({ status: 'invalid' }); return; }
      const seen = new Set(previous.logs.map((entry) => entry.id));
      setLogs({ status: 'ready', data: { logs: [...previous.logs, ...result.data.logs.filter((entry) => !seen.has(entry.id))], nextCursor: result.data.nextCursor } });
    } catch { if (!controller.signal.aborted && readAbort.current === controller) setLogReadFailure({ status: 'network' }); }
    finally { if (readAbort.current === controller) { readAbort.current = null; setPending(false); } }
  };

  useEffect(() => {
    const controller = new AbortController();
    readAbort.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); return fetch(input, { ...init, signal }); };
    queueMicrotask(() => { if (!controller.signal.aborted) { setRadar(null); setMonitor(null); setLogs(null); setLogReadFailure(null); setExportFailed(false); setPending(true); } });
    void readBearer(signal)
      .then((token) => Promise.all([
        loadProjectObservability(context, projectId, token, request, signal),
        loadProjectMonitorHealth(context, projectId, token, request, signal),
        loadProjectLogs(context, projectId, filters, token, request, signal),
      ]))
      .then(([nextRadar, nextMonitor, nextLogs]) => {
        if (controller.signal.aborted) return;
        signal.throwIfAborted();
        setRadar(nextRadar);
        setMonitor(nextMonitor);
        setLogs(nextLogs);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRadar({ status: 'network' });
          setMonitor({ status: 'network' });
          setLogs({ status: 'network' });
        }
      }).finally(() => { if (readAbort.current === controller) { readAbort.current = null; setPending(false); } });
    return () => { controller.abort(); readAbort.current?.abort(); readAbort.current = null; };
  }, [context, projectId, filters, reloadToken]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const from = Date.parse((draft.from || '') + 'Z');
    const to = Date.parse((draft.to || '') + 'Z');
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > PROJECT_LOG_WINDOW_MS) { setInvalidRange(true); return; }
    readAbort.current?.abort();
    setInvalidRange(false);
    setLogs(null);
    setFilters({ ...draft, from: new Date(from).toISOString(), to: new Date(to).toISOString(), limit: 50, cursor: undefined });
  };

  const recent = (hours: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    readAbort.current?.abort();
    setInvalidRange(false);
    setDraft((previous) => ({ ...previous, from: from.toISOString().slice(0, 19), to: to.toISOString().slice(0, 19) }));
    setFilters({ ...draft, from: from.toISOString(), to: to.toISOString(), limit: 50, cursor: undefined });
  };

  const refresh = () => {
    readAbort.current?.abort();
    setRadar(null);
    setMonitor(null);
    setLogs(null);
    setReloadToken((value) => value + 1);
  };

  return (
    <section className="console-view observability-console" aria-labelledby="project-observability-title">
      <div className="console-panel-heading">
        <h2 id="project-observability-title">{t.title}</h2>
        <button type="button" onClick={refresh}>{t.refresh}</button>
      </div>
      <p className="console-boundary-note">{t.note}</p>

      <section aria-labelledby="radar-heading">
        <h3 id="radar-heading">{t.radar}</h3>
        <p className="console-note">{t.radarSource}</p>
        {radar?.status === 'ready' ? (
          <>
            <div className="console-capabilities">
              <article className="console-capability">
                <strong>{t.signalHealth}</strong>
                <span className={radar.data.healthOk ? 'is-available' : ''}>
                  {radar.data.healthOk ? t.healthy : t.degraded} · {radar.data.signalCount}
                </span>
              </article>
              <article className="console-capability"><strong>{t.releases}</strong><span>{radar.data.releases.length}</span></article>
              <article className="console-capability"><strong>{t.deployments}</strong><span>{radar.data.deployments.length}</span></article>
              <article className="console-capability"><strong>{t.runtime}</strong><span>{radar.data.runtime.length}</span></article>
              <article className="console-capability"><strong>{t.errors}</strong><span>{radar.data.errors.length}</span></article>
              <article className="console-capability"><strong>{t.latency}</strong><span>{radar.data.latency.length}</span></article>
              <article className="console-capability"><strong>{t.logs}</strong><span>{radar.data.logTotal}{radar.data.lastLogAt ? ` · ${radar.data.lastLogAt}` : ''}</span></article>
            </div>
            <div className="console-row-actions">
              {radar.data.radarUrl ? <a href={radar.data.radarUrl} target="_blank" rel="noopener noreferrer">{t.openRadar}</a> : null}
            </div>

            <h4 id="releases-heading">{t.releases}</h4>
            <RecordList empty={t.empty}>
              {radar.data.releases.map((item, index) => (
                <article className="console-app-card" key={`release-${item.tag || item.workflow || index}-${index}`}>
                  <strong>{item.tag || item.workflow || t.releases}</strong>
                  <span>{item.status}{item.workflow ? ` · ${item.workflow}` : ''}</span>
                  {item.finishedAt ? <time dateTime={item.finishedAt}>{item.finishedAt}</time> : null}
                </article>
              ))}
            </RecordList>

            <h4 id="deployments-heading">{t.deployments}</h4>
            <RecordList empty={t.empty}>
              {radar.data.deployments.map((item, index) => (
                <article className="console-app-card" key={`deploy-${item.name || item.provider || index}-${index}`}>
                  <strong>{item.name || item.provider || t.deployments}</strong>
                  <span>{item.environment || item.provider} · {item.status}</span>
                  {item.syncedAt ? <time dateTime={item.syncedAt}>{item.syncedAt}</time> : null}
                </article>
              ))}
            </RecordList>

            <h4 id="runtime-heading">{t.runtime}</h4>
            <RecordList empty={t.empty}>
              {radar.data.runtime.map((item, index) => (
                <article className="console-app-card" key={`runtime-${item.source || index}-${index}`}>
                  <strong>{item.source || t.runtime}</strong>
                  {item.scannedAt ? <time dateTime={item.scannedAt}>{item.scannedAt}</time> : null}
                </article>
              ))}
            </RecordList>

            <h4 id="errors-heading">{t.errors}</h4>
            <RecordList empty={t.empty}>
              {radar.data.errors.map((item, index) => (
                <article className="console-app-card" key={`error-${item.signalId || index}-${index}`}>
                  <strong>{item.signalId || item.layer || t.errors}</strong>
                  <span>{item.layer} · {item.status} · {item.consecutiveFails} {t.consecutiveFails}</span>
                  {item.lastRunAt ? <time dateTime={item.lastRunAt}>{item.lastRunAt}</time> : null}
                </article>
              ))}
            </RecordList>

            <h4 id="latency-heading">{t.latency}</h4>
            <RecordList empty={t.empty}>
              {radar.data.latency.map((item, index) => (
                <article className="console-app-card" key={`latency-${item.signalId || index}-${index}`}>
                  <strong>{item.signalId || item.layer || t.latency}</strong>
                  <span>{item.layer} · {item.latencyMs} {t.ms}</span>
                  {item.lastRunAt ? <time dateTime={item.lastRunAt}>{item.lastRunAt}</time> : null}
                </article>
              ))}
            </RecordList>
            {radar.data.lastLogAt ? <p className="console-note">{t.lastLog}: <time dateTime={radar.data.lastLogAt}>{radar.data.lastLogAt}</time></p> : null}
          </>
        ) : <StateMessage state={radar} t={t} />}
      </section>

      <section aria-labelledby="monitor-heading">
        <h3 id="monitor-heading">{t.monitor}</h3>
        <p className="console-note">{t.monitorSource}</p>
        {monitor?.status === 'ready' ? (
          <>
            <div className="console-capabilities">
              <article className="console-capability"><strong>{t.nodes}</strong><span>{monitor.data.summary.nodes}</span></article>
              <article className="console-capability"><strong>{t.healthy}</strong><span>{monitor.data.summary.healthy}</span></article>
              <article className="console-capability"><strong>{t.degraded}</strong><span>{monitor.data.summary.degraded}</span></article>
              <article className="console-capability"><strong>{t.offline}</strong><span>{monitor.data.summary.offline}</span></article>
              <article className="console-capability"><strong>{t.incidents}</strong><span>{monitor.data.incidents.length}</span></article>
            </div>
            <div
              className="console-boundary-note"
              role={monitor.data.freshness.status === 'stale' ? 'alert' : 'status'}
              aria-labelledby="monitor-freshness-heading"
            >
              <strong id="monitor-freshness-heading">{t.freshness}</strong>
              <p>
                {monitor.data.freshness.status === 'fresh' && t.freshnessFresh}
                {monitor.data.freshness.status === 'stale' && t.freshnessStale}
                {monitor.data.freshness.status === 'empty' && t.freshnessEmpty}
              </p>
              <p>
                {t.freshnessWindow}: {monitor.data.freshness.windowSeconds} {t.seconds}
                {monitor.data.freshness.asOf ? <> · {t.freshnessAsOf}: <time dateTime={monitor.data.freshness.asOf}>{monitor.data.freshness.asOf}</time></> : null}
                {monitor.data.freshness.staleNodeCount > 0 ? <> · {monitor.data.freshness.staleNodeCount} {t.staleHost}</> : null}
              </p>
            </div>
            {radar?.status === 'ready' && radar.data.wMonitorUrl ? (
              <div className="console-row-actions">
                <a href={radar.data.wMonitorUrl} target="_blank" rel="noopener noreferrer">{t.openMonitor}</a>
              </div>
            ) : null}

            <h4 id="monitor-nodes-heading">{t.nodes}</h4>
            <RecordList empty={t.empty}>
              {monitor.data.nodes.map((node) => (
                <article className="console-app-card" key={node.agentId}>
                  <strong>{node.hostname || node.agentId}</strong>
                  <span>
                    {node.status}
                    {node.stale ? ` · ${t.staleHost}` : ''}
                    {node.latencyMs !== undefined ? ` · ${node.latencyMs} ${t.ms}` : ''}
                  </span>
                  {node.latestCheckAt ? <time dateTime={node.latestCheckAt}>{node.latestCheckAt}</time> : null}
                  <small>
                    {node.services.map((service) => `${service.name}: ${service.status}`).join(' · ') || t.empty}
                  </small>
                </article>
              ))}
            </RecordList>

            <h4 id="monitor-incidents-heading">{t.incidents}</h4>
            <RecordList empty={t.empty}>
              {monitor.data.incidents.map((incident, index) => (
                <article className="console-app-card" key={`incident-${incident.agentId}-${incident.checkedAt}-${index}`}>
                  <strong>{incident.hostname || incident.agentId}</strong>
                  <span>{incident.severity} · {incident.state} · {incident.metric}</span>
                  <code>{incident.summary}</code>
                  {incident.checkedAt ? <time dateTime={new Date(incident.checkedAt * 1000).toISOString()}>{new Date(incident.checkedAt * 1000).toISOString()}</time> : null}
                </article>
              ))}
            </RecordList>
          </>
        ) : <StateMessage state={monitor} t={t} />}
      </section>

      <section aria-labelledby="logs-heading">
        <h3 id="logs-heading">{t.logs}</h3>
        <p className="console-note">{t.redaction}</p>
        <div className="console-row-actions"><button type="button" disabled={pending || logs?.status !== 'ready' || !logs.data.logs.length} onClick={() => exportLogs('json')}>{t.exportJson}</button><button type="button" disabled={pending || logs?.status !== 'ready' || !logs.data.logs.length} onClick={() => exportLogs('csv')}>{t.exportCsv}</button></div>
        <p className="console-note">{t.exportNote}</p>
        {exportFailed && <p role="alert">{t.exportFailed}</p>}
        <p className="console-note">{t.range}</p>
        <div className="console-row-actions">
          <button type="button" onClick={() => recent(1)}>{t.lastHour}</button>
          <button type="button" onClick={() => recent(24)}>{t.lastDay}</button>
          <button type="button" onClick={() => recent(168)}>{t.lastWeek}</button>
        </div>
        <form className="console-form-grid" onSubmit={apply}>
          <label>{t.from}<input type="datetime-local" step="1" required value={draft.from || ''} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setInvalidRange(false); }} /></label>
          <label>{t.to}<input type="datetime-local" step="1" required value={draft.to || ''} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setInvalidRange(false); }} /></label>
          <label>
            {t.level}
            <select
              value={draft.level}
              onChange={(event) => setDraft({ ...draft, level: event.target.value as ProjectLogFilters['level'] })}
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </select>
          </label>
          <label>
            {t.search}
            <input
              maxLength={200}
              value={draft.search || ''}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            />
          </label>
          <label>
            {t.trace}
            <input
              maxLength={128}
              value={draft.traceId || ''}
              onChange={(event) => setDraft({ ...draft, traceId: event.target.value })}
            />
          </label>
          <label>
            {t.request}
            <input
              maxLength={128}
              value={draft.requestId || ''}
              onChange={(event) => setDraft({ ...draft, requestId: event.target.value })}
            />
          </label>
          <button type="submit">{t.apply}</button>
        </form>
        {invalidRange && <p role="alert">{t.invalidRange}</p>}
        {logReadFailure && <p role={stateMessage(logReadFailure, t).role}>{logReadFailure.status === 'network' ? t.logReadFailed : stateMessage(logReadFailure, t).text}</p>}
        {logs?.status === 'ready' ? (
          <>
            <div className="console-app-list">
              {logs.data.logs.length ? logs.data.logs.map((entry) => (
                <article className="console-app-card" key={entry.id}>
                  <strong>{entry.level} · {entry.serviceName}</strong>
                  <time dateTime={entry.timestamp}>{entry.timestamp}</time>
                  <code>{entry.body}</code>
                  {(entry.traceId || entry.requestId) && (
                    <small>
                      {entry.traceId ? `trace ${entry.traceId}` : ''}
                      {entry.requestId ? ` · request ${entry.requestId}` : ''}
                    </small>
                  )}
                </article>
              )) : <p>{t.empty}</p>}
            </div>
            {logs.data.nextCursor && logs.data.logs.length >= 200 ? <p role="status">{t.logLimit}</p> : logs.data.nextCursor ? (
              <button type="button" disabled={pending} onClick={() => void loadOlder()}>
                {t.more}
              </button>
            ) : null}
            {pending && <p role="status">{t.loading}</p>}
          </>
        ) : <StateMessage state={logs} t={t} />}
      </section>
    </section>
  );
}
