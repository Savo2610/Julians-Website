// Punktgroessen in den eigenen Partikel-Shadern sind in Geraetepixeln
// angegeben und wurden bei Pixelverhaeltnis 2 abgestimmt. Seit das Bild am
// Desktop auf 4,2 Mio. Pixel gedeckelt ist (main.js), rechnet ein MacBook mit
// 1,5; ohne Ausgleich wuerden Flocken und Staub dort ein Drittel groesser.
// Der Faktor ist gerendertes durch natuerliches Pixelverhaeltnis.
export const pointScale = { value: 1 }
