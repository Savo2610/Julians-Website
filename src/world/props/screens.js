import * as THREE from 'three'
import { TOUCH } from '../../core/device.js'

// Bildschirme fuer die Stationen mit Auswahl: Skikasse, Werkstatt und der
// Kontaktposten.
//
// Jeder Bildschirm ist eine Canvas-Zeichnung auf einer unbeleuchteten
// Flaeche – er leuchtet also selbst und braucht kein Licht. Gewaehlt,
// abgeblendet oder im Leerlauf ist nur eine Frage der Materialfarbe, mit
// der die Zeichnung multipliziert wird; dafuer muss nichts neu gezeichnet
// werden.

const FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif'

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function finish(c) {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Kontaktlos-Zeichen: drei Boegen.
function waves(ctx, x, y, s, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(x, y, s * (0.35 + i * 0.3), -0.7, 0.7)
    ctx.stroke()
  }
}

export function paypalScreen() {
  const [c, ctx] = canvas(512, 384)
  const g = ctx.createLinearGradient(0, 0, 512, 384)
  g.addColorStop(0, '#0b3c9c')
  g.addColorStop(1, '#1d8cf0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 384)
  // Das P als Buchstabe, zweimal leicht versetzt wie im Zeichen.
  ctx.font = `italic 900 170px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('P', 60, 150)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('P', 44, 138)
  ctx.font = `800 76px ${FONT}`
  ctx.fillText('PayPal', 180, 150)
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fillText('Trinkgeld geben', 46, 290)
  waves(ctx, 440, 290, 44, 'rgba(255,255,255,0.85)')
  return finish(c)
}

export function solanaScreen() {
  const [c, ctx] = canvas(512, 384)
  ctx.fillStyle = '#0e0b1d'
  ctx.fillRect(0, 0, 512, 384)
  const glow = ctx.createRadialGradient(120, 110, 10, 120, 110, 380)
  glow.addColorStop(0, 'rgba(153,69,255,0.55)')
  glow.addColorStop(1, 'rgba(20,241,149,0.08)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 512, 384)
  // Drei schraege Balken im Verlauf von Violett nach Gruen.
  const bars = ctx.createLinearGradient(40, 180, 170, 60)
  bars.addColorStop(0, '#9945ff')
  bars.addColorStop(1, '#14f195')
  ctx.fillStyle = bars
  for (let i = 0; i < 3; i++) {
    const y = 72 + i * 50
    const flip = i === 1
    ctx.beginPath()
    ctx.moveTo(flip ? 46 : 70, y)
    ctx.lineTo(flip ? 166 : 190, y)
    ctx.lineTo(flip ? 190 : 166, y + 34)
    ctx.lineTo(flip ? 70 : 46, y + 34)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.font = `800 70px ${FONT}`
  ctx.fillText('Solana', 214, 138)
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = 'rgba(210,255,236,0.85)'
  ctx.fillText(TOUCH ? 'Wallet öffnen' : 'Wallet verbinden', 46, 290)
  ctx.fillStyle = '#14f195'
  ctx.beginPath()
  ctx.arc(452, 290, 14, 0, Math.PI * 2)
  ctx.fill()
  return finish(c)
}

export function githubScreen() {
  const [c, ctx] = canvas(512, 384)
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, 512, 384)
  // Fensterleiste mit den drei Punkten.
  ctx.fillStyle = '#161b22'
  ctx.fillRect(0, 0, 512, 46)
  for (const [i, col] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(30 + i * 28, 23, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  // Ein paar Zeilen Code als farbige Balken – lesen muss man sie nicht.
  const rows = [
    [['#ff7b72', 70], ['#d2a8ff', 120], ['#c9d1d9', 60]],
    [['#79c0ff', 90], ['#c9d1d9', 150]],
    [['#c9d1d9', 40], ['#a5d6ff', 170]],
    [['#ff7b72', 60], ['#7ee787', 110]],
  ]
  rows.forEach((row, r) => {
    let x = 34 + (r % 3 === 2 ? 34 : 0)
    for (const [col, w] of row) {
      ctx.fillStyle = col
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.roundRect(x, 72 + r * 34, w, 16, 8)
      ctx.fill()
      x += w + 14
    }
  })
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.font = `800 64px ${FONT}`
  ctx.fillText('</> GitHub', 34, 250)
  ctx.font = `600 32px ${FONT}`
  ctx.fillStyle = '#8b949e'
  ctx.fillText('Savo2610', 36, 320)
  return finish(c)
}

export function linkedinScreen() {
  const [c, ctx] = canvas(512, 384)
  ctx.fillStyle = '#f3f2ef'
  ctx.fillRect(0, 0, 512, 384)
  const band = ctx.createLinearGradient(0, 0, 512, 0)
  band.addColorStop(0, '#0a66c2')
  band.addColorStop(1, '#3d8fe0')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, 512, 110)
  // Bild im Kreis: Kopf und Schultern.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(104, 124, 62, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9fb8d0'
  ctx.beginPath()
  ctx.arc(104, 112, 24, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(104, 162, 38, 22, 0, Math.PI, 0)
  ctx.fill()
  // "in" als Plakette oben rechts.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(410, 24, 70, 62, 12)
  ctx.fill()
  ctx.fillStyle = '#0a66c2'
  ctx.textBaseline = 'middle'
  ctx.font = `900 50px ${FONT}`
  ctx.fillText('in', 424, 57)
  ctx.fillStyle = '#1d2226'
  ctx.font = `800 44px ${FONT}`
  ctx.fillText('Julian Veerkamp', 40, 232)
  ctx.fillStyle = '#56687a'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText('Profil & Lebenslauf', 40, 280)
  ctx.fillStyle = '#0a66c2'
  ctx.beginPath()
  ctx.roundRect(40, 314, 170, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 26px ${FONT}`
  ctx.fillText('Vernetzen', 64, 337)
  return finish(c)
}

// Signal: die Sprechblase mit dem gestrichelten Rand auf Blau.
export function signalScreen() {
  const [c, ctx] = canvas(512, 384)
  const g = ctx.createLinearGradient(0, 0, 512, 384)
  g.addColorStop(0, '#2c5fd6')
  g.addColorStop(1, '#4f8bff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 384)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 12
  ctx.setLineDash([22, 12])
  ctx.beginPath()
  ctx.arc(118, 136, 70, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(118, 136, 50, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(62, 186)
  ctx.lineTo(50, 222)
  ctx.lineTo(92, 206)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.font = `800 76px ${FONT}`
  ctx.fillText('Signal', 214, 138)
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('Nachricht schreiben', 46, 296)
  return finish(c)
}

// Instagram: der Verlauf von Gelb ueber Pink nach Violett und die Kamera
// als abgerundetes Quadrat mit Linse.
export function instagramScreen() {
  const [c, ctx] = canvas(512, 384)
  const g = ctx.createLinearGradient(0, 384, 512, 0)
  g.addColorStop(0, '#f9ce34')
  g.addColorStop(0.45, '#ee2a7b')
  g.addColorStop(1, '#6228d7')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 384)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 13
  ctx.beginPath()
  ctx.roundRect(56, 74, 124, 124, 36)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(118, 136, 30, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(152, 102, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.font = `800 64px ${FONT}`
  ctx.fillText('Instagram', 206, 138)
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('@juliansebv', 46, 296)
  return finish(c)
}

// Eine leuchtende Flaeche mit Auswahlzustand. `lit` wandert weich zum Ziel:
// 1 = gewaehlt, 0.8 = Leerlauf, 0.38 = der andere ist gewaehlt.
export function createScreen(texture, width, height) {
  const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  mat.color.setScalar(0.8)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
  mesh.userData.lit = 0.8
  mesh.userData.want = 0.8
  mesh.userData.flash = 0
  mesh.userData.step = (dt) => {
    const u = mesh.userData
    u.lit += (u.want - u.lit) * (1 - Math.exp(-9 * dt))
    u.flash = Math.max(0, u.flash - dt * 2.4)
    mat.color.setScalar(Math.min(1.6, u.lit + u.flash * 0.9))
  }
  return mesh
}

// Weicher Schein hinter einem Bildschirm. Eine additive Scheibe statt eines
// Lichts: ein zusaetzliches PointLight kostet in jedem beleuchteten Material
// einen Shaderdurchlauf, die Scheibe einen einzigen Draw Call.
export function createHalo(color, size) {
  const [c, ctx] = canvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const mat = new THREE.MeshBasicMaterial({
    map: finish(c),
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
  mesh.renderOrder = 2
  return mesh
}
