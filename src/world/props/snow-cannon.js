import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Schneekanone: ein Geblaese auf einem Schlitten hinter der Absperrung
// des Kinderlands, das ueber den Zaun hinweg auf die Strecke blaest.
//
// Sie laeuft nicht durch. Steht niemand davor, ist sie aus und der Kopf steht
// in Ruhelage. Faehrt jemand durch ihr Feld, laeuft sie an und der Strahl
// folgt ihm, solange er in Reichweite bleibt. Das ist der Unterschied
// zwischen einer Kulisse und einem Geraet: es reagiert, und man merkt, dass
// man gemeint ist.
//
// Der Kegel ist eine reine Rechenform. Die Partikel starten an der Muendung,
// bekommen etwas Streuung und fallen; getroffen ist, wer im Kegel steckt.
// Eine echte Kollisionsabfrage gegen tausend Punkte waere hier Aufwand ohne
// sichtbaren Unterschied.

const STEEL = 0x9aa4ae
const STEEL_DARK = 0x5a636d
const YELLOW = 0xe8b03a
const HOSE = 0x37414c

const COUNT = 420
const REACH = 15         // Wurfweite der Fahne
const SPREAD = 0.30      // halber Oeffnungswinkel in rad
const TRACK = 0.85       // wie weit der Kopf aus der Ruhelage schwenken darf
const TRACK_RATE = 1.9   // rad/s, wie schnell er nachfuehrt
const SPIN_UP = 1.6      // 1/s, wie schnell sie anlaeuft und wieder ausgeht

// Sie geht nicht bei jeder Vorbeifahrt an. Eine Maschine, die jedesmal
// zuverlaessig anspringt, ist ein Schalter; eine, die es manchmal tut, ist ein
// Ereignis. Nach jedem Schub – und nach jedem Wuerfeln, das gegen sie ausging
// – ist sie fuer eine Weile gesperrt, sonst entscheidet sie sechzigmal in der
// Sekunde neu und laeuft am Ende doch durch.
const BURST = 4.0        // wie lange ein Schub laeuft
const LOCKOUT = 8.0      // Sperre danach, in Sekunden
const CHANCE = 0.5       // wie oft sie sich ueberhaupt dafuer entscheidet

