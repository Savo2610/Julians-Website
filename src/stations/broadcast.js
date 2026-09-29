import * as THREE from 'three'
import { FALL } from '../world/props/frozen-fall.js'
import { CAMERA } from '../config.js'

// Was gerade auf broadcast.veerka.mp laeuft, eingefroren in die Quelle am
// See (world/props/frozen-fall.js). Der Worker reicht Stand und Dateien
// unter /api/broadcast/* durch, siehe worker/broadcast.js.
//
// Gefragt wird nur, wer in die Naehe kommt – die allermeisten Besucher
// fahren nie an den See, und fuer sie geht keine Anfrage raus. Danach
// hoechstens einmal pro Minute. Bilder werden im Browser auf 1280 Pixel
// verkleinert; das Original hatte beim ersten Test 2,6 MB.
//
// Mehrere Anhaenge wechseln sich ab, alle acht Sekunden. Nur Bilder und
// Text: Videos liefen nicht zuverlaessig und sind seit 27.09. wieder
// draussen. Eine Sendung nur mit Video zeigt wie andere Dateien den Namen.

const API = '/api/broadcast'
const NEAR = 55          // m: ab hier wird gefragt
// Klar ist das Bild auf der vorderen Haelfte des Sees (der Fuss des Falls
// steht 18 m von der Seemitte), dann verschwindet es hinter dem Reif.
// Seitlich zaehlt jeder Meter 1,6-fach: Stechuhr und Abkuerzung liegen
// 21 und 26 m weg, aber genau seitlich vom Fall (vorn 0,3 und 6,7 m) –
// dort war das Bild schon klar, gesehen von der Seite. Gewichtet sind es
// 34 und 40 m, also ganz im Reif; die Seemitte bleibt bei 17 m klar.
const KLAR = 19
const WEG = 30
const SEITE = 1.6
const EVERY = 60         // s zwischen zwei Abfragen
const SLIDE = 8          // s je Anhang
const MAX_SLIDES = 6
const FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif'

// Seitenverhaeltnis des Fensters im Eis (86 % der Breite, 82 % der Hoehe),
// damit die Zeichnung nicht noch einmal beschnitten wird.
const ASPECT = (FALL.width * 0.86) / (FALL.height * 0.82)
const CW = 1280
const CH = Math.round(CW / ASPECT)

function leinwand() {
  const c = document.createElement('canvas')
  c.width = CW
  c.height = CH
  return [c, c.getContext('2d')]
}

function textur(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Zeilen umbrechen, harte Umbrueche behalten.
function umbrechen(ctx, text, breite) {
  const zeilen = []
  for (const absatz of text.split('\n')) {
    let zeile = ''
    for (const wort of absatz.split(/\s+/)) {
      const probe = zeile ? `${zeile} ${wort}` : wort
      if (ctx.measureText(probe).width <= breite || !zeile) zeile = probe
      else { zeilen.push(zeile); zeile = wort }
    }
    zeilen.push(zeile)
  }
  return zeilen
}

// Den Text so gross wie moeglich, aber so, dass er ins Fenster passt.
function textBlock(ctx, text, { breite, hoehe, max = 92, min = 26, maxZeilen = 12 }) {
  for (let size = max; size >= min; size -= 4) {
    ctx.font = `700 ${size}px ${FONT}`
    const zeilen = umbrechen(ctx, text, breite)
    if (zeilen.length * size * 1.18 <= hoehe && zeilen.length <= maxZeilen) return { size, zeilen }
  }
  ctx.font = `700 ${min}px ${FONT}`
  const zeilen = umbrechen(ctx, text, breite)
  const passen = Math.max(1, Math.floor(hoehe / (min * 1.18)))
  if (zeilen.length > passen) {
    zeilen.length = passen
    zeilen[passen - 1] = zeilen[passen - 1].replace(/\s*\S*$/, '') + ' …'
  }
  return { size: min, zeilen }
}

// Nur Text: helle Buchstaben vor dunklem, tiefem Wasser, als waere hinter
// dem Eis noch nicht alles gefroren. Ohne den dunklen Grund lasen sich
// weisse Buchstaben auf dem hellen Eis kaum.
function textFolie(text) {
  const [c, ctx] = leinwand()
  const tiefe = ctx.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CW * 0.62)
  tiefe.addColorStop(0, 'rgba(12, 58, 84, 0.92)')
  tiefe.addColorStop(0.7, 'rgba(18, 74, 102, 0.8)')
  tiefe.addColorStop(1, 'rgba(30, 96, 124, 0)')
  ctx.fillStyle = tiefe
  ctx.fillRect(0, 0, CW, CH)
  const rand = 90
  const { size, zeilen } = textBlock(ctx, text, { breite: CW - rand * 2, hoehe: CH - rand * 2, max: 80 })
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const y0 = CH / 2 - ((zeilen.length - 1) * size * 1.18) / 2
  zeilen.forEach((z, i) => {
    const y = y0 + i * size * 1.18
    ctx.fillStyle = 'rgba(4, 24, 38, 0.6)'
    ctx.fillText(z, CW / 2 + 3, y + 4)
    ctx.fillStyle = '#f4fbff'
    ctx.fillText(z, CW / 2, y)
  })
  return c
}

