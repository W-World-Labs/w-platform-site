import { LANG_TAG } from '../i18n';
import { parsePath, type Resolved } from '../routes';

export interface ClientRenderPlan {
  resolved: Resolved;
  documentLanguage: string;
  hydrate: boolean;
}

function normalizedPath(path: string): string {
  if (!path || path === '/') return '/';
  return path.replace(/\/+$/, '') || '/';
}

/**
 * The address bar is authoritative. Static hosts may serve the root document
 * as a fallback for a valid dynamic project id, so injected prerender state is
 * only proof that hydration is safe when it names the same pathname.
 */
export function clientRenderPlan(browserPath: string, prerenderedPath?: string): ClientRenderPlan {
  const resolved = parsePath(browserPath);
  return {
    resolved,
    documentLanguage: LANG_TAG[resolved.lang],
    hydrate: typeof prerenderedPath === 'string'
      && normalizedPath(prerenderedPath) === normalizedPath(browserPath),
  };
}
