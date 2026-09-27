// Solana-Trinkgeld ohne Bibliothek.
//
// Warum von Hand: Für eine einzige SOL-Überweisung braucht es hier keine
// 120 KB @solana/web3.js. Gebraucht werden nur drei Dinge – eine Wallet
// finden, eine Transaktion zusammenbauen, sie der Wallet zum Signieren und
// Senden geben. Die Wallet-Standard-Schnittstelle nimmt die Transaktion als
// rohe Bytes entgegen, also bauen wir die Bytes selbst.
//
// Die Bytefolge ist gegen @solana/web3.js 1.98.4 geprüft (siehe Commit).

import { schliessbar } from './dialog.js';

export const EMPFAENGER = 'BvCkY1zzww8gv6Akn7XNPw9dzj4XJxyyT4GHF9Jev5Da';

// Nur für den Blockhash. Gesendet wird über die Wallet, nicht über uns.
// Am 23.09.2026 aus dem Browser geprüft: nur publicnode antwortet ohne
// Schlüssel. api.mainnet-beta.solana.com gibt Browsern 403, drpc 400,
// onfinality 429, leorpc und blastapi antworten gar nicht mehr. Die Liste
// bleibt eine Liste, damit ein zweiter Knoten nur eine Zeile ist.
const RPCS = [
  'https://solana-rpc.publicnode.com',
];

const LAMPORTS = 1_000_000_000;

// Wechselkurs SOL -> EUR. Rein zur Anzeige: gesendet wird immer SOL.
const KURSE = [
  {
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur',
    lesen: (d) => d?.solana?.eur,
  },
  {
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=SOLEUR',
    lesen: (d) => parseFloat(d?.price),
  },
];

/* ---------- Base58 ---------- */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Lesen(text) {
  const bytes = [];
  for (const zeichen of text) {
    let uebertrag = ALPHABET.indexOf(zeichen);
    if (uebertrag < 0) throw new Error('Keine gültige Base58-Zeichenkette');
    for (let i = 0; i < bytes.length; i++) {
      uebertrag += bytes[i] * 58;
      bytes[i] = uebertrag & 0xff;
      uebertrag >>= 8;
    }
    while (uebertrag > 0) {
      bytes.push(uebertrag & 0xff);
      uebertrag >>= 8;
    }
  }
  // Führende Nullbytes stehen in Base58 als führende Einsen.
  for (let i = 0; i < text.length && text[i] === '1'; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

export function base58Schreiben(bytes) {
  const stellen = [];
  for (const byte of bytes) {
    let uebertrag = byte;
    for (let i = 0; i < stellen.length; i++) {
      uebertrag += stellen[i] << 8;
      stellen[i] = uebertrag % 58;
      uebertrag = (uebertrag / 58) | 0;
    }
    while (uebertrag > 0) {
      stellen.push(uebertrag % 58);
      uebertrag = (uebertrag / 58) | 0;
    }
  }
  let vorne = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    vorne += '1';
  }
  return vorne + stellen.reverse().map((s) => ALPHABET[s]).join('');
}

// Adressen und Blockhashes sind immer 32 Bytes. Beginnen sie mit einem
// Nullbyte, ist die Base58-Form kürzer – deshalb vorne auffüllen.
function schluessel32(text) {
  const roh = base58Lesen(text);
  if (roh.length > 32) throw new Error('Adresse ist zu lang');
  const voll = new Uint8Array(32);
  voll.set(roh, 32 - roh.length);
  return voll;
}

/* ---------- Transaktion ---------- */

// Solana zählt Listenlängen als "compact-u16": sieben Bits pro Byte,
// das achte Bit sagt "es kommt noch was".
function laenge(n, ziel) {
  for (;;) {
    if (n < 0x80) {
      ziel.push(n);
      return;
    }
    ziel.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
}

/**
 * Eine Überweisung von `von` an `nach` über `lamports`.
 *
 * @param {boolean} v0  true = neues Format (0x80-Präfix, Lookup-Tabellen),
 *                      false = klassisches Format. Manche Wallets können nur
 *                      eins von beiden, deshalb die Umschaltung.
 */
export function ueberweisungBauen(von, nach, lamports, blockhash, v0 = false) {
  const nachricht = [];
  if (v0) nachricht.push(0x80);

  // Kopf: eine Unterschrift nötig, davon keine nur-lesend, und ein
  // nur-lesendes Konto ohne Unterschrift (das System-Programm).
  nachricht.push(1, 0, 1);

  // Konten in fester Reihenfolge: Absender, Empfänger, System-Programm.
  // Das System-Programm hat die Adresse aus lauter Nullbytes.
  laenge(3, nachricht);
  nachricht.push(...schluessel32(von), ...schluessel32(nach), ...new Uint8Array(32));

  nachricht.push(...schluessel32(blockhash));

  // Genau eine Anweisung: System-Programm (Konto 2), Transfer (Kennzahl 2),
  // betrifft Absender (0) und Empfänger (1).
  laenge(1, nachricht);
  nachricht.push(2);
  laenge(2, nachricht);
  nachricht.push(0, 1);

  const daten = [2, 0, 0, 0];
  let rest = BigInt(lamports);
  for (let i = 0; i < 8; i++) {
    daten.push(Number(rest & 0xffn));
    rest >>= 8n;
  }
  laenge(daten.length, nachricht);
  nachricht.push(...daten);

  if (v0) laenge(0, nachricht); // keine Adress-Lookup-Tabellen

  // Davor die Unterschriftenliste. Wir unterschreiben nicht – das macht die
  // Wallet – also ein Platzhalter aus 64 Nullbytes.
  const transaktion = [];
  laenge(1, transaktion);
  for (let i = 0; i < 64; i++) transaktion.push(0);
  transaktion.push(...nachricht);

  return Uint8Array.from(transaktion);
}

export async function blockhashHolen() {
  let letzterFehler;
  for (const url of RPCS) {
    try {
      const antwort = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestBlockhash',
          params: [{ commitment: 'finalized' }],
        }),
      });
      if (!antwort.ok) throw new Error('RPC ' + antwort.status);
      const daten = await antwort.json();
      const hash = daten?.result?.value?.blockhash;
      if (!hash) throw new Error(daten?.error?.message || 'Keine Antwort');
      return hash;
    } catch (fehler) {
      letzterFehler = fehler;
    }
  }
  throw new Error('Kein Solana-Knoten erreichbar: ' + letzterFehler?.message);
}

