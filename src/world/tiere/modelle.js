import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die drei Tiere des Tals: Schneehase, Alpenschneehuhn, Fuchs.
//
// Gebaut wie alles hier – aus Primitiven, flach schattiert, Farbe in den
// Ecken. Anders als ein Baum bewegt sich aber jedes Glied einzeln, deshalb
// ist ein Tier kein einzelnes Mesh, sondern ein kleines Skelett aus Gruppen:
// jede Gruppe sitzt an ihrem Gelenk, und darin liegt ein verschmolzenes
// Teil. Ein Hase sind so neun Zeichenaufrufe, und es gibt hoechstens einen.
//
// Alle Masse in Metern, +z ist vorn, y = 0 der Boden unter den Pfoten.
// Die Tiere sind etwas groesser als in echt (Hase 0,6 statt 0,5 m Rumpf):
// aus 33 Metern ist ein echter Hase sieben Pixel lang, und im Spielzeugtal
// ist ohnehin alles etwas zu gross geraten, was man bemerken soll.

// Eiform aus einem Ikosaeder: die Facetten passen zum Wald und zu den
// Felsen, eine glatte Kugel saehe daneben aus wie Plastik.
function ei(rx, ry, rz, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  g.scale(rx, ry, rz)
  return g
}

// Gelenk mit Inhalt: eine Gruppe am Drehpunkt, darin die Teile relativ
// dazu. Teile liegen in Koordinaten des Tiers und werden hier verschoben,
// damit man beim Bauen in einem einzigen Koordinatensystem denken kann.
function gelenk(eltern, [px, py, pz], teile, material) {
  const g = new THREE.Group()
  g.position.set(px, py, pz)
  eltern.add(g)
  if (teile.length) {
    const mesh = new THREE.Mesh(
      assemble(teile.map((t) => ({ ...t, position: [t.position[0] - px, t.position[1] - py, t.position[2] - pz] }))),
      material,
    )
    mesh.castShadow = true
    g.add(mesh)
  }
  return g
}

// Gelenke unter einem Gelenk: dieselbe Rechnung, nur von dessen Ursprung
// aus. Die Weltlage des Elterngelenks wird mitgegeben, nicht abgefragt –
// gebaut wird vor dem ersten Bild, da sind noch keine Matrizen gerechnet.
function unter(eltern, ursprung, punkt, teile, material) {
  const rel = [punkt[0] - ursprung[0], punkt[1] - ursprung[1], punkt[2] - ursprung[2]]
  const verschoben = teile.map((t) => ({
    ...t, position: [t.position[0] - ursprung[0], t.position[1] - ursprung[1], t.position[2] - ursprung[2]],
  }))
  return gelenk(eltern, rel, verschoben, material)
}

// Nicht ganz matt: Fell glaenzt nicht, aber ganz ohne Glanzlicht wirkte
// der weisse Hase im Gegenlicht wie ein Schneeklumpen.
const fell = () => vertexColorMaterial({ roughness: 0.78 })

// --- Schneehase ---------------------------------------------------------------
// Winterfell: weiss mit schwarzen Ohrspitzen, wie beim echten Schneehasen.
// Der Ruecken ist eine Spur waermer als der Schnee (0xece6dc gegen 0xfdfcff);
// reines Weiss verschwand auf der Sonnenseite bis auf Augen und Ohrspitzen,
// und ein Tier, das man nicht sieht, ist kein Fund, sondern ein Geruecht.
const HASE = {
  fell: 0xf1ede6,
  ruecken: 0xe4dccf,
  bauch: 0xfbfaf7,
  spitze: 0x26252b,
  auge: 0x1b1517,
  nase: 0xc99494,
  innen: 0xe2c5c0,
}

