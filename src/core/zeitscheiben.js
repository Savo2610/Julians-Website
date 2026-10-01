// Lange Rechnungen in Scheiben: pause() kehrt sofort zurueck, solange die
// Scheibe ihr Budget noch nicht verbraucht hat, und gibt sonst die
// Ereignisschleife frei. So baut das Tal den Kabelsee waehrend des
// Countdowns am Badesteg, ohne dass der Countdown haengt: am Stueck waren
// es gut 450 ms, also ein Ruck von 27 Bildern.
//
// Freigegeben wird mit scheduler.yield() oder einer MessageChannel-Nachricht,
// nicht mit requestAnimationFrame: der Browser zeichnet zwischen zwei
// Aufgaben, sobald ein Bild faellig ist, und der Bau haengt nicht am
// Bildtakt. Mit rAF zog er sich in einem verdeckten Fenster (1 Bild/s) ueber
// eine Minute hin.
const kanal = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null
const warten = []
if (kanal) kanal.port1.onmessage = () => warten.shift()?.()

function freigeben() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield()
  if (!kanal) return new Promise((weiter) => setTimeout(weiter, 0))
  return new Promise((weiter) => {
    warten.push(weiter)
    kanal.port2.postMessage(0)
  })
}

export function zeitscheiben(budget = 8) {
  let start = performance.now()
  return async () => {
    if (performance.now() - start < budget) return
    await freigeben()
    start = performance.now()
  }
}
