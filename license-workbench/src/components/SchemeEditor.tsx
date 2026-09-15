import { useState } from 'react'
import { useStore, useEffectiveSelection } from '../store'
import { ALL_CHANNELS, ALL_REGIONS, CHANNEL_LABEL, REGION_LABEL, Channel, SchemeParams } from '../types'
import { validateParams } from '../validate'

function NumField({
  label,
  unit,
  value,
  min,
  max,
  step,
  error,
  testid,
  onCommit,
}: {
  label: string
  unit?: string
  value: number | null
  min?: number
  max?: number
  step?: number
  error?: string
  testid: string
  onCommit: (v: number | null) => void
}) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          data-testid={testid}
          value={value ?? ''}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => {
            const raw = e.target.value
            onCommit(raw === '' ? null : Number(raw))
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </span>
      {error && (
        <span className="field-error" data-testid={`${testid}-error`}>
          {error}
        </span>
      )}
    </label>
  )
}

export default function SchemeEditor() {
  const { state, dispatch } = useStore()
  const { scheme } = useEffectiveSelection()
  const [note, setNote] = useState('')

  if (!scheme) {
    return null
  }

  const p = scheme.draft
  const v = validateParams(p)
  const history = state.history[scheme.id]
  const canUndo = !!history && history.past.length > 0
  const canRedo = !!history && history.future.length > 0

  const commit = (patch: Partial<SchemeParams>, field: string) =>
    dispatch({ type: 'draft/update', schemeId: scheme.id, patch, field })

  const toggleChannel = (c: Channel) => {
    const has = p.channels.includes(c)
    const next = has ? p.channels.filter((x) => x !== c) : [...p.channels, c]
    commit({ channels: next }, 'channels')
  }

  const confirm = () => {
    dispatch({ type: 'version/confirm', schemeId: scheme.id, note: note.trim() })
    setNote('')
  }

  return (
    <div className="scheme-editor" data-testid="scheme-editor">
      <div className="editor-head">
        <input
          className="scheme-name-input"
          data-testid="scheme-name-input"
          value={scheme.name}
          onChange={(e) => dispatch({ type: 'scheme/rename', id: scheme.id, name: e.target.value })}
          aria-label="方案名称"
        />
        <div className="editor-head-ops">
          <button
            type="button"
            className="btn ghost small"
            data-testid="editor-undo-btn"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'draft/undo', schemeId: scheme.id })}
          >
            ↩ 撤销
          </button>
          <button
            type="button"
            className="btn ghost small"
            data-testid="editor-redo-btn"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'draft/redo', schemeId: scheme.id })}
          >
            ↪ 重做
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <NumField
          label="拍摄天数"
          unit="天"
          value={p.shootDays}
          min={1}
          max={365}
          error={v.fieldErrors.shootDays}
          testid="field-shootDays"
          onCommit={(n) => commit({ shootDays: n }, 'shootDays')}
        />
        <NumField
          label="交付张数"
          unit="张"
          value={p.deliveredImages}
          min={1}
          max={2000}
          error={v.fieldErrors.deliveredImages}
          testid="field-deliveredImages"
          onCommit={(n) => commit({ deliveredImages: n }, 'deliveredImages')}
        />
        <label className="field">
          <span className="field-label">授权区域</span>
          <span className="field-input">
            <select
              data-testid="field-region"
              value={p.region}
              onChange={(e) => commit({ region: e.target.value as SchemeParams['region'] }, 'region')}
            >
              {ALL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABEL[r]}
                </option>
              ))}
            </select>
          </span>
        </label>
        <NumField
          label="授权期限"
          unit="个月"
          value={p.durationMonths}
          min={1}
          max={120}
          error={v.fieldErrors.durationMonths}
          testid="field-durationMonths"
          onCommit={(n) => commit({ durationMonths: n }, 'durationMonths')}
        />
        <NumField
          label="折扣"
          unit="%"
          value={p.discountPct}
          min={0}
          max={90}
          step={1}
          error={v.fieldErrors.discountPct}
          testid="field-discountPct"
          onCommit={(n) => commit({ discountPct: n }, 'discountPct')}
        />
        <NumField
          label="税率"
          unit="%"
          value={p.taxRatePct}
          min={0}
          max={30}
          step={0.5}
          error={v.fieldErrors.taxRatePct}
          testid="field-taxRatePct"
          onCommit={(n) => commit({ taxRatePct: n }, 'taxRatePct')}
        />
      </div>

      <fieldset className={`channel-group ${v.conflicts.some((c) => c.includes('渠道') || c.includes('买断')) ? 'has-error' : ''}`}>
        <legend>传播渠道(可多选)</legend>
        <div className="channel-options" data-testid="channel-group">
          {ALL_CHANNELS.map((c) => (
            <label key={c} className={`channel-option ${p.channels.includes(c) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                data-testid={`channel-${c}`}
                checked={p.channels.includes(c)}
                onChange={() => toggleChannel(c)}
              />
              {CHANNEL_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>

      {(v.conflicts.length > 0 || v.warnings.length > 0) && (
        <div className="validation-msgs" data-testid="validation-msgs">
          {v.conflicts.map((c) => (
            <p key={c} className="msg-conflict" data-testid="conflict-msg">
              ⛔ {c}
            </p>
          ))}
          {v.warnings.map((w) => (
            <p key={w} className="msg-warning" data-testid="warning-msg">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <div className="confirm-bar">
        <input
          className="version-note-input"
          data-testid="version-note-input"
          placeholder="版本备注(可选),如:客户要求增加电视渠道"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          data-testid="confirm-version-btn"
          disabled={!v.ok}
          title={v.ok ? '将当前参数固化为一个不可变版本' : '存在错误或冲突,无法确认版本'}
          onClick={confirm}
        >
          确认为版本 v{scheme.versions.length + 1}
        </button>
      </div>
      {!v.ok && (
        <p className="confirm-blocked-hint" data-testid="confirm-blocked-hint">
          存在错误或冲突,确认已阻断;修正后才能生成新版本,已确认版本不受影响。
        </p>
      )}
    </div>
  )
}
