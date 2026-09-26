import { MEDALS } from '../world/race.js'

// Der Pistenpass: Abzeichen fuer das, was man im Tal findet und kann.
//
// Belohnt wird das Finden, nie das Benutzen. Fuer Hochladen, Wallet, Kurzlink
// oder Bezahlen gibt es absichtlich nichts – ein Abzeichen dafuer hiesse
// Datenmuell im Briefkasten, Wegwerf-Kurzlinks und Cent-Betraege, nur damit
// ein Stempel farbig wird. Wer eine Station erreicht, hat sie gefunden; das
// ist genau das, was das Tal erreichen soll.
//
// Drei Sorten:
// - ENTDECKEN und KOENNEN stehen offen im Pass, mit dem, was zu tun ist. Sie
//   fuehren zu Stationen oder geben dem Fahren einen Grund.
// - GEHEIM zeigt nur ein Fragezeichen, auch keinen Hinweis: die Ueberraschung
//   ist die Belohnung. Unfug zum Kaputtmachen ist dort bewusst nur zweimal
//   vertreten (Seebank, Fackeln) – vier Abzeichen fuers Umfahren waren eins
//   zu viel Programm.
//
// Wer alle offenen hat, bekommt goldene Ski. Keine Leiste, kein Zaehler: der
// Pass liegt als Reiter in der Uebersicht, und beim Freischalten kommt eine
// Pille, die von selbst geht.

const STORE = 'skiportfolio.pass'

const medaille = (name) => MEDALS.find((m) => m.name === name).time.toFixed(2).replace('.', ',')

export const GRUPPEN = [
  { id: 'entdecken', titel: 'Entdecken', farbe: '#346782' },
  { id: 'koennen', titel: 'Können', farbe: '#a86738' },
  { id: 'geheim', titel: 'Geheim', farbe: '#935976' },
]

