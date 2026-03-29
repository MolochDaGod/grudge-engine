/**
 * examples/00-baseline/object-storage-starter/main.ts
 *
 * Baseline scene that demonstrates loading every major asset class
 * from Grudge object storage (assets.grudge-studio.com / R2).
 *
 * Load order & fallback strategy:
 *  1. GLB character model  → voxel/characters/warrior.glb  (fallback: capsule)
 *  2. Terrain texture      → textures/terrain/grass_diffuse.jpg (fallback: solid green)
 *  3. Fire particle flare  → effects/flare.png            (fallback: built-in flare)
 *
 * The #asset-log panel reports ✓/✗ for every remote fetch so it is
 * immediately obvious which object-storage keys are live.
 */

import '@babylonjs/loaders/glTF'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }    from '@babylonjs/core/Maths/math.color'
import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }  from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }   from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }  from '@babylonjs/core/Materials/standardMaterial'
import { Texture }           from '@babylonjs/core/Materials/Textures/texture'
import { ParticleSystem }    from '@babylonjs/core/Particles/particleSystem'
import { SceneLoader }       from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh }      from '@babylonjs/core/Meshes/abstractMesh'

import { Assets } from '../../../src/grudge/assets'

// ── Types ─────────────────────────────────────────────────────────────────────
type AssetStatus = 'pending' | 'ok' | 'err'

interface AssetEntry {
  label: string
  url:   string
  status: AssetStatus
}

// ── Asset log UI ──────────────────────────────────────────────────────────────
const logEl = document.getElementById('asset-log')!

const entries: AssetEntry[] = [
  { label: 'warrior.glb',       url: Assets.voxelChar('warrior'),               status: 'pending' },
  { label: 'grass_diffuse.jpg', url: Assets.texture('terrain/grass_diffuse.jpg'), status: 'pending' },
  { label: 'flare.png',         url: Assets.effect('flare.png'),                status: 'pending' },
]

function renderLog() {
  logEl.innerHTML = entries
    .map(e => {
      const icon = e.status === 'ok' ? '✓' : e.status === 'err' ? '✗' : '…'
      const cls  = e.status
      return `<div class="${cls}">${icon} ${e.label} <span style="color:#3a4060">${e.url}</span></div>`
    })
    .join('')
}

function setStatus(label: string, status: AssetStatus) {
  const entry = entries.find(e => e.label === label)
  if (entry) { entry.status = status; renderLog() }
}

renderLog()

// ── Engine + Scene ────────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.04, 0.05, 0.10, 1)

// Resize handler
window.addEventListener('resize', () => engine.resize())

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 10, Vector3.Zero(), scene)
camera.lowerRadiusLimit  = 3
camera.upperRadiusLimit  = 30
camera.upperBetaLimit    = Math.PI / 2.1
camera.wheelPrecision    = 30
camera.attachControl(canvas, true)

// ── Lighting ──────────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.5

const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
sun.position   = new Vector3(20, 40, 20)
sun.intensity  = 1.4

const shadows = new ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true

// ── Ground ────────────────────────────────────────────────────────────────────
const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60, subdivisions: 4 }, scene)
ground.receiveShadows = true

const groundMat = new StandardMaterial('groundMat', scene)
groundMat.diffuseColor = new Color3(0.18, 0.28, 0.12) // fallback solid green

// ── Asset 2: Grass texture from object storage ────────────────────────────────
const grassUrl = Assets.texture('terrain/grass_diffuse.jpg')
const grassTex = new Texture(grassUrl, scene, false, false, Texture.BILINEAR_SAMPLINGMODE,
  () => {
    // onLoad
    grassTex.uScale = 14
    grassTex.vScale = 14
    groundMat.diffuseTexture = grassTex
    setStatus('grass_diffuse.jpg', 'ok')
  },
  () => setStatus('grass_diffuse.jpg', 'err')
)
ground.material = groundMat

// ── Scatter a few rocks (built-in geometry, no remote asset needed) ───────────
const rockPositions: [number, number][] = [
  [6, 5], [-7, 4], [10, -8], [-5, -6], [3, -12], [-12, 9],
]
for (const [x, z] of rockPositions) {
  const rock = MeshBuilder.CreatePolyhedron(`rock_${x}`, { type: 1, size: 0.4 + Math.random() * 0.6 }, scene)
  rock.position.set(x, 0.3, z)
  rock.rotation.y = Math.random() * Math.PI * 2
  const rm = new StandardMaterial(`rm_${x}`, scene)
  rm.diffuseColor = new Color3(0.38, 0.36, 0.34)
  rock.material = rm
  rock.receiveShadows = true
  shadows.addShadowCaster(rock)
}

