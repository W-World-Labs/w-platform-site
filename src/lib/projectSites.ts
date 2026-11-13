import type { SaasContext, ProjectPanelState } from './saasConsole';
import { exchangeProjectManagementToken } from './saasConsole';

export interface ProjectSite {
  workspaceId: string;
  projectId: string;
  slug: string;
  url: string;
  currentVersion: number;
  versionUrl?: string;
  createdAt: number;
  fileCount: number;
  totalBytes: number;
}

export interface ProjectSiteVersion {
  version: number;
  createdAt: number;
  fileCount: number;
  totalBytes: number;
  files: Array<{ path: string; size: number }>;
  versionUrl?: string;
}

export interface ProjectSiteDomain {
  domain: string;
  url: string;
  verified: boolean;
  verifiedAt?: number | null;
  lastCheckedAt?: number | null;
  txtName: string;
  txtValue: string;
  cnameTarget: string;
  ipv4Target?: string | null;
}

export const PROJECT_SITE_FILE_LIMIT = 20 * 1024 * 1024;
export const PROJECT_SITE_TOTAL_LIMIT = 40 * 1024 * 1024;
export const PROJECT_SITE_COUNT_LIMIT = 100;

export function serializeProjectSiteDns(domain: ProjectSiteDomain, routing: 'CNAME' | 'A'): string | null {
  const name = domain.domain.toLowerCase();
  const txtName = domain.txtName.toLowerCase();
  if (!validDomain(name) || txtName.length > 253 || !txtName.endsWith(`.${name}`) || !txtName.split('.').every(label => /^[a-z0-9_-]{1,63}$/.test(label)) || !domain.txtValue || domain.txtValue.length > 300) return null;
  let target: string;
  if (routing === 'CNAME') {
    if (!validDomain(domain.cnameTarget)) return null;
    target = `${domain.cnameTarget.toLowerCase()}.`;
  } else if (routing === 'A') {
    if (!domain.ipv4Target || !/^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(domain.ipv4Target) || domain.ipv4Target.split('.').some(part => Number(part) > 255)) return null;
    target = domain.ipv4Target;
  } else return null;
  // DNS TXT character strings hold at most 255 octets. Preserve the exact
  // UTF-8 bytes and quote metacharacters so values cannot introduce records.
  const bytes = new TextEncoder().encode(domain.txtValue);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 255) {
    chunks.push(`"${Array.from(bytes.slice(offset, offset + 255), byte => byte === 34 || byte === 92 ? `\\${String.fromCharCode(byte)}` : byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : `\\${String(byte).padStart(3, '0')}`).join('')}"`);
  }
  return `; W-Drop custom domain DNS records\n${txtName}. 300 IN TXT ${chunks.join(' ')}\n${name}. 300 IN ${routing} ${target}\n`;
}

type ProjectSites = { sites: ProjectSite[] };
type ProjectSiteVersions = { versions: ProjectSiteVersion[] };
type ProjectSiteDomains = { domains: ProjectSiteDomain[] };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown, max = 512): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function integer(value: unknown, min = 0): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : null;
}

