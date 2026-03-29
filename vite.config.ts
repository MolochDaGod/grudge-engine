import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@grudge': resolve(__dirname, 'src/grudge'),
      '@scenes': resolve(__dirname, 'src/scenes'),
    },
  },
  build: {
    target: 'es2022',
    // Babylon.js is large — raise the chunk warning limit
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Example scenes — each gets its own entry point
        'third-person': resolve(__dirname, 'examples/30-player/third-person/index.html'),
        'rpg-scene':    resolve(__dirname, 'examples/80-scenes/rpg-scene/index.html'),
        'fps-arena':    resolve(__dirname, 'examples/80-scenes/fps-arena/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('@babylonjs')) return 'babylon'
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/gui', '@babylonjs/materials'],
  },
})