// ── Player capsule (fallback for missing GLB) ─────────────────────────────────
const capsule = MeshBuilder.CreateCapsule('player', { radius: 0.4, height: 1.8 }, scene)
capsule.position.y = 0.9
const capMat = new StandardMaterial('capMat', scene)
capMat.diffuseColor = new Color3(0.8, 0.67, 0.3)
capsule.material = capMat
shadows.addShadowCaster(capsule)

// ── Asset 1: GLB character from object storage ────────────────────────────────
const charUrl = Assets.voxelChar('warrior')
const { rootUrl, sceneFilename } = Assets.splitGlb(charUrl)

SceneLoader.ImportMeshAsync('', rootUrl, sceneFilename, scene)
  .then(result => {
    const root = result.meshes[0] as AbstractMesh
    root.parent   = capsule
    root.position.y = -0.9
    root.scaling.setAll(0.8)
    capsule.isVisible = false
    result.meshes.forEach(m => {
      shadows.addShadowCaster(m)
      m.receiveShadows = true
    })
    setStatus('warrior.glb', 'ok')
  })
  .catch(() => {
    capsule.isVisible = true
    setStatus('warrior.glb', 'err')
  })

// ── Asset 3: Fire particle system with object-storage flare ──────────────────
const fireEmitter = MeshBuilder.CreateBox('fireEmitter', { size: 0.1 }, scene)
fireEmitter.isVisible  = false
fireEmitter.position.set(0, 0.5, -5)

const fire = new ParticleSystem('fire', 400, scene)
fire.emitter = fireEmitter

// Try remote flare texture; fall back to Babylon built-in
const flareUrl = Assets.effect('flare.png')
// Probe the URL with a fetch to decide which texture to use
fetch(flareUrl, { method: 'HEAD' })
  .then(r => {
    fire.particleTexture = new Texture(r.ok ? flareUrl : 'https://assets.babylonjs.com/particles/flare.png', scene)
    setStatus('flare.png', r.ok ? 'ok' : 'err')
  })
  .catch(() => {
    fire.particleTexture = new Texture('https://assets.babylonjs.com/particles/flare.png', scene)
    setStatus('flare.png', 'err')
  })

// Fire colour gradient
fire.color1         = new Color4(1.0, 0.5, 0.1, 1.0)
fire.color2         = new Color4(1.0, 0.2, 0.0, 1.0)
fire.colorDead      = new Color4(0.2, 0.1, 0.0, 0.0)
fire.minSize        = 0.3
fire.maxSize        = 0.9
fire.minLifeTime    = 0.4
fire.maxLifeTime    = 1.2
fire.emitRate       = 120
fire.blendMode      = ParticleSystem.BLENDMODE_ONEONE
fire.gravity        = new Vector3(0, 3, 0)
fire.direction1     = new Vector3(-0.4, 1.0, -0.4)
fire.direction2     = new Vector3( 0.4, 1.5,  0.4)
fire.minAngularSpeed = 0
fire.maxAngularSpeed = Math.PI
fire.minEmitPower   = 0.5
fire.maxEmitPower   = 1.5
fire.updateSpeed    = 0.008
fire.start()

// ── Campfire ring of logs ─────────────────────────────────────────────────────
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2
  const log = MeshBuilder.CreateCylinder(`log_${i}`, { diameter: 0.12, height: 0.7 }, scene)
  log.position.set(
    fireEmitter.position.x + Math.cos(angle) * 0.35,
    0.08,
    fireEmitter.position.z + Math.sin(angle) * 0.35,
  )
  log.rotation.z = Math.PI / 2.5
  log.rotation.y = angle
  const lm = new StandardMaterial(`lm_${i}`, scene)
  lm.diffuseColor = new Color3(0.3, 0.18, 0.08)
  log.material = lm
  shadows.addShadowCaster(log)
}

// ── Camera target — orbit around scene centre ─────────────────────────────────
camera.setTarget(new Vector3(0, 1.2, 0))

// ── Render loop ───────────────────────────────────────────────────────────────
engine.runRenderLoop(() => scene.render())
