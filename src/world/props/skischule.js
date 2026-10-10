import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { createSkierModel } from '../../player/skier-model.js'
import { KINDER_COLORS } from './kinderland.js'

// Die Skischule im Kinderland: die Tafel am Treffpunkt und die Figuren der
// Gruppe, die von dort aus ihre Runden faehrt (areas/skischule.js).
//
// Julian ist Skilehrer, und das Zertifikat sollte irgendwo hin, ohne
// aufdringlich zu sein (Ansage 09.10.). Ein Treffpunkt der Skischule steht
// in jedem echten Kinderland – hier haengt der Ausweis also an etwas, das
// ohnehin dort stuende, und nicht an einem Schild, das nur fuer ihn da ist.

// Die Farbe der Skischule. Blau, weil der Fahrer orange ist: zwei rote
// Jacken auf dem Hang, und man suchte sich selbst.
export const SKISCHULE_BLAU = 0x1f4fa8
const SNOW = 0xf7fbff
const POST = 0x6b4a35
const NEIGUNG = -0.5

// Eine Tafelseite. Der Schriftzug steht im Kasten, darunter eine Zeile.
function seite(titel, unter, { grund, schrift = '#ffffff', zeichen = null }) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')
  g.fillStyle = grund
  g.fillRect(0, 0, 512, 320)
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 12
  g.strokeRect(14, 14, 484, 292)
  g.fillStyle = schrift
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const font = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
  if (zeichen) zeichen(g)
  g.font = `900 ${titel.length > 9 ? 74 : 86}px ${font}`
  g.fillText(titel, 256, zeichen ? 182 : 140, 440)
  g.font = `700 40px ${font}`
  g.globalAlpha = 0.85
  g.fillText(unter, 256, zeichen ? 258 : 232, 440)
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Zwei gekreuzte Ski, das Zeichen der Skischule.
function skiZeichen(g) {
  g.save()
  g.translate(256, 82)
  g.strokeStyle = '#ffffff'
  g.lineCap = 'round'
  g.lineWidth = 16
  for (const s of [-1, 1]) {
    g.save()
    g.rotate(s * 0.62)
    g.beginPath()
    g.moveTo(0, -58)
    g.lineTo(0, 52)
    g.stroke()
    g.restore()
  }
  g.restore()
}

// Haken im Kreis: geprueft.
function hakenZeichen(g) {
  g.save()
  g.translate(256, 84)
  g.fillStyle = '#37b87c'
  g.beginPath()
  g.arc(0, 0, 50, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#ffffff'
  g.lineWidth = 14
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(-22, 2)
  g.lineTo(-6, 18)
  g.lineTo(24, -16)
  g.stroke()
  g.restore()
}

// Die Tafel am Treffpunkt. Vorn steht SKISCHULE; wer heranzoomt, sieht sie
// sich umdrehen, und hinten steht, wer hier unterrichtet. Erst danach geht
// die Auswahl auf – wie bei jeder Station: erst etwas vorfuehren.
export function createTreffpunkt() {
  const group = new THREE.Group()
  const H = 3.0
  const parts = []
  parts.push({ geo: new THREE.CylinderGeometry(0.42, 0.5, 0.2, 10), color: 0x8e969f, position: [0, 0.08, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.07, H, 8), color: POST, position: [0, H / 2, 0] })
  parts.push({ geo: new THREE.SphereGeometry(0.09, 8, 6), color: KINDER_COLORS[2], position: [0, H + 0.05, 0] })
  const mast = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  mast.castShadow = true
  group.add(mast)

  // Die Tafel dreht sich um den Mast; beide Seiten sind eigene Flaechen,
  // Ruecken an Ruecken.
  const dreh = new THREE.Group()
  dreh.position.y = H - 0.92
  group.add(dreh)
  const w = 1.85, h = 1.16
  const vorn = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: seite('SKISCHULE', 'Treffpunkt', { grund: '#1f4fa8', zeichen: skiZeichen }), roughness: 0.7 }),
  )
  const hinten = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: seite('SKILEHRER', 'Julian Veerkamp', { grund: '#1f4fa8', zeichen: hakenZeichen }), roughness: 0.7 }),
  )
  hinten.rotation.y = Math.PI
  const tafel = new THREE.Group()
  tafel.rotation.x = NEIGUNG
  vorn.position.z = 0.012
  hinten.position.z = -0.012
  const rahmen = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
  )
  rahmen.castShadow = true
  tafel.add(rahmen, vorn, hinten)
  // Schneekante oben auf der Tafel.
  const kante = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, 0.05, 0.1),
    new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.95, flatShading: true }),
  )
  kante.position.y = h / 2 + 0.05
  tafel.add(kante)
  dreh.add(tafel)

  // Ein Wimpel obendrauf, in den Farben des Kinderlands.
  const wimpel = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.6, 3).rotateZ(-Math.PI / 2).translate(0.3, 0, 0),
    new THREE.MeshStandardMaterial({ color: KINDER_COLORS[0], roughness: 0.7, flatShading: true }),
  )
  wimpel.position.y = H - 0.02
  wimpel.scale.z = 0.25
  group.add(wimpel)

  let ziel = 0
  let winkel = 0
  group.userData.select = (i) => { ziel = i === null || i === undefined ? 0 : Math.PI }
  group.userData.animate = (t, dt) => {
    // Schwingt ueber und pendelt sich ein, wie ein Schild an einem Gelenk.
    winkel += (ziel - winkel) * (1 - Math.exp(-3.2 * dt))
    dreh.rotation.y = winkel + Math.sin(t * 6) * 0.04 * Math.abs(ziel - winkel)
    // Die Neigung kippt mit: auch die Rueckseite lehnt sich zur Kamera
    // zurueck und nicht von ihr weg.
    tafel.rotation.x = NEIGUNG * Math.cos(winkel)
    wimpel.rotation.y = Math.sin(t * 1.7) * 0.5
  }
  return group
}

