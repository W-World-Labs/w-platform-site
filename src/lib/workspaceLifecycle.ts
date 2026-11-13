import type {
  ConsoleProject,
  SaasContext,
  WorkspaceMembership,
} from "./saasConsole";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type LifecycleStatus =
  | "ready"
  | "auth"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "restore_required"
  | "network";
export type LifecycleResult<T> =
  | { status: "ready"; data: T }
  | { status: Exclude<LifecycleStatus, "ready"> };
export interface WorkspaceMember {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  role: Exclude<WorkspaceRole, "viewer">;
  status: string;
  joinedAt: number;
}
export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: "admin" | "member";
  status: string;
  expiresAt: number;
  createdAt: number;
}
export interface WorkspaceLifecycleData {
  workspace: WorkspaceMembership;
  canManage: boolean;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  projects: ConsoleProject[];
}
export interface CreatedProject {
  id: string;
  name: string;
  projectUrl?: string;
  provisioning: "ready" | "provisioning" | "degraded";
  radarProjectId?: string;
  retryAfterSeconds: number;
  resources: ProjectProvisioningResource[];
  oneTimePublishableKey?: string;
}

export type ProjectProvisioningResourceName =
  | "identity"
  | "radar"
  | "database"
  | "storage"
  | "functions"
  | "sites"
  | "realtime"
  | "monitoring";
export type ProjectProvisioningResourceState =
  | "ready"
  | "provisioning"
  | "degraded";
export interface ProjectProvisioningResource {
  name: ProjectProvisioningResourceName;
  state: ProjectProvisioningResourceState;
  detail: string;
  attempts: number;
}
export interface ProjectProvisioningSnapshot {
  projectId: string;
  state: "ready" | "provisioning" | "degraded";
  retryAfterSeconds: number;
  resources: ProjectProvisioningResource[];
  projectUrl?: string;
}

export interface ProjectResourceReclaimSnapshot {
  projectId: string;
  state: "deleted" | "pending" | "failed" | "not_found";
  providers: {
    wDb: "deleted" | "pending" | "failed" | "not_found";
    wDrop: "deleted" | "failed" | "not_started";
  };
  resources: Array<{
    resourceId: string;
    generation: number;
    status: "deleted" | "pending" | "failed";
  }>;
}

export type ProjectLifecycleStatus = "active" | "archived";

