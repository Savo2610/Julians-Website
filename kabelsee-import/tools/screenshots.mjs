// Bilder fuer das README und zum Pruefen: startet den Build ueber
// `vite preview`, oeffnet ihn in Chromium und spult die Welt mit
// window.__kabel.step() in feste Momente vor. So entstehen die Bilder ohne
// laufende Schleife und bei jedem Durchlauf gleich.
//
//   npm run build && npm run shots          # Bilder nach docs/
//
// Braucht Playwright (`npm i -D playwright` oder global installiert).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || 'docs'
const PORT = 4179
mkdirSync(OUT, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((resolve) => {
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) resolve() })
  setTimeout(resolve, 6000)
})

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()) })
page.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1 })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__kabel, null, { timeout: 180000 })
// rAF anhalten, damit nur step() die Welt bewegt.
await page.evaluate(() => { window.requestAnimationFrame = () => 0 })
await page.waitForTimeout(800)

const shot = async (name, render = true) => {
  if (render) await page.evaluate(() => window.__kabel.draw())
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 88, type: 'jpeg' })
  console.log('saved', name)
}

const K = (code) => page.evaluate((c) => window.__kabel.keys(c), code)
const step = (n) => page.evaluate((n) => window.__kabel.step(n, 1 / 60, false), n)
const rider = () => page.evaluate(() => {
  const r = window.__kabel.rider
  return { x: r.x, y: r.y, z: r.z, mode: r.mode, airborne: r.airborne, progress: r.progress, spin: r.spin, flip: r.flip, state: window.__kabel.session.state }
})
// Bis eine Bedingung gilt, in kleinen Schritten vorspulen.
async function until(fn, max = 2000) {
  for (let i = 0; i < max; i++) {
    const r = await rider()
    if (fn(r)) return r
    await step(2)
  }
  throw new Error('Bedingung nie erreicht')
}
// CSS-Uebergaenge laufen in echter Zeit, die Welt steht still.
const settle = () => page.waitForTimeout(700)

await step(30)
await settle()
await shot('01-titel')

// Start am Steg: Enter, auf den Buegel warten, in die Hocke.
await page.evaluate(() => window.__kabel.session.confirm())
await step(150)
await settle()
await shot('02-steg')
await page.evaluate(() => {
  const k = window.__kabel
  return new Promise((res) => {
    // Hocke erst knapp vor dem Straffen: das gibt den perfekten Start.
    for (let i = 0; i < 600 && k.rider.mode === 'dock'; i++) {
      if (k.rider.hooked && k.rider.dockProgress > 0.55) k.keys(['jump'])
      k.step(1, 1 / 60, false)
    }
    res()
  })
})
await K([])
await page.evaluate(() => window.__kabel.release('jump'))
await step(40)
await settle()
await shot('03-start')

// Erster Kicker: einfedern, an der Kante loslassen, in der Luft drehen.
await until((r) => r.x < -2)
await K(['jump'])
await until((r) => r.x < -12.4)
await page.evaluate(() => window.__kabel.release('jump'))
await K(['left'])
await step(2)
await step(18)
await settle()
await shot('04-sprung')
// Kurz vor der vollen Umdrehung loslassen, den Rest macht die Landehilfe.
await until((r) => Math.abs(r.spin) > Math.PI * 2 - 0.65 || !r.airborne)
await K([])
await until((r) => !r.airborne)
await step(30)
await settle()
await shot('05-landung')

// Ausschwingen: gut eine Sekunde nach rechts kanten.
await K(['right'])
await step(70)
await settle()
await shot('06-schwung')
await K([])
await step(40)

// Rail-Box auf der Westgeraden.
await until((r) => r.progress > 162)
await settle()
await shot('07-box')

// Backflip ueber den Kicker auf der Ostgeraden (k4). Die Kante liegt bei
// Bogenlaenge 392, der Steg bei 15 – im Fortschritt des Fahrers also 377.
// k4 liegt 5,5 m innen neben der Rail: vorher hinueberlenken, auf die Mitte
// des Kickers, wie ein Fahrer, der ihn anpeilt.
const aimUntil = (progress, jump = false) => page.evaluate(({ progress, jump }) => {
  const k = window.__kabel
  const f = k.FEATURES.find((x) => x.id === 'k4')
  const r = k.rider
  for (let i = 0; i < 4000 && r.progress <= progress; i++) {
    const v = (r.x - f.x) * -f.dz + (r.z - f.z) * f.dx
    const vv = r.vx * -f.dz + r.vz * f.dx
    k.input.touch.steer = r.airborne || r.feature ? 0 : Math.max(-1, Math.min(1, -v * 0.4 - vv * 0.12))
    k.keys(jump ? ['jump'] : [])
    k.step(1, 1 / 60, false)
  }
  k.input.touch.steer = 0
}, { progress, jump })
await until((r) => r.progress > 320)
await aimUntil(366)
await aimUntil(376.4, true)
await page.evaluate(() => window.__kabel.release('jump'))
await K(['brake'])
await step(2)
await step(24)
await settle()
await shot('08-backflip')
await until((r) => Math.abs(r.flip) > Math.PI * 2 - 0.7 || !r.airborne)
await K([])
await until((r) => !r.airborne)
await step(20)
await settle()
await shot('09-gestanden')

// Ueberblick ueber den ganzen See.
await page.evaluate(() => window.__kabel.overview(235))
await settle()
await shot('10-ueberblick', false)
await page.evaluate(() => window.__kabel.overview(120, 18, -58))
await shot('11-station', false)
await page.evaluate(() => window.__kabel.overview(90, 4, -2))
await shot('12-insel', false)

// Den Rest der Session vorspulen, bis die Auswertung kommt.
await until((r) => r.state === 'results', 6000)
await step(10)
await settle()
await shot('13-auswertung')

await browser.close()
// npx startet vite als Kindprozess; die ganze Gruppe beenden.
process.kill(-server.pid)
process.exit(process.exitCode || 0)
