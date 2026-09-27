import { defineConfig } from 'vite'

// Three.js als eigenes Stueck: es aendert sich nie, das Tal dauernd. Getrennt
// bleiben seine 145 kB (gzip) im Browser-Cache, wenn nur eine Station neu
// ist, und es kommen 70 kB statt 214 kB neu uebers Netz.
export default defineConfig({
  // Die Bestenliste lebt im Worker. Lokal laeuft er mit `npx wrangler dev`
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