/* ---------- Wechselkurs ---------- */

let kursVersprechen = null;

/**
 * Holt den SOL-Preis in Euro. Das Ergebnis wird für die Sitzung behalten –
 * für eine Trinkgeld-Anzeige muss der Kurs nicht sekündlich stimmen. Ist
 * keine Quelle erreichbar, kommt null zurück und die Euro-Anzeige entfällt.
 */
export function kursHolen() {
  if (kursVersprechen) return kursVersprechen;

  kursVersprechen = (async () => {
    for (const quelle of KURSE) {
      try {
        const antwort = await fetch(quelle.url);
        if (!antwort.ok) continue;
        const preis = quelle.lesen(await antwort.json());
        if (Number.isFinite(preis) && preis > 0) return preis;
      } catch (_) {
        // nächste Quelle
      }
    }
    return null;
  })();

  return kursVersprechen;
}

/* ---------- Wallets finden ---------- */

const VERBINDEN = 'standard:connect';
const SENDEN = 'solana:signAndSendTransaction';

const gefundene = new Map();

function anmelden(...wallets) {
  for (const wallet of wallets) {
    const kannSolana = wallet?.chains?.some((kette) => kette.startsWith('solana:'));
    if (kannSolana && wallet.features?.[VERBINDEN] && wallet.features?.[SENDEN]) {
      gefundene.set(wallet.name, wallet);
    }
  }
  return () => {};
}

// Wallets, die sich später anmelden, schicken dieses Ereignis. Der Horcher
// bleibt für immer stehen – eine Erweiterung darf sich auch nachträglich
// melden, etwa wenn sie erst entsperrt wird.
window.addEventListener('wallet-standard:register-wallet', (ereignis) =>
  ereignis.detail({ register: anmelden }),
);

/**
 * Wallet-Erweiterungen melden sich über den Wallet-Standard an: Wir rufen
 * "wir sind bereit" in den Raum, jede Wallet meldet sich zurück. Wallets, die
 * schon vor uns da waren, hören auf diesen Ruf.
 */
