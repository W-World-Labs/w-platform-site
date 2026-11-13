import { useEffect, useState } from 'react';
import { localizedHref, type Lang } from '../i18n';
import { PRODUCTS } from '../data/products';
import type { FleetPlatform, FleetPlatformDetail, FleetPlatformStatus } from './fleetPlatformTypes';

type Link = { label: string; product?: string; url?: string };
type Group = { title: string; mission: string; entries: Link[]; modules: string[] };
type Phase = { title: string; goal: string; acceptance: string };
type Consolidation = { title: string; candidate: string; gate: string };
type VisionLayer = { title: string; description: string };

const GROUPS: Record<Lang, Group[]> = {
  en: [
    { title: 'Shared foundations', mission: 'Identity, data, storage, compute and discovery capabilities that other products can build on.', entries: [{ label: 'W-ID', product: 'w-id' }, { label: 'W-MaaS', product: 'w-maas' }, { label: 'W-ModelGW', product: 'w-modelgw' }, { label: 'W-Search', product: 'w-search' }, { label: 'W-DaaS', product: 'w-daas' }], modules: ['W-DB', 'W-Storage', 'W-Sandbox', 'W-Compute', 'GeoLibre', 'W-Commons'] },
    { title: 'Fleet operations', mission: 'Shared visibility, project coordination and operator tools for the platform.', entries: [{ label: 'W-Radar', product: 'w-radar' }], modules: ['W-Monitor', 'W-CLI', 'Gitea', 'License', 'W-Activities', 'Skills'] },
    { title: 'Research & knowledge', mission: 'Find, collect, organize and evaluate research and technical knowledge.', entries: [{ label: 'W-Papers', url: 'https://papers.hzct.obscura.work/' }, { label: 'arXiv', url: 'https://arxiv.hzct.obscura.work/' }, { label: 'W-Craw', url: 'https://craw.myfastools.com/' }, { label: 'W-Knowledge', product: 'w-knowledge' }, { label: 'W-JCR', product: 'w-jcr' }, { label: 'Bench', url: 'https://ai.0.af/' }], modules: ['DOI Catalog', 'AutoML', 'DoMath', 'Patent Atlas'] },
    { title: 'Worlds & simulation', mission: 'Independent simulation and interactive world products with their own engines.', entries: [{ label: 'WaveWorld', url: 'https://labs.auto.ml/' }], modules: ['Sim', 'MyWorld', 'Games'] },
    { title: 'Sensing & safety', mission: 'Collect signals, inspect environments and support security research workflows.', entries: [{ label: 'W-NetSense', product: 'w-netsense' }, { label: 'W-OmniSense', product: 'w-omnisense' }, { label: 'W-NVR', product: 'w-nvr' }], modules: ['NetSense federation: CT, Honeynet, Observer, Probe, DHT, Diting/Listen, W-Defense/Shield', 'Fingerprint', 'Annotation and training tools'] },
    { title: 'Language & creation', mission: 'Tools for translation, learning, media creation and personal productivity.', entries: [{ label: 'W-Translate', product: 'w-translate' }, { label: 'LingoLearn', url: 'https://llearn.myfastools.com/' }, { label: 'Presentation', url: 'https://ppt.auto.ml/' }, { label: 'TinyImage', url: 'https://tinyimage-884.pages.dev/' }], modules: ['BG', 'MacPlayer', 'TTS research', 'NoNoise'] },
    { title: 'Industry & intelligence', mission: 'Domain tools for quantitative research, global context and operational workflows.', entries: [{ label: 'W-Quant', product: 'w-quant' }, { label: 'WorldMonitor', url: 'https://worldmonitor.myfastools.com/' }, { label: 'W-ERP', product: 'w-erp' }, { label: 'W-Hospital', product: 'w-hospital' }], modules: [] },
    { title: 'Publishing & connection', mission: 'Move files, manage domains and connect products with publishing and delivery services.', entries: [{ label: 'W-Transfer', product: 'w-transfer' }, { label: 'W-Collect', product: 'w-collect' }, { label: 'OpenDrop', url: 'https://opendrop.myfastools.com/' }, { label: 'W-Domain', product: 'w-domain' }], modules: ['Star', 'Site', 'Blogs', 'CDN'] },
  ],
  zh: [
    { title: '共享基础能力', mission: '为其他产品提供身份、数据、存储、算力与检索能力。', entries: [{ label: 'W-ID', product: 'w-id' }, { label: 'W-MaaS', product: 'w-maas' }, { label: 'W-ModelGW', product: 'w-modelgw' }, { label: 'W-Search', product: 'w-search' }, { label: 'W-DaaS', product: 'w-daas' }], modules: ['W-DB', 'W-Storage', 'W-Sandbox', 'W-Compute', 'GeoLibre', 'W-Commons'] },
    { title: '舰队运营', mission: '为平台提供共享可观测性、项目协作与运维工具。', entries: [{ label: 'W-Radar', product: 'w-radar' }], modules: ['W-Monitor', 'W-CLI', 'Gitea', 'License', 'W-Activities', 'Skills'] },
    { title: '研究与知识', mission: '发现、收集、组织和评估研究资料与技术知识。', entries: [{ label: 'W-Papers', url: 'https://papers.hzct.obscura.work/' }, { label: 'arXiv', url: 'https://arxiv.hzct.obscura.work/' }, { label: 'W-Craw', url: 'https://craw.myfastools.com/' }, { label: 'W-Knowledge', product: 'w-knowledge' }, { label: 'W-JCR', product: 'w-jcr' }, { label: 'Bench', url: 'https://ai.0.af/' }], modules: ['DOI Catalog', 'AutoML', 'DoMath', 'Patent Atlas'] },
    { title: '世界与仿真', mission: '由独立内核驱动的仿真与交互式世界产品。', entries: [{ label: 'WaveWorld', url: 'https://labs.auto.ml/' }], modules: ['Sim', 'MyWorld', 'Games'] },
    { title: '感知与安全', mission: '采集信号、观察环境，并支持安全研究工作流。', entries: [{ label: 'W-NetSense', product: 'w-netsense' }, { label: 'W-OmniSense', product: 'w-omnisense' }, { label: 'W-NVR', product: 'w-nvr' }], modules: ['NetSense 联邦成员：CT、Honeynet、Observer、Probe、DHT、Diting/Listen、W-Defense/Shield', 'Fingerprint', '标注与训练工具'] },
    { title: '语言与创作', mission: '面向翻译、学习、媒体创作和个人效率的工具。', entries: [{ label: 'W-Translate', product: 'w-translate' }, { label: 'LingoLearn', url: 'https://llearn.myfastools.com/' }, { label: 'Presentation', url: 'https://ppt.auto.ml/' }, { label: 'TinyImage', url: 'https://tinyimage-884.pages.dev/' }], modules: ['BG', 'MacPlayer', 'TTS 研究', 'NoNoise'] },
    { title: '行业与情报', mission: '服务于量化研究、全球信息和行业运营流程的领域工具。', entries: [{ label: 'W-Quant', product: 'w-quant' }, { label: 'WorldMonitor', url: 'https://worldmonitor.myfastools.com/' }, { label: 'W-ERP', product: 'w-erp' }, { label: 'W-Hospital', product: 'w-hospital' }], modules: [] },
    { title: '发布与连接', mission: '通过文件传输、域名管理和发布交付能力连接各类产品。', entries: [{ label: 'W-Transfer', product: 'w-transfer' }, { label: 'W-Collect', product: 'w-collect' }, { label: 'OpenDrop', url: 'https://opendrop.myfastools.com/' }, { label: 'W-Domain', product: 'w-domain' }], modules: ['Star', 'Site', 'Blogs', 'CDN'] },
  ],
};

