import { describe, expect, it, vi } from 'vitest';
import {
  addProjectSiteDomain, changeProjectSiteVersion, createProjectSite, deleteProjectSite,
  deleteProjectSiteDomain, deployProjectSiteFiles, loadProjectSiteDomains, loadProjectSites,
  loadProjectSiteVersions, previewProjectSiteVersion, verifyProjectSiteDomain, serializeProjectSiteDns,
} from './projectSites';
import { PROJECT_SITE_FILE_LIMIT } from './projectSites';
import type { SaasContext } from './saasConsole';

const context: SaasContext = {
  schemaVersion: 1,
  self: { userId: 'user_a' },
  authorityPlanes: { platformRole: 'member', workspaceMemberships: [{ id: 'workspace_a', name: 'A', role: 'owner', tier: 'pro' }], appUserRelationships: [] },
  console: { projects: [
    { id: 'project_a', workspaceId: 'workspace_a', name: 'A', workspaceRole: 'owner' },
    { id: 'project_member', workspaceId: 'workspace_a', name: 'Member', workspaceRole: 'member' },
  ] },
};
const site = (overrides: Record<string, unknown> = {}) => ({ workspace_id: 'workspace_a', project_id: 'project_a', slug: 'docs', url: 'https://docs.example.test/', current_version: 2, version_url: 'https://v2.docs.example.test/', created_at_unix: 1_800_000_000, file_count: 2, total_bytes: 32, server_key: 'discard-me', ...overrides });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

