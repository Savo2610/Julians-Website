// Der Kurzlink-Dienst in klein, gleich im Dialog.
//
// Die volle Fassung steht auf s.veerka.mp. Hier stecken Feld, Knopf und
// Ergebnis – der QR-Code bleibt drüben, sein Encoder ist eine getestete
// Datei im anderen Projekt und hätte hier nur eine zweite, ungetestete
// Kopie ergeben.
//
// Anders als beim Briefkasten musste an der API dafür nichts geöffnet
// werden: sie antwortet allen (CORS `*`). Der Türsteher ist Turnstile –
// das Widget lädt nur auf Seiten, die im Dashboard eingetragen sind, und
// der Worker prüft am Ende nochmal, von welchem Hostnamen das Token kommt.
// Deshalb reicht ein fremdes Abtippen dieses Codes nicht.

import { schliessbar } from './dialog.js';

// Beim lokalen Entwickeln der Kurzlink-Worker daneben. Port 8790, weil 8787
// diese Seite selbst ist und 8788 der Uploader.
const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? 'http://localhost:8790'
  : 'https://s.veerka.mp';

const $ = (id) => document.getElementById(id);

let vorbereitet = false;
let widget = null;
let token = null;
let laeuft = false;

function melden(text, art) {
  const status = $('kz-status');
  status.hidden = !text;
  status.textContent = text || '';
  status.dataset.art = art || '';
}

function bereit(an) {
  const los = $('kz-los');
  los.disabled = !an;
  los.textContent = an ? 'Kürzen' : 'Moment…';
}

// ── Turnstile ───────────────────────────────────────────────────────────────

// Cloudflare bekommt erst etwas zu sehen, wenn jemand die Kachel antippt:
// das Skript wird hier nachgeladen, nicht im <head> der Startseite.
function skriptLaden(sitekey) {
  return new Promise((fertig, gescheitert) => {
    // Das Skript ruft beim Laden einen globalen Namen auf. Er steht hier
    // nur zwischen Anfang und Ende des Ladens.
    window.__kzBereit = () => {
      delete window.__kzBereit;
      widget = turnstile.render('#kz-ts', {
        sitekey,
        action: 'shorten',
        theme: 'dark',
        appearance: 'interaction-only',
        callback: (t) => { token = t; },
        'expired-callback': () => { token = null; },
        'error-callback': () => { token = null; },
      });
      fertig();
    };

    const skript = document.createElement('script');
    skript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      + '?onload=__kzBereit&render=explicit';
    skript.async = true;
    skript.onerror = () => gescheitert(new Error('Skript nicht geladen'));
    document.head.append(skript);
  });
}

// Das Token kommt asynchron. Wer schneller tippt als Turnstile rechnet,
// wartet hier kurz, statt einen Fehler zu sehen.
async function aufToken(ms = 8000) {
  const bis = Date.now() + ms;
  while (!token && Date.now() < bis) await new Promise((r) => setTimeout(r, 150));
  return token;
}

async function vorbereiten() {
  let konfig;
  try {
    const antwort = await fetch(API + '/api/config');
    if (!antwort.ok) throw new Error(`Server antwortete mit ${antwort.status}`);
    konfig = await antwort.json();
  } catch (_) {
    melden('Der Dienst ist gerade nicht erreichbar.', 'fehler');
    return;
  }

  if (!konfig.open) return melden('Anlegen ist gerade abgeschaltet.', 'fehler');
  if (!konfig.sitekey) return melden('Die Prüfung ist noch nicht eingerichtet.', 'fehler');

  try {
    await skriptLaden(konfig.sitekey);
  } catch (_) {
    // Meistens ein Blocker im Browser. Auf der vollen Seite steht dasselbe
    // Widget, aber dort merkt man wenigstens, woran es liegt.
    melden('Die Prüfung von Cloudflare lädt nicht – vermutlich ein Blocker. '
      + 'Über s.veerka.mp geht es trotzdem.', 'fehler');
    return;
  }

  bereit(true);
}

