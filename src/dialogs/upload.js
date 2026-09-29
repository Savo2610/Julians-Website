// Der Briefkasten in klein, gleich im Dialog.
//
// Die volle Fassung steht auf upload.veerka.mp. Sie dort in ein iframe zu
// holen geht nicht – die Seite steht auf X-Frame-Options: DENY – und sie
// gehörte mit 2FA, Vorschaubildern und Kontingentanzeige auch nicht in ein
// 24-rem-Fenster. Also spricht dieser Code direkt mit der API von dort.
//
// Damit der Browser das darf, gibt der Uploader seine Einwurf-Routen nach
// veerka.mp heraus (CORS). Erlaubt ist dabei genau der Weg hinein: anmelden,
// Teilstücke schicken, zusammensetzen lassen. Freischalten per 2FA gehört
// nicht dazu, hier gilt also immer das anonyme Limit von 50 MB pro Datei.
// Wer mehr braucht, geht über den Link im Fenster auf die volle Seite.

import { schliessbar } from './dialog.js';

// Beim lokalen Entwickeln der Uploader daneben (npm run dev dort, Port 8788).
// Sonst landeten Probe-Uploads im echten Bucket.
const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? 'http://localhost:8788'
  : 'https://upload.veerka.mp';

// Wie viele Teilstücke gleichzeitig laufen. Mehr macht die Leitung selten
// schneller, kostet aber im Worker Arbeitsspeicher.
const GLEICHZEITIG = 3;

const $ = (id) => document.getElementById(id);

// Ausgewählte Dateien, je als { datei, zeile, stand, balken }.
let dateien = [];
let grenzen = null;
let vorbereitet = false;
let laeuft = false;

// Was in dieser Sitzung des Fensters angekommen ist. Beim Schließen geht es
// als Ereignis 'rohrpost' ans Tal, das die Kapseln dann verschickt – je
// Datei (und je Text) eine. Gescheitert zählt, was beim Schließen noch mit
// Fehler in der Liste steht: ein zweiter, geglückter Versuch löscht ihn.
let angekommen = 0;
let textGescheitert = false;
// Das erste Bild, das durchkam: es steht danach kurz im Eis der Quelle, nur
// in diesem Browser. Kein SVG – das Tal zeigt nur, was ein Foto ist.
let bild = null;
const istBild = (datei) => /^image\//.test(datei.type) && datei.type !== 'image/svg+xml';

function groesse(zahl) {
  if (zahl >= 1024 ** 3) return (zahl / 1024 ** 3).toFixed(1) + ' GB';
  if (zahl >= 1024 ** 2) return Math.round(zahl / 1024 ** 2) + ' MB';
  if (zahl >= 1024) return Math.round(zahl / 1024) + ' KB';
  return zahl + ' B';
}

function melden(text, art) {
  const status = $('up-status');
  status.hidden = !text;
  status.textContent = text || '';
  status.dataset.art = art || '';
}

// ── Mit dem Briefkasten reden ───────────────────────────────────────────────

async function api(pfad, koerper) {
  const antwort = await fetch(API + pfad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(koerper),
  });
  let daten = null;
  try { daten = await antwort.json(); } catch (_) { /* gleich als Fehler */ }
  if (!antwort.ok) throw new Error(daten?.error || `Server antwortete mit ${antwort.status}`);
  return daten;
}

// Teilstücke gehen bewusst über XMLHttpRequest: nur das liefert echten
// Sende-Fortschritt, fetch meldet erst das Ende.
function teilSenden(ticket, nummer, stueck, fortschritt) {
  return new Promise((fertig, gescheitert) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API}/api/upload/part?upload=${encodeURIComponent(ticket)}&part=${nummer}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) fortschritt(e.loaded); };
    xhr.onload = () => {
      let daten = null;
      try { daten = JSON.parse(xhr.responseText); } catch (_) { /* s. u. */ }
      if (xhr.status >= 200 && xhr.status < 300 && daten) fertig(daten);
      else gescheitert(new Error(daten?.error || `Teil ${nummer} abgelehnt (${xhr.status})`));
    };
    xhr.onerror = () => gescheitert(new Error('Verbindung unterbrochen'));
    xhr.send(stueck);
  });
}

function fehlerZeigen(eintrag) {
  eintrag.zeile.dataset.stand = 'fehler';
  eintrag.stand.textContent = '✗';
  eintrag.stand.title = eintrag.fehler;
}

