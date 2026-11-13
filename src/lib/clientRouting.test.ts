import { describe, expect, it } from 'vitest';
import { clientRenderPlan } from './clientRouting';

describe('client render routing', () => {
  it('rejects a root prerender fallback for an arbitrary project deep link', () => {
    const plan = clientRenderPlan('/console/projects/customer_project_42', '/');
    expect(plan.hydrate).toBe(false);
    expect(plan.resolved.page).toEqual({ kind: 'console', projectId: 'customer_project_42', surface: 'overview' });
    expect(plan.documentLanguage).toBe('en');
  });

  it('keeps the localized browser URL authoritative over English fallback state', () => {
    const plan = clientRenderPlan('/zh/console/projects/customer_project_42', '/');
    expect(plan.hydrate).toBe(false);
    expect(plan.resolved.lang).toBe('zh');
    expect(plan.documentLanguage).toBe('zh-Hans');
    expect(plan.resolved.page).toEqual({ kind: 'console', projectId: 'customer_project_42', surface: 'overview' });
  });

  it('resolves localized project Auth as a distinct safe client route', () => {
    const plan = clientRenderPlan('/zh/console/projects/customer_project_42/auth', '/');
    expect(plan.hydrate).toBe(false);
    expect(plan.resolved.page).toEqual({ kind: 'console', projectId: 'customer_project_42', surface: 'auth' });
    expect(plan.resolved.routePath).toBe('/console/projects/customer_project_42/auth');
  });

  it('resolves the Functions plane independently', () => {
    expect(clientRenderPlan('/console/projects/customer_project_42/functions', '/').resolved.page)
      .toEqual({ kind: 'console', projectId: 'customer_project_42', surface: 'functions' });
  });

  it('resolves the localized Realtime plane independently', () => {
    expect(clientRenderPlan('/zh/console/projects/customer_project_42/realtime', '/').resolved.page)
      .toEqual({ kind: 'console', projectId: 'customer_project_42', surface: 'realtime' });
  });

  it('hydrates only an exact prerendered route, tolerating a trailing slash', () => {
    expect(clientRenderPlan('/zh/console/projects/w-id', '/zh/console/projects/w-id').hydrate).toBe(true);
    expect(clientRenderPlan('/console/', '/console').hydrate).toBe(true);
  });
});