function safeHttps(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function memberProject(context: SaasContext, projectId: string) {
  const project = context.console.projects.find((item) => item.id === projectId);
  return project && ['owner', 'admin'].includes(project.workspaceRole) && context.authorityPlanes.workspaceMemberships.some((workspace) => workspace.id === project.workspaceId) ? project : undefined;
}

function canManageProject(context: SaasContext, projectId: string) {
  const project = memberProject(context, projectId);
  return project && ['owner', 'admin'].includes(project.workspaceRole) ? project : undefined;
}

function endpoint(projectId: string, suffix = ''): string {
  return `/api/project-sites/api/v1/projects/${encodeURIComponent(projectId)}/sites${suffix}`;
}

function responseFailure(response: Response): ProjectPanelState<never> | undefined {
  if (response.status === 401) return { status: 'auth' };
  if (response.status === 403 || response.status === 404) return { status: 'forbidden' };
  if (response.status === 423) return { status: 'locked' };
  if (!response.ok) return { status: 'network' };
  return undefined;
}

function parseSite(value: unknown, projectId: string, workspaceId: string): ProjectSite | null {
  const item = record(value);
  const slug = string(item?.slug, 64);
  const currentVersion = integer(item?.current_version, 1);
  const createdAt = integer(item?.created_at_unix);
  const fileCount = integer(item?.file_count);
  const totalBytes = integer(item?.total_bytes);
  const url = safeHttps(item?.url);
  if (!item || item.project_id !== projectId || item.workspace_id !== workspaceId || !slug || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) || !url || currentVersion === null || createdAt === null || fileCount === null || totalBytes === null) return null;
  return { projectId, workspaceId, slug, url, currentVersion, createdAt, fileCount, totalBytes, ...(safeHttps(item.version_url) ? { versionUrl: safeHttps(item.version_url) } : {}) };
}

function parseSites(value: unknown, projectId: string, workspaceId: string): ProjectSites | null {
  const root = record(value);
  if (!Array.isArray(root?.sites) || root.sites.length > 200) return null;
  const sites = root.sites.map((site) => parseSite(site, projectId, workspaceId));
  return sites.some((site) => site === null) ? null : { sites: sites as ProjectSite[] };
}

function parseVersions(value: unknown): ProjectSiteVersions | null {
  const root = record(value);
  if (!Array.isArray(root?.versions) || root.versions.length > 100) return null;
  const versions = root.versions.map((value): ProjectSiteVersion | null => {
    const item = record(value);
    const version = integer(item?.version, 1);
    const createdAt = integer(item?.created_at_unix);
    const fileCount = integer(item?.file_count);
    const totalBytes = integer(item?.total_bytes);
    if (!item || version === null || createdAt === null || fileCount === null || totalBytes === null) return null;
    const rawFiles = Array.isArray(item.files) ? item.files : [];
    if (rawFiles.length > PROJECT_SITE_COUNT_LIMIT) return null;
    const files = rawFiles.map((entry) => {
      const file = record(entry);
      const path = string(file?.path, 1024);
      const size = integer(file?.size);
      return path && size !== null ? { path, size } : null;
    });
    if (files.some((file) => file === null)) return null;
    const versionUrl = safeHttps(item.version_url);
    return { version, createdAt, fileCount, totalBytes, files: files as Array<{ path: string; size: number }>, ...(versionUrl ? { versionUrl } : {}) };
  });
  return versions.some((item) => item === null) ? null : { versions: versions as ProjectSiteVersion[] };
}

function parseDomains(value: unknown): ProjectSiteDomains | null {
  const root = record(value);
  if (!Array.isArray(root?.domains) || root.domains.length > 50) return null;
  const domains = root.domains.map((value): ProjectSiteDomain | null => {
    const item = record(value);
    const domain = string(item?.domain, 253);
    const url = safeHttps(item?.url);
    const txtName = string(item?.txt_name, 300);
    const txtValue = string(item?.txt_value, 300);
    const cnameTarget = string(item?.cname_target, 253);
    if (!item || !domain || !url || !txtName || !txtValue || !cnameTarget || typeof item.verified !== 'boolean') return null;
    return { domain, url, verified: item.verified, verifiedAt: integer(item.verified_at_unix) ?? (item.verified_at_unix === null ? null : undefined), lastCheckedAt: integer(item.last_checked_at_unix) ?? (item.last_checked_at_unix === null ? null : undefined), txtName, txtValue, cnameTarget, ipv4Target: typeof item.ipv4_target === 'string' || item.ipv4_target === null ? item.ipv4_target : undefined };
  });
  return domains.some((domain) => domain === null) ? null : { domains: domains as ProjectSiteDomain[] };
}

