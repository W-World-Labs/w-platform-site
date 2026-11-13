export interface ProductUsageEntry {
  count: number;
  lastUsedAt: string;
}

export type ProductUsage = Record<string, ProductUsageEntry>;

const EVENT_NAME = 'w-product-usage';

function identity(): string {
  if (typeof window === 'undefined') return 'visitor';
  try {
    const user = JSON.parse(localStorage.getItem('wuser') || 'null') as { sub?: string } | null;
    return user?.sub ? `user:${user.sub}` : 'visitor';
  } catch {
    return 'visitor';
  }
}

function storageKey(): string {
  return `w-platform:product-usage:${identity()}`;
}

export function readProductUsage(): ProductUsage {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '{}') as ProductUsage;
  } catch {
    return {};
  }
}

export function recordProductUsage(slug: string): void {
  if (typeof window === 'undefined') return;
  const usage = readProductUsage();
  const previous = usage[slug];
  usage[slug] = {
    count: (previous?.count || 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(), JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug } }));
}

export function subscribeProductUsage(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener('wauth', listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener('wauth', listener);
  };
}
