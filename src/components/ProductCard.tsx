import { productAppUrl, type Product } from '../data/products';
import { localizedHref, type Lang } from '../i18n';
import { ProductImage } from './ProductImage';
import { recordProductUsage } from '../lib/productUsage';

export function ProductCard({ product, lang }: { product: Product; lang: Lang }) {
  const { slug, name, tagline } = product;
  return (
    <article className="product-card" data-product={slug}>
      <a className="product-card-media" href={localizedHref(`/${slug}`, lang)} aria-label={name}>
        <ProductImage alt="" className="product-media" kind="product-ui" slug={slug} />
      </a>
      <div className="product-card-copy">
        <h3>{name}</h3><p>{tagline}</p>
        <ul>{product.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <div className="product-card-actions">
          <a href={localizedHref(`/${slug}`, lang)}>{lang === 'zh' ? '了解产品' : 'View details'}</a>
          <a href={productAppUrl(product)} target="_blank" rel="noopener noreferrer" onClick={() => recordProductUsage(slug)} title={product.domain}>{lang === 'zh' ? '打开产品' : 'Open product'} ↗</a>
        </div>
      </div>
    </article>
  );
}
