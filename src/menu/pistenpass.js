import { MEDALS } from '../world/attractions/race.js'

// Der Pistenpass: wie weit man das Tal kennt, was man gefahren ist.
//
// Die erste Fassung hatte 37 Abzeichen, und fuer fast alles, was man tat,
// kam eine Pille – das erschlug mehr, als es lockte (Ansage 26.09.). Uebrig
// sind drei Dinge:
//
// - ERKUNDET ist ein stiller Fortschritt: fuenfzehn Orte, ein Balken im Pass,
//   keine Pille pro Ort. Nur wer alles gefunden hat, bekommt eine Meldung.
// - MEDAILLEN im Slalom, wie an der Zeitnahme.
// - ABZEICHEN sind wenige und schwer. Zwei stehen offen im Pass, sechs sind
//   geheim und zeigen nur ein Fragezeichen, ohne Hinweis.
//
// Belohnt wird nie das Benutzen. Fuer Hochladen, Wallet, Kurzlink oder
// Bezahlen gibt es absichtlich nichts – sonst Datenmuell und Cent-Betraege
// fuer einen Stempel. Wer eine Station erreicht, hat sie gefunden.
//
// Alles erkundet, Silber und die beiden offenen Abzeichen ergeben goldene
// Ski. Gold im Slalom gehoert nicht dazu: Julians eigene Bestzeit nach Tagen
// Uebung war 4,18 – Silber.

const STORE = 'skiportfolio.pass'

const zeit = (name) => MEDALS.find((m) => m.name === name).time.toFixed(2).replace('.', ',')

// Drohne und Loeschzug heissen erst, wenn man sie gefunden hat – sie sollen
// gesucht werden, wie in der Uebersicht.
export const ORTE_ERKUNDET = [
  { id: 'werkstatt', name: 'Werkstatt' },
  { id: 'kontakt', name: 'Kontakt' },
  { id: 'kasse', name: 'Skikasse' },
  { id: 'upload', name: 'Rohrpost' },
  { id: 'shortener', name: 'Abkürzung' },
  { id: 'worktime', name: 'Stechuhr' },
  { id: 'packlist', name: 'Packliste' },
  { id: 'drone', name: 'Drohne', versteckt: true },
  { id: 'firetruck', name: 'Löschzug', versteckt: true },
  { id: 'see', name: 'See' },
  { id: 'gipfel', name: 'Gipfel' },
  { id: 'huette', name: 'Hütte' },
  { id: 'park', name: 'Funpark' },
  { id: 'kinderland', name: 'Kinderland' },
  { id: 'nord', name: 'Nordabfahrt' },
]

export const MEDAILLEN = [
  { id: 'bronze', icon: '🥉', name: 'Bronze', zeit: zeit('Bronze') },
  { id: 'silber', icon: '🥈', name: 'Silber', zeit: zeit('Silber') },
  { id: 'gold', icon: '🥇', name: 'Gold', zeit: zeit('Gold') },
]

export const ABZEICHEN = [
  { id: 'kmh58', icon: '🚀', name: 'Raser', text: 'Mit 58 km/h durch den Speedcheck.' },
  { id: 'd540', icon: '🌀', name: 'Fünf-Vierzig', text: 'Einen 540er im Funpark gestanden.' },
  { id: 'd720', geheim: true, icon: '💫', name: 'Doppelschraube', text: 'Einen 720er gestanden.' },
  { id: 'schwarzfahrt', geheim: true, icon: '🚫', name: 'Hausverbot', text: 'Slalom am Schlepplift. Das ist verboten.' },
  { id: 'bankrott', geheim: true, icon: '🪵', name: 'Bankrott', text: 'Die Seebank zerlegt.' },
  { id: 'klamm', geheim: true, icon: '🕳️', name: 'Brücke verpasst', text: 'Unten in der Klamm statt auf dem Steg.' },
  { id: 'aussicht', geheim: true, icon: '🌄', name: 'Aussicht genossen', text: 'Eine Minute lang nichts gedrückt.' },
  { id: 'nacht', geheim: true, icon: '🌙', name: 'Nachtskifahrer', text: 'Zwischen Mitternacht und fünf Uhr im Tal.' },
]

const MELDBAR = new Map([
  ...MEDAILLEN.map((m) => [m.id, { icon: m.icon, name: `Slalom ${m.name}`, text: `Unter ${m.zeit} s.` }]),
  ...ABZEICHEN.map((a) => [a.id, a]),
])
const FUER_GOLD = ['silber', ...ABZEICHEN.filter((a) => !a.geheim).map((a) => a.id)]
const IST_ORT = new Set(ORTE_ERKUNDET.map((o) => o.id))

// Die erste Fassung speicherte Orte als Abzeichen und Stationen als Menge;
// beides wird hier zu Erkundet, damit auf beta niemand von vorn anfaengt.
const ALT_ORTE = { see: 'see', gipfel: 'gipfel', huette: 'huette', nord: 'nord', teppich: 'kinderland', drohne: 'drone', loeschzug: 'firetruck' }

function laden() {
  let d = null
  try { d = JSON.parse(localStorage.getItem(STORE)) } catch { /* leer oder gesperrt */ }
  if (!d || typeof d !== 'object') return { erreicht: {}, orte: [] }
  const orte = new Set(Array.isArray(d.orte) ? d.orte : [])
  for (const id of d.stand?.stationen ?? []) orte.add(id)
  for (const [alt, neu] of Object.entries(ALT_ORTE)) if (d.erreicht?.[alt]) orte.add(neu)
  const erreicht = {}
  for (const [id, t] of Object.entries(d.erreicht ?? {})) if (MELDBAR.has(id)) erreicht[id] = t
  return { erreicht, orte: [...orte].filter((id) => IST_ORT.has(id)) }
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
  kennt(ort) { return this.daten.orte.includes(ort) }
  get erkundet() { return this.daten.orte.length }
  get allesErkundet() { return this.erkundet >= ORTE_ERKUNDET.length }
  get gold() { return this.allesErkundet && FUER_GOLD.every((id) => this.hat(id)) }

  _speichern() {
    try { localStorage.setItem(STORE, JSON.stringify(this.daten)) } catch { /* egal */ }
  }

  // Nach jeder Aenderung: koennten jetzt die goldenen Ski faellig sein?
  _nachher(warGold) {
    if (!warGold && this.gold) {
      this._melden({ icon: '⛷️', name: 'Goldene Ski', text: 'Tal erkundet, Silber, Raser und 540er.', gold: true })
      this.onGold?.()
    }
    this.onChange?.()
  }

  erreiche(id) {
    const a = MELDBAR.get(id)
    if (!a || this.hat(id)) return false
    const warGold = this.gold
    this.daten.erreicht[id] = Date.now()
    this._speichern()
    this._melden(a)
    this._nachher(warGold)
    return true
  }

  // Still: ein neuer Ort meldet sich nicht, er fuellt nur den Balken. Erst
  // der letzte bekommt eine Pille.
  entdecke(ort) {
    if (!IST_ORT.has(ort) || this.kennt(ort)) return false
    const warGold = this.gold
    this.daten.orte.push(ort)
    this._speichern()
    if (this.allesErkundet) this._melden({ icon: '🧭', name: 'Tal erkundet', text: `Alle ${ORTE_ERKUNDET.length} Orte gefunden.` })
    this._nachher(warGold)
    return true
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
    this.daten = { erreicht: {}, orte: [] }
    this._speichern()
    this.onChange?.()
  }
}
