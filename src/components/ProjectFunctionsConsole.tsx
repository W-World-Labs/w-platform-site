import { useEffect, useId, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import {
  activateProjectFunctionVersion,
  deleteProjectFunction,
  deployProjectFunction,
  invokeProtectedProjectFunction,
  parseProjectFunctionQuery,
  loadProjectFunctionDetail,
  loadProjectFunctions,
  loadProjectFunctionsReadiness,
  PROJECT_FUNCTION_INVOKE_METHODS,
  PROJECT_FUNCTION_INVOKE_CONTENT_TYPES,
  validProjectFunctionInvokeBody,
  PROJECT_FUNCTION_SOURCE_LIMIT,
  validProjectFunctionSource,
  readProjectFunctionSource,
  filterProjectFunctionAudit,
  serializeProjectFunctionAudit,
  validProjectFunctionTraceId,
  type ProjectFunctionDetail,
  type ProjectFunctionInvokeResult,
  type ProjectFunctionInvokeMethod,
  type ProjectFunctionInvokeContentType,
  type ProjectFunctionSummary,
  type ProjectFunctionsReadiness,
  type ProjectPanelState,
  type SaasContext,
} from '../lib/saasConsole';
import type { Lang } from '../i18n';

const COPY = {
  en: {
    title: 'Functions',
    note: 'Deploy and test this project’s functions. Credentials and raw runtime process output are hidden; responses use a bounded, redacted preview.',
    unlock: 'Unlock Functions console',
    locked: 'Use an existing project publishable key or create a 15-minute functions:invoke console key. Keys stay in page memory only.',
    changeKey: 'Change key', changeKeyNote: 'Changing keys clears loaded function data and editor/test drafts. It does not revoke a key.',
    readiness: 'Readiness',
    ready: 'Management and invocation available',
    readReady: 'Function reading and invocation available. Deploying, activating and deleting require management permission.',
    publicKey: 'Existing project publishable key', usePublicKey: 'Use existing key', publicKeyNote: 'Use a project publishable key with functions:invoke. It stays in this page and does not grant project membership or management permission.', invalidPublicKey: 'Enter a project publishable key starting with wid_pk_.',
    unavailable: 'Functions are unavailable or the project contract failed closed.',
    capabilityAvailable: 'available',
    capabilityUnavailable: 'unavailable',
    capInvoke: 'Invoke',
    capDeploy: 'Deploy',
    capVersions: 'Versions',
    capLogs: 'Logs',
    capActivate: 'Activate',
    capRollback: 'Rollback',
    capDelete: 'Delete',
    inventory: 'Functions',
    none: 'No Functions deployed.',
    deploy: 'Deploy function',
    slug: 'Function slug',
    auth: 'Authorization',
    authUser: 'User JWT required',
    authProject: 'Project key only',
    bundle: 'TypeScript source file',
    deployAction: 'Deploy',
    deployNote: 'Source drafts stay in this page only. Deploy sends the source to this exact project; backend source is never read back.',
    sourceMode: 'Source input', editor: 'Write TypeScript', upload: 'Upload a file', sourceCode: 'TypeScript source', sourceSize: 'UTF-8 source bytes', sourceLimit: 'Source must be non-empty valid UTF-8, without NUL characters, and at most 256 KiB.', deployed: 'Deployment confirmed:', unknownDeploy: 'Function change result is unknown. Refresh the inventory before retrying; deployment, activation or deletion may already have completed.',
    openSource: 'Open file in editor', openingSource: 'Opening source file…', openSourceNote: 'Open the selected file to inspect and edit it before deploying. Your draft stays in page memory.', openSourceFailed: 'Could not read the source file. Your editor draft is still available; select the file again to retry.',
    template: 'Starter template', helloTemplate: 'Hello JSON', dataTemplate: 'Read project data (Supabase SDK)', useTemplate: 'Use template', replaceDraft: 'Replace my edited source draft', templateNote: 'Using a template replaces the editor draft and does not deploy. The data template requires User JWT and a key with data:read, reads up to 20 rows from the public table named by ?table=todos, and keeps row policies in force.', dataRead: 'Also allow project data reads for function tests', dataReadNote: 'Optional data:read permission for the SDK template, valid for 15 minutes. Data writes and administration are excluded.',
    detail: 'Function detail',
    active: 'Active version',
    sha: 'Source digest',
    versions: 'Versions',
    activate: 'Activate',
    rollback: 'Rollback',
    invoke: 'Protected invoke test',
    invokeNote: 'Choose an HTTP method. Requests with a body accept JSON, plain text, XML or URL-encoded form text up to 64 KiB in UTF-8. Elapsed time includes authorization and reading the response preview. Only HTTP status, correlation metadata, and a truncated redacted preview are shown.',
    requestBody: 'JSON request body', rawRequestBody: 'Raw request body', contentType: 'Request Content-Type', rawBodyNote: 'Send the entered UTF-8 text unchanged. XML and form syntax are not validated or encoded here. Only JSON is parsed. Switching Content-Type keeps your draft.', invalidRawBody: 'Request body exceeds the 64 KiB UTF-8 limit.',
    query: 'URL query parameters',
    queryNote: 'Use name=value&tag=one&tag=two. Repeated parameters are kept; encoded query size is limited to 4 KiB.',
    invalidQuery: 'Enter valid query parameters within 4 KiB, without fragments or control characters.',
    method: 'HTTP method',
    noBody: 'GET and HEAD send no request body. HEAD returns no response body.',
    cancelInvoke: 'Stop waiting',
    cancelled: 'Stopped waiting for the response. The function may still be running.',
    elapsed: 'Elapsed time',
    invalidBody: 'Enter valid JSON within the 64 KiB limit.',
    bodyPreview: 'Body preview',
    bodyTruncated: 'truncated',
    bodyEmpty: '(empty)',
    delete: 'Delete function',
    deleteConfirm: 'Type the exact function slug to delete',
    logs: 'Invocation, build and runtime audit',
    logsNote: 'Search a trace marker across backend event pages. State, event, correlation ID and time filters apply to loaded records.',
    exportJson: 'Export filtered audit JSON', exportCsv: 'Export filtered audit CSV', exportNote: 'Download the loaded events matching these filters, with the function, applied trace and pagination boundary. Time filters use your browser’s time zone and export as UTC. Only audit metadata is exported; text is redacted and CSV escapes spreadsheet formulas. Downloads do not read more pages or invoke the function.', exportFailed: 'Could not prepare the audit download. Loaded events and filters are still available.',
    trace: 'Trace marker', traceSearch: 'Search trace', traceAll: 'Show all events', traceCurrent: 'Current trace:', traceInvalid: 'Use 1–128 letters, digits, dots, underscores or hyphens.', logsLoading: 'Loading event page…', logsFailed: 'Events could not be loaded. The current records are retained; retry the search or load older.', logsCapped: 'Showing up to 200 loaded events. Search a trace marker to narrow the results.',
    state: 'State',
    event: 'Event contains',
    requestFilter: 'Correlation ID',
    from: 'From',
    until: 'Until',
    all: 'All',
    older: 'Load older',
    refresh: 'Refresh',
    loading: 'Loading exact-project Functions…',
    failed: 'The operation was rejected or returned an invalid contract.',
    done: 'Operation completed.',
    status: 'HTTP status',
    requestId: 'Correlation ID',
    logId: 'Event ID',
    authRequired: 'Sign in with W-ID to load exact-project Functions.',
    forbidden: 'Exact-project authorization denied. Membership is required; platform admin status is not enough.',
    invalid: 'The backend response failed the browser-safe contract and was discarded.',
    network: 'Functions backend is unavailable or the edge route failed closed.',
    lockedState: 'Unlock the Functions console with a short-lived browser key.',
    emptyLogs: 'No audit events match the current filters.',
    selectHint: 'Select a function to inspect versions, invoke, and browse audit events.',
  },
  zh: {
    title: '函数',
    note: '部署和测试当前项目的函数。凭据与原始运行时输出不会展示；响应仅显示有界、脱敏的预览。',
    unlock: '解锁函数控制台',
    locked: '使用已有项目公开密钥，或创建有效期 15 分钟的 functions:invoke 控制台密钥。密钥仅保留在页面内存。',
    changeKey: '更换密钥', changeKeyNote: '更换密钥会清空已加载的函数数据和编辑、测试草稿，不会撤销密钥。',
    readiness: '就绪状态',
    ready: '管理与调用能力可用',
    readReady: '函数读取与调用可用。部署、激活和删除需要管理权限。',
    publicKey: '已有项目公开密钥', usePublicKey: '使用已有密钥', publicKeyNote: '使用含 functions:invoke 的项目公开密钥。密钥仅保留在当前页面，不会授予项目成员资格或管理权限。', invalidPublicKey: '请输入以 wid_pk_ 开头的项目公开密钥。',
    unavailable: 'Functions 不可用，或项目契约已默认拒绝。',
    capabilityAvailable: '可用',
    capabilityUnavailable: '不可用',
    capInvoke: '调用',
    capDeploy: '部署',
    capVersions: '版本',
    capLogs: '日志',
    capActivate: '激活',
    capRollback: '回滚',
    capDelete: '删除',
    inventory: '函数',
    none: '尚未部署函数。',
    deploy: '部署函数',
    slug: '函数标识',
    auth: '授权模式',
    authUser: '需要用户 JWT',
    authProject: '仅项目密钥',
    bundle: 'TypeScript 源文件',
    deployAction: '部署',
    deployNote: '源码草稿仅保留于当前页面。部署会发送到精确项目，不会读回后端源码。',
    sourceMode: '源码输入', editor: '在线编写 TypeScript', upload: '上传文件', sourceCode: 'TypeScript 源码', sourceSize: 'UTF-8 源码字节', sourceLimit: '源码必须是有效 UTF-8，不能为空或包含空字节，最多 256 KiB。', deployed: '部署已确认：', unknownDeploy: '函数变更结果未知。请先刷新清单核对，再决定是否重试；部署、版本激活或删除可能已经完成。',
    openSource: '打开文件到编辑器', openingSource: '正在读取源码文件…', openSourceNote: '打开所选文件，在部署前检查和编辑。草稿保存在当前页面内存中。', openSourceFailed: '无法读取源码文件，编辑器草稿仍然保留；请重新选择文件重试。',
    template: '起始模板', helloTemplate: 'Hello JSON', dataTemplate: '读取项目数据（Supabase SDK）', useTemplate: '使用模板', replaceDraft: '替换我已编辑的源码草稿', templateNote: '使用模板会替换编辑器草稿，不会部署。数据模板需要用户 JWT 和 data:read 密钥，读取 ?table=todos 指定的 public 表，最多 20 行，并继续执行行级访问策略。', dataRead: '允许函数测试读取项目数据', dataReadNote: '可选的 data:read 权限用于 SDK 模板，有效期 15 分钟，不授予数据写入或管理权限。',
    detail: '函数详情',
    active: '当前版本',
    sha: '源码摘要',
    versions: '版本',
    activate: '激活',
    rollback: '回滚',
    invoke: '受保护调用测试',
    invokeNote: '选择 HTTP 方法。有请求体时，可选择 JSON、纯文本、XML 或 URL 编码表单文本，上限为 64 KiB UTF-8 字节。耗时包括授权与读取响应预览。仅显示 HTTP 状态、关联元数据与截断并脱敏的预览。',
    requestBody: 'JSON 请求体', rawRequestBody: '原始请求体', contentType: '请求 Content-Type', rawBodyNote: '按原文发送输入的 UTF-8 文本；此处不校验或重新编码 XML、表单语法，仅解析 JSON。切换 Content-Type 会保留草稿。', invalidRawBody: '请求正文超过 64 KiB UTF-8 字节上限。',
    query: 'URL 查询参数',
    queryNote: '使用 name=value&tag=one&tag=two 格式。保留重复参数，编码后的查询最多 4 KiB。',
    invalidQuery: '请输入最多 4 KiB 的有效查询参数，不含片段或控制字符。',
    method: 'HTTP 方法',
    noBody: 'GET 和 HEAD 不发送请求体。HEAD 不返回响应正文。',
    cancelInvoke: '停止等待',
    cancelled: '已停止等待响应。函数可能仍在运行。',
    elapsed: '耗时',
    invalidBody: '请输入不超过 64 KiB 的有效 JSON。',
    bodyPreview: '正文预览',
    bodyTruncated: '已截断',
    bodyEmpty: '（空）',
    delete: '删除函数',
    deleteConfirm: '请输入完整函数标识以删除',
    logs: '调用、构建与运行时审计',
    logsNote: '按追踪标记搜索后端事件页。状态、事件、关联 ID 和时间筛选仅作用于已加载记录。',
    exportJson: '导出已筛选审计 JSON', exportCsv: '导出已筛选审计 CSV', exportNote: '下载当前筛选匹配的已加载事件，附函数、已应用追踪标记和分页边界。时间筛选使用浏览器时区，导出转换为 UTC。仅导出审计元数据，文本会脱敏，CSV 会转义电子表格公式。下载不会读取更多页面或调用函数。', exportFailed: '未能准备审计下载，已加载事件和筛选条件仍已保留。',
    trace: '追踪标记', traceSearch: '搜索追踪标记', traceAll: '显示全部事件', traceCurrent: '当前追踪标记：', traceInvalid: '请输入 1–128 个字母、数字、点、下划线或连字符。', logsLoading: '正在加载事件页…', logsFailed: '未能加载事件，当前记录已保留。请重试搜索或加载更早记录。', logsCapped: '最多显示 200 条已加载事件。可按追踪标记缩小搜索范围。',
    state: '状态',
    event: '事件包含',
    requestFilter: '关联 ID',
    from: '开始时间',
    until: '结束时间',
    all: '全部',
    older: '加载更早记录',
    refresh: '刷新',
    loading: '正在加载精确项目 Functions…',
    failed: '操作被拒绝或返回无效契约。',
    done: '操作已完成。',
    status: 'HTTP 状态',
    requestId: '关联 ID',
    logId: '事件 ID',
    authRequired: '请使用 W-ID 登录以加载精确项目 Functions。',
    forbidden: '精确项目授权被拒绝。需要成员资格；平台管理员身份不足。',
    invalid: '后端响应未通过浏览器安全契约，已被丢弃。',
    network: 'Functions 后端不可用，或边缘路由已默认拒绝。',
    lockedState: '请用短期浏览器密钥解锁函数控制台。',
    emptyLogs: '当前筛选条件下没有审计事件。',
    selectHint: '选择一个函数以查看版本、发起调用并浏览审计事件。',
  },
} as const;

type Copy = (typeof COPY)[Lang];

function stateMessage(state: ProjectPanelState<unknown> | null, t: Copy): { role: 'status' | 'alert'; text: string } {
  if (!state) return { role: 'status', text: t.loading };
  if (state.status === 'auth') return { role: 'alert', text: t.authRequired };
  if (state.status === 'forbidden') return { role: 'alert', text: t.forbidden };
  if (state.status === 'invalid') return { role: 'alert', text: t.invalid };
  if (state.status === 'locked') return { role: 'alert', text: t.lockedState };
  if (state.status === 'network') return { role: 'alert', text: t.network };
  return { role: 'status', text: t.unavailable };
}

function shortSha(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

function readinessReady(data: ProjectFunctionsReadiness): boolean {
  return data.available && data.invoke && data.listVersions && data.logs;
}

const STARTER_SOURCE = `export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  return Response.json({ message: "Hello from your function", method: request.method, name: url.searchParams.get("name") });
};
`;

const DATA_READ_SOURCE = `import { createClient } from "npm:@supabase/supabase-js@2";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET" } });
  const table = new URL(request.url).searchParams.get("table") || "todos";
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(table)) return Response.json({ error: "invalid_table" }, { status: 400 });
  const authorization = request.headers.get("authorization");
  if (!authorization) return Response.json({ error: "user_required" }, { status: 401 });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error, status } = await client.from(table).select("*").limit(20).retry(false).abortSignal(AbortSignal.timeout(5000));
  if (error) return Response.json({ error: "data_read_failed", status }, { status: status >= 400 && status <= 599 ? status : 502 });
  return Response.json({ table, rows: data || [] });
};
`;

function waitForFunctionValue<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted(); const abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

type FunctionsProps = { lang: Lang; context: SaasContext; projectId: string; publishableKey: string; unlock: (allowDataRead?: boolean) => Promise<void> };

export function ProjectFunctionsConsole(props: FunctionsProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectFunctionsKeyGate key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role, props.publishableKey])} {...props} />;
}

