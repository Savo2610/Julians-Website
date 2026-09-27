// Was sich beide Dialoge auf dieser Seite teilen.

// Schließen-Knopf und Klick auf den dunklen Rand.
//
// Der Rand ist die heikle Hälfte: eine Prüfung auf „Ziel ist der Dialog“ trifft
// auch das Innenpolster des Fensters und jedes Markieren, das über die Kante
// hinausrutscht – das Fenster ging dann bei fast jedem Klick zu. Deshalb muss
// der Klick draußen beginnen *und* enden.
export function schliessbar(dialog, zuKnopf) {
  zuKnopf.addEventListener('click', () => dialog.close());

  const draussen = (ereignis) => {
    const flaeche = dialog.getBoundingClientRect();
    return (
      ereignis.clientX < flaeche.left ||
      ereignis.clientX > flaeche.right ||
      ereignis.clientY < flaeche.top ||
      ereignis.clientY > flaeche.bottom
    );
  };

  // detail > 0 grenzt echte Mausklicks von Tastatur-Auslösungen ab, die
  // ohne Koordinaten kommen und sonst als „draußen“ gälten.
  let vonDraussen = false;

  dialog.addEventListener('mousedown', (ereignis) => {
    vonDraussen = ereignis.detail > 0 && draussen(ereignis);
  });

  dialog.addEventListener('click', (ereignis) => {
    const schliessen = vonDraussen && ereignis.detail > 0 && draussen(ereignis);
    vonDraussen = false;
    if (schliessen) dialog.close();
  });
}
