import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Tiere des Tals: Schneehase, Alpenschneehuhn, Fuchs, Eichhoernchen,
// Alpendohle und Steinbock.
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

// --- Eichhoernchen --------------------------------------------------------------
// Rot mit cremeweissem Bauch und den Pinselohren des Winterfells. Von oben
// ist es ein rostroter Punkt auf dem verschneiten Dach – das reicht, wenn
// der buschige Schwanz dazukommt, der als Fragezeichen ueber dem Ruecken
// steht. Echt ist es zwanzig Zentimeter lang; hier fast doppelt so gross,
// sonst waere es aus 33 Metern ein einzelnes Pixel.
const HOERNCHEN = {
  rot: 0xb04a26,
  dunkel: 0x7e3419,
  creme: 0xf2e6d1,
  pinsel: 0x4f2414,
  auge: 0x140f0e,
}

export function createEichhoernchen() {
  const m = fell()
  const root = new THREE.Group()
  root.name = 'eichhoernchen'
  const koerper = new THREE.Group()
  koerper.scale.setScalar(1.9)
  root.add(koerper)

  // Wie beim Hasen dreht der Rumpf um die Huefte: aufrecht sitzen ist
  // dieselbe Drehung, die im Sprung streckt.
  const HUEFTE = [0, 0.07, -0.05]
  const rumpf = gelenk(koerper, HUEFTE, [
    { geo: ei(0.062, 0.06, 0.1), color: HOERNCHEN.rot, position: [0, 0.095, 0] },
    { geo: ei(0.045, 0.04, 0.075), color: HOERNCHEN.creme, position: [0, 0.07, 0.03] },
    { geo: ei(0.046, 0.052, 0.05), color: HOERNCHEN.creme, position: [0, 0.105, 0.08] },
    { geo: ei(0.04, 0.03, 0.08), color: HOERNCHEN.dunkel, position: [0, 0.135, -0.01] },
  ], m)

  const KOPF = [0, 0.13, 0.1]
  const kopf = unter(rumpf, HUEFTE, KOPF, [
    { geo: ei(0.047, 0.045, 0.055), color: HOERNCHEN.rot, position: [0, 0.155, 0.13] },
    { geo: ei(0.03, 0.026, 0.032), color: HOERNCHEN.creme, position: [0, 0.14, 0.175] },
    { geo: ei(0.009, 0.008, 0.007, 0), color: HOERNCHEN.auge, position: [0, 0.147, 0.205] },
    { geo: ei(0.012, 0.014, 0.01, 0), color: HOERNCHEN.auge, position: [0.036, 0.165, 0.155] },
    { geo: ei(0.012, 0.014, 0.01, 0), color: HOERNCHEN.auge, position: [-0.036, 0.165, 0.155] },
    // Ohren mit Pinseln: das, woran man ein Wintereichhoernchen erkennt.
    { geo: new THREE.ConeGeometry(0.015, 0.045, 4), color: HOERNCHEN.rot, position: [0.026, 0.205, 0.12] },
    { geo: new THREE.ConeGeometry(0.015, 0.045, 4), color: HOERNCHEN.rot, position: [-0.026, 0.205, 0.12] },
    { geo: ei(0.008, 0.026, 0.008, 0), color: HOERNCHEN.pinsel, position: [0.027, 0.24, 0.118] },
    { geo: ei(0.008, 0.026, 0.008, 0), color: HOERNCHEN.pinsel, position: [-0.027, 0.24, 0.118] },
  ], m)

  // Der Schwanz in zwei Gliedern: unten waagerecht nach hinten, oben der
  // Bogen ueber den Ruecken. Beide schlagen getrennt – das Zucken des
  // Schwanzes ist beim Eichhoernchen die halbe Sprache.
  const WURZEL = [0, 0.085, -0.095]
  const schwanz = unter(rumpf, HUEFTE, WURZEL, [
    { geo: ei(0.042, 0.042, 0.075), color: HOERNCHEN.rot, position: [0, 0.1, -0.155] },
  ], m)
  const BOGEN = [0, 0.12, -0.2]
  const spitze = unter(schwanz, WURZEL, BOGEN, [
    { geo: ei(0.058, 0.095, 0.058), color: HOERNCHEN.rot, position: [0, 0.21, -0.2] },
    { geo: ei(0.05, 0.05, 0.065), color: HOERNCHEN.dunkel, position: [0, 0.3, -0.15] },
  ], m)

  const hinten = [1, -1].map((s) => unter(rumpf, HUEFTE, [s * 0.045, 0.08, -0.04], [
    { geo: ei(0.035, 0.048, 0.055), color: HOERNCHEN.rot, position: [s * 0.048, 0.06, -0.035] },
    { geo: ei(0.018, 0.011, 0.048, 0), color: HOERNCHEN.dunkel, position: [s * 0.045, 0.011, 0.0] },
  ], m))
  const vorn = [1, -1].map((s) => unter(rumpf, HUEFTE, [s * 0.03, 0.08, 0.08], [
    { geo: ei(0.014, 0.04, 0.015), color: HOERNCHEN.rot, position: [s * 0.03, 0.045, 0.085] },
    { geo: ei(0.013, 0.009, 0.02, 0), color: HOERNCHEN.dunkel, position: [s * 0.03, 0.009, 0.092] },
  ], m))

  // Ein Zapfen zum Knabbern, zwischen den Vorderpfoten; nur im Sitzen da.
  const zapfen = new THREE.Mesh(assemble([
    { geo: ei(0.018, 0.03, 0.018, 0), color: 0x6b4426, position: [0, 0, 0] },
  ]), m)
  zapfen.position.set(0, 0.04, 0.17)
  zapfen.visible = false
  rumpf.add(zapfen)

  return { root, rumpf, kopf, schwanz, spitze, hinten, vorn, zapfen }
}

