import { useEffectiveSelection } from '../store'
import { computeBreakdown, fmtMoney } from '../pricing'
import { validateParams } from '../validate'

/** 当前草稿的实时可解释费用明细 */
export default function BreakdownPanel() {
  const { scheme } = useEffectiveSelection()

  if (!scheme) {
    return (
      <section className="breakdown-panel" data-testid="breakdown-panel">
        <div className="panel-head">
          <h2>费用明细</h2>
        </div>
        <p className="empty-hint">选择或新建一个方案后,这里会实时显示可解释的费用明细。</p>
      </section>
    )
  }

  const validation = validateParams(scheme.draft)
  const breakdown = validation.ok ? computeBreakdown(scheme.draft) : null

  return (
    <section className="breakdown-panel" data-testid="breakdown-panel">
      <div className="panel-head">
        <h2>费用明细</h2>
        <span className="muted">{scheme.name} · 草稿实时计算</span>
      </div>

      {!breakdown ? (
        <div className="breakdown-invalid" data-testid="breakdown-invalid">
          <p>当前参数存在错误或冲突,无法计算明细。请先修正左侧表单中标红的问题。</p>
        </div>
      ) : (
        <>
          <table className="lines-table" data-testid="breakdown-lines">
            <tbody>
              {breakdown.lines.map((l) => (
                <tr key={l.key} className={`line-${l.kind}`} data-testid={`line-${l.key}`}>
                  <td className="line-label">{l.label}</td>
                  <td className="formula">{l.formula}</td>
                  <td className="amount">{fmtMoney(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="breakdown-total-row">
            <span>含税合计</span>
            <strong className="breakdown-total" data-testid="breakdown-total">
              {fmtMoney(breakdown.total)}
            </strong>
          </div>
        </>
      )}
    </section>
  )
}
