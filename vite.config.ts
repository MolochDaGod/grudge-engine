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
        // Gallery
        main: resolve(__dirname, 'index.html'),
        // Baseline
        'object-storage-starter': resolve(__dirname, 'examples/00-baseline/object-storage-starter/index.html'),
        // Player
        'third-person':  resolve(__dirname, 'examples/30-player/third-person/index.html'),
        'first-person':  resolve(__dirname, 'examples/30-player/first-person/index.html'),
        // Particles
        'fire':          resolve(__dirname, 'examples/20-particles/fire/index.html'),
        'rain':          resolve(__dirname, 'examples/20-particles/rain/index.html'),
        'smoke':         resolve(__dirname, 'examples/20-particles/smoke/index.html'),
        // Terrain
        'heightmap':     resolve(__dirname, 'examples/45-terrain/heightmap/index.html'),
        'procedural':    resolve(__dirname, 'examples/45-terrain/procedural/index.html'),
        // AI
        'patrol':        resolve(__dirname, 'examples/70-ai/patrol/index.html'),
        'follow':        resolve(__dirname, 'examples/70-ai/follow/index.html'),
        'wander':        resolve(__dirname, 'examples/70-ai/wander/index.html'),
        'pursue':        resolve(__dirname, 'examples/70-ai/pursue/index.html'),
        // Characters
        'warrior':       resolve(__dirname, 'examples/65-characters/warrior/index.html'),
        'mage':          resolve(__dirname, 'examples/65-characters/mage/index.html'),
        'ranger':        resolve(__dirname, 'examples/65-characters/ranger/index.html'),
        // Effects / WebGPU
        'webgpu':           resolve(__dirname, 'examples/10-effects/webgpu/index.html'),
        'post-processing':  resolve(__dirname, 'examples/10-effects/post-processing/index.html'),
        'water-sky':        resolve(__dirname, 'examples/10-effects/water-sky/index.html'),
        // Models
        'weapon-viewer':    resolve(__dirname, 'examples/55-models/weapon-viewer/index.html'),
        // Games
        'rpg-scene':     resolve(__dirname, 'examples/80-scenes/rpg-scene/index.html'),
        'fps-arena':     resolve(__dirname, 'examples/80-scenes/fps-arena/index.html'),
        'mortar-command': resolve(__dirname, 'examples/90-games/mortar-command/index.html'),
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
    include: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/gui',
      '@babylonjs/materials',
      '@babylonjs/post-processes',
      '@babylonjs/procedural-textures',
    ],
    exclude: ['recast-navigation'],
  },
})
