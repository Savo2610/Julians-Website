// Kurzes Video fuer das README: Start am Steg, 360 ueber den ersten Kicker,
// Ausschwingen mit Gischt. Die Welt wird Bild fuer Bild mit
// window.__kabel.step() weitergerechnet und jedes Bild als JPEG an ffmpeg
// gereicht – so laeuft das Video fluessig, egal wie langsam der Rechner
// zeichnet.
//
//   npm run build && npm run video          # docs/kabelsee.webm
//
// Braucht Playwright und ein ffmpeg mit VP8 (FFMPEG=/pfad/zu/ffmpeg).
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, rmSync } from 'node:fs'
import { chromium } from 'playwright'

const OUT = process.env.OUT || 'docs/kabelsee.webm'
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const FPS = 30
const PORT = 4180
const W = 1280
const H = 720

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((resolve) => {
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) resolve() })
  setTimeout(resolve, 6000)
})
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('pageerror', (e) => { console.log('pageerror:', e.message); process.exitCode = 1 })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__kabel, null, { timeout: 180000 })
await page.evaluate(() => { window.requestAnimationFrame = () => 0 })

// Die Bilder landen hintereinander in einer Datei (ein MJPEG-Strom). Ueber
// eine Pipe waere es eleganter, aber das ffmpeg von Playwright kennt keine.
const RAW = `${OUT}.mjpeg`
const raw = createWriteStream(RAW)

// Der Fahrplan laeuft in der Seite: je Bild eine Eingabe, dann ein Schritt.
await page.evaluate(() => {
  const k = window.__kabel
  const r = k.rider
  const TAU = Math.PI * 2
  let phase = 'dock'
  let t = 0
  k.session.confirm()
  window.__plan = () => {
    t += 1 / 30
    if (phase === 'dock') {
      if (r.mode !== 'dock') phase = 'ride'
      k.keys(r.hooked && r.dockProgress > 0.55 ? ['jump'] : [])
    }
    if (phase === 'ride') {
      if (r.x < -2) phase = 'charge'
      else k.keys([])
    }
    if (phase === 'charge') {
      k.keys(['jump'])
      if (r.x <= -12.4) {
        k.release('jump')
        k.keys(['left'])
        phase = 'spin'
      }
    }
    if (phase === 'spin') {
      if (Math.abs(r.spin) > TAU - 0.65 || !r.airborne) k.keys([])
      if (!r.airborne && Math.abs(r.spin) < 0.01) { phase = 'glide'; t = 0 }
    }
    if (phase === 'glide' && t > 0.8) { phase = 'right'; t = 0 }
    if (phase === 'right') { k.keys(['right']); if (t > 1.3) { phase = 'left'; t = 0 } }
    if (phase === 'left') { k.keys(['left']); if (t > 1.1) { phase = 'out'; t = 0 } }
    if (phase === 'out') k.keys([])
    k.step(1, 1 / 30, true)
    return phase
  }
})

// Titel kurz stehen lassen, dann los.
let frames = 0
const total = FPS * 15
for (let i = 0; i < total; i++) {
  const phase = await page.evaluate(() => window.__plan())
  const jpg = await page.screenshot({ type: 'jpeg', quality: 90 })
  raw.write(jpg)
  frames++
  if (frames % 60 === 0) console.log('frame', frames, phase)
  if (phase === 'out' && i > total - 1) break
}
await new Promise((r) => raw.end(r))
const enc = spawnSync(FFMPEG, [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', RAW,
  '-c:v', 'libvpx', '-b:v', '3M', '-crf', '10', '-deadline', 'good', '-auto-alt-ref', '0', OUT,
], { stdio: 'inherit' })
rmSync(RAW)
if (enc.status !== 0) process.exitCode = 1
console.log('frames', frames, '->', OUT)
await browser.close()
try { process.kill(-server.pid) } catch { server.kill() }
process.exit(process.exitCode || 0)