const ID = /^[A-Za-z0-9._-]{1,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORIGIN = /^https:\/\/[^\s/]+(?::\d+)?$/;
const PROVISIONING_SCHEMA = "w-id.project-provisioning/v1";
const RESOURCE_RECLAIM_SCHEMA = "w-id.project-resource-reclaim/v1";
const PROVISIONING_RESOURCES: readonly ProjectProvisioningResourceName[] = [
  "identity",
  "radar",
  "database",
  "storage",
  "functions",
  "sites",
  "realtime",
  "monitoring",
];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
function role(value: unknown): WorkspaceRole | null {
  return ["owner", "admin", "member", "viewer"].includes(text(value))
    ? (text(value) as WorkspaceRole)
    : null;
}
function mutationFailure(response: Response): LifecycleResult<never> | null {
  if (response.ok) return null;
  if (response.status === 401) return { status: "auth" };
  if (response.status === 403 || response.status === 404)
    return { status: "forbidden" };
  if (response.status === 409) return { status: "conflict" };
  return response.status >= 500 ? { status: "network" } : { status: "invalid" };
}
function bearer(token: string | null): Record<string, string> | null {
  return token ? { Authorization: `Bearer ${token}` } : null;
}
function membership(
  context: SaasContext,
  workspaceId: string,
): WorkspaceMembership | undefined {
  return context.authorityPlanes.workspaceMemberships.find(
    (item) => item.id === workspaceId,
  );
}
function safeWorkspace(
  context: SaasContext,
  workspaceId: string,
): WorkspaceMembership | undefined {
  const item = membership(context, workspaceId);
  return item && ID.test(workspaceId) && role(item.role) ? item : undefined;
}
function headers(token: string, json = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export async function loadWorkspaceLifecycle(
  context: SaasContext,
  workspaceId: string,
  token: string | null,
  request: typeof fetch,
  signal?: AbortSignal,
): Promise<LifecycleResult<WorkspaceLifecycleData>> {
  const workspace = safeWorkspace(context, workspaceId);
  const auth = bearer(token);
  if (!workspace) return { status: "forbidden" };
  if (!auth) return { status: "auth" };
  const workspaceRole = role(workspace.role)!;
  if (workspaceRole === "viewer") return { status: "forbidden" };
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";
  try {
    const membersResponse = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/members`,
      { headers: auth, credentials: "same-origin", cache: "no-store", signal },
    );
    const failure = mutationFailure(membersResponse);
    if (failure) return failure;
    const [projectsResponse, invitationsResponse] = canManage
      ? await Promise.all([
          request(
            `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects`,
            {
              headers: auth,
              credentials: "same-origin",
              cache: "no-store",
              signal,
            },
          ),
          request(
            `/api/console/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
            {
              headers: auth,
              credentials: "same-origin",
              cache: "no-store",
              signal,
            },
          ),
        ])
      : [null, null];
    for (const response of [projectsResponse, invitationsResponse]) {
      if (response) {
        const denied = mutationFailure(response);
        if (denied) return denied;
      }
    }
    const memberRoot = record(await membersResponse.json());
    const rawMembers =
      memberRoot &&
      (Array.isArray(memberRoot.data)
        ? memberRoot.data
        : Array.isArray(memberRoot.members)
          ? memberRoot.members
          : null);
    if (!rawMembers || rawMembers.length > 200) return { status: "invalid" };
    const members = rawMembers.flatMap((value): WorkspaceMember[] => {
      const item = record(value);
      const user = record(item?.user);
      const memberRole = role(item?.role);
      const id = text(item?.id);
      const userId = text(item?.userId) || text(item?.user_id);
      if (
        !id ||
        !userId ||
        !ID.test(id) ||
        !ID.test(userId) ||
        !memberRole ||
        memberRole === "viewer"
      )
        return [];
      return [
        {
          id,
          userId,
          email: text(user?.email),
          displayName:
            text(user?.displayName) || text(user?.display_name) || undefined,
          role: memberRole,
          status: text(item?.status),
          joinedAt: Number(item?.joinedAt ?? item?.joined_at) || 0,
        },
      ];
    });
    if (members.length !== rawMembers.length) return { status: "invalid" };
    let projects = context.console.projects.filter(
      (project) => project.workspaceId === workspaceId,
    );
    if (projectsResponse) {
      const root = record(await projectsResponse.json());
      const raw = root && Array.isArray(root.data) ? root.data : null;
      if (!raw || raw.length > 100) return { status: "invalid" };
      projects = raw.flatMap((value): ConsoleProject[] => {
        const item = record(value);
        const id = text(item?.id);
        const lifecycleStatus = text(item?.lifecycleStatus) || text(item?.lifecycle_status);
        return id && ID.test(id)
          ? [
              {
                id,
                workspaceId,
                name: text(item?.name) || id,
                workspaceRole: workspace.role,
                ...(lifecycleStatus === "active" || lifecycleStatus === "archived"
                  ? { lifecycleStatus }
                  : {}),
              },
            ]
          : [];
      });
      if (projects.length !== raw.length) return { status: "invalid" };
    }
    let invitations: WorkspaceInvitation[] = [];
    if (invitationsResponse) {
      const root = record(await invitationsResponse.json());
      const raw =
        root &&
        (Array.isArray(root.data)
          ? root.data
          : Array.isArray(root.invitations)
            ? root.invitations
            : null);
      if (!raw || raw.length > 100) return { status: "invalid" };
      invitations = raw.flatMap((value): WorkspaceInvitation[] => {
        const item = record(value);
        const inviteRole = text(item?.role);
        const id = text(item?.id);
        const email = text(item?.email);
        return id &&
          ID.test(id) &&
          EMAIL.test(email) &&
          ["admin", "member"].includes(inviteRole)
          ? [
              {
                id,
                email,
                role: inviteRole as "admin" | "member",
                status: text(item?.status),
                expiresAt: Number(item?.expiresAt ?? item?.expires_at) || 0,
                createdAt: Number(item?.createdAt ?? item?.created_at) || 0,
              },
            ]
          : [];
      });
      if (invitations.length !== raw.length) return { status: "invalid" };
    }
    return {
      status: "ready",
      data: { workspace, canManage, members, invitations, projects },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { status: "network" };
  }
}

