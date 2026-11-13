import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "../lib/auth";
import type { Lang } from "../i18n";
import type { SaasContext } from "../lib/saasConsole";
import {
  createWorkspace,
  createWorkspaceProject,
  inviteWorkspaceMember,
  loadWorkspaceProjectProvisioning,
  loadWorkspaceLifecycle,
  removeWorkspaceMember,
  retryWorkspaceProjectProvisioning,
  reclaimWorkspaceProjectResources,
  archiveWorkspaceProject,
  restoreWorkspaceProject,
  deleteWorkspaceProject,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
  type LifecycleStatus,
  type ProjectProvisioningSnapshot,
  type ProjectResourceReclaimSnapshot,
  type WorkspaceLifecycleData,
  type WorkspaceMember,
} from "../lib/workspaceLifecycle";

const COPY = {
  en: {
    title: "Workspaces & team",
    note: "Manage only customer Workspaces where you hold a real active membership. Platform administration and app-user access never grant team authority.",
    select: "Workspace",
    createWorkspace: "Create Workspace",
    workspaceName: "Workspace name",
    slug: "URL slug",
    agreements:
      "Creating a Workspace confirms the Terms, Privacy, Data Processing and AI Acceptable Use policies.",
    create: "Create",
    refresh: "Refresh",
    role: "Your role",
    readOnly:
      "Members can view the roster and projects. Only owners/admins can mutate this Workspace.",
    projects: "Projects",
    noProjects: "No projects in this Workspace.",
    projectName: "Project name",
    projectId: "Project ID",
    origin: "Application origin",
    redirect: "OAuth redirect URI",
    createProject: "Create public PKCE project",
    projectSecurity:
      "Projects created here use public PKCE (`token_endpoint_auth_method=none`), so no server client secret enters the browser.",
    provisioning: "Provisioning",
    provisioningTitle: "Unified project provisioning",
    provisioningNote:
      "One workflow verifies the exact Identity, Radar, Database, Storage, Functions, Sites, Realtime and Monitoring bindings. Derived URLs never count as ready.",
    provisioningRefresh: "Retry orchestration",
    provisioningOpen: "Open provisioning status",
    provisioningAttempts: "Attempts",
    provisioningTimeout:
      "Automatic status polling paused after 15 checks. The committed project remains visible; retry the same orchestration without creating a duplicate project.",
    reclaim: "Delete project and its resources",
    reclaimHelp: "This permanently removes the project's databases, backups, Storage objects, Workers and Sites, then archives and deletes its W-ID identity. This cannot be undone. Type the exact project ID once to confirm. Archived projects are restored temporarily so resources can be cleaned up, then archived and deleted again; restoring does not restore revoked OAuth credentials.",
    reclaimProjectId: "Confirm project ID",
    reclaimSubmit: "Start / continue deletion",
    reclaimRetry: "Retry failed step",
    reclaimPoll: "Check cleanup status",
    reclaimContinue: "Continue after provider recovery",
    reclaimBusy: "Deleting project resources…",
    reclaimDone: "Project and resources deleted.",
    reclaimFailedStep: "The project identity was kept. The provider status above identifies what needs attention; resolve it with that service, then continue here.",
    reclaimState: { deleted: "All managed resources deleted", pending: "Database deletion is pending", failed: "Resource cleanup failed", not_found: "No database resources were found; provider cleanup did not complete" },
    reclaimProvider: "Provider cleanup",
    providerStates: { deleted: "deleted", pending: "pending", failed: "failed", not_found: "not found", not_started: "not started" },
    projectArchived: "Archived",
    wDb: "W-DB",
    wDrop: "W-Drop",
    reclaimResource: "Database resource",
    generation: "Generation",
    provisioningStates: {
      ready: "Ready",
      provisioning: "Provisioning",
      degraded: "Needs attention",
    },
    provisioningResources: {
      identity: "Identity",
      radar: "Radar registry",
      database: "Database",
      storage: "Storage",
      functions: "Edge Functions",
      sites: "Sites",
      realtime: "Realtime",
      monitoring: "Monitoring",
    },
    oneTimeKey: "Copy this publishable key now",
    oneTimeKeyNote: "Browser-safe and shown once; kept only in React memory.",
    members: "Team members",
    noMembers: "No visible team members.",
    self: "You",
    changeRole: "Change role",
    remove: "Remove",
    protected: "Owner/current-subject protected",
    invite: "Invite teammate",
    email: "Email",
    invitationRole: "Workspace role",
    sendInvite: "Send invitation",
    invitations: "Pending invitations",
    noInvitations: "No pending invitations.",
    revoke: "Revoke",
    resend: "Resend unavailable",
    resendGap:
      "W-ID does not yet publish an audited resend endpoint; tracked in W-ID #122.",
    empty:
      "You have no active customer Workspace membership. Platform administrators are not enrolled automatically.",
    loading: "Loading exact-Workspace lifecycle…",
    ready: "Operation completed.",
    invalid: "Check the bounded fields and exact confirmation.",
    forbidden: "Your real Workspace membership does not allow this operation.",
    conflict:
      "The resource already exists or an invitation is already pending.",
    restore_required: "Restore the archived project to start resource cleanup.",
    auth: "Your W-ID session expired.",
    network: "W-ID is temporarily unavailable.",
  },
  zh: {
    title: "Workspace 与团队",
    note: "仅管理你拥有真实有效成员关系的客户 Workspace。平台管理权限和 SaaS 终端用户关系绝不会授予团队权限。",
    select: "Workspace",
    createWorkspace: "创建 Workspace",
    workspaceName: "Workspace 名称",
    slug: "URL Slug",
    agreements:
      "创建 Workspace 即确认服务条款、隐私、数据处理及 AI 可接受使用政策。",
    create: "创建",
    refresh: "刷新",
    role: "你的角色",
    readOnly: "成员可以查看团队和项目；只有 Owner/Admin 可以变更此 Workspace。",
    projects: "项目",
    noProjects: "此 Workspace 尚无项目。",
    projectName: "项目名称",
    projectId: "项目 ID",
    origin: "应用 Origin",
    redirect: "OAuth 回调 URI",
    createProject: "创建公开 PKCE 项目",
    projectSecurity:
      "这里创建的项目固定使用公开 PKCE（token_endpoint_auth_method=none），服务器 Client Secret 不会进入浏览器。",
    provisioning: "配置中",
    provisioningTitle: "统一项目开通",
    provisioningNote:
      "同一工作流逐项验证身份、Radar、数据库、Storage、函数、Sites、Realtime 与监控绑定；仅推导出 URL 不算就绪。",
    provisioningRefresh: "重试统一编排",
    provisioningOpen: "查看开通状态",
    provisioningAttempts: "尝试次数",
    provisioningTimeout:
      "自动状态轮询已在 15 次检查后暂停。已提交的项目仍然可见；可重试同一编排，不会重复创建项目。",
    reclaim: "删除项目及其资源",
    reclaimHelp: "此操作会永久删除项目数据库、备份、Storage 对象、Workers 和 Sites，然后归档并删除 W-ID 身份记录，无法撤销。输入精确项目 ID 一次确认。已归档项目会先临时恢复以便清理资源，随后再次归档并删除；恢复不会重新启用已撤销的 OAuth 凭据。",
    reclaimProjectId: "确认项目 ID",
    reclaimSubmit: "开始 / 继续删除",
    reclaimRetry: "重试失败步骤",
    reclaimPoll: "检查清理状态",
    reclaimContinue: "服务恢复后继续",
    reclaimBusy: "正在删除项目资源…",
    reclaimDone: "项目及资源已删除。",
    reclaimFailedStep: "项目身份已保留。上方状态标出了需要处理的服务；请先在对应服务完成恢复，再回到此处继续。",
    reclaimState: { deleted: "所有托管资源已删除", pending: "数据库删除处理中", failed: "资源清理失败", not_found: "未找到数据库资源；服务资源清理未完成" },
    reclaimProvider: "服务清理状态",
    providerStates: { deleted: "已删除", pending: "处理中", failed: "失败", not_found: "未找到", not_started: "未开始" },
    projectArchived: "已归档",
    wDb: "W-DB",
    wDrop: "W-Drop",
    reclaimResource: "数据库资源",
    generation: "代次",
    provisioningStates: {
      ready: "已就绪",
      provisioning: "配置中",
      degraded: "需要处理",
    },
    provisioningResources: {
      identity: "身份",
      radar: "Radar 注册",
      database: "数据库",
      storage: "Storage",
      functions: "边缘函数",
      sites: "Sites",
      realtime: "Realtime",
      monitoring: "监控",
    },
    oneTimeKey: "请立即复制此发布密钥",
    oneTimeKeyNote: "这是浏览器安全密钥，仅展示一次并只保存在 React 内存中。",
    members: "团队成员",
    noMembers: "没有可见团队成员。",
    self: "你自己",
    changeRole: "更改角色",
    remove: "移除",
    protected: "Owner / 当前用户受保护",
    invite: "邀请团队成员",
    email: "邮箱",
    invitationRole: "Workspace 角色",
    sendInvite: "发送邀请",
    invitations: "待处理邀请",
    noInvitations: "没有待处理邀请。",
    revoke: "撤销",
    resend: "暂不支持重发",
    resendGap: "W-ID 尚未发布可审计的重发端点；已在 W-ID #122 跟踪。",
    empty: "你没有有效的客户 Workspace 成员关系；平台管理员不会被自动加入。",
    loading: "正在加载精确 Workspace 生命周期…",
    ready: "操作已完成。",
    invalid: "请检查字段限制与确认内容。",
    forbidden: "你的真实 Workspace 成员角色无权执行此操作。",
    conflict: "资源已存在，或相同邀请仍在等待处理。",
    restore_required: "请先恢复已归档项目，再开始资源清理。",
    auth: "W-ID 会话已过期。",
    network: "W-ID 暂时不可用。",
  },
} as const;