export function walletsSuchen() {
  window.dispatchEvent(
    new CustomEvent('wallet-standard:app-ready', { detail: { register: anmelden } }),
  );
  return [...gefundene.values()];
}

/* ---------- Senden ---------- */

function mainnetKonto(konten) {
  return konten.find((k) => k.chains?.includes('solana:mainnet')) || konten[0];
}

/**
 * Verbindet die Wallet, baut die Überweisung und lässt sie signieren und
 * senden. Gibt die Signatur zurück.
 */
export async function sendenMit(wallet, sol) {
  const lamports = Math.round(sol * LAMPORTS);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('Bitte einen Betrag größer als 0 eingeben.');
  }

  const { accounts } = await wallet.features[VERBINDEN].connect();
  const konto = mainnetKonto(accounts || []);
  if (!konto) throw new Error('Die Wallet hat kein Konto freigegeben.');

  const senden = wallet.features[SENDEN];
  // Wenn die Wallet das klassische Format nicht mag, nehmen wir das neue.
  const versionen = senden.supportedTransactionVersions;
  const kannLegacy = !versionen || [...versionen].includes('legacy');

  const blockhash = await blockhashHolen();
  const transaktion = ueberweisungBauen(
    base58Schreiben(konto.publicKey),
    EMPFAENGER,
    lamports,
    blockhash,
    !kannLegacy,
  );

  const [ergebnis] = await senden.signAndSendTransaction({
    account: konto,
    chain: 'solana:mainnet',
    transaction: transaktion,
  });

  return base58Schreiben(ergebnis.signature);
}

/* ---------- Dialog ---------- */

const $ = (id) => document.getElementById(id);

let vorbereitet = false;

function kurz(adresse) {
  return adresse.slice(0, 6) + '…' + adresse.slice(-6);
}

function melden(text, art) {
  const status = $('sol-status');
  status.hidden = false;
  status.textContent = '';
  status.dataset.art = art || '';
  status.append(text);
  return status;
}

// Eingabe-Einheit. Gesendet wird immer SOL – EUR ist nur eine Brille davor.
let einheit = 'SOL';
let kurs = null;

const CHIPS = {
  SOL: ['0,05', '0,1', '0,5', '1'],
  EUR: ['5', '10', '25', '50'],
};

const zahl = (wert, stellen) =>
  wert.toLocaleString('de-DE', { maximumFractionDigits: stellen });

function eingabeLesen() {
  // Deutsche Tastaturen liefern gern ein Komma.
  return parseFloat(String($('sol-betrag').value).replace(',', '.'));
}

/** Der Betrag in SOL – egal, in welcher Einheit er dasteht. */
function solLesen() {
  const wert = eingabeLesen();
  if (!Number.isFinite(wert)) return NaN;
  if (einheit === 'EUR') return kurs ? wert / kurs : NaN;
  return wert;
}

/** Zeigt unter dem Feld den Gegenwert in der jeweils anderen Einheit. */
function umrechnungZeigen() {
  const zeile = $('sol-umrechnung');
  const wert = eingabeLesen();

  if (!kurs || !Number.isFinite(wert) || wert <= 0) {
    zeile.hidden = true;
    return;
  }

  zeile.hidden = false;
  zeile.textContent =
    einheit === 'SOL'
      ? '≈ ' + zahl(wert * kurs, 2) + ' €'
      : '≈ ' + zahl(wert / kurs, 4) + ' SOL';
}

function chipsSetzen() {
  const behaelter = $('sol-chips');
  behaelter.textContent = '';
  for (const betrag of CHIPS[einheit]) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.dataset.betrag = betrag;
    knopf.textContent = einheit === 'EUR' ? betrag + ' €' : betrag;
    behaelter.append(knopf);
  }
}

function einheitSetzen(neueEinheit) {
  const wert = eingabeLesen();
  einheit = neueEinheit;
  $('sol-einheit').textContent = einheit;

  // Den eingetippten Betrag mitnehmen, statt ihn wegzuwerfen.
  if (kurs && Number.isFinite(wert) && wert > 0) {
    const umgerechnet = einheit === 'EUR' ? wert * kurs : wert / kurs;
    $('sol-betrag').value = zahl(umgerechnet, einheit === 'EUR' ? 2 : 4);
  }

  chipsSetzen();
  umrechnungZeigen();
}

