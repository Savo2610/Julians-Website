import { LINKS } from './links.js'
import { createMarker } from './marker.js'
import { createContactPost } from '../world/props/contact-post.js'
import { createUploadPipe } from '../world/props/upload-pipe.js'
import { createCabin } from '../world/props/cabin.js'
import { createDrone } from '../world/props/drone.js'
import { createFireTruck } from '../world/props/firetruck.js'
import { createShortcutTunnel } from '../world/props/shortcut-tunnel.js'
import { createGearDepot } from '../world/props/gear-depot.js'
import { createWorkbench } from '../world/props/workbench.js'
import { createTicketBooth } from '../world/props/ticket-booth.js'
import { createTimeClock } from '../world/props/time-clock.js'
import { createGipfelbuch } from '../world/props/gipfelbuch.js'
import { CAMERA } from '../config.js'
import { TOUCH } from '../core/device.js'
import { findFlatSpot } from '../world/heightfield.js'
import { ticket, seeTicket } from './ticket.js'

// Die Kamera blickt immer aus derselben Richtung. Objekte mit einer
// Schauseite muessen ihr also zugewandt sein, sonst liest man Schilder von
// hinten und Tueren zeigen ins Nichts.
const FACING = CAMERA.azimuth

// Wo im Tal was steht. Die Koordinaten sind handgesetzt: jede Station soll auf
// einer eigenen Lichtung stehen und von der vorigen aus sichtbar sein, damit
// man von selbst weiterfaehrt.

import { TRAILS } from '../world/paths.js'
export { TRAILS } from '../world/paths.js'