export function createHase() {
  const m = fell()
  const root = new THREE.Group()
  root.name = 'schneehase'
  // Noch ein Fuenftel groesser: aus der festen Kamera waren es sonst zwoelf
  // Pixel, und ein weisser Fleck dieser Groesse ist auch ein Schneeball.
  const koerper = new THREE.Group()
  koerper.scale.setScalar(1.2)
  root.add(koerper)

  // Der Rumpf dreht um die Huefte: so wird aus derselben Drehung ein
  // Maennchen (Kopf hoch) und im Sprung das Strecken und Einrollen.
  const HUEFTE = [0, 0.15, -0.14]
  const rumpf = gelenk(koerper, HUEFTE, [
    { geo: ei(0.17, 0.165, 0.2), color: HASE.ruecken, position: [0, 0.21, -0.1] },
    { geo: ei(0.15, 0.13, 0.17), color: HASE.fell, position: [0, 0.18, -0.08] },
    { geo: ei(0.125, 0.145, 0.15), color: HASE.fell, position: [0, 0.24, 0.1] },
    { geo: ei(0.1, 0.1, 0.11), color: HASE.bauch, position: [0, 0.2, 0.16] },
    // Hals: ohne ihn sass der Kopf vorn auf der Brust wie bei einem Meerschweinchen.
    { geo: ei(0.08, 0.1, 0.08), color: HASE.fell, position: [0, 0.32, 0.16] },
    // Blume: der weisse Puschel, nach oben gestellt wie beim Hoppeln.
    { geo: ei(0.06, 0.065, 0.055, 0), color: 0xffffff, position: [0, 0.27, -0.3] },
  ], m)

  const KOPF = [0, 0.37, 0.19]
  const kopf = unter(rumpf, HUEFTE, KOPF, [
    { geo: ei(0.095, 0.092, 0.12), color: HASE.fell, position: [0, 0.44, 0.25] },
    // Backen und Schnauze: breiter als die Stirn, das macht das Gesicht.
    { geo: ei(0.075, 0.06, 0.07), color: HASE.bauch, position: [0, 0.405, 0.33] },
    { geo: ei(0.02, 0.016, 0.014, 0), color: HASE.nase, position: [0, 0.42, 0.395] },
    { geo: ei(0.026, 0.028, 0.022, 0), color: HASE.auge, position: [0.072, 0.46, 0.29] },
    { geo: ei(0.026, 0.028, 0.022, 0), color: HASE.auge, position: [-0.072, 0.46, 0.29] },
  ], m)

  // Ohren an der Stirn, je eine Gruppe – sie spielen getrennt.
  const ohren = [1, -1].map((s) => {
    const fuss = [s * 0.04, 0.51, 0.21]
    const ohr = unter(kopf, KOPF, fuss, [
      { geo: ei(0.038, 0.15, 0.02), color: HASE.fell, position: [s * 0.04, 0.65, 0.2] },
      { geo: ei(0.024, 0.11, 0.012), color: HASE.innen, position: [s * 0.04, 0.65, 0.214] },
      { geo: ei(0.032, 0.05, 0.022, 0), color: HASE.spitze, position: [s * 0.04, 0.765, 0.2] },
    ], m)
    ohr.userData.seite = s
    return ohr
  })

  // Hinterlaeufe: Keule und der lange Fuss, der flach im Schnee liegt.
  const hinten = [1, -1].map((s) => unter(rumpf, HUEFTE, [s * 0.12, 0.17, -0.1], [
    { geo: ei(0.07, 0.11, 0.13), color: HASE.ruecken, position: [s * 0.125, 0.16, -0.08] },
    { geo: ei(0.045, 0.03, 0.12, 0), color: HASE.fell, position: [s * 0.12, 0.025, 0.0] },
  ], m))

  // Vorderlaeufe: duenn, unter der Brust.
  const vorn = [1, -1].map((s) => unter(rumpf, HUEFTE, [s * 0.065, 0.21, 0.15], [
    { geo: ei(0.03, 0.1, 0.034), color: HASE.fell, position: [s * 0.065, 0.11, 0.16] },
    { geo: ei(0.032, 0.02, 0.045, 0), color: HASE.bauch, position: [s * 0.065, 0.018, 0.18] },
  ], m))

  return { root, rumpf, kopf, ohren, hinten, vorn }
}

