import { LINKS } from '../stations/links.js'
import { TRAILS } from '../world/paths.js'
import { KACHELN } from './kacheln.js'

// Die Linkliste fuer alle, die das Tal nicht sehen: ohne JavaScript steht
// sie per <noscript> da, ohne WebGL schaltet main.js sie ein. Die alte
// Kachelseite ging ohne beides, das Tal allein blieb beim Ladebalken stehen.
//
// Gebaut wird sie beim Bauen der Seite (vite.config.js) aus denselben
// Kacheln wie die Uebersicht. So stehen die Adressen weiter nur in
// links.js, und Suchmaschinen finden jeden Link im HTML statt eines leeren
// Canvas. Das Aussehen steht inline in index.html, weil es auch ohne
// JavaScript tragen muss.

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function eintrag(k) {
  const href = LINKS[k.link]
  if (!href) throw new Error(`Linkliste: LINKS.${k.link} fehlt`)
  // solana: in einem neuen Tab liesse nur einen leeren Tab zurueck.
  const ziel = href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
  return `<li><a href="${esc(href)}"${ziel}><span class="ll-icon" aria-hidden="true">${esc(k.icon)}</span>`
    + `<span><strong>${esc(k.label)}</strong><small>${esc(k.sub)}</small></span></a></li>`
}

export function linklisteHtml() {
  const gruppen = KACHELN.map((g) => `<section style="--c: ${TRAILS[g.weg]?.color ?? '#5f6f80'}">`
    + `<h2>${esc(g.titel)}</h2><ul>${g.kacheln.map(eintrag).join('')}</ul></section>`)
  return `<main id="linkliste">
      <h1>Julian Veerkamp</h1>
      <p class="ll-wer">Student E-Technik und IT · Feuerwehrmann · Skilehrer</p>
      <p class="ll-warum">Hier liegt eigentlich ein kleines Skital, durch das man zu diesen
        Links fährt. Dein Browser kann es gerade nicht zeigen – dafür braucht es
        JavaScript und WebGL.</p>
      ${gruppen.join('\n      ')}
    </main>`
}
