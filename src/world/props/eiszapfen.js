import * as THREE from 'three'
import { terrainHeight } from '../heightfield.js'

// Eiszapfen an der Traufe der Huette, die man abbrechen kann (Wunsch 04.10.).
// Wer an der Wand entlangfaehrt, streift sie: sie loesen sich, einer nimmt
// die Nachbarn mit, sie fallen und zerspringen im Schnee in Splitter, die
// noch ein Stueck rutschen und dann wegschmelzen. Wenn niemand hinschaut,
// wachsen sie nach.
//
// `punkte`: Weltlage der Oberkante je Zapfen mit seiner Laenge {x, y, z, l}.

const G = 9.8
const REICH = 0.95          // m waagerecht, ab hier streift der Fahrer ihn
const KOPF = 1.9            // so hoch reicht der Fahrer ueber den Boden
const NACHWACHSEN = 14      // s, dann wachsen sie wieder, wenn keiner nah ist
const SPLITTER_JE = 7
const SPLITTER_LEBEN = 1.6  // s

export function createEiszapfen(scene, punkte) {
  const zapfenGeo = new THREE.ConeGeometry(0.06, 1, 6)
  zapfenGeo.rotateX(Math.PI)
  zapfenGeo.translate(0, -0.5, 0)   // Ursprung an der Oberkante
  const material = new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88 })
  const zapfenMesh = new THREE.InstancedMesh(zapfenGeo, material, punkte.length)
  zapfenMesh.castShadow = true
  zapfenMesh.name = 'eiszapfen'
  scene.add(zapfenMesh)

  const splitterGeo = new THREE.TetrahedronGeometry(0.06, 0)
  const MAX = punkte.length * SPLITTER_JE
  const splitterMesh = new THREE.InstancedMesh(splitterGeo, material, MAX)
  splitterMesh.name = 'eissplitter'
  scene.add(splitterMesh)

  const zapfen = punkte.map((p) => ({ ...p, art: 'haengt', dy: 0, vy: 0, kipp: 0, zeit: 0, wuchs: 1, verzug: 0 }))
  const splitter = Array.from({ length: MAX }, () => ({ leben: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dreh: 0, w: 0, s: 1 }))
  let naechster = 0

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sk = new THREE.Vector3()
  const NULL = new THREE.Matrix4().makeScale(0, 0, 0)

  function zeichneZapfen() {
    zapfen.forEach((z, i) => {
      if (z.art === 'weg') { zapfenMesh.setMatrixAt(i, NULL); return }
      e.set(z.kipp, 0, z.kipp * 0.6)
      q.setFromEuler(e)
      m.compose(pos.set(z.x, z.y + z.dy, z.z), q, sk.set(1, z.l * z.wuchs, 1))
      zapfenMesh.setMatrixAt(i, m)
    })
    zapfenMesh.instanceMatrix.needsUpdate = true
  }
  function zeichneSplitter() {
    splitter.forEach((s, i) => {
      if (s.leben <= 0) { splitterMesh.setMatrixAt(i, NULL); return }
      e.set(s.dreh, s.dreh * 0.7, 0)
      q.setFromEuler(e)
      const k = s.s * Math.min(1, s.leben / 0.5)   // schmilzt am Ende weg
      m.compose(pos.set(s.x, s.y, s.z), q, sk.set(k, k, k))
      splitterMesh.setMatrixAt(i, m)
    })
    splitterMesh.instanceMatrix.needsUpdate = true
  }

  function zerspringen(z, boden) {
    for (let k = 0; k < SPLITTER_JE; k++) {
      const s = splitter[naechster]
      naechster = (naechster + 1) % MAX
      const a = Math.random() * Math.PI * 2
      const v = 0.8 + Math.random() * 2.2
      Object.assign(s, {
        leben: SPLITTER_LEBEN * (0.7 + Math.random() * 0.5),
        x: z.x, y: boden + 0.05, z: z.z,
        vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 1.2 + Math.random() * 2.2,
        dreh: Math.random() * 6, w: (Math.random() - 0.5) * 18,
        s: 0.6 + Math.random() * 0.9,
      })
    }
  }

  zeichneZapfen()
  zeichneSplitter()
  let splitterAktiv = false

  return {
    zapfen,
    update(dt, skier) {
      if (!skier || dt <= 0) return
      const p = skier.position
      let geaendert = false

      for (const z of zapfen) {
        if (z.art === 'haengt') {
          if (z.verzug > 0) {
            // Von einem Nachbarn mitgerissen: kurz danach los.
            z.verzug -= dt
            if (z.verzug <= 0) { z.art = 'faellt'; z.vy = 0 }
            continue
          }
          const nah = Math.hypot(p.x - z.x, p.z - z.z) < REICH
          if (nah && skier.speed > 1 && p.y + KOPF > z.y - z.l && p.y < z.y) {
            z.art = 'faellt'
            z.vy = 0
            // Die Nachbarn haengen am selben Eis: wer einen abbricht, nimmt
            // die naechsten mit, je weiter weg, desto spaeter.
            for (const n of zapfen) {
              const d = Math.hypot(n.x - z.x, n.z - z.z)
              if (n !== z && n.art === 'haengt' && n.verzug <= 0 && d < 0.9) n.verzug = 0.05 + d * 0.25
            }
            geaendert = true
          }
        } else if (z.art === 'faellt') {
          z.vy -= G * dt
          z.dy += z.vy * dt
          z.kipp += dt * 1.5
          const boden = terrainHeight(z.x, z.z)
          if (z.y + z.dy - z.l < boden) {
            zerspringen(z, boden)
            splitterAktiv = true
            z.art = 'weg'
            z.zeit = 0
          }
          geaendert = true
        } else if (z.art === 'weg') {
          z.zeit += dt
          if (z.zeit > NACHWACHSEN && Math.hypot(p.x - z.x, p.z - z.z) > 9) {
            z.art = 'waechst'
            z.dy = 0
            z.kipp = 0
            z.wuchs = 0
            geaendert = true
          }
        } else if (z.art === 'waechst') {
          z.wuchs = Math.min(1, z.wuchs + dt * 0.5)
          if (z.wuchs >= 1) z.art = 'haengt'
          geaendert = true
        }
      }
      if (geaendert) zeichneZapfen()

      if (splitterAktiv) {
        splitterAktiv = false
        for (const s of splitter) {
          if (s.leben <= 0) continue
          s.leben -= dt
          s.vy -= G * dt
          s.x += s.vx * dt
          s.y += s.vy * dt
          s.z += s.vz * dt
          s.dreh += s.w * dt
          const g = terrainHeight(s.x, s.z) + 0.03
          if (s.y < g) {
            // Aufschlag: kleiner zurueck, rutscht weiter, dreht langsamer.
            s.y = g
            s.vy = Math.abs(s.vy) > 1 ? -s.vy * 0.3 : 0
            const reib = Math.exp(-6 * dt)
            s.vx *= reib
            s.vz *= reib
            s.w *= reib
          }
          splitterAktiv = true
        }
        zeichneSplitter()
      }
    },
  }
}
