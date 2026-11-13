import { describe, expect, it, vi } from "vitest";
import componentSource from "../components/WorkspaceLifecycleConsole.tsx?raw";
import { normalizeSaasContext, type SaasContext } from "./saasConsole";
import {
  createWorkspace,
  createWorkspaceProject,
  reclaimWorkspaceProjectResources,
  archiveWorkspaceProject,
  restoreWorkspaceProject,
  deleteWorkspaceProject,
  inviteWorkspaceMember,
  loadWorkspaceLifecycle,
  loadWorkspaceProjectProvisioning,
  removeWorkspaceMember,
  retryWorkspaceProjectProvisioning,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from "./workspaceLifecycle";

const payload = {
  schemaVersion: 1,
  self: { user: { id: "usr_self", passwordHash: "drop" } },
  authorityPlanes: {
    platformRole: "user",
    workspaceMemberships: [
      { id: "ws_one", name: "One", role: "owner", tier: "pro" },
    ],
    appUserRelationships: [],
  },
  console: {
    projects: [
      {
        id: "project_one",
        workspaceId: "ws_one",
        name: "One app",
        workspaceRole: "owner",
      },
    ],
  },
};
const context = () => normalizeSaasContext(payload);
const members = () =>
  Response.json({
    data: [
      {
        id: "wsm_self",
        userId: "usr_self",
        role: "owner",
        status: "active",
        joinedAt: 1,
        user: { email: "self@example.com", providerToken: "drop" },
      },
      {
        id: "wsm_member",
        userId: "usr_member",
        role: "member",
        status: "active",
        joinedAt: 2,
        user: { email: "member@example.com", secret: "drop" },
      },
    ],
  });

const provisioningPayload = (
  state: "ready" | "provisioning" | "degraded" = "provisioning",
) => ({
  schema_version: "w-id.project-provisioning/v1",
  workspace_id: "ws_one",
  project_id: "new_app",
  state,
  retry_after_seconds: 2,
  resources: [
    ["identity", "ready", null],
    ["radar", "ready", null],
    ["database", state === "provisioning" ? "pending" : "ready", state === "provisioning" ? "database_resource_pending" : null],
    ["storage", state === "provisioning" ? "pending" : "ready", state === "provisioning" ? "storage_probe_unavailable" : null],
    ["functions", state === "ready" ? "ready" : "pending", state === "ready" ? null : "functions_provider_not_ready"],
    ["sites", state === "degraded" ? "degraded" : state === "ready" ? "ready" : "pending", state === "degraded" ? "sites_project_contract_unavailable" : state === "ready" ? null : "sites_project_contract_pending"],
    ["realtime", state === "provisioning" ? "pending" : "ready", state === "provisioning" ? "realtime_database_pending" : null],
    ["monitoring", "ready", null],
  ].map(([name, status, lastErrorCode], index) => ({
    name,
    status,
    attempts: index,
    last_error_code: lastErrorCode,
    next_attempt_at: null,
    observed_at: 100,
    updated_at: 100,
  })),
});

describe("Workspace lifecycle authority contracts", () => {
  it("retains current subject id while discarding identity secrets", () => {
    const value = context();
    expect(value.self.userId).toBe("usr_self");
    expect(JSON.stringify(value)).not.toMatch(/passwordHash|drop/);
  });

  it("never turns platform administration into customer membership", async () => {
    const admin = normalizeSaasContext({
      ...payload,
      authorityPlanes: {
        platformRole: "super_admin",
        workspaceMemberships: [],
        appUserRelationships: [],
      },
    });
    const request = vi.fn<typeof fetch>();
    await expect(
      loadWorkspaceLifecycle(admin, "ws_one", "token", request),
    ).resolves.toEqual({ status: "forbidden" });
    expect(request).not.toHaveBeenCalled();
  });

  it("loads bounded exact-workspace owner data and allowlists projections", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(members())
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: "project_one", name: "One app", lifecycle_status: "archived", client_secret: "drop" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: "wsi_1",
              email: "new@example.com",
              role: "member",
              status: "pending",
              expiresAt: 9,
              createdAt: 2,
              token: "drop",
            },
          ],
        }),
      );
    const result = await loadWorkspaceLifecycle(
      context(),
      "ws_one",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: {
        canManage: true,
        members: [{ userId: "usr_self" }, { userId: "usr_member" }],
        projects: [{ id: "project_one" }],
        invitations: [{ id: "wsi_1" }],
      },
    });
    if (result.status === "ready") expect(result.data.projects[0]?.lifecycleStatus).toBe("archived");
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/console/workspaces/ws_one/members",
      "/api/console/workspaces/ws_one/projects",
      "/api/console/workspaces/ws_one/invitations",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /client_secret|providerToken|secret|token|drop/,
    );
  });

  it("lets members read without calling manager-only APIs", async () => {
    const memberContext: SaasContext = {
      ...context(),
      authorityPlanes: {
        ...context().authorityPlanes,
        workspaceMemberships: [
          { id: "ws_one", name: "One", role: "member", tier: "free" },
        ],
      },
      console: {
        projects: [
          {
            id: "project_one",
            workspaceId: "ws_one",
            name: "One",
            workspaceRole: "member",
          },
        ],
      },
    };
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(members());
    const result = await loadWorkspaceLifecycle(
      memberContext,
      "ws_one",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: {
        canManage: false,
        projects: [{ id: "project_one" }],
        invitations: [],
      },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("fails closed for viewer and foreign Workspace without network calls", async () => {
    const viewer: SaasContext = {
      ...context(),
      authorityPlanes: {
        ...context().authorityPlanes,
        workspaceMemberships: [
          { id: "ws_one", name: "One", role: "viewer", tier: "free" },
        ],
      },
    };
    const request = vi.fn<typeof fetch>();
    await expect(
      loadWorkspaceLifecycle(viewer, "ws_one", "token", request),
    ).resolves.toEqual({ status: "forbidden" });
    await expect(
      loadWorkspaceLifecycle(context(), "ws_foreign", "token", request),
    ).resolves.toEqual({ status: "forbidden" });
    expect(request).not.toHaveBeenCalled();
  });

  it("creates a Workspace with all published agreements", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            id: "ws_new",
            name: "New team",
            role: "owner",
            tier: "free",
            secret: "drop",
          },
        }),
      );
    const result = await createWorkspace(
      "New team",
      "new-team",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: { id: "ws_new", role: "owner" },
    });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      termsOfService: true,
      privacyPolicy: true,
      dataProcessingAgreement: true,
      aiAcceptableUsePolicy: true,
    });
    expect(JSON.stringify(result)).not.toContain("drop");
  });

  it("creates only a public PKCE project and drops server secrets", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            data: { id: "new_app", name: "New app" },
            W_PROJECT_URL: "https://db.myfastools.com/project/new_app",
            W_PUBLISHABLE_KEY: "wid_pk_safe",
            client_secret: "drop",
            ready: false,
            radarSync: "synced",
            provisioningStatus: "provisioning",
            provisioning: provisioningPayload(),
          },
          { status: 202, headers: { "Retry-After": "3" } },
        ),
      );
    const result = await createWorkspaceProject(
      context(),
      "ws_one",
      {
        id: "new_app",
        name: "New app",
        origin: "https://app.example.com",
        redirectUri: "https://app.example.com/auth/callback",
      },
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: {
        provisioning: "provisioning",
        retryAfterSeconds: 2,
        oneTimePublishableKey: "wid_pk_safe",
        resources: expect.arrayContaining([
          expect.objectContaining({ name: "identity", state: "ready", attempts: 0 }),
          expect.objectContaining({ name: "radar", state: "ready", attempts: 1 }),
        ]),
      },
    });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      tokenEndpointAuthMethod: "none",
    });
    expect(JSON.stringify(result)).not.toMatch(/client_secret|drop/);
  });

  it("reads the durable eight-resource W-ID orchestration matrix", async () => {
    const next: SaasContext = {
      ...context(),
      console: {
        projects: [
          ...context().console.projects,
          {
            id: "new_app",
            workspaceId: "ws_one",
            name: "New app",
            workspaceRole: "owner",
          },
        ],
      },
    };
    const upstream = provisioningPayload("degraded");
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          ...upstream,
          credential_ref: "drop",
          resources: upstream.resources.map((resource, index) =>
            index === 2 ? { ...resource, password: "drop" } : resource,
          ),
        }),
      );
    const result = await loadWorkspaceProjectProvisioning(
      next,
      "ws_one",
      "new_app",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: {
        projectId: "new_app",
        state: "degraded",
        resources: [
          { name: "identity", state: "ready" },
          { name: "radar", state: "ready" },
          { name: "database", state: "ready" },
          { name: "storage", state: "ready" },
          { name: "functions", state: "provisioning" },
          { name: "sites", state: "degraded" },
          { name: "realtime", state: "ready" },
          { name: "monitoring", state: "ready" },
        ],
      },
    });
    expect(request).toHaveBeenCalledWith(
      "/api/console/workspaces/ws_one/projects/new_app/provisioning",
      expect.objectContaining({
        headers: { Authorization: "Bearer token" },
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(
      /publishable_keys|credential|password|token|drop/,
    );
  });

  it("retries the same exact project through W-ID without a create body", async () => {
    const next: SaasContext = {
      ...context(),
      console: {
        projects: [
          ...context().console.projects,
          {
            id: "new_app",
            workspaceId: "ws_one",
            name: "New app",
            workspaceRole: "owner",
          },
        ],
      },
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(provisioningPayload("ready")));
    const result = await retryWorkspaceProjectProvisioning(
      next,
      "ws_one",
      "new_app",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: {
        projectId: "new_app",
        state: "ready",
        resources: expect.arrayContaining([
          expect.objectContaining({ name: "database", state: "ready" }),
          expect.objectContaining({ name: "realtime", state: "ready" }),
          expect.objectContaining({ name: "monitoring", state: "ready" }),
        ]),
      },
    });
    expect(request).toHaveBeenCalledWith(
      "/api/console/workspaces/ws_one/projects/new_app/provisioning/retry",
      {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        credentials: "same-origin",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("reclaims all managed resources for an owner-confirmed exact project and exposes safe provider status", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      success: true,
      data: {
        schema_version: "w-id.project-resource-reclaim/v1",
        workspace_id: "ws_one",
        project_id: "project_one",
        state: "pending",
        providers: { w_db: "pending", w_drop: "not_started" },
        resources: [{ resource_id: "123e4567-e89b-42d3-a456-426614174000", generation: 7, status: "pending", dsn: "drop" }],
        upstream_error: "drop",
      },
    }, { status: 202 }));
    const result = await reclaimWorkspaceProjectResources(
      context(), "ws_one", "project_one", "project_one", "token", request,
    );
    expect(result).toEqual({ status: "ready", data: {
      projectId: "project_one", state: "pending",
      providers: { wDb: "pending", wDrop: "not_started" },
      resources: [{ resourceId: "123e4567-e89b-42d3-a456-426614174000", generation: 7, status: "pending" }],
    } });
    expect(request).toHaveBeenCalledWith(
      "/api/console/workspaces/ws_one/projects/project_one/resources/reclaim",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ confirm_project_id: "project_one" }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/dsn|upstream_error|drop/);
  });

  it("restores archived projects before cleanup, then archives and hard-deletes only through owner routes", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, data: { id: "project_one", lifecycle_status: "active" } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { id: "project_one", lifecycle_status: "archived" } }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    await expect(restoreWorkspaceProject(context(), "ws_one", "project_one", "token", request))
      .resolves.toEqual({ status: "ready", data: { projectId: "project_one", lifecycleStatus: "active" } });
    await expect(archiveWorkspaceProject(context(), "ws_one", "project_one", "token", request))
      .resolves.toEqual({ status: "ready", data: { projectId: "project_one", lifecycleStatus: "archived" } });
    await expect(deleteWorkspaceProject(context(), "ws_one", "project_one", "token", request))
      .resolves.toEqual({ status: "ready", data: { projectId: "project_one" } });
    expect(request.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ["/api/console/workspaces/ws_one/projects/project_one/restore", "POST", undefined],
      ["/api/console/workspaces/ws_one/projects/project_one/archive", "POST", undefined],
      ["/api/console/workspaces/ws_one/projects/project_one", "DELETE", JSON.stringify({ confirm_project_id: "project_one" })],
    ]);
  });

  it("fails closed for non-owners, mismatched confirmations, and malformed reclaim responses", async () => {
    const request = vi.fn<typeof fetch>();
    const adminContext: SaasContext = {
      ...context(),
      authorityPlanes: {
        ...context().authorityPlanes,
        workspaceMemberships: [{ id: "ws_one", name: "One", role: "admin", tier: "free" }],
      },
    };
    await expect(reclaimWorkspaceProjectResources(adminContext, "ws_one", "project_one", "project_one", "token", request))
      .resolves.toEqual({ status: "forbidden" });
    await expect(reclaimWorkspaceProjectResources(context(), "ws_one", "project_one", "other", "token", request))
      .resolves.toEqual({ status: "forbidden" });
    expect(request).not.toHaveBeenCalled();

    request.mockResolvedValueOnce(Response.json({
      success: true,
      data: {
        schema_version: "w-id.project-resource-reclaim/v1",
        workspace_id: "ws_one", project_id: "project_one", state: "deleted",
        providers: { w_db: "deleted", w_drop: "deleted" },
        resources: [{ resource_id: "123e4567-e89b-42d3-a456-426614174000", generation: 7, status: "pending" }],
      },
    }));
    await expect(reclaimWorkspaceProjectResources(context(), "ws_one", "project_one", "project_one", "token", request))
      .resolves.toEqual({ status: "invalid" });

    request.mockResolvedValueOnce(Response.json({ success: true, data: {
      schema_version: "w-id.project-resource-reclaim/v1",
      workspace_id: "ws_one", project_id: "project_one", state: "deleted",
      providers: { w_db: "not_found", w_drop: "failed" }, resources: [],
    } }));
    await expect(reclaimWorkspaceProjectResources(context(), "ws_one", "project_one", "project_one", "token", request))
      .resolves.toEqual({ status: "invalid" });

    request.mockResolvedValueOnce(Response.json({ success: true, data: {
      schema_version: "w-id.project-resource-reclaim/v1",
      workspace_id: "ws_one", project_id: "project_one", state: "deleted",
      providers: { w_db: "not_found", w_drop: "deleted" }, resources: [],
    } }));
    await expect(reclaimWorkspaceProjectResources(context(), "ws_one", "project_one", "project_one", "token", request))
      .resolves.toEqual({ status: "ready", data: {
        projectId: "project_one", state: "deleted",
        providers: { wDb: "not_found", wDrop: "deleted" }, resources: [],
      } });

    request.mockResolvedValueOnce(Response.json(
      { error: "restore_project_before_resource_reclaim" }, { status: 409 },
    ));
    await expect(reclaimWorkspaceProjectResources(context(), "ws_one", "project_one", "project_one", "token", request))
      .resolves.toEqual({ status: "restore_required" });
  });

  it("fails closed when the resource matrix is reordered, incomplete, or aggregate state lies", async () => {
    const next: SaasContext = {
      ...context(),
      console: {
        projects: [
          ...context().console.projects,
          {
            id: "new_app",
            workspaceId: "ws_one",
            name: "New app",
            workspaceRole: "owner",
          },
        ],
      },
    };
    const malformed = provisioningPayload("ready");
    [malformed.resources[0], malformed.resources[1]] = [
      malformed.resources[1],
      malformed.resources[0],
    ];
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(malformed))
      .mockResolvedValueOnce(
        Response.json({ ...provisioningPayload(), state: "ready" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...provisioningPayload("ready"),
          resources: provisioningPayload("ready").resources.filter(
            (resource) => resource.name !== "realtime",
          ),
        }),
      );
    await expect(
      loadWorkspaceProjectProvisioning(
        next,
        "ws_one",
        "new_app",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      loadWorkspaceProjectProvisioning(
        next,
        "ws_one",
        "new_app",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      loadWorkspaceProjectProvisioning(
        next,
        "ws_one",
        "new_app",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("does not verify a foreign or unlisted project", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      loadWorkspaceProjectProvisioning(
        context(),
        "ws_one",
        "foreign",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "forbidden" });
    expect(request).not.toHaveBeenCalled();
  });

  it("discards invitation token and invite URL", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "wsi_1",
            email: "new@example.com",
            role: "member",
            token: "drop",
            inviteUrl: "https://x/?token=drop",
          },
          { status: 201 },
        ),
      );
    const result = await inviteWorkspaceMember(
      context(),
      "ws_one",
      "New@Example.com",
      "member",
      "token",
      request,
    );
    expect(result).toMatchObject({
      status: "ready",
      data: { email: "new@example.com" },
    });
    expect(JSON.stringify(result)).not.toMatch(/inviteUrl|drop/);
  });

  it("protects current subject, owner, and cross-tenant mutations", async () => {
    const request = vi.fn<typeof fetch>();
    const self = {
      id: "wsm_self",
      userId: "usr_self",
      email: "",
      role: "member" as const,
      status: "active",
      joinedAt: 1,
    };
    const owner = {
      ...self,
      id: "wsm_owner",
      userId: "usr_owner",
      role: "owner" as const,
    };
    await expect(
      removeWorkspaceMember(context(), "ws_one", self, "token", request),
    ).resolves.toEqual({ status: "forbidden" });
    await expect(
      updateWorkspaceMemberRole(
        context(),
        "ws_one",
        owner,
        "member",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "forbidden" });
    await expect(
      revokeWorkspaceInvitation(
        context(),
        "ws_foreign",
        "wsi_1",
        "token",
        request,
      ),
    ).resolves.toEqual({ status: "forbidden" });
    expect(request).not.toHaveBeenCalled();
  });

  it("uses exact mutation routes for owner actions", async () => {
    const member = {
      id: "wsm_member",
      userId: "usr_member",
      email: "m@example.com",
      role: "member" as const,
      status: "active",
      joinedAt: 1,
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ success: true }));
    await updateWorkspaceMemberRole(
      context(),
      "ws_one",
      member,
      "admin",
      "token",
      request,
    );
    await removeWorkspaceMember(context(), "ws_one", member, "token", request);
    await revokeWorkspaceInvitation(
      context(),
      "ws_one",
      "wsi_1",
      "token",
      request,
    );
    expect(
      request.mock.calls.map(([url, init]) => `${init?.method} ${url}`),
    ).toEqual([
      "PUT /api/console/workspaces/ws_one/members/usr_member/role",
      "DELETE /api/console/workspaces/ws_one/members/usr_member",
      "DELETE /api/console/workspaces/ws_one/invitations/wsi_1",
    ]);
  });

  it("ships EN/ZH, empty states and disabled resend", () => {
    expect(componentSource).toContain("Workspaces & team");
    expect(componentSource).toContain("Workspace 与团队");
    expect(componentSource).toContain('realtime: "Realtime"');
    expect(componentSource).toContain("Sites、Realtime 与监控绑定");
    expect(componentSource).toContain("console-empty");
    expect(componentSource).toContain('reclaim: "Delete project and its resources"');
    expect(componentSource).toContain("setReclaimConfirmation(\"\")");
    expect(componentSource).toContain("reclaimConfirmation !== reclaimProjectId");
    expect(componentSource).toContain("workspace?.role === \"owner\" && reclaimProjectId");
    expect(componentSource).toContain("Archived projects are restored temporarily");
    expect(componentSource).toContain("archiveWorkspaceProject");
    expect(componentSource).toContain("restoreWorkspaceProject");
    expect(componentSource).toContain("deleteWorkspaceProject");
    expect(componentSource).toContain('if (reclaimed.data.state !== "deleted")');
    expect(componentSource).toMatch(/<button type="button" disabled>[\s\S]*?\{t\.resend\}/);
    expect(componentSource).not.toMatch(
      /localStorage|sessionStorage|client_secret/,
    );
  });
});
