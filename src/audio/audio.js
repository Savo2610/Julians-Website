import { SKIER } from '../config.js'

// Der Ton der Piste.
//
// Alles ist gerechnet, keine einzige Datei. Das ist keine Sparsamkeit um ihrer
// selbst willen: Schnee unter einem Ski *ist* gefiltertes Rauschen, und ein
// Filter, dessen Mitte am Tempo haengt, trifft ihn genauer als jede Aufnahme,
// die immer gleich schnell bleibt. Dazu kaeme sonst eine Datei, die jeder
// Besucher laedt, bevor er den Berg sieht.
//
// Die Regel: es gibt genau ein Dauergeraeusch, und das ist der Schnee unter
// dem Ski. Wer steht, hoert nichts – nicht "fast nichts", sondern nichts.
// Wer in der Luft ist, hoert nichts, weil er den Schnee nicht beruehrt.
//
// Ein leiser Windteppich stand hier einmal darunter, gegen die Stille beim
// Stehen. Er war der Fehler: dumpfes Rauschen ohne Anlass *ist* Wind, und
// Wind, den man nicht abstellen kann, nervt nach zwanzig Sekunden. Alles
// unter 400 Hertz ist deshalb weg, und was uebrig bleibt, haengt an einer
// Bewegung.
//
// Angefangen wird beim ersten Tastendruck. Browser lassen Ton vorher nicht zu,
// und das ist auch richtig so.

const MASTER = 0.34          // Gesamtlautstaerke – bewusst leise
const FADE_IN = 1.6          // Sekunden, bis der Ton oben ist

// Ab wann Schnee zu hoeren ist, als Bruchteil des Grundtempos. Unter 1.3 m/s
// (v = 0.1) ist es still; ab etwa halbem Tempo steht das Geraeusch voll da.
const AN = 0.10
const VOLL = 0.50

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

