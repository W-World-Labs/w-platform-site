import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import type { SaasContext, ProjectPanelState } from '../lib/saasConsole';
import {
  addProjectSiteDomain,
  changeProjectSiteVersion,
  createProjectSite,
  deleteProjectSite,
  deleteProjectSiteDomain,
  deployProjectSiteFiles,
  loadProjectSiteDomains,
  loadProjectSites,
  loadProjectSiteVersions,
  previewProjectSiteVersion,
  PROJECT_SITE_COUNT_LIMIT,
  PROJECT_SITE_FILE_LIMIT,
  PROJECT_SITE_TOTAL_LIMIT,
  serializeProjectSiteDns,
  verifyProjectSiteDomain,
  type ProjectSite,
  type ProjectSiteDomain,
  type ProjectSiteVersion,
} from '../lib/projectSites';

type Props = { lang: Lang; context: SaasContext; projectId: string; getAccessToken: () => Promise<string | null> };
type State<T> = ProjectPanelState<T> | null;
type UploadFile = { path: string; content: string; encoding: 'base64' };
type SiteLabels = { [Key in keyof typeof TEXT.en]: string };

const TEXT = {
  en: {
    title: 'Sites', note: 'Publish static files to W-Drop, inspect immutable versions, and manage custom domains for this project.',
    unavailable: 'This project is not available to your current workspace membership.', manager: 'Owner or admin access is required to view or manage project Sites.', loading: 'Loading project sites…',
    site: 'Site', noSites: 'No sites have been published for this project.', refresh: 'Refresh', files: 'Website files', selectFiles: 'Choose files', folder: 'Choose a folder', fileHelp: 'Select up to 100 files, 20 MiB each and 40 MiB total. Folder-relative paths are preserved.', create: 'Publish new site', update: 'Publish update', slug: 'Site slug (optional)', slugHelp: 'Leave empty to let W-Drop choose a site address.', selected: 'Selected files', publish: 'Publish files', publishing: 'Publishing…', fileLimit: 'The selection exceeds the per-file, total-size, or file-count limit.', choose: 'Choose at least one file.',
    selectionSummary: 'Selected', removeFile: 'Remove file', clearFiles: 'Clear selection', invalidPath: 'A file path is invalid or longer than 1024 characters. Choose a different file or folder.', duplicatePath: 'Files have duplicate destination paths. Remove a duplicate or choose a folder to preserve distinct paths.',
    successPublished: 'Site published successfully.', successVersion: 'Site version changed successfully.', successPreview: 'Preview is ready.', successDomainAdded: 'Domain added. Configure DNS, then check verification.', successDomainVerified: 'Domain verification was checked.', successDomainRemoved: 'Domain removed.', successDeleted: 'Site deleted.', publishFailed: 'The publish request failed. Check access, file limits, and the connection, then retry.',
    receipt: 'Confirmed publication', receiptVersion: 'Published version', receiptLink: 'Open published version', readFailed: 'Site refresh failed. Confirmed publication receipts are retained.', unknown: 'The result is unknown. Refresh sites and inspect versions and domains before retrying; the server may have completed the change.',
    current: 'Current version', publishedAt: 'Created', filesCount: 'Files', size: 'Size', openSite: 'Open site',
    versions: 'Versions', noVersions: 'No published versions are available.', preview: 'Open preview', promote: 'Promote version', rollback: 'Roll back to version', versionChanged: 'Site version changed successfully.', versionFailed: 'Could not change the active site version.',
    domains: 'Custom domains', noDomains: 'No custom domains are configured.', addDomain: 'Add domain', domainPlaceholder: 'www.example.com', verify: 'Check DNS', remove: 'Remove', verified: 'Verified', pending: 'Verification pending', dns: 'Add this DNS record', recordName: 'TXT name', recordValue: 'TXT value', cname: 'CNAME target', ipv4: 'IPv4 target', dnsRouting: 'Routing record', dnsDownload: 'Download DNS records', dnsDownloadFailed: 'The DNS file could not be downloaded. Records are still available.', dnsInvalid: 'These DNS records cannot be exported. Refresh domain configuration.', dnsNote: 'Download the verification TXT and one routing record in BIND format (TTL 300 seconds). Import into your DNS provider, review the records and proxy setting, then check DNS here. Choose A when your provider requires an IP address at the zone apex; otherwise use CNAME. This download does not configure DNS.', dnsGuide: 'Cloudflare DNS import instructions', domainFailed: 'Could not update this domain.', domainAdded: 'Domain added. Configure DNS, then check verification.',
    deleteSite: 'Delete site', typeSlug: 'Type the site slug to confirm', confirmDelete: 'Delete site', deleted: 'Site deleted.', deleteFailed: 'Could not delete this site.', cancel: 'Cancel', working: 'Working…',
    auth: 'Your sign-in is required. Sign in again and retry.', forbidden: 'W-Drop denied this project operation.', locked: 'This project is archived and its Sites content is read-only.', network: 'The Sites service is unavailable or returned an error.', invalid: 'W-Drop returned data that did not match this project Sites contract.',
  },
  zh: {
    title: 'Sites 网站发布', note: '通过 W-Drop 发布静态文件、查看不可变版本，并管理此项目的自定义域名。',
    unavailable: '当前工作区成员身份无法访问此项目。', manager: '查看或管理项目 Sites 需要 owner 或 admin 权限。', loading: '正在加载项目网站…',
    site: '网站', noSites: '此项目尚未发布网站。', refresh: '刷新', files: '网站文件', selectFiles: '选择文件', folder: '选择文件夹', fileHelp: '最多 100 个文件；每个文件不超过 20 MiB，总计不超过 40 MiB。会保留文件夹相对路径。', create: '发布新网站', update: '发布更新', slug: '网站标识（可选）', slugHelp: '留空时由 W-Drop 自动选择网站地址。', selected: '待发布文件', publish: '发布文件', publishing: '正在发布…', fileLimit: '选择的文件超出单文件、总大小或文件数量限制。', choose: '请先选择至少一个文件。',
    selectionSummary: '已选择', removeFile: '移除文件', clearFiles: '清空选择', invalidPath: '文件路径无效或超过 1024 个字符，请重新选择文件或文件夹。', duplicatePath: '多个文件的发布路径相同。请移除重复文件，或选择文件夹以保留不同路径。',
    successPublished: '网站已成功发布。', successVersion: '网站版本已更新。', successPreview: '预览已就绪。', successDomainAdded: '域名已添加。配置 DNS 后检查验证状态。', successDomainVerified: '已检查域名验证状态。', successDomainRemoved: '域名已移除。', successDeleted: '网站已删除。', publishFailed: '发布失败。请检查权限、文件限制与网络连接后重试。',
    receipt: '已确认的发布回执', receiptVersion: '发布版本', receiptLink: '打开已发布版本', readFailed: '网站刷新失败，已确认的发布回执仍保留。', unknown: '结果未知。重试前请刷新网站并检查版本与域名，服务端可能已完成修改。',
    current: '当前版本', publishedAt: '创建时间', filesCount: '文件数', size: '大小', openSite: '打开网站',
    versions: '版本历史', noVersions: '没有可用的网站版本。', preview: '打开预览', promote: '设为当前版本', rollback: '回滚到此版本', versionChanged: '网站版本已更新。', versionFailed: '无法切换当前网站版本。',
    domains: '自定义域名', noDomains: '尚未配置自定义域名。', addDomain: '添加域名', domainPlaceholder: 'www.example.com', verify: '检查 DNS', remove: '移除', verified: '已验证', pending: '等待验证', dns: '请添加以下 DNS 记录', recordName: 'TXT 名称', recordValue: 'TXT 值', cname: 'CNAME 目标', ipv4: 'IPv4 目标', dnsRouting: '路由记录', dnsDownload: '下载 DNS 记录', dnsDownloadFailed: '无法下载 DNS 文件，记录仍可查看。', dnsInvalid: '无法导出此 DNS 记录，请刷新域名配置。', dnsNote: '下载验证 TXT 和一条路由记录，使用 BIND 格式，TTL 为 300 秒。导入 DNS 服务商，核对记录及代理设置后，在此检查 DNS。如果服务商要求根域名使用 IP 地址，请选择 A；否则使用 CNAME。下载操作不会配置 DNS。', dnsGuide: 'Cloudflare DNS 导入说明', domainFailed: '无法更新此域名。', domainAdded: '域名已添加。配置 DNS 后检查验证状态。',
    deleteSite: '删除网站', typeSlug: '输入网站标识以确认', confirmDelete: '确认删除网站', deleted: '网站已删除。', deleteFailed: '无法删除此网站。', cancel: '取消', working: '处理中…',
    auth: '需要重新登录。请登录后重试。', forbidden: 'W-Drop 拒绝了此项目操作。', locked: '此项目已归档，Sites 内容仅可读取。', network: 'Sites 服务暂不可用或返回错误。', invalid: 'W-Drop 返回的数据与此项目 Sites 契约不符。',
  },
} as const;

