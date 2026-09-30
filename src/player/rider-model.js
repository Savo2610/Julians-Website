import * as THREE from 'three'

// Der Wasserskifahrer, aus Primitiven gebaut wie der Skifahrer im Tal:
// dieselbe Weste in Orange, dieselben gruenen Ski, dieselbe flache
// Schattierung. Nur kuerzer und breiter die Ski, mit Finne, und statt der
// Stoecke eine Hantel in beiden Haenden.
//
// Aufbau (lokal +z = Blickrichtung):
//   root            – steht auf dem Wasser, dreht mit der Fahrtrichtung
//   └ spin          – Drehung um die Hochachse (Tricks)
//     └ flip        – Ueberschlag um die Querachse, Drehpunkt auf Hueft-
//                     hoehe, damit der Salto nicht um die Fuesse kreist
//       └ body      – Ski, Beine, Oberkoerper, Hantel

const PALETTE = {
  vest: 0xe4613a,
  vestDark: 0xb44526,
  shorts: 0x2f3d5c,
  skin: 0xe8b48c,
  helmet: 0xf2ede2,
  visor: 0x1a2430,
  ski: 0x8fc23a,
  skiEdge: 0x2b3240,
  binding: 0x1b2233,
}

const PIVOT = 0.9

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flat ?? true,
  })
}

function makeSki(material, dark) {
  const length = 1.45
  const w = 0.085
  const shape = new THREE.Shape()
  shape.moveTo(-length * 0.5, -w)
  shape.lineTo(length * 0.3, -w)
  shape.quadraticCurveTo(length * 0.5, -w * 0.5, length * 0.52, w * 1.8)
  shape.lineTo(length * 0.44, w * 2)
  shape.quadraticCurveTo(length * 0.36, w, length * 0.28, w)
  shape.lineTo(-length * 0.5, w)
  shape.closePath()
  // Das Profil liegt in XY: x laengs, y die Aufbiegung. Die Breite kommt aus
  // der Extrusion.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.19, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 4 })
  geo.rotateY(-Math.PI / 2)
  geo.translate(0.095, 0, 0)
  geo.scale(1, 0.5, 1)
  const ski = new THREE.Group()
  const body = new THREE.Mesh(geo, material)
  body.castShadow = true
  ski.add(body)
  const binding = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.34), dark)
  binding.position.set(0, 0.08, 0)
  ski.add(binding)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.16), dark)
  fin.position.set(0, -0.06, -0.58)
  ski.add(fin)
  return ski
}