export const STATION_SPOTS = {
  // Weg 1 – beruflich
  // Kleiner Suchradius: seit das Kinderland-Band daneben liegt, waere der
  // Uebungshang die flachste Stelle der Gegend – die Huette wuerde mitten in
  // den Slalom wandern.
  // In der Huette liegen beide beruflichen Adressen: der Quelltext und das
  // Profil. Es gab dafuer einmal eine eigene Tafel daneben, dann eine vor der
  // Tuer – beides blieb ein zweites Schild fuer denselben Menschen am selben
  // Ort. Zwei Zeilen auf der Karte der Huette sagen dasselbe und stehen
  // niemandem im Weg.
  //
  // Sie stand bei (25, 21) neben dem Zauberteppich, 25 Meter vom Start und
  // am Bildrand – gerade die Station, die Firmen suchen, war die
  // versteckteste. Bei (15, 21) stand sie dann mitten in der Abfahrt vom
  // Plateau. Jetzt steht sie gut 20 Meter vom Start hangab, wo vorher der
  // Baumhuegel war (der ist nach links gerueckt), sichtbar vom Wegweiser aus
  // und nicht mehr im Weg. Der Weg fuehrt vorn an der Werkbank vorbei. Die
  // Lichtung ist kleiner (9 statt 13), sonst raeumte sie den Hang leer.
  cabin:     { x: 22, z: 28, clearing: 9, footprint: 3.4, search: 1.5, trail: 'career' },

  // Weg 2 – Soziales und Bezahlen
  // Signal und Instagram teilen sich den Kontaktposten am Waldrand, dort, wo
  // der Weg nach Westen abknickt – siehe props/contact-post.js. Vorher stand
  // hier nur das Telefon, und das Fernrohr fuer Instagram hinter dem Gipfel.
  // Ein paar Meter nach Norden geschoben, damit die Tannen dahinter die
  // Kulisse sind; die Lichtung ist mit 4,5 Metern kleiner als vorher (7),
  // sonst waeren genau die weggeraeumt worden.
  kontakt:   { x: 2, z: -3.5, clearing: 4.5, footprint: 3.0, search: 2, trail: 'social' },
  // Die Skikasse steht auf dem Weg vom Materialdepot zur Talstation – man
  // kommt daran vorbei, bevor man in den Lift steigt.
  ticket:    { x: -40, z: -2, clearing: 9, footprint: 2.4, search: 2.5, trail: 'social' },

  // Weg 3 – Werkzeuge
  // Die Stechuhr stand am Anfang des Weges und war damit das Erste, was man
  // von den Werkzeugen sah – das langweiligste zuerst. Jetzt steht sie
  // hinter der Abkuerzung am linken Rand, an der Waldkante zum See hin,
  // gut drei Meter neben dem Weg: wer ihn zu Ende faehrt, sieht sie, aber
  // sie draengt sich nicht vor Rohrpost und Abkuerzung. Die Lichtung ist
  // mit drei Metern klein, damit die Baeume dahinter stehen bleiben – sie
  // sind der Rand, an dem sie lehnt. Gefaelle dort 0,07.
  clock:     { x: -41, z: 13, clearing: 3, footprint: 1.4, search: 1, trail: 'tools' },
  pipe:      { x: -19, z: 25, clearing: 8, footprint: 1.4, search: 6, trail: 'tools' },
  tunnel:    { x: -34, z: 15, clearing: 9, footprint: 2.0, search: 6, trail: 'tools' },
  depot:     { x: -48, z: 0, clearing: 8, footprint: 2.0, search: 7, trail: 'tools' },

  // Abseits der Wege – nur wer stoebert, findet sie.
  //
  // Die beiden haben die Plaetze getauscht. Das ist nicht nur eine andere
  // Adresse: die Waldtasche noerdlich hinter dem Startplateau ist ein Ort mit
  // Zufahrt, und ein Fahrzeug, das irgendwo steht, will erklaeren koennen,
  // wie es dorthin gekommen ist – seine Lichtung ist gross genug, dass sie
  // als Wendeplatz durchgeht. Die Drohne dagegen ist abgestuerzt; ihr steht
  // die freie Terrasse ueber dem Kinderland besser, weil ein Absturz von
  // oben kommt. Die Lichtungs- und Fussmasse sind bei den Objekten geblieben
  // und nicht bei den Koordinaten: der Loeschzug braucht seine ebenen zehn
  // Meter, die Drohne haette sich damit ihr Versteck selbst weggeraeumt.
  drone:     { x: 51, z: 20, clearing: 4, footprint: 1.2, search: 2, trail: null },
  // Der Loeschzug stand auf zehn Metern Lichtung allein im Schnee und war
  // damit das Gegenteil eines Fundstuecks. Die Lichtung ist jetzt 4,5 Meter,
  // und hinten und an den Seiten stehen eigene Baumgruppen (GROVES in
  // landscape-layout.js) – nach vorn zur Kamera bleibt er sichtbar.
  firetruck: { x: -15, z: 43, clearing: 4.5, footprint: 3.2, search: 4, trail: null },
  // Das Gipfelbuch auf dem Ruecken links neben dem Startbogen der
  // Nordabfahrt, gut zehn Meter vom Tor und zwei Meter unter ihm: man sieht
  // es, wenn man oben steht und sich umschaut, nicht schon aus dem Lift.
  gipfelbuch: { x: -66.5, z: -79, clearing: 3.5, footprint: 2.0, search: 2, trail: null },
}

// Abstand der Werkbank vor der Huettenmitte, zur Kamera hin. Die Huette ist
// 2,4 tief und hat einen Kollisionskreis von 2,1; bei 3,4 bleibt ein knapper
// Meter Luft zwischen Bank und Wand – eng genug, dass beide zusammengehoeren.
const BENCH_AHEAD = 3.4

// Die drei Fenster (Solana, Briefkasten, Kurzlink) werden erst geladen, wenn
// jemand die zugehoerige Station benutzt. Zusammen sind sie 35 Kilobyte, und
// die allermeisten Besucher fahren einfach Ski. Die Tastaturbedienung liegt
// obendrauf, siehe dialogs/keyboard.js.
const fenster = (laden, id) => () => Promise.all([laden(), import('../dialogs/keyboard.js')])
  .then(([m, k]) => { m.oeffnen(); k.mitTastatur(id) })