function ProjectFunctionsKeyGate(props: FunctionsProps) {
  const [providedKey, setProvidedKey] = useState<string | null>(null);
  const publishableKey = providedKey ?? props.publishableKey;
  return <ProjectFunctionsSession key={publishableKey} {...props} publishableKey={publishableKey} onPublishableKey={setProvidedKey} />;
}

function ProjectFunctionsSession({ lang, context, projectId, publishableKey, unlock, onPublishableKey }: FunctionsProps & { onPublishableKey: (key: string) => void }) {
  const t = COPY[lang];
  const formId = useId();
  const [keyDraft, setKeyDraft] = useState('');
  const [keyInvalid, setKeyInvalid] = useState(false);
  const detailAbort = useRef<AbortController | null>(null);
  const detailGeneration = useRef(0);
  const logOperation = useRef(false);
  const [functions, setFunctions] = useState<ProjectPanelState<ProjectFunctionSummary[]> | null>(null);
  const [readiness, setReadiness] = useState<ProjectPanelState<ProjectFunctionsReadiness> | null>(null);
  const [detail, setDetail] = useState<ProjectPanelState<ProjectFunctionDetail> | null>(null);
  const [selected, setSelected] = useState<ProjectFunctionSummary | null>(null);
  const [slug, setSlug] = useState('');
  const [auth, setAuth] = useState<'user' | 'project'>('user');
  const [file, setFile] = useState<File | null>(null);
  const [sourceMode, setSourceMode] = useState<'editor' | 'file'>('editor');
  const [sourceDraft, setSourceDraft] = useState(STARTER_SOURCE);
  const sourceBytes = sourceMode === 'editor' ? new TextEncoder().encode(sourceDraft).byteLength : file?.size ?? 0;
  const [sourceTemplate, setSourceTemplate] = useState<'hello' | 'data-read'>('hello');
  const [replaceDraft, setReplaceDraft] = useState(false);
  const [allowDataRead, setAllowDataRead] = useState(false);
  const [unlockPending, setUnlockPending] = useState(false);
  const unlockOperation = useRef(false);
  const dataTemplateDeployment = useRef<string | null>(null);
  const [sourceInvalid, setSourceInvalid] = useState(false);
  const [sourceReadPending, setSourceReadPending] = useState(false);
  const [sourceReadFailed, setSourceReadFailed] = useState(false);
  const sourceReadOperation = useRef(false);
  const [deployReceipt, setDeployReceipt] = useState<ProjectFunctionSummary | null>(null);
  const [deployPending, setDeployPending] = useState(false);
  const [deployUnknown, setDeployUnknown] = useState(false);
  const unknownFunction = useRef<string | null>(null);
  // One synchronous lock and controller cover all Function management writes.
  const deployOperation = useRef(false);
  const deployAbort = useRef<AbortController | null>(null);
  const sessionAbort = useRef(new AbortController());
  useEffect(() => { sessionAbort.current = new AbortController(); return () => { sessionAbort.current.abort(); deployAbort.current?.abort(); }; }, []);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [traceDraft, setTraceDraft] = useState('');
  const [logsPending, setLogsPending] = useState(false);
  const [logsInvalid, setLogsInvalid] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const auditUrls = useRef<Array<{ url: string; timer: ReturnType<typeof setTimeout> }>>([]);
  useEffect(() => () => { for (const item of auditUrls.current) { clearTimeout(item.timer); URL.revokeObjectURL(item.url); } auditUrls.current = []; }, [selected?.slug]);
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [action, setAction] = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [invocation, setInvocation] = useState<ProjectFunctionInvokeResult | null>(null);
  const [invokeBody, setInvokeBody] = useState('{}');
  const [invokeContentType, setInvokeContentType] = useState<ProjectFunctionInvokeContentType>('application/json');
  const [invokeQuery, setInvokeQuery] = useState('');
  const [invalidInvokeQuery, setInvalidInvokeQuery] = useState(false);
  const [invokeMethod, setInvokeMethod] = useState<ProjectFunctionInvokeMethod>('POST');
  const invokeHasBody = invokeMethod !== 'GET' && invokeMethod !== 'HEAD';
  const [invokePending, setInvokePending] = useState(false);
  const [invokeElapsed, setInvokeElapsed] = useState<number | null>(null);
  const [invalidInvokeBody, setInvalidInvokeBody] = useState(false);
  const invokeAbort = useRef<AbortController | null>(null);
  const invokeGeneration = useRef(0);

  const reload = async (signal?: AbortSignal, bearer?: string | null) => {
    if (deployOperation.current && !signal) return false;
    const deadline = signal || AbortSignal.any([sessionAbort.current.signal, AbortSignal.timeout(30_000)]);
    try {
      const token = bearer === undefined ? await waitForFunctionValue(getAccessToken(), deadline) : bearer;
      deadline.throwIfAborted();
      const [list, ready] = await Promise.all([
        loadProjectFunctions(context, projectId, publishableKey, token, fetch, deadline),
        loadProjectFunctionsReadiness(context, projectId, publishableKey, token, fetch, deadline),
      ]);
      deadline.throwIfAborted(); setFunctions(list); setReadiness(ready);
      if (list.status !== 'ready' || ready.status !== 'ready') return false;
      if (unknownFunction.current) {
        const summary = list.data.find((item) => item.slug === unknownFunction.current);
        if (summary) {
          const inspected = await loadProjectFunctionDetail(context, projectId, summary, publishableKey, token, fetch, undefined, deadline);
          deadline.throwIfAborted(); if (inspected.status !== 'ready') return false;
          setSelected(summary); setDetail(inspected);
        } else if (selected?.slug === unknownFunction.current) {
          setSelected(null); setDetail(null); setInvocation(null);
        }
        unknownFunction.current = null; setDeployUnknown(false); setDeleteConfirmation('');
      }
      return true;
    } catch { if (!sessionAbort.current.signal.aborted) setAction('error'); return false; }
  };

  useEffect(() => {
    if (!publishableKey) return;
    const controller = new AbortController();
    void getAccessToken()
      .then(async (bearer) => Promise.all([
        loadProjectFunctions(context, projectId, publishableKey, bearer, fetch, controller.signal),
        loadProjectFunctionsReadiness(context, projectId, publishableKey, bearer, fetch, controller.signal),
      ]))
      .then(([list, ready]) => {
        setFunctions(list);
        setReadiness(ready);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setFunctions({ status: 'network' });
          setReadiness({ status: 'network' });
        }
      });
    return () => {
      controller.abort();
      detailAbort.current?.abort();
    };
  }, [context, projectId, publishableKey]);

  useEffect(() => {
    const generation = ++invokeGeneration.current;
    queueMicrotask(() => { if (invokeGeneration.current === generation) { setInvocation(null); setInvokeBody('{}'); setInvokeContentType('application/json'); setInvokeQuery(dataTemplateDeployment.current === selected?.slug ? 'table=todos' : ''); setInvalidInvokeQuery(false); setInvokeMethod(dataTemplateDeployment.current === selected?.slug ? 'GET' : 'POST'); setInvokePending(false); setInvokeElapsed(null); setInvalidInvokeBody(false); setAction('idle'); } });
    return () => { invokeGeneration.current += 1; invokeAbort.current?.abort(); };
  }, [context, projectId, publishableKey, selected?.slug]);

  const inspect = async (summary: ProjectFunctionSummary, keepInvocation = false, signal?: AbortSignal, bearer?: string | null, traceId?: string) => {
    if (deployOperation.current && !signal) return;
    detailAbort.current?.abort();
    const generation = ++detailGeneration.current;
    logOperation.current = false; setLogsPending(false); setLogsError(false); setLogsInvalid(false); setTraceDraft(traceId || '');
    setStateFilter(''); setEventFilter(''); setRequestFilter(''); setFrom(''); setUntil('');
    setExportFailed(false);
    const controller = new AbortController();
    detailAbort.current = controller;
    setSelected(summary);
    setDetail(null);
    setDeleteConfirmation('');
    if (!keepInvocation) setInvocation(null);
    try {
      const next = await loadProjectFunctionDetail(
        context,
        projectId,
        summary,
        publishableKey,
        bearer === undefined ? await getAccessToken() : bearer,
        fetch,
        undefined,
        signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
        traceId,
      );
      if (!controller.signal.aborted && detailGeneration.current === generation) setDetail(next);
    } catch (error: unknown) {
      if (!controller.signal.aborted && detailGeneration.current === generation && !(error instanceof Error && error.name === 'AbortError')) {
        setDetail({ status: 'network' });
      }
    }
  };

  const editedDraft = sourceDraft !== STARTER_SOURCE && sourceDraft !== DATA_READ_SOURCE;
  const openSource = async () => {
    if (sourceReadOperation.current || deployOperation.current || action === 'loading' || !file || (editedDraft && !replaceDraft)) return;
    sourceReadOperation.current = true; setSourceReadPending(true); setSourceReadFailed(false); setSourceInvalid(false);
    const signal = AbortSignal.any([sessionAbort.current.signal, AbortSignal.timeout(30_000)]);
    try {
      const source = await waitForFunctionValue(readProjectFunctionSource(file), signal);
      signal.throwIfAborted();
      if (source === null) { setSourceInvalid(true); return; }
      setSourceDraft(source); setSourceMode('editor'); setFile(null); setReplaceDraft(false);
    } catch { if (!sessionAbort.current.signal.aborted) setSourceReadFailed(true); }
    finally { if (!sessionAbort.current.signal.aborted) { sourceReadOperation.current = false; setSourceReadPending(false); } }
  };

  const deploy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deployOperation.current || sourceReadOperation.current || unknownFunction.current || action === 'loading') return;
    if (!slug.trim() || readiness?.status !== 'ready' || !readiness.data.available || !readiness.data.deploy) { setAction('error'); return; }
    if (sourceMode === 'file' && (!file || file.size > PROJECT_FUNCTION_SOURCE_LIMIT)) { setSourceInvalid(true); return; }
    deployOperation.current = true; setDeployPending(true); setSourceInvalid(false);
    const controller = new AbortController(); deployAbort.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    let writeStarted = false; let writeConfirmed = false;
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); if (init?.method === 'POST' && String(input).endsWith('/deploy')) writeStarted = true; return fetch(input, { ...init, signal }); };
    const targetSlug = slug.trim();
    const markUnknown = () => { unknownFunction.current = targetSlug; setDeployUnknown(true); };
    setAction('loading');
    try {
      const source = sourceMode === 'editor' ? sourceDraft : await waitForFunctionValue(readProjectFunctionSource(file!), signal);
      if (source === null || !validProjectFunctionSource(source)) { setSourceInvalid(true); setAction('idle'); return; }
      const bearer = await waitForFunctionValue(getAccessToken(), signal); signal.throwIfAborted();
      const result = await deployProjectFunction(context, projectId, slug.trim(), source, auth, publishableKey, bearer, request, signal);
      if (controller.signal.aborted) return;
      if (result.status !== 'ready') { if (writeStarted && ['network', 'invalid'].includes(result.status)) markUnknown(); setAction('error'); return; }
      writeConfirmed = true; if (source === DATA_READ_SOURCE) dataTemplateDeployment.current = result.data.slug; else if (dataTemplateDeployment.current === result.data.slug) dataTemplateDeployment.current = null; setDeployReceipt(result.data); setAction('done');
      if (await reload(signal, bearer)) await inspect(result.data, false, signal, bearer);
    } catch { if (!controller.signal.aborted) { if (writeStarted && !writeConfirmed) markUnknown(); setAction('error'); } }
    finally { if (!controller.signal.aborted) { deployOperation.current = false; setDeployPending(false); } }
  };

  const manage = async (operation: { kind: 'activate'; version: number } | { kind: 'delete' }) => {
    if (!selected || deployOperation.current || unknownFunction.current || action === 'loading') return;
    if (operation.kind === 'delete' && deleteConfirmation !== selected.slug) return;
    const permitted = readiness?.status === 'ready' && readiness.data.available && (operation.kind === 'delete'
      ? readiness.data.delete : operation.version < selected.activeVersion ? readiness.data.rollback : readiness.data.activate);
    if (!permitted) { setAction('error'); return; }
    const targetSlug = selected.slug;
    deployOperation.current = true; setDeployPending(true); setAction('loading');
    detailAbort.current?.abort(); detailGeneration.current += 1; logOperation.current = false; setLogsPending(false);
    const controller = new AbortController(); deployAbort.current = controller;
    const signal = AbortSignal.any([controller.signal, sessionAbort.current.signal, AbortSignal.timeout(30_000)]);
    let writeStarted = false; let writeConfirmed = false;
    const request: typeof fetch = (input, init) => {
      signal.throwIfAborted();
      if (init?.method === 'DELETE' || (init?.method === 'POST' && String(input).endsWith('/activate'))) writeStarted = true;
      return fetch(input, { ...init, signal });
    };
    const markUnknown = () => { unknownFunction.current = targetSlug; setDeployUnknown(true); };
    try {
      const bearer = await waitForFunctionValue(getAccessToken(), signal); signal.throwIfAborted();
      let activated: ProjectFunctionSummary | null = null;
      if (operation.kind === 'activate') {
        const result = await activateProjectFunctionVersion(context, projectId, targetSlug, operation.version, publishableKey, bearer, request, signal);
        signal.throwIfAborted();
        if (result.status !== 'ready') { if (writeStarted && ['network', 'invalid'].includes(result.status)) markUnknown(); setAction('error'); return; }
        activated = result.data;
      } else {
        const result = await deleteProjectFunction(context, projectId, targetSlug, publishableKey, bearer, request, signal);
        signal.throwIfAborted();
        if (result.status !== 'ready') { if (writeStarted && ['network', 'invalid'].includes(result.status)) markUnknown(); setAction('error'); return; }
      }
      writeConfirmed = true; setAction('done'); setDeleteConfirmation(''); setInvocation(null);
      setSelected(activated); setDetail(null);
      if (await reload(signal, bearer) && activated) await inspect(activated, false, signal, bearer);
    } catch {
      if (!controller.signal.aborted) { if (writeStarted && !writeConfirmed) markUnknown(); setAction('error'); }
    } finally {
      if (!controller.signal.aborted) { deployOperation.current = false; setDeployPending(false); }
    }
  };
  const activate = (version: number) => manage({ kind: 'activate', version });
  const remove = () => manage({ kind: 'delete' });

  const invoke = async () => {
    if (!selected || deployOperation.current || invokeAbort.current) return;
    if (parseProjectFunctionQuery(invokeQuery) === null) { setInvalidInvokeQuery(true); return; }
    setInvalidInvokeQuery(false);
    if (invokeHasBody && !validProjectFunctionInvokeBody(invokeBody, invokeContentType)) { setInvalidInvokeBody(true); return; }
    setInvalidInvokeBody(false);
    if (readiness?.status !== 'ready' || !readiness.data.available || !readiness.data.invoke) {
      setAction('error');
      return;
    }
    setAction('loading');
    setInvocation(null);
    setInvokeElapsed(null);
    setInvokePending(true);
    const controller = new AbortController();
    invokeAbort.current = controller;
    const generation = ++invokeGeneration.current;
    const started = window.performance.now();
    try {
      const traceId = crypto.randomUUID();
      const bearer = await getAccessToken();
      if (controller.signal.aborted || invokeGeneration.current !== generation) return;
      const result = await invokeProtectedProjectFunction(
        context,
        projectId,
        selected.slug,
        publishableKey,
        bearer,
        fetch,
        controller.signal,
        invokeBody,
        invokeMethod,
        invokeQuery,
        traceId,
        invokeContentType,
      );
      if (controller.signal.aborted || invokeGeneration.current !== generation) return;
      setAction(result.status === 'ready' ? 'done' : 'error');
      if (result.status === 'ready') {
        setInvocation(result.data);
        setInvokeElapsed(Math.max(0, Math.round(window.performance.now() - started)));
        setInvokePending(false);
        await inspect(selected, true, undefined, undefined, traceId);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted && invokeGeneration.current === generation && !(error instanceof Error && error.name === 'AbortError')) setAction('error');
    } finally {
      if (invokeGeneration.current === generation) {
        setInvokePending(false);
        invokeAbort.current = null;
      }
    }
  };

  const cancelInvoke = () => {
    invokeGeneration.current += 1;
    invokeAbort.current?.abort();
    invokeAbort.current = null;
    setInvokePending(false);
    setAction('cancelled');
  };

  const readLogs = async (traceId?: string, append = false) => {
    if (!selected || detail?.status !== 'ready' || logOperation.current || deployOperation.current) return;
    if (traceId !== undefined && !validProjectFunctionTraceId(traceId)) { setLogsInvalid(true); return; }
    if (append && (!detail.data.nextBeforeId || detail.data.logs.length >= 200)) return;
    if (readiness?.status !== 'ready' || !readiness.data.available || !readiness.data.logs) {
      setAction('error');
      return;
    }
    const controller = new AbortController();
    detailAbort.current?.abort();
    detailAbort.current = controller;
    const generation = ++detailGeneration.current;
    logOperation.current = true; setLogsPending(true); setLogsError(false); setLogsInvalid(false); setExportFailed(false);
    const signal = AbortSignal.any([controller.signal, sessionAbort.current.signal, AbortSignal.timeout(30_000)]);
    try {
      const bearer = await waitForFunctionValue(getAccessToken(), signal);
      signal.throwIfAborted();
      const result = await loadProjectFunctionDetail(
        context,
        projectId,
        selected,
        publishableKey,
        bearer,
        fetch,
        append ? detail.data.nextBeforeId || undefined : undefined,
        signal,
        traceId,
      );
      if (signal.aborted || detailGeneration.current !== generation) return;
      if (result.status === 'ready') {
        setDetail({
          status: 'ready',
          data: {
            ...result.data,
            logs: append ? [...new Map([...detail.data.logs, ...result.data.logs].map(item => [item.id, item])).values()].slice(0, 200) : result.data.logs,
          },
        });
      } else {
        setLogsError(true);
      }
    } catch {
      if (!controller.signal.aborted && detailGeneration.current === generation) setLogsError(true);
    } finally {
      if (detailGeneration.current === generation) { logOperation.current = false; setLogsPending(false); }
    }
  };

  const auditFilters = { state: stateFilter, event: eventFilter, requestId: requestFilter, from, until };
  const visibleLogs = detail?.status === 'ready' ? filterProjectFunctionAudit(detail.data.logs, auditFilters) : [];
  const exportAudit = (format: 'json' | 'csv') => {
    if (detail?.status !== 'ready' || !selected || detail.data.summary.slug !== selected.slug || logsPending || deployPending || action === 'loading') return;
    setExportFailed(false);
    try {
      const content = serializeProjectFunctionAudit(context, projectId, detail.data, auditFilters, format);
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
      const timer = setTimeout(() => { URL.revokeObjectURL(url); auditUrls.current = auditUrls.current.filter(item => item.url !== url); }, 1000);
      auditUrls.current.push({ url, timer });
      try {
        const anchor = document.createElement('a'); anchor.href = url;
        anchor.download = `${projectId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)}-${detail.data.summary.slug}-audit.${format}`;
        anchor.click();
      } catch (error) { clearTimeout(timer); URL.revokeObjectURL(url); auditUrls.current = auditUrls.current.filter(item => item.url !== url); throw error; }
    } catch { setExportFailed(true); }
  };

  const inventoryMessage = stateMessage(functions, t);
  const readinessMessage = stateMessage(readiness, t);
  const caps = readiness?.status === 'ready' ? readiness.data : null;
  const canDeploy = caps?.available === true && caps.deploy;
  const canInvoke = caps?.available === true && caps.invoke;
  const canDelete = caps?.available === true && caps.delete;
  const canLogs = caps?.available === true && caps.logs;

  const unlockConsole = async () => {
    if (unlockOperation.current) return;
    unlockOperation.current = true; setUnlockPending(true); setAction('idle');
    try { await unlock(allowDataRead); } catch { setAction('error'); }
    finally { unlockOperation.current = false; setUnlockPending(false); }
  };
  const changeKey = () => {
    if (deployOperation.current || unknownFunction.current || action === 'loading') return;
    onPublishableKey('');
  };
  const useTemplate = () => {
    if (deployOperation.current || action === 'loading' || (!replaceDraft && sourceDraft !== STARTER_SOURCE && sourceDraft !== DATA_READ_SOURCE)) return;
    setSourceDraft(sourceTemplate === 'hello' ? STARTER_SOURCE : DATA_READ_SOURCE); setSourceInvalid(false); setReplaceDraft(false);
    if (sourceTemplate === 'data-read') { setAuth('user'); setInvokeMethod('GET'); setInvokeQuery('table=todos'); setInvocation(null); }
  };

  if (!publishableKey) {
    return (
      <section className="console-view console-functions" aria-labelledby="functions-title">
        <h2 id="functions-title">{t.title}</h2>
        <p className="console-note">{t.note}</p>
        <div className="console-boundary-note">
          <p>{t.locked}</p>
          <label><input type="checkbox" disabled={unlockPending} checked={allowDataRead} onChange={event => setAllowDataRead(event.target.checked)} />{t.dataRead}</label>
          <p className="console-note">{t.dataReadNote}</p>
          <button className="site-nav-button" type="button" disabled={unlockPending} onClick={() => void unlockConsole()}>{t.unlock}</button>
          {action === 'error' && <p role="alert">{t.failed}</p>}
        </div>
        <form className="console-boundary-note" onSubmit={(event) => {
          event.preventDefault();
          if (unlockOperation.current) return;
          const key = keyDraft.trim();
          if (!/^wid_pk_[A-Za-z0-9_-]{1,256}$/.test(key)) { setKeyInvalid(true); return; }
          onPublishableKey(key);
        }}>
          <label htmlFor={`${formId}-public-key`}>{t.publicKey}
            <input id={`${formId}-public-key`} type="password" value={keyDraft} maxLength={263} autoComplete="off" spellCheck={false} disabled={unlockPending} aria-invalid={keyInvalid} aria-describedby={`${formId}-public-key-note`} onChange={(event) => { setKeyDraft(event.target.value); setKeyInvalid(false); }} />
          </label>
          <p id={`${formId}-public-key-note`} className="console-note">{t.publicKeyNote}</p>
          {keyInvalid && <p role="alert">{t.invalidPublicKey}</p>}
          <button type="submit" disabled={unlockPending || !keyDraft.trim()}>{t.usePublicKey}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="console-view console-functions" aria-labelledby="functions-title">
      <div className="console-panel-heading">
        <h2 id="functions-title">{t.title}</h2>
        <button type="button" disabled={deployPending} onClick={() => void reload()}>{t.refresh}</button>
        <button type="button" disabled={deployPending || deployUnknown || action === 'loading'} aria-describedby={`${formId}-change-key-note`} onClick={changeKey}>{t.changeKey}</button>
      </div>
      <p className="console-note">{t.note}</p>
      <p id={`${formId}-change-key-note`} className="console-note">{t.changeKeyNote}</p>

      <section className="console-key-management" aria-labelledby="functions-readiness-title">
        <h3 id="functions-readiness-title">{t.readiness}</h3>
        {readiness?.status === 'ready' ? (
          <>
            <p role="status">{readinessReady(readiness.data) ? (readiness.data.deploy && readiness.data.activate && readiness.data.rollback && readiness.data.delete ? t.ready : t.readReady) : t.unavailable}</p>
            <div className="console-capabilities" aria-label={t.readiness}>
              {([
                ['invoke', t.capInvoke, readiness.data.invoke],
                ['deploy', t.capDeploy, readiness.data.deploy],
                ['listVersions', t.capVersions, readiness.data.listVersions],
                ['logs', t.capLogs, readiness.data.logs],
                ['activate', t.capActivate, readiness.data.activate],
                ['rollback', t.capRollback, readiness.data.rollback],
                ['delete', t.capDelete, readiness.data.delete],
              ] as const).map(([key, label, ok]) => (
                <article className="console-capability" key={key}>
                  <strong>{label}</strong>
                  <span className={ok ? 'is-available' : ''}>{ok ? t.capabilityAvailable : t.capabilityUnavailable}</span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p role={readinessMessage.role}>{readinessMessage.text}</p>
        )}
      </section>

      <div className="console-functions-layout">
        <aside aria-labelledby="functions-inventory-title">
          <div className="console-panel-heading">
            <h3 id="functions-inventory-title">{t.inventory}</h3>
          </div>
          {functions?.status === 'ready' ? (
            functions.data.length ? (
              functions.data.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  disabled={deployPending || action === 'loading'}
                  aria-current={selected?.slug === item.slug ? 'true' : undefined}
                  onClick={() => void inspect(item)}
                >
                  <strong>{item.slug}</strong>
                  <span>v{item.activeVersion} · {item.auth} · {item.state}</span>
                </button>
              ))
            ) : <p>{t.none}</p>
          ) : (
            <p role={inventoryMessage.role}>{inventoryMessage.text}</p>
          )}
        </aside>

        <div>
          {!selected && <p className="console-note">{t.selectHint}</p>}
          {selected && detail?.status === 'ready' && (
            <>
              <section aria-labelledby="function-detail-title">
                <h3 id="function-detail-title">{t.detail} · {selected.slug}</h3>
                <p>
                  {t.active}: {detail.data.summary.activeVersion}
                  {' · '}
                  {detail.data.summary.auth}
                  {' · '}
                  {detail.data.summary.state}
                  {detail.data.summary.sourceSha256 ? (
                    <> · {t.sha}: <code title={detail.data.summary.sourceSha256}>{shortSha(detail.data.summary.sourceSha256)}</code></>
                  ) : null}
                </p>

                <h4 id="function-versions-title">{t.versions}</h4>
                <ul aria-labelledby="function-versions-title">
                  {detail.data.versions.map((version) => {
                    const isActive = version.version === detail.data.summary.activeVersion;
                    const rollback = version.version < detail.data.summary.activeVersion;
                    const label = rollback ? t.rollback : t.activate;
                    const permitted = caps?.available === true && (rollback ? caps.rollback : caps.activate);
                    return (
                      <li key={version.version}>
                        <span>
                          v{version.version}
                          {' · '}
                          {version.auth}
                          {' · '}
                          {version.state}
                          {version.failureCode ? ` · ${version.failureCode}` : ''}
                          {version.sourceSha256 ? ` · ${shortSha(version.sourceSha256)}` : ''}
                        </span>
                        <button
                          type="button"
                          disabled={deployPending || deployUnknown || isActive || !permitted || action === 'loading'}
                          onClick={() => void activate(version.version)}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <label htmlFor={`${formId}-invoke-method`}>{t.method}</label>
                <select id={`${formId}-invoke-method`} value={invokeMethod} disabled={deployPending || action === 'loading'} onChange={(event) => { setInvokeMethod(event.target.value as ProjectFunctionInvokeMethod); setInvalidInvokeBody(false); }}>
                  {PROJECT_FUNCTION_INVOKE_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
                <label htmlFor={`${formId}-invoke-query`}>{t.query}</label>
                <input id={`${formId}-invoke-query`} value={invokeQuery} disabled={deployPending || action === 'loading'} autoComplete="off" spellCheck={false} aria-invalid={invalidInvokeQuery} aria-describedby={`${formId}-invoke-query-note`} onChange={(event) => { setInvokeQuery(event.target.value); setInvalidInvokeQuery(false); }} />
                <p className="console-note" id={`${formId}-invoke-query-note`}>{t.queryNote}</p>
                {invalidInvokeQuery && <p role="alert">{t.invalidQuery}</p>}
                <label htmlFor={`${formId}-invoke-content-type`}>{t.contentType}</label>
                <select id={`${formId}-invoke-content-type`} value={invokeContentType} disabled={deployPending || action === 'loading' || !invokeHasBody} onChange={event => { setInvokeContentType(event.target.value as ProjectFunctionInvokeContentType); setInvalidInvokeBody(false); }}>
                  {PROJECT_FUNCTION_INVOKE_CONTENT_TYPES.map(contentType => <option key={contentType} value={contentType}>{contentType}</option>)}
                </select>
                <label htmlFor={`${formId}-invoke-body`}>{invokeContentType === 'application/json' ? t.requestBody : t.rawRequestBody}</label>
                <textarea className="console-function-request" id={`${formId}-invoke-body`} rows={6} value={invokeBody} disabled={action === 'loading' || !invokeHasBody} aria-invalid={invalidInvokeBody} onChange={(event) => { setInvokeBody(event.target.value); setInvalidInvokeBody(false); }} />
                {invokeHasBody && invokeContentType !== 'application/json' && <p className="console-note">{t.rawBodyNote}</p>}
                {!invokeHasBody && <p className="console-note">{t.noBody}</p>}
                {invalidInvokeBody && <p role="alert">{invokeContentType === 'application/json' ? t.invalidBody : t.invalidRawBody}</p>}
                <div className="console-row-actions">
                  <button
                    className="site-nav-button"
                    type="button"
                    disabled={deployPending || !canInvoke || action === 'loading'}
                    onClick={invoke}
                  >
                    {t.invoke}
                  </button>
                  {invokePending && <button type="button" onClick={cancelInvoke}>{t.cancelInvoke}</button>}
                </div>
                <p className="console-note">{t.invokeNote}</p>
                {invocation && (
                  <dl className="console-function-invoke">
                    <dt>{t.status}</dt>
                    <dd>{invocation.status}</dd>
                    {invocation.traceId && <><dt>{t.trace}</dt><dd><code>{invocation.traceId}</code></dd></>}
                    {invokeElapsed !== null && <><dt>{t.elapsed}</dt><dd>{invokeElapsed} ms</dd></>}
                    {invocation.requestId ? (
                      <>
                        <dt>{t.requestId}</dt>
                        <dd><code>{invocation.requestId}</code></dd>
                      </>
                    ) : null}
                    <dt>{t.bodyPreview}{invocation.bodyTruncated ? ` (${t.bodyTruncated})` : ''}</dt>
                    <dd><code>{invocation.bodyPreview || t.bodyEmpty}</code></dd>
                  </dl>
                )}

                <div className="console-boundary-note">
                  <label htmlFor={`${formId}-delete`}>
                    {t.deleteConfirm}
                    <input
                      id={`${formId}-delete`}
                      value={deleteConfirmation}
                      autoComplete="off"
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={deployPending || deployUnknown || deleteConfirmation !== selected.slug || !canDelete || action === 'loading'}
                    onClick={() => void remove()}
                  >
                    {t.delete}
                  </button>
                </div>
              </section>

              <section className="console-key-management" aria-labelledby="function-logs-title">
                <h3 id="function-logs-title">{t.logs}</h3>
                <p className="console-note">{t.logsNote}</p>
                <form className="console-row-actions" onSubmit={(event) => { event.preventDefault(); void readLogs(traceDraft || undefined); }}>
                  <label htmlFor={`${formId}-trace`}>{t.trace}
                    <input id={`${formId}-trace`} value={traceDraft} maxLength={128} autoComplete="off" spellCheck={false} aria-invalid={logsInvalid} onChange={(event) => { setTraceDraft(event.target.value); setLogsInvalid(false); }} />
                  </label>
                  <button type="submit" disabled={deployPending || logsPending || !canLogs || action === 'loading'}>{t.traceSearch}</button>
                  <button type="button" disabled={deployPending || logsPending || !canLogs || action === 'loading' || !detail.data.traceId} onClick={() => { setTraceDraft(''); void readLogs(); }}>{t.traceAll}</button>
                </form>
                {logsInvalid && <p role="alert">{t.traceInvalid}</p>}
                {detail.data.traceId && <p className="console-note">{t.traceCurrent} <code>{detail.data.traceId}</code></p>}
                {logsPending && <p role="status">{t.logsLoading}</p>}
                {logsError && <p role="alert">{t.logsFailed}</p>}
                <div className="console-log-filters">
                  <label htmlFor={`${formId}-state`}>
                    {t.state}
                    <select
                      id={`${formId}-state`}
                      value={stateFilter}
                      onChange={(event) => setStateFilter(event.target.value)}
                    >
                      <option value="">{t.all}</option>
                      {[...new Set(detail.data.logs.map((log) => log.state))].map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`${formId}-event`}>
                    {t.event}
                    <input
                      id={`${formId}-event`}
                      value={eventFilter}
                      onChange={(event) => setEventFilter(event.target.value)}
                    />
                  </label>
                  <label htmlFor={`${formId}-request`}>
                    {t.requestFilter}
                    <input
                      id={`${formId}-request`}
                      value={requestFilter}
                      autoComplete="off"
                      onChange={(event) => setRequestFilter(event.target.value)}
                    />
                  </label>
                  <label htmlFor={`${formId}-from`}>
                    {t.from}
                    <input
                      id={`${formId}-from`}
                      type="datetime-local"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </label>
                  <label htmlFor={`${formId}-until`}>
                    {t.until}
                    <input
                      id={`${formId}-until`}
                      type="datetime-local"
                      value={until}
                      onChange={(event) => setUntil(event.target.value)}
                    />
                  </label>
                </div>
                {visibleLogs.length ? (
                  <ul>
                    {visibleLogs.map((log) => (
                      <li key={log.id}>
                        <strong>{log.event}</strong>
                        <span>
                          {log.state}
                          {log.version ? ` · v${log.version}` : ''}
                          {log.failureCode ? ` · ${log.failureCode}` : ''}
                          {` · ${t.logId} ${log.id}`}
                          {log.requestId ? ` · ${t.requestId} ${log.requestId}` : ''}
                          {log.traceId ? ` · ${t.trace} ${log.traceId}` : ''}
                        </span>
                        <time dateTime={log.occurredAt}>{log.occurredAt}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t.emptyLogs}</p>
                )}
                <p className="console-note">{t.exportNote}</p>
                <div className="console-row-actions">
                  <button type="button" disabled={logsPending || deployPending || action === 'loading'} onClick={() => exportAudit('json')}>{t.exportJson}</button>
                  <button type="button" disabled={logsPending || deployPending || action === 'loading'} onClick={() => exportAudit('csv')}>{t.exportCsv}</button>
                </div>
                {exportFailed && <p role="alert">{t.exportFailed}</p>}
                <button
                  type="button"
                  disabled={deployPending || logsPending || !detail.data.nextBeforeId || detail.data.logs.length >= 200 || !canLogs || action === 'loading'}
                  onClick={() => void readLogs(detail.data.traceId, true)}
                >
                  {t.older}
                </button>
                {detail.data.logs.length >= 200 && <p className="console-note">{t.logsCapped}</p>}
              </section>
            </>
          )}
          {selected && detail?.status !== 'ready' && (
            <p role={stateMessage(detail, t).role}>{stateMessage(detail, t).text}</p>
          )}
        </div>
      </div>

      <section className="console-key-management" aria-labelledby="function-deploy-title">
        <h3 id="function-deploy-title">{t.deploy}</h3>
        <p className="console-note">{t.deployNote}</p>
        <form className="console-function-deploy" onSubmit={(event) => void deploy(event)}>
          <label htmlFor={`${formId}-slug`}>
            {t.slug}
            <input
              id={`${formId}-slug`}
              required
              disabled={deployPending || deployUnknown}
              value={slug}
              autoComplete="off"
              pattern="[A-Za-z0-9._-]{1,128}"
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <label htmlFor={`${formId}-auth`}>
            {t.auth}
            <select
              id={`${formId}-auth`}
              value={auth}
              disabled={deployPending}
              onChange={(event) => setAuth(event.target.value as 'user' | 'project')}
            >
              <option value="user">{t.authUser}</option>
              <option value="project">{t.authProject}</option>
            </select>
          </label>
          <label htmlFor={`${formId}-source-mode`}>{t.sourceMode}
            <select id={`${formId}-source-mode`} disabled={deployPending || sourceReadPending} value={sourceMode} onChange={(event) => { if (sourceReadOperation.current) return; setSourceMode(event.target.value as 'editor' | 'file'); setFile(null); setSourceInvalid(false); setSourceReadFailed(false); setReplaceDraft(false); }}><option value="editor">{t.editor}</option><option value="file">{t.upload}</option></select>
          </label>
          {sourceMode === 'editor' ? <>
            <label htmlFor={`${formId}-template`}>{t.template}<select id={`${formId}-template`} disabled={deployPending || action === 'loading'} value={sourceTemplate} onChange={event => { setSourceTemplate(event.target.value as 'hello' | 'data-read'); setReplaceDraft(false); }}><option value="hello">{t.helloTemplate}</option><option value="data-read">{t.dataTemplate}</option></select></label>
            <p className="console-note">{t.templateNote}</p>
            {sourceDraft !== STARTER_SOURCE && sourceDraft !== DATA_READ_SOURCE && <label><input type="checkbox" disabled={deployPending || action === 'loading'} checked={replaceDraft} onChange={event => setReplaceDraft(event.target.checked)} />{t.replaceDraft}</label>}
            <button type="button" disabled={deployPending || action === 'loading' || (!replaceDraft && sourceDraft !== STARTER_SOURCE && sourceDraft !== DATA_READ_SOURCE)} onClick={useTemplate}>{t.useTemplate}</button>
            <label className="console-function-source" htmlFor={`${formId}-source`}>{t.sourceCode}
              <textarea className="console-function-request" id={`${formId}-source`} rows={12} spellCheck={false} autoCapitalize="off" autoCorrect="off" disabled={deployPending} aria-invalid={sourceInvalid || sourceBytes > PROJECT_FUNCTION_SOURCE_LIMIT} aria-describedby={`${formId}-source-size`} value={sourceDraft} onChange={(event) => { setSourceDraft(event.target.value); setSourceInvalid(false); setReplaceDraft(false); }} />
            </label>
          </> : <>
          <label htmlFor={`${formId}-bundle`}>{t.bundle}
            <input id={`${formId}-bundle`} required disabled={deployPending || sourceReadPending} type="file" accept=".ts,.tsx,text/typescript,text/plain" aria-invalid={sourceInvalid || sourceBytes > PROJECT_FUNCTION_SOURCE_LIMIT} aria-describedby={`${formId}-source-size`} onChange={(event) => { if (sourceReadOperation.current) return; setFile(event.target.files?.[0] || null); setSourceInvalid(false); setSourceReadFailed(false); setReplaceDraft(false); }} />
          </label>
          <p className="console-note">{t.openSourceNote}</p>
          {editedDraft && <label><input type="checkbox" disabled={deployPending || sourceReadPending} checked={replaceDraft} onChange={event => setReplaceDraft(event.target.checked)} />{t.replaceDraft}</label>}
          <button type="button" disabled={deployPending || sourceReadPending || action === 'loading' || !file || file.size === 0 || file.size > PROJECT_FUNCTION_SOURCE_LIMIT || (editedDraft && !replaceDraft)} onClick={() => void openSource()}>{t.openSource}</button>
          </>}
          {sourceReadPending && <p role="status">{t.openingSource}</p>}
          {sourceReadFailed && <p role="alert">{t.openSourceFailed}</p>}
          <p className={sourceBytes > PROJECT_FUNCTION_SOURCE_LIMIT ? 'console-status is-error' : 'console-note'} id={`${formId}-source-size`}>{t.sourceSize}: {sourceBytes.toLocaleString(lang)} / {PROJECT_FUNCTION_SOURCE_LIMIT.toLocaleString(lang)}</p>
          <button className="site-nav-button" type="submit" disabled={!canDeploy || deployPending || sourceReadPending || deployUnknown || action === 'loading'}>{t.deployAction}</button>
        </form>
      </section>

      {sourceInvalid && <p role="alert">{t.sourceLimit}</p>}
      {deployUnknown && <p role="alert">{t.unknownDeploy}</p>}
      {deployReceipt && <p role="status">{t.deployed} <strong>{deployReceipt.slug}</strong> · v{deployReceipt.activeVersion} · {deployReceipt.auth} · <code>{shortSha(deployReceipt.sourceSha256)}</code></p>}
      {action === 'loading' && <p role="status">{t.loading}</p>}
      {action === 'done' && <p role="status">{t.done}</p>}
      {action === 'cancelled' && <p role="status">{t.cancelled}</p>}
      {action === 'error' && <p role="alert" className="console-status is-error">{t.failed}</p>}
    </section>
  );
}
