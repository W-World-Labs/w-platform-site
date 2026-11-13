import { useState } from 'react';
import { localizedHref, type Lang } from '../i18n';
import inventory from '../data/platform-comparison.json';

const sources: Record<string, [string, string]> = {
  audit: ['公开验收范围', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  g1: ['Functions / Workers 接入范围', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  auth: ['Auth compatibility', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  db: ['W-DB contract', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  storage: ['Storage compatibility', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  drop: ['W-Drop / Wrangler', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  cli: ['w-cli / Wrangler', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
  console: ['Public console acceptance scope', 'https://github.com/W-World-Labs/w-platform-site/blob/main/PUBLIC_SOURCE.md#integration-and-acceptance'],
};

const englishOwners: Record<string, string> = {
  'W 平台': 'W platform', '暂无兼容映射': 'No compatibility mapping',
  'W 组合验收启动器': 'W component launchers', 'W-Radar / Functions 日志': 'W-Radar / Function logs',
  'W-Domain / 边缘': 'W-Domain / edge', 'W-CDN / 边缘': 'W-CDN / edge', 'Caddy / W 平台': 'Caddy / W platform',
};

const statuses: Record<string, Record<Lang, string>> = {
  verified: { zh: '已线上验证', en: 'Production verified' },
  subset: { zh: '已实现子集', en: 'Implemented subset' },
  different: { zh: 'W 独立实现', en: 'Different W semantics' },
  unsupported: { zh: '明确不支持', en: 'Explicitly unsupported' },
  unverified: { zh: '待核实 / 验收', en: 'Unverified / pending' },
};
const levels: Record<string, Record<Lang, string>> = {
  production: { zh: '证据：生产专项', en: 'Evidence: production check' },
  integration: { zh: '证据：真实组件组合 / 专项', en: 'Evidence: real-component integration' },
  contract: { zh: '证据：声明契约', en: 'Evidence: declared contract' },
  none: { zh: '证据：未取得对应验收', en: 'Evidence: acceptance not found' },
};
const groups: Record<string, Record<Lang, string>> = {
  auth: { zh: '身份与认证', en: 'Auth' }, database: { zh: '数据库', en: 'Database' },
  vector: { zh: '向量与 AI', en: 'Vector / AI' }, storage: { zh: '存储', en: 'Storage' },
  realtime: { zh: '实时订阅', en: 'Realtime' }, functions: { zh: '原生函数', en: 'Functions' },
  platform: { zh: '平台管理', en: 'Platform' }, studio: { zh: '开发者控制台', en: 'Studio' },
  workers: { zh: 'Workers 与工具', en: 'Workers / tooling' }, pages: { zh: 'Pages', en: 'Pages' },
  r2: { zh: 'R2 / 对象存储', en: 'R2 / objects' }, data: { zh: '数据与运行扩展', en: 'Data / runtime extensions' },
  edge: { zh: '边缘与网络', en: 'Edge / network' }, acceptance: { zh: '生产收口验收', en: 'Production acceptance' },
};

export function PlatformComparisonPage({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const needle = query.trim().toLowerCase();
  const rows = inventory.filter((row) => (platform === 'all' || row.platform === platform)
    && (status === 'all' || row.status === status) && (group === 'all' || row.group === group)
    && (!needle || [row.feature.zh, row.feature.en, row.owner, row.detail.zh, row.detail.en].join(' ').toLowerCase().includes(needle)));
  const availableGroups = Object.keys(groups).filter((key) => inventory.some((row) => row.group === key && (platform === 'all' || row.platform === platform)));

  return (
    <div className="platform-comparison">
      <header className="comparison-intro">
        <p className="comparison-eyebrow">W FLEET · SUPABASE · CLOUDFLARE</p>
        <h1>{zh ? '功能对齐，逐项核对。' : 'Feature alignment, item by item.'}</h1>
        <p>{zh ? '核心平台已发布，限定兼容能力有真实验收。完整功能对等与普通新用户的生产全流程，仍未完成。' : 'The core platform is released with evidence for bounded compatibility. Full parity and fresh-user production end-to-end acceptance remain open.'}</p>
        <p className="comparison-date">{zh ? '核对日期：2026-10-06 UTC · 历史人工快照；详细私有记录不公开，公开源码 CI 不证明生产状态。' : 'Reviewed: 2026-10-06 UTC · Historical snapshot; detailed private records are excluded. Public source CI does not establish production state.'}</p>
        <div className="comparison-actions">
          <a href="#comparison-table">{zh ? '查看逐项对比' : 'Compare every item'}</a>
          <a href={localizedHref('/console', lang)}>{zh ? '打开开发者控制台' : 'Open developer console'}</a>
        </div>
      </header>

      <section className="comparison-summary" aria-label={zh ? '核对范围' : 'Review scope'}>
        <article><strong>87</strong><span>Supabase</span><p>{zh ? '官方目录 81 项，另补 6 项核心协议与生命周期细节。' : '81 catalog entries plus 6 core protocol and lifecycle checks.'}</p></article>
        <article><strong>47</strong><span>Cloudflare</span><p>{zh ? 'Workers / Wrangler、Pages、R2、数据扩展与相关边缘能力。' : 'Workers / Wrangler, Pages, R2, data extensions and related edge capabilities.'}</p></article>
        <article><strong>8</strong><span>{zh ? '生产验收门槛' : 'Acceptance checks'}</span><p>{zh ? '把发布成功、专项通过与整条用户流程分开核对。' : 'Release delivery, individual checks and the whole user journey are assessed separately.'}</p></article>
      </section>

      <section className="comparison-boundary">
        <h2>{zh ? '完成到哪一步？' : 'What is complete?'}</h2>
        <p>{zh ? '当前只读生产检查 11/11 通过；W-ID 1.3.49、W-DB 0.8.21、W-Storage 0.1.7、W-Drop 0.4.0、W-Sandbox 0.2.0 已正式发布。真实身份组合、官方客户端和生产 KVM 各有证据。' : 'Current read-only production checks passed 11/11. Formal releases: W-ID 1.3.49, W-DB 0.8.21, W-Storage 0.1.7, W-Drop 0.4.0 and W-Sandbox 0.2.0. Real-identity integration, official clients and production KVM have separate evidence.'}</p>
        <p>{zh ? '尚缺普通新用户仅通过公开生产入口，走完登录 → CRUD/RLS → 私有存储 → Realtime → Functions/Workers → 日志 → 备份恢复 → 撤销回滚 → 清理的完整成功记录。健康检查通过，不等于这条业务链通过。' : 'Still missing: a fresh ordinary user completing login → CRUD/RLS → private storage → Realtime → Functions/Workers → logs → backup/restore → revocation/rollback → cleanup through public production entry points.'}</p>
        <p>{zh ? '“待核实”表示没有取得对等证据，不代表代码必然不存在。“已实现子集”只覆盖行内写明的边界。Cloudflare 范围限于本次开发平台和相关边缘能力，不包含其全部企业安全、运营商网络或消费产品。' : 'Unverified means parity evidence was not found, not that code necessarily does not exist. Subsets cover only the stated boundaries. Cloudflare scope is the agreed developer platform and related edge capabilities, not its entire enterprise security, carrier or consumer portfolio.'}</p>
      </section>

      <section id="comparison-table" aria-labelledby="comparison-heading">
        <h2 id="comparison-heading">{zh ? '左侧：参照能力 · 右侧：W 实际交付' : 'Left: reference capability · Right: W delivery'}</h2>
        <div className="comparison-filters">
          <label>{zh ? '搜索功能或 W 产品' : 'Search features or W products'}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? '例如 RLS、回滚、D1、签名上传' : 'RLS, rollback, D1, signed upload…'} /></label>
          <label>{zh ? '平台' : 'Platform'}<select aria-label={zh ? '平台' : 'Platform'} value={platform} onChange={(event) => { setPlatform(event.target.value); setGroup('all'); }}><option value="all">{zh ? '全部平台' : 'All platforms'}</option><option>Supabase</option><option>Cloudflare</option><option value="Acceptance">{zh ? '生产验收' : 'Acceptance'}</option></select></label>
          <label>{zh ? '功能分类' : 'Category'}<select aria-label={zh ? '功能分类' : 'Category'} value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">{zh ? '全部分类' : 'All categories'}</option>{availableGroups.map((key) => <option key={key} value={key}>{groups[key][lang]}</option>)}</select></label>
          <label>{zh ? 'W 状态' : 'W status'}<select aria-label={zh ? 'W 状态' : 'W status'} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{zh ? '全部状态' : 'All statuses'}</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value[lang]}</option>)}</select></label>
          <button type="button" onClick={() => { setQuery(''); setPlatform('all'); setGroup('all'); setStatus('all'); }}>{zh ? '重置筛选' : 'Reset filters'}</button>
        </div>
        <div className="comparison-legend">{Object.entries(statuses).map(([key, value]) => <span key={key} className={`comparison-status comparison-status-${key}`}>{value[lang]} · {inventory.filter((row) => row.status === key).length}</span>)}</div>
        <p aria-live="polite" role="status">{zh ? `显示 ${rows.length} / ${inventory.length} 项；数字表示条目数量，不表示完成百分比。` : `Showing ${rows.length} / ${inventory.length} items; counts are inventory entries, not completion percentages.`}</p>
        <table className="comparison-table">
          <caption className="sr-only">{zh ? 'Supabase、Cloudflare 与 W 平台功能、证据及缺口对比' : 'Supabase and Cloudflare capabilities compared with W implementation, evidence and gaps'}</caption>
          <thead><tr><th scope="col">Supabase / Cloudflare</th><th scope="col">{zh ? 'W 对应能力 · 状态 · 证据边界' : 'W capability · status · evidence boundary'}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} id={row.id} data-comparison-row={row.id}>
            <th scope="row"><span className="comparison-platform">{row.platform === 'Acceptance' ? (zh ? '生产收口' : 'Acceptance') : row.platform} · {groups[row.group][lang]}</span><strong>{row.feature[lang]}</strong>{zh && <span className="comparison-secondary">{row.feature.en}</span>}<a href={row.official} target="_blank" rel="noreferrer">{zh ? '参照文档 ↗' : 'Reference docs ↗'}</a></th>
            <td><div className="comparison-row-title"><strong>{zh ? row.owner : englishOwners[row.owner] ?? row.owner}</strong><span className={`comparison-status comparison-status-${row.status}`}>{statuses[row.status][lang]}</span></div><p>{row.detail[lang]}</p><div className="comparison-evidence"><span>{levels[row.level][lang]}</span><a href={sources[row.source][1]} target="_blank" rel="noreferrer">{zh ? 'W 核对来源 ↗' : 'W evidence ↗'}</a><a href={`#${row.id}`} aria-label={zh ? `${row.feature.zh}的定位链接` : `Link to ${row.feature.en}`}>#</a></div></td>
          </tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="comparison-empty">{zh ? '没有匹配项，请调整或重置筛选。' : 'No matching items. Change or reset your filters.'}</p>}
      </section>

      <section className="comparison-sources">
        <h2>{zh ? '核对依据与下一步' : 'Sources and next steps'}</h2>
        <p>{zh ? '参照供应商官方功能目录与文档；W 状态来自在线 Radar、对应项目兼容契约和验收记录。W 仓库链接可能需要权限。本页是人工复核快照，未在浏览器内读取平台密钥。' : 'References are official vendor catalogs/docs. W status uses online Radar, project compatibility contracts and acceptance records. W repository links may require access. This is a reviewed snapshot.'}</p>
        <div className="comparison-source-links"><a href="https://supabase.com/features" target="_blank" rel="noreferrer">Supabase {zh ? '官方目录' : 'feature catalog'}</a><a href="https://developers.cloudflare.com/directory/" target="_blank" rel="noreferrer">Cloudflare {zh ? '官方目录' : 'docs directory'}</a><a href={sources.audit[1]} target="_blank" rel="noreferrer">{zh ? '统一核对报告 #67' : 'Alignment report #67'}</a><a href={sources.g1[1]} target="_blank" rel="noreferrer">Functions / Workers #228</a></div>
        <ol><li>{zh ? '先补齐普通新用户的公开生产全流程，以及同项目两类函数生命周期和权限拒绝验收。' : 'First prove fresh-user public-production E2E and both function runtimes with permission denials.'}</li><li>{zh ? '按每项兼容边界补充域名、R2、多 POP、故障恢复等专项证据，再扩展 API 兼容能力。' : 'Then add domain, R2, POP and recovery evidence, and expand API compatibility item by item.'}</li><li>{zh ? '取得精确版本、成功运行和资源清理证据后，更新对应条目；不以测试数量或页面数量代替完成判定。' : 'Update entries after exact-version success and cleanup evidence; test or page counts are not completion evidence.'}</li></ol>
      </section>
    </div>
  );
}