const COPY = {
  en: { eyebrow: 'How the fleet fits together', title: 'A shared platform, focused products', subtitle: 'Explore the product families, shared capabilities and the work that will connect them. A W-ID sign-in opens this overview; each product still enforces its own access.', modules: 'Supporting capabilities', visionTitle: 'Building toward runnable digital worlds on shared internet foundations', visionNote: 'This is a long-term direction for the fleet, not a claim that one integrated world or a full internet replacement already exists.', layersTitle: 'Three connected layers', loop: 'Long-term capability loop', loopSteps: 'Observe → model → simulate → act → verify', layers: [{ title: 'Internet foundations', description: 'Identity, data, storage, compute, connectivity and publishing.' }, { title: 'World systems', description: 'Sensing, research corpora, simulation and world models.' }, { title: 'Applications', description: 'Research, creation and industry products built on shared services.' }] satisfies VisionLayer[], planned: 'Roadmap', roadmap: 'Capability comparison & roadmap', roadmapNote: 'Compare capability scope with the reference platforms; the detail table below records status and next steps.', phases: 'Fleet consolidation sequence', phaseNote: 'Candidate work is staged by dependency and acceptance outcome; it does not imply that consolidation is complete.' },
  zh: { eyebrow: '舰队能力框架', title: '共享平台，专注产品', subtitle: '了解产品族、共享能力，以及后续衔接工作。使用 W-ID 登录即可查看此总览；各产品仍独立执行自己的访问控制。', modules: '配套能力', visionTitle: '建设可运行的数字世界与共享互联网底座', visionNote: '这是舰队的长期方向，不表示统一世界或完整互联网替代已经建成。', layersTitle: '相互连接的三层能力', loop: '长期能力闭环', loopSteps: '观察 → 建模 → 仿真 → 行动 → 验证', layers: [{ title: '互联网底座', description: '身份、数据、存储、算力、连接与发布。' }, { title: '世界系统', description: '感知、研究语料、仿真与世界模型。' }, { title: '应用产品', description: '基于共享服务构建的研究、创作和行业产品。' }] satisfies VisionLayer[], planned: '建设路线', roadmap: '能力对标与建设路线', roadmapNote: '对照参考平台的能力范围；下方详细表列出当前状态与下一步。', phases: '舰队整并顺序', phaseNote: '候选工作按依赖关系和验收结果分阶段；这不代表整并已经完成。' },
} as const;

