import type { Lang } from '../i18n';
import type { ProjectConsoleSurface } from '../routes';

export const PROJECT_CONSOLE_TASKS: Record<ProjectConsoleSurface, { en: string; zh: string; enTask: string; zhTask: string; keywords: string }> = {
  overview: { en: 'Overview', zh: '总览', enTask: 'Review project services and readiness', zhTask: '查看项目服务与就绪状态', keywords: 'status health 状态 服务' },
  connect: { en: 'Connect', zh: '连接', enTask: 'Connect an SDK and manage project keys', zhTask: '连接 SDK，创建、轮换和撤销项目密钥', keywords: 'supabase client api token credentials 客户端 令牌' },
  auth: { en: 'Authentication', zh: '认证', enTask: 'Manage users, invitations and roles', zhTask: '管理用户、邀请与角色', keywords: 'login signup identity 登录 注册 身份' },
  database: { en: 'Database', zh: '数据库', enTask: 'Browse and edit rows, migrations and access policies', zhTask: '浏览和编辑数据行、迁移与访问策略', keywords: 'postgres sql crud rls tables 查询 表 权限' },
  backups: { en: 'Backups', zh: '备份', enTask: 'Create, download and restore database backups', zhTask: '创建、下载与恢复数据库备份', keywords: 'rollback recovery dump 回滚 恢复数据' },
  storage: { en: 'Storage', zh: '存储', enTask: 'Upload files and manage buckets and object versions', zhTask: '上传文件，管理存储桶与对象版本', keywords: 's3 r2 objects download 上传文件 下载 对象' },
  functions: { en: 'Functions', zh: '函数', enTask: 'Deploy, invoke and roll back functions', zhTask: '部署、调用和回滚函数', keywords: 'workers serverless edge logs 部署函数 边缘 日志' },
  sites: { en: 'Sites', zh: '网站', enTask: 'Publish static files, preview versions and manage custom domains', zhTask: '发布静态文件、预览版本并管理自定义域名', keywords: 'pages deploy publish static website preview domain site 发布 网站 域名' },
  realtime: { en: 'Realtime', zh: '实时', enTask: 'Test broadcast and presence over WebSockets', zhTask: '通过 WebSocket 测试广播与在线状态', keywords: 'subscribe events channels 实时消息 订阅 频道' },
  observability: { en: 'Observability', zh: '可观测性', enTask: 'Inspect health, releases, errors and latency', zhTask: '查看健康、发布、错误与延迟', keywords: 'radar monitor logs metrics monitoring 日志 监控 指标 排错' },
};

export function findProjectConsoleTasks(query: string, lang: Lang) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (Object.entries(PROJECT_CONSOLE_TASKS) as Array<[ProjectConsoleSurface, (typeof PROJECT_CONSOLE_TASKS)[ProjectConsoleSurface]]>)
    .filter(([, task]) => {
      const searchable = Object.values(task).join(' ').toLowerCase();
      return terms.every((term) => searchable.includes(term));
    })
    .map(([surface, task]) => ({ surface, label: task[lang], description: lang === 'zh' ? task.zhTask : task.enTask }));
}
