import {
  BreakdownLine,
  Channel,
  CHANNEL_LABEL,
  Region,
  REGION_LABEL,
  SchemeParams,
} from './types'

// ---------- 计价常量(单一事实来源,UI 与测试共用) ----------
export const DAY_RATE = 8000 // 拍摄费 元/天
export const IMAGE_RATE = 300 // 精修交付 元/张

/** 授权区域加价率(相对创作费小计) */
export const REGION_RATE: Record<Region, number> = {
  city: 0,
  province: 0.3,
  national: 0.8,
  global: 1.5,
}

/** 授权期限加价率:每月 2%,封顶 100% */
export function durationRate(months: number): number {
  return Math.min(1, months * 0.02)
}

/** 传播渠道加价率;独家买断为 100% 且互斥 */
export const CHANNEL_RATE: Record<Channel, number> = {
  web: 0.1,
  social: 0.15,
  print: 0.2,
  ooh: 0.25,
  tv: 0.4,
  packaging: 0.3,
  buyout: 1.0,
}

export function channelRateSum(channels: Channel[]): number {
  return channels.reduce((s, c) => s + CHANNEL_RATE[c], 0)
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function fmtMoney(n: number): string {
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface Breakdown {
  lines: BreakdownLine[]
  total: number
}

/**
 * 由方案参数计算可解释费用明细。
 * 调用方需先通过 validateParams 确认参数合法;此处对非法值做防御性返回 null。
 */
export function computeBreakdown(p: SchemeParams): Breakdown | null {
  if (
    p.shootDays == null || p.shootDays < 1 ||
    p.deliveredImages == null || p.deliveredImages < 1 ||
    p.durationMonths == null || p.durationMonths < 1 ||
    p.discountPct == null || p.discountPct < 0 || p.discountPct > 100 ||
    p.taxRatePct == null || p.taxRatePct < 0 ||
    p.channels.length === 0
  ) {
    return null
  }

  const shootFee = r2(DAY_RATE * p.shootDays)
  const imageFee = r2(IMAGE_RATE * p.deliveredImages)
  const creativeSubtotal = r2(shootFee + imageFee)

  const regionPct = REGION_RATE[p.region]
  const regionFee = r2(creativeSubtotal * regionPct)

  const durPct = durationRate(p.durationMonths)
  const durationFee = r2(creativeSubtotal * durPct)

  const chanPct = channelRateSum(p.channels)
  const channelFee = r2(creativeSubtotal * chanPct)
  const channelFormula =
    `小计 × ${pct(chanPct)}(` +
    p.channels.map((c) => `${CHANNEL_LABEL[c]} ${pct(CHANNEL_RATE[c])}`).join(' + ') +
    ')'

  const subtotal = r2(creativeSubtotal + regionFee + durationFee + channelFee)
  const discountAmt = r2(subtotal * (p.discountPct / 100))
  const afterDiscount = r2(subtotal - discountAmt)
  const taxAmt = r2(afterDiscount * (p.taxRatePct / 100))
  const total = r2(afterDiscount + taxAmt)

  const lines: BreakdownLine[] = [
    { key: 'shoot', label: '拍摄费', formula: `${fmtMoney(DAY_RATE)} × ${p.shootDays} 天`, amount: shootFee, kind: 'item' },
    { key: 'image', label: '精修交付费', formula: `${fmtMoney(IMAGE_RATE)} × ${p.deliveredImages} 张`, amount: imageFee, kind: 'item' },
    { key: 'creative', label: '创作费小计', formula: '拍摄费 + 精修交付费', amount: creativeSubtotal, kind: 'subtotal' },
    { key: 'region', label: '授权区域加价', formula: `小计 × ${pct(regionPct)}(${REGION_LABEL[p.region]})`, amount: regionFee, kind: 'item' },
    { key: 'duration', label: '授权期限加价', formula: `小计 × ${pct(durPct)}(每月 2% × ${p.durationMonths} 个月)`, amount: durationFee, kind: 'item' },
    { key: 'channel', label: '传播渠道加价', formula: channelFormula, amount: channelFee, kind: 'item' },
    { key: 'subtotal', label: '费用小计', formula: '创作费小计 + 区域 + 期限 + 渠道', amount: subtotal, kind: 'subtotal' },
    { key: 'discount', label: '折扣', formula: `− 小计 × ${p.discountPct}%`, amount: -discountAmt, kind: 'discount' },
    { key: 'after', label: '折后金额', formula: '费用小计 − 折扣', amount: afterDiscount, kind: 'subtotal' },
    { key: 'tax', label: '税费', formula: `折后 × ${p.taxRatePct}%`, amount: taxAmt, kind: 'tax' },
    { key: 'total', label: '含税合计', formula: '折后金额 + 税费', amount: total, kind: 'total' },
  ]
  return { lines, total }
}

function pct(x: number): string {
  return (x * 100).toFixed(x * 100 % 1 === 0 ? 0 : 1) + '%'
}