const PHASES: Record<Lang, Phase[]> = {
  en: [
    { title: '1 · Consolidate sources, then review releases', goal: 'Review canonical ownership and release consumers for CT/Fingerprint, Product Landings, blogs, Analytics and ImageTrace. Source consolidation and production acceptance have separate gates.', acceptance: 'Track source ownership separately from deployment; close remaining work only after release paths and consumers are verified.' },
    { title: '2 · Platform loop', goal: 'Connect identity → database and objects → publishing and isolated compute → observability.', acceptance: 'A tenant-isolated end-to-end flow passes auth, CRUD, object, deploy and telemetry checks.' },
    { title: '3 · Research loop', goal: 'Connect corpus and DOI → Papers → Craw/Knowledge → evidence for AutoML; preserve JCR and Patent data boundaries.', acceptance: 'Source, licensing and provenance remain visible from discovery through saved research.' },
  ],
  zh: [
    { title: '1 · 收拢源码，再审核发布', goal: '核对 CT/Fingerprint、Product Landings、博客、Analytics、ImageTrace 的规范源码归属和发布消费者；源码整并与生产验收分别设门槛。', acceptance: '区分源码归属和部署状态；核实发布路径及消费者后再关闭剩余事项。' },
    { title: '2 · 打通平台闭环', goal: '连接身份 → 数据库与对象 → 发布与隔离算力 → 可观测性。', acceptance: '通过租户隔离的端到端认证、CRUD、对象、部署和遥测验收。' },
    { title: '3 · 打通研究闭环', goal: '连接语料与 DOI → Papers → Craw/Knowledge → AutoML 证据；保留 JCR 与 Patent 的数据边界。', acceptance: '从发现到保存研究资料的流程保留来源、许可与出处信息。' },
  ],
};

