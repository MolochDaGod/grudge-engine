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
        'playground-template':    resolve(__dirname, 'examples/00-baseline/playground-template/index.html'),

        // Effects
        'webgpu':          resolve(__dirname, 'examples/10-effects/webgpu/index.html'),
        'post-processing': resolve(__dirname, 'examples/10-effects/post-processing/index.html'),
        'water-sky':       resolve(__dirname, 'examples/10-effects/water-sky/index.html'),
        'candle-webgpu':   resolve(__dirname, 'examples/10-effects/candle-webgpu/index.html'),
        'mipmap-lod':      resolve(__dirname, 'examples/10-effects/mipmap-lod/index.html'),

        // Particles
        'fire':                resolve(__dirname, 'examples/20-particles/fire/index.html'),
        'rain':                resolve(__dirname, 'examples/20-particles/rain/index.html'),
        'smoke':               resolve(__dirname, 'examples/20-particles/smoke/index.html'),
        'particle-playground': resolve(__dirname, 'examples/20-particles/playground/index.html'),

        // Player
        'third-person': resolve(__dirname, 'examples/30-player/third-person/index.html'),
        'first-person': resolve(__dirname, 'examples/30-player/first-person/index.html'),

        // Terrain
        'heightmap':  resolve(__dirname, 'examples/45-terrain/heightmap/index.html'),
        'procedural': resolve(__dirname, 'examples/45-terrain/procedural/index.html'),

        // Models
        'weapon-viewer': resolve(__dirname, 'examples/55-models/weapon-viewer/index.html'),

        // Characters
        'character-editor': resolve(__dirname, 'examples/65-characters/character-editor/index.html'),
        'corsair-king':     resolve(__dirname, 'examples/65-characters/corsair-king/index.html'),
        'warrior':          resolve(__dirname, 'examples/65-characters/warrior/index.html'),
        'mage':             resolve(__dirname, 'examples/65-characters/mage/index.html'),
        'ranger':           resolve(__dirname, 'examples/65-characters/ranger/index.html'),

        // AI
        'patrol':  resolve(__dirname, 'examples/70-ai/patrol/index.html'),
        'follow':  resolve(__dirname, 'examples/70-ai/follow/index.html'),
        'wander':  resolve(__dirname, 'examples/70-ai/wander/index.html'),
        'pursue':  resolve(__dirname, 'examples/70-ai/pursue/index.html'),

        // Scenes
        'rpg-scene': resolve(__dirname, 'examples/80-scenes/rpg-scene/index.html'),
        'fps-arena': resolve(__dirname, 'examples/80-scenes/fps-arena/index.html'),

        // Games
        'physics-particles': resolve(__dirname, 'examples/90-games/physics-particles/index.html'),
        'mortar-command':  resolve(__dirname, 'examples/90-games/mortar-command/index.html'),
        'ragdoll-physics': resolve(__dirname, 'examples/90-games/ragdoll-physics/index.html'),
        'fps-arena-grudge': resolve(__dirname, 'examples/90-games/fps-arena-grudge/index.html'),
        'boat-scene':      resolve(__dirname, 'examples/90-games/boat-scene/index.html'),
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
      '@babylonjs/serializers',
      '@babylonjs/inspector',
      '@babylonjs/addons',
      '@babylonjs/ktx2decoder',
      '@babylonjs/viewer',
      '@babylonjs/accessibility',
      'howler',
      'zustand',
      'bitecs',
      'socket.io-client',
      'spectorjs',
    ],
    exclude: ['recast-navigation', 'babel-traverse'],
  },
})
