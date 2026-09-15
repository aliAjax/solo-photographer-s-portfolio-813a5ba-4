import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'
import {
  Client,
  Project,
  Scheme,
  SchemeParams,
  Version,
  cloneParams,
  defaultParams,
} from './types'
import { computeBreakdown } from './pricing'
import { validateParams } from './validate'

// ---------- 状态 ----------

export interface Selection {
  clientId: string | null
  projectId: string | null
  schemeId: string | null
}

interface HistEntry {
  params: SchemeParams
  field: string | null
  at: number
}

interface History {
  past: HistEntry[]
  future: HistEntry[]
}

export interface CompareRef {
  schemeId: string
  versionId: string
}

export type MobileTab = 'clients' | 'schemes' | 'editor' | 'detail'

export interface State {
  clients: Client[]
  projects: Project[]
  schemes: Scheme[]
  selection: Selection
  history: Record<string, History>
  compare: CompareRef[]
  toast: { id: number; text: string; kind: 'ok' | 'err' } | null
  mobileTab: MobileTab
}

const STORAGE_KEY = 'license-workbench/v1'
const COALESCE_MS = 1200

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ---------- 持久化 ----------

interface Persisted {
  clients: Client[]
  projects: Project[]
  schemes: Scheme[]
  selection: Selection
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (
      !Array.isArray(data.clients) ||
      !Array.isArray(data.projects) ||
      !Array.isArray(data.schemes)
    ) {
      return null
    }
    // 结构兜底:确认版本必须带合法明细与合计,否则丢弃该版本(防止脏数据污染)
    const schemes: Scheme[] = data.schemes
      .filter((s: any) => s && typeof s.id === 'string' && s.draft)
      .map((s: any) => ({
        ...s,
        versions: Array.isArray(s.versions)
          ? s.versions.filter(
              (v: any) =>
                v && v.params && Array.isArray(v.lines) &&
                typeof v.total === 'number' && Number.isFinite(v.total),
            )
          : [],
      }))
    return {
      clients: data.clients.filter((c: any) => c && typeof c.id === 'string'),
      projects: data.projects.filter((p: any) => p && typeof p.id === 'string'),
      schemes,
      selection: data.selection ?? { clientId: null, projectId: null, schemeId: null },
    }
  } catch {
    return null
  }
}

function initState(): State {
  const persisted = typeof localStorage !== 'undefined' ? loadPersisted() : null
  return {
    clients: persisted?.clients ?? [],
    projects: persisted?.projects ?? [],
    schemes: persisted?.schemes ?? [],
    selection: persisted?.selection ?? { clientId: null, projectId: null, schemeId: null },
    history: {},
    compare: [],
    toast: null,
    mobileTab: 'clients',
  }
}

// ---------- Actions ----------

export type Action =
  | { type: 'client/add'; name: string; company: string; contact: string }
  | { type: 'client/update'; id: string; patch: Partial<Omit<Client, 'id'>> }
  | { type: 'client/delete'; id: string }
  | { type: 'project/add'; clientId: string; title: string; location: string; shootDate: string }
  | { type: 'project/update'; id: string; patch: Partial<Omit<Project, 'id' | 'clientId'>> }
  | { type: 'project/delete'; id: string }
  | { type: 'scheme/add'; projectId: string }
  | { type: 'scheme/duplicate'; id: string }
  | { type: 'scheme/delete'; id: string }
  | { type: 'scheme/rename'; id: string; name: string }
  | { type: 'draft/update'; schemeId: string; patch: Partial<SchemeParams>; field: string }
  | { type: 'draft/undo'; schemeId: string }
  | { type: 'draft/redo'; schemeId: string }
  | { type: 'version/confirm'; schemeId: string; note: string }
  | { type: 'version/restore'; schemeId: string; versionId: string }
  | { type: 'version/delete'; schemeId: string; versionId: string }
  | { type: 'compare/toggle'; ref: CompareRef }
  | { type: 'compare/clear' }
  | { type: 'select'; patch: Partial<Selection> }
  | { type: 'mobileTab'; tab: MobileTab }
  | { type: 'toast'; text: string; kind: 'ok' | 'err' }
  | { type: 'toast/clear'; id: number }