const CONSOLIDATION: Record<Lang, Consolidation[]> = {
  en: [
    { title: 'CT + Fingerprint', candidate: 'Preserve the NetSense member implementations, independent APIs, data, services and OAuth boundaries. Source ownership does not establish runtime acceptance.', gate: 'Review local changes for the main line; source cleanup does not change deployment.' },
    { title: 'AutoML worktrees', candidate: 'Preserve pending agent authorization work and security assertions when consolidating development branches.', gate: 'Preserve the pending work, selectively port it and test before retiring the worktree.' },
    { title: 'Product Landings', candidate: 'This repository owns the product pages, image prompts and rendering scripts. Deployment configuration and unrelated application data remain separately owned.', gate: 'Review each deployed page and protect data owned by other applications; never replace a shared production tree from a local checkout.' },
    { title: 'Six blog sites', candidate: 'Retain all six independent site entrypoints and verify generated output when consolidating common sources.', gate: 'Review local changes for the main line; retain all six entrypoints.' },
    { title: 'Radar Analytics', candidate: 'Radar owns its browser SDK contract. Verify consumers and data ownership separately before retiring any legacy integration.', gate: 'Verify the old binding, database dependencies and active telemetry consumers before closing the archive candidate.' },
    { title: 'ImageTrace', candidate: 'DaaS owns the successor implementation; legacy desktop/API users and traffic still need migration.', gate: 'Keep the old path until desktop/API compatibility and traffic are migrated and verified.' },
    { title: 'MedTwin + MIMIC', candidate: 'Keep their archived histories and medical/research data boundaries distinct; correct registry and entry references after review.', gate: 'Preserve historical assets and verify no active route or consumer is lost.' },
  ],
  zh: [
    { title: 'CT + Fingerprint', candidate: '保留 NetSense 成员实现及独立的 API、数据、服务和 OAuth 边界；源码归属不能代替运行验收。', gate: '源码变更待主线审核；成员发布仍独立。' },
    { title: 'AutoML worktrees', candidate: '整并开发分支时保留待处理的 agent 权限工作和安全断言。', gate: '先保全并选择性移植改动，通过测试后再退役工作树。' },
    { title: 'Product Landings', candidate: '本仓维护产品门页、图片提示词和生成脚本；部署配置与其他应用数据分别保管。', gate: '逐页核验已部署内容并保护其他应用数据；不得用本地 checkout 覆盖共享生产目录。' },
    { title: '六个博客站点', candidate: '整并公共源码时保留全部六个站点入口，并核验生成产物。', gate: '本地变更待主线审核；保留六个入口。' },
    { title: 'Radar Analytics', candidate: 'Radar 维护浏览器 SDK 契约；退役旧接入前应独立核验消费者和数据归属。', gate: '核对旧绑定、数据库依赖和活跃遥测消费者后，才能关闭归档候选。' },
    { title: 'ImageTrace', candidate: '后续实现由 DaaS 承接；旧桌面端/API 用户和流量仍需迁移。', gate: '桌面端/API 兼容调用与流量迁移并验收前，保留旧路径。' },
    { title: 'MedTwin + MIMIC', candidate: '保留各自的归档历史和医疗/研究数据边界；核验后修正注册表与入口引用。', gate: '保全历史资产，并确认没有遗失活跃路由或消费者。' },
  ],
};

const DETAIL_COPY = {
  en: {
    title: 'Feature-by-feature comparison',
    subtitle: 'Select a reference platform to see the function it provides, the matched W fleet owners, current capability, status and next step.',
    evidenceNote: 'Reviewed 2026-09-29 from source and contracts; this does not confirm every production end-to-end flow.',
    tabsLabel: 'Comparison platform',
    candidates: 'Consolidation candidates',
    candidateNote: 'These are source-consolidation review areas; source ownership and runtime migrations require separate acceptance.',
    archiveLink: 'Public Fleet source catalog',
    archiveStatus: 'Publicly accepted source snapshots are listed there; deployment and private operational records remain separate.',
    gate: 'Before action',
    reference: 'Reference platform function', owner: 'W fleet owner', current: 'Current capability', status: 'Status', next: 'Next step', source: 'Reference',
    statusLabels: { implemented: 'Implemented', partial: 'Partially implemented', verify: 'Needs verification', planned: 'Planned', outOfScope: 'Outside scope' } satisfies Record<FleetPlatformStatus, string>,
  },
  zh: {
    title: '逐项功能对照',
    subtitle: '选择参考平台，查看参考平台提供的功能、对应的舰队负责人、当前能力、状态与下一步。',
    evidenceNote: '核查日期：2026-09-29。状态基于源码与契约，不代表所有生产端到端流程均已验收。',
    tabsLabel: '对照平台',
    candidates: '具体整并候选',
    candidateNote: '以下是源码整并核验范围；源码归属与运行环境迁移需分别验收。',
    archiveLink: '公开 Fleet 源码目录',
    archiveStatus: '目录收录已公开验收的源码；部署状态与私有运维记录单独核验。',
    gate: '执行前核验',
    reference: '参考平台功能', owner: '舰队职责归属', current: '当前能力', status: '状态', next: '下一步', source: '参考资料',
    statusLabels: { implemented: '已实现', partial: '部分实现', verify: '待验证', planned: '规划中', outOfScope: '明确不承接' } satisfies Record<FleetPlatformStatus, string>,
  },
} as const;