export const ABZEICHEN = [
  // --- Entdecken --------------------------------------------------------
  { id: 'see', gruppe: 'entdecken', icon: '🧊', name: 'Seeblick', text: 'Auf dem zugefrorenen See gestanden.' },
  { id: 'gipfel', gruppe: 'entdecken', icon: '⛰️', name: 'Gipfelstürmer', text: 'Oben am Gipfelkreuz.' },
  { id: 'lift', gruppe: 'entdecken', icon: '🚡', name: 'Bergfahrt', text: 'Mit dem Tellerlift ganz nach oben.' },
  { id: 'teppich', gruppe: 'entdecken', icon: '🧸', name: 'Kinderland', text: 'Einmal auf dem Zauberteppich gefahren.' },
  { id: 'huette', gruppe: 'entdecken', icon: '☕', name: 'Einkehrschwung', text: 'Auf der Terrasse der Après-Ski-Hütte.' },
  { id: 'nord', gruppe: 'entdecken', icon: '🌲', name: 'Die Rückseite', text: 'Die Nordabfahrt bis ganz unten.' },
  { id: 'wege', gruppe: 'entdecken', icon: '🧭', name: 'Pistenkenner', text: 'Alle vier Wege bis zu ihrem Ende.', ziel: 4 },
  { id: 'stationen', gruppe: 'entdecken', icon: '📍', name: 'Rundgang', text: 'Alle neun Stationen gefunden.', ziel: 9 },
  { id: 'drohne', gruppe: 'entdecken', icon: '🛸', name: 'Bruchlandung', text: 'Irgendwo ist etwas vom Himmel gefallen.' },
  { id: 'loeschzug', gruppe: 'entdecken', icon: '🚒', name: 'Einsatzbereit', text: 'Irgendwo wartet ein Einsatzfahrzeug.' },

  // --- Koennen ------------------------------------------------------------
  { id: 'bronze', gruppe: 'koennen', icon: '🥉', name: 'Slalom Bronze', text: `Rodelbahn-Slalom unter ${medaille('Bronze')} s.` },
  { id: 'silber', gruppe: 'koennen', icon: '🥈', name: 'Slalom Silber', text: `Rodelbahn-Slalom unter ${medaille('Silber')} s.` },
  { id: 'gold', gruppe: 'koennen', icon: '🥇', name: 'Slalom Gold', text: `Rodelbahn-Slalom unter ${medaille('Gold')} s.` },
  { id: 'kmh50', gruppe: 'koennen', icon: '📸', name: 'Geblitzt', text: 'Mit 50 km/h durch den Speedcheck.' },
  { id: 'kmh58', gruppe: 'koennen', icon: '🚀', name: 'Raser', text: 'Mit 58 km/h durch den Speedcheck.' },
  { id: 'd180', gruppe: 'koennen', icon: '↩️', name: 'Halbe Sache', text: 'Einen 180er im Funpark gestanden.' },
  { id: 'd360', gruppe: 'koennen', icon: '🔄', name: 'Einmal rum', text: 'Einen 360er im Funpark gestanden.' },
  { id: 'd540', gruppe: 'koennen', icon: '🌀', name: 'Fünf-Vierzig', text: 'Einen 540er im Funpark gestanden.' },
  { id: 'rail', gruppe: 'koennen', icon: '🛤️', name: 'Railslide', text: 'Die Rail bis ans Ende gerutscht.' },
  { id: 'leucht', gruppe: 'koennen', icon: '✨', name: 'Lichtgeschwindigkeit', text: 'Die Leuchtstrecke ganz durchfahren.' },
  { id: 'stein', gruppe: 'koennen', icon: '🪨', name: 'Überflieger', text: 'Mit der Leertaste über einen Stein gesprungen.' },
  { id: 'hm300', gruppe: 'koennen', icon: '📉', name: 'Talfahrer', text: '300 Höhenmeter abgefahren.', ziel: 300 },

  // --- Geheim -------------------------------------------------------------
  { id: 'bankrott', gruppe: 'geheim', icon: '🪵', name: 'Bankrott', text: 'Die Seebank zerlegt.' },
  { id: 'lichter', gruppe: 'geheim', icon: '🔥', name: 'Lichter aus', text: 'Drei Fackeln auf einmal umgefahren.' },
  { id: 'eingeschneit', gruppe: 'geheim', icon: '☃️', name: 'Eingeschneit', text: 'Von der Schneekanone erwischt.' },
  { id: 'schwarzfahrt', gruppe: 'geheim', icon: '🚫', name: 'Hausverbot', text: 'Slalom am Schlepplift. Das ist verboten.' },
  { id: 'pizza', gruppe: 'geheim', icon: '🍕', name: 'Pizza!', text: 'Fünf Sekunden Pizza gehalten.' },
  { id: 'schauer', gruppe: 'geheim', icon: '🌨️', name: 'Schneedusche', text: 'Den Schnee von einer Tanne geschüttelt.' },
  { id: 'verfranzt', gruppe: 'geheim', icon: '🫥', name: 'Verfranzt', text: 'Mitten im Wald verlaufen.' },
  { id: 'heimweh', gruppe: 'geheim', icon: '🏠', name: 'Heimweh', text: 'Zehnmal zurück zum Start.', ziel: 10 },
  { id: 'klamm', gruppe: 'geheim', icon: '🕳️', name: 'Brücke verpasst', text: 'Unten in der Klamm statt auf dem Steg.' },
  { id: 'aussicht', gruppe: 'geheim', icon: '🌄', name: 'Aussicht genossen', text: 'Eine Minute lang nichts gedrückt.' },
  { id: 'nacht', gruppe: 'geheim', icon: '🌙', name: 'Nachtskifahrer', text: 'Zwischen Mitternacht und fünf Uhr im Tal.' },
  { id: 'stammgast', gruppe: 'geheim', icon: '🎟️', name: 'Stammgast', text: 'An drei verschiedenen Tagen vorbeigekommen.', ziel: 3 },
  { id: 'lawine', gruppe: 'geheim', icon: '⚠️', name: 'Lawinengefahr', text: 'An einem Tag mit Warnstufe 4 oder 5 gefahren.' },
  { id: 'd720', gruppe: 'geheim', icon: '💫', name: 'Doppelschraube', text: 'Einen 720er gestanden.' },
  { id: 'everest', gruppe: 'geheim', icon: '🏔️', name: 'Everest', text: '8848 Höhenmeter abgefahren.', ziel: 8848 },
]

const BY_ID = new Map(ABZEICHEN.map((a) => [a.id, a]))
export const OFFEN = ABZEICHEN.filter((a) => a.gruppe !== 'geheim')

function laden() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE))
    if (d && typeof d === 'object') {
      return { erreicht: d.erreicht ?? {}, zaehler: d.zaehler ?? {}, stand: d.stand ?? {}, tage: d.tage ?? [] }
    }
  } catch { /* leer oder gesperrt – dann eben frisch */ }
  return { erreicht: {}, zaehler: {}, stand: {}, tage: [] }
}

