import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../lib/auth';
import {
  changeProjectAuthUserStatus,
  inviteProjectAuthUser,
  revokeProjectAuthInvitation,
  loadProjectAuthSessions,
  revokeProjectAuthSession,
  loadProjectAuthConsole,
  loadProjectAuthUserDetail,
  updateProjectAuthUserRole,
  PROJECT_AUTH_PAGE_SIZE,
  type ProjectAuthDirectoryQuery,
  type ProjectAuthConsoleData,
  type ProjectAuthUserDetail,
  type ProjectAuthInvitation,
  type ProjectAuthSession,
  type ProjectPanelState,
  type SaasContext,
} from '../lib/saasConsole';
import type { Lang } from '../i18n';

const COPY = {
  en: { title: 'Authentication', note: 'Manage only this SaaS project’s end users. App roles never grant Workspace or platform access.', users: 'Users', active: 'active', blocked: 'blocked', detail: 'User detail', identities: 'Connected identities', noIdentities: 'No external identity connected', mfa: 'MFA', mfaUnknown: 'Not exposed by the current project Auth contract', workspaceRole: 'Workspace relationship', noWorkspaceRole: 'End user only', appRole: 'App role', save: 'Save role', invite: 'Invite end user', email: 'Email', send: 'Create invitation', pending: 'Pending invitations', oneTime: 'Invitation created. Copy this one-time URL now:', queued: 'Delivery queued', copyFallback: 'Email delivery was not queued; share the one-time URL securely.', refresh: 'Refresh', loading: 'Loading exact-project Auth data…', denied: 'Your current W-ID session or Workspace membership cannot access this project.', unavailable: 'Project Auth is temporarily unavailable or returned an invalid contract.', disable: 'Disable user', restore: 'Restore user', disableHelp: 'Disabling this end user also revokes their sessions in this project.', changed: 'User status updated. Sessions revoked:', refreshTokens: 'Refresh tokens revoked:', sessions: 'Project sessions', viewSessions: 'View sessions', revokeSession: 'Revoke session', confirmSession: 'Type the exact session ID to revoke', sessionRevoked: 'Session revoked:', noSessions: 'No active sessions in this project.', device: 'Unknown device', created: 'Created', expires: 'Expires', noUsers: 'No end users have signed in yet.', search: 'Search this page', statusFilter: 'User status', allStatuses: 'All statuses', noMatches: 'No users match on this page.', page: 'Page', previous: 'Previous', next: 'Next', revokeInvite: 'Revoke invitation', confirmEmail: 'Type the exact invitation email to revoke', confirmRevoke: 'Confirm revocation', cancel: 'Cancel', revoked: 'Invitation revoked:', unknown: 'The request did not finish reliably. Refresh to verify before retrying; the server may have completed the change.' },
  zh: { title: '身份认证', note: '这里只管理当前 SaaS 项目的终端用户。应用角色绝不会授予 Workspace 或平台权限。', users: '用户', active: '活跃', blocked: '封禁', detail: '用户详情', identities: '已绑定身份', noIdentities: '尚未绑定外部身份', mfa: 'MFA', mfaUnknown: '当前项目 Auth 契约未暴露此状态', workspaceRole: 'Workspace 关系', noWorkspaceRole: '仅终端用户', appRole: '应用角色', save: '保存角色', invite: '邀请终端用户', email: '邮箱', send: '创建邀请', pending: '待处理邀请', oneTime: '邀请已创建，请立即复制一次性地址：', queued: '邮件已入队', copyFallback: '邮件未入队，请安全地分享此一次性地址。', refresh: '刷新', loading: '正在加载精确项目 Auth 数据…', denied: '当前 W-ID 会话或 Workspace 成员关系无权访问此项目。', unavailable: '项目 Auth 暂时不可用或返回了无效契约。', disable: '禁用用户', restore: '恢复用户', disableHelp: '禁用此终端用户时，同时撤销其在当前项目的会话。', changed: '用户状态已更新，撤销会话数：', refreshTokens: '撤销刷新令牌数：', sessions: '项目会话', viewSessions: '查看会话', revokeSession: '撤销此会话', confirmSession: '输入完整会话 ID 以撤销', sessionRevoked: '会话已撤销：', noSessions: '当前项目没有活跃会话。', device: '未知设备', created: '创建时间', expires: '到期时间', noUsers: '尚无终端用户登录。', search: '搜索当前页', statusFilter: '用户状态', allStatuses: '全部状态', noMatches: '当前页没有匹配用户。', page: '第' , previous: '上一页', next: '下一页', revokeInvite: '撤销邀请', confirmEmail: '输入完整邀请邮箱以撤销', confirmRevoke: '确认撤销', cancel: '取消', revoked: '邀请已撤销：', unknown: '请求未可靠完成。重试前请刷新确认，服务端可能已完成修改。' },
} as const;