// ── Zwischenablage ──────────────────────────────────────────────────────────

function kopiertZeigen() {
  const knopf = $('kz-kopieren');
  knopf.textContent = 'Kopiert';
  setTimeout(() => { knopf.textContent = 'Kopieren'; }, 1600);
}

async function kopieren(text) {
  try {
    await navigator.clipboard.writeText(text);
    kopiertZeigen();
    return true;
  } catch (_) {
    return false; // ohne Nutzergeste oder ohne Berechtigung
  }
}

// Safari verlangt, dass der Schreibbefehl noch in der Nutzergeste steht – nach
// dem await auf die Antwort ist sie verbraucht. Deshalb geht synchron im Klick
// ein ClipboardItem raus, dessen Inhalt erst später eintrifft. Wo das fehlt,
// greift nach der Antwort der einfache Weg.
function ablageBelegen(versprechen) {
  if (!window.ClipboardItem || !navigator.clipboard?.write) return Promise.resolve(false);
  try {
    const blob = versprechen.then((text) => new Blob([text], { type: 'text/plain' }));
    // Scheitert das Kürzen, scheitert auch dieses Versprechen. Ob die
    // Zwischenablage es je anfasst, ist Browsersache – ohne den Fänger hier
    // landet die Ablehnung sonst als roter Konsolenfehler.
    blob.catch(() => {});
    return navigator.clipboard
      .write([new ClipboardItem({ 'text/plain': blob })])
      .then(() => true, () => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

// ── Kürzen ──────────────────────────────────────────────────────────────────

async function kuerzen(eingabe) {
  const t = await aufToken();
  if (!t) throw new Error('Prüfung noch nicht fertig. Nochmal antippen.');

  const antwort = await fetch(API + '/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Turnstile-Response': t },
    body: JSON.stringify({ url: eingabe }),
  });
  let daten = null;
  try { daten = await antwort.json(); } catch (_) { /* gleich als Fehler */ }
  if (!antwort.ok) throw new Error(daten?.error || `Server antwortete mit ${antwort.status}`);
  return daten.short;
}

function absenden(ereignis) {
  ereignis.preventDefault();
  if (laeuft) return;

  const eingabe = $('kz-url').value.trim();
  if (!eingabe) return;

  laeuft = true;
  melden('');
  $('kz-out').hidden = true;
  $('kz-los').disabled = true;
  $('kz-los').textContent = 'Kürzen…';

  const versprechen = kuerzen(eingabe);
  const belegt = ablageBelegen(versprechen); // muss synchron hier stehen
  // Gefangen wird der Fehler erst unten im try. Bis dahin hinge die
  // Ablehnung ungelesen in der Luft und der Browser meldete sie.
  versprechen.catch(() => {});

  (async () => {
    try {
      const kurz = await versprechen;
      const feld = $('kz-kurz');
      feld.textContent = kurz.replace(/^https:\/\//, '');
      feld.href = kurz;
      $('kz-out').hidden = false;
      // Kürzen kopiert gleich mit, wie auf der vollen Seite.
      if (await belegt) kopiertZeigen();
      else await kopieren(kurz);
    } catch (fehler) {
      melden(fehler.message, 'fehler');
    } finally {
      laeuft = false;
      // Turnstile-Token sind einmalig – für den nächsten Link ein frischer.
      token = null;
      if (widget !== null) turnstile.reset(widget);
      bereit(true);
    }
  })();
}

// ── Aufbau ──────────────────────────────────────────────────────────────────

function verdrahten() {
  if (vorbereitet) return;
  vorbereitet = true;

  schliessbar($('kz-dialog'), $('kz-zu'));
  $('kz-form').addEventListener('submit', absenden);
  $('kz-kopieren').addEventListener('click', async () => {
    if (!(await kopieren($('kz-kurz').href))) {
      melden('Kopieren ging nicht – Link antippen und halten.', 'fehler');
    }
  });

  vorbereiten();
}

export function oeffnen() {
  verdrahten();
  $('kz-dialog').showModal();
}
