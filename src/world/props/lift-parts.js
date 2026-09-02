import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Die Bauteile des Schlepplifts. Getrennt von der Mechanik, damit die
// Geometrie fuer sich lesbar bleibt.

export const LIFT_COLORS = {
  steel: 0x8a929b,
  steelDark: 0x5a626b,
  paint: 0xd94b3f,
  paintDark: 0xa8362d,
  concrete: 0x9aa0a8,
  rubber: 0x2b3036,
  cable: 0x6d757e,
  wood: 0x7b5236,
  snow: 0xf7fbff,
  glass: 0x9fc4d8,
}

const C = LIFT_COLORS

// Ein Gittermast mit Rollenbatterie am Ausleger. Rollen tragen das Seil, der
// Ausleger haelt sie neben dem Mast – wie bei einem echten Schlepplift.
export function createLiftPylon({ height = 5.2, rollers = 5 } = {}) {
  const parts = []

  // Fundament
  parts.push({ geo: new THREE.BoxGeometry(1.1, 0.5, 1.1), color: C.concrete, position: [0, 0.15, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.12, 0.9), color: C.steelDark, position: [0, 0.44, 0] })

  // Mastrohr, nach oben leicht verjuengt
  parts.push({
    geo: new THREE.CylinderGeometry(0.15, 0.22, height, 10),
    color: C.steel,
    position: [0, height / 2 + 0.4, 0],
  })
  // Zwei Ringverstaerkungen
  for (const rel of [0.35, 0.72]) {
    parts.push({
      geo: new THREE.TorusGeometry(0.19, 0.035, 5, 12),
      color: C.steelDark,
      position: [0, 0.4 + height * rel, 0],
      rotation: [Math.PI / 2, 0, 0],
    })
  }

  const top = height + 0.4

  // Traverse: ein Querträger mit Rollenbatterie an beiden Enden, weil hier
  // zwei Seile laufen – das Aufwaerts- und das Abwaertstrum.
  const armLen = 1.05
  parts.push({
    geo: new THREE.BoxGeometry(armLen * 2 + 0.3, 0.15, 0.17),
    color: C.steel,
    position: [0, top - 0.12, 0],
  })
  // Kopfplatte und zwei Diagonalen
  parts.push({ geo: new THREE.BoxGeometry(0.34, 0.12, 0.3), color: C.steelDark, position: [0, top - 0.02, 0] })
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.95, 0.08, 0.1),
      color: C.steelDark,
      position: [sx * 0.42, top - 0.54, 0],
      rotation: [0, 0, sx * 0.75],
    })
  }

  for (const sx of [-1, 1]) {
    const beamX = sx * armLen
    parts.push({
      geo: new THREE.BoxGeometry(0.11, 0.11, rollers * 0.3 + 0.2),
      color: C.steelDark,
      position: [beamX, top - 0.3, 0],
    })
    for (let i = 0; i < rollers; i++) {
      const z = (i - (rollers - 1) / 2) * 0.3
      parts.push({
        geo: new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10),
        color: C.rubber,
        position: [beamX, top - 0.44, z],
        rotation: [Math.PI / 2, 0, 0],
      })
      parts.push({
        geo: new THREE.CylinderGeometry(0.05, 0.05, 0.11, 6),
        color: C.steel,
        position: [beamX, top - 0.44, z],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }

  // Schneehaube auf dem Mastkopf
  parts.push({
    geo: new THREE.CylinderGeometry(0.17, 0.14, 0.09, 10),
    color: C.snow,
    position: [0, top + 0.05, 0],
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.5, metalness: 0.35 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.cableHeight = top - 0.44
  mesh.userData.armLength = armLen
  return mesh
}

// Antriebsstation im Tal: Portal aus vier Stuetzen, liegendes Bullrad,
// Motorhaus, Fuehrungsgelaender fuer den Einstieg.
export function createLiftBaseStation({ label = 'BERGBAHN', wheelRadius = 1.5 } = {}) {
  const group = new THREE.Group()
  const parts = []

  const H = 4.2
  const W = 2.9
  const D = 3.4

  // Betonplatte
  parts.push({ geo: new THREE.BoxGeometry(W + 1.4, 0.34, D + 1.6), color: C.concrete, position: [0, 0.1, 0] })

  // Vier Stuetzen, oben nach innen geneigt
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.13, 0.17, H, 8),
        color: C.steel,
        position: [sx * (W / 2 - 0.18), H / 2 + 0.24, sz * (D / 2 - 0.2)],
        rotation: [sz * 0.05, 0, sx * -0.05],
      })
    }
  }
  // Querverstrebungen
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(W, 0.12, 0.12), color: C.steelDark, position: [0, H * 0.55, sz * (D / 2 - 0.2)] })
    parts.push({
      geo: new THREE.BoxGeometry(W * 1.1, 0.08, 0.08),
      color: C.steelDark,
      position: [0, H * 0.35, sz * (D / 2 - 0.2)],
      rotation: [0, 0, 0.16],
    })
  }
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.12, 0.12, D), color: C.steelDark, position: [sx * (W / 2 - 0.18), H * 0.55, 0] })
  }

  // Kopfrahmen, auf dem das Bullrad sitzt
  parts.push({ geo: new THREE.BoxGeometry(W + 0.3, 0.2, D + 0.2), color: C.steel, position: [0, H + 0.34, 0] })

  // Bullrad: liegende Scheibe mit Speichen und Seilrille
  const wheelY = H + 0.62
  parts.push({ geo: new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.18, 24), color: C.paint, position: [0, wheelY, 0] })
  parts.push({
    geo: new THREE.CylinderGeometry(wheelRadius + 0.09, wheelRadius + 0.09, 0.1, 24),
    color: C.rubber,
    position: [0, wheelY, 0],
  })
  parts.push({ geo: new THREE.CylinderGeometry(wheelRadius * 0.78, wheelRadius * 0.78, 0.22, 20), color: C.paintDark, position: [0, wheelY, 0] })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    parts.push({
      geo: new THREE.BoxGeometry(wheelRadius * 1.5, 0.09, 0.14),
      color: C.steelDark,
      position: [0, wheelY + 0.08, 0],
      rotation: [0, a, 0],
    })
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.24, 0.24, 0.7, 12), color: C.steel, position: [0, wheelY - 0.2, 0] })

  // Motorhaus an der Seite
  parts.push({ geo: new THREE.BoxGeometry(1.5, 1.5, 1.7), color: C.paint, position: [-(W / 2 + 0.85), 1.0, -0.4] })
  parts.push({ geo: new THREE.BoxGeometry(1.6, 0.14, 1.8), color: C.steelDark, position: [-(W / 2 + 0.85), 1.8, -0.4] })
  parts.push({ geo: new THREE.BoxGeometry(1.6, 0.12, 1.8), color: C.snow, position: [-(W / 2 + 0.85), 1.9, -0.4] })
  // Lueftungsgitter
  for (let i = 0; i < 4; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(1.1, 0.06, 0.04),
      color: C.steelDark,
      position: [-(W / 2 + 0.85), 0.7 + i * 0.17, 0.47],
    })
  }

  // Fuehrungsgelaender: leitet die Wartenden zum Einstieg.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = D / 2 + 0.6 + i * 1.15
      parts.push({
        geo: new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6),
        color: C.steel,
        position: [sx * 1.0, 0.5, z],
      })
      if (i < 4) {
        parts.push({
          geo: new THREE.BoxGeometry(0.06, 0.06, 1.15),
          color: C.steelDark,
          position: [sx * 1.0, 0.92, z + 0.58],
        })
      }
    }
  }

  // Einstiegsschwelle aus Holz, in den Schnee gelegt
  parts.push({ geo: new THREE.BoxGeometry(2.3, 0.12, 0.5), color: C.wood, position: [0, 0.28, D / 2 + 0.35] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.52, metalness: 0.3 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Beschriftetes Stationsschild, zur Kamera geneigt
  const tex = labelTexture(label, {
    width: 640, height: 170,
    background: '#a8362d', color: '#fdf6f2',
    font: '700 92px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.62, 0.08),
    [
      new THREE.MeshStandardMaterial({ color: C.paintDark, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: C.paintDark, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: C.paintDark, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: C.paintDark, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: C.paintDark, roughness: 0.55 }),
    ],
  )
  sign.position.set(0, H * 0.62, D / 2 + 0.22)
  sign.rotation.x = -0.42
  sign.castShadow = true
  group.add(sign)

  group.userData.wheelY = wheelY
  group.userData.wheelRadius = wheelRadius
  return group
}

// Umlenkstation am Berg: schlanker, mit Ausstiegsrampe und Warnschild.
export function createLiftTopStation({ wheelRadius = 1.3 } = {}) {
  const group = new THREE.Group()
  const parts = []

  const H = 4.0
  const W = 2.4
  const D = 2.6

  parts.push({ geo: new THREE.BoxGeometry(W + 1.0, 0.3, D + 1.0), color: C.concrete, position: [0, 0.09, 0] })

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.12, 0.15, H, 8),
        color: C.steel,
        position: [sx * (W / 2 - 0.15), H / 2 + 0.22, sz * (D / 2 - 0.18)],
      })
    }
  }
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(W, 0.1, 0.1), color: C.steelDark, position: [0, H * 0.6, sz * (D / 2 - 0.18)] })
  }
  parts.push({ geo: new THREE.BoxGeometry(W + 0.25, 0.18, D + 0.18), color: C.steel, position: [0, H + 0.3, 0] })

  // Umlenkscheibe – kein Antrieb, deshalb schlichter als unten.
  const wheelY = H + 0.56
  parts.push({ geo: new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.16, 22), color: C.paint, position: [0, wheelY, 0] })
  parts.push({
    geo: new THREE.CylinderGeometry(wheelRadius + 0.08, wheelRadius + 0.08, 0.09, 22),
    color: C.rubber,
    position: [0, wheelY, 0],
  })
  for (let i = 0; i < 5; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(wheelRadius * 1.5, 0.08, 0.12),
      color: C.steelDark,
      position: [0, wheelY + 0.06, 0],
      rotation: [0, (i / 5) * Math.PI * 2, 0],
    })
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10), color: C.steel, position: [0, wheelY - 0.18, 0] })

  // Spanngewicht am Mast – typisch fuer die Bergstation eines Schlepplifts.
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.9, 0.5), color: C.steelDark, position: [0, 1.2, -(D / 2 + 0.5)] })
  parts.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), color: C.cable, position: [0, 2.6, -(D / 2 + 0.5)] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.52, metalness: 0.3 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Warnschild "Buegel loslassen" – gelbes Dreieck auf einem Pfosten.
  const tex = labelTexture('LOSLASSEN', {
    width: 512, height: 150,
    background: '#f2c33d', color: '#24282e',
    font: '700 84px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const warn = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.46, 0.07),
    [
      new THREE.MeshStandardMaterial({ color: 0xd39f24, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xd39f24, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xd39f24, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xd39f24, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0xd39f24, roughness: 0.55 }),
    ],
  )
  warn.position.set(0, 2.1, D / 2 + 0.5)
  warn.rotation.x = -0.45
  group.add(warn)

  group.userData.wheelY = wheelY
  group.userData.wheelRadius = wheelRadius
  return group
}

