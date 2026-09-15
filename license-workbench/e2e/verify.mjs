// 真实浏览器端到端验证:建立、连续修改、冲突阻断、撤销重做、版本恢复、刷新回读、移动端
// 运行:node e2e/verify.mjs(自动拉起 vite preview,结束后关闭)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

// 容器若无 root 无法 apt 安装 Chromium 系统库时,允许从 /tmp/libs 读取已解压的依赖
const localLibDirs = ['/tmp/libs/usr/lib/aarch64-linux-gnu', '/tmp/libs/lib/aarch64-linux-gnu'].filter(existsSync)
if (localLibDirs.length && !(process.env.LD_LIBRARY_PATH ?? '').includes('/tmp/libs/')) {
  process.env.LD_LIBRARY_PATH = [...localLibDirs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
}
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:4173'
const SHOTS = new URL('./screenshots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })

// ---------- 与 src/pricing.ts 独立的交叉验证实现 ----------
const DAY_RATE = 8000
const IMAGE_RATE = 300
const REGION_RATE = { city: 0, province: 0.3, national: 0.8, global: 1.5 }
const CHANNEL_RATE = { web: 0.1, social: 0.15, print: 0.2, ooh: 0.25, tv: 0.4, packaging: 0.3, buyout: 1.0 }
const r2 = (n) => Math.round(n * 100) / 100
function expectedTotal(p) {
  const creative = r2(DAY_RATE * p.days + IMAGE_RATE * p.images)
  const region = r2(creative * REGION_RATE[p.region])
  const duration = r2(creative * Math.min(1, p.months * 0.02))
  const channel = r2(creative * p.channels.reduce((s, c) => s + CHANNEL_RATE[c], 0))
  const subtotal = r2(creative + region + duration + channel)
  const discount = r2((subtotal * p.discount) / 100)
  const after = r2(subtotal - discount)
  const tax = r2((after * p.tax) / 100)
  return r2(after + tax)
}
const fmt = (n) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ---------- 测试框架 ----------
let passed = 0
const failures = []
function check(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(name)
    console.error(`  ✗ ${name} ${extra}`)
  }
}
async function expectText(page, testid, text, name) {
  const actual = await page.getByTestId(testid).textContent().catch(() => null)
  check(name ?? `${testid} = ${text}`, actual?.trim() === text, `(实际: ${actual})`)
}

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'pipe',
  detached: true,
})
async function waitServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server 未启动')
}