function pushHistory(state: State, schemeId: string, field: string | null): State['history'] {
  const scheme = state.schemes.find((s) => s.id === schemeId)
  if (!scheme) return state.history
  const h = state.history[schemeId] ?? { past: [], future: [] }
  const now = Date.now()
  const top = h.past[h.past.length - 1]
  // 同一字段的连续快速修改合并为一步,撤销时回到这次连续编辑之前
  const coalesce = top && field !== null && top.field === field && now - top.at < COALESCE_MS
  const past = coalesce
    ? h.past
    : [...h.past, { params: cloneParams(scheme.draft), field, at: now }]
  return { ...state.history, [schemeId]: { past, future: [] } }
}

function withToast(state: State, text: string, kind: 'ok' | 'err' = 'ok'): State {
  return { ...state, toast: { id: Date.now() + Math.random(), text, kind } }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'client/add': {
      const client: Client = {
        id: uid(),
        name: action.name,
        company: action.company,
        contact: action.contact,
        createdAt: Date.now(),
      }
      return withToast(
        {
          ...state,
          clients: [...state.clients, client],
          selection: { clientId: client.id, projectId: null, schemeId: null },
          mobileTab: 'schemes',
        },
        `已创建客户「${client.name}」`,
      )
    }
    case 'client/update': {
      return {
        ...state,
        clients: state.clients.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      }
    }
    case 'client/delete': {
      const projectIds = state.projects.filter((p) => p.clientId === action.id).map((p) => p.id)
      const schemeIds = state.schemes.filter((s) => projectIds.includes(s.projectId)).map((s) => s.id)
      const history = { ...state.history }
      schemeIds.forEach((id) => delete history[id])
      return withToast(
        {
          ...state,
          clients: state.clients.filter((c) => c.id !== action.id),
          projects: state.projects.filter((p) => p.clientId !== action.id),
          schemes: state.schemes.filter((s) => !projectIds.includes(s.projectId)),
          selection: { clientId: null, projectId: null, schemeId: null },
          compare: state.compare.filter((r) => !schemeIds.includes(r.schemeId)),
          history,
        },
        '已删除客户及其项目与方案',
      )
    }
    case 'project/add': {
      const project: Project = {
        id: uid(),
        clientId: action.clientId,
        title: action.title,
        location: action.location,
        shootDate: action.shootDate,
        notes: '',
        createdAt: Date.now(),
      }
      return withToast(
        {
          ...state,
          projects: [...state.projects, project],
          selection: { ...state.selection, clientId: action.clientId, projectId: project.id, schemeId: null },
        },
        `已创建项目「${project.title}」`,
      )
    }
    case 'project/update': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }
    }
    case 'project/delete': {
      const schemeIds = state.schemes.filter((s) => s.projectId === action.id).map((s) => s.id)
      const history = { ...state.history }
      schemeIds.forEach((id) => delete history[id])
      return withToast(
        {
          ...state,
          projects: state.projects.filter((p) => p.id !== action.id),
          schemes: state.schemes.filter((s) => s.projectId !== action.id),
          selection: { ...state.selection, projectId: null, schemeId: null },
          compare: state.compare.filter((r) => !schemeIds.includes(r.schemeId)),
          history,
        },
        '已删除项目及其方案',
      )
    }
    case 'scheme/add': {
      const count = state.schemes.filter((s) => s.projectId === action.projectId).length
      const scheme: Scheme = {
        id: uid(),
        projectId: action.projectId,
        name: `方案 ${count + 1}`,
        draft: defaultParams(),
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      return withToast(
        {
          ...state,
          schemes: [...state.schemes, scheme],
          selection: { ...state.selection, projectId: action.projectId, schemeId: scheme.id },
          mobileTab: state.mobileTab === 'clients' ? 'schemes' : state.mobileTab,
        },
        `已新建「${scheme.name}」,请编辑参数`,
      )
    }
    case 'scheme/duplicate': {
      const src = state.schemes.find((s) => s.id === action.id)
      if (!src) return state
      const copy: Scheme = {
        id: uid(),
        projectId: src.projectId,
        name: src.name + ' 副本',
        draft: cloneParams(src.draft),
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      return withToast(
        {
          ...state,
          schemes: [...state.schemes, copy],
          selection: { ...state.selection, schemeId: copy.id },
        },
        `已复制为「${copy.name}」(草稿参数一致,版本不复制)`,
      )
    }
    case 'scheme/delete': {
      const history = { ...state.history }
      delete history[action.id]
      return withToast(
        {
          ...state,
          schemes: state.schemes.filter((s) => s.id !== action.id),
          selection: state.selection.schemeId === action.id
            ? { ...state.selection, schemeId: null }
            : state.selection,
          compare: state.compare.filter((r) => r.schemeId !== action.id),
          history,
        },
        '已删除方案',
      )
    }
    case 'scheme/rename': {
      return {
        ...state,
        schemes: state.schemes.map((s) =>
          s.id === action.id ? { ...s, name: action.name, updatedAt: Date.now() } : s,
        ),
      }
    }
    case 'draft/update': {
      const history = pushHistory(state, action.schemeId, action.field)
      return {
        ...state,
        history,
        schemes: state.schemes.map((s) =>
          s.id === action.schemeId
            ? { ...s, draft: { ...s.draft, ...action.patch }, updatedAt: Date.now() }
            : s,
        ),
      }
    }
    case 'draft/undo': {
      const h = state.history[action.schemeId]
      const scheme = state.schemes.find((s) => s.id === action.schemeId)
      if (!h || h.past.length === 0 || !scheme) return state
      const entry = h.past[h.past.length - 1]
      return {
        ...state,
        history: {
          ...state.history,
          [action.schemeId]: {
            past: h.past.slice(0, -1),
            future: [...h.future, { params: cloneParams(scheme.draft), field: null, at: Date.now() }],
          },
        },
        schemes: state.schemes.map((s) =>
          s.id === action.schemeId ? { ...s, draft: cloneParams(entry.params), updatedAt: Date.now() } : s,
        ),
      }
    }
    case 'draft/redo': {
      const h = state.history[action.schemeId]
      const scheme = state.schemes.find((s) => s.id === action.schemeId)
      if (!h || h.future.length === 0 || !scheme) return state
      const entry = h.future[h.future.length - 1]
      return {
        ...state,
        history: {
          ...state.history,
          [action.schemeId]: {
            past: [...h.past, { params: cloneParams(scheme.draft), field: null, at: Date.now() }],
            future: h.future.slice(0, -1),
          },
        },
        schemes: state.schemes.map((s) =>
          s.id === action.schemeId ? { ...s, draft: cloneParams(entry.params), updatedAt: Date.now() } : s,
        ),
      }
    }
    case 'version/confirm': {
      const scheme = state.schemes.find((s) => s.id === action.schemeId)
      if (!scheme) return state
      const validation = validateParams(scheme.draft)
      if (!validation.ok) {
        return withToast(state, '存在错误或冲突,已阻止确认;已确认版本不受影响', 'err')
      }
      const breakdown = computeBreakdown(scheme.draft)
      if (!breakdown) {
        return withToast(state, '参数无法计算,已阻止确认', 'err')
      }
      const version: Version = {
        id: uid(),
        no: scheme.versions.length + 1,
        note: action.note,
        params: cloneParams(scheme.draft),
        lines: breakdown.lines,
        total: breakdown.total,
        confirmedAt: Date.now(),
      }
      return withToast(
        {
          ...state,
          schemes: state.schemes.map((s) =>
            s.id === action.schemeId
              ? { ...s, versions: [...s.versions, version], updatedAt: Date.now() }
              : s,
          ),
        },
        `已确认版本 v${version.no},合计 ${breakdown.total.toLocaleString('zh-CN')} 元`,
      )
    }
    case 'version/restore': {
      const scheme = state.schemes.find((s) => s.id === action.schemeId)
      const version = scheme?.versions.find((v) => v.id === action.versionId)
      if (!scheme || !version) return state
      const history = pushHistory(state, action.schemeId, 'restore')
      return withToast(
        {
          ...state,
          history,
          schemes: state.schemes.map((s) =>
            s.id === action.schemeId
              ? { ...s, draft: cloneParams(version.params), updatedAt: Date.now() }
              : s,
          ),
        },
        `已将 v${version.no} 的参数恢复为当前草稿`,
      )
    }
    case 'version/delete': {
      const scheme = state.schemes.find((s) => s.id === action.schemeId)
      if (!scheme) return state
      const kept = scheme.versions.filter((v) => v.id !== action.versionId)
      return withToast(
        {
          ...state,
          schemes: state.schemes.map((s) =>
            s.id === action.schemeId
              ? {
                  ...s,
                  versions: kept.map((v, i) => ({ ...v, no: i + 1 })),
                  updatedAt: Date.now(),
                }
              : s,
          ),
          compare: state.compare.filter((r) => r.versionId !== action.versionId),
        },
        '已删除该版本',
      )
    }
    case 'compare/toggle': {
      const exists = state.compare.some(
        (r) => r.schemeId === action.ref.schemeId && r.versionId === action.ref.versionId,
      )
      let compare: CompareRef[]
      if (exists) {
        compare = state.compare.filter(
          (r) => !(r.schemeId === action.ref.schemeId && r.versionId === action.ref.versionId),
        )
      } else if (state.compare.length >= 2) {
        compare = [state.compare[1], action.ref]
      } else {
        compare = [...state.compare, action.ref]
      }
      return { ...state, compare }
    }
    case 'compare/clear':
      return { ...state, compare: [] }
    case 'select':
      return { ...state, selection: { ...state.selection, ...action.patch } }
    case 'mobileTab':
      return { ...state, mobileTab: action.tab }
    case 'toast':
      return withToast(state, action.text, action.kind)
    case 'toast/clear':
      return state.toast && state.toast.id === action.id ? { ...state, toast: null } : state
    default:
      return state
  }
}

