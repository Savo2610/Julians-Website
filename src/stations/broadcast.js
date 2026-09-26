import * as THREE from 'three'
import { FALL } from '../world/props/frozen-fall.js'

// Was gerade auf broadcast.veerka.mp laeuft, eingefroren in die Quelle am
// See (world/props/frozen-fall.js). Der Worker reicht Stand und Dateien
// unter /api/broadcast/* durch, siehe worker/index.js.
//
// Gefragt wird nur, wer in die Naehe kommt – die allermeisten Besucher
// fahren nie an den See, und fuer sie geht keine Anfrage raus. Danach
// hoechstens einmal pro Minute. Bilder werden im Browser auf 1024 Pixel
// verkleinert; das Original hatte beim ersten Test 2,6 MB.
//
// Mehrere Anhaenge wechseln sich ab, alle acht Sekunden. Videos laufen
// stumm und nur, solange man nah ist. Ton spielt die Quelle nie ab.

const API = '/api/broadcast'
const NEAR = 40          // m: ab hier wird gefragt
const PLAY = 26          // m: ab hier laeuft ein Video
const EVERY = 60         // s zwischen zwei Abfragen
const SLIDE = 8          // s je Anhang
const MAX_SLIDES = 6
const FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif'

// Seitenverhaeltnis des Fensters im Eis (80 % der Breite, 78 % der Hoehe),
// damit die Zeichnung nicht noch einmal beschnitten wird.
const ASPECT = (FALL.width * 0.8) / (FALL.height * 0.78)
const CW = 1024
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
  }

  // Fuer die Einladung und die Auswahl.
  get hint() {
    if (this.message === undefined) return 'Etwas schimmert im Eis'
    if (!this.message) return 'Funkstille – nur Eis'
    return 'Da steckt etwas im Eis'
  }

  get sub() {
    const m = this.message
    if (m === undefined) return 'broadcast.veerka.mp'
    if (!m) return 'Funkstille · broadcast.veerka.mp'
    const bilder = m.attachments.filter((a) => a.inline === 'image').length
    const videos = m.attachments.filter((a) => a.inline === 'video').length
    const art = videos ? (videos > 1 ? `${videos} Videos` : 'Video')
      : bilder ? (bilder > 1 ? `${bilder} Bilder` : 'Bild')
        : m.text ? 'Text' : 'Dateien'
    return `Auf Sendung · ${art} · ${vorWann(m.createdAt)}`
  }

  update(dt, skier) {
    this.clock += dt
    if (!skier) return
    const d = Math.hypot(skier.position.x - this.position.x, skier.position.z - this.position.z)
    this.distance = d
    this.fall.userData.setNear?.(THREE.MathUtils.clamp(1 - (d - 4) / 10, 0, 1))

    if (d < NEAR && !this.loading && this.clock - this.lastFetch > EVERY && document.visibilityState === 'visible') {
      this.holen()
    }
    // Eine Sendung laeuft nach sieben Tagen ab – auch ohne neue Abfrage.
    if (this.message && this.message.expiresAt < Date.now()) this.zeigen(null)

    const slide = this.slides[this.index]
    if (slide?.video) {
      const v = slide.video
      const soll = d < PLAY && document.visibilityState === 'visible'
      if (soll && v.paused) v.play().catch(() => {})
      else if (!soll && !v.paused) v.pause()
    }

    if (this.slides.length > 1 && d < NEAR) {
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
    if (!m) {
      this.fall.userData.setMedia?.(null)
      this.fall.userData.setGlow?.(null, 0)
      return
    }

    const text = (m.text ?? '').trim()
    const inline = m.attachments.filter((a) => a.inline === 'image' || a.inline === 'video').slice(0, MAX_SLIDES)
    const rest = m.attachments.filter((a) => !inline.includes(a))
    // Kurzer Text laeuft als Zeile unter dem Bild mit, langer bekommt
    // eine eigene Folie.
    const unterzeile = text.length <= 140 ? text : ''

    const slides = []
    for (const a of inline) {
      slides.push(a.inline === 'video' ? { kind: 'video', a } : { kind: 'image', a, text: unterzeile })
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
    const vorher = this.slides[this.index]
    this.index = i
    if (vorher?.video && vorher !== s) vorher.video.pause()
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
    this.fall.userData.setMedia?.(s.texture, s.aspect ?? ASPECT)
    this.fall.userData.setGlow?.(s.color, 1)
  }

  async bauen(s) {
    if (s.kind === 'text' || s.kind === 'files') {
      const c = s.kind === 'text' ? textFolie(s.text) : dateiFolie(s.files)
      s.texture = textur(c)
      s.color = new THREE.Color(0x6fb8e8)
      return
    }
    if (s.kind === 'image') {
      const r = await fetch(datei(s.a))
      if (!r.ok) throw new Error(r.status)
      const bitmap = await createImageBitmap(await r.blob())
      const c = bildFolie(bitmap, s.text)
      bitmap.close?.()
      s.texture = textur(c)
      s.color = mittel(c)
      return
    }
    // Video: stumm, in Schleife, im Bild bleibend (iOS). Erst hier wird
    // es angelegt, also erst, wenn jemand davorsteht.
    const v = document.createElement('video')
    v.muted = true
    v.defaultMuted = true
    v.loop = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.preload = 'metadata'
    v.src = datei(s.a)
    await new Promise((ok, fail) => {
      v.addEventListener('loadeddata', ok, { once: true })
      v.addEventListener('error', fail, { once: true })
    })
    s.video = v
    s.aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : ASPECT
    const t = new THREE.VideoTexture(v)
    t.colorSpace = THREE.SRGBColorSpace
    s.texture = t
    s.color = mittel(v)
  }

  wegwerfen(s) {
    if (s.video) {
      s.video.pause()
      s.video.removeAttribute('src')
      s.video.load()
    }
    // Erst nach der Ueberblendung, sonst blitzt beim Wechsel Schwarz auf.
    if (s.texture) setTimeout(() => s.texture.dispose(), 2000)
  }
}
