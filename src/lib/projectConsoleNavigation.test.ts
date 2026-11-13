import { describe, expect, it } from 'vitest';
import { localizedHref } from '../i18n';
import { parsePath } from '../routes';
import { findProjectConsoleTasks } from './projectConsoleNavigation';

describe('project task discovery', () => {
  it('finds existing destinations by task, product alias and either language', () => {
    expect(findProjectConsoleTasks('  上传文件  ', 'zh').map((task) => task.surface)).toEqual(['storage']);
    expect(findProjectConsoleTasks('DEPLOY functions', 'en').map((task) => task.surface)).toEqual(['functions']);
    expect(findProjectConsoleTasks('恢复数据', 'en').map((task) => task.surface)).toEqual(['backups']);
    expect(findProjectConsoleTasks('r2', 'zh').map((task) => task.surface)).toEqual(['storage']);
    expect(findProjectConsoleTasks('supabase', 'zh').map((task) => task.surface)).toEqual(['connect']);
    expect(findProjectConsoleTasks('custom domain', 'en').map((task) => task.surface)).toEqual(['sites']);
    expect(findProjectConsoleTasks('自定义域名', 'zh').map((task) => task.surface)).toEqual(['sites']);
    expect(findProjectConsoleTasks('not-a-platform-feature', 'en')).toEqual([]);
  });

  it('returns only routes supported by the console in both languages', () => {
    for (const lang of ['en', 'zh'] as const) {
      const tasks = findProjectConsoleTasks('', lang);
      expect(tasks).toHaveLength(10);
      for (const task of tasks) {
        expect(task.label).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(parsePath(localizedHref(`/console/projects/project_member/${task.surface}`, lang)).page)
          .toEqual({ kind: 'console', projectId: 'project_member', surface: task.surface });
      }
    }
  });
});
