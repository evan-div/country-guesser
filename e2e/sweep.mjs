// Visits all 195 countries and checks each one is framed inside the free globe area
// (between the HUD and the bottom panel). Screenshots the tricky cases.
//   node e2e/sweep.mjs
import { check, COUNTRIES, failed, launch, OUT, phonePage, startServer, waitPhase } from './lib.mjs'

const SHOTS = new Set(['VAT', 'MCO', 'NRU', 'TUV', 'KIR', 'FJI', 'RUS', 'USA', 'FRA', 'CHL', 'NZL', 'IDN', 'MDV', 'CAN'])
const server = await startServer(5180)
const browser = await launch()
const problems = []

try {
  const { page, errors } = await phonePage(browser)
  // Animations off → instant camera moves, so the sweep is fast and deterministic.
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-rush:save',
      JSON.stringify({ version: 1, settings: { motion: 'reduced', sound: false, haptics: false, quality: 'balanced' } }),
    )
  })
  await page.goto(server.url)
  await page.waitForFunction(() => window.__atlas?.engine, null, { timeout: 60000 })

  for (const c of COUNTRIES) {
    await page.evaluate((code) => window.__atlas.game.start('practice', 'country', [code]), c.code)
    await waitPhase(page, 'GUESSING', 20000)
    await page.waitForTimeout(SHOTS.has(c.code) ? 700 : 120)
    const measure = () =>
      page.evaluate((c) => {
        const hud = document.querySelector('[class*="pt-safe"]')?.getBoundingClientRect()
        const panel = document.querySelector('form')?.closest('.glass-strong')?.getBoundingClientRect()
        const pt = window.__atlas.engine.screenPoint(c.label.lat, c.label.lng)
        const e = window.__atlas.engine
        return {
          debug: { pov: e.director.pov, focus: c.focus, flying: e.director.flying, phase: window.__atlas.phase },
          isTarget: window.__atlas.game.state.round.code === c.code,
          pt,
          hudBottom: hud?.bottom ?? 0,
          panelTop: panel?.top ?? innerHeight,
          w: innerWidth,
        }
      }, c)
    const inside = (r) =>
      r.isTarget && r.pt && r.pt.x > 0 && r.pt.x < r.w && r.pt.y > r.hudBottom - 10 && r.pt.y < r.panelTop + 10
    let r = await measure()
    if (!inside(r)) {
      // Re-measure once so a frame caught mid-update isn't reported as a framing error.
      await page.waitForTimeout(600)
      r = await measure()
    }
    if (!inside(r))
      problems.push(
        `${c.code} ${c.name}: ${JSON.stringify(r.pt)} hud=${Math.round(r.hudBottom)} panel=${Math.round(r.panelTop)} ${JSON.stringify(r.debug)}`,
      )
    if (SHOTS.has(c.code)) await page.screenshot({ path: `${OUT}/sweep-${c.code}.png` })
    await page.evaluate(() => window.__atlas.game.quit())
    await waitPhase(page, 'HOME', 10000)
  }
  check(problems.length === 0, `all ${COUNTRIES.length} countries framed in the visible globe area`)
  for (const p of problems) console.log('    ' + p)
  check(errors.length === 0, `no runtime errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
} finally {
  await browser.close()
  server.stop()
}
process.exit(failed() ? 1 : 0)
