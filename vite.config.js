import { defineConfig } from 'vite'
import { linklisteHtml } from './src/menu/linkliste.js'

// Die Linkliste fuer Besucher ohne Tal steht fertig im HTML, gebaut aus
// denselben Kacheln wie die Uebersicht (src/menu/linkliste.js). Fehlt die
// Marke in index.html, bricht der Build ab, statt still ohne Liste zu bauen.
const linkliste = {
  name: 'linkliste',
  transformIndexHtml(html) {
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
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
})
