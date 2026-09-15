import { SchemeParams } from './types'

// ---------- 实时校验:字段错误 + 跨字段冲突 + 警告 ----------

export interface Validation {
  /** 字段级错误(非法输入) */
  fieldErrors: Partial<Record<keyof SchemeParams, string>>
  /** 跨字段/业务规则冲突 */
  conflicts: string[]
  /** 警告(不阻断确认) */
  warnings: string[]
  /** 是否可确认版本(无错误且无冲突) */
  ok: boolean
}

export function validateParams(p: SchemeParams): Validation {
  const fieldErrors: Validation['fieldErrors'] = {}
  const conflicts: string[] = []
  const warnings: string[] = []

  // 拍摄天数
  if (p.shootDays == null || Number.isNaN(p.shootDays)) {
    fieldErrors.shootDays = '请输入拍摄天数'
  } else if (!Number.isInteger(p.shootDays) || p.shootDays < 1) {
    fieldErrors.shootDays = '拍摄天数需为不小于 1 的整数'
  } else if (p.shootDays > 365) {
    fieldErrors.shootDays = '拍摄天数不能超过 365 天'
  }

  // 交付张数
  if (p.deliveredImages == null || Number.isNaN(p.deliveredImages)) {
    fieldErrors.deliveredImages = '请输入交付张数'
  } else if (!Number.isInteger(p.deliveredImages) || p.deliveredImages < 1) {
    fieldErrors.deliveredImages = '交付张数需为不小于 1 的整数'
  } else if (p.deliveredImages > 2000) {
    fieldErrors.deliveredImages = '交付张数不能超过 2000 张'
  }

  // 授权期限
  if (p.durationMonths == null || Number.isNaN(p.durationMonths)) {
    fieldErrors.durationMonths = '请输入授权期限'
  } else if (!Number.isInteger(p.durationMonths) || p.durationMonths < 1) {
    fieldErrors.durationMonths = '授权期限需为不小于 1 的整数月'
  } else if (p.durationMonths > 120) {
    fieldErrors.durationMonths = '授权期限不能超过 120 个月'
  }

  // 折扣
  if (p.discountPct == null || Number.isNaN(p.discountPct)) {
    fieldErrors.discountPct = '请输入折扣'
  } else if (p.discountPct < 0 || p.discountPct > 90) {
    fieldErrors.discountPct = '折扣需在 0–90% 之间'
  }

  // 税率
  if (p.taxRatePct == null || Number.isNaN(p.taxRatePct)) {
    fieldErrors.taxRatePct = '请输入税率'
  } else if (p.taxRatePct < 0 || p.taxRatePct > 30) {
    fieldErrors.taxRatePct = '税率需在 0–30% 之间'
  }

  // 渠道:至少一个;独家买断互斥
  if (p.channels.length === 0) {
    conflicts.push('至少选择一个传播渠道')
  } else if (p.channels.includes('buyout') && p.channels.length > 1) {
    conflicts.push('「独家买断」已包含全部传播渠道,不能与其它按渠道授权同时选择')
  }

  // 警告(不阻断)
  if (p.discountPct != null && p.discountPct > 30 && !fieldErrors.discountPct) {
    warnings.push(`折扣 ${p.discountPct}% 超过 30%,请确认已获授权`)
  }
  if (p.durationMonths != null && p.durationMonths > 36 && !fieldErrors.durationMonths) {
    warnings.push('授权期限超过 3 年,建议拆分续约以保留议价空间')
  }
  if (
    p.shootDays != null && p.deliveredImages != null &&
    p.shootDays >= 1 && p.deliveredImages > p.shootDays * 80
  ) {
    warnings.push('交付张数相对拍摄天数偏高,请确认后期产能')
  }

  const ok = Object.keys(fieldErrors).length === 0 && conflicts.length === 0
  return { fieldErrors, conflicts, warnings, ok }
}