async function requestProjectSites<T>(
  context: SaasContext,
  projectId: string,
  bearerToken: string | null,
  request: typeof fetch,
  path: string,
  method: string,
  body: unknown,
  parse: (value: unknown, projectId: string, workspaceId: string) => T | null,
  signal?: AbortSignal,
  timeoutMs = 30_000,
): Promise<ProjectPanelState<T>> {
  const project = memberProject(context, projectId);
  if (!project) return { status: 'forbidden' };
  if (!bearerToken) return { status: 'auth' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    controller.signal.throwIfAborted();
    const management = await exchangeProjectManagementToken(project, bearerToken, request, controller.signal);
    controller.signal.throwIfAborted();
    if (management.status !== 'ready') return management;
    const response = await request(path, {
      method,
      headers: { Authorization: `Bearer ${management.token.accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const failure = responseFailure(response);
    if (failure) return failure;
    const payload: unknown = await response.json();
    controller.signal.throwIfAborted();
    const data = parse(payload, projectId, project.workspaceId);
    return data ? { status: 'ready', data } : { status: 'invalid' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { status: 'network' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function loadProjectSites(context: SaasContext, projectId: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId), 'GET', undefined, parseSites, signal);
}

export function createProjectSite(context: SaasContext, projectId: string, files: Array<{ path: string; content: string; encoding: 'base64' }>, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal, slug?: string) {
  const project = canManageProject(context, projectId);
  if (!project) return Promise.resolve<ProjectPanelState<ProjectSite>>({ status: 'forbidden' });
  if (!validFiles(files) || (slug && !safeSlug(slug))) return Promise.resolve<ProjectPanelState<ProjectSite>>({ status: 'invalid' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId), 'POST', { ...(slug ? { slug } : {}), files }, parseSiteResponse, signal, 120_000);
}

export function deployProjectSiteFiles(context: SaasContext, projectId: string, slug: string, files: Array<{ path: string; content: string; encoding: 'base64' }>, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  const project = canManageProject(context, projectId);
  if (!project || !safeSlug(slug)) return Promise.resolve<ProjectPanelState<ProjectSite>>({ status: 'forbidden' });
  if (!validFiles(files)) return Promise.resolve<ProjectPanelState<ProjectSite>>({ status: 'invalid' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/deployments`), 'POST', { files }, (value, projectId, workspaceId) => parseSiteResponse(value, projectId, workspaceId, slug), signal, 120_000);
}

function parseSiteResponse(value: unknown, projectId: string, workspaceId: string, slug?: string): ProjectSite | null {
  const site = parseSite(value, projectId, workspaceId);
  return site && (!slug || site.slug === slug) ? site : null;
}

function safeSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug);
}

function validFiles(files: Array<{ path: string; content: string; encoding: 'base64' }>): boolean {
  if (!Array.isArray(files) || files.length < 1 || files.length > PROJECT_SITE_COUNT_LIMIT) return false;
  let total = 0;
  const paths = new Set<string>();
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || file.path.length > 1024 || file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').some((part) => !part || part === '.' || part === '..') || file.encoding !== 'base64' || typeof file.content !== 'string' || !validBase64(file.content)) return false;
    const padding = file.content.endsWith('==') ? 2 : file.content.endsWith('=') ? 1 : 0;
    const bytes = (file.content.length / 4) * 3 - padding;
    if (bytes > PROJECT_SITE_FILE_LIMIT || file.content.length > Math.ceil(PROJECT_SITE_FILE_LIMIT / 3) * 4) return false;
    total += bytes;
    if (total > PROJECT_SITE_TOTAL_LIMIT || paths.has(file.path)) return false;
    paths.add(file.path);
  }
  return true;
}

function validBase64(value: string): boolean {
  if (value.length % 4 !== 0 || value.length > Math.ceil(PROJECT_SITE_FILE_LIMIT / 3) * 4) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if ((padding === 2 && value.length < 4) || (padding === 2 && value[value.length - 3] === '=') || (padding === 1 && value[value.length - 2] === '=')) return false;
  const dataLength = value.length - padding;
  if ((padding === 2 && dataLength % 4 !== 2) || (padding === 1 && dataLength % 4 !== 3)) return false;
  for (let index = 0; index < dataLength; index += 1) {
    const code = value.charCodeAt(index);
    if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 43 || code === 47)) return false;
  }
  for (let index = dataLength; index < value.length; index += 1) if (value.charCodeAt(index) !== 61) return false;
  return true;
}