export function createRiderModel(handleGeometry, handleMaterial) {
  const root = new THREE.Group()
  root.name = 'rider'
  const spin = new THREE.Group()
  const flip = new THREE.Group()
  flip.position.y = PIVOT
  const body = new THREE.Group()
  body.position.y = -PIVOT
  root.add(spin)
  spin.add(flip)
  flip.add(body)

  const m = {
    vest: mat(PALETTE.vest),
    vestDark: mat(PALETTE.vestDark),
    shorts: mat(PALETTE.shorts),
    skin: mat(PALETTE.skin, { flat: false, roughness: 0.85 }),
    helmet: mat(PALETTE.helmet, { flat: false, roughness: 0.4 }),
    visor: mat(PALETTE.visor, { roughness: 0.3 }),
    ski: mat(PALETTE.ski, { roughness: 0.35 }),
    dark: mat(PALETTE.binding, { roughness: 0.5 }),
  }

  // --- Ski ------------------------------------------------------------------
  const skis = new THREE.Group()
  const skiL = makeSki(m.ski, m.dark)
  const skiR = makeSki(m.ski, m.dark)
  skiL.position.set(-0.17, 0.03, 0)
  skiR.position.set(0.17, 0.03, 0)
  skis.add(skiL, skiR)
  body.add(skis)

  // --- Beine ------------------------------------------------------------------
  // Knie gebeugt, wie hinter dem Kabel ueblich. Beim Einfedern wird das
  // Beinpaar gestaucht und der Oberkoerper sinkt mit.
  const legs = new THREE.Group()
  for (const s of [-1, 1]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.46, 7), m.skin)
    shin.position.set(s * 0.17, 0.33, 0.05)
    shin.rotation.x = 0.28
    shin.castShadow = true
    legs.add(shin)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.4, 7), m.shorts)
    thigh.position.set(s * 0.15, 0.68, 0.03)
    thigh.rotation.x = -0.38
    thigh.castShadow = true
    legs.add(thigh)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), m.dark)
    boot.position.set(s * 0.17, 0.12, 0)
    legs.add(boot)
  }
  body.add(legs)

  // --- Oberkoerper ------------------------------------------------------------
  const torso = new THREE.Group()
  torso.position.set(0, 0.86, 0)
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.3, 3, 8), m.vest)
  vest.position.y = 0.28
  vest.castShadow = true
  torso.add(vest)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.24, 0.1, 9), m.vestDark)
  belt.position.y = 0.1
  torso.add(belt)
  for (const y of [0.3, 0.45]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.47), m.dark)
    strap.position.y = y
    torso.add(strap)
  }
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 8), m.shorts)
  hips.position.y = -0.02
  torso.add(hips)

  // Kopf mit Helm und Schirm.
  const head = new THREE.Group()
  head.position.set(0, 0.74, 0.02)
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), m.skin)
  face.castShadow = true
  head.add(face)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), m.helmet)
  helmet.position.y = 0.02
  helmet.castShadow = true
  head.add(helmet)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), m.helmet)
  visor.position.set(0, 0.04, 0.17)
  head.add(visor)
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04), m.visor)
  shades.position.set(0, 0.0, 0.14)
  head.add(shades)
  torso.add(head)

  // Arme: nach vorn gestreckt zur Hantel.
  const arms = {}
  for (const s of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(s * 0.25, 0.5, 0.02)
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 3, 6), m.skin)
    upper.position.set(-s * 0.02, -0.08, 0.16)
    upper.rotation.set(1.2, 0, s * 0.1)
    upper.castShadow = true
    arm.add(upper)
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 3, 6), m.skin)
    fore.position.set(-s * 0.07, -0.16, 0.42)
    fore.rotation.set(1.45, 0, s * 0.2)
    fore.castShadow = true
    arm.add(fore)
    torso.add(arm)
    arms[s < 0 ? 'left' : 'right'] = arm
  }

  // Hantel vor dem Bauch, beide Haende daran.
  const handle = new THREE.Mesh(handleGeometry, handleMaterial)
  handle.position.set(0, 0.32, 0.6)
  handle.castShadow = true
  torso.add(handle)
  // Wo das Seil angreift: Mitte der Hantel, etwas nach vorn.
  const ropePoint = new THREE.Object3D()
  ropePoint.position.set(0, 0.32, 0.64)
  torso.add(ropePoint)

  body.add(torso)

  root.userData.parts = { spin, flip, body, skis, skiL, skiR, legs, torso, head, arms, handle, ropePoint }
  return root
}

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)
const _v = new THREE.Vector3()

// Setzt Lage und Haltung nach dem Fahrmodell.
export function poseRider(model, rider, dt, elapsed) {
  const p = model.userData.parts
  const st = model.userData.state || (model.userData.state = { lean: 0, back: 0, crouch: 0, grab: 0, sink: 0, bob: 0 })

  model.position.set(rider.x, rider.y, rider.z)
  model.rotation.y = rider.heading
  p.spin.rotation.y = rider.spin
  p.flip.rotation.x = rider.flip

  // Kurvenlage aus dem Kantenwinkel und dem Tempo.
  const lean = rider.airborne ? 0 : THREE.MathUtils.clamp(-rider.edge * (rider.speed / 14), -0.6, 0.6)
  st.lean += (lean - st.lean) * damp(8, dt)
  // Am straffen Seil nach hinten lehnen.
  const back = rider.mode === 'dock' ? 0.05 : rider.airborne ? 0.1 : 0.2 + rider.taut * 0.25
  st.back += (back - st.back) * damp(6, dt)
  st.crouch += (rider.crouch - st.crouch) * damp(12, dt)
  st.grab += ((rider.grabbing ? 1 : 0) - st.grab) * damp(14, dt)
  const sinking = rider.mode === 'crash' ? 1 : 0
  st.sink += (sinking - st.sink) * damp(3, dt)

  p.body.rotation.z = st.lean
  const c = Math.max(st.crouch * 0.8, st.grab)
  p.legs.scale.y = 1 - c * 0.32
  p.torso.position.y = 0.86 - c * 0.28
  p.torso.rotation.x = -st.back + c * 0.45
  // Grab: der rechte Arm greift an den Ski.
  p.arms.right.rotation.x = st.grab * 1.3
  p.arms.right.rotation.z = -st.grab * 0.2

  // Wackeln auf dem Wasser, nur ein Hauch.
  const bob = rider.airborne ? 0 : Math.sin(elapsed * 9.3) * 0.012 * Math.min(1, rider.speed / 10)
  p.body.position.y = -PIVOT + bob

  // Sturz: der Fahrer kippt nach vorn und liegt im Wasser.
  if (st.sink > 0.01) {
    p.flip.rotation.x = rider.flip + st.sink * 1.3
    p.body.rotation.z = st.lean + st.sink * 0.4
  }
}

export function ropeAnchor(model, out = _v) {
  return model.userData.parts.ropePoint.getWorldPosition(out)
}
