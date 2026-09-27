// Rendert den Skifahrer aus dem Spiel freigestellt als 512er PNG fuer die
// Homescreen-Symbole (public/apple-touch-icon.png, icon-192/512.png).
// Holt die Figur ueber window.__ski von der laufenden Seite, damit das
// Symbol genau so aussieht wie im Tal – auch nach neuen Ski oder Farben.
//
//   node tools/skifahrer-icon.mjs icon.png [https://veerka.mp/]
//   sips -z 180 180 icon.png --out public/apple-touch-icon.png   (usw.)
//
// Braucht Google Chrome; gerendert wird per SwiftShader ohne Fenster.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
const out = process.argv[2]
const seite = process.argv[3] ?? 'https://veerka.mp/'
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'skifahrer-'))}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,800', '--remote-debugging-port=9335', 'about:blank'], { stdio: 'ignore' })
const warte = (ms) => new Promise((r) => setTimeout(r, ms))
try {
  let ziel
  for (let i = 0; i < 40 && !ziel; i++) { await warte(250); try { ziel = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page') } catch {} }
  const ws = new WebSocket(ziel.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const offen = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id) } })
  const rufe = (method, params = {}) => new Promise((r) => { offen.set(++id, r); ws.send(JSON.stringify({ id, method, params })) })
  await rufe('Page.navigate', { url: seite })
  await warte(9000)
  const expr = `(() => {
    const S = window.__ski
    window.requestAnimationFrame = () => 0
    const fig = S.skier.group.clone(true)
    fig.position.set(0, 0, 0); fig.rotation.set(0, 1.15, 0)
    const scene = new S.scene.constructor()
    S.scene.traverse((o) => { if (o.isLight && !o.isPointLight) { const l = o.clone(); if (l.isDirectionalLight) { l.position.set(4, 8, 6); l.target.position.set(0, 0.8, 0); scene.add(l.target) } scene.add(l) } })
    scene.add(fig)
    let farbe; fig.traverse((o) => { if (!farbe && o.material?.color) farbe = o.material.color })
    scene.background = new farbe.constructor('#dceaf7')
    const cam = new S.camera.constructor(24, 1, 0.05, 50)
    cam.position.set(2.5, 3.6, 4.5); cam.lookAt(0, 0.5, 0)
    const r = S.renderer
    r.setPixelRatio(1); r.setSize(512, 512, false); r.shadowMap.enabled = false
    r.render(scene, cam)
    return r.domElement.toDataURL('image/png')
  })()`
  const res = await rufe('Runtime.evaluate', { expression: expr, returnByValue: true })
  const url = res.result?.result?.value
  if (!url) { console.log(JSON.stringify(res).slice(0, 500)); process.exit(1) }
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
  console.log('ok', out)
  ws.close()
} finally { chrome.kill() }