const SUPABASE_ROWS: Record<Lang, FleetPlatformDetail[]> = {
  en: [
      { feature: 'Auth', reference: 'Managed GoTrue-style auth, email/password, OTP, OAuth providers, anonymous users, MFA and client SDKs.', owner: 'W-ID', current: 'Native OAuth2/OIDC/PKCE, password, MFA and passkey identity. The GoTrue-compatible subset covers core email/password signup, token, refresh and logout flows; no anonymous or phone/password flow, admin/service-role API or OAuth password grant.', status: 'partial', next: 'Keep the supported subset explicit and verify login, token refresh and permission boundaries in the production client flow.', source: 'Supabase Auth', url: 'https://supabase.com/docs/guides/auth' },
      { feature: 'Database REST API', reference: 'Generated PostgREST API for tables, views, RPC, filters and standard query operations.', owner: 'W-DB', current: 'The current REST façade is a narrow subset: query supports `id` and bounded `limit`, with exact project-owner checks.', status: 'partial', next: 'Expand and verify the documented REST contract without weakening project scoping.', source: 'Supabase Data REST', url: 'https://supabase.com/docs/guides/api' },
      { feature: 'Postgres', reference: 'Managed PostgreSQL projects with standard connection and database tooling.', owner: 'W-DB', current: 'Project Postgres and authenticated data APIs exist; browser access is constrained to typed project operations, not arbitrary SQL.', status: 'partial', next: 'Verify project lifecycle, connections, backup and supported SQL/data operations end to end.', source: 'Supabase Database', url: 'https://supabase.com/docs/guides/database/overview' },
      { feature: 'Row Level Security', reference: 'PostgreSQL-native policies with request identity and policy expressions.', owner: 'W-DB', current: 'Project data applies an exact owner predicate, optional exact primary-key checks and bounded results through typed policy paths; this is narrower than arbitrary PostgreSQL RLS policies.', status: 'partial', next: 'Verify policy behavior with separate owners and cross-project negative cases.', source: 'Supabase RLS', url: 'https://supabase.com/docs/guides/database/postgres/row-level-security' },
      { feature: 'Realtime', reference: 'Broadcast, Presence and Postgres Changes channels with public/private topic options.', owner: 'W-DB', current: 'Private Broadcast and Presence plus managed Postgres Changes are supported; public topics and arbitrary binary payloads are excluded, with bounded limits.', status: 'partial', next: 'Verify supported channels, authorization and limits in production across separate projects.', source: 'Supabase Realtime', url: 'https://supabase.com/docs/guides/realtime' },
      { feature: 'Object Storage', reference: 'Bucket and object APIs, access policies, signed access and S3-compatible operations.', owner: 'W-Storage', current: 'Supabase Storage core and S3 SigV4 are implemented on named routes; provider quota, version and lifecycle behavior differs or is limited.', status: 'partial', next: 'Verify upload, policy and signed access flows per project, then document provider-specific version and lifecycle limits.', source: 'Supabase Storage', url: 'https://supabase.com/docs/guides/storage' },
      { feature: 'Edge Functions', reference: 'Deployable serverless functions with managed runtime, secrets, logs and edge invocation.', owner: 'W-DB function API / W-Sandbox isolation / W-Compute persistent compute', current: 'W-DB provides a bounded per-function Deno API/runtime; Sandbox supplies isolated execution. This is not a drop-in Supabase Edge Functions runtime.', status: 'partial', next: 'Verify function deployment and invocation across tenant boundaries; keep global scheduling and runtime equivalence as separate work.', source: 'Supabase Edge Functions', url: 'https://supabase.com/docs/guides/functions' },
      { feature: 'Project console', reference: 'A unified dashboard for project, database, auth, storage, functions and observability operations.', owner: 'W Platform Console / W-Storage Console', current: 'Project discovery and project-scoped database, storage, auth, functions, realtime and observability surfaces exist in the console; surfaces are separate and scoped.', status: 'partial', next: 'Run production end-to-end acceptance for console discovery and each linked operation surface.', source: 'Supabase dashboard', url: 'https://supabase.com/dashboard' },
      { feature: 'Tenant and project isolation', reference: 'Organization and project boundaries combined with service policies and user membership.', owner: 'W-ID / W-DB / W-Storage / W-Sandbox', current: 'W-ID scopes identity; DB, Storage and Sandbox enforce project-scoped boundaries in their own contracts.', status: 'partial', next: 'Verify cross-service auth, data, object and function isolation together with independent tenants.', source: 'Supabase platform docs', url: 'https://supabase.com/docs' },
    ],
  zh: [
      { feature: '身份认证 Auth', reference: '托管 GoTrue 风格认证，提供 email/password、OTP、OAuth provider、匿名用户、MFA 与客户端 SDK。', owner: 'W-ID', current: '原生 OAuth2/OIDC/PKCE、password、MFA 与 passkey 身份；GoTrue 兼容子集覆盖核心 email/password signup、token、refresh 与 logout，不含匿名或 phone/password、admin/service-role API 及 OAuth password grant。', status: 'partial', next: '明确标出受支持子集，并在生产客户端流程中验收登录、令牌刷新和权限边界。', source: 'Supabase Auth', url: 'https://supabase.com/docs/guides/auth' },
      { feature: '数据库 REST API', reference: '为表、视图、RPC、过滤器和标准查询操作生成 PostgREST API。', owner: 'W-DB', current: '当前 REST facade 范围较窄：查询支持 `id` 和有界 `limit`，并执行精确项目 owner 检查。', status: 'partial', next: '在保持项目隔离的前提下扩展并验收公开 REST 契约。', source: 'Supabase Data REST', url: 'https://supabase.com/docs/guides/api' },
      { feature: 'Postgres 数据库', reference: '托管 PostgreSQL 项目，提供标准连接和数据库工具。', owner: 'W-DB', current: '已有项目 Postgres 与认证数据 API；浏览器操作限于带类型的项目能力，不接受任意 SQL。', status: 'partial', next: '端到端核验项目生命周期、连接、备份和支持的数据操作。', source: 'Supabase Database', url: 'https://supabase.com/docs/guides/database/overview' },
      { feature: '行级安全 RLS', reference: '基于请求身份与策略表达式执行 PostgreSQL 原生策略。', owner: 'W-DB', current: '项目数据通过带类型策略执行精确 owner predicate、可选精确主键检查与结果数量限制；范围窄于任意 PostgreSQL RLS 策略。', status: 'partial', next: '使用不同 owner 和跨项目负向用例核验策略行为。', source: 'Supabase RLS', url: 'https://supabase.com/docs/guides/database/postgres/row-level-security' },
      { feature: 'Realtime 实时订阅', reference: '提供 Broadcast、Presence、Postgres Changes channel，并支持 public/private topic。', owner: 'W-DB', current: '支持 private Broadcast、Presence 和托管 Postgres Changes；不支持 public topic 与任意二进制 payload，并施加有界限制。', status: 'partial', next: '在生产环境跨不同项目核验支持的 channel、授权边界和限制。', source: 'Supabase Realtime', url: 'https://supabase.com/docs/guides/realtime' },
      { feature: '对象存储', reference: '提供 bucket/object API、访问策略、signed access 和 S3 兼容操作。', owner: 'W-Storage', current: 'Supabase Storage 核心与 S3 SigV4 已在命名路由实现；provider 配额、版本和生命周期行为存在差异或限制。', status: 'partial', next: '按项目核验上传、策略与签名访问，再说明各 provider 的版本和生命周期边界。', source: 'Supabase Storage', url: 'https://supabase.com/docs/guides/storage' },
      { feature: 'Edge Functions', reference: '可部署 serverless 函数，提供托管运行时、密钥、日志与边缘调用。', owner: 'W-DB 函数 API / W-Sandbox 隔离 / W-Compute 持久算力', current: 'W-DB 提供受限的 per-function Deno API/runtime；Sandbox 提供隔离执行。这不是可直接替换的 Supabase Edge Functions runtime。', status: 'partial', next: '跨租户验收函数部署和调用；将全球调度与 runtime 等价能力作为独立工作。', source: 'Supabase Edge Functions', url: 'https://supabase.com/docs/guides/functions' },
      { feature: '项目控制台', reference: '用一个 dashboard 管理项目、数据库、身份、存储、函数与可观测性。', owner: 'W Platform Console / W-Storage Console', current: '控制台已有项目发现，以及 project-scoped 数据库、存储、身份、函数、realtime 和可观测界面；各界面分开且按项目授权。', status: 'partial', next: '在生产环境端到端验收项目发现和各操作界面。', source: 'Supabase dashboard', url: 'https://supabase.com/dashboard' },
      { feature: '租户与项目隔离', reference: '结合组织与项目边界、服务策略和用户成员关系。', owner: 'W-ID / W-DB / W-Storage / W-Sandbox', current: 'W-ID 管理身份 scope；DB、Storage 与 Sandbox 按各自契约执行项目级隔离。', status: 'partial', next: '使用独立租户联合验收跨服务身份、数据、对象和函数隔离。', source: 'Supabase 平台文档', url: 'https://supabase.com/docs' },
    ],
};

