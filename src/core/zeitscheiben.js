// Lange Rechnungen in Scheiben: pause() kehrt sofort zurueck, solange die
// Scheibe ihr Budget noch nicht verbraucht hat, und wartet sonst, bis das
// naechste Bild gezeichnet ist. So baut das Tal den Kabelsee waehrend des
// Countdowns am Badesteg, ohne dass der Countdown haengt: am Stueck waren
// es gut 450 ms, also ein Ruck von 27 Bildern.
//
// Erst requestAnimationFrame, dann setTimeout: der Rueckruf des Bildes
// laeuft vor dem Zeichnen, weiter geht es erst danach.
export function zeitscheiben(budget = 8) {
  let start = performance.now()
  return async () => {
    if (performance.now() - start < budget) return
    await new Promise((weiter) => requestAnimationFrame(() => setTimeout(weiter, 0)))
    start = performance.now()
  }
}
