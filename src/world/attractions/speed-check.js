import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { createAnzeigetafel, TAFEL_SCHRIFT } from '../props/anzeigetafel.js'

// Die Radarfalle auf der freien Abfahrt: zwei Pfosten links und rechts der
// Bahn, auf dem rechten eine kleine Kamera, auf dem linken ihr Reflektor –
// eine Lichtschranke, durch die man faehrt. Weiter unten steht das Display
// mit der Geschwindigkeit.
//
// Sie misst nichts, was man nicht ohnehin haette – aber sie macht daraus eine
// Zahl, und eine Zahl will man verbessern. Das ist der ganze Zweck: der Hang
// war vorher der Weg ohne Uhr, jetzt hat er einen Grund.
//
// Im Schnee liegt nichts. Ein Strich quer ueber die Bahn sah nach Startlinie
// aus, und eine zweite Rennstrecke neben der Rennstrecke ist keine Wahl mehr.
// Zwei Pfosten sagen dasselbe und stehen dabei nicht im Weg.

const POST = 0x5d666f
const BODY = 0x3a424c
const LENS = 0x8fd3ff

// Die Bestmarke ueberlebt das Neuladen wie die Bestweite am Klammsprung:
// ohne sie sagt die Einblendung nur, was man gerade war.
const STORE = 'skiportfolio.speedcheck'
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

export class SpeedCheck {
  constructor(world, { x, z, dx, dz, width = 10, label = 'SPEEDCHECK' }) {
    this.world = world
    this.x = x
    this.z = z
    this.dx = dx
    this.dz = dz
    // Quer zur Fahrtrichtung.
    this.nx = dz
    this.nz = -dx
    this.width = width
    this.label = label

    this.last = null
    this.best = ladeBest()
    this._prevSide = null
    this._hold = 0

    this._build()
    this._buildHud()
    this._draw()
  }