export function FleetFramework({ lang }: { lang: Lang }) {
  const copy = COPY[lang];
  const detailCopy = DETAIL_COPY[lang];
  const [selectedPlatform, setSelectedPlatform] = useState('supabase');
  const [extraPlatforms, setExtraPlatforms] = useState<FleetPlatform[]>([]);
  const [extraFailed, setExtraFailed] = useState(false);
  useEffect(() => {
    if (selectedPlatform === 'supabase') return;
    let active = true;
    import('./fleetPlatformExtras').then(({ EXTRA_PLATFORMS }) => {
      if (active) setExtraPlatforms(EXTRA_PLATFORMS[lang]);
    }).catch(() => { if (active) { setExtraPlatforms([]); setExtraFailed(true); } });
    return () => { active = false; };
  }, [lang, selectedPlatform]);
  const catalogSlugs = new Set(PRODUCTS.map((product) => product.slug));
  const platform = selectedPlatform === 'supabase'
    ? { id: 'supabase', label: 'Supabase', rows: SUPABASE_ROWS[lang] }
    : extraPlatforms.find((item) => item.id === selectedPlatform);

  return (
    <section className="fleet-section" id="fleet" aria-labelledby="fleet-title">
      <div className="fleet-container">
        <p className="fleet-eyebrow">{copy.eyebrow}</p>
        <h2 id="fleet-title">{copy.title}</h2>
        <p className="fleet-intro">{copy.subtitle}</p>
        <section className="fleet-vision" aria-labelledby="fleet-vision-title">
          <h3 id="fleet-vision-title">{copy.visionTitle}</h3>
          <p>{copy.visionNote}</p>
          <h4>{copy.layersTitle}</h4>
          <div className="vision-layers">
            {copy.layers.map((layer) => <article key={layer.title}><h5>{layer.title}</h5><p>{layer.description}</p></article>)}
          </div>
          <p className="vision-loop"><b>{copy.loop}:</b> {copy.loopSteps}</p>
        </section>
        <div className="fleet-grid">
          {GROUPS[lang].map((group) => (
            <article className="fleet-card" key={group.title}>
              <h3>{group.title}</h3>
              <p className="fleet-mission">{group.mission}</p>
              <div className="fleet-links">
                {group.entries.map((entry) => {
                  const href = entry.product && catalogSlugs.has(entry.product)
                    ? localizedHref(`/${entry.product}`, lang)
                    : entry.url;
                  return href ? (
                    <a key={entry.label} href={href} className="fleet-link">
                      {entry.label}<span aria-hidden="true"> ↗</span>
                    </a>
                  ) : <span className="fleet-link fleet-link-static" key={entry.label}>{entry.label}</span>;
                })}
              </div>
              {group.modules.length > 0 && (
                <p className="fleet-modules"><b>{copy.modules}:</b> {group.modules.join(' · ')}</p>
              )}
            </article>
          ))}
        </div>
        <section className="fleet-roadmap" id="roadmap-content" aria-labelledby="fleet-roadmap-title">
          <p className="fleet-eyebrow">{copy.planned}</p>
          <h2 id="fleet-roadmap-title">{copy.roadmap}</h2>
          <p className="fleet-intro">{copy.roadmapNote}</p>
          <section className="feature-comparison" aria-labelledby="feature-comparison-title">
            <h3 id="feature-comparison-title">{detailCopy.title}</h3>
            <p>{detailCopy.subtitle}</p>
            <p className="comparison-evidence-note">{detailCopy.evidenceNote}</p>
            <div className="comparison-tabs" role="group" aria-label={detailCopy.tabsLabel}>
              {[{ id: 'supabase', label: 'Supabase' }, { id: 'cloudflare', label: 'Cloudflare' }, { id: 'arxiv', label: 'arXiv' }].map((item) => (
                <button key={item.id} type="button" aria-pressed={selectedPlatform === item.id} onClick={() => { setExtraFailed(false); setSelectedPlatform(item.id); }}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="detail-comparison-list" aria-live="polite">
              {!extraFailed && !platform && <p>{lang === 'zh' ? '正在载入对照…' : 'Loading comparison…'}</p>}
              {extraFailed && !platform && <p role="alert">{lang === 'zh' ? '对照暂时无法载入，请刷新页面后重试。' : 'Comparison unavailable. Refresh the page to retry.'}</p>}
              {platform?.rows.map((row) => (
                <article className="detail-comparison-card" key={row.feature}>
                  <header><h4>{row.feature}</h4><span className={`comparison-status status-${row.status}`}>{detailCopy.statusLabels[row.status]}</span></header>
                  <dl>
                    <div><dt>{detailCopy.reference}</dt><dd>{row.reference}</dd></div>
                    <div><dt>{detailCopy.owner}</dt><dd>{row.owner}</dd></div>
                    <div><dt>{detailCopy.current}</dt><dd>{row.current}</dd></div>
                    <div><dt>{detailCopy.next}</dt><dd>{row.next}</dd></div>
                  </dl>
                  <a className="detail-source" href={row.url} target="_blank" rel="noreferrer">{detailCopy.source}: {row.source} ↗</a>
                </article>
              ))}
            </div>
          </section>
        </section>
        <section className="fleet-phases" aria-labelledby="fleet-phases-title">
          <h2 id="fleet-phases-title">{copy.phases}</h2>
          <p className="fleet-intro">{copy.phaseNote}</p>
          <div className="phase-grid">
            {PHASES[lang].map((phase) => <article className="phase-card" key={phase.title}><h3>{phase.title}</h3><p>{phase.goal}</p><p><b>{lang === 'zh' ? '验收：' : 'Acceptance: '}</b>{phase.acceptance}</p></article>)}
          </div>
          <div className="consolidation-list">
            <h3>{detailCopy.candidates}</h3>
            <p>{detailCopy.candidateNote}</p>
            <p><a href="https://github.com/W-World-Labs/fleet" target="_blank" rel="noreferrer">{detailCopy.archiveLink} ↗</a> · {detailCopy.archiveStatus}</p>
            <div className="consolidation-grid">
              {CONSOLIDATION[lang].map((item) => (
                <article className="phase-card" key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.candidate}</p>
                  <p><b>{detailCopy.gate}: </b>{item.gate}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