function SiteDomainDns({ domain, t }: { domain: ProjectSiteDomain; t: SiteLabels }) {
  const routingId = useId();
  const [routing, setRouting] = useState<'CNAME' | 'A'>('CNAME');
  const [downloadFailed, setDownloadFailed] = useState(false);
  const downloads = useRef<Array<{ url: string; timer: number }>>([]);
  useEffect(() => () => { for (const item of downloads.current) { window.clearTimeout(item.timer); URL.revokeObjectURL(item.url); } downloads.current = []; }, []);
  const content = serializeProjectSiteDns(domain, routing);
  const download = () => {
    if (!content) return;
    setDownloadFailed(false);
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${domain.domain}-dns.txt`; anchor.click();
      const item = { url, timer: 0 };
      item.timer = window.setTimeout(() => { URL.revokeObjectURL(item.url); downloads.current = downloads.current.filter(value => value !== item); }, 1000);
      downloads.current.push(item);
    } catch { if (url) URL.revokeObjectURL(url); setDownloadFailed(true); }
  };
  return <div className="console-boundary-note">
    <dl><dt>{t.dns}</dt><dt>{t.recordName}</dt><dd><code>{domain.txtName}</code></dd><dt>{t.recordValue}</dt><dd><code>{domain.txtValue}</code></dd><dt>{routing === 'CNAME' ? t.cname : t.ipv4}</dt><dd><code>{routing === 'CNAME' ? domain.cnameTarget : domain.ipv4Target}</code></dd></dl>
    <label htmlFor={routingId}>{t.dnsRouting}</label><select id={routingId} value={routing} onChange={event => { setRouting(event.target.value as 'CNAME' | 'A'); setDownloadFailed(false); }}><option value="CNAME">CNAME</option>{domain.ipv4Target && <option value="A">A</option>}</select>
    <p className="console-note">{t.dnsNote}</p><p><a href="https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/" target="_blank" rel="noopener noreferrer">{t.dnsGuide}</a></p>
    <button type="button" disabled={!content} onClick={download}>{t.dnsDownload}</button>
    {!content && <p role="alert">{t.dnsInvalid}</p>}{downloadFailed && <p role="alert">{t.dnsDownloadFailed}</p>}
  </div>;
}

const MAX_UPLOAD_BYTES = PROJECT_SITE_TOTAL_LIMIT;

function message(status: ProjectPanelState<unknown>['status'] | undefined, labels: SiteLabels): string | undefined {
  if (status === 'auth') return labels.auth;
  if (status === 'forbidden') return labels.forbidden;
  if (status === 'locked') return labels.locked;
  if (status === 'network') return labels.network;
  if (status === 'invalid') return labels.invalid;
  return undefined;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function filePath(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!relative) return file.name;
  const parts = relative.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : relative;
}

function selectionIssue(files: File[]): 'fileLimit' | 'invalidPath' | 'duplicatePath' | undefined {
  if (files.length > PROJECT_SITE_COUNT_LIMIT || files.some(file => file.size > PROJECT_SITE_FILE_LIMIT) || files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) return 'fileLimit';
  const paths = new Set<string>();
  for (const file of files) {
    const path = filePath(file).replaceAll('\\', '/');
    if (!path || path.length > 1024 || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) return 'invalidPath';
    if (paths.has(path)) return 'duplicatePath';
    paths.add(path);
  }
}

function readBearer(getAccessToken: Props['getAccessToken'], signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void getAccessToken().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function ProjectSitesConsole(props: Props) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectSitesSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role])} {...props} />;
}

function ProjectSitesSession({ lang, context, projectId, getAccessToken }: Props) {
  const t = TEXT[lang];
  const project = context.console.projects.find((candidate) => candidate.id === projectId);
  const workspaceVisible = Boolean(project && context.authorityPlanes.workspaceMemberships.some((workspace) => workspace.id === project.workspaceId));
  const canManage = Boolean(workspaceVisible && project && ['owner', 'admin'].includes(project.workspaceRole));
  const [sites, setSites] = useState<State<{ sites: ProjectSite[] }>>(null);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [versions, setVersions] = useState<State<{ versions: ProjectSiteVersion[] }>>(null);
  const [domains, setDomains] = useState<State<{ domains: ProjectSiteDomain[] }>>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [preferredSlug, setPreferredSlug] = useState('');
  const [domainDraft, setDomainDraft] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [activity, setActivity] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [successKind, setSuccessKind] = useState<'successPublished' | 'successVersion' | 'successPreview' | 'successDomainAdded' | 'successDomainVerified' | 'successDomainRemoved' | 'successDeleted' | null>(null);
  const [siteError, setSiteError] = useState<string | undefined>();
  const [receipt, setReceipt] = useState<ProjectSite | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const unknownWrite = useRef(false);
  const active = useRef(true);
  const operationController = useRef<AbortController | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const currentSite = sites?.status === 'ready' ? sites.data.sites.find((site) => site.slug === selectedSlug) : undefined;
  const writesDisabled = activity === 'loading' || unknown || readFailed || sites?.status !== 'ready';
  const fileIssue = selectionIssue(files);

  const readInventory = useCallback(async (keepSlug: string | undefined, token: string | null, request: typeof fetch, signal: AbortSignal) => {
    const result = await loadProjectSites(context, projectId, token, request, signal);
    signal.throwIfAborted();
    if (!active.current) return;
    if (result.status !== 'ready') {
      setReadFailed(true);
      setSites((previous) => previous?.status === 'ready' ? previous : result);
      return;
    }
    const slug = keepSlug === '' ? '' : result.data.sites.some((site) => site.slug === keepSlug) ? keepSlug! : result.data.sites[0]?.slug || '';
    const [nextVersions, nextDomains] = slug ? await Promise.all([
      loadProjectSiteVersions(context, projectId, slug, token, request, signal),
      loadProjectSiteDomains(context, projectId, slug, token, request, signal),
    ]) : [null, null];
    signal.throwIfAborted();
    if (!active.current) return;
    setSites(result); setSelectedSlug(slug); setVersions(nextVersions); setDomains(nextDomains);
    const failed = Boolean(slug && (nextVersions?.status !== 'ready' || nextDomains?.status !== 'ready'));
    setReadFailed(failed);
    if (!failed) { unknownWrite.current = false; setUnknown(false); }
  }, [context, projectId]);

  const refreshSites = useCallback(async (keepSlug?: string) => {
    if (!canManage || operationController.current) return;
    const controller = new AbortController(); operationController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => { signal.throwIfAborted(); return fetch(input, { ...init, signal }); };
    setActivity('loading'); setSiteError(undefined);
    try {
      const token = await readBearer(getAccessToken, signal);
      signal.throwIfAborted();
      await readInventory(keepSlug, token, request, signal);
    } catch {
      if (active.current && !controller.signal.aborted) { setReadFailed(true); setSites((previous) => previous || { status: 'network' }); }
    } finally {
      if (active.current && operationController.current === controller) { setActivity('idle'); operationController.current = null; }
    }
  }, [canManage, getAccessToken, readInventory]);

  useEffect(() => {
    active.current = true;
    let initial = true;
    queueMicrotask(() => { if (initial) void refreshSites(); });
    return () => { initial = false; active.current = false; operationController.current?.abort(); operationController.current = null; };
  }, [refreshSites]);
  useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', ''); }, []);

  function selectSite(slug: string) {
    if (slug === selectedSlug) return;
    operationController.current?.abort(); operationController.current = null;
    setSelectedSlug(slug); setVersions(null); setDomains(null); setFiles([]); setPreferredSlug(''); setDomainDraft(''); setDeleteConfirmation('');
    setActivity('idle'); setSuccessKind(null); setSiteError(undefined); setPreviewUrl(''); setReceipt(null);
    void refreshSites(slug);
  }

  async function runOperation<T>(writes: boolean, failure: string, invoke: (token: string | null, request: typeof fetch, signal: AbortSignal) => Promise<ProjectPanelState<T>>, confirmed: (value: T, token: string | null, request: typeof fetch, signal: AbortSignal) => Promise<void> | void, timeoutMs = 30_000) {
    if (!canManage || !active.current || operationController.current || (writes && (unknownWrite.current || readFailed || sites?.status !== 'ready'))) return;
    const controller = new AbortController(); operationController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    let writeStarted = false;
    let succeeded = false;
    const current = () => active.current && operationController.current === controller && !controller.signal.aborted;
    const request: typeof fetch = (input, init) => {
      signal.throwIfAborted();
      if (String(input).startsWith('/api/project-sites/') && ['POST', 'DELETE'].includes(init?.method || 'GET')) writeStarted = true;
      return fetch(input, { ...init, signal });
    };
    setActivity('loading'); setSiteError(undefined); setSuccessKind(null);
    try {
      const token = await readBearer(getAccessToken, signal);
      signal.throwIfAborted();
      const result = await invoke(token, request, signal);
      if (!current()) return;
      signal.throwIfAborted();
      if (result.status !== 'ready') {
        if (writeStarted && (result.status === 'network' || result.status === 'invalid')) { unknownWrite.current = true; setUnknown(true); }
        setSiteError(message(result.status, t) || failure); setActivity('error'); return;
      }
      succeeded = true;
      await confirmed(result.data, token, request, signal);
      if (current()) setActivity('done');
    } catch {
      if (current()) {
        if (succeeded) { setReadFailed(true); setActivity('done'); }
        else {
          if (writeStarted) { unknownWrite.current = true; setUnknown(true); }
          setSiteError(failure); setActivity('error');
        }
      }
    } finally {
      if (current()) operationController.current = null;
    }
  }

  async function selectedUploadFiles(signal: AbortSignal): Promise<UploadFile[] | null> {
    if (!files.length || selectionIssue(files)) return null;
    const uploads: UploadFile[] = [];
    for (const file of files) {
      const path = filePath(file).replaceAll('\\', '/');
      uploads.push({ path, content: base64(new Uint8Array(await file.arrayBuffer())), encoding: 'base64' });
      signal.throwIfAborted();
    }
    return uploads;
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) { setSiteError(t.choose); return; }
    if (fileIssue) return;
    await runOperation(true, t.publishFailed, async (token, request, signal) => {
      const uploads = await selectedUploadFiles(signal);
      if (!uploads) return { status: 'invalid' };
      return currentSite ? deployProjectSiteFiles(context, projectId, currentSite.slug, uploads, token, request, signal)
        : createProjectSite(context, projectId, uploads, token, request, signal, preferredSlug.trim() || undefined);
    }, async (value, token, request, signal) => {
      setReceipt(value); setSuccessKind('successPublished'); setFiles([]); setPreferredSlug('');
      await readInventory(value.slug, token, request, signal);
    }, 120_000);
  }

  async function runSiteAction(action: 'promote' | 'rollback', version: number) {
    if (!currentSite) return;
    await runOperation(true, t.versionFailed, (token, request, signal) => changeProjectSiteVersion(context, projectId, currentSite.slug, version, action, token, request, signal), async (value, token, request, signal) => {
      setReceipt(value); setSuccessKind('successVersion');
      await readInventory(value.slug, token, request, signal);
    });
  }

  async function openPreview(version: number) {
    if (!currentSite) return;
    await runOperation(false, t.network, (token, request, signal) => previewProjectSiteVersion(context, projectId, currentSite.slug, version, token, request, signal), (value) => { setPreviewUrl(value.url); setSuccessKind('successPreview'); });
  }

  async function changeDomain(action: 'add' | 'verify' | 'delete', domain?: string) {
    if (!currentSite) return;
    await runOperation<ProjectSiteDomain | { deleted: boolean }>(true, t.domainFailed, (token, request, signal) => action === 'add'
      ? addProjectSiteDomain(context, projectId, currentSite.slug, domainDraft.trim(), token, request, signal)
      : action === 'verify' ? verifyProjectSiteDomain(context, projectId, currentSite.slug, domain || '', token, request, signal)
        : deleteProjectSiteDomain(context, projectId, currentSite.slug, domain || '', token, request, signal), async (_value, token, request, signal) => {
      setSuccessKind(action === 'add' ? 'successDomainAdded' : action === 'verify' ? 'successDomainVerified' : 'successDomainRemoved');
      if (action === 'add') setDomainDraft('');
      await readInventory(currentSite.slug, token, request, signal);
    });
  }

  async function removeSite() {
    if (!currentSite || deleteConfirmation !== currentSite.slug) return;
    await runOperation(true, t.deleteFailed, (token, request, signal) => deleteProjectSite(context, projectId, currentSite.slug, token, request, signal), async (_value, token, request, signal) => {
      setSuccessKind('successDeleted'); setSelectedSlug(''); setDeleteConfirmation(''); setVersions(null); setDomains(null); setReceipt(null);
      await readInventory('', token, request, signal);
    });
  }

  if (!workspaceVisible) return <section className="console-view" aria-labelledby="project-sites-title"><h2 id="project-sites-title">{t.title}</h2><p role="alert">{t.unavailable}</p></section>;

  return <section className="console-view" aria-labelledby="project-sites-title">
    <h2 id="project-sites-title">{t.title}</h2><p className="console-note">{t.note}</p>
    {!canManage && <p className="console-boundary-note" role="status">{t.manager}</p>}
    <section className="console-key-management" aria-labelledby="project-sites-list-title">
      <div className="console-panel-heading"><h3 id="project-sites-list-title">{t.site}</h3><button type="button" onClick={() => void refreshSites(selectedSlug)} disabled={activity === 'loading'}>{t.refresh}</button></div>
      {!canManage ? <p role="status">{t.manager}</p> : sites === null ? <p role="status">{t.loading}</p> : sites.status === 'ready' ? <>
        {sites.data.sites.length === 0 ? <p>{t.noSites}</p> : <label>{t.site}<select value={selectedSlug} onChange={(event) => selectSite(event.target.value)}><option value="" disabled>{t.site}</option>{sites.data.sites.map((site) => <option key={site.slug} value={site.slug}>{site.slug} · v{site.currentVersion}</option>)}</select></label>}
        {canManage && sites.data.sites.length > 0 && <button type="button" onClick={() => selectSite('')}>{t.create}</button>}
        {currentSite && <><dl><dt>{t.current}</dt><dd>v{currentSite.currentVersion}</dd><dt>{t.filesCount}</dt><dd>{currentSite.fileCount}</dd><dt>{t.size}</dt><dd>{formatBytes(currentSite.totalBytes)}</dd><dt>{t.publishedAt}</dt><dd>{new Date(currentSite.createdAt * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')}</dd></dl><p><a href={currentSite.url} target="_blank" rel="noopener noreferrer">{t.openSite}</a></p></>}
      </> : <p role="alert">{message(sites.status, t)}</p>}
    </section>

    {canManage && <form className="console-row-editor" onSubmit={(event) => void publish(event)} aria-labelledby="project-sites-publish-title">
      <h3 id="project-sites-publish-title">{currentSite ? t.update : t.create}</h3>
      {!currentSite && <label>{t.slug}<input disabled={activity === 'loading'} value={preferredSlug} maxLength={64} pattern="[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?" onChange={(event) => setPreferredSlug(event.target.value)} /><small>{t.slugHelp}</small></label>}
      <label><span>{t.selectFiles}</span><input disabled={activity === 'loading'} type="file" multiple aria-describedby="project-sites-file-help" onChange={(event) => { setFiles(Array.from(event.target.files || [])); event.currentTarget.value = ''; setSiteError(undefined); }} /></label>
      <label><span>{t.folder}</span><input ref={folderInput} disabled={activity === 'loading'} type="file" multiple aria-describedby="project-sites-file-help" onChange={(event) => { setFiles(Array.from(event.target.files || [])); event.currentTarget.value = ''; setSiteError(undefined); }} /></label>
      <small id="project-sites-file-help">{t.fileHelp}</small>
      {files.length > 0 && <div><strong>{t.selected}</strong><p role="status">{t.selectionSummary}: {files.length} / {PROJECT_SITE_COUNT_LIMIT} · {formatBytes(files.reduce((total, file) => total + file.size, 0))} / {formatBytes(MAX_UPLOAD_BYTES)}</p><ul>{files.slice(0, PROJECT_SITE_COUNT_LIMIT).map((file, index) => <li key={index}>{filePath(file)} · {formatBytes(file.size)} <button type="button" disabled={activity === 'loading'} aria-label={`${t.removeFile}: ${filePath(file)}`} onClick={() => { setFiles(previous => previous.filter((_, position) => position !== index)); setSiteError(undefined); }}>{t.removeFile}</button></li>)}</ul><button type="button" disabled={activity === 'loading'} onClick={() => { setFiles([]); setSiteError(undefined); }}>{t.clearFiles}</button></div>}
      {fileIssue && <p role="alert">{t[fileIssue]}</p>}
      <button className="site-nav-button" type="submit" disabled={writesDisabled || !files.length || Boolean(fileIssue)}>{activity === 'loading' ? t.publishing : t.publish}</button>
    </form>}

    {currentSite && <>
      <section className="console-key-management" aria-labelledby="project-sites-versions-title"><h3 id="project-sites-versions-title">{t.versions}</h3>
        {!versions ? <p role="status">{t.loading}</p> : versions.status === 'ready' ? versions.data.versions.length ? <ul>{versions.data.versions.map((version) => <li key={version.version}><strong>v{version.version}{version.version === currentSite.currentVersion ? ` · ${t.current}` : ''}</strong><span> · {version.fileCount} {t.filesCount} · {formatBytes(version.totalBytes)}</span><div className="console-row-actions"><button type="button" disabled={activity === 'loading'} onClick={() => void openPreview(version.version)}>{t.preview}</button>{canManage && version.version !== currentSite.currentVersion && <><button type="button" disabled={writesDisabled} onClick={() => void runSiteAction('promote', version.version)}>{t.promote}</button><button type="button" disabled={writesDisabled} onClick={() => void runSiteAction('rollback', version.version)}>{t.rollback}</button></>}</div>{version.files.length > 0 && <ul>{version.files.slice(0, PROJECT_SITE_COUNT_LIMIT).map((file) => <li key={file.path}><code>{file.path}</code> · {formatBytes(file.size)}</li>)}</ul>}</li>)}</ul> : <p>{t.noVersions}</p> : <p role="alert">{message(versions.status, t)}</p>}
        {previewUrl && <p role="status"><a href={previewUrl} target="_blank" rel="noopener noreferrer">{t.preview}</a></p>}
      </section>

      <section className="console-key-management" aria-labelledby="project-sites-domains-title"><h3 id="project-sites-domains-title">{t.domains}</h3>
        {!domains ? <p role="status">{t.loading}</p> : domains.status === 'ready' ? <>
          {domains.data.domains.length === 0 && <p>{t.noDomains}</p>}
          <ul>{domains.data.domains.map((domain) => <li key={domain.domain}><strong>{domain.domain}</strong> · {domain.verified ? t.verified : t.pending}<p><a href={domain.url} target="_blank" rel="noopener noreferrer">{domain.url}</a></p><SiteDomainDns key={JSON.stringify([domain.domain, domain.txtName, domain.txtValue, domain.cnameTarget, domain.ipv4Target])} domain={domain} t={t} /><div className="console-row-actions">{canManage && !domain.verified && <button type="button" disabled={writesDisabled} onClick={() => void changeDomain('verify', domain.domain)}>{t.verify}</button>}{canManage && <button type="button" disabled={writesDisabled} onClick={() => { if (window.confirm(`${t.remove}: ${domain.domain}?`)) void changeDomain('delete', domain.domain); }}>{t.remove}</button>}</div></li>)}</ul>
          {canManage && <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void changeDomain('add'); }}><label>{t.addDomain}<input disabled={activity === 'loading'} type="text" inputMode="url" autoComplete="off" maxLength={253} pattern="(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?" placeholder={t.domainPlaceholder} value={domainDraft} onChange={(event) => setDomainDraft(event.target.value)} /></label><button type="submit" disabled={writesDisabled || !domainDraft.trim()}>{t.addDomain}</button></form>}
        </> : <p role="alert">{message(domains.status, t)}</p>}
      </section>

      {canManage && <section className="console-boundary-note" aria-labelledby="project-sites-delete-title"><h3 id="project-sites-delete-title">{t.deleteSite}</h3><label>{t.typeSlug}<input disabled={activity === 'loading'} autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><button type="button" disabled={writesDisabled || deleteConfirmation !== currentSite.slug} onClick={() => void removeSite()}>{t.confirmDelete}</button></section>}
    </>}
    {receipt && <section className="console-boundary-note" aria-labelledby="project-sites-receipt-title"><h3 id="project-sites-receipt-title">{t.receipt}</h3><dl><dt>{t.site}</dt><dd><code>{receipt.slug}</code></dd><dt>{t.receiptVersion}</dt><dd>v{receipt.currentVersion}</dd><dt>{t.filesCount}</dt><dd>{receipt.fileCount}</dd><dt>{t.size}</dt><dd>{formatBytes(receipt.totalBytes)}</dd></dl>{receipt.versionUrl && <a href={receipt.versionUrl} target="_blank" rel="noopener noreferrer">{t.receiptLink}</a>}</section>}
    {readFailed && <p role="alert">{t.readFailed}</p>}
    {unknown && <p role="alert">{t.unknown}</p>}
    {activity === 'loading' && <p role="status" aria-live="polite">{t.working}</p>}
    {activity === 'done' && successKind && <p role="status" aria-live="polite">{t[successKind]}</p>}
    {siteError && <p role="alert" className="console-status is-error">{siteError}</p>}
  </section>;
}
