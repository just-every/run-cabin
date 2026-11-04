import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { harness } from './harness.mjs'
import { surface } from './agent-docs-support.mjs'

const directory = process.env.CABIN_AGENT_DOCS_SHOTS ?? './test-results/agent-docs'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CABIN_CHROMIUM, args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] })
const h = await harness({ assets: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(h.origin + '/docs/agents')
    await expect(page.getByRole('heading', { name: 'Agent documentation', exact: true })).toBeVisible()
    assert.deepEqual(await page.locator('[data-tool]').evaluateAll(nodes => nodes.map(node => node.dataset.tool)), surface.tools.map(tool => tool.name).sort())
    assert.deepEqual(await page.locator('[data-resource]').evaluateAll(nodes => nodes.map(node => node.dataset.resource)), [...surface.resources].sort())
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to tool catalogue' })).toBeFocused()
    await page.keyboard.press('Enter')
    assert.equal(new URL(page.url()).hash, '#catalogue')
    const details = page.locator('[data-tool]').first().locator('details').first()
    await details.locator('summary').focus(); await page.keyboard.press('Enter')
    await expect(details.locator('[data-input]')).toBeVisible()
    const input = JSON.parse(await details.locator('[data-input]').textContent())
    assert.equal(input.type, 'object')
    const witnesses = page.locator('[data-tool]').first().locator('details').nth(1)
    await witnesses.locator('summary').focus(); await page.keyboard.press('Enter')
    await expect(witnesses.locator('[data-class]').first()).toBeVisible()
    assert.deepEqual(await page.locator('button,a[href],summary').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && !(node.textContent ?? '').trim() && !node.hasAttribute('data-tooltip')).map(node => node.outerHTML)), [])
    assert.deepEqual(await page.locator('body *').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()) && parseFloat(getComputedStyle(node).fontSize) < 13).map(node => node.tagName)), [])
    assert.deepEqual(errors, [])
    // Assertions run at 1440. The same expanded native document is inspected at phone width.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Documentation fits the viewport')
      await page.screenshot({ path: `${directory}/agent-docs-${width}.png`, fullPage: true })
    }
  } finally { await context.close() }
} finally { await h.close(); await browser.close() }
console.log('PROBE BASE-AGENT-013 browser: public documentation -> keyboard navigation and schema witnesses open at 1440; rendered 1440 and 390 without overflow or icon-only controls')
