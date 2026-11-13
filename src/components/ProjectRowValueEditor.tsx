import type { Lang } from '../i18n';
import type { ProjectDatabaseColumn } from '../lib/saasConsole';
import { parseProjectRowField, parseProjectRowValueDraft, projectRowFields, type ProjectRowValueDraft } from '../lib/projectRowEditor';

const TEXT = {
  en: { input: 'Row input', json: 'JSON', fields: 'Fields', mode: 'Value mode', omit: 'Omit', value: 'Value', null: 'NULL', protected: 'Read only', invalid: 'Enter a valid value. Integers must be within the safe integer range.', empty: 'Select at least one value, within 64 fields and 32 KiB.', note: 'Omit uses the database default when adding, and leaves a field unchanged when editing. NULL and empty text are different values. Access policies still control which fields can be saved.' },
  zh: { input: '行输入方式', json: 'JSON', fields: '字段表单', mode: '值模式', omit: '省略', value: '填写值', null: 'NULL', protected: '只读', invalid: '请输入有效值；整数须在安全整数范围内。', empty: '请至少填写一个值，最多 64 个字段、32 KiB。', note: '新增时省略字段使用数据库默认值，编辑时省略表示保持原值。NULL 与空文本不同；访问策略仍决定哪些字段可以保存。' },
};

export function ProjectRowValueEditor({ lang, columns, readOnlyColumns, draft, disabled, onChange }: { lang: Lang; columns: ProjectDatabaseColumn[]; readOnlyColumns?: readonly string[]; draft: ProjectRowValueDraft; disabled: boolean; onChange: (draft: ProjectRowValueDraft) => void }) {
  const t = TEXT[lang];
  const fields = draft.kind === 'json' ? projectRowFields(draft.json, columns, readOnlyColumns) : draft.fields;
  const values = parseProjectRowValueDraft(draft);
  const modeValues = draft.kind === 'fields' ? parseProjectRowValueDraft(draft, true) : values;
  return <>
    <fieldset className="console-row-input-mode" disabled={disabled}>
      <legend>{t.input}</legend>
      <label><input type="radio" name="row-input" checked={draft.kind === 'json'} disabled={draft.kind === 'fields' && !modeValues} onChange={() => { if (modeValues) onChange({ kind: 'json', json: JSON.stringify(modeValues, null, 2) }); }} />{t.json}</label>
      <label><input type="radio" name="row-input" checked={draft.kind === 'fields'} disabled={!fields} onChange={() => { if (fields) onChange({ kind: 'fields', fields }); }} />{t.fields}</label>
    </fieldset>
    {draft.kind === 'json' ? <textarea aria-label={t.json} rows={10} disabled={disabled} value={draft.json} onChange={event => onChange({ kind: 'json', json: event.target.value })} /> : <>
      <p className="console-note">{t.note}</p>
      {draft.fields.map((field, index) => {
        const invalid = field.mode !== 'omit' && !parseProjectRowField(field);
        const update = (patch: Partial<typeof field>) => onChange({ kind: 'fields', fields: draft.fields.map((item, i) => i === index ? { ...item, ...patch } : item) });
        const readOnly = field.readOnly || Boolean(readOnlyColumns?.includes(field.name));
        const locked = disabled || readOnly || field.mode !== 'value';
        return <div className="console-row-field" key={field.name}>
          <div className="console-row-field-heading"><strong>{field.name}</strong><small>{field.dataType || 'JSON'}{readOnly ? ` · ${t.protected}` : ''}</small>
            <select aria-label={`${t.mode}: ${field.name}`} value={field.mode} disabled={disabled || readOnly} onChange={event => update({ mode: event.target.value as typeof field.mode })}>
              <option value="omit">{t.omit}</option><option value="value">{t.value}</option><option value="null" disabled={!field.nullable}>{t.null}</option>
            </select>
          </div>
          {field.kind === 'boolean' ? <select aria-label={field.name} disabled={locked} value={field.text} onChange={event => update({ text: event.target.value })}><option value="false">false</option><option value="true">true</option></select>
            : field.kind === 'json' ? <textarea aria-label={field.name} rows={3} disabled={locked} aria-invalid={Boolean(invalid)} value={field.text} onChange={event => update({ text: event.target.value })} />
              : <input aria-label={field.name} inputMode={field.kind === 'integer' ? 'numeric' : 'text'} disabled={locked} aria-invalid={Boolean(invalid)} value={field.text} onChange={event => update({ text: event.target.value })} />}
          {invalid && <small role="alert">{t.invalid}</small>}
        </div>;
      })}
      {!values && <p role="status">{t.empty}</p>}
    </>}
  </>;
}