async function abschicken(wallets) {
  const knopf = $('sol-los');
  const wallet = wallets[$('sol-wahl').selectedIndex] || wallets[0];
  const sol = solLesen();

  if (!Number.isFinite(sol) || sol <= 0) {
    melden('Bitte einen Betrag größer als 0 eingeben.', 'fehler');
    return;
  }

  knopf.disabled = true;
  const betrag = kurs
    ? zahl(sol, 4) + ' SOL (≈ ' + zahl(sol * kurs, 2) + ' €)'
    : zahl(sol, 4) + ' SOL';
  melden(betrag + ' – bestätige die Überweisung in ' + wallet.name + ' …');

  try {
    const signatur = await sendenMit(wallet, sol);
    const status = melden('Angekommen. Danke! ', 'gut');
    const link = document.createElement('a');
    link.href = 'https://solscan.io/tx/' + signatur;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Transaktion ansehen';
    status.append(link);
  } catch (fehler) {
    // Wallets werfen beim Abbrechen einen Fehler – das ist kein Drama.
    const text = String(fehler?.message || fehler);
    const abgebrochen = /reject|denied|abgelehnt|cancel|abbruch/i.test(text);
    melden(abgebrochen ? 'Abgebrochen – nichts gesendet.' : text, abgebrochen ? '' : 'fehler');
  } finally {
    knopf.disabled = false;
  }
}

function verdrahten() {
  if (vorbereitet) return;
  vorbereitet = true;

  $('sol-adresse-text').textContent = kurz(EMPFAENGER);
  schliessbar($('sol-dialog'), $('sol-zu'));

  $('sol-kopieren').addEventListener('click', async () => {
    const hinweis = $('sol-kopieren-text');
    try {
      await navigator.clipboard.writeText(EMPFAENGER);
      hinweis.textContent = 'kopiert ✓';
    } catch (_) {
      hinweis.textContent = 'ging nicht';
    }
    setTimeout(() => { hinweis.textContent = 'kopieren'; }, 2000);
  });

  $('sol-chips').addEventListener('click', (ereignis) => {
    const knopf = ereignis.target.closest('button');
    if (!knopf) return;
    $('sol-betrag').value = knopf.dataset.betrag;
    umrechnungZeigen();
  });

  $('sol-betrag').addEventListener('input', umrechnungZeigen);

  $('sol-einheit').addEventListener('click', () => {
    if (kurs) einheitSetzen(einheit === 'SOL' ? 'EUR' : 'SOL');
  });

  chipsSetzen();

  // Der Kurs kommt nach. Bis dahin bleibt alles in SOL bedienbar; ohne Kurs
  // bleibt die Einheit ein Etikett und die Euro-Zeile weg.
  kursHolen().then((preis) => {
    kurs = preis;
    if (!kurs) return;
    $('sol-einheit').dataset.tauschbar = '';
    $('sol-einheit').title = 'Zwischen SOL und Euro wechseln';
    umrechnungZeigen();
  });
}

export function oeffnen() {
  verdrahten();

  const wallets = walletsSuchen();
  const dialog = $('sol-dialog');
  const status = $('sol-status');

  status.hidden = true;
  status.textContent = '';
  status.dataset.art = '';
  $('sol-senden').hidden = wallets.length === 0;
  $('sol-keine').hidden = wallets.length > 0;

  if (wallets.length) {
    // Bei mehreren Wallets darf man wählen, bei einer wäre das nur Ballast.
    const wahl = $('sol-wahl');
    const mehrere = wallets.length > 1;
    wahl.hidden = !mehrere;
    $('sol-wahl-label').hidden = !mehrere;
    wahl.textContent = '';
    for (const wallet of wallets) {
      const eintrag = document.createElement('option');
      eintrag.textContent = wallet.name;
      wahl.append(eintrag);
    }

    const los = $('sol-los');
    los.textContent = mehrere ? 'Senden' : 'Mit ' + wallets[0].name + ' senden';
    los.onclick = () => abschicken(wallets);

    umrechnungZeigen();
  }

  dialog.showModal();
}
