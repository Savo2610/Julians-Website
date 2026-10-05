// Einmalcodes nach RFC 6238 (TOTP): 30 Sekunden, 6 Ziffern, HMAC-SHA1 –
// das, was jede Authenticator-App ohne Einstellungen erzeugt. Damit meldet
// sich Julian im Gipfelbuch an (worker/gipfelbuch.js).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const SCHRITT = 30

// Apps zeigen das Geheimnis in Vierergruppen und klein; beides egal.
export function base32(text) {
  const rein = String(text).toUpperCase().replace(/[\s=-]/g, '')
  const out = []
  let bits = 0
  let wert = 0
  for (const c of rein) {
    const i = B32.indexOf(c)
    if (i < 0) throw new Error('GIPFELBUCH_OTP ist kein Base32')
    wert = ((wert << 5) | i) & 0xffff
    bits += 5
    if (bits >= 8) {
      out.push((wert >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export async function code(geheim, schritt) {
  const key = await crypto.subtle.importKey('raw', base32(geheim), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const zaehler = new Uint8Array(8)
  new DataView(zaehler.buffer).setBigUint64(0, BigInt(schritt))
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, zaehler))
  const o = h[19] & 0xf
  const zahl = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000
  return String(zahl).padStart(6, '0')
}

// Gibt den Zeitschritt zurueck, zu dem der Code passt, sonst null. Ein
// Schritt davor und danach gilt mit: zwischen Ablesen am Telefon und
// Ankommen im Worker vergehen leicht ein paar Sekunden ueber die Grenze.
export async function pruefeCode(geheim, eingabe, jetzt = Date.now()) {
  if (typeof eingabe !== 'string' || !/^\d{6}$/.test(eingabe)) return null
  const t = Math.floor(jetzt / 1000 / SCHRITT)
  for (const s of [t, t - 1, t + 1]) {
    if (await code(geheim, s) === eingabe) return s
  }
  return null
}
