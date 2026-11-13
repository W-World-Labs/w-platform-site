import { validProjectTableIdentifier } from './projectTableDefinition';

export interface ProjectTableRealtime {
  projectId: string;
  schema: string;
  table: string;
  source: 'configured' | 'managed' | 'none';
  desiredEnabled: boolean;
  effectiveEnabled: boolean;
  status: 'enabled' | 'disabled' | 'degraded';
}

/** Read only the selected table's documented desired and effective state. */
export function parseProjectTableRealtime(value: unknown, projectId: string, schema: string, table: string): ProjectTableRealtime | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !validProjectTableIdentifier(schema) || !validProjectTableIdentifier(table)) return null;
  const root = value as Record<string, unknown>;
  if (root.schema_version !== 'w-db.table-realtime/v1' || root.project_id !== projectId || root.schema !== schema || root.table !== table
    || !['configured', 'managed', 'none'].includes(String(root.source)) || typeof root.desired_enabled !== 'boolean' || typeof root.effective_enabled !== 'boolean') return null;
  const status = root.desired_enabled === root.effective_enabled ? (root.effective_enabled ? 'enabled' : 'disabled') : 'degraded';
  if (root.status !== status || (root.source === 'none' && root.desired_enabled)) return null;
  return { projectId, schema, table, source: root.source as ProjectTableRealtime['source'], desiredEnabled: root.desired_enabled, effectiveEnabled: root.effective_enabled, status };
}