export function loadProjectSiteVersions(context: SaasContext, projectId: string, slug: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!safeSlug(slug)) return Promise.resolve<ProjectPanelState<ProjectSiteVersions>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/versions`), 'GET', undefined, (value) => parseVersions(value), signal);
}

export function loadProjectSiteDomains(context: SaasContext, projectId: string, slug: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!safeSlug(slug)) return Promise.resolve<ProjectPanelState<ProjectSiteDomains>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/domains`), 'GET', undefined, (value) => parseDomains(value), signal);
}

export function addProjectSiteDomain(context: SaasContext, projectId: string, slug: string, domain: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!canManageProject(context, projectId) || !safeSlug(slug)) return Promise.resolve<ProjectPanelState<ProjectSiteDomain>>({ status: 'forbidden' });
  if (!validDomain(domain)) return Promise.resolve<ProjectPanelState<ProjectSiteDomain>>({ status: 'invalid' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/domains`), 'POST', { domain: domain.toLowerCase() }, parseDomainResponse, signal);
}

export function verifyProjectSiteDomain(context: SaasContext, projectId: string, slug: string, domain: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!canManageProject(context, projectId) || !safeSlug(slug) || !validDomain(domain)) return Promise.resolve<ProjectPanelState<ProjectSiteDomain>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/domains/${encodeURIComponent(domain.toLowerCase())}/verify`), 'POST', undefined, parseDomainResponse, signal);
}

export function deleteProjectSiteDomain(context: SaasContext, projectId: string, slug: string, domain: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!canManageProject(context, projectId) || !safeSlug(slug) || !validDomain(domain)) return Promise.resolve<ProjectPanelState<{ deleted: boolean }>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/domains/${encodeURIComponent(domain.toLowerCase())}`), 'DELETE', undefined, (value) => record(value)?.deleted === true ? { deleted: true } : null, signal);
}

function parseDomainResponse(value: unknown): ProjectSiteDomain | null {
  const parsed = parseDomains({ domains: [value] });
  return parsed?.domains[0] || null;
}

function validDomain(value: string): boolean {
  return value.length <= 253 && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
}

export function changeProjectSiteVersion(context: SaasContext, projectId: string, slug: string, version: number, action: 'promote' | 'rollback', bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!canManageProject(context, projectId) || !safeSlug(slug) || !Number.isSafeInteger(version) || version < 1) return Promise.resolve<ProjectPanelState<ProjectSite>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/${action}`), 'POST', { version }, (value, projectId, workspaceId) => parseSiteResponse(value, projectId, workspaceId, slug), signal);
}

export function previewProjectSiteVersion(context: SaasContext, projectId: string, slug: string, version: number, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal): Promise<ProjectPanelState<{ slug: string; version: number; url: string }>> {
  if (!safeSlug(slug) || !Number.isSafeInteger(version) || version < 1) return Promise.resolve({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}/preview/${version}`), 'GET', undefined, (value) => {
    const item = record(value);
    const url = safeHttps(item?.url);
    return item?.slug === slug && item.version === version && url ? { slug, version, url } : null;
  }, signal);
}

export function deleteProjectSite(context: SaasContext, projectId: string, slug: string, bearerToken: string | null, request: typeof fetch, signal?: AbortSignal) {
  if (!canManageProject(context, projectId) || !safeSlug(slug)) return Promise.resolve<ProjectPanelState<{ deleted: boolean }>>({ status: 'forbidden' });
  return requestProjectSites(context, projectId, bearerToken, request, endpoint(projectId, `/${encodeURIComponent(slug)}`), 'DELETE', undefined, (value) => record(value)?.deleted === true ? { deleted: true } : null, signal);
}
