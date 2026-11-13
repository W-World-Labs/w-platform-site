import { useState } from 'react';
import type { Lang } from '../i18n';
import type { ProjectMigrationFile } from '../lib/saasConsole';
import { createProjectTableMigration, projectTableColumnDefaultSql, projectTableColumnReferenceSql, PROJECT_TABLE_COLUMN_TYPES, type ProjectTableColumnDefinition, type ProjectTableColumnDefault, type ProjectTablePrimaryKey } from '../lib/projectTableDefinition';

const COPY = {
  en: { title: 'Create a table', note: 'Define a public table with an automatically generated primary key. Prepare the migration below, inspect it, then preview and apply with your project ID. Preparing sends no request.', table: 'New table name', primaryName: 'Primary key name', primaryType: 'Primary key type', integerKey: 'Auto-increment integer (bigint)', uuidKey: 'Automatically generated UUID', column: 'Column name', type: 'Column type', nullable: 'Allow NULL', add: 'Add column', remove: 'Remove column', security: 'Enable and force row security', access: 'Application access requires publishing the table and configuring row policies. Creating the table does not grant access.', prepare: 'Prepare create-table migration', invalid: 'Use unique names of 1–63 UTF-8 bytes, excluding path separators and control characters. The primary key name must differ from all other columns. Add 1–16 columns.', prepared: 'Migration prepared below. Review it before applying.', defaultMode: 'Column default', noDefault: 'No default', literal: 'Literal value', defaultValue: 'Default value', now: 'Current timestamp', today: 'Current date', uuid: 'Generated UUID', null: 'SQL NULL', unique: 'Require unique values', defaultHelp: 'Defaults apply when a field is omitted. Literal values use the selected type, up to 1 KiB; dates and timestamps use ISO format, with a timezone for timestamps. Changing the type clears its default and reference. SQL NULL and JSON null differ. Unique nullable columns allow multiple SQL NULL values.', invalidDefault: 'Check the default value and its column type. SQL NULL requires Allow NULL.', foreignKey: 'Reference another record', referenceTable: 'Referenced table (public)', referenceColumn: 'Referenced column', onDelete: 'When the referenced record is deleted', restrict: 'Prevent deletion while referenced', cascade: 'Delete referencing rows', setNull: 'Set this field to NULL', referenceHelp: 'References use tables in this project’s public schema, including this new table. The referenced field must be a primary key or a unique field with a compatible type. PostgreSQL validates the target when applying. Set NULL requires Allow NULL. Cascade deletes referencing rows; foreign keys do not grant application access.', invalidReference: 'Enter valid referenced table and column names. Set NULL requires Allow NULL.' },
  zh: { title: '创建数据表', note: '配置 public 表和自动生成的主键。先生成下方迁移并检查，再预览并输入项目 ID 应用。生成迁移不会发送请求。', table: '新表名称', primaryName: '主键名称', primaryType: '主键类型', integerKey: '自动增长整数（bigint）', uuidKey: '自动生成 UUID', column: '字段名称', type: '字段类型', nullable: '允许 NULL', add: '添加字段', remove: '移除字段', security: '启用并强制行级权限', access: '应用访问需要发布数据表并配置行级策略。创建数据表不会授予访问权限。', prepare: '生成建表迁移', invalid: '名称须唯一、占 1–63 个 UTF-8 字节且不含路径分隔符或控制字符。主键名称不能与其他字段重复。请添加 1–16 个字段。', prepared: '迁移已生成在下方，请检查后再应用。', defaultMode: '字段默认值', noDefault: '无默认值', literal: '固定值', defaultValue: '默认值内容', now: '当前时间', today: '当前日期', uuid: '自动生成 UUID', null: 'SQL NULL', unique: '要求值唯一', defaultHelp: '省略字段时使用默认值。固定值须匹配字段类型，最多 1 KiB；日期与时间采用 ISO 格式，时间须带时区。更改类型会清除该字段的默认值和引用。SQL NULL 与 JSON null 不同。允许 NULL 的唯一字段可包含多个 SQL NULL。', invalidDefault: '请检查默认值与字段类型；SQL NULL 需要勾选允许 NULL。', foreignKey: '引用其他记录', referenceTable: '引用表（public）', referenceColumn: '引用字段', onDelete: '删除被引用记录时', restrict: '存在引用时禁止删除', cascade: '同时删除引用行', setNull: '将此字段设为 NULL', referenceHelp: '可引用当前项目 public 下的表，包括正在创建的表。目标字段须为主键或唯一字段，且类型兼容；应用迁移时由 PostgreSQL 校验。设为 NULL 需要勾选允许 NULL。级联删除会删除引用行；外键不会授予应用访问权限。', invalidReference: '请输入有效的引用表和字段名称；设为 NULL 需要勾选允许 NULL。' },
} as const;

