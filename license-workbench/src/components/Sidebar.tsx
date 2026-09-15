import { useState } from 'react'
import { useStore, useEffectiveSelection } from '../store'

export default function Sidebar() {
  const { state, dispatch } = useStore()
  const { client, project, projectsOfClient } = useEffectiveSelection()
  const [clientForm, setClientForm] = useState({ name: '', company: '', contact: '' })
  const [showClientForm, setShowClientForm] = useState(false)
  const [projectForm, setProjectForm] = useState({ title: '', location: '', shootDate: '' })
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [clientErr, setClientErr] = useState('')
  const [projectErr, setProjectErr] = useState('')

  const addClient = () => {
    if (!clientForm.name.trim()) {
      setClientErr('请填写客户姓名')
      return
    }
    setClientErr('')
    dispatch({
      type: 'client/add',
      name: clientForm.name.trim(),
      company: clientForm.company.trim(),
      contact: clientForm.contact.trim(),
    })
    setClientForm({ name: '', company: '', contact: '' })
    setShowClientForm(false)
  }

  const addProject = () => {
    if (!client) return
    if (!projectForm.title.trim()) {
      setProjectErr('请填写项目标题')
      return
    }
    setProjectErr('')
    dispatch({
      type: 'project/add',
      clientId: client.id,
      title: projectForm.title.trim(),
      location: projectForm.location.trim(),
      shootDate: projectForm.shootDate,
    })
    setProjectForm({ title: '', location: '', shootDate: '' })
    setShowProjectForm(false)
  }

  return (
    <div className="sidebar">
      <div className="panel-head">
        <h2>客户</h2>
        <button
          type="button"
          className="btn small"
          data-testid="client-new-btn"
          onClick={() => setShowClientForm((v) => !v)}
        >
          + 新客户
        </button>
      </div>

      {showClientForm && (
        <div className="inline-form" data-testid="client-form">
          <input
            data-testid="client-name-input"
            placeholder="客户姓名 *"
            value={clientForm.name}
            onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
          />
          <input
            data-testid="client-company-input"
            placeholder="公司 / 品牌"
            value={clientForm.company}
            onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })}
          />
          <input
            data-testid="client-contact-input"
            placeholder="联系方式"
            value={clientForm.contact}
            onChange={(e) => setClientForm({ ...clientForm, contact: e.target.value })}
          />
          {clientErr && <p className="field-error" data-testid="client-form-error">{clientErr}</p>}
          <button type="button" className="btn primary" data-testid="client-add-btn" onClick={addClient}>
            创建客户
          </button>
        </div>
      )}

      {state.clients.length === 0 && !showClientForm && (
        <p className="empty-hint" data-testid="empty-clients">
          还没有客户。点击「+ 新客户」开始建立客户与拍摄项目。
        </p>
      )}

      <ul className="entity-list" data-testid="client-list">
        {state.clients.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`entity-item ${client?.id === c.id ? 'active' : ''}`}
              data-testid={`client-item-${c.id}`}
              onClick={() =>
                dispatch({ type: 'select', patch: { clientId: c.id, projectId: null, schemeId: null } })
              }
            >
              <span className="entity-title">{c.name}</span>
              {c.company && <span className="entity-sub">{c.company}</span>}
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="删除客户(连同其项目与方案)"
              data-testid={`client-delete-${c.id}`}
              onClick={() => {
                if (window.confirm(`删除客户「${c.name}」及其全部项目与方案?`)) {
                  dispatch({ type: 'client/delete', id: c.id })
                }
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {client && (
        <>
          <div className="panel-head" style={{ marginTop: 20 }}>
            <h2>拍摄项目</h2>
            <button
              type="button"
              className="btn small"
              data-testid="project-new-btn"
              onClick={() => setShowProjectForm((v) => !v)}
            >
              + 新项目
            </button>
          </div>

          {showProjectForm && (
            <div className="inline-form" data-testid="project-form">
              <input
                data-testid="project-title-input"
                placeholder="项目标题,如:春季新品画册 *"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
              />
              <input
                data-testid="project-location-input"
                placeholder="拍摄地点"
                value={projectForm.location}
                onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
              />
              <label className="inline-label">
                拍摄日期
                <input
                  type="date"
                  data-testid="project-date-input"
                  value={projectForm.shootDate}
                  onChange={(e) => setProjectForm({ ...projectForm, shootDate: e.target.value })}
                />
              </label>
              {projectErr && <p className="field-error" data-testid="project-form-error">{projectErr}</p>}
              <button type="button" className="btn primary" data-testid="project-add-btn" onClick={addProject}>
                创建项目
              </button>
            </div>
          )}

          {projectsOfClient.length === 0 && !showProjectForm && (
            <p className="empty-hint">该客户还没有拍摄项目。</p>
          )}

          <ul className="entity-list" data-testid="project-list">
            {projectsOfClient.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`entity-item ${project?.id === p.id ? 'active' : ''}`}
                  data-testid={`project-item-${p.id}`}
                  onClick={() =>
                    dispatch({ type: 'select', patch: { projectId: p.id, schemeId: null } })
                  }
                >
                  <span className="entity-title">{p.title}</span>
                  <span className="entity-sub">
                    {[p.location, p.shootDate].filter(Boolean).join(' · ') || '未填写地点/日期'}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="删除项目(连同其方案)"
                  data-testid={`project-delete-${p.id}`}
                  onClick={() => {
                    if (window.confirm(`删除项目「${p.title}」及其全部方案?`)) {
                      dispatch({ type: 'project/delete', id: p.id })
                    }
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
