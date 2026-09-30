import { defineConfig } from 'vite'

// Relativer Pfad, damit der Build auch aus einem Unterordner laeuft (etwa
// GitHub Pages unter /Kabelsee/). three.js als eigenes Stueck: es aendert
// sich nie und bleibt im Browser-Cache, wenn nur das Spiel neu ist.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
})
