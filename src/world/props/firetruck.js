import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Kleines Feuerwehrauto, das im Tal steht: Kabine, Geraeteaufbau mit Rollos,
// Drehleiter auf dem Dach, Blaulichter und Scheinwerfer. Bewusst
// spielzeughaft proportioniert – kurz, hoch und rund, nicht wie ein echtes
// Fahrzeug.

const RED = 0xc8352c
const RED_DARK = 0x9c261f
const WHITE = 0xeef1f4
const GLASS = 0x9fc4d8
const TIRE = 0x22262b
const CHROME = 0xb8c0c8
const SILVER = 0x9aa3ac

// Ein weicher Lichtfleck um eine Lampe. Additiv und ohne Tiefe, damit er
// auch am Tag leuchtet; eine echte Lichtquelle muesste jedes Material im
// Tal neu uebersetzen, nur weil ein Auto blinkt.
let haloTex = null
function halo(color, size, position) {
  if (!haloTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.35, 'rgba(255,255,255,.45)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 64, 64)
    haloTex = new THREE.CanvasTexture(c)
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  s.scale.setScalar(size)
  s.position.set(...position)
  return s
}

export function createFireTruck() {
  const group = new THREE.Group()
  const parts = []

  const L = 3.4   // Laenge (entlang Z)
  const W = 1.5   // Breite

  // --- Chassis ------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 0.24, L), color: RED_DARK, position: [0, 0.52, 0] })

  // --- Kabine vorne -------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 0.92, 1.15), color: RED, position: [0, 1.1, L / 2 - 0.6] })
  // Abgerundete Front
  parts.push({
    geo: new THREE.CylinderGeometry(0.2, 0.2, W, 8, 1, false, 0, Math.PI),
    color: RED,
    position: [0, 1.42, L / 2 - 0.03],
    rotation: [0, 0, Math.PI / 2],
  })
  // Kuehlergrill und Stossstange
  parts.push({ geo: new THREE.BoxGeometry(W * 0.86, 0.26, 0.08), color: CHROME, position: [0, 0.98, L / 2 + 0.02] })
  parts.push({ geo: new THREE.BoxGeometry(W + 0.08, 0.16, 0.14), color: SILVER, position: [0, 0.68, L / 2 + 0.02] })

  // --- Geraeteaufbau hinten ------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 1.0, 1.85), color: RED, position: [0, 1.14, -0.62] })
  // Rollladen an den Seiten
  for (const sx of [-1, 1]) {
    for (const dz of [-0.32, 0.42]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.04, 0.66, 0.66),
        color: SILVER,
        position: [sx * (W / 2 + 0.01), 1.12, -0.62 + dz],
      })
      // Griffleiste
      parts.push({
        geo: new THREE.BoxGeometry(0.05, 0.05, 0.5),
        color: CHROME,
        position: [sx * (W / 2 + 0.03), 0.86, -0.62 + dz],
      })
    }
  }
  // Weisser Zierstreifen ueber die ganze Laenge
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.03, 0.14, L - 0.5),
      color: WHITE,
      position: [sx * (W / 2 + 0.005), 1.52, -0.1],
    })
  }

  // --- Drehleiter auf dem Dach --------------------------------------------
  const ladderY = 1.7
  parts.push({ geo: new THREE.CylinderGeometry(0.22, 0.26, 0.16, 10), color: SILVER, position: [0, ladderY - 0.04, -0.62] })
  // Zwei Holme
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.06, 0.08, 2.5),
      color: SILVER,
      position: [sx * 0.24, ladderY + 0.22, -0.2],
      rotation: [-0.1, 0, 0],
    })
  }
  // Sprossen
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.5, 0.04, 0.05),
      color: CHROME,
      position: [0, ladderY + 0.22 + (i - 4) * 0.028, -0.2 + (i - 4) * 0.27],
      rotation: [-0.1, 0, 0],
    })
  }

  // --- Raeder --------------------------------------------------------------
  for (const sx of [-1, 1]) {
    for (const pz of [L / 2 - 0.75, -0.75]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12),
        color: TIRE,
        position: [sx * (W / 2 - 0.05), 0.36, pz],
        rotation: [0, 0, Math.PI / 2],
      })
      parts.push({
        geo: new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8),
        color: SILVER,
        position: [sx * (W / 2 - 0.05), 0.36, pz],
        rotation: [0, 0, Math.PI / 2],
      })
    }
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.5, metalness: 0.15 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Scheiben ------------------------------------------------------------
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS, roughness: 0.12, metalness: 0.35, flatShading: true,
  })
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.5, 0.06), glassMat)
  windshield.position.set(0, 1.36, L / 2 - 0.06)
  windshield.rotation.x = -0.16
  group.add(windshield)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.6), glassMat)
    side.position.set(sx * (W / 2 - 0.01), 1.32, L / 2 - 0.7)
    group.add(side)
  }

  // --- Blaulichter und Scheinwerfer ---------------------------------------
  // Sie sind aus, solange niemand vor dem Fahrzeug steht. Vorher blinkten sie
  // immer gemaechlich vor sich hin; jetzt ist das Anschalten das, was beim
  // Heranzoomen passiert – ein Fahrzeug, das schon blinkt, kann nicht mehr
  // aufwachen.
  const beacons = []
  for (const sx of [-0.42, 0.42]) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a4f94,
      emissive: new THREE.Color(0x3f7de8),
      emissiveIntensity: 0.05,
      roughness: 0.25,
      flatShading: true,
    })
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.13, 8), mat)
    beacon.position.set(sx, 1.66, L / 2 - 0.62)
    group.add(beacon)
    beacons.push({ mat, halo: halo(0x5b95ff, 1.8, [sx, 1.7, L / 2 - 0.62]) })
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xd9dde2, emissive: new THREE.Color(0xfff1c8), emissiveIntensity: 0, roughness: 0.3,
  })
  const heads = []
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.05), headMat)
    lamp.position.set(sx * 0.56, 0.98, L / 2 + 0.05)
    group.add(lamp)
    heads.push(halo(0xffe7b0, 0.9, [sx * 0.56, 0.98, L / 2 + 0.16]))
  }
  for (const h of [...beacons.map((b) => b.halo), ...heads]) group.add(h)

  // Schnee auf Dach und Leiter – das Fahrzeug steht schon eine Weile.
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.95, flatShading: true })
  const roofSnow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.09, 1.7), snowMat)
  roofSnow.position.set(0, 1.68, -0.62)
  group.add(roofSnow)

  let an = false
  let licht = 0       // 0 aus … 1 an, weich nachgezogen
  let fahrt = null    // { t, boden, x0, z0, hoch } solange es ausrueckt

  // Die Auswahl hat nur ein Ziel; gewaehlt heisst herangezoomt.
  group.userData.select = (i) => { an = i !== null }

  // Losfahren. Hinter ihm, schraeg links vor der Nase, ist eine Luecke
  // zwischen zwei Tannen, gut drei Meter entfernt; da will er hindurch.
  // Erst setzt er 0,8 m zurueck und schlaegt dabei so ein, dass die Nase
  // schon zur Luecke schwenkt (Radius 5 m), dann faehrt er einen flachen
  // Linksbogen (Radius 6 m, 29 Grad) und zeigt genau auf ihre Mitte.
  // Beim ersten Versuch schwenkte die Nase beim Zuruecksetzen zur Kamera,
  // also weg vom Ziel – dann ergibt Rangieren keinen Sinn (Julian, 30.09.).
  // Gegen die ausgelesenen Staemme gerechnet: allen anderen Tannen kommt
  // keine Ecke naeher als 2,7 m, so nah wie geparkt. Durch die Luecke
  // selbst muss er nicht passen, die Blende ist vorher zu.
  // Frueher fuhr er geradeaus mitten durch die Tanne vor ihm.
  // boden(x, z) ist die Gelaendehoehe, damit er nicht durch den Hang faehrt.
  // kruemmung > 0 dreht nach rechts (die Gierung nimmt ab), < 0 nach links.
  const RUECK = { weg: 0.8, dauer: 0.6, kruemmung: -1 / 5 }
  const KURVE = { kruemmung: -1 / 6, winkel: 0.5, start: 0.7, beschl: 3.5 }
  group.userData.losfahren = (boden) => {
    if (fahrt) return
    an = true
    const { x, z } = group.position
    fahrt = {
      t: 0, boden, x0: x, z0: z, h0: group.rotation.y,
      hoch: group.position.y - boden(x, z),
      x, z, h: group.rotation.y, zurueck: 0, vor: 0, gedreht: 0,
    }
  }
  // Zurueck an den Platz – wenn der Browser die Seite aus dem Verlauf
  // wiederholt, stuende er sonst zwischen den Tannen.
  group.userData.zurueck = () => {
    if (!fahrt) return
    group.position.set(fahrt.x0, fahrt.boden(fahrt.x0, fahrt.z0) + fahrt.hoch, fahrt.z0)
    group.rotation.y = fahrt.h0
    fahrt = null
  }
  // Ein Stueck Weg; vorwaerts (ds > 0) oder rueckwaerts, mit Einschlag.
  const rollen = (ds, kruemmung) => {
    const n = Math.ceil(Math.abs(ds) / 0.02)
    for (let i = 0; i < n; i++) {
      const d = ds / n
      fahrt.x += Math.sin(fahrt.h) * d
      fahrt.z += Math.cos(fahrt.h) * d
      fahrt.h -= Math.abs(d) * kruemmung(Math.abs(d))
    }
  }

  group.userData.animate = (t, dt = 0) => {
    licht += ((an ? 1 : 0) - licht) * (1 - Math.exp(-8 * dt))
    // Wechselblinker, schnell wie im Einsatz.
    const phase = Math.sin(t * 11) > 0
    beacons.forEach((b, i) => {
      const hell = (i === 0) === phase ? 1 : 0.12
      b.mat.emissiveIntensity = 0.05 + licht * hell * 3.2
      b.halo.material.opacity = licht * hell * 0.85
    })
    headMat.emissiveIntensity = licht * 2.4
    for (const h of heads) h.material.opacity = licht * 0.7

    if (fahrt) {
      const f = fahrt
      f.t += dt
      // Rueckwaerts weich an- und abrollen, kurz stehen, dann Gas.
      const u = Math.min(1, f.t / RUECK.dauer)
      const zurueck = RUECK.weg * u * u * (3 - 2 * u)
      rollen(-(zurueck - f.zurueck), () => RUECK.kruemmung)
      f.zurueck = zurueck
      const tv = Math.max(0, f.t - KURVE.start)
      const vor = 0.5 * KURVE.beschl * tv * tv
      rollen(vor - f.vor, (d) => {
        if (f.gedreht >= KURVE.winkel) return 0
        f.gedreht += d * Math.abs(KURVE.kruemmung)
        return KURVE.kruemmung
      })
      f.vor = vor
      group.position.set(f.x, f.boden(f.x, f.z) + f.hoch, f.z)
      group.rotation.y = f.h
    }
  }

  group.userData.footprint = { width: W + 0.5, depth: L + 0.4 }
  return group
}