// ---------- Context ----------

interface Store {
  state: State
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  // 任何状态变化即持久化(草稿+已确认版本+选中态),刷新/重开后恢复
  useEffect(() => {
    const persisted: Persisted = {
      clients: state.clients,
      projects: state.projects,
      schemes: state.schemes,
      selection: state.selection,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      // 存储满等异常不阻断使用
    }
  }, [state.clients, state.projects, state.schemes, state.selection])

  // 全局快捷键:Ctrl/Cmd+Z 撤销,Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做(作用于当前方案)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        // 输入框内交给浏览器原生撤销
        if (!(e.metaKey || e.ctrlKey)) return
      }
      const schemeId = state.selection.schemeId
      if (!schemeId || !(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'draft/undo', schemeId })
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        dispatch({ type: 'draft/redo', schemeId })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selection.schemeId])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ---------- 派生选择器 ----------

export function useEffectiveSelection() {
  const { state } = useStore()
  const client =
    state.clients.find((c) => c.id === state.selection.clientId) ?? state.clients[0] ?? null
  const projectsOfClient = client ? state.projects.filter((p) => p.clientId === client.id) : []
  const project =
    projectsOfClient.find((p) => p.id === state.selection.projectId) ?? projectsOfClient[0] ?? null
  const schemesOfProject = project ? state.schemes.filter((s) => s.projectId === project.id) : []
  const scheme =
    schemesOfProject.find((s) => s.id === state.selection.schemeId) ?? schemesOfProject[0] ?? null
  return { client, project, scheme, projectsOfClient, schemesOfProject }
}

export function findVersion(
  state: State,
  ref: CompareRef,
): { scheme: Scheme; version: Version } | null {
  const scheme = state.schemes.find((s) => s.id === ref.schemeId)
  const version = scheme?.versions.find((v) => v.id === ref.versionId)
  return scheme && version ? { scheme, version } : null
}
