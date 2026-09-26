import * as THREE from 'three'
import { CAMERA } from '../config.js'
import { terrainHeight } from './heightfield.js'
import { TRAILS } from './paths.js'
import { createMarkerSign, springMount } from './props/signpost.js'
import { createMapBoard } from './props/map-board.js'
import { paintValleyMap, boardMap } from './valley-map.js'
import { createMarker } from '../stations/marker.js'
import { TOUCH } from '../core/device.js'

const INK = '#294842'

// Pfeile meinen die sichtbare Richtung. Die Tafeln selbst bleiben zur Kamera
// gedreht; vier unterschiedlich gedrehte Tafeln waren teilweise nur Kanten.
function arrow(x, z, target) {
  const dx = target[0] - x, dz = target[1] - z
  const right = (dx - dz) / Math.SQRT2
  const down = (dx + dz) / Math.SQRT2
  const sector = Math.round(Math.atan2(down, right) / (Math.PI / 4))
  return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(sector + 8) % 8]
}

export { arrow }

// Standort der Panoramatafel – der Fackelkranz laesst hier eine Luecke.
// 1,2 m im Bild nach rechts (Welt 0,707/−0,707) gegenueber (−8,5, 21,5): der
// Durchgang zwischen Tafel und TOOLS-Schild war zu schmal.
export const PANORAMA = { x: -7.65, z: 20.65 }

export function createWayfinding(world, { registry, trees = [], lift = null, skierRef = { current: null } } = {}) {
  const federn = []
  // Drei Entscheidungen statt Beschriftung an jedem Gegenstand. Die Tafeln
  // stehen seitlich; ihr Ziel ist immer ein vorhandener Weg oder dessen Ende.
  // GIPFELBAHN/TOOLS an der Talstation und HÜTTE/PARK an der Terrasse sind
  // weg: beide zeigten auf etwas, das man von dort schon sieht. ZUM SEE /
  // TOOLS · LIFT an der Rohrpost ebenso – See und Weg liegen dort im Bild.
  const junctions = [
    // side 1 fest: nach links gekehrt ragten die Tafeln ueber den
    // Kontaktposten und verdeckten ihn.
    { at: [6, -6], side: 1, rows: [['LIFT', [-9, -4], INK], ['WERKSTATT', [22, 0], TRAILS.career.color, '↓'], ['STARTPLATZ', [1, 8], INK]] },
    // Stand bei (33, 15) mitten im Kinderland neben dem Zauberteppich und
    // brach dort dessen Farben. Jetzt links unten am Karriereweg, noch vor
    // dem Kinderland – dort, wo man sich entscheidet.
    { at: [27.5, 23], rows: [['KONTAKT · LIFT', [29, 9], INK, '↑'], ['STARTPLATZ', [20, 23], INK]] },
    { at: [-67, -59], rows: [['AUSSICHT', [-61, -63], INK], ['TALABFAHRT', [-44, -52], TRAILS.sport.color]] },
  ]
  for (const { at: [x, z], rows, side } of junctions) {
    // Alle Tafeln an einem Mast ragen zur selben Seite – die, in die die
    // Mehrheit zeigt. Gemischt stand der Mast wie ein Kreuz im Schnee.
    // Ein fester Pfeil (vierter Eintrag) geht vor: gerechnet wird nur zum
    // Zielpunkt, der Weg dorthin biegt aber erst spaeter ab. Von der
    // Kontakt-Kreuzung fuehrt er zur Werkstatt zuerst gerade hangab, von der
    // Kinderland-Kreuzung zum Lift zuerst gerade hinauf – schraeg zeigten
    // die Pfeile ins Gelaende neben dem Weg.
    const pfeile = rows.map(([, target, , fest]) => fest ?? arrow(x, z, target))
    const links = side ? side < 0 : pfeile.filter((p) => '←↖↙'.includes(p)).length > rows.length / 2
    const sign = createMarkerSign(rows.map(([text, , background], i) => ({
      text, arrow: pfeile[i], background, width: 3.4, height: 0.66, side: links ? -1 : 1,
    })), { height: 2.8 })
    world.place(sign, x, z, { rotation: CAMERA.azimuth })
    federn.push(springMount(world, sign, x, z, CAMERA.azimuth))
  }

  // Die Panoramatafel am Platz: gemaltes Relief, und eine Station – Enter
  // oeffnet die Uebersicht (stations/map-menu.js). Sie stand bei (4, 24)
  // rechts im Platz zwischen den Wegweisern, wie abgestellt. Jetzt steht sie
  // am hinteren Rand, genau hinter dem Namen im Schnee: Tafel, Name,
  // Fahrer, Tasten liegen im Bild uebereinander wie eine Startaufstellung,
  // und die Tafel ist die Rueckwand des Platzes statt ein Hindernis darauf.
  const { x, z } = PANORAMA, yaw = CAMERA.azimuth
  const ground = terrainHeight(x, z)
  const postX = 4.4 / 2 - 0.35
  const fuss = [-1, 1].map((side) =>
    terrainHeight(x + Math.cos(yaw) * side * postX, z - Math.sin(yaw) * side * postX) - ground)
  const base = paintValleyMap({ trees, lift })
  const canvas = boardMap(base, {
    paper: ['#eef3f7', '#d7e2ec'],
    title: { text: 'JULIANS TAL', sub: TOUCH ? 'Antippen: Karte & Schnellreise' : '⏎  Karte & Schnellreise' },
    labels: [
      { x: 0, z: 30, text: 'Start', color: '#bc713e' },
      { x: -58, z: -64, text: 'Gipfel' },
      { x: -47, z: 41, text: 'See', color: '#4f8fa8' },
      { x: 20, z: -45, text: 'Funpark', color: TRAILS.sport.color },
      { x: 23, z: -64, text: 'Hütte', color: TRAILS.sport.color },
      { x: 25, z: 21, text: 'Werkstatt', color: TRAILS.career.color },
      { x: -34, z: 15, text: 'Tools', color: TRAILS.tools.color },
    ],
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const board = createMapBoard(texture, { fuss })
  world.place(board, x, z, { rotation: yaw })
  const tafel = board.userData.animate
  for (const side of [-1, 1]) {
    world.addCollider(x + Math.cos(yaw) * side * postX, z - Math.sin(yaw) * side * postX, 0.3)
  }
  world.addCollider(x, z, 1.0)

  if (registry) {
    const marker = createMarker(x, z, 6, '#346782')
    world.scene.add(marker)
    registry.add({
      id: 'talplan',
      label: 'Talkarte',
      hint: 'Schnellreise',
      color: '#346782',
      position: { x, z },
      radius: 6,
      labelHeight: ground + 3.4,
      groundY: ground,
      marker,
      // Das Grundbild der Karte, fuer die Uebersicht wiederverwendet.
      map: base,
    })
  }
  const animate = (t, dt) => {
    tafel(t)
    for (const f of federn) f(dt, skierRef.current)
  }
  return { animate }
}
