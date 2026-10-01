// Was beide Bestenlisten teilen (Slalom und Kabelsee): signierte Marken,
// die Namenspruefung und die gehashte Adresse fuer die Tagesgrenze. Die
// Regeln stehen in slalom.js; der Kabelsee uebernimmt sie unveraendert.

// Teilwoerter, nach dem Glaetten von 0→o, 1→i, 3→e, 4→a, 5→s, @→a.
const SPERRE = [
  'nazi', 'hitler', 'fotze', 'hure', 'schlampe', 'wichser', 'neger', 'nigg',
  'fick', 'fuck', 'cunt', 'whore', 'slut', 'bitch', 'kanake', 'schwuchtel',
  'spast', 'missgeburt', 'arschloch', 'penis', 'vagina', 'porn', 'sieg heil',
]

// --- Marken: base64url(JSON) . base64url(HMAC-SHA256) -----------------------

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function schluessel(env) {
  if (!env.SLALOM_GEHEIM) throw new Error('SLALOM_GEHEIM fehlt')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SLALOM_GEHEIM),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signieren(env, inhalt) {
  const roh = new TextEncoder().encode(JSON.stringify(inhalt))
  const sig = await crypto.subtle.sign('HMAC', await schluessel(env), roh)
  return `${b64(roh)}.${b64(sig)}`
}

export async function pruefen(env, marke) {
  if (typeof marke !== 'string' || marke.length > 400) return null
  const [teil, sig] = marke.split('.')
  if (!teil || !sig) return null
  try {
    const roh = unb64(teil)
    const ok = await crypto.subtle.verify('HMAC', await schluessel(env), unb64(sig), roh)
    return ok ? JSON.parse(new TextDecoder().decode(roh)) : null
  } catch {
    return null
  }
}

// --- Namen -------------------------------------------------------------------

export function nameGlaetten(roh) {
  if (typeof roh !== 'string') return null
  const name = roh.normalize('NFC').replace(/\s+/g, ' ').trim()
  const laenge = [...name].length
  if (laenge < 2 || laenge > 16) return null
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _'\-]*$/u.test(name)) return null
  const flach = name.toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
  const ohneLuecken = flach.replace(/[\s_'\-]/g, '')
  if (SPERRE.some((w) => flach.includes(w) || ohneLuecken.includes(w.replace(/\s/g, '')))) return null
  return { name, schluessel: ohneLuecken }
}

// Gehashte Adresse, nur fuer die Tagesgrenze. Je Liste ein eigenes Salz
// ('slalom', 'kabelsee'): so bleiben die Zaehler getrennt, und die Hashes
// der alten Slalom-Eintraege stimmen weiter.
export async function adresse(request, liste) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'lokal'
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${liste}:${ip}`))
  return b64(h).slice(0, 22)
}