type AuthProps = { lang: Lang; context: SaasContext; projectId: string };
export function ProjectAuthConsole(props: AuthProps) {
  const project = props.context.console.projects.find((item) => item.id === props.projectId);
  const membership = props.context.authorityPlanes.workspaceMemberships.find((item) => item.id === project?.workspaceId);
  return <ProjectAuthSession key={JSON.stringify([props.context.self.userId, props.projectId, project?.workspaceId, project?.workspaceRole, membership?.role])} {...props} />;
}
function ProjectAuthSession({ lang, context, projectId }: AuthProps) {
  const t = COPY[lang];
  const [data, setData] = useState<ProjectPanelState<ProjectAuthConsoleData> | null>(null);
  const [detail, setDetail] = useState<ProjectPanelState<ProjectAuthUserDetail> | null>(null);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [action, setAction] = useState<'idle' | 'loading' | 'error' | 'unknown'>('idle');
  const [oneTimeInvite, setOneTimeInvite] = useState<{ id: string; url?: string; queued: boolean } | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<ProjectAuthInvitation | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState('');
  const [revokedInvite, setRevokedInvite] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProjectPanelState<ProjectAuthSession[]> | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [sessionConfirmation, setSessionConfirmation] = useState('');
  const [revokedSession, setRevokedSession] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<ProjectAuthDirectoryQuery>({ offset: 0, status: 'all' });
  const directoryRef = useRef(directory);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [securityResult, setSecurityResult] = useState<{ revokedSessions: number; revokedRefreshTokens: number } | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const sessionController = useRef<AbortController | null>(null);
  const active = useRef(true);

  const reload = useCallback(async (parentSignal?: AbortSignal, initialBearer?: string | null) => {
    if (!active.current) return;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller; setDirectoryLoading(true);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && listController.current === controller && !controller.signal.aborted;
    try {
      const token = initialBearer === undefined ? await getAccessToken() : initialBearer;
      if (!current()) return;
      signal.throwIfAborted();
      const result = await loadProjectAuthConsole(context, projectId, token, request, signal, directoryRef.current);
      if (current()) {
        setData(signal.aborted ? { status: 'network' } : result);
        if (!signal.aborted && result.status === 'ready') {
          const pending = new Set(result.data.invitations.map((invitation) => invitation.id));
          setRevokingInvite((value) => value && pending.has(value.id) ? value : null);
          setOneTimeInvite((value) => value && pending.has(value.id) ? value : null);
        }
      }
    } catch { if (current()) setData({ status: 'network' }); }
    finally { if (current()) { setDirectoryLoading(false); listController.current = null; } }
  }, [context, projectId]);
  useEffect(() => {
    active.current = true;
    let initial = true;
    void getAccessToken().then((token) => { if (initial) return reload(undefined, token); }).catch(() => { if (initial) { setData({ status: 'network' }); setDirectoryLoading(false); } });
    return () => { initial = false; active.current = false; listController.current?.abort(); listController.current = null; detailController.current?.abort(); sessionController.current?.abort(); actionController.current?.abort(); actionController.current = null; };
  }, [reload]);
  const inspect = async (userId: string, parentSignal?: AbortSignal) => {
    if (!active.current || (actionController.current && !parentSignal)) return;
    detailController.current?.abort();
    const controller = new AbortController(); detailController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && detailController.current === controller && !controller.signal.aborted;
    sessionController.current?.abort(); setSessions(null); setSessionsOpen(false); setRevokingSession(null); setSessionConfirmation(''); setRevokedSession(null);
    setSelected(userId); setDetail(null); setSecurityResult(null);
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted();
      const result = await loadProjectAuthUserDetail(context, projectId, userId, bearer, request, signal);
      if (!current()) return;
      if (signal.aborted) { setDetail({ status: 'network' }); return; }
      setDetail(result);
      if (result.status === 'ready' && (result.data.user.appRole === 'user' || result.data.user.appRole === 'admin')) setRole(result.data.user.appRole);
    } catch { if (current()) setDetail({ status: 'network' }); }
  };
  const readSessions = async (userId: string, parentSignal?: AbortSignal) => {
    if (!active.current || (actionController.current && !parentSignal)) return;
    sessionController.current?.abort();
    const controller = new AbortController(); sessionController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000), ...(parentSignal ? [parentSignal] : [])]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && sessionController.current === controller && !controller.signal.aborted;
    setSessionsOpen(true); setSessions(null);
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted();
      const result = await loadProjectAuthSessions(context, projectId, userId, bearer, request, signal);
      if (!current()) return;
      setSessions(signal.aborted ? { status: 'network' } : result);
      if (!signal.aborted && result.status === 'ready') {
        setRevokingSession((id) => id && result.data.some((session) => session.id === id) ? id : null);
      }
    } catch { if (current()) setSessions({ status: 'network' }); }
  };
  const runAction = async <T,>(operation: (bearer: string | null, request: typeof fetch, signal: AbortSignal) => Promise<ProjectPanelState<T>>, onSuccess: (value: T, signal: AbortSignal) => Promise<void>) => {
    if (!active.current || actionController.current || listController.current) return;
    const controller = new AbortController(); actionController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    const request: typeof fetch = (input, init) => fetch(input, { ...init, signal });
    const current = () => active.current && actionController.current === controller && !controller.signal.aborted;
    let started = false; setAction('loading'); setRevokedInvite(null); setRevokedSession(null);
    try {
      const bearer = await getAccessToken();
      if (!current()) return;
      signal.throwIfAborted(); started = true;
      const result = await operation(bearer, request, signal);
      if (!current()) return;
      if (signal.aborted || result.status === 'network') { setAction('unknown'); return; }
      if (result.status !== 'ready') { setAction('error'); return; }
      await onSuccess(result.data, signal);
      if (current()) setAction('idle');
    } catch { if (current()) setAction(started ? 'unknown' : 'error'); }
    finally { if (actionController.current === controller) actionController.current = null; }
  };
  const saveRole = async () => {
    if (!selected) return;
    await runAction((bearer, request) => updateProjectAuthUserRole(context, projectId, selected, role, bearer, request), async (_, signal) => { await reload(signal); await inspect(selected, signal); });
  };
  const changeStatus = async () => {
    if (!selected || detail?.status !== 'ready') return;
    const change = detail.data.user.status === 'blocked' ? 'restore' : 'disable';
    setSecurityResult(null);
    await runAction((bearer, request, signal) => changeProjectAuthUserStatus(context, projectId, selected, change, bearer, request, signal), async (value, signal) => {
      await reload(signal); await inspect(selected, signal);
      if (active.current && !signal.aborted) setSecurityResult(value);
    });
  };
  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (actionController.current) return;
    setOneTimeInvite(null);
    await runAction((bearer, request) => inviteProjectAuthUser(context, projectId, email, inviteRole, lang === 'zh' ? 'zh-CN' : 'en', bearer, request), async (value, signal) => {
      setOneTimeInvite({ id: value.invitation.id, url: value.inviteUrl, queued: value.deliveryQueued }); setEmail(''); await reload(signal);
    });
  };
  const revokeInvite = async () => {
    if (!revokingInvite || revokeConfirmation !== revokingInvite.email) return;
    const invitation = revokingInvite;
    await runAction((bearer, request, signal) => revokeProjectAuthInvitation(context, projectId, invitation.id, bearer, request, signal), async (_, signal) => {
      setOneTimeInvite((value) => value?.id === invitation.id ? null : value);
      setRevokingInvite(null); setRevokeConfirmation(''); setRevokedInvite(invitation.email); await reload(signal);
    });
  };

  const revokeSession = async () => {
    if (!selected || !revokingSession || sessionConfirmation !== revokingSession) return;
    const sessionId = revokingSession; const userId = selected;
    await runAction((bearer, request, signal) => revokeProjectAuthSession(context, projectId, userId, sessionId, bearer, request, signal), async (_, signal) => {
      setRevokingSession(null); setSessionConfirmation(''); setRevokedSession(sessionId);
      await readSessions(userId, signal);
    });
  };

  const changeDirectory = (next: ProjectAuthDirectoryQuery) => {
    if (actionController.current) return;
    directoryRef.current = next; setDirectory(next); setQuery(''); setData(null);
    detailController.current?.abort(); sessionController.current?.abort();
    setSelected(''); setDetail(null); setSessions(null); setSessionsOpen(false);
    setRevokingSession(null); setSessionConfirmation(''); setRevokedSession(null); setSecurityResult(null);
    void reload();
  };
  const users = data?.status === 'ready' ? data.data.users : [];
  const visible = users.filter((user) => `${user.displayName || ''} ${user.email || ''} ${user.userId}`.toLowerCase().includes(query.trim().toLowerCase()));
  const busy = action === 'loading' || directoryLoading;
  return <section className="console-view console-auth" aria-labelledby="project-auth-title">
    <div className="console-panel-heading"><div><h2 id="project-auth-title">{t.title}</h2><p className="console-note">{t.note}</p></div><button type="button" disabled={busy} onClick={() => void reload()}>{t.refresh}</button></div>
    <label htmlFor="auth-user-status">{t.statusFilter}</label><select id="auth-user-status" disabled={action === 'loading'} value={directory.status} onChange={(event) => changeDirectory({ offset: 0, status: event.target.value as ProjectAuthDirectoryQuery['status'] })}><option value="all">{t.allStatuses}</option><option value="active">{t.active}</option><option value="blocked">{t.blocked}</option></select>
    <nav className="console-pagination" aria-label={t.users}><button type="button" disabled={busy || directory.offset === 0} onClick={() => changeDirectory({ ...directory, offset: Math.max(0, directory.offset - PROJECT_AUTH_PAGE_SIZE) })}>{t.previous}</button><span>{t.page} {directory.offset / PROJECT_AUTH_PAGE_SIZE + 1}</span><button type="button" disabled={busy || data?.status !== 'ready' || !data.data.hasMore} onClick={() => changeDirectory({ ...directory, offset: directory.offset + PROJECT_AUTH_PAGE_SIZE })}>{t.next}</button></nav>
    {(!data || directoryLoading) && <p role="status">{t.loading}</p>}
    {data && data.status !== 'ready' && <p role="alert" className="console-status is-error">{data.status === 'auth' || data.status === 'forbidden' ? t.denied : t.unavailable}</p>}
    {data?.status === 'ready' && <>
      <div className="console-stats"><div className="console-stat"><strong>{data.data.total}</strong><span>{t.users}</span></div><div className="console-stat"><strong>{data.data.active}</strong><span>{t.active}</span></div><div className="console-stat"><strong>{data.data.blocked}</strong><span>{t.blocked}</span></div></div>
      <div className="console-auth-layout">
        <section aria-labelledby="auth-users-title"><h3 id="auth-users-title">{t.users}</h3><label><span>{t.search}</span><input type="search" disabled={busy} value={query} onChange={(event) => setQuery(event.target.value)} /></label>{visible.length === 0 ? <p className="console-empty">{data.data.total === 0 ? t.noUsers : t.noMatches}</p> : <><ul className="console-auth-users">{visible.map((user) => <li key={user.userId}><button type="button" aria-current={selected === user.userId ? 'true' : undefined} disabled={busy} onClick={() => void inspect(user.userId)}><strong>{user.displayName || user.email || user.userId}</strong><span>{user.appRole} · {user.status} · {user.loginCount}</span></button></li>)}</ul></>}</section>
        <section aria-labelledby="auth-detail-title"><h3 id="auth-detail-title">{t.detail}</h3>{detail?.status === 'ready' ? <div className="console-auth-detail"><strong>{detail.data.user.displayName || detail.data.user.email || detail.data.user.userId}</strong><code>{detail.data.user.userId}</code><dl><dt>{t.identities}</dt><dd>{detail.data.identities.length ? detail.data.identities.map((identity) => `${identity.provider} · ${identity.providerUserId}`).join(', ') : t.noIdentities}</dd><dt>{t.mfa}</dt><dd>{t.mfaUnknown}</dd><dt>{t.workspaceRole}</dt><dd>{detail.data.workspaceMemberRole || t.noWorkspaceRole}</dd></dl>{data.data.canManage && <><label htmlFor="auth-app-role">{t.appRole}</label><select id="auth-app-role" disabled={busy} value={role} onChange={(event) => setRole(event.target.value as 'user' | 'admin')}><option value="user">user</option><option value="admin">admin</option></select><button className="site-nav-button" type="button" disabled={busy} onClick={() => void saveRole()}>{t.save}</button></>}<div className="console-row-actions">{data.data.canManage && <button type="button" disabled={busy || !['active', 'blocked'].includes(detail.data.user.status)} onClick={() => void changeStatus()}>{detail.data.user.status === 'blocked' ? t.restore : t.disable}</button>}{data.data.canManage && <button type="button" disabled={busy} onClick={() => void readSessions(selected)}>{t.viewSessions}</button>}</div>{data.data.canManage && <p className="console-note">{t.disableHelp}</p>}{securityResult && <p role="status">{t.changed} {securityResult.revokedSessions} · {t.refreshTokens} {securityResult.revokedRefreshTokens}</p>}{data.data.canManage && sessionsOpen && <section aria-labelledby="auth-sessions-title"><div className="console-panel-heading"><h4 id="auth-sessions-title">{t.sessions}</h4><button type="button" disabled={busy} onClick={() => void readSessions(selected)}>{t.refresh}</button></div>{!sessions && <p role="status">{t.loading}</p>}{sessions && sessions.status !== 'ready' && <p role="alert">{sessions.status === 'auth' || sessions.status === 'forbidden' ? t.denied : t.unavailable}</p>}{sessions?.status === 'ready' && (sessions.data.length ? <ul>{sessions.data.map((session) => <li key={session.id}><code>{session.id}</code><p>{session.userAgent || t.device}</p><p>{t.created}: {new Date(session.createdAt * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')} · {t.expires}: {new Date(session.expiresAt * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')}</p><button type="button" disabled={busy} onClick={() => { setRevokingSession(session.id); setSessionConfirmation(''); setRevokedSession(null); }}>{t.revokeSession}</button></li>)}</ul> : <p>{t.noSessions}</p>)}{revokingSession && <div className="console-boundary-note" role="alertdialog" aria-labelledby="auth-revoke-session-title"><strong id="auth-revoke-session-title">{t.revokeSession} · {revokingSession}</strong><label htmlFor="auth-revoke-session-id">{t.confirmSession}</label><input id="auth-revoke-session-id" autoComplete="off" disabled={busy} value={sessionConfirmation} onChange={(event) => setSessionConfirmation(event.target.value)} /><div className="console-row-actions"><button type="button" disabled={busy || sessionConfirmation !== revokingSession} onClick={() => void revokeSession()}>{t.confirmRevoke}</button><button type="button" disabled={busy} onClick={() => { setRevokingSession(null); setSessionConfirmation(''); }}>{t.cancel}</button></div></div>}{revokedSession && <p role="status">{t.sessionRevoked} {revokedSession}</p>}</section>}</div> : selected && <p role="status">{detail ? t.unavailable : t.loading}</p>}</section>
      </div>
      {data.data.canManage && <section className="console-key-management" aria-labelledby="auth-invite-title"><h3 id="auth-invite-title">{t.invite}</h3><form className="console-row-editor" onSubmit={(event) => void invite(event)}><label htmlFor="auth-invite-email">{t.email}</label><input id="auth-invite-email" type="email" required autoComplete="email" disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="auth-invite-role">{t.appRole}</label><select id="auth-invite-role" disabled={busy} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'user' | 'admin')}><option value="user">user</option><option value="admin">admin</option></select><button className="site-nav-button" disabled={busy}>{t.send}</button></form>{oneTimeInvite && <div role="status" className="console-boundary-note"><strong>{t.oneTime}</strong>{oneTimeInvite.url && <code>{oneTimeInvite.url}</code>}<span>{oneTimeInvite.queued ? t.queued : t.copyFallback}</span></div>}<h4>{t.pending}</h4><ul>{data.data.invitations.map((invitation) => <li key={invitation.id}><span>{invitation.email} · {invitation.appRole}</span><small>{new Date(invitation.expiresAt * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en')}</small><button type="button" disabled={busy} onClick={() => { setRevokingInvite(invitation); setRevokeConfirmation(''); setRevokedInvite(null); }}>{t.revokeInvite}</button></li>)}</ul>{revokingInvite && <div className="console-boundary-note" role="alertdialog" aria-labelledby="auth-revoke-invite-title"><strong id="auth-revoke-invite-title">{t.revokeInvite} · {revokingInvite.email}</strong><label htmlFor="auth-revoke-invite-email">{t.confirmEmail}</label><input id="auth-revoke-invite-email" autoComplete="off" disabled={busy} value={revokeConfirmation} onChange={(event) => setRevokeConfirmation(event.target.value)} /><div className="console-row-actions"><button type="button" disabled={busy || revokeConfirmation !== revokingInvite.email} onClick={() => void revokeInvite()}>{t.confirmRevoke}</button><button type="button" disabled={busy} onClick={() => { setRevokingInvite(null); setRevokeConfirmation(''); }}>{t.cancel}</button></div></div>}{revokedInvite && <p role="status">{t.revoked} {revokedInvite}</p>}</section>}
      {action === 'unknown' && <p role="alert" className="console-status is-error">{t.unknown}</p>}
      {action === 'error' && <p role="alert" className="console-status is-error">{t.unavailable}</p>}
    </>}
  </section>;
}