async function dateiSenden(eintrag) {
  const datei = eintrag.datei;
  let ticket = null;

  eintrag.fehler = null;
  eintrag.weg.hidden = true;
  eintrag.rahmen.hidden = false;
  eintrag.zeile.dataset.stand = 'laeuft';
  eintrag.stand.textContent = '0 %';
  eintrag.stand.title = '';

  try {
    // 1. Anmelden. Hier entscheidet der Server über Limit und Kontingent.
    const start = await api('/api/upload/init', {
      fileName: datei.name,
      size: datei.size,
      contentType: datei.type || 'application/octet-stream',
    });
    ticket = start.upload;

    // 2. In Teilstücke zerlegen und hochladen.
    const anzahl = start.partCount;
    const teilGroesse = start.partSize;
    const geschafft = new Array(anzahl).fill(0);
    const teile = new Array(anzahl);

    const zeichnen = () => {
      const gesendet = geschafft.reduce((a, b) => a + b, 0);
      const anteil = datei.size ? Math.min(1, gesendet / datei.size) : 1;
      eintrag.balken.style.width = anteil * 100 + '%';
      eintrag.stand.textContent = Math.floor(anteil * 100) + ' %';
    };

    let naechstes = 0;
    const arbeiter = async () => {
      while (true) {
        const i = naechstes++;
        if (i >= anzahl) return;
        const stueck = datei.slice(i * teilGroesse, Math.min((i + 1) * teilGroesse, datei.size));
        const ergebnis = await teilSenden(ticket, i + 1, stueck, (gesendet) => {
          geschafft[i] = gesendet;
          zeichnen();
        });
        teile[i] = { partNumber: ergebnis.partNumber, etag: ergebnis.etag };
        geschafft[i] = stueck.size;
        zeichnen();
      }
    };

    await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, anzahl) }, arbeiter));

    // 3. Zusammensetzen lassen.
    eintrag.stand.textContent = 'wird abgelegt';
    await api('/api/upload/complete', { upload: ticket, parts: teile });

    eintrag.zeile.dataset.stand = 'fertig';
    eintrag.stand.textContent = '✓';
    eintrag.balken.style.width = '100%';
    return true;
  } catch (fehler) {
    // Am Eintrag, nicht nur am Kästchen: gescheiterte Dateien bleiben stehen,
    // und die Liste wird danach neu gezeichnet.
    eintrag.fehler = fehler?.message || String(fehler);
    fehlerZeigen(eintrag);
    eintrag.weg.hidden = false;

    // Angefangenen Upload aufräumen, damit er kein Kontingent blockiert.
    if (ticket) api('/api/upload/abort', { upload: ticket }).catch(() => {});
    return false;
  }
}

// ── Auswahl ─────────────────────────────────────────────────────────────────

const grenzeProDatei = () => grenzen?.maxFileBytes ?? 50 * 1024 * 1024;

// Zwei Dateien gelten als dieselbe, wenn Name, Größe und Änderungszeit
// übereinstimmen – sonst läge eine versehentlich doppelt gewählte zweimal drin.
const gleich = (a, b) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function waehlen(neue) {
  const zuGross = [];

  for (const datei of neue) {
    if (datei.size > grenzeProDatei()) { zuGross.push(datei); continue; }
    if (dateien.some((e) => gleich(e.datei, datei))) continue;
    dateien.push({ datei });
  }

  listeZeichnen();
  knopfPruefen();

  if (zuGross.length) {
    melden(
      `Zu groß für hier (über ${groesse(grenzeProDatei())}): ` +
      zuGross.map((d) => d.name).join(', ') +
      '. Das geht auf upload.veerka.mp.',
      'fehler',
    );
  }
}

// Kein innerHTML: ein Dateiname darf spitze Klammern enthalten und stünde
// sonst als HTML in der Seite.
function listeZeichnen() {
  const liste = $('up-liste');
  liste.textContent = '';
  liste.hidden = dateien.length === 0;

  for (const eintrag of dateien) {
    const zeile = document.createElement('li');
    zeile.className = 'up-datei';

    const kopf = document.createElement('div');
    kopf.className = 'up-kopfzeile';

    const name = document.createElement('span');
    name.className = 'up-name';
    name.textContent = eintrag.datei.name;
    name.title = eintrag.datei.name;

    const stand = document.createElement('span');
    stand.className = 'up-groesse';
    stand.textContent = groesse(eintrag.datei.size);

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'up-weg';
    weg.textContent = '×';
    weg.title = 'Entfernen';
    // Über die Datei selbst entfernen, nicht über den Index: der stimmt nicht
    // mehr, sobald davor etwas herausgefallen ist.
    weg.addEventListener('click', () => {
      dateien = dateien.filter((e) => e !== eintrag);
      listeZeichnen();
      knopfPruefen();
    });

    const rahmen = document.createElement('div');
    rahmen.className = 'up-balken';
    rahmen.hidden = true;
    const balken = document.createElement('i');
    rahmen.append(balken);

    kopf.append(name, stand, weg);
    zeile.append(kopf, rahmen);
    liste.append(zeile);

    Object.assign(eintrag, { zeile, stand, weg, rahmen, balken });
    if (eintrag.fehler) fehlerZeigen(eintrag);
  }
}

