import { useState } from 'react';
import { CATEGORIES, PRODUCTS, type Category } from '../data/products';
import { PRODUCTS_ZH } from '../data/products.zh';
import { localizedHref, type Lang } from '../i18n';
import { ProductCard } from './ProductCard';

const COPY = {
  en: { title: 'Find your next tool.', subtitle: 'Research, create, observe and build. Explore our products and open the workspace that fits your task.', search: 'Search products, capabilities or domains', all: 'All products', count: 'products', empty: 'No products match your search.', reset: 'Reset filters', platform: 'Build with shared foundations', platformNote: 'Connect identity, project databases, object storage, realtime and publishing from the developer console. Your project and tenant permissions apply.', console: 'Open developer console', architecture: 'Explore the platform architecture and roadmap' },
  zh: { title: '找到适合你的工具。', subtitle: '从研究、创作到感知与开发，浏览我们的产品，进入适合当前任务的工作区。', search: '搜索产品、功能或域名', all: '全部产品', count: '款产品', empty: '没有匹配的产品。', reset: '重置筛选', platform: '用共享底座构建应用', platformNote: '在开发者控制台连接身份、项目数据库、对象存储、实时订阅与发布能力。访问范围由项目与租户权限决定。', console: '进入开发者控制台', architecture: '查看平台架构与建设路线' },
};
const LABELS: Record<Lang, Record<Category, string>> = {
  en: { Platform: 'Developer & platform', Analysis: 'Research & analysis', Sensing: 'Sensing & monitoring', Apps: 'Creation & everyday tools' },
  zh: { Platform: '开发与平台', Analysis: '研究与分析', Sensing: '感知与监测', Apps: '创作与日常工具' },
};

export function ProductCatalog({ lang }: { lang: Lang }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const t = COPY[lang];
  const products = PRODUCTS.map((product) => lang === 'zh' ? { ...product, ...PRODUCTS_ZH[product.slug] } : product);
  const needle = query.trim().toLocaleLowerCase();
  const visible = products.filter((p) => (!category || p.category === category) && [p.name, p.slug, p.domain, p.tagline, ...p.features].join(' ').toLocaleLowerCase().includes(needle));
  return (
    <section id="products" className="product-catalog" aria-labelledby="catalog-title">
      <div className="catalog-heading"><span className="catalog-eyebrow">W / PRODUCTS</span><h2 id="catalog-title">{t.title}</h2><p>{t.subtitle}</p></div>
      <label className="catalog-search"><span>{t.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></label>
      <div className="catalog-filters" role="group" aria-label={lang === 'zh' ? '产品分类' : 'Product categories'}>
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>{t.all} <span>{products.length}</span></button>
        {CATEGORIES.map((value) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{LABELS[lang][value]} <span>{products.filter((p) => p.category === value).length}</span></button>)}
      </div>
      <p className="catalog-count" role="status">{visible.length} {t.count}</p>
      <div className="catalog-grid">{visible.map((product) => <ProductCard key={product.slug} product={product} lang={lang} />)}</div>
      {!visible.length && <div className="catalog-empty"><p>{t.empty}</p><button type="button" onClick={() => { setQuery(''); setCategory(null); }}>{t.reset}</button></div>}
      <div className="catalog-platform"><div><span className="catalog-eyebrow">W / DEVELOPERS</span><h2>{t.platform}</h2><p>{t.platformNote}</p><div className="catalog-capabilities">{(lang === 'zh' ? ['身份与权限', 'PostgreSQL 与数据 API', '对象存储', '实时订阅', '原生函数与 Workers', 'Pages 发布'] : ['Identity & access', 'PostgreSQL & data APIs', 'Object storage', 'Realtime', 'Native Functions & Workers', 'Pages publishing']).map((label) => <span key={label}>{label}</span>)}</div></div><a className="catalog-console" href={localizedHref('/console', lang)}>{t.console} →</a></div>
    </section>
  );
}

export function ArchitectureLabel({ lang }: { lang: Lang }) { return <>{COPY[lang].architecture}</>; }
