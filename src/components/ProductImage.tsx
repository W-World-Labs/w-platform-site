import { useState, type CSSProperties } from 'react';
import { getProduct, slugGradient } from '../data/products';

type ProductImageKind = 'hero' | 'overview' | 's1' | 's2' | 's3' | 'key-art' | 'product-ui';

function productImageSrc(slug: string, kind: ProductImageKind): string {
  if (kind === 'product-ui') {
    return `/_images/generated/product-ui/${slug}-product-ui.png`;
  }

  if (kind === 'key-art') {
    return `/_images/generated/dark/${slug}-key-art-dark.png`;
  }

  return `/_images/${slug}-${kind}.jpg`;
}

interface ProductImageProps {
  slug: string;
  kind: ProductImageKind;
  alt: string;
  className?: string;
  eager?: boolean;
  style?: CSSProperties;
}

export function ProductImage({ slug, kind, alt, className, eager = false, style }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const product = getProduct(slug);
  if (product?.visual === 'identity') {
    return <div aria-label={alt || undefined} role={alt ? 'img' : undefined} className={`${className || ''} product-identity`} style={{ ...style, background: slugGradient(slug) }}><span aria-hidden="true">{product.name}</span><small aria-hidden="true">{product.category.toUpperCase()}</small></div>;
  }

  if (failed) {
    return (
      <div
        aria-label={alt || undefined}
        className={className}
        role={alt ? 'img' : undefined}
        style={{
          ...style,
          background: slugGradient(slug),
        }}
      />
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      src={productImageSrc(slug, kind)}
      style={style}
    />
  );
}
