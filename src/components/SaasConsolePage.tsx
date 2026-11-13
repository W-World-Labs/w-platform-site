import { useEffect, useRef, useState, type ComponentType } from 'react';
import { getAccessToken, login } from '../lib/auth';
import {
  issueProjectPublishableKey,
  issueProjectConsoleReadKey,
  issueProjectFunctionsConsoleKey,
  issueProjectRealtimeConsoleKey,
  loadProjectConsoleData,
  loadProjectDatabaseCatalog,
  loadProjectDatabaseBackups,
  loadProjectTableRows,
  mutateProjectTableRow,
  parseProjectRowValues,
  loadProjectConnect,
  loadProjectObservability,
  listMemberProjects,
  listUsedApps,
  loadSaasContext,
  radarProjectUrl,
  revokeProjectPublishableKey,
  rotateProjectPublishableKey,
  undiscoveredProjectCapabilities,
  type DiscoveryFailure,
  type ProjectCapability,
  type PublishableKeyMetadata,
  type ProjectConsoleData,
  type ProjectPanelState,
  type ProjectObservability,
  type ProjectDatabaseBackups,
  type ProjectTableRows,
  type SaasContext,
  loadUnifiedManagement,
  type UnifiedManagementData,
} from '../lib/saasConsole';
import { dict, localizedHref, type Lang } from '../i18n';
import { ProjectStorageConsole } from './ProjectStorageConsole';
import { ProjectAuthConsole } from './ProjectAuthConsole';
import { ProjectDatabaseConsole } from './ProjectDatabaseConsole';
import { ProjectFunctionsConsole } from './ProjectFunctionsConsole';
import type { ProjectRealtimeConsoleProps } from './ProjectRealtimeConsole';
import { WorkspaceLifecycleConsole } from './WorkspaceLifecycleConsole';
import { ProjectObservabilityConsole } from './ProjectObservabilityConsole';
import { ProjectBackupsConsole } from './ProjectBackupsConsole';
import { ProjectConnectConsole } from './ProjectConnectConsole';
import { ProjectSitesConsole } from './ProjectSitesConsole';
import type { ProjectConsoleSurface } from '../routes';
import { findProjectConsoleTasks, PROJECT_CONSOLE_TASKS } from '../lib/projectConsoleNavigation';

type ConsoleView = 'overview' | 'projects' | 'apps' | 'platform';
type RowMutationEditor =
  | { operation: 'insert'; draft: string }
  | { operation: 'update'; row: Record<string, unknown>; draft: string }
  | { operation: 'delete'; row: Record<string, unknown> };
type RowMutationStatus = 'idle' | 'loading' | 'done' | 'invalid' | 'stale' | 'unsupported' | 'error';

