// Shared helpers for the headless browser checks (dev server + Chromium with SwiftShader WebGL).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const OUT = join(ROOT, 'e2e', 'output')
mkdirSync(OUT, { recursive: true })

export const COUNTRIES = JSON.parse(readFileSync(join(ROOT, 'src/data/generated/countries.json'), 'utf8'))
export const nameOf = (code) => COUNTRIES.find((c) => c.code === code).name

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)

export async function startServer(port = 5179) {
  const proc = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return { url, stop: () => proc.kill() }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  proc.kill()
  throw new Error('Dev server did not start')
}

export async function launch() {
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
  return chromium.launch({
    executablePath,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
}

export async function phonePage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...opts,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return { ctx, page, errors }
}

export const waitPhase = (page, phase, timeout = 40000) =>
  page.waitForFunction((p) => window.__atlas?.phase === p, phase, { timeout })

export const target = (page) => page.evaluate(() => window.__atlas.game.state.round.code)

export async function answer(page, text) {
  const input = page.locator('input[name^=atlas-answer]')
  await input.fill(text)
  await page.getByRole('button', { name: 'Submit answer' }).click()
}

let failures = 0
export function check(cond, message) {
  if (cond) console.log(`  ✓ ${message}`)
  else {
    failures++
    console.log(`  ✗ ${message}`)
  }
}
export const failed = () => failures
