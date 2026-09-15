import { useStore, findVersion } from '../store'
import { fmtMoney } from '../pricing'
import { CHANNEL_LABEL, REGION_LABEL, SchemeParams, Version } from '../types'

interface ParamRow {
  label: string
  get: (p: SchemeParams) => string
}

const PARAM_ROWS: ParamRow[] = [
  { label: '拍摄天数', get: (p) => `${p.shootDays} 天` },
  { label: '交付张数', get: (p) => `${p.deliveredImages} 张` },
  { label: '授权区域', get: (p) => REGION_LABEL[p.region] },
  { label: '授权期限', get: (p) => `${p.durationMonths} 个月` },
  { label: '传播渠道', get: (p) => p.channels.map((c) => CHANNEL_LABEL[c]).join('、') },
  { label: '折扣', get: (p) => `${p.discountPct}%` },
  { label: '税率', get: (p) => `${p.taxRatePct}%` },
]

export default function CompareView() {
  const { state, dispatch } = useStore()
  const [a, b] = state.compare
  const va = a ? findVersion(state, a) : null
  const vb = b ? findVersion(state, b) : null
  if (!va || !vb) return null

  const label = (schemeName: string, v: Version) => `${schemeName} · v${v.no}`

  // 汇总两版所有明细行 key,按首次出现顺序排列
  const lineKeys: string[] = []
  const lineLabels = new Map<string, string>()
  for (const v of [va.version, vb.version]) {
    for (const l of v.lines) {
      if (!lineLabels.has(l.key)) {
        lineKeys.push(l.key)
        lineLabels.set(l.key, l.label)
      }
    }
  }
  const amountOf = (v: Version, key: string) => v.lines.find((l) => l.key === key)?.amount

  return (
    <div className="compare-overlay" data-testid="compare-view" role="dialog" aria-label="版本比较">
      <div className="compare-card">
        <div className="compare-head">
          <h2>版本比较</h2>
          <button
            type="button"
            className="icon-btn"
            data-testid="compare-close"
            aria-label="关闭比较"
            onClick={() => dispatch({ type: 'compare/clear' })}
          >
            ×
          </button>
        </div>
        <div className="compare-scroll">
          <table className="compare-table" data-testid="compare-table">
            <thead>
              <tr>
                <th>项目</th>
                <th data-testid="compare-col-a">{label(va.scheme.name, va.version)}</th>
                <th data-testid="compare-col-b">{label(vb.scheme.name, vb.version)}</th>
              </tr>
            </thead>
            <tbody>
              {PARAM_ROWS.map((row) => {
                const x = row.get(va.version.params)
                const y = row.get(vb.version.params)
                const diff = x !== y
                return (
                  <tr key={row.label} className={diff ? 'diff' : ''} data-testid={`compare-param-${row.label}`}>
                    <td>{row.label}</td>
                    <td>{x}</td>
                    <td>{y}</td>
                  </tr>
                )
              })}
              <tr className="section-row">
                <td colSpan={3}>费用明细</td>
              </tr>
              {lineKeys.map((key) => {
                const x = amountOf(va.version, key)
                const y = amountOf(vb.version, key)
                const diff = x !== y
                const isTotal = key === 'total'
                return (
                  <tr
                    key={key}
                    className={`${diff ? 'diff' : ''} ${isTotal ? 'total-row' : ''}`}
                    data-testid={`compare-line-${key}`}
                  >
                    <td>{lineLabels.get(key)}</td>
                    <td>{x == null ? '—' : fmtMoney(x)}</td>
                    <td>{y == null ? '—' : fmtMoney(y)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="compare-foot muted">高亮行为两版差异项。比较仅读取已确认版本,不受当前草稿影响。</p>
      </div>
    </div>
  )
}
