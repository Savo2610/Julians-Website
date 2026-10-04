import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'
import { terrainHeight, schanzeLage, klammFlug, klammAt, SCHANZE } from '../heightfield.js'

// Die Weitenmessung an der Klammschanze.
//
// Gemessen wird wie beim Skispringen: von der Kante bis dorthin, wo die Ski
// wieder aufsetzen, laengs der Schanze. Die Zahl steht oben als Frosttext wie
// die Zeitnahme am Slalom und bleibt auf der Tafel unten am Landehuegel
// stehen, zusammen mit der eigenen Bestweite.
//
// Eine Bestenliste gibt es (noch) nicht: die Weite haengt allein am Browser,
// und ohne Server waere jede Zahl in der Konsole zu setzen. Erst wenn sich
// zeigt, dass man hier wirklich um Meter faehrt, lohnt der Umweg ueber den
// Worker wie beim Slalom.

const STORE = 'skiportfolio.klammsprung'
const POST = 0x5d666f
const BOARD = 0x1b222b
const FRAME = 0xd8dee6

function ladeBest() {
  try {
    const n = Number(JSON.parse(localStorage.getItem(STORE))?.best)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function speichereBest(best) {
  try { localStorage.setItem(STORE, JSON.stringify({ best })) } catch { /* egal */ }
}

const meter = (w) => `${w.toFixed(1).replace('.', ',')} m`

// Was man beim Anfahren beeinflusst, steht unter der Weite: wie der Absprung
// war und wie schnell man an der Kante war. Ohne das sah man nur eine Zahl
// und wusste nicht, was beim naechsten Mal anders zu machen ist.
const ABSPRUNG = {
  perfekt: 'Absprung perfekt',
  frueh: 'Absprung zu früh',
  spaet: 'Absprung zu spät',
  ohne: 'Ohne Absprung',
}
const kmh = (v) => `${Math.round(v * 3.6)} km/h`
function wertung(absprung) {
  if (!absprung) return ''
  return `${ABSPRUNG[absprung.art]} · ${kmh(absprung.tempo)}`
}

export class KlammSprung {
  constructor(world) {
    this.world = world
    this.best = ladeBest()
    this.letzte = null
    this.flug = null
    this._hold = 0
    this._buildHud()
    this._buildTafel()
    this._draw()
  }

  _buildHud() {
    // Dieselbe Anzeige wie die Zeitnahme: beide stehen oben in der Mitte, und
    // man ist nie an beiden zugleich.
    const el = document.createElement('div')
    el.className = 'frost race-hud'
    el.innerHTML = '<div class="race-time"></div><div class="race-note"></div>'
    document.body.appendChild(el)
    this.hud = el
    this.weiteEl = el.querySelector('.race-time')
    this.noteEl = el.querySelector('.race-note')
  }

  // Die Tafel steht rechts neben dem Landehuegel am Pistenrand. Erst stand
  // sie an seinem Fuss in der Mitte: lesbar, aber genau dort, wo man nach
  // der Landung hinfaehrt, und man fuhr dagegen.
  _buildTafel() {
    const u = SCHANZE.drueben + SCHANZE.landung - 6
    const v = -(SCHANZE.halb + 5)
    const x = SCHANZE.x + SCHANZE.dx * u - SCHANZE.dz * v
    const z = SCHANZE.z + SCHANZE.dz * u + SCHANZE.dx * v
    const parts = []
    for (const sx of [-1, 1]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), color: POST, position: [sx * 1.05, 0.95, 0] })
    }
    parts.push({ geo: new THREE.BoxGeometry(2.6, 1.32, 0.14), color: FRAME, position: [0, 2.0, 0], rotation: [-0.42, 0, 0] })
    parts.push({ geo: new THREE.BoxGeometry(2.38, 1.12, 0.06), color: BOARD, position: [0, 2.02, 0.09], rotation: [-0.42, 0, 0] })
    const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.6 }))
    mesh.castShadow = true

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    this.canvas = canvas
    this.tex = tex
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.06),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plate.position.set(0, 2.03, 0.125)
    plate.rotation.x = -0.42

    const group = new THREE.Group()
    group.add(mesh, plate)
    group.position.set(x, terrainHeight(x, z), z)
    group.rotation.y = CAMERA.azimuth
    this.world.scene.add(group)
    this.world.addCollider(x, z, 0.6)
  }

  _draw() {
    const ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 256)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#5c6b7d'
    ctx.font = '700 34px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText('KLAMMSPRUNG', 256, 46)
    const w = this.letzte
    ctx.fillStyle = w !== null && w >= this.best ? '#8ef0b4' : '#f2f7ff'
    ctx.font = '800 112px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText(w === null ? '--' : w.toFixed(1).replace('.', ','), 220, 164)
    ctx.fillStyle = '#7f8fa2'
    ctx.font = '700 44px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText('m', 400, 164)
    ctx.fillStyle = '#6d7c8e'
    ctx.font = `600 ${this.best > 0 ? 30 : 25}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    // Solange noch niemand gesprungen ist, steht hier, worauf es ankommt.
    if (this.best > 0) ctx.fillText(`BESTE ${this.best.toFixed(1).replace('.', ',')}`, 256, 222)
    else ctx.fillText('AN DER ROTEN KANTE ABSPRINGEN', 256, 222)
    this.tex.needsUpdate = true
  }

  _zeige(text, note, tone) {
    this.weiteEl.textContent = text
    this.noteEl.textContent = note
    this.hud.dataset.tone = tone || ''
    this.hud.classList.add('visible')
    this._hold = 3.2
  }

  update(dt, skier) {
    if (this._hold > 0) {
      this._hold -= dt
      if (this._hold <= 0) this.hud.classList.remove('visible')
    }
    const { x, z } = skier.position

    if (!this.flug) {
      // Gemessen wird nur, was an der Kante der Klammschanze abhebt. Erst
      // fragte das freiFlug() – und das sagt auch im Funpark ja, also stand
      // nach jedem Kicker dort eine Weite auf der Tafel.
      if (skier.airborne && !skier.tow && klammFlug(x, z)) this.flug = { start: schanzeLage(x, z).u }
      return
    }
    if (skier.airborne) return

    // Gelandet. In der Rinne zaehlt keine Weite – man ist nicht drueben.
    const flug = this.flug
    this.flug = null
    if (skier.tow || flug.start < -2) return
    const { u } = schanzeLage(x, z)
    // Zurueck auf der Rampe: ein Hopser vor der Kante, kein Sprung. Gemessen
    // wird erst der Flug, der an der Kante abhebt.
    if (u < 0.5) return
    if (klammAt(x, z) < -0.4 || u < SCHANZE.drueben - 1) {
      const wie = wertung(skier.absprung)
      skier.absprung = null
      this._zeige('Zu kurz', wie || 'Unten in der Klamm', 'warn')
      return
    }
    const weite = Math.round(u * 10) / 10
    const wie = wertung(skier.absprung)
    skier.absprung = null
    this.letzte = weite
    const neu = weite > this.best
    const vorher = this.best
    if (neu) {
      this.best = weite
      speichereBest(weite)
    }
    this._draw()
    const zeile = (a, b) => [a, b].filter(Boolean).join(' · ')
    if (neu && vorher > 0) this._zeige(meter(weite), zeile('Neue Bestweite', wie), 'good')
    else if (neu) this._zeige(meter(weite), wie, 'good')
    else this._zeige(meter(weite), zeile(wie, `Beste ${meter(this.best)}`), '')
  }
}