function jwt(projectId: string): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'HS256' })}.${encode({ aud: projectId, exp: now + 300, iat: now })}.fixture-signature`;
}

function sitesFetch(upstream: Response) {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).endsWith('/management-token')
    ? json({ access_token: jwt('project_a'), token_type: 'Bearer', expires_in: 300 })
    : upstream);
}

describe('project Sites control plane', () => {
  it('exchanges the live W-ID bearer, then reads only the exact project projection', async () => {
    const request = sitesFetch(json({ sites: [site()] }));
    const result = await loadProjectSites(context, 'project_a', 'wid-access-fixture', request);
    expect(result).toEqual({ status: 'ready', data: { sites: [{ workspaceId: 'workspace_a', projectId: 'project_a', slug: 'docs', url: 'https://docs.example.test/', currentVersion: 2, versionUrl: 'https://v2.docs.example.test/', createdAt: 1_800_000_000, fileCount: 2, totalBytes: 32 }] } });
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/api/workspaces/workspace_a/projects/project_a/management-token',
      '/api/project-sites/api/v1/projects/project_a/sites',
    ]);
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer wid-access-fixture');
    expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${jwt('project_a')}`);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    expect(JSON.stringify(result)).not.toContain('server_key');
  });

  it('denies nonmanagers, foreign projects, and missing bearer before any request', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(loadProjectSites(context, 'project_member', 'user-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectSites(context, 'project_missing', 'user-token', request)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectSites(context, 'project_a', null, request)).resolves.toEqual({ status: 'auth' });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects tenant-mismatched sites, wrong-audience management tokens, and unsafe preview links', async () => {
    await expect(loadProjectSites(context, 'project_a', 'user-token', sitesFetch(json({ sites: [site({ workspace_id: 'workspace_b' })] })))).resolves.toEqual({ status: 'invalid' });
    const wrongAudience = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: jwt('project_member'), token_type: 'Bearer', expires_in: 300 }));
    await expect(loadProjectSites(context, 'project_a', 'user-token', wrongAudience)).resolves.toEqual({ status: 'invalid' });
    expect(wrongAudience).toHaveBeenCalledOnce();
    await expect(previewProjectSiteVersion(context, 'project_a', 'docs', 2, 'user-token', sitesFetch(json({ slug: 'docs', version: 2, url: 'javascript:alert(1)' })))).resolves.toEqual({ status: 'invalid' });
    await expect(loadProjectSites(context, 'project_a', 'user-token', sitesFetch(json({ sites: [site({ url: 'https://user:pass@docs.example.test/' })] })))).resolves.toEqual({ status: 'invalid' });
  });

  it('creates and updates bounded base64 file sets with exact project-token and request shapes', async () => {
    const file = [{ path: 'index.html', content: 'PGgxPkhlbGxvPC9oMT4=', encoding: 'base64' as const }];
    const create = sitesFetch(json(site(), 201));
    const created = await createProjectSite(context, 'project_a', file, 'live-access', create, undefined, 'docs');
    expect(created).toMatchObject({ status: 'ready', data: { slug: 'docs' } });
    expect(create.mock.calls[1]?.[0]).toBe('/api/project-sites/api/v1/projects/project_a/sites');
    expect(JSON.parse(String(create.mock.calls[1]?.[1]?.body))).toEqual({ slug: 'docs', files: file });
    expect(new Headers(create.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(`Bearer ${jwt('project_a')}`);
    const deploy = sitesFetch(json(site({ current_version: 3 })));
    await expect(deployProjectSiteFiles(context, 'project_a', 'docs', file, 'live-access', deploy)).resolves.toMatchObject({ status: 'ready', data: { currentVersion: 3 } });
    expect(deploy.mock.calls[1]?.[0]).toBe('/api/project-sites/api/v1/projects/project_a/sites/docs/deployments');
    expect(deploy.mock.calls[1]?.[1]?.method).toBe('POST');
    const unsafePath = vi.fn<typeof fetch>();
    await expect(createProjectSite(context, 'project_a', [{ ...file[0]!, path: '../secrets.txt' }], 'live-access', unsafePath)).resolves.toEqual({ status: 'invalid' });
    expect(unsafePath).not.toHaveBeenCalled();
  });

  it('rejects publication receipts for a different site in the same project', async () => {
    const files = [{ path: 'index.html', content: 'aGk=', encoding: 'base64' as const }];
    const wrongSite = () => sitesFetch(json(site({ slug: 'another-site' })));
    await expect(deployProjectSiteFiles(context, 'project_a', 'docs', files, 'access', wrongSite())).resolves.toEqual({ status: 'invalid' });
    await expect(changeProjectSiteVersion(context, 'project_a', 'docs', 1, 'rollback', 'access', wrongSite())).resolves.toEqual({ status: 'invalid' });
    await expect(createProjectSite(context, 'project_a', files, 'access', wrongSite())).resolves.toMatchObject({ status: 'ready', data: { slug: 'another-site' } });
  });

  it('accepts the actual allocated site slug when a preferred new-site slug is taken', async () => {
    const files = [{ path: 'index.html', content: 'aGk=', encoding: 'base64' as const }];
    const request = sitesFetch(json(site({ slug: 'docs-2', url: 'https://docs-2.example.test/', version_url: 'https://v2.docs-2.example.test/' }), 201));
    await expect(createProjectSite(context, 'project_a', files, 'access', request, undefined, 'docs')).resolves.toMatchObject({ status: 'ready', data: { slug: 'docs-2', versionUrl: 'https://v2.docs-2.example.test/' } });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).slug).toBe('docs');
  });

  it('does not start reads or writes after a cancelled management-token exchange', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return json({ access_token: jwt('project_a'), token_type: 'Bearer', expires_in: 300 });
    });
    await expect(changeProjectSiteVersion(context, 'project_a', 'docs', 1, 'promote', 'access', request, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledOnce();
    const alreadyAborted = vi.fn<typeof fetch>();
    await expect(loadProjectSites(context, 'project_a', 'access', alreadyAborted, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(alreadyAborted).not.toHaveBeenCalled();
  });

  it('accepts exactly the per-file byte ceiling and rejects one byte over it', async () => {
    const encodeByteLength = (byteLength: number) => {
      const groups = Math.floor(byteLength / 3);
      const remainder = byteLength % 3;
      return 'A'.repeat(groups * 4) + (remainder === 1 ? 'AQ==' : remainder === 2 ? 'AQI=' : '');
    };
    const exactLimit = [{ path: 'large.bin', content: encodeByteLength(PROJECT_SITE_FILE_LIMIT), encoding: 'base64' as const }];
    const accepted = sitesFetch(json(site()));
    await expect(createProjectSite(context, 'project_a', exactLimit, 'access', accepted)).resolves.toMatchObject({ status: 'ready' });
    const overLimit = [{ path: 'large.bin', content: encodeByteLength(PROJECT_SITE_FILE_LIMIT + 1), encoding: 'base64' as const }];
    const rejected = vi.fn<typeof fetch>();
    await expect(createProjectSite(context, 'project_a', overLimit, 'access', rejected)).resolves.toEqual({ status: 'invalid' });
    expect(rejected).not.toHaveBeenCalled();
  });

  it('projects version metadata only and covers preview, promote and rollback endpoints', async () => {
    const versions = await loadProjectSiteVersions(context, 'project_a', 'docs', 'access', sitesFetch(json({ versions: [{ version: 2, created_at_unix: 10, file_count: 1, total_bytes: 9, actor: 'private-user', files: [{ path: 'index.html', size: 9 }], version_url: 'http://unsafe.example/', manifest_secret: 'drop' }] })));
    expect(versions).toEqual({ status: 'ready', data: { versions: [{ version: 2, createdAt: 10, fileCount: 1, totalBytes: 9, files: [{ path: 'index.html', size: 9 }] }] } });
    expect(JSON.stringify(versions)).not.toMatch(/private-user|manifest_secret|drop/);
    const preview = sitesFetch(json({ slug: 'docs', version: 1, url: 'https://v1.docs.example.test/' }));
    await expect(previewProjectSiteVersion(context, 'project_a', 'docs', 1, 'access', preview)).resolves.toEqual({ status: 'ready', data: { slug: 'docs', version: 1, url: 'https://v1.docs.example.test/' } });
    expect(preview.mock.calls[1]?.[0]).toBe('/api/project-sites/api/v1/projects/project_a/sites/docs/preview/1');
    for (const action of ['promote', 'rollback'] as const) {
      const mutation = sitesFetch(json(site()));
      await expect(changeProjectSiteVersion(context, 'project_a', 'docs', 1, action, 'access', mutation)).resolves.toMatchObject({ status: 'ready' });
      expect(mutation.mock.calls[1]?.[0]).toBe(`/api/project-sites/api/v1/projects/project_a/sites/docs/${action}`);
      expect(JSON.parse(String(mutation.mock.calls[1]?.[1]?.body))).toEqual({ version: 1 });
    }
  });

  it('supports safe custom-domain add/list/verify/remove projections', async () => {
    const domain = { domain: 'www.example.test', url: 'https://www.example.test/', verified: false, verified_at_unix: null, last_checked_at_unix: 1, txt_name: '_w-drop.www.example.test', txt_value: 'fixture-proof', cname_target: 'sites.example.test', ipv4_target: null, internal_token: 'drop' };
    const add = sitesFetch(json(domain, 201));
    await expect(addProjectSiteDomain(context, 'project_a', 'docs', 'WWW.Example.Test', 'access', add)).resolves.toMatchObject({ status: 'ready', data: { domain: 'www.example.test', verified: false } });
    expect(JSON.parse(String(add.mock.calls[1]?.[1]?.body))).toEqual({ domain: 'www.example.test' });
    const domains = await loadProjectSiteDomains(context, 'project_a', 'docs', 'access', sitesFetch(json({ domains: [domain] })));
    expect(domains.status).toBe('ready');
    expect(JSON.stringify(domains)).not.toContain('internal_token');
    const verify = sitesFetch(json({ ...domain, verified: true, verified_at_unix: 11 }));
    await expect(verifyProjectSiteDomain(context, 'project_a', 'docs', 'www.example.test', 'access', verify)).resolves.toMatchObject({ status: 'ready', data: { verified: true, verifiedAt: 11 } });
    expect(verify.mock.calls[1]?.[0]).toBe('/api/project-sites/api/v1/projects/project_a/sites/docs/domains/www.example.test/verify');
    const remove = sitesFetch(json({ deleted: true }));
    await expect(deleteProjectSiteDomain(context, 'project_a', 'docs', 'www.example.test', 'access', remove)).resolves.toEqual({ status: 'ready', data: { deleted: true } });
    expect(remove.mock.calls[1]?.[1]?.method).toBe('DELETE');
  });

  it('exports exact custom-domain TXT and one fully qualified routing record', () => {
    const domain = { domain: 'WWW.Example.Test', url: 'https://www.example.test/', verified: false, txtName: '_opendrop-challenge.WWW.Example.Test', txtValue: 'opendrop-verification=fixture-proof', cnameTarget: 'Sites.Example.Test', ipv4Target: '192.0.2.5' };
    expect(serializeProjectSiteDns(domain, 'CNAME')).toBe('; W-Drop custom domain DNS records\n_opendrop-challenge.www.example.test. 300 IN TXT "opendrop-verification=fixture-proof"\nwww.example.test. 300 IN CNAME sites.example.test.\n');
    const ipv4 = serializeProjectSiteDns({ ...domain, verified: true }, 'A');
    expect(ipv4).toContain('www.example.test. 300 IN A 192.0.2.5\n');
    expect(ipv4).not.toContain('CNAME');
    expect(serializeProjectSiteDns({ ...domain, ipv4Target: null }, 'A')).toBeNull();
  });

  it('keeps DNS metacharacters inside bounded TXT strings and refuses unsafe owners or targets', () => {
    const domain = { domain: 'www.example.test', url: 'https://www.example.test/', verified: false, txtName: '_proof.www.example.test', txtValue: 'proof="value"\\path;\n雪', cnameTarget: 'sites.example.test', ipv4Target: '192.0.2.5' };
    expect(serializeProjectSiteDns(domain, 'CNAME')).toContain('300 IN TXT "proof=\\"value\\"\\\\path;\\010\\233\\155\\170"\n');
    expect(serializeProjectSiteDns({ ...domain, txtValue: 'x'.repeat(256) }, 'CNAME')).toContain(`TXT "${'x'.repeat(255)}" "x"\n`);
    expect(serializeProjectSiteDns({ ...domain, txtValue: '雪'.repeat(86) }, 'CNAME')).toContain(`TXT "${'\\233\\155\\170'.repeat(85)}" "\\233\\155\\170"\n`);
    for (const invalid of [{ domain: 'www.example.test;evil' }, { txtName: '_proof.other.test' }, { txtName: '_proof.www.example.test\nextra' }, { txtValue: '' }, { txtValue: 'a'.repeat(301) }, { cnameTarget: 'sites.example.test;evil' }, { cnameTarget: 'https://sites.example.test/' }]) expect(serializeProjectSiteDns({ ...domain, ...invalid }, 'CNAME')).toBeNull();
    for (const ipv4Target of ['256.0.2.5', '192.00.2.5', '192.0.2.5\nextra', '::1']) expect(serializeProjectSiteDns({ ...domain, ipv4Target }, 'A')).toBeNull();
    expect(serializeProjectSiteDns(domain, 'MX' as never)).toBeNull();
  });

  it('surfaces auth failures and site deletion without response-body leakage', async () => {
    const denied = sitesFetch(new Response('private provider error', { status: 403 }));
    await expect(loadProjectSites(context, 'project_a', 'access', denied)).resolves.toEqual({ status: 'forbidden' });
    await expect(loadProjectSites(context, 'project_a', 'access', sitesFetch(new Response('archived', { status: 423 })))).resolves.toEqual({ status: 'locked' });
    const remove = sitesFetch(json({ slug: 'docs', deleted: true }));
    await expect(deleteProjectSite(context, 'project_a', 'docs', 'access', remove)).resolves.toEqual({ status: 'ready', data: { deleted: true } });
    expect(remove.mock.calls[1]?.[1]?.method).toBe('DELETE');
  });
});