const walletDialog = fenster(() => import('../dialogs/wallet.js'), 'sol-dialog')
const uploadDialog = fenster(() => import('../dialogs/upload.js'), 'up-dialog')
const kurzDialog = fenster(() => import('../dialogs/kurz.js'), 'kz-dialog')

// Am Handy oeffnet Solana wie frueher auf der Kachelseite direkt die
// Wallet-App: der solana:-Link ist dort die Uebergabe an die App, und ein
// Dialog, der nach einer Browser-Erweiterung sucht, findet am Handy keine. Geht keine App auf
// – weil keine installiert ist –, bleibt die Seite sichtbar, und nach 1,6 s
// kommt doch der Dialog mit seinem Hinweis. Nur die Sichtbarkeit zaehlt,
// nicht 'blur': Safari nimmt den Fokus auch fuer seinen eigenen Hinweis
// "Adresse ungueltig", und genau dann soll der Dialog kommen.
function solanaApp() {
  let weg = false
  const merken = () => { weg = true }
  addEventListener('pagehide', merken, { once: true })
  addEventListener('visibilitychange', merken, { once: true })
  location.href = LINKS.solana
  setTimeout(() => {
    removeEventListener('pagehide', merken)
    removeEventListener('visibilitychange', merken)
    if (!weg && document.visibilityState === 'visible') walletDialog()
  }, 1600)
}

// Der Loeschzug faehrt aus dem Tal hinaus und in der Lernwerkstatt wieder
// ein: dort startet jf.veerka.mp mit ?einfahrt=1 und laesst das Fahrzeug
// vor der Wache ausrollen. Hier faehrt es an, und eine Blende schliesst in
// der Farbe, in der die Lernwerkstatt aufwacht – und die haengt vom
// Farbschema ab: dunkel ist das erste Bild #080b14, hell ein Tag, der
// blass aus der Unschaerfe kommt (gemessen 30.09., erste Bilder der
// Einfahrt). Ein schwarzer Vorhang vor einem hellen Tag waere ein Blitz.
// Die Lernwerkstatt folgt nur prefers-color-scheme, einen eigenen Schalter
// hat sie nicht; die Abfrage hier trifft also dasselbe Schema.
// Im selben Tab – in einem neuen saehe man weder das Anfahren noch den
// Uebergang. location.href braucht keine Nutzergeste; die 1,9 s
// Verzoegerung sind also auch in Safari kein Problem, anders als bei
// window.open.
const AUSFAHRT_MS = 1900
function ausruecken(truck, boden) {
  const ziel = new URL(LINKS.jugendfeuerwehr)
  ziel.searchParams.set('einfahrt', '1')
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.href = ziel.href
    return
  }
  let blende = document.querySelector('.ausfahrt')
  if (blende?.classList.contains('an')) return
  if (!blende) {
    blende = document.createElement('div')
    blende.className = 'ausfahrt'
    document.body.appendChild(blende)
    void blende.offsetWidth
  }
  truck.userData.losfahren?.(boden)
  blende.classList.add('an')
  setTimeout(() => { location.href = ziel.href }, AUSFAHRT_MS)
}