// --- Alpendohle -----------------------------------------------------------------
// Ganz schwarz, mit gelbem Schnabel und roten Beinen. Auf Schnee ist sie das
// Dunkelste im Bild und deshalb von weitem zu finden – anders als Hase und
// Huhn, die man suchen muss. Die Fluegel sind wie beim Schneehuhn zweimal
// eingehaengt: aussen das Anlegen, innen der Schlag.
const DOHLE = {
  schwarz: 0x1b1b21,
  glanz: 0x2a2b34,
  schnabel: 0xf0c52e,
  bein: 0xd23b2b,
}

export function createDohle() {
  const m = vertexColorMaterial({ roughness: 0.5 })
  const root = new THREE.Group()
  root.name = 'alpendohle'
  const koerper = new THREE.Group()
  koerper.scale.setScalar(1.5)
  root.add(koerper)

  const MITTE = [0, 0.12, 0]
  const rumpf = gelenk(koerper, MITTE, [
    { geo: ei(0.07, 0.072, 0.145), color: DOHLE.schwarz, position: [0, 0.14, 0] },
    { geo: ei(0.05, 0.03, 0.1), color: DOHLE.glanz, position: [0, 0.19, -0.02] },
  ], m)

  const kopf = unter(rumpf, MITTE, [0, 0.19, 0.1], [
    { geo: ei(0.052, 0.052, 0.058), color: DOHLE.schwarz, position: [0, 0.225, 0.14] },
    { geo: new THREE.ConeGeometry(0.016, 0.06, 5), color: DOHLE.schnabel, position: [0, 0.218, 0.215], rotation: [Math.PI / 2, 0, 0] },
  ], m)

  const schwanz = unter(rumpf, MITTE, [0, 0.15, -0.13], [
    { geo: ei(0.048, 0.012, 0.115), color: DOHLE.schwarz, position: [0, 0.15, -0.24] },
  ], m)

  // Rote Beine, ein Stueck vorgestellt – sie stehen aufrecht wie Kraehen.
  const beine = [1, -1].map((s) => unter(rumpf, MITTE, [s * 0.03, 0.08, 0.02], [
    { geo: new THREE.CylinderGeometry(0.007, 0.007, 0.08, 4), color: DOHLE.bein, position: [s * 0.03, 0.04, 0.02] },
    { geo: ei(0.014, 0.006, 0.03, 0), color: DOHLE.bein, position: [s * 0.03, 0.004, 0.035] },
  ], m))

  const fluegel = [1, -1].map((s) => {
    const anlegen = new THREE.Group()
    // Relativ zum Rumpfgelenk (0,12 hoch): an der Flanke, nicht obenauf –
    // bei 0,165 lagen die angelegten Fluegel 15 cm ueber dem Ruecken.
    anlegen.position.set(s * 0.06, 0.055, 0.03)
    rumpf.add(anlegen)
    // Lang und schmal, mit gespreizten Handschwingen an der Spitze: die
    // Dohle segelt mehr, als dass sie schlaegt.
    const schlag = gelenk(anlegen, [0, 0, 0], [
      { geo: ei(0.13, 0.014, 0.075), color: DOHLE.schwarz, position: [s * 0.12, 0, -0.02] },
      ...[0, 1, 2, 3].map((i) => ({
        geo: ei(0.07, 0.008, 0.018, 0), color: DOHLE.glanz,
        position: [s * (0.27 + i * 0.008), 0, 0.02 - i * 0.032], rotation: [0, -s * (0.1 + i * 0.12), 0],
      })),
    ], m)
    anlegen.userData.seite = s
    return { anlegen, schlag }
  })

  return { root, rumpf, kopf, schwanz, beine, fluegel }
}