export function ProjectTableDefinition({ lang, disabled, onPrepare }: { lang: Lang; disabled: boolean; onPrepare: (file: ProjectMigrationFile) => void }) {
  const t = COPY[lang];
  const [table, setTable] = useState('');
  const [primaryKey, setPrimaryKey] = useState<ProjectTablePrimaryKey>({ name: 'id', type: 'bigint' });
  const [columns, setColumns] = useState<ProjectTableColumnDefinition[]>([{ name: 'title', type: 'text', nullable: false }]);
  const [rowSecurity, setRowSecurity] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const valid = createProjectTableMigration(table, columns, rowSecurity, '1', primaryKey) !== null;
  const change = (index: number, patch: Partial<ProjectTableColumnDefinition>) => { setPrepared(false); setColumns(columns.map((column, i) => i === index ? { ...column, ...patch } : column)); };
  return <details className="console-table-definition">
    <summary>{t.title}</summary><p className="console-note">{t.note}</p>
    <form onSubmit={event => { event.preventDefault(); if (disabled) return; const file = createProjectTableMigration(table, columns, rowSecurity, new Date().toISOString().replace(/\D/g, ''), primaryKey); if (file) { onPrepare(file); setPrepared(true); } }}>
      <label>{t.table}<input disabled={disabled} value={table} onChange={event => { setTable(event.target.value); setPrepared(false); }} /></label>
      <label>{t.primaryName}<input disabled={disabled} value={primaryKey.name} onChange={event => { setPrimaryKey({ ...primaryKey, name: event.target.value }); setPrepared(false); }} /></label>
      <label>{t.primaryType}<select aria-label={t.primaryType} disabled={disabled} value={primaryKey.type} onChange={event => { setPrimaryKey({ ...primaryKey, type: event.target.value as ProjectTablePrimaryKey['type'] }); setPrepared(false); }}><option value="bigint">{t.integerKey}</option><option value="uuid">{t.uuidKey}</option></select></label>
      {columns.map((column, index) => <fieldset key={index} disabled={disabled}><legend>{index + 1}</legend>
        <label>{t.column}<input aria-label={t.column} value={column.name} onChange={event => change(index, { name: event.target.value })} /></label>
        <label>{t.type}<select aria-label={t.type} value={column.type} onChange={event => change(index, { type: event.target.value as ProjectTableColumnDefinition['type'], defaultValue: undefined, reference: undefined })}>{PROJECT_TABLE_COLUMN_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="console-table-definition-check"><input type="checkbox" checked={column.nullable} onChange={event => change(index, { nullable: event.target.checked })} />{t.nullable}</label>
        <label className="console-table-definition-check"><input type="checkbox" checked={column.unique || false} onChange={event => change(index, { unique: event.target.checked })} />{t.unique}</label>
        <label>{t.defaultMode}<select aria-label={t.defaultMode} value={column.defaultValue?.kind || 'none'} onChange={event => {
          const kind = event.target.value as ProjectTableColumnDefault['kind'] | 'none';
          change(index, { defaultValue: kind === 'none' ? undefined : kind === 'literal' ? { kind, value: column.type === 'boolean' ? 'false' : column.type === 'jsonb' ? '{}' : ['integer', 'bigint', 'numeric'].includes(column.type) ? '0' : '' } : { kind } });
        }}><option value="none">{t.noDefault}</option><option value="literal">{t.literal}</option><option value="null" disabled={!column.nullable}>{t.null}</option>{column.type === 'timestamptz' && <option value="now">{t.now}</option>}{column.type === 'date' && <option value="today">{t.today}</option>}{column.type === 'uuid' && <option value="uuid">{t.uuid}</option>}</select></label>
        {column.defaultValue?.kind === 'literal' && <label>{t.defaultValue}{column.type === 'boolean'
          ? <select aria-label={t.defaultValue} value={column.defaultValue.value} onChange={event => change(index, { defaultValue: { kind: 'literal', value: event.target.value } })}><option value="false">false</option><option value="true">true</option></select>
          : <textarea aria-label={t.defaultValue} rows={2} value={column.defaultValue.value} aria-invalid={projectTableColumnDefaultSql(column) === null} onChange={event => change(index, { defaultValue: { kind: 'literal', value: event.target.value } })} />}</label>}
        {projectTableColumnDefaultSql(column) === null && <p role="alert">{t.invalidDefault}</p>}
        <label className="console-table-definition-check"><input type="checkbox" checked={column.reference !== undefined} onChange={event => change(index, { reference: event.target.checked ? { table: '', column: 'id', onDelete: 'restrict' } : undefined })} />{t.foreignKey}</label>
        {column.reference && <>
          <label>{t.referenceTable}<input aria-label={t.referenceTable} value={column.reference.table} onChange={event => change(index, { reference: { ...column.reference!, table: event.target.value } })} /></label>
          <label>{t.referenceColumn}<input aria-label={t.referenceColumn} value={column.reference.column} onChange={event => change(index, { reference: { ...column.reference!, column: event.target.value } })} /></label>
          <label>{t.onDelete}<select aria-label={t.onDelete} value={column.reference.onDelete} onChange={event => change(index, { reference: { ...column.reference!, onDelete: event.target.value as NonNullable<ProjectTableColumnDefinition['reference']>['onDelete'] } })}><option value="restrict">{t.restrict}</option><option value="cascade">{t.cascade}</option><option value="set-null" disabled={!column.nullable}>{t.setNull}</option></select></label>
          {projectTableColumnReferenceSql(column) === null && <p role="alert">{t.invalidReference}</p>}
        </>}
        <button type="button" onClick={() => { setColumns(columns.filter((_, i) => i !== index)); setPrepared(false); }}>{t.remove}</button>
      </fieldset>)}
      <button type="button" disabled={disabled || columns.length >= 16} onClick={() => { setColumns([...columns, { name: '', type: 'text', nullable: true }]); setPrepared(false); }}>{t.add}</button>
      <p className="console-note">{t.defaultHelp}</p><p className="console-note">{t.referenceHelp}</p>
      <label className="console-table-definition-check"><input disabled={disabled} type="checkbox" checked={rowSecurity} onChange={event => { setRowSecurity(event.target.checked); setPrepared(false); }} />{t.security}</label><p className="console-note">{t.access}</p>
      {!valid && <p>{t.invalid}</p>}<button className="site-nav-button" type="submit" disabled={disabled || !valid}>{t.prepare}</button>
      {prepared && <p role="status">{t.prepared}</p>}
    </form>
  </details>;
}