// Bild fuellend ins Fenster, darunter optional eine Zeile Text.
function bildFolie(bitmap, text) {
  const [c, ctx] = leinwand()
  const s = Math.max(CW / bitmap.width, CH / bitmap.height)
  const w = bitmap.width * s, h = bitmap.height * s
  ctx.drawImage(bitmap, (CW - w) / 2, (CH - h) / 2, w, h)
  if (text) {
    const g = ctx.createLinearGradient(0, CH * 0.55, 0, CH)
    g.addColorStop(0, 'rgba(8, 30, 46, 0)')
    g.addColorStop(1, 'rgba(8, 30, 46, 0.82)')
    ctx.fillStyle = g
    ctx.fillRect(0, CH * 0.55, CW, CH * 0.45)
    const { size, zeilen } = textBlock(ctx, text, { breite: CW - 140, hoehe: CH * 0.24, max: 54, min: 26, maxZeilen: 3 })
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'
    zeilen.forEach((z, i) => ctx.fillText(z, CW / 2, CH - 70 - (zeilen.length - 1 - i) * size * 1.18))
  }
  return c
}

// Dateien ohne Vorschau: nur, was es ist. Oeffnen kann man sie drueben.
function dateiFolie(dateien) {
  const namen = dateien.slice(0, 4).map((a) => `📎 ${a.name}`)
  if (dateien.length > 4) namen.push(`und ${dateien.length - 4} weitere`)
  return textFolie(namen.join('\n'))
}

// Mittlere Farbe fuer den Schein auf dem Schnee, etwas aufgehellt.
function mittel(quelle) {
  const c = document.createElement('canvas')
  c.width = c.height = 8
  const ctx = c.getContext('2d', { willReadFrequently: true })
  try {
    ctx.drawImage(quelle, 0, 0, 8, 8)
    const d = ctx.getImageData(0, 0, 8, 8).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    const n = d.length / 4
    const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255)
    const hsl = {}
    col.getHSL(hsl)
    return col.setHSL(hsl.h, Math.min(1, hsl.s * 1.3), Math.max(0.55, hsl.l))
  } catch {
    return new THREE.Color(0x9fd6ff)
  }
}

const datei = (a) => `${API}/file?key=${encodeURIComponent(a.key)}`

function vorWann(ms) {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 2) return 'gerade eben'
  if (min < 60) return `seit ${min} Min.`
  const std = Math.round(min / 60)
  if (std < 24) return `seit ${std} Std.`
  const tage = Math.round(std / 24)
  return tage === 1 ? 'seit gestern' : `seit ${tage} Tagen`
}