// Ein langsam schwankender Verlauf zwischen -1 und 1, gedacht als Regler und
// nicht als Ton. Er ist der Unterschied zwischen Schnee und Zischen: gleich
// bleibendes Rauschen klingt nach Radio zwischen zwei Sendern, Schnee dagegen
// koernt. Zwei Lagen uebereinander – eine langsame fuers Atmen, eine schnelle
// fuers Korn – und dazwischen weich (Kosinus) statt linear interpoliert,
// damit an den Stuetzstellen kein Knick sitzt.
function wobbeln(ctx, sekunden = 6, lagen = [[2.5, 0.6], [7, 0.4]]) {
  const laenge = Math.floor(ctx.sampleRate * sekunden)
  const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate)
  const daten = puffer.getChannelData(0)
  for (const [rate, anteil] of lagen) {
    // Die Stuetzstellenzahl wird gerundet, damit das Ende wieder auf den
    // Anfang trifft und die Schleife nicht springt.
    const n = Math.max(2, Math.round(sekunden * rate))
    const werte = Array.from({ length: n }, () => Math.random() * 2 - 1)
    for (let i = 0; i < laenge; i++) {
      const p = (i / laenge) * n
      const k = Math.floor(p)
      const t = p - k
      const w = (1 - Math.cos(t * Math.PI)) * 0.5
      daten[i] += (werte[k % n] * (1 - w) + werte[(k + 1) % n] * w) * anteil
    }
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
  // Vier Ereignisse statt zwei: nicht jede Umgebung schickt zu einem Klick
  // auch ein pointerdown, und wer den Berg auf dem Tablet anfasst, hat noch
  // keine Taste gedrueckt.
  _wecken() {
    const ereignisse = ['keydown', 'pointerdown', 'mousedown', 'touchstart']
    const start = () => {
      this._bauen()
      this.ctx?.resume()
      for (const e of ereignisse) removeEventListener(e, start)
    }
    for (const e of ereignisse) addEventListener(e, start)
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
    // Drei Filter, und der erste ist der wichtigste der ganzen Datei: ein
    // Hochpass bei 700 Hertz. Darunter liegt der Bereich, in dem Rauschen
    // nach Wind klingt. Gemessen an der fertigen Kette liegen jetzt nur noch
    // 10 bis 21 Prozent des Pegels unter 400 Hertz – vorher, mit einem
    // Tiefpass statt eines Hochpasses, war fast alles dort unten, und genau
    // deshalb klang es nach Wind und nicht nach Schnee.
    //
    // Dahinter ein breites Band, das mit dem Tempo von 1200 auf 2400 Hertz
    // wandert, und darueber ein Tiefpass bei 4800: ohne ihn steigt der Anteil
    // ueber 6 Kilohertz bei voller Fahrt auf 47 Prozent und faengt an zu
    // zischen, mit ihm bleibt er bei 32.
    this.gleitHoch = ctx.createBiquadFilter()
    this.gleitHoch.type = 'highpass'
    this.gleitHoch.frequency.value = 700
    this.gleitHoch.Q.value = 0.7

    this.gleitFilter = ctx.createBiquadFilter()
    this.gleitFilter.type = 'bandpass'
    this.gleitFilter.frequency.value = 1200
    this.gleitFilter.Q.value = 0.85

    this.gleitDeckel = ctx.createBiquadFilter()
    this.gleitDeckel.type = 'lowpass'
    this.gleitDeckel.frequency.value = 4800
    this.gleitDeckel.Q.value = 0.6

    this.gleitGain = ctx.createGain()
    this.gleitGain.gain.value = 0

    // Das Korn. Der Regler laeuft mit Audiorate direkt auf den Verstaerkungs-
    // wert, nicht ueber update() – sechzig Stufen in der Sekunde waeren als
    // Treppe hoerbar, hier sind es so viele wie Abtastwerte.
    this.korn = ctx.createGain()
    this.korn.gain.value = 1
    const kornQuelle = ctx.createBufferSource()
    kornQuelle.buffer = wobbeln(ctx)
    kornQuelle.loop = true
    const kornTiefe = ctx.createGain()
    // Nicht mehr: eine Schwankung um 7 Hertz mit mehr Tiefe wird als Rauheit
    // gehoert und klingt nach Motor. Bei 0.3 atmet es nur.
    kornTiefe.gain.value = 0.3
    kornQuelle.connect(kornTiefe).connect(this.korn.gain)
    kornQuelle.start()

    // Die Kante: ein schmales Band, das nur beim Schwingen und Carven
    // aufgeht. Es ist der Unterschied zwischen geradeaus rollen und einen
    // Schwung ziehen, ohne dass dafuer ein zweites Geraeusch noetig waere.
    this.kanteFilter = ctx.createBiquadFilter()
    this.kanteFilter.type = 'bandpass'
    this.kanteFilter.frequency.value = 1600
    this.kanteFilter.Q.value = 1.4
    this.kanteGain = ctx.createGain()
    this.kanteGain.gain.value = 0

    const ski = ctx.createBufferSource()
    ski.buffer = this.puffer
    ski.loop = true
    ski.connect(this.gleitHoch)
    this.gleitHoch.connect(this.gleitFilter).connect(this.gleitDeckel).connect(this.gleitGain)
    this.gleitHoch.connect(this.kanteFilter).connect(this.kanteGain)
    this.gleitGain.connect(this.korn).connect(this.master)
    this.kanteGain.connect(this.korn)
    ski.start()

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

    // Das Tor. Ein linearer Verlauf ab null waere bei Schrittgeschwindigkeit
    // schon ein leises Rauschen, und genau das soll es nicht geben: entweder
    // faehrt jemand, dann klingt es, oder er steht, dann ist Ruhe. Die
    // Glaettung an beiden Enden verhindert, dass es beim Anfahren aufploppt.
    const roh = (v - AN) / (VOLL - AN)
    const tor = roh <= 0 ? 0 : roh >= 1 ? 1 : roh * roh * (3 - 2 * roh)

    const gleiten = this._kontakt * tor * 0.55
    this._ziel(this.gleitGain.gain, gleiten, 0.06)
    this._ziel(this.gleitFilter.frequency, 1200 + 1200 * Math.min(1, v), 0.08)

    // Die Kante haengt an Carven und Einschlagwinkel, nicht am Tempo allein –
    // sonst zischt es auch geradeaus.
    const kante = this._kontakt * tor
      * (skier.carving * 0.5 + Math.abs(skier.turn) * 0.5) * 0.4
    this._ziel(this.kanteGain.gain, kante, 0.06)
    this._ziel(this.kanteFilter.frequency, 1600 + 1200 * Math.min(1, v), 0.08)
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