// --- Alpenschneehuhn -----------------------------------------------------------
// Im Winter weiss bis auf den schwarzen Schwanz und den Zuegelstreif am Auge,
// darueber die rote Rose. Die Fluegel sind zweimal eingehaengt: aussen dreht
// das Anlegen (um y), innen der Schlag (um z) – in einer Eulerdrehung
// verdrehten sich beide, sobald der Fluegel angelegt war.
const HUHN = {
  weiss: 0xf5f3ee,
  schatten: 0xe6e4df,
  schwarz: 0x1f1e23,
  rose: 0xd6342c,
  schnabel: 0x2d2a2a,
}

export function createSchneehuhn() {
  const m = fell()
  const root = new THREE.Group()
  root.name = 'schneehuhn'

  const MITTE = [0, 0.17, 0]
  const rumpf = gelenk(root, MITTE, [
    { geo: ei(0.13, 0.12, 0.18), color: HUHN.weiss, position: [0, 0.17, 0] },
    { geo: ei(0.11, 0.08, 0.13), color: HUHN.schatten, position: [0, 0.11, 0.02] },
    // Befiederte Fuesse – im Schnee nur zwei weisse Polster.
    { geo: ei(0.04, 0.04, 0.05, 0), color: HUHN.weiss, position: [0.05, 0.03, 0.02] },
    { geo: ei(0.04, 0.04, 0.05, 0), color: HUHN.weiss, position: [-0.05, 0.03, 0.02] },
  ], m)

  const kopf = unter(rumpf, MITTE, [0, 0.26, 0.12], [
    { geo: ei(0.07, 0.068, 0.075), color: HUHN.weiss, position: [0, 0.31, 0.16] },
    { geo: new THREE.ConeGeometry(0.022, 0.05, 5), color: HUHN.schnabel, position: [0, 0.3, 0.245], rotation: [Math.PI / 2, 0, 0] },
    // Zuegel: schwarzer Streif vom Schnabel durchs Auge, darueber die Rose.
    { geo: ei(0.012, 0.016, 0.04, 0), color: HUHN.schwarz, position: [0.058, 0.315, 0.19] },
    { geo: ei(0.012, 0.016, 0.04, 0), color: HUHN.schwarz, position: [-0.058, 0.315, 0.19] },
    { geo: ei(0.014, 0.012, 0.03, 0), color: HUHN.rose, position: [0.05, 0.345, 0.18] },
    { geo: ei(0.014, 0.012, 0.03, 0), color: HUHN.rose, position: [-0.05, 0.345, 0.18] },
  ], m)

  const schwanz = unter(rumpf, MITTE, [0, 0.2, -0.15], [
    { geo: ei(0.075, 0.016, 0.08), color: HUHN.schwarz, position: [0, 0.2, -0.22] },
  ], m)

  const fluegel = [1, -1].map((s) => {
    const anlegen = new THREE.Group()
    anlegen.position.set(s * 0.1, 0.06, 0.04)
    rumpf.add(anlegen)
    // Lokal im Fluegel: Spannweite entlang ±x, Hinterkante nach -z.
    const schlag = gelenk(anlegen, [0, 0, 0], [
      { geo: ei(0.17, 0.022, 0.1), color: HUHN.weiss, position: [s * 0.15, 0, -0.03] },
      { geo: ei(0.08, 0.02, 0.05, 0), color: HUHN.schatten, position: [s * 0.05, -0.01, 0.0] },
    ], m)
    anlegen.userData.seite = s
    return { anlegen, schlag }
  })

  return { root, rumpf, kopf, schwanz, fluegel }
}

// --- Fuchs ---------------------------------------------------------------------
// Das einzige kraeftig gefaerbte Tier: Rostrot auf Weiss liest man aus jeder
// Entfernung. Schwarze Laeufe und Ohrruecken, weisse Kehle und Lunte.
const FUCHS = {
  rot: 0xcf6228,
  rotDunkel: 0xbb5723,
  weiss: 0xf3ede4,
  dunkel: 0x332520,
  nase: 0x161212,
}

