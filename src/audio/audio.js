import { SKIER } from '../config.js'

// Der Ton der Piste.
//
// Alles ist gerechnet, keine einzige Datei. Das ist keine Sparsamkeit um ihrer
// selbst willen: Schnee unter einem Ski *ist* gefiltertes Rauschen, und ein
// Tiefpass, dessen Grenzfrequenz am Tempo haengt, trifft ihn genauer als jede
// Aufnahme, die immer gleich schnell bleibt. Dazu kaeme sonst eine Datei, die
// jeder Besucher laedt, bevor er den Berg sieht.
//
// Die Regel fuer alles hier: Ton entsteht nur aus etwas, das gerade passiert.
// Wer steht, hoert fast nichts. Wer in der Luft ist, hoert den Schnee nicht,
// weil er ihn nicht beruehrt. Nichts laeuft im Leerlauf mit, und nichts
// wiederholt sich in einer Schleife, die man nach einer Minute erkennt – das
// ist der Unterschied zwischen Atmosphaere und Nerverei.
//
// Angefangen wird beim ersten Tastendruck. Browser lassen Ton vorher nicht zu,
// und das ist auch richtig so.

const MASTER = 0.42          // Gesamtlautstaerke – bewusst leise
const FADE_IN = 1.6          // Sekunden, bis der Ton oben ist

// Die Tonleiter der Schussstrecke. Pentatonik, weil darin keine zwei Toene
// gegeneinander stehen: man kann sie in beliebiger Reihenfolge und beliebigem
// Tempo spielen, es klingt immer nach Absicht. Eine durchgehende Sirene waere
// die naheliegende Loesung fuer "wird immer hoeher" – und genau die Sorte
// Geraeusch, die man nach dem dritten Mal abstellen will.
const PENTATONIK = [0, 2, 4, 7, 9]
const GRUNDTON = 196         // G3
const STUFEN = 9             // so viele Toene ueber die ganze Strecke

function tonhoehe(stufe) {
  const oktave = Math.floor(stufe / PENTATONIK.length)
  const halbton = PENTATONIK[stufe % PENTATONIK.length] + oktave * 12
  return GRUNDTON * Math.pow(2, halbton / 12)
}

// Rosa Rauschen statt weissem. Weisses Rauschen hat in jeder Oktave gleich
// viel Energie und damit oben herum sehr viel mehr, als das Ohr erwartet – es
// zischt. Rosa faellt mit 3 dB je Oktave ab und klingt deshalb wie Wind,
// Wasser und eben Schnee. Die Filterkette ist die von Paul Kellet.
function rauschen(ctx, sekunden = 4) {
  const laenge = Math.floor(ctx.sampleRate * sekunden)
  const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate)
  const daten = puffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < laenge; i++) {
    const weiss = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + weiss * 0.0990460
    b1 = 0.96300 * b1 + weiss * 0.2965164
    b2 = 0.57000 * b2 + weiss * 1.0526913
    daten[i] = (b0 + b1 + b2 + weiss * 0.1848) * 0.16
  }
  // Die Schleifenstelle ueberblenden. Ohne das knackt es einmal je Runde,
  // und bei Rauschen hoert man genau dieses eine Knacken heraus.
  const blende = Math.floor(ctx.sampleRate * 0.2)
  for (let i = 0; i < blende; i++) {
    const t = i / blende
    daten[i] = daten[i] * t + daten[laenge - blende + i] * (1 - t)
  }
  return puffer
}

export class SkiAudio {
  constructor() {
    this.ctx = null
    this.laeuft = false
    // Die Entscheidung ueberlebt den Besuch. Wer den Ton einmal abgestellt
    // hat, will ihn beim naechsten Mal nicht wieder anspringen hoeren.
    this.aus = localStorage.getItem('ski-ton') === 'aus'
    this._stufe = -1
    this._kontakt = 0
    this._wecken()
  }

  // Erst eine echte Eingabe darf den Ton starten. Der Aufruf muss aus dem
  // Ereignis selbst kommen – Safari erlaubt das Aufwecken sonst nicht.
  _wecken() {
    const start = () => {
      this._bauen()
      this.ctx?.resume()
      removeEventListener('keydown', start)
      removeEventListener('pointerdown', start)
    }
    addEventListener('keydown', start)
    addEventListener('pointerdown', start)
  }

  _bauen() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    const jetzt = ctx.currentTime

    this.master = ctx.createGain()
    this.master.gain.setValueAtTime(0, jetzt)
    this.master.gain.linearRampToValueAtTime(this.aus ? 0 : MASTER, jetzt + FADE_IN)
    this.master.connect(ctx.destination)

    this.puffer = rauschen(ctx)