// --- Figuren --------------------------------------------------------------
// Dieselbe Figur wie der Fahrer, umgefaerbt; die Kinder auf knapp zwei
// Drittel. Jede Figur hat ihr eigenes Material (createSkierModel baut es
// neu), deshalb lassen sich die Farben einzeln setzen.
export function createSkischulFigur({ kind = false, jacke = SKISCHULE_BLAU, helm = 0xf2ede2, hose = 0x2f3d5c, ski = 0xd8dee6 } = {}) {
  const model = createSkierModel()
  const m = model.userData.parts.materials
  m.jacket.color.set(jacke)
  m.jacketDark.color.set(new THREE.Color(jacke).multiplyScalar(0.72))
  m.helmet.color.set(helm)
  m.pants.color.set(hose)
  m.glove.color.set(hose)
  m.ski.color.set(ski)
  m.pack.color.set(kind ? jacke : 0x2f3d5c)
  if (kind) model.scale.setScalar(0.62)
  model.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return model
}

// Die Kinder der Gruppe: Jacken in den vier Farben des Kinderlands, die
// Helme bunt dazu, damit man sie von oben auseinanderhaelt.
export const KINDER_JACKEN = [
  { jacke: KINDER_COLORS[0], helm: 0xf2c53d },
  { jacke: KINDER_COLORS[3], helm: 0xe94f8a },
  { jacke: KINDER_COLORS[2], helm: 0x2f6bd8 },
  { jacke: 0xe94f8a, helm: 0xf7fbff },
]

// --- Die Huette der Skischule ---------------------------------------------
// Dort wohnt die Gruppe, wenn sie nicht faehrt (Ansage 10.10.: wie die
// Pistenraupe im Schuppen, damit es etwas Besonderes ist, wenn die
// Skischule kommt). Eine kleine Holzhuette mit blauen Laeden, vorn das Schild
// SKISCHULE im Giebel, die Tuer links in der Front – zur Kamera, damit man
// sieht, wie sie aufgeht und die Kinder herauskommen. Rechts lehnen kleine
// Ski an der Wand.
const HOLZ = 0x8a5a3a
const HOLZ_HELL = 0xa06c45
const HOLZ_DUNKEL = 0x5c3c28
export const HUETTE = { breit: 3.2, tief: 2.4, wand: 2.0, tuerX: -0.75, tuerBreit: 0.9 }