// Der Teller am Seil: Gehaenge, Zugstange, Teller. Der Ursprung liegt oben am
// Seil, der Teller genau PLATTER_LENGTH darunter – so laesst sich die Instanz
// spaeter einfach zwischen Seil und Fahrer spannen.
export const PLATTER_LENGTH = 4.3

export function createLiftPlatterGeometry() {
  const parts = []
  // Gehaenge am Seil
  parts.push({ geo: new THREE.BoxGeometry(0.17, 0.22, 0.13), color: C.steelDark, position: [0, -0.11, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.26, 6), color: C.steel, position: [0, -0.32, 0] })

  // Zugstange bis kurz ueber den Teller
  const rodLength = PLATTER_LENGTH - 0.75
  parts.push({
    geo: new THREE.CylinderGeometry(0.03, 0.03, rodLength, 6),
    color: C.steel,
    position: [0, -0.45 - rodLength / 2, 0],
  })

  // Teller
  parts.push({
    geo: new THREE.CylinderGeometry(0.27, 0.31, 0.07, 14),
    color: C.paint,
    position: [0, -PLATTER_LENGTH, 0],
  })
  parts.push({
    geo: new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8),
    color: C.rubber,
    position: [0, -PLATTER_LENGTH + 0.09, 0],
  })
  return assemble(parts)
}