// Weiss auf Weiss sieht man nicht. Die Fahne bekommt deshalb einen leicht
// kuehlen Ton und weiche runde Punkte – ohne beides ist sie im besonnten
// Schnee schlicht unsichtbar.
function puffTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(238,245,253,0.8)')
  g.addColorStop(1, 'rgba(214,230,246,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createSnowCannon({ heading = 0 } = {}) {
  const group = new THREE.Group()
  const parts = []

  // --- Schlitten -----------------------------------------------------------
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.18, 0.16, 2.6),
      color: STEEL_DARK,
      position: [sx * 0.62, 0.08, 0],
    })
    // Aufgebogene Kufenspitzen
    parts.push({
      geo: new THREE.BoxGeometry(0.18, 0.16, 0.55),
      color: STEEL_DARK,
      position: [sx * 0.62, 0.16, -1.42],
      rotation: [-0.42, 0, 0],
    })
  }
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.14, 1.2), color: STEEL, position: [0, 0.22, 0] })
  // Aggregatkasten hinten, damit die Kanone nicht nur ein Rohr auf Beinen ist.
  parts.push({ geo: new THREE.BoxGeometry(1.1, 0.7, 0.8), color: YELLOW, position: [0, 0.62, -0.7] })
  parts.push({ geo: new THREE.BoxGeometry(1.16, 0.12, 0.86), color: STEEL_DARK, position: [0, 0.98, -0.7] })
  // Schlauch, der im Schnee verschwindet – sie haengt an irgendetwas.
  for (let i = 0; i < 7; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6),
      color: HOSE,
      position: [-0.7 - i * 0.42, 0.36 - i * 0.045, -1.0 - i * 0.16],
      rotation: [0, 0.35, Math.PI / 2 - i * 0.02],
    })
  }
  const sled = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.62 }))
  sled.castShadow = true
  group.add(sled)

  // --- Schwenkbarer Kopf ---------------------------------------------------
  // Alles, was sich dreht, haengt in einer eigenen Gruppe; der Schlitten
  // bleibt stehen.
  const headParts = []
  headParts.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), color: STEEL_DARK, position: [0, 0.45, 0] })
  // Das Rohr zeigt in die lokale +Z-Richtung und ist leicht angehoben.
  headParts.push({
    geo: new THREE.CylinderGeometry(0.46, 0.52, 1.9, 14, 1, true),
    color: STEEL,
    position: [0, 1.15, 0.55],
    rotation: [Math.PI / 2 - 0.22, 0, 0],
  })
  headParts.push({
    geo: new THREE.TorusGeometry(0.5, 0.075, 6, 16),
    color: YELLOW,
    position: [0, 1.36, 1.45],
    rotation: [0.22, 0, 0],
  })
  // Duesenkranz an der Muendung
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    headParts.push({
      geo: new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5),
      color: STEEL_DARK,
      position: [Math.cos(a) * 0.36, 1.36 + Math.sin(a) * 0.36, 1.4],
      rotation: [Math.PI / 2, 0, 0],
    })
  }
  // Gegengewicht hinten, damit der Kopf nicht vorn ueberhaengt
  headParts.push({ geo: new THREE.BoxGeometry(0.5, 0.36, 0.4), color: STEEL_DARK, position: [0, 1.05, -0.5] })

  const head = new THREE.Group()
  const headMesh = new THREE.Mesh(assemble(headParts), vertexColorMaterial({ roughness: 0.55, metalness: 0.2 }))
  headMesh.castShadow = true
  head.add(headMesh)
  head.position.y = 0.28
  group.add(head)

  // --- Fahne ---------------------------------------------------------------
  const positions = new Float32Array(COUNT * 3)
  const life = new Float32Array(COUNT)
  const seed = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    life[i] = Math.random()
    // Feste Streurichtung pro Partikel: so bleibt die Fahne ueber die Zeit
    // gleichmaessig gefuellt, statt zu flackern.
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random())
    seed[i * 3] = Math.cos(a) * r
    seed[i * 3 + 1] = Math.sin(a) * r
    seed[i * 3 + 2] = 0.75 + Math.random() * 0.5
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const plume = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xccdcee,
      map: puffTexture(),
      size: 1.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  )
  plume.frustumCulled = false
  head.add(plume)

  // --- Bewegung ------------------------------------------------------------
  let swing = 0        // aktueller Schwenk des Kopfes
  let wanted = 0       // Schwenk, den das Ziel verlangt
  let power = 0        // 0 aus, 1 volle Fahne
  let demand = 0       // ob gerade jemand im Feld steht
  let burst = 0        // Restlaufzeit des laufenden Schubs
  let lock = 0         // Sperre, bis sie wieder wuerfeln darf
  const muzzle = new THREE.Vector3(0, 1.36, 1.5)
  const world = new THREE.Vector3()

  // Wo steht die Kanone, und wohin zeigt sie gerade? Der Kopf haengt in der
  // Gruppe, also addieren sich beide Drehungen.
  const base = () => {
    world.set(0, 0, 0)
    group.localToWorld(world)
    return world
  }

  // Vom Kinderland jeden Bild aufgerufen: nimm den Fahrer ins Visier, wenn er
  // im Feld steht. Steht er nicht drin, faellt der Kopf in die Ruhelage
  // zurueck und die Kanone geht aus.
  //
  // `allowed` ist das Veto von aussen. Wer auf dem Zauberteppich steht, faehrt
  // nicht, sondern wird gezogen – er kann nicht ausweichen, und eingeschneit
  // zu werden, waehrend man am Seil haengt, ist kein Ereignis, sondern eine
  // Schikane.
  group.userData.aimAt = (x, z, allowed = true) => {
    const p = base()
    const dx = x - p.x
    const dz = z - p.z
    const dist = Math.hypot(dx, dz)
    let bearing = Math.atan2(dx, dz) - group.rotation.y
    bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing))
    const inField = allowed && dist > 2 && dist < REACH + 4 && Math.abs(bearing) < TRACK

    if (!inField) {
      wanted = 0
      demand = 0
      burst = 0
      return
    }
    // Einmal je Vorbeifahrt wuerfeln, dann sperren.
    if (burst <= 0 && lock <= 0) {
      if (Math.random() < CHANCE) burst = BURST
      lock = LOCKOUT
    }
    // Der Kopf folgt auch dann, wenn sie nicht blaest – ein Geraet, das
    // hinschaut und schweigt, wirkt aufmerksamer als eines, das wegsieht.
    wanted = bearing
    demand = burst > 0 ? 1 : 0
  }

  group.userData.animate = (t, dt) => {
    burst = Math.max(0, burst - dt)
    lock = Math.max(0, lock - dt)

    // Nachfuehren mit begrenzter Winkelgeschwindigkeit – der Kopf ist schwer
    // und soll dem Fahrer hinterherziehen, nicht auf ihm kleben.
    const max = TRACK_RATE * dt
    swing += THREE.MathUtils.clamp(wanted - swing, -max, max)
    head.rotation.y = swing

    power += (demand - power) * Math.min(1, SPIN_UP * dt)
    plume.visible = power > 0.02
    plume.material.opacity = 0.7 * power
    if (!plume.visible) return

    // Solange sie aus ist, laufen die Partikel nicht weiter – die Fahne
    // waechst dadurch beim Anlaufen aus der Muendung heraus, statt fertig
    // dazustehen.
    const step = (dt / 1.35) * power
    const reach = REACH * (0.35 + 0.65 * power)
    for (let i = 0; i < COUNT; i++) {
      life[i] += step
      if (life[i] > 1) life[i] -= 1
      const u = life[i]
      const d = u * reach
      // Streuung waechst mit der Entfernung – daraus wird der Kegel.
      const spread = d * Math.tan(SPREAD)
      positions[i * 3] = muzzle.x + seed[i * 3] * spread
      positions[i * 3 + 1] = muzzle.y + seed[i * 3 + 1] * spread + d * 0.22 - u * u * reach * 0.30
      positions[i * 3 + 2] = muzzle.z + d * seed[i * 3 + 2]
    }
    geo.attributes.position.needsUpdate = true
  }

  // Steckt der Punkt (x, z) in der Fahne? Gerechnet wird in der Ebene: die
  // Fahne haengt zwar durch, aber wer darunter durchfaehrt, faehrt trotzdem
  // hindurch. Ausgeschaltet trifft sie niemanden.
  group.userData.inPlume = (x, z) => {
    if (power < 0.35) return 0
    const p = base()
    const ax = Math.sin(group.rotation.y + swing)
    const az = Math.cos(group.rotation.y + swing)
    const dx = x - p.x
    const dz = z - p.z
    const along = dx * ax + dz * az
    if (along < 1.2 || along > REACH) return 0
    const across = Math.abs(-dx * az + dz * ax)
    const half = along * Math.tan(SPREAD) + 0.6
    if (across > half) return 0
    // Voll in der Mitte, an der Kante nur noch angehaucht.
    return (1 - across / half) * (1 - Math.max(0, (along - REACH * 0.75) / (REACH * 0.25)) * 0.6) * power
  }

  group.rotation.y = heading
  return group
}