export class Pistenpass {
  constructor() {
    this.daten = laden()
    this._warteschlange = []
    this._zeigt = false
    this.onGold = null      // wird von aussen gesetzt: goldene Ski anlegen
    this.onChange = null    // der Reiter in der Uebersicht zeichnet neu

    this.pille = document.createElement('div')
    this.pille.className = 'glass pass-pille'
    this.pille.setAttribute('role', 'status')
    this.pille.innerHTML = '<span class="pass-pille-icon"></span><span class="pass-pille-text"><strong></strong><small></small></span>'
    document.body.appendChild(this.pille)
  }

  hat(id) { return !!this.daten.erreicht[id] }
  get gold() { return OFFEN.every((a) => this.hat(a.id)) }
  get anzahl() { return Object.keys(this.daten.erreicht).filter((id) => BY_ID.has(id)).length }

  // Gespeichert wird hoechstens einmal pro Sekunde: die Hoehenmeter zaehlen
  // in jedem Bild mit, localStorage in jedem Bild waere Verschwendung.
  _speichern(sofort = false) {
    if (!sofort) {
      if (this._timer) return
      this._timer = setTimeout(() => { this._timer = null; this._speichern(true) }, 1000)
      return
    }
    try { localStorage.setItem(STORE, JSON.stringify(this.daten)) } catch { /* egal */ }
  }

  erreiche(id) {
    const a = BY_ID.get(id)
    if (!a || this.hat(id)) return false
    const warGold = this.gold
    this.daten.erreicht[id] = Date.now()
    this._speichern(true)
    this._melden(a)
    if (!warGold && this.gold) {
      this._melden({ icon: '⛷️', name: 'Goldene Ski', text: 'Alle offenen Abzeichen gesammelt.', gold: true })
      this.onGold?.()
    }
    this.onChange?.()
    return true
  }

  // Zaehler fuer Abzeichen mit Ziel (Hoehenmeter, R, Tage). Mehrere
  // Abzeichen koennen denselben Zaehler lesen – Talfahrer und Everest.
  zaehle(schluessel, um = 1) {
    const z = this.daten.zaehler
    z[schluessel] = (z[schluessel] ?? 0) + um
    this._speichern()
    return z[schluessel]
  }

  zaehler(schluessel) { return this.daten.zaehler[schluessel] ?? 0 }

  // Mengen statt Zaehler, wo es auf das Was ankommt: welche Stationen, welche
  // Wege. Doppelt zaehlt dann nichts.
  merke(menge, wert) {
    const liste = this.daten.stand[menge] ?? (this.daten.stand[menge] = [])
    if (!liste.includes(wert)) {
      liste.push(wert)
      this._speichern(true)
      this.onChange?.()
    }
    return liste.length
  }

  menge(name) { return this.daten.stand[name] ?? [] }

  // Stand fuer den Reiter: wie weit ist ein Abzeichen mit Ziel?
  fortschritt(a) {
    if (!a.ziel) return null
    const wert = {
      wege: this.menge('wege').length,
      stationen: this.menge('stationen').length,
      hm300: Math.floor(this.zaehler('hm')),
      everest: Math.floor(this.zaehler('hm')),
      heimweh: this.zaehler('heimweh'),
      stammgast: this.daten.tage.length,
    }[a.id] ?? 0
    return Math.min(wert, a.ziel)
  }

  // Einmal beim Laden: der heutige Tag zaehlt fuer den Stammgast.
  besuch(datum = new Date()) {
    const tag = `${datum.getFullYear()}-${datum.getMonth() + 1}-${datum.getDate()}`
    if (!this.daten.tage.includes(tag)) {
      this.daten.tage.push(tag)
      if (this.daten.tage.length > 30) this.daten.tage.shift()
      this._speichern(true)
    }
    return this.daten.tage.length
  }

  // Eine nach der anderen, nicht uebereinander: beim Slalom kommen Bronze
  // und Silber im selben Bild.
  _melden(a) {
    this._warteschlange.push(a)
    if (!this._zeigt) this._naechste()
  }

  _naechste() {
    const a = this._warteschlange.shift()
    if (!a) { this._zeigt = false; return }
    this._zeigt = true
    this.pille.querySelector('.pass-pille-icon').textContent = a.icon
    this.pille.querySelector('strong').textContent = a.name
    this.pille.querySelector('small').textContent = a.text
    this.pille.classList.toggle('gold', !!a.gold)
    this.pille.classList.add('visible')
    setTimeout(() => {
      this.pille.classList.remove('visible')
      setTimeout(() => this._naechste(), 450)
    }, a.gold ? 4200 : 3000)
  }

  // Nur zum Pruefen aus der Konsole: __ski.pass.zuruecksetzen()
  zuruecksetzen() {
    this.daten = { erreicht: {}, zaehler: {}, stand: {}, tage: [] }
    this._speichern(true)
    this.onChange?.()
  }
}