export function createSkischulhuette() {
  const group = new THREE.Group()
  const { breit: W, tief: D, wand: H, tuerX, tuerBreit } = HUETTE
  const parts = []
  // Sockel tief in den Schnee, die Huette steht am Hang.
  parts.push({ geo: new THREE.BoxGeometry(W + 0.2, 0.9, D + 0.2), color: 0x6e7178, position: [0, -0.25, 0] })
  // Bretterwaende, abwechselnd hell und dunkel.
  const bretter = 8
  for (let i = 0; i < bretter; i++) {
    const y = 0.2 + (i + 0.5) * (H / bretter)
    const farbe = i % 2 ? HOLZ : HOLZ_HELL
    // Vorn mit der Tueroeffnung.
    const links = -W / 2, rechts = W / 2
    const tl = tuerX - tuerBreit / 2, tr = tuerX + tuerBreit / 2
    const oben = y > 0.2 + 1.75
    if (oben) parts.push({ geo: new THREE.BoxGeometry(W, H / bretter - 0.02, 0.12), color: farbe, position: [0, y, D / 2] })
    else {
      parts.push({ geo: new THREE.BoxGeometry(tl - links, H / bretter - 0.02, 0.12), color: farbe, position: [(links + tl) / 2, y, D / 2] })
      parts.push({ geo: new THREE.BoxGeometry(rechts - tr, H / bretter - 0.02, 0.12), color: farbe, position: [(tr + rechts) / 2, y, D / 2] })
    }
    parts.push({ geo: new THREE.BoxGeometry(W, H / bretter - 0.02, 0.12), color: farbe, position: [0, y, -D / 2] })
    for (const sx of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.12, H / bretter - 0.02, D), color: i % 2 ? HOLZ_HELL : HOLZ, position: [sx * W / 2, y, 0] })
    }
  }
  // Dunkel hinter der Tuer, damit die offene Tuer nicht in einen leeren
  // Kasten schauen laesst.
  parts.push({ geo: new THREE.BoxGeometry(tuerBreit, 1.75, 0.04), color: 0x1b2230, position: [tuerX, 0.2 + 0.875, D / 2 - 0.3] })
  // Tuerrahmen blau.
  parts.push({ geo: new THREE.BoxGeometry(tuerBreit + 0.2, 0.12, 0.16), color: SKISCHULE_BLAU, position: [tuerX, 0.2 + 1.8, D / 2 + 0.02] })
  for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.1, 1.8, 0.16), color: SKISCHULE_BLAU, position: [tuerX + s * (tuerBreit / 2 + 0.05), 0.2 + 0.9, D / 2 + 0.02] })

  // Fenster rechts mit blauen Laeden und warmem Licht.
  const fx = 0.75, fy = 0.2 + 1.15
  parts.push({ geo: new THREE.BoxGeometry(0.8, 0.62, 0.05), color: 0xffd28a, position: [fx, fy, D / 2 + 0.05] })
  parts.push({ geo: new THREE.BoxGeometry(0.06, 0.62, 0.07), color: 0xffffff, position: [fx, fy, D / 2 + 0.07] })
  parts.push({ geo: new THREE.BoxGeometry(0.8, 0.06, 0.07), color: 0xffffff, position: [fx, fy, D / 2 + 0.07] })
  for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.36, 0.7, 0.05), color: SKISCHULE_BLAU, position: [fx + s * 0.6, fy, D / 2 + 0.08] })
  parts.push({ geo: new THREE.BoxGeometry(0.95, 0.08, 0.2), color: SNOW, position: [fx, fy - 0.38, D / 2 + 0.12] })

  // Giebel und Dach, das Dach dick verschneit.
  const giebel = new THREE.Shape()
  giebel.moveTo(-W / 2 - 0.06, 0)
  giebel.lineTo(W / 2 + 0.06, 0)
  giebel.lineTo(0, 1.0)
  giebel.closePath()
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.ExtrudeGeometry(giebel, { depth: 0.12, bevelEnabled: false }), color: HOLZ_DUNKEL, position: [0, 0.2 + H, sz * (D / 2) - 0.06] })
  }
  const lang = Math.hypot(W / 2 + 0.4, 1.0)
  const neig = Math.atan2(1.0, W / 2 + 0.4)
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(lang, 0.12, D + 0.6), color: SKISCHULE_BLAU, position: [sx * (W / 4 + 0.18), 0.2 + H + 0.5, 0], rotation: [0, 0, sx * -neig] })
    parts.push({ geo: new THREE.BoxGeometry(lang * 0.98, 0.2, D + 0.62), color: SNOW, position: [sx * (W / 4 + 0.18), 0.2 + H + 0.65, 0], rotation: [0, 0, sx * -neig] })
  }

  // Kinderski an der Wand rechts, in den Farben des Kinderlands.
  KINDER_COLORS.forEach((c, i) => {
    parts.push({ geo: new THREE.BoxGeometry(0.08, 1.1, 0.03), color: c, position: [W / 2 - 0.25 - i * 0.14, 0.2 + 0.55, D / 2 + 0.2], rotation: [0.18, 0, (i % 2 ? 1 : -1) * 0.05] })
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  // Das Schild im Giebel.
  const schild = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.94),
    new THREE.MeshStandardMaterial({ map: seite('SKISCHULE', 'Kinderland', { grund: '#1f4fa8', zeichen: skiZeichen }), roughness: 0.7 }),
  )
  schild.position.set(0, 0.2 + H + 0.42, D / 2 + 0.08)
  group.add(schild)

  // Die Tuer, an der linken Kante angeschlagen, geht nach aussen auf.
  const angel = new THREE.Group()
  angel.position.set(tuerX - tuerBreit / 2, 0.2, D / 2 + 0.07)
  const tuerTeile = [
    { geo: new THREE.BoxGeometry(tuerBreit - 0.04, 1.74, 0.07), color: SKISCHULE_BLAU, position: [tuerBreit / 2, 0.88, 0] },
    { geo: new THREE.BoxGeometry(0.4, 0.3, 0.02), color: 0xffd28a, position: [tuerBreit / 2, 1.35, 0.04] },
    { geo: new THREE.SphereGeometry(0.045, 8, 6), color: 0xd8dee6, position: [tuerBreit - 0.14, 0.9, 0.06] },
  ]
  const tuer = new THREE.Mesh(assemble(tuerTeile), vertexColorMaterial({ roughness: 0.6 }))
  tuer.castShadow = true
  angel.add(tuer)
  group.add(angel)

  let offen = 0
  return {
    group,
    get offen() { return offen },
    // 0 zu, 1 ganz offen.
    setzeTuer(wert) {
      offen = Math.max(0, Math.min(1, wert))
      angel.rotation.y = -offen * 1.75
    },
  }
}