// --- Steinbock ------------------------------------------------------------------
// Gedrungen und graubraun, mit dem dunklen Aalstrich und dem Kinnbart, und
// vor allem mit den Hoernern: zwei lange Boegen nach hinten, vorn mit
// Knoten besetzt. Sie sind das, was ihn aus jeder Entfernung zum Steinbock
// macht, deshalb kraeftiger als die Masse sonst. Er ist das einzige Tier
// ohne Uebergroesse – ein Bock ist ohnehin so lang wie der Fahrer.
const BOCK = {
  fell: 0x7b6b58,
  dunkel: 0x52463a,
  hell: 0xc9baa3,
  lauf: 0x463b31,
  huf: 0x26201c,
  horn: 0x8e7d63,
  knoten: 0xa2906f,
  auge: 0x16120f,
}

// Ein Horn als Kreisbogen in der Seitenebene (y, z): beginnt an der Stirn,
// steigt und laeuft nach hinten aus. `ab` ist der Startwinkel, `bogen` die
// Laenge in rad. Gibt die Teile so verschoben zurueck, dass der Anfang an
// `fuss` liegt.
function horn([fx, fy, fz], R, ab, bogen) {
  const teile = []
  const g = new THREE.TorusGeometry(R, 0.052, 5, 14, bogen)
  g.rotateZ(ab)
  g.rotateY(-Math.PI / 2)
  const by = R * Math.sin(ab)
  const bz = R * Math.cos(ab)
  teile.push({ geo: g, color: BOCK.horn, position: [fx, fy - by, fz - bz] })
  // Die Knoten sitzen auf der Vorderseite des Bogens, also aussen.
  for (let i = 1; i <= 6; i++) {
    const t = ab + bogen * (i / 7.5)
    const y = fy - by + (R + 0.03) * Math.sin(t)
    const z = fz - bz + (R + 0.03) * Math.cos(t)
    teile.push({ geo: ei(0.05, 0.022, 0.05, 0), color: BOCK.knoten, position: [fx, y, z], rotation: [Math.PI / 2 - t, 0, 0] })
  }
  return teile
}

