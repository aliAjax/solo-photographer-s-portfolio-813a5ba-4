// ---------- 领域模型 ----------

export type Region = 'city' | 'province' | 'national' | 'global'

export type Channel =
  | 'web'
  | 'social'
  | 'print'
  | 'ooh'
  | 'tv'
  | 'packaging'
  | 'buyout'

/** 方案参数。数值字段允许为 null,表示用户清空/尚未输入的非法中间态。 */
export interface SchemeParams {
  shootDays: number | null
  deliveredImages: number | null
  region: Region
  durationMonths: number | null
  channels: Channel[]
  discountPct: number | null
  taxRatePct: number | null
}

export interface Client {
  id: string
  name: string
  company: string
  contact: string
  createdAt: number
}

export interface Project {
  id: string
  clientId: string
  title: string
  location: string
  shootDate: string // YYYY-MM-DD,可空
  notes: string
  createdAt: number
}

export interface BreakdownLine {
  key: string
  label: string
  formula: string
  amount: number
  kind: 'item' | 'subtotal' | 'discount' | 'tax' | 'total'
}

export interface Version {
  id: string
  no: number
  note: string
  params: SchemeParams
  lines: BreakdownLine[]
  total: number
  confirmedAt: number
}

export interface Scheme {
  id: string
  projectId: string
  name: string
  draft: SchemeParams
  versions: Version[]
  createdAt: number
  updatedAt: number
}

export const REGION_LABEL: Record<Region, string> = {
  city: '单一城市',
  province: '省级区域',
  national: '全国',
  global: '全球',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: '官网/网页',
  social: '社交媒体',
  print: '平面印刷',
  ooh: '户外广告',
  tv: '电视/视频',
  packaging: '产品包装',
  buyout: '独家买断',
}

export const ALL_CHANNELS = Object.keys(CHANNEL_LABEL) as Channel[]
export const ALL_REGIONS = Object.keys(REGION_LABEL) as Region[]

export function defaultParams(): SchemeParams {
  return {
    shootDays: 1,
    deliveredImages: 10,
    region: 'national',
    durationMonths: 12,
    channels: ['web'],
    discountPct: 0,
    taxRatePct: 6,
  }
}

export function cloneParams(p: SchemeParams): SchemeParams {
  return { ...p, channels: [...p.channels] }
}

export function paramsEqual(a: SchemeParams, b: SchemeParams): boolean {
  return (
    a.shootDays === b.shootDays &&
    a.deliveredImages === b.deliveredImages &&
    a.region === b.region &&
    a.durationMonths === b.durationMonths &&
    a.discountPct === b.discountPct &&
    a.taxRatePct === b.taxRatePct &&
    a.channels.length === b.channels.length &&
    a.channels.every((c) => b.channels.includes(c))
  )
}
