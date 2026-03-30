/**
 * Playground Template — Grudge Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  HOW TO PORT A BABYLON.JS PLAYGROUND SNIPPET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  STEP 1 — Copy this file to your new example folder.
 *
 *  STEP 2 — Add ONE import at the very top:
 *
 *    import '../../src/babylon-full'
 *
 *    This registers EVERY loader (GLB, FBX, OBJ, STL, SPLAT),
 *    EVERY material (Sky, Water, Grid, Fire, Lava…),
 *    EVERY post-process (MotionBlur, VLS, SSR…),
 *    physics, audio, XR, KTX2, shadow maps — the whole CDN bundle.
 *
 *  STEP 3 — Paste your playground `createScene` function.
 *    • Change  var createScene = function () {
 *      to      async function createScene() {
 *    • Change  var / let  BABYLON.X  →  import { X } from '@babylonjs/core/...'
 *      OR just destructure from the BABYLON namespace:
 *        import { BABYLON } from '../../../src/babylon-full'
 *        const { Engine, Scene, Vector3 } = BABYLON
 *
 *  STEP 4 — Wire up canvas / engine (shown below — already done for you).
 *
 *  STEP 5 — Update vite.config.ts + index.html gallery card.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PACKAGE → CLASS MAP  (where to import each playground class from)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Engine / WebGPUEngine           @babylonjs/core/Engines/...
 *  Scene                           @babylonjs/core/scene
 *  Vector2/3/4, Color3/4, Matrix   @babylonjs/core/Maths/math.*
 *  MeshBuilder                     @babylonjs/core/Meshes/meshBuilder
 *  StandardMaterial / PBR          @babylonjs/core/Materials/...
 *  Texture / CubeTexture           @babylonjs/core/Materials/Textures/...
 *  NodeMaterial                    @babylonjs/core/Materials/Node/...
 *  ArcRotateCamera / FreeCamera    @babylonjs/core/Cameras/...
 *  HemisphericLight / DirectionalLight @babylonjs/core/Lights/...
 *  ShadowGenerator                 @babylonjs/core/Lights/Shadows/...
 *  ParticleSystem / GPUParticle    @babylonjs/core/Particles/...
 *  AnimationGroup / Animation      @babylonjs/core/Animations/...
 *  SceneLoader                     @babylonjs/core/Loading/sceneLoader
 *  GlowLayer / HighlightLayer      @babylonjs/core/Layers/...
 *  DefaultRenderingPipeline        @babylonjs/core/PostProcesses/RenderPipeline/...
 *  SSAO2RenderingPipeline          @babylonjs/core/PostProcesses/RenderPipeline/...
 *  NodeRenderGraph                 @babylonjs/core/FrameGraph/...
 *  HavokPlugin                     @babylonjs/havok
 *  ─────────────────────────────────────────────────────────────────────────
 *  SkyMaterial / WaterMaterial     @babylonjs/materials/sky | water | ...
 *  GridMaterial                    @babylonjs/materials/grid/gridMaterial
 *  FireMaterial                    @babylonjs/materials/fire/fireMaterial
 *  CellMaterial / LavaMaterial     @babylonjs/materials/cell | lava | ...
 *  ─────────────────────────────────────────────────────────────────────────
 *  WoodProceduralTexture           @babylonjs/procedural-textures/wood/...
 *  MarbleProceduralTexture         @babylonjs/procedural-textures/marble/...
 *  ─────────────────────────────────────────────────────────────────────────
 *  AdvancedDynamicTexture          @babylonjs/gui/2D/advancedDynamicTexture
 *  Button / TextBlock / Slider     @babylonjs/gui/2D/controls/...
 *  ─────────────────────────────────────────────────────────────────────────
 *  MotionBlurPostProcess           @babylonjs/post-processes
 *  VolumetricLightScatteringPostProcess @babylonjs/post-processes
 *  ─────────────────────────────────────────────────────────────────────────
 *  GLTF2Export / STLExport         @babylonjs/serializers
 *  ─────────────────────────────────────────────────────────────────────────
 *  KTX2 compressed textures        auto-decoded via @babylonjs/ktx2decoder
 *  IBL Shadows / Addons helpers    @babylonjs/addons
 */

// ── STEP 1: Full surface import ───────────────────────────────────────────────
// This one line equals the full Babylon.js CDN playground bundle.
import '../../../src/babylon-full'

// ── STEP 2: Import only what you need (tree-shaking still works!) ────────────
import { Engine }           from '@babylonjs/core/Engines/engine'
import { Scene }            from '@babylonjs/core/scene'
import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }   from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'

// ── Loading UI helpers ────────────────────────────────────────────────────────
const overlay   = document.getElementById('loading-overlay')!
const bar       = document.getElementById('loading-bar')!
const status    = document.getElementById('loading-status')!

function setProgress(pct: number, msg: string) {
  bar.style.width    = `${pct}%`
  status.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 600)
}

// ── Engine + Scene ────────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.05, 0.06, 0.09, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ─────────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
camera.lowerRadiusLimit = 2
camera.upperRadiusLimit = 40
camera.wheelDeltaPercentage = 0.01
camera.attachControl(canvas, true)

// ── Light ──────────────────────────────────────────────────────────────────────
new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.9

// ══════════════════════════════════════════════════════════════════════════════
//  PASTE YOUR PLAYGROUND createScene() BODY HERE
//  ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓
// ══════════════════════════════════════════════════════════════════════════════

async function createScene() {
  setProgress(20, 'Building scene…')

  // ── Default demo: a simple coloured sphere + ground ──────────────────────
  const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)
  const gm = new StandardMaterial('gm', scene)
  gm.diffuseColor = new Color3(0.1, 0.12, 0.16)
  ground.material = gm

  const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 1.5, segments: 32 }, scene)
  sphere.position.y = 0.75
  const sm = new StandardMaterial('sm', scene)
  sm.diffuseColor  = new Color3(0.8, 0.4, 0.1)
  sm.specularColor = new Color3(0.5, 0.5, 0.5)
  sphere.material  = sm

  setProgress(100, 'Ready')
  hideOverlay()
  document.getElementById('hud')!.textContent =
    'Playground Template  |  Grudge Engine  |  Replace this scene with your playground code'
}

// ── Init ──────────────────────────────────────────────────────────────────────
createScene()
engine.runRenderLoop(() => scene.render())
