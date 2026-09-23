import { LANDSCAPE_PATHS } from './landscape-layout.js'

// Vier Wege fuehren vom Startplateau weg. Jede Station liegt an genau einem
// davon, damit man einen Strang zu Ende fahren kann, ohne etwas zu verpassen.
export const TRAILS = {
  career: {
    label: 'CODE & PROFIL',
    color: '#346782',
    markerColor: 0x527f99,
    // Nach Osten am Wegweiser vorbei in die Mulde mit der Huette und weiter
    // bis zur Talstation des Zauberteppichs.
    path: [[7, 27], [14, 26], [20, 23], [26, 21], [31, 19]],
  },
  social: {
    label: 'KONTAKT & GIPFEL',
    color: '#935976',
    markerColor: 0xa16d87,
    // Nach Norden zum Telefon, dann nordwestlich zur Talstation des Lifts.
    // Die Reihe endet am freien Vorplatz; zum Gipfel geht es mit dem Lift.
    path: [[0, 20], [1, 8], [0, -2], [-9, -4], [-19, -4], [-29, -6], [-34, -4]],
  },
  // Vierter Weg: nach Nordosten ins Sportgelaende. Er endet nicht an einer
  // Station, sondern am Zielraum der Rennstrecke – das Ziel des Weges ist
  // das Gelaende selbst.
  sport: {
    label: 'PISTEN & PARK',
    color: '#a86738',
    markerColor: 0xbc8355,
    path: [[9, 22], [17, 11], [22, 0], [20, -14], [17, -26], [15, -38], [15, -48]],
  },
  tools: {
    label: 'TOOLS',
    color: '#477d68',
    markerColor: 0x62967e,
    // Nach Westen, an der Rohrpost, dem Felsdurchgang und der Stechuhr
    // vorbei. Er heisst nicht mehr WERKSTATT: die Werkstatt ist inzwischen ein
    // Haus im Osten, und zwei Dinge desselben Namens an verschiedenen Enden
    // des Tals sind einer zuviel.
    path: [[-8, 27], [-18, 25], [-28, 21], [-36, 14], [-44, 6], [-49, -4]],
  },
}

// Verbindungen machen aus den vier Armen eine Runde. Dieselben Mittellinien
// bestimmen Schneepraegung und Waldschneisen; ein sichtbarer Weg bleibt frei.
export const CONNECTIONS = [
  { path: [[-49, -4], [-42, -8], [-37, -6], [-34, -4]], width: 4.6 },
  { path: [[0, -2], [10, -2], [22, 0], [29, 9], [31, 19]], width: 4.6 },
  { path: [[-18, 25], [-25, 31], [-26, 38], [-21, 45], [-12, 45], [-7, 38]], width: 3.2 },
  { path: [[31, 19], [39, 24], [47, 23], [49, 21]], width: 2.4 },
  { path: [[-60, -55], [-61, -63], [-64, -69], [-64, -73]], width: 3.6 },
  { path: [[6, -65], [10, -60.4], [13, -55.2]], width: 4.6 },
]

export const VALLEY_PATHS = [
  ...Object.values(TRAILS).map(t => ({ path: t.path, width: 4.6 })),
  ...CONNECTIONS,
  ...LANDSCAPE_PATHS,
]

const segments = VALLEY_PATHS.flatMap(({ path, width }) => path.slice(1).map((b, i) => {
  const a = path[i]
  const dx = b[0] - a[0], dz = b[1] - a[1]
  return { x: a[0], z: a[1], dx, dz, len2: dx * dx + dz * dz, radius: width / 2 }
}))

// Weiche Raender statt aufgeklebter Strassen: die Praeparierung faerbt das
// vorhandene Terrain und veraendert weder Hoehe noch Fahrphysik.
export function pathPreparation(x, z) {
  let strength = 0
  for (const s of segments) {
    const t = Math.max(0, Math.min(1, ((x - s.x) * s.dx + (z - s.z) * s.dz) / s.len2))
    const d = Math.hypot(x - s.x - s.dx * t, z - s.z - s.dz * t)
    const fade = Math.max(0, Math.min(1, (s.radius + 1.3 - d) / 1.6))
    strength = Math.max(strength, fade * fade * (3 - 2 * fade))
  }
  return strength
}