export class BroadcastFeed {
  constructor(fall, position) {
    this.fall = fall
    this.position = position
    this.message = undefined     // undefined = noch nie gefragt, null = Funkstille
    this.slides = []
    this.index = 0
    this.timer = 0
    this.lastFetch = -Infinity
    this.clock = 0
    this.loading = false
    this.distance = Infinity
    this._vorschau = null      // { texture, color, bis } solange ein Upload im Eis steht
  }

  // Was eben eingeworfen wurde, kurz ins Eis (world/rohrpost-netz.js): das
  // Bild, sonst der Text. Beides zusammen zeigt nur das Bild – anders als
  // bei einer Sendung ohne Zeile darunter, das Eis steht nur 3,5 s
  // (Julian, 30.09.). Alles kommt aus dem Browser, nicht vom Server:
  // sehen kann es nur, wer es gerade eingeworfen hat, und nach dem
  // Neuladen ist es weg. Gibt die fertige Folie zurueck oder null, wenn
  // es nichts zu zeigen gibt. Kann der Browser das Bild nicht lesen (HEIC
  // in Chrome), bleibt der Text.
  async vorbereiten({ bild = null, text = '' } = {}) {
    text = text.trim()
    if (bild) {
      try {
        const bitmap = await createImageBitmap(bild)
        const c = bildFolie(bitmap, '')
        bitmap.close?.()
        return { texture: textur(c), color: mittel(c) }
      } catch { /* dann eben nur der Text */ }
    }
    if (!text) return null
    return { texture: textur(textFolie(text)), color: new THREE.Color(0x6fb8e8) }
  }

  // Folie zeigen, fuer so viele Sekunden ganz aufgetaut. Die laufende
  // Sendung steht solange still und kommt danach zurueck.
  vorschau(folie, sekunden) {
    this._vorschau = { ...folie, bis: this.clock + sekunden }
    this.fall.userData.setMedia?.(folie.texture, ASPECT)
    this.fall.userData.setGlow?.(folie.color, 1)
    this.fall.userData.setKlar?.(true)
  }

  _vorschauEnde() {
    const v = this._vorschau
    this._vorschau = null
    this.fall.userData.setKlar?.(false)
    const s = this.slides[this.index]
    if (s?.texture) {
      this.fall.userData.setMedia?.(s.texture, ASPECT)
      this.fall.userData.setGlow?.(s.color, 1)
    } else {
      this.fall.userData.setMedia?.(null)
      this.fall.userData.setGlow?.(null, 0)
    }
    setTimeout(() => v.texture.dispose(), 2000)
  }

  // Fuer die Einladung und die Auswahl.
  get hint() {
    if (this.message === undefined) return 'Broadcast'
    if (!this.message) return 'Funkstille'
    return 'Gerade auf Sendung'
  }

  get sub() {
    const m = this.message
    if (m === undefined) return 'broadcast.veerka.mp'
    if (!m) return 'Funkstille · broadcast.veerka.mp'
    const bilder = m.attachments.filter((a) => a.inline === 'image').length
    const art = bilder ? (bilder > 1 ? `${bilder} Bilder` : 'Bild')
      : m.text ? 'Text' : 'Dateien'
    return `Auf Sendung · ${art} · ${vorWann(m.createdAt)}`
  }

  update(dt, skier) {
    this.clock += dt
    if (this._vorschau && this.clock > this._vorschau.bis) this._vorschauEnde()
    if (!skier) return
    const dx = skier.position.x - this.position.x
    const dz = skier.position.z - this.position.z
    const d = Math.hypot(dx, dz)
    this.distance = d
    // Vorn = zur Kamera hin, seitlich = quer dazu.
    const vorn = dx * Math.sin(CAMERA.azimuth) + dz * Math.cos(CAMERA.azimuth)
    const seite = dx * Math.cos(CAMERA.azimuth) - dz * Math.sin(CAMERA.azimuth)
    this.sichtweite = Math.hypot(vorn, seite * SEITE)
    this.fall.userData.setSicht?.(1 - THREE.MathUtils.smoothstep(this.sichtweite, KLAR, WEG))

    if (d < NEAR && !this.loading && this.clock - this.lastFetch > EVERY && document.visibilityState === 'visible') {
      this.holen()
    }
    // Eine Sendung laeuft nach sieben Tagen ab – auch ohne neue Abfrage.
    if (this.message && this.message.expiresAt < Date.now()) this.zeigen(null)

    if (this.slides.length > 1 && d < NEAR && !this._vorschau) {
      this.timer += dt
      if (this.timer > SLIDE) {
        this.timer = 0
        this.folie((this.index + 1) % this.slides.length)
      }
    }
  }