export async function createWorkspace(
  name: string,
  slug: string,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<WorkspaceMembership>> {
  const trimmed = name.trim();
  const normalizedSlug = slug.trim();
  if (
    trimmed.length < 2 ||
    trimmed.length > 80 ||
    !/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedSlug)
  )
    return { status: "invalid" };
  if (!token) return { status: "auth" };
  try {
    const response = await request("/api/console/workspaces", {
      method: "POST",
      headers: headers(token, true),
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        name: trimmed,
        slug: normalizedSlug,
        termsOfService: true,
        privacyPolicy: true,
        dataProcessingAgreement: true,
        aiAcceptableUsePolicy: true,
      }),
    });
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const data = record(root?.data);
    const id = text(data?.id);
    return id && ID.test(id) && data?.role === "owner"
      ? {
          status: "ready",
          data: {
            id,
            name: text(data.name) || trimmed,
            role: "owner",
            tier: text(data.tier) || "free",
            workspaceType: "team",
          },
        }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

export async function createWorkspaceProject(
  context: SaasContext,
  workspaceId: string,
  input: { name: string; id: string; origin: string; redirectUri: string },
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<CreatedProject>> {
  const workspace = safeWorkspace(context, workspaceId);
  if (!workspace || !["owner", "admin"].includes(workspace.role))
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  if (
    input.name.trim().length < 2 ||
    input.name.trim().length > 80 ||
    !ID.test(input.id) ||
    !ORIGIN.test(input.origin) ||
    !input.redirectUri.startsWith(`${input.origin}/`)
  )
    return { status: "invalid" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      {
        method: "POST",
        headers: headers(token, true),
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          id: input.id,
          name: input.name.trim(),
          tokenEndpointAuthMethod: "none",
          redirectUris: [input.redirectUri],
          allowedOrigins: [input.origin],
          allowedScopes: ["openid", "email", "profile"],
        }),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const data = record(root?.data);
    const id = text(data?.id);
    const key = text(root?.W_PUBLISHABLE_KEY);
    const projectUrl = safeHttpsUrl(root?.W_PROJECT_URL);
    const radarProjectId = text(data?.radarProjectId) || text(data?.radar_project_id);
    const provisioning = parseProjectProvisioningSnapshot(
      root?.provisioning,
      workspaceId,
      input.id,
      projectUrl,
    );
    return id === input.id &&
      (!key || /^wid_pk_[A-Za-z0-9_-]+$/.test(key)) &&
      (!radarProjectId || ID.test(radarProjectId)) &&
      provisioning
      ? {
          status: "ready",
          data: {
            id,
            name: text(data?.name) || input.name.trim(),
            ...(projectUrl ? { projectUrl } : {}),
            provisioning: provisioning.state,
            ...(radarProjectId ? { radarProjectId } : {}),
            retryAfterSeconds: provisioning.retryAfterSeconds,
            resources: provisioning.resources,
            ...(key ? { oneTimePublishableKey: key } : {}),
          },
        }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

function parseProjectProvisioningSnapshot(
  value: unknown,
  workspaceId: string,
  projectId: string,
  projectUrl?: string,
): ProjectProvisioningSnapshot | null {
  const root = record(value);
  const state = text(root?.state);
  const retryAfterSeconds = Number(root?.retry_after_seconds);
  const rawResources = Array.isArray(root?.resources) ? root.resources : null;
  if (
    root?.schema_version !== PROVISIONING_SCHEMA ||
    root?.workspace_id !== workspaceId ||
    root?.project_id !== projectId ||
    !["ready", "provisioning", "degraded"].includes(state) ||
    !Number.isInteger(retryAfterSeconds) ||
    retryAfterSeconds < 1 ||
    retryAfterSeconds > 30 ||
    rawResources?.length !== PROVISIONING_RESOURCES.length
  )
    return null;
  const resources = rawResources.flatMap(
    (value, index): ProjectProvisioningResource[] => {
      const item = record(value);
      const name = text(item?.name);
      const status = text(item?.status);
      const attempts = Number(item?.attempts);
      const errorCode = item?.last_error_code;
      if (
        name !== PROVISIONING_RESOURCES[index] ||
        !["pending", "running", "ready", "degraded"].includes(status) ||
        !Number.isInteger(attempts) ||
        attempts < 0 ||
        attempts > 1_000_000 ||
        !(
          errorCode === null ||
          (typeof errorCode === "string" &&
            /^[a-z0-9_.-]{1,80}$/.test(errorCode))
        )
      )
        return [];
      return [
        {
          name: name as ProjectProvisioningResourceName,
          state:
            status === "ready"
              ? "ready"
              : status === "degraded"
                ? "degraded"
                : "provisioning",
          detail: errorCode || `status_${status}`,
          attempts,
        },
      ];
    },
  );
  if (resources.length !== PROVISIONING_RESOURCES.length) return null;
  const derivedState = resources.some((resource) => resource.state === "degraded")
    ? "degraded"
    : resources.every((resource) => resource.state === "ready")
      ? "ready"
      : "provisioning";
  if (derivedState !== state) return null;
  return {
    projectId,
    state: state as ProjectProvisioningSnapshot["state"],
    retryAfterSeconds,
    resources,
    ...(projectUrl ? { projectUrl } : {}),
  };
}

/**
 * Read W-ID's durable exact-project orchestration matrix. Provider discovery,
 * retries and credentials remain behind W-ID; the browser never assembles a
 * cross-service readiness claim from unrelated responses.
 */
export async function loadWorkspaceProjectProvisioning(
  context: SaasContext,
  workspaceId: string,
  projectId: string,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<ProjectProvisioningSnapshot>> {
  const workspace = safeWorkspace(context, workspaceId);
  const project = context.console.projects.find(
    (item) => item.id === projectId && item.workspaceId === workspaceId,
  );
  if (!workspace || !project || !["owner", "admin"].includes(workspace.role))
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/provisioning`,
      {
        headers: headers(token),
        credentials: "same-origin" as const,
        cache: "no-store" as const,
        signal: AbortSignal.timeout(15_000),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    const snapshot = parseProjectProvisioningSnapshot(
      await response.json(),
      workspaceId,
      projectId,
    );
    return snapshot
      ? { status: "ready", data: snapshot }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

export async function retryWorkspaceProjectProvisioning(
  context: SaasContext,
  workspaceId: string,
  projectId: string,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<ProjectProvisioningSnapshot>> {
  const workspace = safeWorkspace(context, workspaceId);
  const project = context.console.projects.find(
    (item) => item.id === projectId && item.workspaceId === workspaceId,
  );
  if (!workspace || !project || !["owner", "admin"].includes(workspace.role))
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/provisioning/retry`,
      {
        method: "POST",
        headers: headers(token),
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    const snapshot = parseProjectProvisioningSnapshot(
      await response.json(),
      workspaceId,
      projectId,
    );
    return snapshot
      ? { status: "ready", data: snapshot }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

/** Reclaim exact-project resources through W-ID; provider credentials and
 * upstream errors remain server-side. */
export async function reclaimWorkspaceProjectResources(
  context: SaasContext,
  workspaceId: string,
  projectId: string,
  confirmation: string,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<ProjectResourceReclaimSnapshot>> {
  const workspace = safeWorkspace(context, workspaceId);
  const project = context.console.projects.find(
    (item) => item.id === projectId && item.workspaceId === workspaceId,
  );
  if (
    !workspace || workspace.role !== "owner" || !project ||
    confirmation !== projectId
  ) return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/resources/reclaim`,
      {
        method: "POST",
        headers: headers(token, true),
        credentials: "same-origin",
        cache: "no-store",
        // W-ID bounds the W-DB + W-Drop reclamation response at 30 seconds.
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ confirm_project_id: confirmation }),
      },
    );
    if (response.status === 409) {
      const body = record(await response.clone().json().catch(() => null));
      if (text(body?.error) === "restore_project_before_resource_reclaim")
        return { status: "restore_required" };
    }
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const data = record(root?.data);
    const rawResources = Array.isArray(data?.resources) ? data.resources : null;
    const providers = record(data?.providers);
    const state = text(data?.state);
    if (
      root?.success !== true ||
      data?.schema_version !== RESOURCE_RECLAIM_SCHEMA ||
      data?.workspace_id !== workspaceId ||
      data?.project_id !== projectId ||
      !["deleted", "pending", "failed", "not_found"].includes(state) ||
      !providers ||
      !["deleted", "pending", "failed", "not_found"].includes(text(providers.w_db)) ||
      !["deleted", "failed", "not_started"].includes(text(providers.w_drop)) ||
      !rawResources || rawResources.length > 100
    ) return { status: "invalid" };
    const resources = rawResources.flatMap((value): ProjectResourceReclaimSnapshot["resources"] => {
      const item = record(value);
      const resourceId = text(item?.resource_id);
      const generation = item?.generation;
      const status = text(item?.status);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId) ||
          !Number.isSafeInteger(generation) || Number(generation) < 0 ||
          !["deleted", "pending", "failed"].includes(status)) return [];
      return [{ resourceId, generation: Number(generation), status: status as "deleted" | "pending" | "failed" }];
    });
    if (resources.length !== rawResources.length) return { status: "invalid" };
    const wDbState = text(providers.w_db);
    const wDropState = text(providers.w_drop);
    if (state === "deleted" &&
        (!(wDbState === "deleted" || wDbState === "not_found") || wDropState !== "deleted" ||
          resources.some((resource) => resource.status !== "deleted")))
      return { status: "invalid" };
    if (state === "pending" &&
        (wDbState !== "pending" || wDropState !== "not_started" ||
          !resources.some((resource) => resource.status === "pending")))
      return { status: "invalid" };
    return {
      status: "ready",
      data: {
        projectId,
        state: state as ProjectResourceReclaimSnapshot["state"],
        providers: {
          wDb: wDbState as ProjectResourceReclaimSnapshot["providers"]["wDb"],
          wDrop: wDropState as ProjectResourceReclaimSnapshot["providers"]["wDrop"],
        },
        resources,
      },
    };
  } catch {
    return { status: "network" };
  }
}

async function workspaceProjectLifecycleMutation(
  context: SaasContext,
  workspaceId: string,
  projectId: string,
  action: "archive" | "restore" | "delete",
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<{ projectId: string; lifecycleStatus?: ProjectLifecycleStatus }>> {
  const workspace = safeWorkspace(context, workspaceId);
  const project = context.console.projects.find((item) => item.id === projectId && item.workspaceId === workspaceId);
  if (!workspace || workspace.role !== "owner" || !project) return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const base = `/api/console/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`;
    const response = await request(
      action === "delete" ? base : `${base}/${action}`,
      {
        method: action === "delete" ? "DELETE" : "POST",
        headers: headers(token, action === "delete"),
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        ...(action === "delete" ? { body: JSON.stringify({ confirm_project_id: projectId }) } : {}),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    if (root?.success !== true) return { status: "invalid" };
    if (action === "delete") return { status: "ready", data: { projectId } };
    const data = record(root.data);
    const expected = action === "archive" ? "archived" : "active";
    const lifecycleStatus = text(data?.lifecycle_status) || text(data?.lifecycleStatus);
    return text(data?.id) === projectId && lifecycleStatus === expected
      ? { status: "ready", data: { projectId, lifecycleStatus: expected } }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

export const archiveWorkspaceProject = (
  context: SaasContext, workspaceId: string, projectId: string,
  token: string | null, request: typeof fetch,
) => workspaceProjectLifecycleMutation(context, workspaceId, projectId, "archive", token, request);

export const restoreWorkspaceProject = (
  context: SaasContext, workspaceId: string, projectId: string,
  token: string | null, request: typeof fetch,
) => workspaceProjectLifecycleMutation(context, workspaceId, projectId, "restore", token, request);

export const deleteWorkspaceProject = (
  context: SaasContext, workspaceId: string, projectId: string,
  token: string | null, request: typeof fetch,
) => workspaceProjectLifecycleMutation(context, workspaceId, projectId, "delete", token, request);

export async function inviteWorkspaceMember(
  context: SaasContext,
  workspaceId: string,
  email: string,
  inviteRole: "admin" | "member",
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<WorkspaceInvitation>> {
  const workspace = safeWorkspace(context, workspaceId);
  const normalized = email.trim().toLowerCase();
  if (!workspace || !["owner", "admin"].includes(workspace.role))
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  if (
    !EMAIL.test(normalized) ||
    !["admin", "member"].includes(inviteRole) ||
    (inviteRole === "admin" && workspace.role !== "owner")
  )
    return { status: "invalid" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      {
        method: "POST",
        headers: headers(token, true),
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: normalized, role: inviteRole }),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    const root = record(await response.json());
    const id = text(root?.id);
    return id &&
      ID.test(id) &&
      text(root?.email) === normalized &&
      text(root?.role) === inviteRole
      ? {
          status: "ready",
          data: {
            id,
            email: normalized,
            role: inviteRole,
            status: "pending",
            expiresAt: 0,
            createdAt: Math.floor(Date.now() / 1000),
          },
        }
      : { status: "invalid" };
  } catch {
    return { status: "network" };
  }
}

async function exactMemberMutation(
  context: SaasContext,
  workspaceId: string,
  member: WorkspaceMember,
  method: "PUT" | "DELETE",
  nextRole: "admin" | "member" | null,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<{ memberId: string; role?: "admin" | "member" }>> {
  const workspace = safeWorkspace(context, workspaceId);
  if (
    !workspace ||
    !["owner", "admin"].includes(workspace.role) ||
    member.userId === context.self.userId ||
    member.role === "owner" ||
    (member.role === "admin" && workspace.role !== "owner") ||
    (nextRole === "admin" && workspace.role !== "owner")
  )
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const suffix = method === "PUT" ? "/role" : "";
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(member.userId)}${suffix}`,
      {
        method,
        headers: headers(token, method === "PUT"),
        credentials: "same-origin",
        cache: "no-store",
        ...(method === "PUT"
          ? { body: JSON.stringify({ role: nextRole }) }
          : {}),
      },
    );
    const failure = mutationFailure(response);
    if (failure) return failure;
    return {
      status: "ready",
      data: {
        memberId: member.userId,
        ...(nextRole ? { role: nextRole } : {}),
      },
    };
  } catch {
    return { status: "network" };
  }
}
export const updateWorkspaceMemberRole = (
  context: SaasContext,
  workspaceId: string,
  member: WorkspaceMember,
  nextRole: "admin" | "member",
  token: string | null,
  request: typeof fetch,
) =>
  exactMemberMutation(
    context,
    workspaceId,
    member,
    "PUT",
    nextRole,
    token,
    request,
  );
export const removeWorkspaceMember = (
  context: SaasContext,
  workspaceId: string,
  member: WorkspaceMember,
  token: string | null,
  request: typeof fetch,
) =>
  exactMemberMutation(
    context,
    workspaceId,
    member,
    "DELETE",
    null,
    token,
    request,
  );

export async function revokeWorkspaceInvitation(
  context: SaasContext,
  workspaceId: string,
  invitationId: string,
  token: string | null,
  request: typeof fetch,
): Promise<LifecycleResult<{ invitationId: string }>> {
  const workspace = safeWorkspace(context, workspaceId);
  if (
    !workspace ||
    !["owner", "admin"].includes(workspace.role) ||
    !ID.test(invitationId)
  )
    return { status: "forbidden" };
  if (!token) return { status: "auth" };
  try {
    const response = await request(
      `/api/console/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}`,
      {
        method: "DELETE",
        headers: headers(token),
        credentials: "same-origin",
        cache: "no-store",
      },
    );
    const failure = mutationFailure(response);
    return failure || { status: "ready", data: { invitationId } };
  } catch {
    return { status: "network" };
  }
}
