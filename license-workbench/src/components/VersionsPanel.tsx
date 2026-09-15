import { useState } from 'react'
import { useStore, useEffectiveSelection } from '../store'
import { fmtMoney } from '../pricing'
import { CHANNEL_LABEL, REGION_LABEL, Version } from '../types'

function VersionCard({ version }: { version: Version }) {
  const { state, dispatch } = useStore()
  const { scheme } = useEffectiveSelection()
  const [open, setOpen] = useState(false)
  if (!scheme) return null

  const inCompare = state.compare.some((r) => r.versionId === version.id)
  const p = version.params

  return (
    <li className="version-card" data-testid={`version-item-v${version.no}`}>
      <div className="version-head">
        <button type="button" className="version-title" onClick={() => setOpen((v) => !v)}>
          <span className="version-no">v{version.no}</span>
          <span className="version-total" data-testid={`version-total-v${version.no}`}>
            {fmtMoney(version.total)}
          </span>
          <span className="version-time">{new Date(version.confirmedAt).toLocaleString('zh-CN')}</span>
        </button>
        <div className="version-ops">
          <button
            type="button"
            className="btn tiny"
            data-testid={`restore-v${version.no}`}
            title="将该版本参数恢复为当前草稿"
            onClick={() => dispatch({ type: 'version/restore', schemeId: scheme.id, versionId: version.id })}
          >
            恢复
          </button>
          <button
            type="button"
            className={`btn tiny ${inCompare ? 'active' : ''}`}
            data-testid={`compare-toggle-v${version.no}`}
            title="选择两个版本进行并排比较"
            onClick={() =>
              dispatch({ type: 'compare/toggle', ref: { schemeId: scheme.id, versionId: version.id } })
            }
          >
            {inCompare ? '已选比较' : '比较'}
          </button>
          <button
            type="button"
            className="icon-btn danger"
            title="删除此版本"
            data-testid={`version-delete-v${version.no}`}
            onClick={() => {
              if (window.confirm(`删除版本 v${version.no}?`)) {
                dispatch({ type: 'version/delete', schemeId: scheme.id, versionId: version.id })
              }
            }}
          >
            ×
          </button>
        </div>
      </div>
      {version.note && <p className="version-note">「{version.note}」</p>}
      <p className="version-summary">
        {p.shootDays} 天 · {p.deliveredImages} 张 · {REGION_LABEL[p.region]} · {p.durationMonths} 个月 ·{' '}
        {p.channels.map((c) => CHANNEL_LABEL[c]).join('、')} · 折扣 {p.discountPct}% · 税率 {p.taxRatePct}%
      </p>
      {open && (
        <table className="lines-table" data-testid={`version-lines-v${version.no}`}>
          <tbody>
            {version.lines.map((l) => (
              <tr key={l.key} className={`line-${l.kind}`}>
                <td>{l.label}</td>
                <td className="formula">{l.formula}</td>
                <td className="amount">{fmtMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  )
}

export default function VersionsPanel() {
  const { scheme } = useEffectiveSelection()
  if (!scheme) return null

  return (
    <section className="versions-panel" data-testid="versions-panel">
      <div className="panel-head">
        <h2>已确认版本</h2>
        <span className="muted" data-testid="version-count">
          {scheme.versions.length} 个
        </span>
      </div>
      {scheme.versions.length === 0 ? (
        <p className="empty-hint" data-testid="no-versions">
          尚无已确认版本。编辑左侧参数并通过校验后,点击「确认为版本」固化一版报价。
        </p>
      ) : (
        <ul className="version-list" data-testid="version-list">
          {[...scheme.versions].reverse().map((v) => (
            <VersionCard key={v.id} version={v} />
          ))}
        </ul>
      )}
    </section>
  )
}