export function WorkspaceLifecycleConsole({
  lang,
  context,
}: {
  lang: Lang;
  context: SaasContext;
}) {
  const t = COPY[lang];
  const [localContext, setLocalContext] = useState(context);
  const [workspaceId, setWorkspaceId] = useState(
    context.authorityPlanes.workspaceMemberships[0]?.id || "",
  );
  const [data, setData] = useState<WorkspaceLifecycleData | null>(null);
  const [loadState, setLoadState] = useState<
    LifecycleStatus | "idle" | "loading"
  >("idle");
  const [action, setAction] = useState<LifecycleStatus | "idle" | "loading">(
    "idle",
  );
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [origin, setOrigin] = useState("https://app.example.com");
  const [redirectUri, setRedirectUri] = useState(
    "https://app.example.com/auth/callback",
  );
  const [oneTimeKey, setOneTimeKey] = useState("");
  const [projectProvisioning, setProjectProvisioning] =
    useState<ProjectProvisioningSnapshot | null>(null);
  const [projectProvisioningStatus, setProjectProvisioningStatus] = useState<
    LifecycleStatus | "idle" | "loading"
  >("idle");
  const [projectProvisioningAttempts, setProjectProvisioningAttempts] =
    useState(0);
  const [reclaimProjectId, setReclaimProjectId] = useState("");
  const [reclaimConfirmation, setReclaimConfirmation] = useState("");
  const [reclaimState, setReclaimState] = useState<LifecycleStatus | "idle" | "loading">("idle");
  const [reclaimSnapshot, setReclaimSnapshot] = useState<ProjectResourceReclaimSnapshot | null>(null);
  const [removalStep, setRemovalStep] = useState<"confirm" | "reclaim" | "archive" | "delete" | "done">("confirm");
  const [reclaimProjectArchived, setReclaimProjectArchived] = useState(false);
  const provisioningRequestGeneration = useRef(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [removeConfirmation, setRemoveConfirmation] = useState("");
  const workspace = localContext.authorityPlanes.workspaceMemberships.find(
    (item) => item.id === workspaceId,
  );
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  const refreshProjectProvisioning = useCallback(
    async (targetProjectId: string, retry = false, restart = false) => {
      if (!targetProjectId) return;
      const knownProject = localContext.console.projects.some(
        (project) =>
          project.id === targetProjectId && project.workspaceId === workspaceId,
      );
      const visibleProject = data?.projects.find(
        (project) => project.id === targetProjectId,
      );
      if (!knownProject && !visibleProject) {
        setProjectProvisioningStatus("forbidden");
        return;
      }
      const requestContext =
        knownProject || !visibleProject
          ? localContext
          : {
              ...localContext,
              console: {
                projects: [...localContext.console.projects, visibleProject],
              },
            };
      const requestGeneration = ++provisioningRequestGeneration.current;
      setProjectProvisioningStatus("loading");
      if (restart) setProjectProvisioningAttempts(0);
      const token = await getAccessToken();
      const result = retry
        ? await retryWorkspaceProjectProvisioning(
            requestContext,
            workspaceId,
            targetProjectId,
            token,
            fetch,
          )
        : await loadWorkspaceProjectProvisioning(
            requestContext,
            workspaceId,
            targetProjectId,
            token,
            fetch,
          );
      if (requestGeneration !== provisioningRequestGeneration.current) return;
      setProjectProvisioningAttempts((current) => (restart ? 0 : current + 1));
      if (result.status === "ready") {
        setProjectProvisioning((current) => ({
          ...result.data,
          ...(current?.projectId === targetProjectId && current.projectUrl
            ? { projectUrl: current.projectUrl }
            : {}),
        }));
        setProjectProvisioningStatus("ready");
      } else setProjectProvisioningStatus(result.status);
    }, [data?.projects, localContext, workspaceId],
  );
  useEffect(() => {
    if (
      !projectProvisioning ||
      projectProvisioning.state !== "provisioning" ||
      projectProvisioningAttempts >= 15
    )
      return;
    const timer = window.setTimeout(
      () =>
        void refreshProjectProvisioning(projectProvisioning.projectId),
      projectProvisioning.retryAfterSeconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [
    projectProvisioning,
    projectProvisioningAttempts,
    refreshProjectProvisioning,
  ]);
  const reload = async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (!workspaceId) {
      setData(null);
      setLoadState("idle");
      return;
    }
    setLoadState("loading");
    const result = await loadWorkspaceLifecycle(
      localContext,
      workspaceId,
      await getAccessToken(),
      fetch,
      signal,
    );
    if (result.status === "ready") {
      setData(result.data);
      setLoadState("ready");
    } else {
      setData(null);
      setLoadState(result.status);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (active) setLoadState(workspaceId ? "loading" : "idle");
    });
    void getAccessToken()
      .then((token) =>
        workspaceId
          ? loadWorkspaceLifecycle(
              localContext,
              workspaceId,
              token,
              fetch,
              controller.signal,
            )
          : null,
      )
      .then((result) => {
        if (!active || !result) return;
        if (result.status === "ready") {
          setData(result.data);
          setLoadState("ready");
        } else {
          setData(null);
          setLoadState(result.status);
        }
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === "AbortError"))
          setLoadState("network");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [workspaceId, localContext]);
  const finish = async (result: { status: LifecycleStatus }) => {
    setAction(result.status);
    if (result.status === "ready") await reload();
  };
  const submitWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    setAction("loading");
    const result = await createWorkspace(
      workspaceName,
      workspaceSlug,
      await getAccessToken(),
      fetch,
    );
    if (result.status === "ready") {
      const next = {
        ...localContext,
        authorityPlanes: {
          ...localContext.authorityPlanes,
          workspaceMemberships: [
            ...localContext.authorityPlanes.workspaceMemberships,
            result.data,
          ],
        },
      };
      setLocalContext(next);
      provisioningRequestGeneration.current += 1;
      setWorkspaceId(result.data.id);
      setOneTimeKey("");
      setProjectProvisioning(null);
      setProjectProvisioningStatus("idle");
      setProjectProvisioningAttempts(0);
      setWorkspaceName("");
      setWorkspaceSlug("");
      setAction("ready");
    } else setAction(result.status);
  };
  const submitProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setAction("loading");
    const result = await createWorkspaceProject(
      localContext,
      workspaceId,
      { name: projectName, id: projectId, origin, redirectUri },
      await getAccessToken(),
      fetch,
    );
    if (result.status === "ready") {
      const next = {
        ...localContext,
        console: {
          projects: localContext.console.projects.some(
            (project) => project.id === result.data.id,
          )
            ? localContext.console.projects
            : [
                ...localContext.console.projects,
                {
                  id: result.data.id,
                  workspaceId,
                  name: result.data.name,
                  workspaceRole: workspace?.role || "admin",
                  radarProjectId: result.data.radarProjectId,
                },
              ],
        },
      };
      setLocalContext(next);
      setOneTimeKey(result.data.oneTimePublishableKey || "");
      setProjectProvisioning({
        projectId: result.data.id,
        state: result.data.provisioning,
        retryAfterSeconds: result.data.retryAfterSeconds,
        resources: result.data.resources,
        ...(result.data.projectUrl ? { projectUrl: result.data.projectUrl } : {}),
      });
      setProjectProvisioningAttempts(0);
      setProjectProvisioningStatus("ready");
      setProjectName("");
      setProjectId("");
      await finish(result);
    } else setAction(result.status);
  };
  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setAction("loading");
    const result = await inviteWorkspaceMember(
      localContext,
      workspaceId,
      inviteEmail,
      inviteRole,
      await getAccessToken(),
      fetch,
    );
    if (result.status === "ready") {
      setInviteEmail("");
      await finish(result);
    } else setAction(result.status);
  };
  const mutateMember = async (
    member: WorkspaceMember,
    next: "admin" | "member" | "remove",
  ) => {
    if (next === "remove" && removeConfirmation !== member.userId) {
      setAction("invalid");
      return;
    }
    setAction("loading");
    const token = await getAccessToken();
    await finish(
      next === "remove"
        ? await removeWorkspaceMember(
            localContext,
            workspaceId,
            member,
            token,
            fetch,
          )
        : await updateWorkspaceMemberRole(
            localContext,
            workspaceId,
            member,
            next,
            token,
            fetch,
          ),
    );
    if (next === "remove") setRemoveConfirmation("");
  };
  const projectRemovalContext = () => {
    const visible = data?.projects.find((project) => project.id === reclaimProjectId);
    return visible && !localContext.console.projects.some(
      (project) => project.id === visible.id && project.workspaceId === workspaceId,
    )
      ? { ...localContext, console: { projects: [...localContext.console.projects, visible] } }
      : localContext;
  };
  const runArchiveAndDelete = async (context: SaasContext, token: string, alreadyArchived: boolean) => {
    if (removalStep !== "delete" && !alreadyArchived) {
      setRemovalStep("archive");
      const archived = await archiveWorkspaceProject(context, workspaceId, reclaimProjectId, token, fetch);
      if (archived.status !== "ready") {
        setReclaimState(archived.status);
        return;
      }
      setRemovalStep("delete");
    }
    const deleted = await deleteWorkspaceProject(context, workspaceId, reclaimProjectId, token, fetch);
    if (deleted.status !== "ready") {
      setReclaimState(deleted.status);
      setRemovalStep("delete");
      return;
    }
    setRemovalStep("done");
    setReclaimState("ready");
    await reload();
  };
  const submitProjectRemoval = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reclaimConfirmation !== reclaimProjectId || reclaimState === "loading") return;
    setReclaimState("loading");
    const context = projectRemovalContext();
    const token = await getAccessToken();
    if (!token) {
      setReclaimState("auth");
      return;
    }
    if (removalStep === "archive" || removalStep === "delete") {
      if (removalStep === "delete" && reclaimSnapshot?.state !== "deleted") {
        setReclaimState("conflict");
        return;
      }
      await runArchiveAndDelete(context, token, reclaimProjectArchived);
      return;
    }
    let wasArchived = reclaimProjectArchived;
    let reclaimed = await reclaimWorkspaceProjectResources(
      context, workspaceId, reclaimProjectId, reclaimConfirmation, token, fetch,
    );
    if (reclaimed.status === "restore_required") {
      if (!reclaimProjectArchived) {
        setReclaimState("conflict");
        return;
      }
      const restored = await restoreWorkspaceProject(context, workspaceId, reclaimProjectId, token, fetch);
      if (restored.status !== "ready") {
        setReclaimState(restored.status);
        return;
      }
      setReclaimProjectArchived(false);
      wasArchived = false;
      setRemovalStep("reclaim");
      reclaimed = await reclaimWorkspaceProjectResources(
        context, workspaceId, reclaimProjectId, reclaimConfirmation, token, fetch,
      );
    }
    if (reclaimed.status === "restore_required") {
      setReclaimState("conflict");
      return;
    }
    if (reclaimed.status !== "ready") {
      setReclaimState(reclaimed.status);
      return;
    }
    setReclaimSnapshot(reclaimed.data);
    if (reclaimed.data.state !== "deleted") {
      setRemovalStep("reclaim");
      setReclaimState("ready");
      return;
    }
    const alreadyArchived = wasArchived;
    setRemovalStep(alreadyArchived ? "delete" : "archive");
    await runArchiveAndDelete(context, token, alreadyArchived);
  };
  const message = action !== "idle" && action !== "loading" ? t[action] : null;
  return (
    <section
      className="console-key-management console-workspace-lifecycle"
      aria-labelledby="workspace-lifecycle-title"
    >
      <div className="console-panel-heading">
        <div>
          <h3 id="workspace-lifecycle-title">{t.title}</h3>
          <p className="console-note">{t.note}</p>
        </div>
        {workspaceId && (
          <button type="button" onClick={() => void reload()}>
            {t.refresh}
          </button>
        )}
      </div>
      <form
        className="console-inline-form"
        onSubmit={(event) => void submitWorkspace(event)}
      >
        <h4>{t.createWorkspace}</h4>
        <label>
          {t.workspaceName}
          <input
            required
            minLength={2}
            maxLength={80}
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
        </label>
        <label>
          {t.slug}
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            value={workspaceSlug}
            onChange={(event) => setWorkspaceSlug(event.target.value)}
          />
        </label>
        <small>{t.agreements}</small>
        <button className="site-nav-button" disabled={action === "loading"}>
          {t.create}
        </button>
      </form>
      {localContext.authorityPlanes.workspaceMemberships.length === 0 ? (
        <p className="console-empty">{t.empty}</p>
      ) : (
        <>
          <label>
            {t.select}
            <select
              value={workspaceId}
              onChange={(event) => {
                provisioningRequestGeneration.current += 1;
                setWorkspaceId(event.target.value);
                setOneTimeKey("");
                setProjectProvisioning(null);
                setProjectProvisioningStatus("idle");
                setProjectProvisioningAttempts(0);
                setReclaimProjectId("");
                setReclaimConfirmation("");
                setReclaimSnapshot(null);
                setReclaimState("idle");
                setRemovalStep("confirm");
                setReclaimProjectArchived(false);
              }}
            >
              {localContext.authorityPlanes.workspaceMemberships.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.role}
                </option>
              ))}
            </select>
          </label>
          {workspace && (
            <p className="console-boundary-note">
              <strong>
                {t.role}: {workspace.role}
              </strong>
              <span>{t.readOnly}</span>
            </p>
          )}
        </>
      )}
      {loadState === "loading" && <p role="status">{t.loading}</p>}
      {loadState !== "idle" &&
        loadState !== "loading" &&
        loadState !== "ready" && <p role="alert">{t[loadState]}</p>}
      {data && (
        <div className="console-lifecycle-grid">
          <section>
            <h4>{t.projects}</h4>
            {data.projects.length ? (
              <ul className="console-plain-list">
                {data.projects.map((project) => (
                  <li key={project.id}>
                    <strong>{project.name}</strong>
                    <span>{project.id}</span>
                    {project.lifecycleStatus === "archived" && <small>{t.projectArchived}</small>}
                    {canManage && (
                      <button
                        type="button"
                        disabled={projectProvisioningStatus === "loading"}
                        onClick={() => {
                          setOneTimeKey("");
                          void refreshProjectProvisioning(
                            project.id,
                            false,
                            true,
                          );
                        }}
                      >
                        {t.provisioningOpen}
                      </button>
                    )}
                    {workspace?.role === "owner" && (
                      <button type="button" onClick={() => {
                        setReclaimProjectId(project.id);
                        setReclaimConfirmation("");
                        setReclaimSnapshot(null);
                        setReclaimState("idle");
                        setRemovalStep("confirm");
                        setReclaimProjectArchived(project.lifecycleStatus === "archived");
                      }}>{t.reclaim}</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="console-empty">{t.noProjects}</p>
            )}
            {canManage && (
              <form
                className="console-stack-form"
                onSubmit={(event) => void submitProject(event)}
              >
                <label>
                  {t.projectName}
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                  />
                </label>
                <label>
                  {t.projectId}
                  <input
                    required
                    pattern="[A-Za-z0-9._-]{1,128}"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  />
                </label>
                <label>
                  {t.origin}
                  <input
                    required
                    type="url"
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                  />
                </label>
                <label>
                  {t.redirect}
                  <input
                    required
                    type="url"
                    value={redirectUri}
                    onChange={(event) => setRedirectUri(event.target.value)}
                  />
                </label>
                <small>{t.projectSecurity}</small>
                <button
                  className="site-nav-button"
                  disabled={action === "loading"}
                >
                  {t.createProject}
                </button>
              </form>
            )}
            {workspace?.role === "owner" && reclaimProjectId && (
              <section className="console-key-management" aria-labelledby="project-reclaim-title">
                <h5 id="project-reclaim-title">{t.reclaim}: {reclaimProjectId}</h5>
                <p className="console-note">{t.reclaimHelp}</p>
                {removalStep === "done" ? (
                  <p role="status">{t.reclaimDone}</p>
                ) : (
                  <form className="console-stack-form" onSubmit={(event) => void submitProjectRemoval(event)}>
                    <label>{t.reclaimProjectId}<input required value={reclaimConfirmation} onChange={(event) => setReclaimConfirmation(event.target.value)} /></label>
                    <button type="submit" disabled={reclaimState === "loading" || reclaimConfirmation !== reclaimProjectId}>
                      {reclaimState === "loading" ? t.reclaimBusy : removalStep === "confirm" ? t.reclaimSubmit : removalStep === "reclaim" ? reclaimSnapshot?.state === "pending" ? t.reclaimPoll : t.reclaimContinue : t.reclaimRetry}
                    </button>
                  </form>
                )}
                {reclaimSnapshot && (
                  <>
                    <p role="status">{t.reclaimProvider}: {t.wDb} · {t.providerStates[reclaimSnapshot.providers.wDb]} / {t.wDrop} · {t.providerStates[reclaimSnapshot.providers.wDrop]}</p>
                    <p>{t.reclaimState[reclaimSnapshot.state]}</p>
                    {reclaimSnapshot.state !== "deleted" && <p className="console-note">{t.reclaimFailedStep}</p>}
                    {reclaimSnapshot.resources.map((resource) => (
                      <p className="console-boundary-note" key={`${resource.resourceId}:${resource.generation}`}>
                        {t.reclaimResource}: <code>{resource.resourceId}</code> · {t.generation} {resource.generation} · {t.providerStates[resource.status]}
                      </p>
                    ))}
                  </>
                )}
                {reclaimState === "loading" && <p role="status">{t.reclaimBusy}</p>}
                {removalStep !== "confirm" && reclaimState !== "idle" && reclaimState !== "loading" && reclaimState !== "ready" && <p className="console-note">{t.reclaimFailedStep}</p>}
                {reclaimState !== "idle" && reclaimState !== "loading" && reclaimState !== "ready" && <p role="alert">{t[reclaimState]}</p>}
              </section>
            )}
            {oneTimeKey && (
              <div className="console-boundary-note">
                <strong>{t.oneTimeKey}</strong>
                <code>{oneTimeKey}</code>
                <span>{t.oneTimeKeyNote}</span>
              </div>
            )}
            {projectProvisioning && (
              <section
                className="console-key-management"
                aria-labelledby="project-provisioning-title"
              >
                <div className="console-panel-heading">
                  <div>
                    <h5 id="project-provisioning-title">
                      {t.provisioningTitle}
                    </h5>
                    <p className="console-note">{t.provisioningNote}</p>
                  </div>
                  <button
                    type="button"
                    disabled={projectProvisioningStatus === "loading"}
                    onClick={() =>
                      void refreshProjectProvisioning(
                        projectProvisioning.projectId,
                        true,
                        true,
                      )
                    }
                  >
                    {t.provisioningRefresh}
                  </button>
                </div>
                <p className="console-boundary-note" role="status" aria-live="polite">
                  <strong>{projectProvisioning.projectId}</strong>
                  <span>{t.provisioningStates[projectProvisioning.state]}</span>
                  {projectProvisioning.projectUrl && (
                    <code>{projectProvisioning.projectUrl}</code>
                  )}
                </p>
                <div className="console-capabilities">
                  {projectProvisioning.resources.map((resource) => (
                    <article className="console-capability" key={resource.name}>
                      <strong>{t.provisioningResources[resource.name]}</strong>
                      <span
                        className={
                          resource.state === "ready"
                            ? "is-available"
                            : ""
                        }
                      >
                        {t.provisioningStates[resource.state]}
                      </span>
                      <small>{resource.detail}</small>
                      <small>
                        {t.provisioningAttempts}: {resource.attempts}
                      </small>
                    </article>
                  ))}
                </div>
                {projectProvisioningAttempts >= 15 &&
                  projectProvisioning.state === "provisioning" && (
                    <p className="console-boundary-note">{t.provisioningTimeout}</p>
                  )}
                {projectProvisioningStatus !== "idle" &&
                  projectProvisioningStatus !== "loading" &&
                  projectProvisioningStatus !== "ready" && (
                    <p role="alert">{t[projectProvisioningStatus]}</p>
                  )}
              </section>
            )}
          </section>
          <section>
            <h4>{t.members}</h4>
            {data.members.length ? (
              <ul className="console-plain-list">
                {data.members.map((member) => {
                  const protectedMember =
                    member.userId === localContext.self.userId ||
                    member.role === "owner" ||
                    !canManage ||
                    (member.role === "admin" && workspace?.role !== "owner");
                  return (
                    <li key={member.id}>
                      <span>
                        <strong>
                          {member.displayName || member.email || member.userId}
                        </strong>{" "}
                        · {member.role}
                        {member.userId === localContext.self.userId
                          ? ` · ${t.self}`
                          : ""}
                      </span>
                      {protectedMember ? (
                        <small>{t.protected}</small>
                      ) : (
                        <span className="console-row-actions">
                          <select
                            aria-label={`${t.changeRole} ${member.email}`}
                            value={member.role}
                            onChange={(event) =>
                              void mutateMember(
                                member,
                                event.target.value as "admin" | "member",
                              )
                            }
                          >
                            <option value="member">member</option>
                            {workspace?.role === "owner" && (
                              <option value="admin">admin</option>
                            )}
                          </select>
                          <input
                            aria-label={`${t.remove}: ${member.userId}`}
                            placeholder={member.userId}
                            value={removeConfirmation}
                            onChange={(event) => setRemoveConfirmation(event.target.value)}
                          />
                          <button
                            type="button"
                            disabled={removeConfirmation !== member.userId}
                            onClick={() => void mutateMember(member, "remove")}
                          >
                            {t.remove}
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="console-empty">{t.noMembers}</p>
            )}
            {canManage && (
              <form
                className="console-stack-form"
                onSubmit={(event) => void submitInvite(event)}
              >
                <h4>{t.invite}</h4>
                <label>
                  {t.email}
                  <input
                    required
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </label>
                <label>
                  {t.invitationRole}
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as "admin" | "member")
                    }
                  >
                    <option value="member">member</option>
                    {workspace?.role === "owner" && (
                      <option value="admin">admin</option>
                    )}
                  </select>
                </label>
                <button
                  className="site-nav-button"
                  disabled={action === "loading"}
                >
                  {t.sendInvite}
                </button>
              </form>
            )}
          </section>
          <section>
            <h4>{t.invitations}</h4>
            {data.invitations.length ? (
              <ul className="console-plain-list">
                {data.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span>
                      <strong>{invitation.email}</strong> · {invitation.role} ·{" "}
                      {invitation.status}
                    </span>
                    <span className="console-row-actions">
                      <button type="button" disabled>
                        {t.resend}
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || action === "loading"}
                        onClick={() =>
                          void getAccessToken()
                            .then((token) =>
                              revokeWorkspaceInvitation(
                                localContext,
                                workspaceId,
                                invitation.id,
                                token,
                                fetch,
                              ),
                            )
                            .then(finish)
                        }
                      >
                        {t.revoke}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="console-empty">{t.noInvitations}</p>
            )}
            <p className="console-note">{t.resendGap}</p>
          </section>
        </div>
      )}
      {action === "loading" && <p role="status">{t.loading}</p>}
      {message && (
        <p
          role={action === "ready" ? "status" : "alert"}
          className={`console-status ${action === "ready" ? "is-ready" : "is-error"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
