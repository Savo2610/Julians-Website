import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { linklisteHtml } from './src/menu/linkliste.js'

// Die Linkliste fuer Besucher ohne Tal steht fertig im HTML, gebaut aus
// denselben Kacheln wie die Uebersicht (src/menu/linkliste.js). Fehlt die
// Marke in index.html, bricht der Build ab, statt still ohne Liste zu bauen.
const linkliste = {
  name: 'linkliste',
  transformIndexHtml(html, { path }) {
    // Nur die Startseite; der Kabelsee unter /kabelsee/ hat keine Linkliste.
    if (path !== '/index.html') return html
    if (!html.includes('<!-- linkliste -->')) throw new Error('index.html: <!-- linkliste --> fehlt')
    return html.replace('<!-- linkliste -->', linklisteHtml())
  },
}

// Three.js als eigenes Stueck: es aendert sich nie, das Tal dauernd. Getrennt
// bleiben seine 145 kB (gzip) im Browser-Cache, wenn nur eine Station neu
// ist, und es kommen 70 kB statt 214 kB neu uebers Netz.
export default defineConfig({
  plugins: [linkliste],
  // Die Bestenliste lebt im Worker. Lokal laeuft er mit `npm run dev:api`
  // auf 8787 (eigene D1 unter .wrangler/), vite reicht /api dorthin durch.
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      // Zwei Seiten: das Tal und der Kabelsee fuer sich (veerka.mp/kabelsee/).
      // Im Tal wird der See ohnehin nachgeladen; die eigene Seite teilt sich
      // mit ihm Three.js und alle Stuecke des Sees.
      input: {
        tal: fileURLToPath(new URL('./index.html', import.meta.url)),
        kabelsee: fileURLToPath(new URL('./kabelsee/index.html', import.meta.url)),
      },
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
})