  _build() {
    const { x, z, dx, dz, nx, nz } = this
    const half = this.width / 2

    // --- Rechter Pfosten mit Kamera ---------------------------------------
    // Rechts, weil die Kamera dem Fahrer ins Gesicht schauen soll: er kommt
    // von oben links ins Bild, und von dort aus ist rechts die Seite, auf der
    // sie nicht hinter ihm steht.
    const camX = x + nx * half
    const camZ = z + nz * half
    const parts = []
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 2.4, 8), color: POST, position: [0, 1.2, 0] })
    parts.push({ geo: new THREE.BoxGeometry(0.34, 0.3, 0.5), color: BODY, position: [0, 2.42, 0.16] })
    // Objektiv, zur Bahn hin geneigt.
    parts.push({
      geo: new THREE.CylinderGeometry(0.11, 0.13, 0.26, 10),
      color: BODY,
      position: [0, 2.3, 0.44],
      rotation: [1.16, 0, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.095, 0.095, 0.04, 10),
      color: LENS,
      position: [0, 2.24, 0.51],
      rotation: [1.16, 0, 0],
    })
    // Sonnenblende obendrauf
    parts.push({ geo: new THREE.BoxGeometry(0.4, 0.05, 0.34), color: POST, position: [0, 2.6, 0.28], rotation: [0.2, 0, 0] })
    const cam = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.55 }))
    cam.castShadow = true
    // Die Kamera schaut quer ueber die Bahn zum Gegenpfosten.
    cam.position.set(camX, terrainHeight(camX, camZ), camZ)
    cam.rotation.y = Math.atan2(-nx, -nz)
    this.world.scene.add(cam)
    this.world.addCollider(camX, camZ, 0.35)

    // --- Linker Pfosten mit Reflektor --------------------------------------
    const refX = x - nx * half
    const refZ = z - nz * half
    const ref = []
    ref.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 2.2, 8), color: POST, position: [0, 1.1, 0] })
    ref.push({ geo: new THREE.BoxGeometry(0.3, 0.34, 0.1), color: BODY, position: [0, 2.24, 0.06] })
    ref.push({ geo: new THREE.BoxGeometry(0.2, 0.24, 0.05), color: LENS, position: [0, 2.24, 0.12] })
    // Ein schmales Warnband am Mast, damit der Pfosten nicht als Zaunrest liest.
    for (const y of [0.7, 1.0, 1.3]) {
      ref.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), color: 0xe0662f, position: [0, y, 0] })
    }
    const refMesh = new THREE.Mesh(assemble(ref), vertexColorMaterial({ roughness: 0.6 }))
    refMesh.castShadow = true
    refMesh.position.set(refX, terrainHeight(refX, refZ), refZ)
    refMesh.rotation.y = Math.atan2(nx, nz)
    this.world.scene.add(refMesh)
    this.world.addCollider(refX, refZ, 0.32)

    // Ein kleines Blitzlicht, das beim Durchfahren angeht.
    const flash = new THREE.PointLight(0xbfe6ff, 0, 9, 2)
    flash.position.set(camX, terrainHeight(camX, camZ) + 2.4, camZ)
    this.world.scene.add(flash)
    this.flash = flash
  }

  // Das Display steht ein Stueck unterhalb der Linie am Rand: man faehrt
  // durch, schaut nach unten und sieht die Zahl schon stehen.
  buildDisplay(x, z) {
    const { canvas, tex, group } = createAnzeigetafel(this.world, x, z)
    this.canvas = canvas
    this.tex = tex
    return group
  }

  _buildHud() {
    // Dieselbe Frostzeile wie Klammsprung und Zeitnahme: man ist nie an
    // zweien zugleich.
    const el = document.createElement('div')
    el.className = 'frost race-hud'
    el.innerHTML = '<div class="race-time"></div><div class="race-note"></div>'
    document.body.appendChild(el)
    this.hud = el
    this.wertEl = el.querySelector('.race-time')
    this.noteEl = el.querySelector('.race-note')
  }

  _zeige(text, note, tone) {
    this.wertEl.textContent = text
    this.noteEl.textContent = note
    this.hud.dataset.tone = tone || ''
    this.hud.classList.add('visible')
    this._hold = 3.2
  }

  _draw() {
    if (!this.canvas) return
    const ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 256)
    ctx.textAlign = 'center'

    ctx.fillStyle = '#5c6b7d'
    ctx.font = `700 34px ${TAFEL_SCHRIFT}`
    ctx.fillText(this.label, 256, 46)

    const value = this.last === null ? '--' : String(Math.round(this.last))
    ctx.fillStyle = this.last !== null && this.last >= this.best ? '#8ef0b4' : '#f2f7ff'
    ctx.font = `800 128px ${TAFEL_SCHRIFT}`
    ctx.fillText(value, 214, 168)

    ctx.fillStyle = '#7f8fa2'
    ctx.font = `700 40px ${TAFEL_SCHRIFT}`
    ctx.fillText('km/h', 388, 168)

    if (this.best > 0) {
      ctx.fillStyle = '#6d7c8e'
      ctx.font = `600 30px ${TAFEL_SCHRIFT}`
      ctx.fillText(`BESTE ${Math.round(this.best)}`, 256, 220)
    }
    this.tex.needsUpdate = true
  }

  update(dt, skier) {
    if (this._hold > 0) {
      this._hold -= dt
      if (this._hold <= 0) this.hud.classList.remove('visible')
    }
    if (this.flash.intensity > 0) {
      this.flash.intensity = Math.max(0, this.flash.intensity - dt * 24)
    }

    // Auf welcher Seite der Linie steht der Fahrer? Das Vorzeichen entlang der
    // Fahrtrichtung genuegt – eine Triggerbox braucht es dafuer nicht.
    const rx = skier.position.x - this.x
    const rz = skier.position.z - this.z
    const along = rx * this.dx + rz * this.dz
    const across = Math.abs(rx * this.nx + rz * this.nz)
    const side = along >= 0 ? 1 : -1

    if (this._prevSide !== null && side !== this._prevSide && side > 0 && across < this.width / 2 + 1) {
      // Einheiten sind Meter, also ist Tempo mal 3,6 Kilometer je Stunde.
      const kmh = skier.speed * 3.6
      const vorher = this.best
      this.last = kmh
      // Gerundet verglichen, wie es auf der Tafel steht: 61,4 nach 61,2 ist
      // dort zweimal 61 und keine neue Bestmarke.
      const neu = Math.round(kmh) > Math.round(vorher)
      if (kmh > this.best) {
        this.best = kmh
        speichereBest(kmh)
      }
      this._draw()
      const zahl = `${Math.round(kmh)} km/h`
      if (neu && vorher > 0) this._zeige(zahl, 'Neue Bestmarke', 'good')
      else if (neu) this._zeige(zahl, '', 'good')
      else this._zeige(zahl, `Beste ${Math.round(this.best)} km/h`, '')
      this.flash.intensity = 7
    }
    this._prevSide = side
  }
}