export function createSteinbock() {
  const m = fell()
  const root = new THREE.Group()
  root.name = 'steinbock'

  const MITTE = [0, 0.62, 0]
  const rumpf = gelenk(root, MITTE, [
    { geo: ei(0.2, 0.23, 0.4), color: BOCK.fell, position: [0, 0.68, -0.02] },
    { geo: ei(0.18, 0.22, 0.19), color: BOCK.fell, position: [0, 0.74, 0.24] },
    { geo: ei(0.17, 0.2, 0.17), color: BOCK.fell, position: [0, 0.7, -0.29] },
    { geo: ei(0.15, 0.11, 0.3), color: BOCK.hell, position: [0, 0.55, 0] },
    // Aalstrich: der dunkle Streif auf dem Ruecken, von oben gut zu sehen.
    // 0,3 statt 0,42 lang: laenger stach er hinten als Stachel aus dem Rumpf.
    { geo: ei(0.055, 0.03, 0.3), color: BOCK.dunkel, position: [0, 0.895, -0.02] },
    { geo: ei(0.04, 0.05, 0.04, 0), color: BOCK.dunkel, position: [0, 0.78, -0.45] },
    // Hals, kraeftig und schraeg nach vorn oben.
    { geo: ei(0.11, 0.17, 0.12), color: BOCK.fell, position: [0, 0.86, 0.38], rotation: [-0.5, 0, 0] },
  ], m)

  const KOPF = [0, 0.98, 0.44]
  const kopf = unter(rumpf, MITTE, KOPF, [
    { geo: ei(0.085, 0.095, 0.15), color: BOCK.fell, position: [0, 1.0, 0.52], rotation: [0.45, 0, 0] },
    { geo: ei(0.06, 0.06, 0.07), color: BOCK.dunkel, position: [0, 0.935, 0.62] },
    { geo: ei(0.03, 0.022, 0.02, 0), color: BOCK.huf, position: [0, 0.94, 0.685] },
    // Der Bart unter dem Kinn.
    { geo: ei(0.032, 0.075, 0.032), color: BOCK.dunkel, position: [0, 0.85, 0.585] },
    { geo: ei(0.02, 0.022, 0.016, 0), color: BOCK.auge, position: [0.075, 1.03, 0.55] },
    { geo: ei(0.02, 0.022, 0.016, 0), color: BOCK.auge, position: [-0.075, 1.03, 0.55] },
    { geo: ei(0.07, 0.022, 0.03), color: BOCK.fell, position: [0.11, 1.08, 0.46], rotation: [0, 0, -0.5] },
    { geo: ei(0.07, 0.022, 0.03), color: BOCK.fell, position: [-0.11, 1.08, 0.46], rotation: [0, 0, 0.5] },
    // Steiler angesetzt (1,25 rad) und weiter (0,42): mit 1,05 und 0,36
    // lag das Horn als flacher Haken auf dem Kopf.
    ...horn([0.05, 1.09, 0.5], 0.42, 1.25, 1.9),
    ...horn([-0.05, 1.09, 0.5], 0.42, 1.25, 1.9),
  ], m)

  // Vier Laeufe, oben im Fellton, unten dunkel. 0/1 vorn, 2/3 hinten.
  const lauf = (x, z) => unter(rumpf, MITTE, [x, 0.6, z], [
    { geo: ei(0.065, 0.15, 0.08), color: BOCK.fell, position: [x, 0.5, z] },
    { geo: new THREE.CylinderGeometry(0.032, 0.038, 0.38, 5), color: BOCK.lauf, position: [x, 0.22, z] },
    { geo: ei(0.042, 0.03, 0.055, 0), color: BOCK.huf, position: [x, 0.025, z + 0.01] },
  ], m)
  const beine = [lauf(0.11, 0.26), lauf(-0.11, 0.26), lauf(0.12, -0.28), lauf(-0.12, -0.28)]

  return { root, rumpf, kopf, beine }
}