export function populateStations(world, registry, { rundflug = () => {} } = {}) {
  const animated = []

  // Jede Station rutscht auf die flachste Stelle in ihrer Umgebung. Die
  // korrigierten Koordinaten werden zurueckgeschrieben, damit Marker, Hinweis
  // und Kollision am selben Ort sitzen wie das Objekt.
  for (const [key, spot] of Object.entries(STATION_SPOTS)) {
    const flat = findFlatSpot(spot.x, spot.z, spot.search ?? 9, spot.footprint ?? 2.2)
    spot.x = flat.x
    spot.z = flat.z
  }

  const place = (object, spot, { yOffset = 0, rotation = 0, collider = null } = {}) => {
    world.place(object, spot.x, spot.z, { yOffset, rotation })
    if (collider) world.addCollider(spot.x, spot.z, collider)
    if (object.userData.animate) animated.push(object.userData.animate)
    return object
  }

  const register = (station) => {
    const marker = createMarker(station.position.x, station.position.z, station.radius ?? 6, station.color)
    world.scene.add(marker)
    const groundY = world.heightAt(station.position.x, station.position.z)
    registry.add({ ...station, marker, groundY })
  }

  // --- Weg 1: beruflich ---------------------------------------------------
  const cabin = createCabin({ label: 'WERKSTATT' })
  place(cabin, STATION_SPOTS.cabin, { rotation: FACING + 0.28, collider: 2.1 })
  // Die Werkbank steht zwischen Huette und Kamera, gerade zu ihr ausgerichtet
  // – dort liegen GitHub und LinkedIn, siehe props/workbench.js.
  const bench = createWorkbench()
  const benchSpot = {
    x: STATION_SPOTS.cabin.x + Math.sin(FACING) * BENCH_AHEAD,
    z: STATION_SPOTS.cabin.z + Math.cos(FACING) * BENCH_AHEAD,
  }
  place(bench, benchSpot, { rotation: FACING })
  for (const along of [-0.75, 0.75]) {
    world.addCollider(benchSpot.x + Math.cos(FACING) * along, benchSpot.z - Math.sin(FACING) * along, 0.62)
  }
  register({
    id: 'werkstatt',
    label: 'Werkstatt',
    hint: 'Karriere · LinkedIn & GitHub',
    color: '#0a66c2',
    position: STATION_SPOTS.cabin,
    radius: 7.5,
    labelHeight: world.heightAt(STATION_SPOTS.cabin.x, STATION_SPOTS.cabin.z) + 4.2,
    object: bench,
    // Herangezoomt wird auf die Bank, nicht auf die Huettenmitte.
    focus: { abstand: 8.5, hoehe: 1.0, vor: BENCH_AHEAD + 0.9 },
    // LinkedIn zuerst: wer an die Werkstatt faehrt, sucht meist den Menschen
    // und erst dann den Quelltext. Die erste Wahl ist die, auf der Enter
    // ohne Pfeiltaste landet.
    choices: [
      { label: 'LinkedIn', sub: 'Lebenslauf · jsveerkamp', glyph: 'linkedin', url: LINKS.linkedin, color: '#0a66c2' },
      { label: 'GitHub', sub: 'Quelltext · Savo2610', glyph: 'github', url: LINKS.github, color: '#2b3137' },
    ],
  })

  // --- Weg 2: Soziales und Bezahlen ---------------------------------------
  // Um 45 Grad im Uhrzeigersinn aus der Kameraachse gedreht: gerade zur
  // Kamera stand das Podest quer vor dem Waldrand und stach heraus, so
  // laeuft es mit der Kante des Waldstuecks. Die Tafeln sind dafuer von
  // schraeg zu lesen; cos 45 Grad laesst ihnen gut 70 Prozent ihrer Breite.
  const postYaw = FACING - Math.PI / 4
  const post = createContactPost()
  place(post, STATION_SPOTS.kontakt, { rotation: postYaw })
  for (const c of post.userData.colliders) {
    world.addCollider(
      STATION_SPOTS.kontakt.x + c.dx * Math.cos(postYaw) + c.dz * Math.sin(postYaw),
      STATION_SPOTS.kontakt.z - c.dx * Math.sin(postYaw) + c.dz * Math.cos(postYaw),
      c.r,
    )
  }
  register({
    id: 'kontakt',
    label: 'Kontakt',
    hint: 'Signal und Instagram',
    color: '#935976',
    position: STATION_SPOTS.kontakt,
    radius: 6,
    labelHeight: world.heightAt(STATION_SPOTS.kontakt.x, STATION_SPOTS.kontakt.z) + 3.6,
    object: post,
    focus: { abstand: 9, hoehe: 1.2, vor: 1.1 },
    choices: [
      { label: 'Signal', sub: 'Nachricht schreiben', glyph: 'signal', url: LINKS.signal, color: '#3a76f0' },
      { label: 'Instagram', sub: '@juliansebv', glyph: 'instagram', url: LINKS.instagram, color: '#d62976' },
    ],
  })

  // Die Skikasse ist jetzt das Haeuschen selbst. Der Automat daneben war die
  // zweite Kasse fuer dieselbe Sache; seine beiden Zahlwege sind als Tafeln
  // in die Front des Hauses gewandert.
  const booth = createTicketBooth({ label: 'SKIKASSE' })
  place(booth, STATION_SPOTS.ticket, { rotation: FACING, collider: 1.3 })
  register({
    id: 'kasse',
    label: 'Skikasse',
    hint: 'Trinkgeld & Tickets',
    color: '#2b8ce6',
    position: STATION_SPOTS.ticket,
    radius: 5.0,
    labelHeight: world.heightAt(STATION_SPOTS.ticket.x, STATION_SPOTS.ticket.z) + 3.6,
    object: booth,
    focus: { abstand: 9.5, hoehe: 1.3, vor: 1.4 },
    choices: [
      { label: 'PayPal', sub: 'paypal.me/juliansebv', glyph: 'paypal', url: LINKS.paypal, color: '#2b8ce6' },
      // Solana oeffnet am Rechner kein Ziel, sondern ein Fenster
      // (dialogs/wallet.js): es sucht die Wallet-Erweiterung, rechnet SOL
      // in Euro um und schickt die Ueberweisung. Ein blosser solana:-Link tut dort
      // schlicht nichts – am Handy dagegen ist er genau richtig.
      TOUCH
        ? { label: 'Solana', sub: 'Wallet-App öffnen', glyph: 'solana', color: '#9945ff', action: solanaApp }
        : { label: 'Solana', sub: 'Wallet verbinden', glyph: 'solana', color: '#9945ff', action: () => walletDialog() },
      // Das Ticket fuer den Rundflug der Drohne, siehe ticket.js. Es gibt nur
      // eins auf einmal: ein Stapel waere eine Waehrung, und dafuer ist das
      // Tal nicht da.
      {
        label: 'Rundflug', glyph: 'ticket', color: '#e0662b',
        sub: () => ticket.vorhanden ? 'Ticket in der Tasche ✓' : 'Ticket für die Drohne · gratis',
        action: () => { ticket.loesen() },
      },
      // Und eins fuer den Kabelsee: entwertet am Badesteg (src/sommer/).
      {
        label: 'Kabelsee', glyph: 'welle', color: '#2a8f9c',
        sub: () => seeTicket.vorhanden ? 'Ticket in der Tasche ✓' : 'Ticket für den Badesteg · gratis',
        action: () => { seeTicket.loesen() },
      },
    ],
  })

  // --- Weg 3: Werkzeuge ---------------------------------------------------
  const pipe = createUploadPipe()
  place(pipe, STATION_SPOTS.pipe, { rotation: FACING + 0.1, collider: 0.8 })
  pipe.userData.setBoden((x, z) => world.heightAt(x, z))
  register({
    id: 'upload',
    label: 'Rohrpost',
    hint: 'Etwas einwerfen',
    color: '#37b87c',
    position: STATION_SPOTS.pipe,
    radius: 5,
    labelHeight: world.heightAt(STATION_SPOTS.pipe.x, STATION_SPOTS.pipe.z) + 3.1,
    // Beim Ausloesen klappt die Klappe weit auf, und darueber geht das
    // Fenster auf, in dem man wirklich etwas abgibt. Verschickt wird erst,
    // wenn es wieder zugeht – siehe world/rohrpost-netz.js.
    // Die Rohrpost hiess vorher Upload und zeigte nur auf upload.veerka.mp;
    // ein Rohr, in das man etwas hineinwirft, und eine Seite, auf die man
    // geschickt wird, waren zwei Gedanken fuer eine Sache.
    onUse: () => {
      pipe.userData.oeffnen?.()
      uploadDialog()
    },
  })

  const tunnel = createShortcutTunnel({ label: 'ABKUERZUNG' })
  place(tunnel, STATION_SPOTS.tunnel, { rotation: FACING })
  for (const c of tunnel.userData.colliders) {
    // Die Schultern rotieren mit dem Objekt mit.
    const cos = Math.cos(FACING)
    const sin = Math.sin(FACING)
    world.addCollider(
      STATION_SPOTS.tunnel.x + c.dx * cos + c.dz * sin,
      STATION_SPOTS.tunnel.z - c.dx * sin + c.dz * cos,
      c.r,
    )
  }
  register({
    id: 'shortener',
    label: 'Abkürzung',
    hint: 'Link kürzen',
    color: '#5b7fa6',
    position: STATION_SPOTS.tunnel,
    radius: 6,
    labelHeight: world.heightAt(STATION_SPOTS.tunnel.x, STATION_SPOTS.tunnel.z) + 4.2,
    onUse: () => kurzDialog(),
  })

  // Stechuhr, Depot und Loeschzug oeffneten frueher sofort ihre Seite. Wer
  // im Tal gelernt hat, dass man ueberall heranfahren und etwas ausloesen
  // kann, stand dann ploetzlich woanders. Jetzt zoomen sie heran wie die
  // Stationen mit zwei Zielen und fuehren erst etwas vor: die Uhr rast,
  // das Depot zaehlt durch, der Loeschzug schaltet das Blaulicht an. Die
  // Auswahl hat dann nur ein Ziel – Enter oder Tippen oeffnet es.
  const clock = createTimeClock()
  place(clock, STATION_SPOTS.clock, { rotation: FACING, collider: 0.5 })
  const stempeln = () => {
    if (LINKS.worktime) window.open(LINKS.worktime, '_blank', 'noopener,noreferrer')
  }
  register({
    id: 'worktime',
    label: 'Arbeitszeitrechner',
    hint: LINKS.worktime ? 'Stempeln' : 'noch nicht verlinkt',
    color: '#37b87c',
    position: STATION_SPOTS.clock,
    radius: 4.5,
    labelHeight: world.heightAt(STATION_SPOTS.clock.x, STATION_SPOTS.clock.z) + 3.2,
    object: clock,
    focus: { abstand: 7, hoehe: 1.7, vor: 0.6 },
    // Beim Oeffnen stempelt sie (press in time-clock.js). Die Karte faehrt
    // auch dann heraus, wenn noch keine Adresse hinterlegt ist – das Geraet
    // funktioniert, nur der Link fehlt, und das soll man am Geraet sehen.
    choices: [
      { label: 'Arbeitszeit', sub: 'zeit.veerka.mp', glyph: 'uhr', color: '#37b87c', action: stempeln },
    ],
    // Aus der Uebersicht heraus, ohne Heranzoomen.
    onUse: () => {
      clock.userData.stamp?.()
      stempeln()
    },
  })

  const depot = createGearDepot()
  place(depot, STATION_SPOTS.depot, { rotation: FACING - 0.25, collider: 1.1 })
  register({
    id: 'packlist',
    label: 'Packlisten-App',
    hint: 'Liste aufschlagen',
    color: '#c98a3a',
    url: LINKS.packlist,
    position: STATION_SPOTS.depot,
    radius: 5,
    labelHeight: world.heightAt(STATION_SPOTS.depot.x, STATION_SPOTS.depot.z) + 2.6,
    object: depot,
    // Die Kiste ist kaum anderthalb Meter breit.
    focus: { abstand: 6.5, hoehe: 0.6, vor: 0.9 },
    choices: [
      { label: 'Packliste', sub: 'packliste.veerka.mp', glyph: 'liste', url: LINKS.packlist, color: '#c98a3a' },
    ],
  })

  // --- Abseits: die Fundstuecke -------------------------------------------
  const drone = createDrone()
  drone.scale.setScalar(1.35)
  place(drone, STATION_SPOTS.drone, { yOffset: 0.16, collider: 0.5 })
  register({
    id: 'drone',
    label: 'Abgestürzte Drohne',
    hint: 'Uniprojekt & Rundflug',
    color: '#ff4d3d',
    position: STATION_SPOTS.drone,
    radius: 4.5,
    labelHeight: world.heightAt(STATION_SPOTS.drone.x, STATION_SPOTS.drone.z) + 1.8,
    object: drone,
    // Die Drohne ist kaum einen Meter gross; aus zehn Metern waere sie ein
    // Fleck ueber der Auswahl.
    focus: { abstand: 6.5, hoehe: 0.5, vor: 0.7 },
    choices: [
      { label: 'Uniprojekt', sub: 'KI-Drohne · Frankfurt UAS', glyph: 'uni', url: LINKS.kidrohne, color: '#ff4d3d' },
      // Ohne Ticket bleibt sie am Boden: die Wahl schuettelt sich, und der
      // Untertitel sagt, wo es eins gibt.
      {
        label: 'Rundflug', glyph: 'drone', color: '#e0662b',
        sub: () => ticket.vorhanden ? 'Ticket entwerten und abheben' : 'Ticket an der Skikasse lösen',
        action: () => {
          if (!ticket.einloesen()) return false
          rundflug(drone)
        },
      },
    ],
  })

  const truck = createFireTruck()
  // Quer zur Blickrichtung, damit man die lange Seite mit der Leiter sieht.
  place(truck, STATION_SPOTS.firetruck, { rotation: FACING + Math.PI / 2, collider: 1.7 })
  register({
    id: 'firetruck',
    label: 'Löschzug',
    hint: 'Jugendfeuerwehr',
    color: '#c8352c',
    url: LINKS.jugendfeuerwehr,
    position: STATION_SPOTS.firetruck,
    radius: 5.5,
    labelHeight: world.heightAt(STATION_SPOTS.firetruck.x, STATION_SPOTS.firetruck.z) + 2.8,
    object: truck,
    focus: { abstand: 9, hoehe: 1.0, vor: 1.0 },
    choices: [
      {
        label: 'Ausrücken', sub: 'zur Lernwerkstatt', glyph: 'blaulicht', color: '#c8352c',
        action: () => ausruecken(truck, world.heightAt),
      },
    ],
  })
  // Kommt man mit Zurueck wieder, holt der Browser die Seite oft unveraendert
  // aus dem Speicher – mit geschlossener Blende und dem Auto im Wald.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return
    truck.userData.zurueck?.()
    document.querySelector('.ausfahrt')?.classList.remove('an')
  })

  // --- Abseits: das Gipfelbuch -------------------------------------------
  // Komoot hatte bisher keinen Platz im Tal und stand nur in der Uebersicht.
  // Touren gehoeren in ein Gipfelbuch, und das steht oben am Berg, wo man
  // es findet, wenn man sich umschaut.
  const buch = createGipfelbuch({ blick: Math.PI * 0.75 })
  place(buch, STATION_SPOTS.gipfelbuch, { rotation: FACING, collider: 0.3 })
  // Steinmann und Bank sind feste Hindernisse; die Bank ist niedrig genug,
  // um sie zu ueberspringen.
  {
    const { x, z } = STATION_SPOTS.gipfelbuch
    const c = Math.cos(FACING), sn = Math.sin(FACING)
    const welt = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c]
    world.addCollider(...welt(-1.25, -0.35), 0.45)
    world.addCollider(...welt(1.2, -0.6), 0.6, null, 0.75)
  }
  register({
    id: 'gipfelbuch',
    label: 'Gipfelbuch',
    hint: 'Eintragen',
    color: '#6aa127',
    position: STATION_SPOTS.gipfelbuch,
    radius: 4,
    labelHeight: world.heightAt(STATION_SPOTS.gipfelbuch.x, STATION_SPOTS.gipfelbuch.z) + 2.4,
    object: buch,
    focus: { abstand: 6, hoehe: 1.2, vor: 0.6 },
    choices: [
      { label: 'Komoot', sub: 'Wandern & Radfahren', glyph: 'berg', url: LINKS.komoot, color: '#6aa127' },
    ],
  })

  return { animated, pipe }
}