    // --- Schnee unter dem Ski ---------------------------------------------
    // Zwei Wege aus demselben Rauschen. Der eine ist das Gleiten: dumpf, mit
    // einer Grenzfrequenz, die mit dem Tempo aufmacht. Der andere ist die
    // Kante: ein schmales Band um zwei Kilohertz, das nur beim Schwingen und
    // Carven aufgeht. Zusammen ergeben sie den Unterschied zwischen
    // geradeaus rollen und einen Schwung ziehen, ohne dass dafuer ein
    // zweites Geraeusch noetig waere.
    this.gleitFilter = ctx.createBiquadFilter()
    this.gleitFilter.type = 'lowpass'
    this.gleitFilter.frequency.value = 300
    this.gleitFilter.Q.value = 0.7
    this.gleitGain = ctx.createGain()
    this.gleitGain.gain.value = 0

    this.kanteFilter = ctx.createBiquadFilter()
    this.kanteFilter.type = 'bandpass'
    this.kanteFilter.frequency.value = 1800
    this.kanteFilter.Q.value = 1.1
    this.kanteGain = ctx.createGain()
    this.kanteGain.gain.value = 0

    const ski = ctx.createBufferSource()
    ski.buffer = this.puffer
    ski.loop = true
    ski.connect(this.gleitFilter).connect(this.gleitGain).connect(this.master)
    ski.connect(this.kanteFilter).connect(this.kanteGain).connect(this.master)
    ski.start()

    // --- Wind ---------------------------------------------------------------
    // Sehr leise und sehr dumpf. Er ist nicht zum Hinhoeren da, sondern
    // dagegen, dass die Welt beim Stillstehen tot wirkt. Eigene Quelle mit
    // eigenem Startversatz, damit er nicht im Takt des Skirauschens laeuft.
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 160
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.05

