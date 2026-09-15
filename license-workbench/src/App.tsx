import { useEffect } from 'react'
import { useStore, useEffectiveSelection } from './store'
import Sidebar from './components/Sidebar'
import SchemeList from './components/SchemeList'
import SchemeEditor from './components/SchemeEditor'
import BreakdownPanel from './components/BreakdownPanel'
import VersionsPanel from './components/VersionsPanel'
import CompareView from './components/CompareView'
import Toast from './components/Toast'

export default function App() {
  const { state, dispatch } = useStore()
  const { scheme } = useEffectiveSelection()

  // 移动端:切换选中的方案后自动进入编辑页
  useEffect(() => {
    if (scheme && state.mobileTab === 'schemes') {
      // 停留在方案列表,由用户点击进入编辑;不强制跳转
    }
  }, [scheme, state.mobileTab])

  const history = scheme ? state.history[scheme.id] : undefined
  const canUndo = !!history && history.past.length > 0
  const canRedo = !!history && history.future.length > 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◧</span>
          <span className="brand-name">拍摄授权预算工作台</span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn ghost"
            data-testid="undo-btn"
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
            onClick={() => scheme && dispatch({ type: 'draft/undo', schemeId: scheme.id })}
          >
            ↩ 撤销
          </button>
          <button
            type="button"
            className="btn ghost"
            data-testid="redo-btn"
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z)"
            onClick={() => scheme && dispatch({ type: 'draft/redo', schemeId: scheme.id })}
          >
            ↪ 重做
          </button>
          {state.compare.length > 0 && (
            <span className="compare-hint" data-testid="compare-hint">
              已选 {state.compare.length}/2 个版本用于比较
            </span>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className={`panel panel-clients ${state.mobileTab === 'clients' ? 'mobile-active' : ''}`}>
          <Sidebar />
        </aside>

        <section className={`panel panel-schemes ${state.mobileTab === 'schemes' ? 'mobile-active' : ''}`}>
          <SchemeList />
          <SchemeEditor />
        </section>

        <section className={`panel panel-detail ${state.mobileTab === 'detail' ? 'mobile-active' : ''}`}>
          <BreakdownPanel />
          <VersionsPanel />
        </section>
      </div>

      <nav className="mobile-nav" aria-label="主导航">
        {(
          [
            ['clients', '客户'],
            ['schemes', '方案'],
            ['detail', '明细与版本'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            data-testid={`nav-${tab}`}
            className={`mobile-nav-btn ${state.mobileTab === tab ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'mobileTab', tab })}
          >
            {label}
          </button>
        ))}
      </nav>

      {state.compare.length === 2 && <CompareView />}
      <Toast />
    </div>
  )
}
