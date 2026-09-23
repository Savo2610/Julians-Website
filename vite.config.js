import { defineConfig } from 'vite'

// Three.js als eigenes Stueck: es aendert sich nie, das Tal dauernd. Getrennt
// bleiben seine 145 kB (gzip) im Browser-Cache, wenn nur eine Station neu
// ist, und es kommen 70 kB statt 214 kB neu uebers Netz.
export default defineConfig({
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