  async holen() {
    this.loading = true
    this.lastFetch = this.clock
    try {
      const r = await fetch(`${API}/state`)
      if (!r.ok) throw new Error(r.status)
      const { message } = await r.json()
      const m = message && message.expiresAt > Date.now() ? message : null
      if ((m?.id ?? null) !== (this.message?.id ?? null) || this.message === undefined) await this.zeigen(m)
    } catch {
      // Kein Netz oder Dienst weg: das Eis bleibt, wie es ist. Beim
      // naechsten Mal wird wieder gefragt.
    } finally {
      this.loading = false
    }
  }

  async zeigen(m) {
    this.message = m
    for (const s of this.slides) this.wegwerfen(s)
    this.slides = []
    this.index = 0
    this.timer = 0
    this.fall.userData.setLive?.(!!m)
    // Waehrend einer Vorschau bleibt das Eis beim Upload; was danach kommt,
    // setzt _vorschauEnde().
    if (!m && this._vorschau) return
    if (!m) {
      this.fall.userData.setMedia?.(null)
      this.fall.userData.setGlow?.(null, 0)
      return
    }

    const text = (m.text ?? '').trim()
    const inline = m.attachments.filter((a) => a.inline === 'image').slice(0, MAX_SLIDES)
    const rest = m.attachments.filter((a) => !inline.includes(a))
    // Kurzer Text laeuft als Zeile unter dem Bild mit, langer bekommt
    // eine eigene Folie.
    const unterzeile = text.length <= 140 ? text : ''

    const slides = []
    for (const a of inline) {
      slides.push({ kind: 'image', a, text: unterzeile })
    }
    if (text && (!inline.length || !unterzeile)) slides.push({ kind: 'text', text })
    if (!slides.length && rest.length) slides.push({ kind: 'files', files: rest })
    this.slides = slides
    await this.folie(0)
  }

  // Eine Folie zeigen; gebaut wird sie erst, wenn sie dran ist.
  async folie(i) {
    const s = this.slides[i]
    if (!s) return
    this.index = i
    if (!s.texture) {
      try {
        await this.bauen(s)
      } catch {
        s.texture = textur(textFolie(s.a?.name ?? '…'))
        s.color = new THREE.Color(0x9fd6ff)
      }
      // Waehrend des Ladens kam womoeglich eine neue Sendung.
      if (!this.slides.includes(s) || this.slides[this.index] !== s) return
    }
    if (this._vorschau) return
    this.fall.userData.setMedia?.(s.texture, ASPECT)
    this.fall.userData.setGlow?.(s.color, 1)
  }

  async bauen(s) {
    if (s.kind === 'text' || s.kind === 'files') {
      const c = s.kind === 'text' ? textFolie(s.text) : dateiFolie(s.files)
      s.texture = textur(c)
      s.color = new THREE.Color(0x6fb8e8)
      return
    }
    const r = await fetch(datei(s.a))
    if (!r.ok) throw new Error(r.status)
    const bitmap = await createImageBitmap(await r.blob())
    const c = bildFolie(bitmap, s.text)
    bitmap.close?.()
    s.texture = textur(c)
    s.color = mittel(c)
  }

  wegwerfen(s) {
    // Erst nach der Ueberblendung, sonst blitzt beim Wechsel Schwarz auf.
    if (s.texture) setTimeout(() => s.texture.dispose(), 2000)
  }
}
