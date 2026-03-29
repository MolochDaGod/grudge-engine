# Grudge Engine

A reusable **Babylon.js 9** game component library — the Grudge Studio equivalent of [threejs-games.github.io](https://threejs-games.github.io), rebuilt with a production-grade stack and integrated with Grudge backend services.

## Stack

| Layer | Tech |
|---|---|
| Renderer | Babylon.js 9 (WebGL2 / WebGPU) |
| Physics | Babylon Havok (built-in) |
| AI/Nav | Babylon Recast navmesh |
| Build | Vite 5 + TypeScript 5 |
| Auth | Grudge ID (`id.grudge-studio.com`) |
| Assets | Grudge Object Storage (`assets.grudge-studio.com`) |
| Deploy | Vercel |

## Project Structure

```
grudge-engine/
├── src/
│   ├── core/           # Engine abstractions (GrudgeEngine, Actor, StateMachine, Input...)
│   └── grudge/         # Grudge backend integration (auth, api, assets)
├── examples/
│   ├── 20-particles/   # Fire, rain, smoke, snow
│   ├── 30-player/      # Third-person, first-person cameras
│   ├── 45-terrain/     # Heightmap, procedural
│   ├── 65-characters/  # Warrior, Mage, Ranger, Worge
│   ├── 70-ai/          # Patrol, Follow, Wander, Pursue
│   └── 80-scenes/      # Full games: RPG, FPS Arena, etc.
└── index.html          # Gallery landing page
```

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000` for the gallery.

## Environment Variables

```env
VITE_ASSETS_URL=https://assets.grudge-studio.com
VITE_API_URL=https://api.grudge-studio.com
VITE_ID_URL=https://id.grudge-studio.com
VITE_USE_REMOTE_ASSETS=true
```

Set `VITE_USE_REMOTE_ASSETS=false` to use local `/public` assets during development.

## Core API

```ts
import { GrudgeEngine, Actor, InputManager } from './src/core'
import { GrudgeAuth, GrudgeAPI, Assets }      from './src/grudge'

// Boot engine
const grudge = GrudgeEngine.create()

// Resolve asset URLs
const url = Assets.voxelChar('warrior') // → assets.grudge-studio.com/models/voxel/characters/warrior.glb

// Auth
const user = await GrudgeAuth.init()
```

## Babylon Baseline

`src/core/starter.ts` mirrors Babylon's official getting-started scene so new examples start from a known-good baseline before adding Grudge systems.

```ts
import { GrudgeEngine, createBabylonStarterScene } from './src/core'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas' })
const { scene, camera, light, sphere, ground } = createBabylonStarterScene(grudge)

grudge.start()
```

Use this for:
- quick scene bring-up
- validating Babylon upgrades
- creating minimal repros before adding physics/navmesh/AI

---

Made with ❤️ by **Racalvin The Pirate King** — [Grudge Studio](https://grudge-studio.com)
