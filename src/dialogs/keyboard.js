import { TOUCH } from '../core/device.js'

// Die drei Fenster ohne Maus.
//
// Die Fenster selbst sind von veerka.mp uebernommen und bleiben dort
// wortgleich; was das Skigebiet zusaetzlich braucht, steht hier und wird
// nach dem Oeffnen drueber gelegt. Ohne das landete der Fokus auf dem
// Schliessen-Knopf – dem ersten Knopf im Fenster –, und wer mit Enter an
// die Station gekommen war, musste erst zur Maus greifen, um einen Betrag
// oder eine Adresse einzutippen.
//
// - Der Fokus liegt gleich im Feld, um das es geht.
// - Enter schickt ab, wo ein Feld sonst nichts damit anfaengt: im Betrag
//   bei Solana, mit Cmd/Strg im Textfeld der Rohrpost. Der Kurzlink ist ein
//   Formular, dort tut Enter das schon von selbst.
// - Pfeil hoch/runter im Betrag geht die vorgeschlagenen Betraege durch.
// - Esc schliesst, das kann <dialog> selbst.
// - Unten steht dieselbe Tastenzeile wie unter der Stationsauswahl.
//
// Beim Schliessen wird der Fokus abgegeben. Sonst bliebe er auf dem Knopf,
// der das Fenster geoeffnet hat, und das naechste Enter fuer das Spiel
// wuerde den Knopf ein zweites Mal ausloesen.

const $ = (id) => document.getElementById(id)
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'strg'

const FENSTER = {
  'sol-dialog': {
    start: () => ($('sol-senden').hidden ? document.querySelector('#sol-keine a') : $('sol-betrag')),
    // Ohne Wallet gibt es nichts zu senden, nur die Empfehlung.
    tasten: () => ($('sol-senden').hidden
      ? '<kbd class="k-enter">⏎</kbd> Solflare öffnen <i></i> <kbd>esc</kbd> zurück'
      : '<kbd class="k-enter">⏎</kbd> senden <i></i> <kbd>↑</kbd><kbd>↓</kbd> Betrag <i></i> <kbd>esc</kbd> zurück'),
    verdrahten() {
      const feld = $('sol-betrag')
      feld.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault()
          if (!$('sol-los').disabled) $('sol-los').click()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const chips = [...$('sol-chips').querySelectorAll('button')]
          if (!chips.length) return
          const jetzt = chips.findIndex((c) => c.dataset.betrag === feld.value)
          const schritt = e.key === 'ArrowUp' ? 1 : -1
          const i = jetzt < 0 ? (schritt > 0 ? 0 : chips.length - 1)
            : Math.min(chips.length - 1, Math.max(0, jetzt + schritt))
          chips[i].click()
          feld.select()
        }
      })
    },
  },
  'up-dialog': {
    start: () => $('up-auswahl'),
    tasten: () => `<kbd>tab</kbd> weiter <i></i> <kbd>${MOD}</kbd><kbd class="k-enter">⏎</kbd> senden <i></i> <kbd>esc</kbd> zurück`,
    verdrahten() {
      $('up-notiz').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          if (!$('up-los').disabled) $('up-los').click()
        }
      })
    },
  },
  'kz-dialog': {
    start: () => $('kz-url'),
    tasten: () => '<kbd class="k-enter">⏎</kbd> kürzen <i></i> <kbd>esc</kbd> zurück',
    verdrahten() {},
  },
}

const fertig = new Set()

export function mitTastatur(id) {
  const dialog = $(id)
  const art = FENSTER[id]
  if (!dialog || !art) return
  if (!fertig.has(id)) {
    fertig.add(id)
    art.verdrahten()
    if (!TOUCH) {
      const zeile = document.createElement('p')
      zeile.className = 'dialog-tasten'
      dialog.append(zeile)
    }
    dialog.addEventListener('close', () => document.activeElement?.blur())
  }
  // Am Handy nicht: dort hiesse Fokus im Feld, dass sofort die Tastatur
  // hochklappt und das halbe Fenster verdeckt.
  if (TOUCH || !dialog.open) return
  dialog.querySelector('.dialog-tasten').innerHTML = art.tasten()
  const ziel = art.start()
  ziel?.focus({ preventScroll: true })
  if (ziel instanceof HTMLInputElement && ziel.type === 'text') ziel.select()
}