export function createFuchs() {
  const m = fell()
  const root = new THREE.Group()
  root.name = 'fuchs'

  const MITTE = [0, 0.4, 0]
  const rumpf = gelenk(root, MITTE, [
    { geo: ei(0.115, 0.12, 0.3), color: FUCHS.rot, position: [0, 0.43, -0.02] },
    { geo: ei(0.1, 0.09, 0.17), color: FUCHS.rotDunkel, position: [0, 0.48, -0.08] },
    { geo: ei(0.095, 0.11, 0.13), color: FUCHS.weiss, position: [0, 0.41, 0.19] },
    // Hals: der Kopf sitzt ueber dem Ruecken, nicht davor – sonst las sich
    // der Fuchs von der Seite wie ein Hund mit gesenktem Kopf.
    { geo: ei(0.08, 0.12, 0.09), color: FUCHS.rot, position: [0, 0.52, 0.25] },
  ], m)

  const KOPF = [0, 0.58, 0.3]
  const kopf = unter(rumpf, MITTE, KOPF, [
    { geo: ei(0.095, 0.085, 0.095), color: FUCHS.rot, position: [0, 0.62, 0.35] },
    { geo: ei(0.085, 0.05, 0.075), color: FUCHS.weiss, position: [0, 0.585, 0.4] },
    { geo: new THREE.ConeGeometry(0.048, 0.18, 6), color: FUCHS.rot, position: [0, 0.6, 0.48], rotation: [Math.PI / 2, 0, 0] },
    { geo: ei(0.022, 0.02, 0.022, 0), color: FUCHS.nase, position: [0, 0.6, 0.57] },
    { geo: ei(0.017, 0.016, 0.014, 0), color: FUCHS.nase, position: [0.052, 0.65, 0.425] },
    { geo: ei(0.017, 0.016, 0.014, 0), color: FUCHS.nase, position: [-0.052, 0.65, 0.425] },
  ], m)

  const ohren = [1, -1].map((s) => {
    const fuss = [s * 0.055, 0.68, 0.33]
    const ohr = unter(kopf, KOPF, fuss, [
      { geo: new THREE.ConeGeometry(0.052, 0.14, 4), color: FUCHS.rot, position: [s * 0.055, 0.75, 0.33], rotation: [0, Math.PI / 4, 0] },
      { geo: new THREE.ConeGeometry(0.03, 0.06, 4), color: FUCHS.dunkel, position: [s * 0.055, 0.8, 0.322], rotation: [0, Math.PI / 4, 0] },
    ], m)
    ohr.userData.seite = s
    return ohr
  })

  // Vier Laeufe: oben rot, unten schwarz. Index 0/1 vorn links/rechts,
  // 2/3 hinten links/rechts – der Trab braucht die Diagonalen.
  const lauf = (x, z) => unter(rumpf, MITTE, [x, 0.36, z], [
    { geo: ei(0.04, 0.09, 0.055), color: FUCHS.rot, position: [x, 0.31, z] },
    { geo: new THREE.CylinderGeometry(0.022, 0.026, 0.2, 5), color: FUCHS.dunkel, position: [x, 0.13, z] },
    { geo: ei(0.03, 0.02, 0.045, 0), color: FUCHS.dunkel, position: [x, 0.02, z + 0.02] },
  ], m)
  const beine = [lauf(0.075, 0.2), lauf(-0.075, 0.2), lauf(0.08, -0.2), lauf(-0.08, -0.2)]

  // Die Lunte ist fast so lang wie der Rumpf und das, woran man einen Fuchs
  // von oben ueberhaupt erkennt.
  const schwanz = unter(rumpf, MITTE, [0, 0.45, -0.28], [
    { geo: ei(0.085, 0.085, 0.24), color: FUCHS.rot, position: [0, 0.45, -0.5] },
    { geo: ei(0.065, 0.065, 0.085), color: FUCHS.weiss, position: [0, 0.45, -0.73] },
  ], m)

  return { root, rumpf, kopf, ohren, beine, schwanz }
}
