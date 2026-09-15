import { useStore, useEffectiveSelection } from '../store'
import { fmtMoney } from '../pricing'

export default function SchemeList() {
  const { state, dispatch } = useStore()
  const { project, scheme, schemesOfProject } = useEffectiveSelection()

  if (!project) {
    return (
      <div className="scheme-list-empty" data-testid="no-project-hint">
        <p className="empty-hint">先在左侧选择或创建一个客户与拍摄项目。</p>
      </div>
    )
  }

  return (
    <div className="scheme-list">
      <div className="panel-head">
        <h2>
          费用方案 <span className="muted">· {project.title}</span>
        </h2>
        <button
          type="button"
          className="btn small"
          data-testid="scheme-add-btn"
          onClick={() => dispatch({ type: 'scheme/add', projectId: project.id })}
        >
          + 新方案
        </button>
      </div>

      {schemesOfProject.length === 0 && (
        <p className="empty-hint" data-testid="empty-schemes">
          还没有费用方案。点击「+ 新方案」,按拍摄天数、交付张数、授权范围与渠道生成报价。
        </p>
      )}

      <div className="scheme-tabs" role="tablist" data-testid="scheme-tabs">
        {schemesOfProject.map((s) => {
          const latest = s.versions[s.versions.length - 1]
          return (
            <div key={s.id} className={`scheme-tab ${scheme?.id === s.id ? 'active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={scheme?.id === s.id}
                className="scheme-tab-main"
                data-testid={`scheme-tab-${s.id}`}
                onClick={() => dispatch({ type: 'select', patch: { schemeId: s.id } })}
              >
                <span className="scheme-tab-name">{s.name}</span>
                <span className="scheme-tab-meta">
                  {s.versions.length > 0
                    ? `${s.versions.length} 个版本 · 最新 ${fmtMoney(latest.total)}`
                    : '草稿,未确认版本'}
                </span>
              </button>
              <span className="scheme-tab-ops">
                <button
                  type="button"
                  className="icon-btn"
                  title="复制此方案(参数生成新草稿)"
                  data-testid={`scheme-dup-${s.id}`}
                  onClick={() => dispatch({ type: 'scheme/duplicate', id: s.id })}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="删除方案"
                  data-testid={`scheme-del-${s.id}`}
                  onClick={() => {
                    if (window.confirm(`删除「${s.name}」及其全部版本?`)) {
                      dispatch({ type: 'scheme/delete', id: s.id })
                    }
                  }}
                >
                  ×
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