function knopfPruefen() {
  $('up-los').disabled = laeuft || (dateien.length === 0 && !$('up-notiz').value.trim());
}

// ── Senden ──────────────────────────────────────────────────────────────────

async function senden() {
  const notiz = $('up-notiz').value.trim();
  if (laeuft || (!dateien.length && !notiz)) return;

  laeuft = true;
  knopfPruefen();
  $('up-los').textContent = 'Läuft …';
  melden('');

  // Erst der Text: der ist in einem Rutsch durch und wäre sonst nach einem
  // langen Datei-Upload immer noch nicht abgeschickt.
  let textFehler = null;
  if (notiz) {
    try {
      await api('/api/note', { text: notiz });
      $('up-notiz').value = '';
      angekommen++;
    } catch (fehler) {
      textFehler = fehler;
    }
    textGescheitert = !!textFehler;
  }

  const gescheitert = [];
  for (const eintrag of dateien) {
    if (!(await dateiSenden(eintrag))) gescheitert.push(eintrag);
    else if (!bild && istBild(eintrag.datei)) bild = eintrag.datei;
  }

  // Was durch ist, verschwindet aus der Liste; was nicht, bleibt zum
  // Nochmal-Versuchen stehen.
  const geschafft = dateien.length - gescheitert.length;
  angekommen += geschafft;
  dateien = gescheitert;
  $('up-auswahl').value = '';
  listeZeichnen();

  laeuft = false;
  $('up-los').textContent = 'Senden';
  knopfPruefen();

  const probleme = [];
  if (textFehler) probleme.push('Der Text ging nicht: ' + textFehler.message);
  if (gescheitert.length) probleme.push(`${gescheitert.length} nicht angekommen – nochmal senden?`);

  if (probleme.length) melden(probleme.join(' · '), 'fehler');
  else melden(geschafft > 1 ? 'Alles angekommen. Danke!' : 'Angekommen. Danke!', 'gut');

  grenzenHolen();
}

// ── Aufbau ──────────────────────────────────────────────────────────────────

// Was gerade gilt, sagt der Server – nicht dieser Code. Kommt die Auskunft
// nicht, bleibt der Standardtext stehen und das Limit greift ohnehin beim
// Anmelden der Datei.
async function grenzenHolen() {
  try {
    const antwort = await fetch(API + '/api/status');
    if (!antwort.ok) return;
    grenzen = await antwort.json();
  } catch (_) {
    return;
  }

  const teile = ['bis ' + groesse(grenzen.maxFileBytes) + ' pro Datei'];
  if (typeof grenzen.filesRemainingToday === 'number') {
    teile.push(`noch ${grenzen.filesRemainingToday} heute frei`);
  }
  $('up-grenze').textContent = teile.join(' · ');
}

function verdrahten() {
  if (vorbereitet) return;
  vorbereitet = true;

  schliessbar($('up-dialog'), $('up-zu'));
  $('up-dialog').addEventListener('close', () => {
    const gescheitert = dateien.filter((e) => e.fehler).length + (textGescheitert ? 1 : 0);
    dispatchEvent(new CustomEvent('rohrpost', { detail: { angekommen, gescheitert, bild } }));
    angekommen = 0;
    textGescheitert = false;
    bild = null;
  });

  const auswahl = $('up-auswahl');
  auswahl.addEventListener('change', () => {
    waehlen([...auswahl.files]);
    // Zurücksetzen, sonst meldet sich dieselbe Datei beim zweiten Mal nicht.
    auswahl.value = '';
  });

  const zone = $('up-zone');
  for (const art of ['dragenter', 'dragover']) {
    zone.addEventListener(art, (ereignis) => {
      ereignis.preventDefault();
      zone.dataset.zieht = '';
    });
  }
  for (const art of ['dragleave', 'drop']) {
    zone.addEventListener(art, () => { delete zone.dataset.zieht; });
  }
  zone.addEventListener('drop', (ereignis) => {
    ereignis.preventDefault();
    waehlen([...(ereignis.dataTransfer?.files || [])]);
  });

  const notiz = $('up-notiz');
  notiz.addEventListener('input', () => {
    const hoechstens = grenzen?.maxNoteChars ?? 20_000;
    if (notiz.value.length > hoechstens) notiz.value = notiz.value.slice(0, hoechstens);
    knopfPruefen();
  });

  $('up-los').addEventListener('click', senden);

  grenzenHolen();
}

export function oeffnen() {
  verdrahten();
  melden('');
  knopfPruefen();
  $('up-dialog').showModal();
}