try {
  await waitServer()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => failures.push('页面 JS 异常: ' + e.message))

  // ============ 1. 建立:客户 → 项目 → 方案 → 参数 → 确认 v1 ============
  console.log('\n[1] 建立客户/项目/方案并确认首个版本')
  await page.goto(BASE)
  await check('空状态提示可见', await page.getByTestId('empty-clients').isVisible())

  await page.getByTestId('client-new-btn').click()
  await page.getByTestId('client-add-btn').click()
  await check('客户名为空时行内报错', await page.getByTestId('client-form-error').isVisible())
  await page.getByTestId('client-name-input').fill('林晚照')
  await page.getByTestId('client-company-input').fill('山间织物工作室')
  await page.getByTestId('client-add-btn').click()
  await check('客户出现在列表', await page.getByText('山间织物工作室').first().isVisible())

  await page.getByTestId('project-new-btn').click()
  await page.getByTestId('project-title-input').fill('2026 春季新品画册')
  await page.getByTestId('project-location-input').fill('杭州')
  await page.getByTestId('project-add-btn').click()
  await check('项目出现在列表', await page.getByText('2026 春季新品画册').first().isVisible())

  await page.getByTestId('scheme-add-btn').click()
  await check('方案编辑器出现', await page.getByTestId('scheme-editor').isVisible())

  const P1 = { days: 3, images: 20, region: 'national', months: 12, channels: ['web', 'social'], discount: 10, tax: 6 }
  await page.getByTestId('field-shootDays').fill('3')
  await page.getByTestId('field-deliveredImages').fill('20')
  await page.getByTestId('field-region').selectOption('national')
  await page.getByTestId('field-durationMonths').fill('12')
  await page.getByTestId('channel-web').check()
  await page.getByTestId('channel-social').check()
  await page.getByTestId('field-discountPct').fill('10')
  await page.getByTestId('field-taxRatePct').fill('6')

  const t1 = fmt(expectedTotal(P1))
  await expectText(page, 'breakdown-total', t1, `v1 合计实时计算正确 (${t1})`)
  await check('明细行-拍摄费', (await page.getByTestId('line-shoot').textContent()).includes('24,000.00'))
  await check('明细行-区域加价公式可解释', (await page.getByTestId('line-region').textContent()).includes('80%'))
  await check('明细行-税费', (await page.getByTestId('line-tax').textContent()).includes('3,709.80'))

  await page.getByTestId('version-note-input').fill('初版报价')
  await page.getByTestId('confirm-version-btn').click()
  await check('v1 出现在版本列表', await page.getByTestId('version-item-v1').isVisible())
  await expectText(page, 'version-total-v1', t1, 'v1 快照合计与确认时一致')
  await page.screenshot({ path: SHOTS + '01-created-v1.png' })

  // ============ 2. 连续修改:多次编辑实时重算并确认 v2 ============
  console.log('\n[2] 连续修改参数,明细实时联动')
  await page.getByTestId('field-shootDays').fill('5')
  const P2a = { ...P1, days: 5 }
  await expectText(page, 'breakdown-total', fmt(expectedTotal(P2a)), '天数 3→5 后合计更新')
  await page.getByTestId('field-discountPct').fill('20')
  const P2 = { ...P2a, discount: 20 }
  const t2 = fmt(expectedTotal(P2))
  await expectText(page, 'breakdown-total', t2, `折扣 10→20 后合计更新 (${t2})`)
  await page.getByTestId('confirm-version-btn').click()
  await expectText(page, 'version-total-v2', t2, 'v2 快照合计正确')

  // ============ 3. 冲突阻断:非法输入被拦截,不污染已确认版本 ============
  console.log('\n[3] 冲突与非法输入阻断确认')
  await page.getByTestId('channel-buyout').check()
  await check('买断+单渠道冲突提示', (await page.getByTestId('validation-msgs').textContent()).includes('独家买断'))
  await check('冲突时确认按钮禁用', await page.getByTestId('confirm-version-btn').isDisabled())
  await check('明细区提示无法计算', await page.getByTestId('breakdown-invalid').isVisible())
  await page.getByTestId('channel-web').uncheck()
  await page.getByTestId('channel-social').uncheck()
  await check('仅买断后冲突解除', await page.getByTestId('confirm-version-btn').isEnabled())

  await page.getByTestId('field-discountPct').fill('95')
  await check('折扣 95% 行内报错', (await page.getByTestId('field-discountPct-error').textContent()).includes('0–90'))
  await check('非法折扣时确认禁用', await page.getByTestId('confirm-version-btn').isDisabled())
  await page.getByTestId('field-discountPct').fill('10')
  await check('改回合法值后恢复可确认', await page.getByTestId('confirm-version-btn').isEnabled())
  await check('版本数保持 2(未被污染)', (await page.locator('.version-card').count()) === 2)
  await page.screenshot({ path: SHOTS + '02-conflict-blocked.png' })

  // ============ 4. 撤销 / 重做 ============
  console.log('\n[4] 撤销与重做')
  await page.waitForTimeout(1300) // 避开同字段合并窗口
  await page.getByTestId('field-shootDays').fill('7')
  const P4 = { days: 7, images: 20, region: 'national', months: 12, channels: ['buyout'], discount: 10, tax: 6 }
  await expectText(page, 'breakdown-total', fmt(expectedTotal(P4)), '天数改为 7 后合计更新')
  await page.getByTestId('undo-btn').click()
  await check('撤销后天数回到 5', (await page.getByTestId('field-shootDays').inputValue()) === '5')
  const P4b = { ...P4, days: 5 }
  await expectText(page, 'breakdown-total', fmt(expectedTotal(P4b)), '撤销后合计回退')
  await page.getByTestId('redo-btn').click()
  await check('重做后天数回到 7', (await page.getByTestId('field-shootDays').inputValue()) === '7')
  await page.getByTestId('undo-btn').click()
  await check('再次撤销回到 5', (await page.getByTestId('field-shootDays').inputValue()) === '5')

  // ============ 5. 版本恢复 ============
  console.log('\n[5] 版本恢复')
  await page.getByTestId('restore-v1').click()
  await check('恢复 v1 后天数=3', (await page.getByTestId('field-shootDays').inputValue()) === '3')
  await check('恢复 v1 后渠道回到 web', await page.getByTestId('channel-web').isChecked())
  await expectText(page, 'breakdown-total', t1, '恢复 v1 后合计与 v1 一致')

  // ============ 6. 复制方案 ============
  console.log('\n[6] 复制方案')
  await page.locator('.scheme-tab').first().getByTitle('复制此方案(参数生成新草稿)').click()
  await check('复制后出现两个方案', (await page.locator('.scheme-tab').count()) === 2)
  await check('副本命名正确', await page.locator('.scheme-tab', { hasText: '副本' }).isVisible())
  await check('副本草稿参数一致(天数=3)', (await page.getByTestId('field-shootDays').inputValue()) === '3')
  await page.locator('.scheme-tab').first().locator('.scheme-tab-main').click()

  // ============ 7. 版本比较 ============
  console.log('\n[7] 版本比较')
  await page.getByTestId('compare-toggle-v1').click()
  await page.getByTestId('compare-toggle-v2').click()
  await check('比较视图打开', await page.getByTestId('compare-view').isVisible())
  const cmpText = await page.getByTestId('compare-table').textContent()
  await check('比较表含 v1 合计', cmpText.includes(t1))
  await check('比较表含 v2 合计', cmpText.includes(t2))
  await check('差异行高亮', (await page.locator('.compare-table tr.diff').count()) > 0)
  await page.screenshot({ path: SHOTS + '03-compare.png' })
  await page.getByTestId('compare-close').click()

  // ============ 8. 刷新回读:本地持久化 ============
  console.log('\n[8] 刷新后数据保持')
  await page.reload()
  await check('刷新后客户仍在', await page.getByText('山间织物工作室').first().isVisible())
  await check('刷新后项目仍在', await page.getByText('2026 春季新品画册').first().isVisible())
  await check('刷新后两个方案仍在', (await page.locator('.scheme-tab').count()) === 2)
  await expectText(page, 'version-total-v1', t1, '刷新后 v1 合计不变')
  await expectText(page, 'version-total-v2', t2, '刷新后 v2 合计不变')
  await check('刷新后草稿天数保持 3', (await page.getByTestId('field-shootDays').inputValue()) === '3')

  // ============ 9. 非法输入不污染已确认版本(跨刷新) ============
  console.log('\n[9] 非法输入不污染已确认版本')
  await page.getByTestId('field-shootDays').fill('')
  await check('清空天数行内报错', await page.getByTestId('field-shootDays-error').isVisible())
  await check('确认被阻断', await page.getByTestId('confirm-version-btn').isDisabled())
  await page.reload()
  await expectText(page, 'version-total-v1', t1, '刷新后 v1 仍未被污染')
  await expectText(page, 'version-total-v2', t2, '刷新后 v2 仍未被污染')
  await check('版本数仍为 2', (await page.locator('.version-card').count()) === 2)
  await page.screenshot({ path: SHOTS + '04-invalid-not-persisted.png' })

  // ============ 10. 移动端核心流程 ============
  console.log('\n[10] 移动端视口核心流程')
  await page.setViewportSize({ width: 390, height: 844 })
  await check('移动端底部导航出现', await page.getByTestId('nav-schemes').isVisible())
  await page.getByTestId('nav-schemes').click()
  await page.getByTestId('field-shootDays').fill('4')
  await page.getByTestId('nav-detail').click()
  const P10 = { days: 4, images: 20, region: 'national', months: 12, channels: ['web', 'social'], discount: 10, tax: 6 }
  await expectText(page, 'breakdown-total', fmt(expectedTotal(P10)), '移动端修改后合计正确')
  await check('移动端版本列表可滚动查看', await page.getByTestId('version-item-v1').isVisible())
  await page.screenshot({ path: SHOTS + '05-mobile.png', fullPage: false })

  await browser.close()
} catch (e) {
  failures.push('执行异常: ' + (e?.message ?? e))
  console.error(e)
} finally {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill()
  }
}

console.log(`\n结果: ${passed} 项通过, ${failures.length} 项失败`)
if (failures.length) {
  failures.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}
console.log('全部浏览器验证通过 ✓')