export function SaasConsolePage({ lang, projectId, projectSurface = 'overview', realtimeConsole: RealtimeConsole }: { lang: Lang; projectId?: string; projectSurface?: ProjectConsoleSurface; realtimeConsole?: ComponentType<ProjectRealtimeConsoleProps> }) {
  const t = dict(lang);
  const [context, setContext] = useState<SaasContext | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [view, setView] = useState<ConsoleView>(projectId ? 'projects' : 'overview');
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectPage, setProjectPage] = useState(1);
  const [appQuery, setAppQuery] = useState('');
  const [appPage, setAppPage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [discoveryFailure, setDiscoveryFailure] = useState<DiscoveryFailure | null>(null);
  const [discoveredCapabilities, setDiscoveredCapabilities] = useState<ProjectCapability[]>([]);
  const [projectUrl, setProjectUrl] = useState('');
  const [publishableKeys, setPublishableKeys] = useState<PublishableKeyMetadata[]>([]);
  const [oneTimeKey, setOneTimeKey] = useState('');
  const [consoleReadKey, setConsoleReadKey] = useState('');
  const [consoleReadKeyId, setConsoleReadKeyId] = useState('');
  const [keyActionStatus, setKeyActionStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [projectData, setProjectData] = useState<ProjectConsoleData | null>(null);
  const [tableRows, setTableRows] = useState<ProjectPanelState<ProjectTableRows> | null>(null);
  const [rowMutationEditor, setRowMutationEditor] = useState<RowMutationEditor | null>(null);
  const [rowMutationStatus, setRowMutationStatus] = useState<RowMutationStatus>('idle');
  const [managementData, setManagementData] = useState<ProjectPanelState<UnifiedManagementData> | null>(null);
  const [databaseBackups, setDatabaseBackups] = useState<ProjectPanelState<ProjectDatabaseBackups> | null>(null);
  const [observability, setObservability] = useState<ProjectPanelState<ProjectObservability> | null>(null);
  const consoleKeyGeneration = useRef(0);

  useEffect(() => () => { consoleKeyGeneration.current += 1; }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSaasContext(getAccessToken, fetch, controller.signal)
      .then((result) => {
        if (result.status === 'ready') setContext(result.context);
        setStatus(result.status);
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const selectedProject = context?.console.projects.find((project) => project.id === selectedProjectId);
  useEffect(() => {
    if (!context || !selectedProject) return;
    let active = true;
    void getAccessToken().then((token) => loadProjectConnect(context, selectedProject.id, token, fetch)).then((result) => {
      if (!active) return;
      if (result.status === 'ready') {
        const reconnectableKey = (result.publishableKeys || []).find((key) => key.publishableKey && !key.requiresRotation && key.allowedOrigins.includes(window.location.origin));
        setDiscoveredCapabilities(result.capabilities);
        setProjectUrl(result.projectUrl || '');
        setPublishableKeys((result.publishableKeys || []).filter((key) => key.revokedAt == null));
        setConsoleReadKey(projectSurface === 'functions' || projectSurface === 'realtime' ? '' : reconnectableKey?.publishableKey || '');
        setConsoleReadKeyId(projectSurface === 'functions' || projectSurface === 'realtime' ? '' : reconnectableKey?.id || '');
        setDiscoveryStatus('ready');
      } else {
        setDiscoveredCapabilities([]);
        setDiscoveryFailure(result.reason);
        setDiscoveryStatus('error');
      }
    });
    return () => { active = false; };
  }, [context, selectedProject, projectSurface]);

  useEffect(() => {
    if (!context || !selectedProject) return;
    if (projectSurface === 'functions' || projectSurface === 'realtime') { queueMicrotask(() => setProjectData(null)); return; }
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => { if (active) setProjectData(null); });
    void getAccessToken()
      .then(async (token) => projectSurface === 'database'
        ? { auth: { status: 'locked' as const }, database: await loadProjectDatabaseCatalog(context, selectedProject.id, consoleReadKey, token, fetch, controller.signal), storage: { status: 'locked' as const } }
        : loadProjectConsoleData(context, selectedProject.id, consoleReadKey, token, fetch, controller.signal))
      .then((result) => { if (active) setProjectData(result); });
    return () => { active = false; controller.abort(); };
  }, [context, selectedProject, consoleReadKey, projectSurface]);

  useEffect(() => {
    if (!context || !selectedProject || !consoleReadKey) { queueMicrotask(() => setManagementData(null)); return; }
    let active = true; const controller = new AbortController();
    void getAccessToken().then((token) => loadUnifiedManagement(context, selectedProject.id, consoleReadKey, token, fetch, controller.signal)).then((result) => { if (active) setManagementData(result); });
    return () => { active = false; controller.abort(); };
  }, [context, selectedProject, consoleReadKey]);

  useEffect(() => {
    if (!context || !selectedProject || !consoleReadKey) { queueMicrotask(() => setDatabaseBackups(null)); return; }
    let active = true; const controller = new AbortController();
    void getAccessToken().then((token) => loadProjectDatabaseBackups(context, selectedProject.id, consoleReadKey, token, fetch, controller.signal)).then((result) => { if (active) setDatabaseBackups(result); });
    return () => { active = false; controller.abort(); };
  }, [context, selectedProject, consoleReadKey]);

  useEffect(() => {
    if (!context || !selectedProject?.radarProjectId) { queueMicrotask(() => setObservability(null)); return; }
    let active = true; const controller = new AbortController(); queueMicrotask(() => setObservability(null));
    void getAccessToken().then((token) => loadProjectObservability(context, selectedProject.id, token, fetch, controller.signal)).then((result) => { if (active) setObservability(result); });
    return () => { active = false; controller.abort(); };
  }, [context, selectedProject]);

  if (status !== 'ready' || !context) {
    return (
      <div className="console-message">
        <h1>{t.console.title}</h1>
        <p>{status === 'loading' ? t.console.loading : status === 'auth' ? t.console.authRequired : t.console.loadFailed}</p>
        {status !== 'loading' && <button className="site-nav-button" onClick={() => void login()}>{t.console.authenticate}</button>}
      </div>
    );
  }

  const { platformRole, workspaceMemberships, appUserRelationships } = context.authorityPlanes;
  const projects = context.console.projects;
  const isPlatformAdmin = platformRole === 'super_admin' || platformRole === 'admin';
  const projectResult = listMemberProjects(projects, workspaceMemberships, workspaceFilter, projectQuery, projectPage);
  const appResult = listUsedApps(appUserRelationships, appQuery, appPage);
  const capabilities = discoveryStatus === 'ready' ? discoveredCapabilities : undiscoveredProjectCapabilities();

  if (projectId && projectSurface === 'auth') {
    return <div className="console-shell">
      <header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header>
      <ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} />
      <ProjectAuthConsole lang={lang} context={context} projectId={projectId} />
    </div>;
  }

  const clearDiscovery = () => {
    consoleKeyGeneration.current += 1;
    setDiscoveredCapabilities([]);
    setProjectUrl('');
    setPublishableKeys([]);
    setOneTimeKey('');
    setConsoleReadKey('');
    setConsoleReadKeyId('');
    setKeyActionStatus('idle');
    setProjectData(null);
    setTableRows(null);
    setRowMutationEditor(null);
    setRowMutationStatus('idle');
    setDatabaseBackups(null);
    setDiscoveryFailure(null);
    setDiscoveryStatus('idle');
  };
  const selectView = (nextView: ConsoleView) => {
    if (nextView !== 'projects') {
      setSelectedProjectId('');
      clearDiscovery();
    }
    setView(nextView);
  };
  const canManageKeys = selectedProject?.workspaceRole === 'owner' || selectedProject?.workspaceRole === 'admin';
  const issueKey = async () => {
    if (!selectedProject || !canManageKeys) return;
    setKeyActionStatus('loading');
    const result = await issueProjectPublishableKey(context, selectedProject.id, await getAccessToken(), window.location.origin, fetch);
    if (result.status === 'ready' && result.oneTimeKey && result.metadata) {
      setPublishableKeys((keys) => [result.metadata!, ...keys]);
      setOneTimeKey(result.oneTimeKey);
      setConsoleReadKey(result.oneTimeKey);
      setConsoleReadKeyId(result.metadata.id);
      setKeyActionStatus('idle');
    } else {
      setKeyActionStatus('error');
    }
  };
  const rotateKey = async (key: PublishableKeyMetadata) => {
    if (!selectedProject || !canManageKeys) return;
    setKeyActionStatus('loading');
    const result = await rotateProjectPublishableKey(context, selectedProject.id, key.id, await getAccessToken(), fetch);
    if (result.status === 'ready' && result.oneTimeKey && result.metadata) {
      setPublishableKeys((keys) => [result.metadata!, ...keys.filter((item) => item.id !== key.id)]);
      setOneTimeKey(result.oneTimeKey);
      setConsoleReadKey(result.oneTimeKey);
      setConsoleReadKeyId(result.metadata.id);
      setKeyActionStatus('idle');
    } else {
      setKeyActionStatus('error');
    }
  };
  const revokeKey = async (key: PublishableKeyMetadata) => {
    if (!selectedProject || !canManageKeys) return;
    setKeyActionStatus('loading');
    const result = await revokeProjectPublishableKey(context, selectedProject.id, key.id, await getAccessToken(), fetch);
    if (result.status === 'ready') {
      setPublishableKeys((keys) => keys.filter((item) => item.id !== key.id));
      setOneTimeKey('');
      setKeyActionStatus('idle');
    } else {
      setKeyActionStatus('error');
    }
  };
  const unlockProjectData = async () => {
    if (!selectedProject || !canManageKeys) return;
    const projectAtStart = selectedProject;
    const generation = ++consoleKeyGeneration.current;
    setKeyActionStatus('loading');
    const token = await getAccessToken();
    const result = await issueProjectConsoleReadKey(context, projectAtStart.id, token, window.location.origin, fetch);
    if (result.status === 'ready' && result.oneTimeKey && result.metadata) {
      if (generation !== consoleKeyGeneration.current || selectedProjectId !== projectAtStart.id) {
        await revokeProjectPublishableKey(context, projectAtStart.id, result.metadata.id, token, fetch);
        return;
      }
      setConsoleReadKey(result.oneTimeKey);
      setConsoleReadKeyId(result.metadata.id);
      setKeyActionStatus('idle');
    } else {
      setKeyActionStatus('error');
    }
  };
  const unlockProjectFunctions = async (allowDataRead = false) => {
    if (!selectedProject || !canManageKeys) throw new Error('functions_unlock_forbidden');
    const projectAtStart = selectedProject; const generation = ++consoleKeyGeneration.current; setKeyActionStatus('loading'); const token = await getAccessToken();
    if (generation !== consoleKeyGeneration.current) return;
    const result = await issueProjectFunctionsConsoleKey(context, projectAtStart.id, token, window.location.origin, fetch, allowDataRead);
    if (result.status === 'ready' && result.oneTimeKey && result.metadata) {
      if (generation !== consoleKeyGeneration.current || selectedProjectId !== projectAtStart.id) { await revokeProjectPublishableKey(context, projectAtStart.id, result.metadata.id, token, fetch); return; }
      setConsoleReadKey(result.oneTimeKey); setConsoleReadKeyId(result.metadata.id); setKeyActionStatus('idle');
    } else { setKeyActionStatus('error'); throw new Error('functions_unlock_failed'); }
  };
  const unlockProjectRealtime = async () => {
    if (!selectedProject || !canManageKeys) return;
    const projectAtStart = selectedProject; const generation = ++consoleKeyGeneration.current; setKeyActionStatus('loading'); const token = await getAccessToken();
    const result = await issueProjectRealtimeConsoleKey(context, projectAtStart.id, token, window.location.origin, fetch);
    if (result.status === 'ready' && result.oneTimeKey && result.metadata) {
      if (generation !== consoleKeyGeneration.current || selectedProjectId !== projectAtStart.id) { await revokeProjectPublishableKey(context, projectAtStart.id, result.metadata.id, token, fetch); return; }
      setConsoleReadKey(result.oneTimeKey); setConsoleReadKeyId(result.metadata.id); setKeyActionStatus('idle');
    } else setKeyActionStatus('error');
  };
  const lockProjectData = async () => {
    if (!selectedProject || !consoleReadKeyId) return;
    const keyId = consoleReadKeyId;
    const result = await revokeProjectPublishableKey(context, selectedProject.id, keyId, await getAccessToken(), fetch);
    if (result.status === 'ready') {
      consoleKeyGeneration.current += 1;
      setConsoleReadKey('');
      setConsoleReadKeyId('');
      setTableRows(null);
      setRowMutationEditor(null);
      setRowMutationStatus('idle');
      setKeyActionStatus('idle');
    } else {
      setKeyActionStatus('error');
    }
  };
  const browseTable = async (schema: string, table: string) => {
    if (!selectedProject || !consoleReadKey) return;
    const generation = consoleKeyGeneration.current;
    setTableRows(null);
    setRowMutationEditor(null);
    setRowMutationStatus('idle');
    const result = await loadProjectTableRows(context, selectedProject.id, schema, table, consoleReadKey, await getAccessToken(), fetch);
    if (generation === consoleKeyGeneration.current) setTableRows(result);
  };
  const reloadTableRows = async () => {
    if (tableRows?.status !== 'ready') return;
    await browseTable(tableRows.data.schema, tableRows.data.table);
  };
  const beginRowEdit = (row: Record<string, unknown>) => {
    const editable = Object.fromEntries(Object.entries(row).filter(([name]) => !['id', 'user_id', 'owner_id'].includes(name)));
    setRowMutationEditor({ operation: 'update', row, draft: JSON.stringify(editable, null, 2) });
    setRowMutationStatus('idle');
  };
  const rowId = (row: Record<string, unknown>): string | null => {
    const value = row.id;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  };
  const expectedSnapshot = (row: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(row).slice(0, 8));
  const commitRowMutation = async () => {
    if (!selectedProject || !consoleReadKey || tableRows?.status !== 'ready' || !rowMutationEditor) return;
    const editor = rowMutationEditor;
    const values = editor.operation === 'delete' ? null : parseProjectRowValues(editor.draft);
    const id = editor.operation === 'insert' ? null : rowId(editor.row);
    if ((editor.operation !== 'delete' && !values) || (editor.operation !== 'insert' && !id)) {
      setRowMutationStatus('invalid');
      return;
    }
    setRowMutationStatus('loading');
    const mutation = editor.operation === 'insert'
      ? { operation: 'insert' as const, values: values! }
      : editor.operation === 'update'
        ? { operation: 'update' as const, id: id!, expected: expectedSnapshot(editor.row), values: values! }
        : { operation: 'delete' as const, id: id!, expected: expectedSnapshot(editor.row) };
    const result = await mutateProjectTableRow(
      context,
      selectedProject.id,
      tableRows.data.schema,
      tableRows.data.table,
      consoleReadKey,
      await getAccessToken(),
      mutation,
      fetch,
    );
    if (result.status === 'ready') {
      setRowMutationEditor(null);
      await reloadTableRows();
      setRowMutationStatus('done');
      return;
    }
    setRowMutationStatus(result.status === 'stale' ? 'stale' : result.status === 'unsupported' ? 'unsupported' : result.status === 'invalid' ? 'invalid' : 'error');
  };
  if (projectId && projectSurface === 'database') {
    return <div className="console-shell">
      <header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header>
      <ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} />
      <ProjectDatabaseConsole lang={lang} context={context} projectId={projectId} publishableKey={consoleReadKey} database={projectData?.database || null} unlock={unlockProjectData} refreshCatalog={async signal => {
        const token = await getAccessToken(); signal.throwIfAborted();
        const catalog = await loadProjectDatabaseCatalog(context, projectId, consoleReadKey, token, fetch, signal); signal.throwIfAborted();
        if (catalog?.status !== 'ready') throw new Error('Catalog refresh failed');
        setProjectData(current => current ? { ...current, database: catalog } : { auth: { status: 'locked' }, database: catalog, storage: { status: 'locked' } });
      }} />
    </div>;
  }
  if (projectId && projectSurface === 'connect') {
    return <div className="console-shell"><header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header><ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} /><ProjectConnectConsole lang={lang} context={context} projectId={projectId} /></div>;
  }
  if (projectId && projectSurface === 'backups') {
    return <div className="console-shell"><header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header><ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} /><ProjectBackupsConsole lang={lang} context={context} projectId={projectId} publishableKey={consoleReadKey} unlock={unlockProjectData} /></div>;
  }
  if (projectId && projectSurface === 'functions') {
    return <div className="console-shell">
      <header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header>
      <ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} />
      <ProjectFunctionsConsole key={`${context.self.userId}:${projectId}:${consoleReadKeyId}`} lang={lang} context={context} projectId={projectId} publishableKey={consoleReadKey} unlock={unlockProjectFunctions} />
    </div>;
  }
  if (projectId && projectSurface === 'realtime' && RealtimeConsole) {
    return <div className="console-shell">
      <header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header>
      <ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} />
      <RealtimeConsole lang={lang} context={context} projectId={projectId} publishableKey={consoleReadKey} unlock={unlockProjectRealtime} />
    </div>;
  }
  if (projectId && projectSurface === 'observability') {
    return <div className="console-shell"><header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header><ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} /><ProjectObservabilityConsole lang={lang} context={context} projectId={projectId} /></div>;
  }
  if (projectId && projectSurface === 'sites') {
    return <div className="console-shell"><header className="console-hero"><div className="console-eyebrow">{t.console.eyebrow}</div><h1>{selectedProject?.name || projectId}</h1><p>{t.console.subtitle}</p></header><ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} /><ProjectSitesConsole key={`${context.self.userId}:${selectedProjectId}`} lang={lang} context={context} projectId={projectId} getAccessToken={getAccessToken} /></div>;
  }
  const tabs: Array<{ id: ConsoleView; label: string }> = [
    { id: 'overview', label: t.console.overviewTab },
    { id: 'projects', label: t.console.projectsTab },
    { id: 'apps', label: t.console.appsTab },
    ...(isPlatformAdmin ? [{ id: 'platform' as const, label: t.console.platformTab }] : []),
  ];

  return (
    <div className="console-shell">
      <header className="console-hero">
        <div className="console-eyebrow">{t.console.eyebrow}</div>
        <h1>{t.console.title}</h1>
        <p>{t.console.subtitle}</p>
      </header>

      {projectId && <ProjectConsoleNavigation lang={lang} projectId={projectId} current={projectSurface} />}

      <nav className="console-tabs" aria-label={t.console.viewNavigation}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="console-tab"
            aria-current={view === tab.id ? 'page' : undefined}
            onClick={() => selectView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === 'overview' && (
        <section className="console-view" aria-labelledby="console-overview-title">
          <h2 id="console-overview-title">{t.console.overviewTitle}</h2>
          <p className="console-note">{t.console.overviewNote}</p>
          <div className="console-stats">
            <button type="button" className="console-stat" onClick={() => selectView('projects')}>
              <strong>{workspaceMemberships.length}</strong><span>{t.console.workspacesCount}</span>
            </button>
            <button type="button" className="console-stat" onClick={() => selectView('projects')}>
              <strong>{projects.length}</strong><span>{t.console.projectsCount}</span>
            </button>
            <button type="button" className="console-stat" onClick={() => selectView('apps')}>
              <strong>{appUserRelationships.length}</strong><span>{t.console.appsCount}</span>
            </button>
          </div>
          <div className="console-boundary-note">{t.console.authorityBoundary}</div>
        </section>
      )}

      {view === 'projects' && (
        <section className="console-view" aria-labelledby="console-projects-title">
          <h2 id="console-projects-title">{t.console.builderPlane}</h2>
          <p className="console-note">{t.console.builderPlaneNote}</p>
          <WorkspaceLifecycleConsole lang={lang} context={context} />
          {projects.length === 0 ? <p className="console-empty">{t.console.noCapabilityProject}</p> : (
            <>
              <div className="console-filters">
                <label>
                  <span>{t.console.workspaceFilter}</span>
                  <select value={workspaceFilter} onChange={(event) => { setWorkspaceFilter(event.target.value); setProjectPage(1); }}>
                    <option value="">{t.console.allWorkspaces}</option>
                    {workspaceMemberships.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t.console.searchProjects}</span>
                  <input type="search" value={projectQuery} onChange={(event) => { setProjectQuery(event.target.value); setProjectPage(1); }} placeholder={t.console.searchProjectsPlaceholder} />
                </label>
              </div>
              <p className="console-result-count">{projectResult.total} {t.console.projectsCount}</p>
              {projectResult.items.length === 0 ? <p className="console-empty">{t.console.noProjectResults}</p> : (
                <div className="console-list">
                  {projectResult.items.map((project) => (
                    <article key={project.id} className="console-list-row">
                      <div className="console-list-copy">
                        <strong>{project.name}</strong>
                        <span>{project.id}</span>
                        <small>{project.workspaceName} · {project.workspaceRole}</small>
                      </div>
                      <div className="console-row-actions">
                        {radarProjectUrl(project) && <a href={radarProjectUrl(project)}>{t.console.openRadar}</a>}
                        <a className="site-nav-button" href={localizedHref(`/console/projects/${encodeURIComponent(project.id)}`, lang)}>{t.console.configureProject}</a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <Pagination page={projectResult.page} pageCount={projectResult.pageCount} previous={t.console.previousPage} next={t.console.nextPage} pageLabel={t.console.pageLabel} onPage={setProjectPage} />
            </>
          )}

          {selectedProject && (
            <div className="console-discovery" aria-labelledby="console-capabilities-title">
              <div className="console-panel-heading">
                <div><h3 id="console-capabilities-title">{t.console.capabilities}</h3><p>{selectedProject.name} · {selectedProject.id}</p></div>
                <a className="console-text-button" href={localizedHref('/console', lang)}>{t.console.closePanel}</a>
              </div>
              <p className="console-note">{t.console.capabilitiesNote}</p>
              <section className="console-key-management" aria-labelledby="console-management-planes-title">
                <h4 id="console-management-planes-title">{t.console.managementPlanes}</h4>
                <p className="console-note">{t.console.managementPlanesNote}</p>
                {!managementData ? <p role="status">{t.console.projectKeyRequired}</p> : managementData.status === 'ready' ? <div className="console-capabilities">
                  <section className="console-capability"><strong>{t.console.managementSurfaceNames.workspaceTeam}</strong><span className="is-available">{managementData.data.members} {t.console.membersLabel} · {managementData.data.invitations} {t.console.invitationsLabel}</span></section>
                  <section className="console-capability"><strong>{t.console.managementSurfaceNames.functionsManagement}</strong>{managementData.data.functionsReachable ? <><span className="is-available">{managementData.data.functions.length} {t.console.functionsLabel}</span>{managementData.data.functions.slice(0, 5).map((fn) => <small key={fn.slug}>{fn.slug} · {fn.state} · {fn.logs.length} {t.console.logsLabel}</small>)}</> : <span role="status">{t.console.edgeRouteRequired}</span>}</section>
                  <section className="console-capability"><strong>{t.console.managementSurfaceNames.storageVersions}</strong><span>{t.console.storageExplorer}</span></section>
                </div> : <p role="status">{projectPanelMessage(managementData.status, t.console)}</p>}
              </section>
              {projectUrl && <div className="console-key-note"><strong>W_PROJECT_URL</strong><span>{projectUrl}</span></div>}
              <div className="console-key-management">
                <div className="console-panel-heading">
                  <h4>{t.console.publishableKeys}</h4>
                  {canManageKeys && <button type="button" className="site-nav-button" disabled={keyActionStatus === 'loading'} onClick={() => void issueKey()}>{t.console.issuePublishableKey}</button>}
                </div>
                {publishableKeys.length === 0 ? <p className="console-empty">{t.console.noPublishableKeys}</p> : publishableKeys.map((key) => (
                  <div className="console-key-note" key={key.id}>
                    <span><strong>{key.name}</strong> · {key.keyPrefix}…</span>
                    {canManageKeys && <span className="console-row-actions">
                      <button type="button" disabled={keyActionStatus === 'loading'} onClick={() => void rotateKey(key)}>{t.console.rotateKey}</button>
                      <button type="button" disabled={keyActionStatus === 'loading'} onClick={() => void revokeKey(key)}>{t.console.revokeKey}</button>
                    </span>}
                  </div>
                ))}
                {oneTimeKey && <div className="console-boundary-note"><strong>{t.console.oneTimeKey}</strong><code>{oneTimeKey}</code><span>{t.console.oneTimeKeyWarning}</span></div>}
                {projectUrl && consoleReadKey && <div className="console-boundary-note" aria-label={t.console.connectConfiguration}>
                  <strong>{t.console.connectConfiguration}</strong>
                  <code>W_PROJECT_URL={projectUrl}</code>
                  <code>W_PUBLISHABLE_KEY={consoleReadKey}</code>
                  <span>{t.console.connectConfigurationNote}</span>
                </div>}
                {keyActionStatus === 'error' && <p role="alert" className="console-status is-error">{t.console.keyActionError}</p>}
              </div>
              <div className="console-capabilities">
                {capabilities.map((capability) => (
                  <div key={capability.name} className="console-capability">
                    <strong>{capability.name}</strong>
                    <span className={discoveryStatus === 'ready' && capability.available ? 'is-available' : ''}>{discoveryStatus === 'ready' ? capability.available ? t.console.available : t.console.unavailable : t.console.notVerified}</span>
                    {discoveryStatus === 'ready' && capability.available && capability.url && <a href={capability.url}>{t.console.openCapability} →</a>}
                  </div>
                ))}
              </div>
              <section className="console-key-management" aria-labelledby="console-observability-title">
                <h4 id="console-observability-title">{t.console.observabilityPlane}</h4><p className="console-note">{t.console.observabilityPlaneNote}</p>
                {!observability ? <p role="status">{t.console.observabilityLoading}</p> : observability.status === 'ready' ? <>
                  <div className="console-capabilities"><section className="console-capability"><strong>{t.console.runtimeHealth}</strong><span className={observability.data.healthOk ? 'is-available' : ''}>{observability.data.healthOk ? t.console.healthy : t.console.degraded} · {observability.data.signalCount}</span></section><section className="console-capability"><strong>{t.console.releasesDeployments}</strong><span>{observability.data.releases.length} · {observability.data.deployments.length}</span></section><section className="console-capability"><strong>{t.console.errorsLatencyLogs}</strong><span>{observability.data.errorCount} · {observability.data.latencyCount} · {observability.data.logTotal}</span></section></div>
                  <div className="console-row-actions">{observability.data.radarUrl && <a href={observability.data.radarUrl}>{t.console.openRadar}</a>}{observability.data.wMonitorUrl && <a href={observability.data.wMonitorUrl}>{t.console.openWMonitor}</a>}</div><p className="console-note">{t.console.wMonitorSeparate}</p>
                </> : <p role={observability.status === 'forbidden' ? 'alert' : 'status'}>{projectPanelMessage(observability.status, t.console)}</p>}
              </section>
              <section className="console-project-data" aria-labelledby="console-project-data-title">
                <div className="console-panel-heading">
                  <h4 id="console-project-data-title">{t.console.projectDataTitle}</h4>
                  {canManageKeys && (consoleReadKey
                    ? <button type="button" onClick={() => void lockProjectData()}>{t.console.lockProjectData}</button>
                    : <button type="button" className="site-nav-button" disabled={keyActionStatus === 'loading'} onClick={() => void unlockProjectData()}>{t.console.unlockProjectData}</button>)}
                </div>
                <p className="console-note">{t.console.consoleCredentialNote}</p>
                {!projectData && <p className="console-note" role="status" aria-live="polite">{t.console.projectDataLoading}</p>}
                {projectData && <div className="console-capabilities">
                  <section className="console-capability">
                    <strong>{t.console.authUsers}</strong>
                    {projectData.auth.status === 'ready' ? <>
                      <span className="is-available">{projectData.auth.data.total} {t.console.users}</span>
                      <small>{projectData.auth.data.active} {t.console.active} · {projectData.auth.data.blocked} {t.console.blocked}</small>
                      {projectData.auth.data.users.slice(0, 5).map((user) => <span key={user.userId}>{user.displayName || user.email || user.userId} · {user.appRole} · {user.status}</span>)}
                    </> : <span role="status">{projectPanelMessage(projectData.auth.status, t.console)}</span>}
                  </section>
                  <section className="console-capability">
                    <strong>{t.console.databaseExplorer}</strong>
                    {projectData.database.status === 'ready' ? <>
                      <span className="is-available">{projectData.database.data.tables.length} {t.console.tables}</span>
                      <small>{projectData.database.data.migrations.count} {t.console.migrations}</small>
                      {projectData.database.data.tables.slice(0, 5).map((table) => <button type="button" key={`${table.schema}.${table.name}`} onClick={() => void browseTable(table.schema, table.name)}>{table.schema}.{table.name} · RLS {table.rlsEnabled ? t.console.enabled : t.console.disabled}</button>)}
                    </> : <span role="status">{projectPanelMessage(projectData.database.status, t.console)}</span>}
                  </section>
                  <section className="console-capability">
                    <strong>{t.console.storageExplorer}</strong>
                    {projectData.storage.status === 'ready' ? <>
                      <span className="is-available">{projectData.storage.data.buckets.length} {t.console.buckets}</span>
                      {projectData.storage.data.buckets.slice(0, 5).map((bucket) => <span key={bucket.id}>{bucket.name} · {bucket.public ? t.console.publicBucket : t.console.privateBucket}</span>)}
                    </> : <span role="status">{projectPanelMessage(projectData.storage.status, t.console)}</span>}
                  </section>
                </div>}
                {tableRows && <section className="console-key-management" aria-labelledby="console-table-preview-title">
                  <div className="console-panel-heading">
                    <h5 id="console-table-preview-title">{t.console.tablePreview}</h5>
                    {tableRows.status === 'ready' && <button type="button" className="site-nav-button" disabled={rowMutationStatus === 'loading'} onClick={() => { setRowMutationEditor({ operation: 'insert', draft: '{}\n' }); setRowMutationStatus('idle'); }}>{t.console.addRow}</button>}
                  </div>
                  {tableRows.status === 'ready' ? <>
                    <p className="console-note">{tableRows.data.schema}.{tableRows.data.table} · {tableRows.data.rows.length} {t.console.rows}</p>
                    {tableRows.data.rows.length === 0 ? <p className="console-empty">{t.console.noRows}</p> : <ul>{tableRows.data.rows.map((row, index) => {
                      const identity = rowId(row);
                      return <li key={identity || index} className="console-table-row">
                        <code>{truncateJson(row)}</code>
                        <span className="console-row-actions">
                          <button type="button" disabled={!identity || rowMutationStatus === 'loading'} title={!identity ? t.console.rowIdentityRequired : undefined} onClick={() => beginRowEdit(row)}>{t.console.editRow}</button>
                          <button type="button" disabled={!identity || rowMutationStatus === 'loading'} title={!identity ? t.console.rowIdentityRequired : undefined} onClick={() => { setRowMutationEditor({ operation: 'delete', row }); setRowMutationStatus('idle'); }}>{t.console.deleteRow}</button>
                        </span>
                      </li>;
                    })}</ul>}
                    {rowMutationEditor?.operation !== 'delete' && rowMutationEditor && <form className="console-row-editor" onSubmit={(event) => { event.preventDefault(); void commitRowMutation(); }}>
                      <label htmlFor="console-row-json"><strong>{t.console.rowJson}</strong></label>
                      <textarea id="console-row-json" rows={10} value={rowMutationEditor.draft} disabled={rowMutationStatus === 'loading'} aria-describedby="console-row-json-help" onChange={(event) => setRowMutationEditor({ ...rowMutationEditor, draft: event.target.value })} />
                      <small id="console-row-json-help">{t.console.rowJsonHelp}</small>
                      <div className="console-row-actions">
                        <button type="submit" className="site-nav-button" disabled={rowMutationStatus === 'loading'}>{t.console.saveRow}</button>
                        <button type="button" disabled={rowMutationStatus === 'loading'} onClick={() => { setRowMutationEditor(null); setRowMutationStatus('idle'); }}>{t.console.cancelRow}</button>
                      </div>
                    </form>}
                    {rowMutationEditor?.operation === 'delete' && <div className="console-boundary-note" role="alertdialog" aria-labelledby="console-delete-row-title" aria-describedby="console-delete-row-help">
                      <strong id="console-delete-row-title">{t.console.confirmDeleteRow}</strong>
                      <span id="console-delete-row-help">{t.console.confirmDeleteRowHelp}</span>
                      <code>{truncateJson(rowMutationEditor.row)}</code>
                      <div className="console-row-actions">
                        <button type="button" className="site-nav-button" disabled={rowMutationStatus === 'loading'} onClick={() => void commitRowMutation()}>{t.console.confirmDeleteRow}</button>
                        <button type="button" disabled={rowMutationStatus === 'loading'} onClick={() => { setRowMutationEditor(null); setRowMutationStatus('idle'); }}>{t.console.cancelRow}</button>
                      </div>
                    </div>}
                    {rowMutationStatus === 'loading' && <p role="status" aria-live="polite">{t.console.rowMutationLoading}</p>}
                    {rowMutationStatus === 'done' && <p role="status" aria-live="polite">{t.console.rowMutationDone}</p>}
                    {rowMutationStatus === 'invalid' && <p role="alert" className="console-status is-error">{t.console.rowMutationInvalid}</p>}
                    {rowMutationStatus === 'stale' && <div className="console-boundary-note" role="alert"><span>{t.console.rowMutationStale}</span><button type="button" onClick={() => void reloadTableRows()}>{t.console.reloadRows}</button></div>}
                    {rowMutationStatus === 'unsupported' && <p role="alert" className="console-status is-error">{t.console.rowMutationUnsupported}</p>}
                    {rowMutationStatus === 'error' && <p role="alert" className="console-status is-error">{t.console.rowMutationFailed}</p>}
                  </> : <p role="status">{projectPanelMessage(tableRows.status, t.console)}</p>}
                </section>}
                {projectData?.storage.status === 'ready' && consoleReadKey && selectedProject && <ProjectStorageConsole key={`${context.self.userId}:${selectedProject.id}:${consoleReadKeyId}`} lang={lang} context={context} projectId={selectedProject.id} publishableKey={consoleReadKey} initialBuckets={projectData.storage.data.buckets} />}
                {databaseBackups && <section className="console-key-management" aria-labelledby="console-database-backups-title">
                  <h5 id="console-database-backups-title">{t.console.databaseBackups}</h5>
                  {databaseBackups.status === 'ready' ? <>
                    <p className="console-note">{t.console.backupBackend}: {databaseBackups.data.backendStatus} · {databaseBackups.data.backups.length} {t.console.backups}</p>
                    {databaseBackups.data.backups.length === 0 ? <p className="console-empty">{t.console.noBackups}</p> : <ul>{databaseBackups.data.backups.map((backup) => <li key={backup.backupId}>
                      <code>{backup.backupId}</code><span>{backup.format} · {backup.sizeBytes == null ? '—' : formatBytes(backup.sizeBytes)} · {backup.createdAt}</span>
                      <a className="site-nav-button" href={`${lang === 'zh' ? '/zh' : ''}/console/projects/${encodeURIComponent(selectedProject.id)}/backups`}>{t.console.databaseBackups}</a>
                    </li>)}</ul>}
                    {!databaseBackups.data.restoreSupported && <p className="console-note">{t.console.restoreUnavailable}</p>}
                  </> : <p role="status">{projectPanelMessage(databaseBackups.status, t.console)}</p>}

                </section>}
              </section>
              <p role="status" className={discoveryStatus === 'error' ? 'console-status is-error' : 'console-status'}>
                {discoveryStatus === 'ready' ? t.console.discoveryReady : discoveryStatus === 'error' && discoveryFailure ? t.console.discoveryErrors[discoveryFailure] : t.console.discoveryPrompt}
              </p>
            </div>
          )}
        </section>
      )}

      {view === 'apps' && (
        <section className="console-view" aria-labelledby="console-apps-title">
          <h2 id="console-apps-title">{t.console.endUserPlane}</h2>
          <p className="console-note">{t.console.endUserPlaneNote}</p>
          <div className="console-filters console-filters-single">
            <label><span>{t.console.searchApps}</span><input type="search" value={appQuery} onChange={(event) => { setAppQuery(event.target.value); setAppPage(1); }} placeholder={t.console.searchAppsPlaceholder} /></label>
          </div>
          <p className="console-result-count">{appResult.total} {t.console.appsCount}</p>
          {appResult.items.length === 0 ? <p className="console-empty">{appQuery ? t.console.noAppResults : t.console.noApps}</p> : (
            <div className="console-app-grid">
              {appResult.items.map((app) => {
                const body = <><strong>{app.name}</strong><span>{app.loginCount} {t.console.logins} · {app.status}</span></>;
                return app.publicUrl
                  ? <a key={app.clientId} href={app.publicUrl} className="console-app-card">{body}</a>
                  : <div key={app.clientId} className="console-app-card">{body}</div>;
              })}
            </div>
          )}
          <Pagination page={appResult.page} pageCount={appResult.pageCount} previous={t.console.previousPage} next={t.console.nextPage} pageLabel={t.console.pageLabel} onPage={setAppPage} />
        </section>
      )}

      {view === 'platform' && isPlatformAdmin && (
        <section className="console-view" aria-labelledby="console-platform-title">
          <h2 id="console-platform-title">{t.console.platformPlane}</h2>
          <div className="console-boundary-note">{t.console.platformPlaneNote}</div>
          <div className="console-admin-actions">
            <a href="https://radar.myfastools.com/">{t.console.platformOperations} →</a>
            <a href="https://auth.myfastools.com/admin">{t.console.identityOperations} →</a>
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectConsoleNavigation({ lang, projectId, current }: { lang: Lang; projectId: string; current: ProjectConsoleSurface }) {
  const [query, setQuery] = useState('');
  const tasks = findProjectConsoleTasks(query, lang);
  const searchLabel = lang === 'zh' ? '搜索项目功能' : 'Search project features';
  const href = (surface: ProjectConsoleSurface) => localizedHref(`/console/projects/${encodeURIComponent(projectId)}/${surface}`, lang);
  return <>
    <nav className="console-project-nav" aria-label={lang === 'zh' ? '项目控制台' : 'Project console'}>{(Object.keys(PROJECT_CONSOLE_TASKS) as ProjectConsoleSurface[]).map((surface) => <a key={surface} href={href(surface)} aria-current={current === surface ? 'page' : undefined}>{PROJECT_CONSOLE_TASKS[surface][lang]}</a>)}</nav>
    <details className="console-task-search">
      <summary>{lang === 'zh' ? '你想做什么？查找项目功能' : 'What would you like to do? Find a project feature'}</summary>
      <label><span>{searchLabel}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lang === 'zh' ? '例如：上传文件、部署函数、恢复数据' : 'Try upload files, deploy functions, restore backups'} /></label>
      <p role="status" aria-live="polite">{tasks.length ? `${tasks.length} ${lang === 'zh' ? '个入口' : 'destinations'}` : lang === 'zh' ? '没有匹配的功能，请尝试其他关键词。' : 'No matching features. Try another keyword.'}</p>
      <div className="console-app-grid">{tasks.map((task) => <a className="console-app-card" key={task.surface} href={href(task.surface)} aria-current={current === task.surface ? 'page' : undefined}><strong>{task.label}</strong><span>{task.description}</span></a>)}</div>
    </details>
  </>;
}

function truncateJson(value: Record<string, unknown>): string {
  const rendered = JSON.stringify(value);
  return rendered.length > 500 ? `${rendered.slice(0, 497)}…` : rendered;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function projectPanelMessage(status: ProjectConsoleData['auth']['status'], labels: {
  projectKeyRequired: string;
  projectDataAuthError: string;
  projectDataForbidden: string;
  projectDataNetworkError: string;
  projectDataInvalid: string;
}): string {
  if (status === 'locked') return labels.projectKeyRequired;
  if (status === 'auth') return labels.projectDataAuthError;
  if (status === 'forbidden') return labels.projectDataForbidden;
  if (status === 'network') return labels.projectDataNetworkError;
  return labels.projectDataInvalid;
}

function Pagination({ page, pageCount, previous, next, pageLabel, onPage }: { page: number; pageCount: number; previous: string; next: string; pageLabel: string; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="console-pagination" aria-label={pageLabel}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>{previous}</button>
      <span>{pageLabel} {page} / {pageCount}</span>
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>{next}</button>
    </nav>
  );
}