    const wind = ctx.createBufferSource()
    wind.buffer = this.puffer
    wind.loop = true
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master)
    wind.start(jetzt, 1.7)

    // --- Schussstrecke ------------------------------------------------------
    // Ein leiser Grundton, der mit der Strecke steigt, und auf jeder Stufe
    // ein Anschlag darueber. Der Grundton allein waere ein Summen, die
    // Anschlaege allein ein Klimpern; zusammen klingt es wie ein Instrument,
    // an dem man entlangfaehrt.
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 1400
    this.padGain.connect(padFilter).connect(this.master)

    this.pad = ctx.createOscillator()
    this.pad.type = 'triangle'
    this.pad.frequency.value = GRUNDTON
    this.pad.connect(this.padGain)
    this.pad.start()

    this.laeuft = true
  }

  // Alle laufenden Werte werden angesteuert und nicht gesetzt: ein Sprung im
  // Gain ist ein hoerbarer Knack, und bei sechzig Bildern in der Sekunde
  // waeren das sechzig davon.
  _ziel(param, wert, tau = 0.05) {
    param.setTargetAtTime(wert, this.ctx.currentTime, tau)
  }

  // --- Jeden Frame -----------------------------------------------------------

  update(dt, skier) {
    if (!this.laeuft || this.aus) return

    const v = Math.min(1.35, skier.speed / SKIER.cruiseSpeed)
    // Bodenkontakt weich, nicht als Schalter: der Schnee soll beim Absprung
    // verklingen und bei der Landung wieder da sein, nicht schlagartig.
    const will = skier.airborne ? 0 : 1
    this._kontakt += (will - this._kontakt) * Math.min(1, dt * (will ? 14 : 7))

    const gleiten = this._kontakt * Math.min(1, v) * 0.5
    this._ziel(this.gleitGain.gain, gleiten, 0.05)
    this._ziel(this.gleitFilter.frequency, 260 + 1450 * v, 0.06)

    // Die Kante haengt an Carven und Einschlagwinkel, nicht am Tempo allein –
    // sonst zischt es auch geradeaus.
    const kante = this._kontakt * Math.min(1, v)
      * (skier.carving * 0.5 + Math.abs(skier.turn) * 0.5) * 0.45
    this._ziel(this.kanteGain.gain, kante, 0.06)
    this._ziel(this.kanteFilter.frequency, 1500 + 1500 * v, 0.08)

    // Wind: leise vorhanden, mit dem Tempo etwas mehr. In der Luft bleibt er
    // als Einziges hoerbar, und genau das macht den Sprung zum Sprung.
    this._ziel(this.windGain.gain, 0.05 + v * 0.13, 0.12)
    this._ziel(this.windFilter.frequency, 150 + 260 * v, 0.15)
  }

  // --- Landung ---------------------------------------------------------------
  // Ein dumpfer Schlag: kurzer Rauschstoss durch einen tiefen Filter, darunter
  // ein Sinus, der von 78 auf 44 Hertz faellt. Das ist der ganze Trick an
  // einem Aufprall – viel Energie unten, sehr schnell weg.
  landung(staerke) {
    if (!this.laeuft || this.aus || staerke < 0.08) return
    const ctx = this.ctx
    const jetzt = ctx.currentTime
    const a = Math.min(1, staerke)

    const stoss = ctx.createBufferSource()
    stoss.buffer = this.puffer
    stoss.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1100, jetzt)
    filter.frequency.exponentialRampToValueAtTime(220, jetzt + 0.22)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, jetzt)
    gain.gain.linearRampToValueAtTime(a * 0.85, jetzt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, jetzt + 0.28)
    stoss.connect(filter).connect(gain).connect(this.master)
    stoss.start(jetzt, Math.random() * 3)
    stoss.stop(jetzt + 0.3)

    const tief = ctx.createOscillator()
    tief.type = 'sine'
    tief.frequency.setValueAtTime(78, jetzt)
    tief.frequency.exponentialRampToValueAtTime(44, jetzt + 0.18)
    const tiefGain = ctx.createGain()
    tiefGain.gain.setValueAtTime(0, jetzt)
    tiefGain.gain.linearRampToValueAtTime(a * 0.5, jetzt + 0.01)
    tiefGain.gain.exponentialRampToValueAtTime(0.0001, jetzt + 0.26)
    tief.connect(tiefGain).connect(this.master)
    tief.start(jetzt)
    tief.stop(jetzt + 0.28)
  }

  // --- Umgestossenes -----------------------------------------------------------
  // Fackeln und Pistenstangen: ein kurzes, weiches Klopfen. Holz im Schnee
  // klingt nicht nach Holz auf Holz – es hat kaum Nachhall, deshalb sechzig
  // Millisekunden und fertig.
  klopfen() {
    if (!this.laeuft || this.aus) return
    const ctx = this.ctx
    const jetzt = ctx.currentTime
    const stoss = ctx.createBufferSource()
    stoss.buffer = this.puffer
    stoss.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 420 + Math.random() * 260
    filter.Q.value = 2.4
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, jetzt)
    gain.gain.linearRampToValueAtTime(0.34, jetzt + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, jetzt + 0.09)
    stoss.connect(filter).connect(gain).connect(this.master)
    stoss.start(jetzt, Math.random() * 3)
    stoss.stop(jetzt + 0.1)
  }

  // --- Schussstrecke ---------------------------------------------------------
  // `lage` ist der Fortschritt auf der Strecke in 0..1, `drin` sagt, ob der
  // Fahrer ueberhaupt in der Gasse ist. Rueckwaerts hinauf wird der Ton von
  // selbst wieder tiefer – dafuer ist nichts extra noetig, die Stufe ergibt
  // sich aus der Position und nicht aus einer Zaehlung.
  strecke(drin, lage) {
    if (!this.laeuft || this.aus) return
    if (!drin) {
      this._ziel(this.padGain.gain, 0, 0.25)
      this._stufe = -1
      return
    }
    const stufe = Math.max(0, Math.min(STUFEN - 1, Math.floor(lage * STUFEN)))
    const f = tonhoehe(stufe)
    this._ziel(this.padGain.gain, 0.05, 0.12)
    this._ziel(this.pad.frequency, f, 0.05)
    if (stufe !== this._stufe) {
      this._stufe = stufe
      this._anschlag(f)
    }
  }

  // Ein weicher Anschlag: Grundton plus Oktave, sofort da und dann fast eine
  // Sekunde lang ausklingend. Zwei Sinuskurven genuegen – alles mit mehr
  // Obertoenen klingt in dieser Tonlage nach Klingel und nicht nach Glocke.
  _anschlag(f) {
    const ctx = this.ctx
    const jetzt = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, jetzt)
    gain.gain.linearRampToValueAtTime(0.1, jetzt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, jetzt + 0.9)
    gain.connect(this.master)

    for (const [vielfaches, anteil] of [[1, 1], [2, 0.32]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * vielfaches
      const g = ctx.createGain()
      g.gain.value = anteil
      o.connect(g).connect(gain)
      o.start(jetzt)
      o.stop(jetzt + 0.95)
    }
  }

  // --- An und aus ------------------------------------------------------------

  umschalten() {
    this.aus = !this.aus
    localStorage.setItem('ski-ton', this.aus ? 'aus' : 'an')
    if (!this.ctx) return this.aus
    this.ctx.resume()
    this._ziel(this.master.gain, this.aus ? 0 : MASTER, 0.08)
    return this.aus
  }
}

// Eine einzige Anlage fuer die ganze Seite. Sie durchzureichen waere ein
// Argument in jedem Konstruktor gewesen, den es sonst nicht braucht – und
// zwei Anlagen gleichzeitig ergaeben ohnehin keinen Sinn.
export const audio = new SkiAudio()
