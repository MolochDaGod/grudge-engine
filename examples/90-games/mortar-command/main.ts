/**
 * examples/90-games/mortar-command/main.ts
 *
 * Babylon.js 9 + Grudge Engine port of Mortar Command
 * (originally https://github.com/dgmurphy/mortarcommand)
 *
 * Assets served from:
 *   https://assets.grudge-studio.com/game-assets/mortar-command/
 */

import '@babylonjs/loaders/glTF'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Audio/audioEngine'

import { Engine }          from '@babylonjs/core/Engines/engine'
import { Scene }           from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 }         from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }  from '@babylonjs/core/Maths/math.color'
import { Animation }       from '@babylonjs/core/Animations/animation'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'

import type { MCScene }    from './game/types'
import { MC_SCENE_CLEAR_COLOR, mcAsset } from './game/tableConstants'
import { GAME_PHASES, MAX_ROUNDS, ROUND_PHASES }  from './game/constants'
import { createMaterials } from './game/materials'
import { loadAssets, addGround } from './game/loader'
import { makeBase, addPowerStations } from './game/station'
import { addRound, addThePackage } from './game/agent'
import { addFireListener } from './game/mortars'
import { startAgentAnim } from './game/controller'
import { addLevelControl } from './game/lifecycle'

// ── Canvas + Engine ───────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
window.addEventListener('resize', () => engine.resize())

// ── Scene (cast to MCScene so we can attach game state) ───────────────────
const scene = new Scene(engine) as MCScene
scene.clearColor = new Color4(
  MC_SCENE_CLEAR_COLOR[0],
  MC_SCENE_CLEAR_COLOR[1],
  MC_SCENE_CLEAR_COLOR[2],
  1,
)

// Initialise all MCScene game-state fields
scene.agents               = []
scene.artifacts            = []
scene.powerStations        = []
scene.wreckedStations      = []
scene.liveStations         = 0
scene.rounds               = []
scene.mines                = []
scene.activators           = []
scene.fireTargets          = []
scene.gameFrame            = 0
scene.gamePhase            = GAME_PHASES.startLevel
scene.gameStarted          = false
scene.gameLevel            = 0
scene.gameScore            = 0
scene.hiGameScore          = 0
scene.gameNumber           = 1
scene.gameScores           = []
scene.packagePoints        = 0
scene.nextArtifactId       = 0
scene.mineCounter          = 1
scene.activatorCounter     = 1
scene.activator_score_thresh_set = false
scene.activator_score_thresh = 0
scene.activator_last_score = 0
scene.mortarBoost          = false
scene.mortarBoostFrame     = 0
scene.BLAST_DAMAGE_COEFF   = 3
scene.onUpdateGUI          = () => {}
;(scene as any).mortarTarget = null
;(scene as any).agentsDestroyed = 0

// ── Camera ────────────────────────────────────────────────────────────────
// Top-down RTS-style: positioned above/to the right to match the original
const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 55, Vector3.Zero(), scene)
camera.lowerRadiusLimit  = 20
camera.upperRadiusLimit  = 80
camera.upperBetaLimit    = Math.PI / 2.2
camera.wheelPrecision    = 10
camera.panningSensibility = 200
camera.attachControl(canvas, true)
camera.setTarget(new Vector3(0, 2, 0))

// ── Lighting ──────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.6

const light1 = new DirectionalLight('light1', new Vector3(0.2, -1, 0.2), scene)
light1.position   = new Vector3(0, 30, 0)
light1.intensity  = 1

// ── Materials & ground ────────────────────────────────────────────────────
createMaterials(scene)
addGround(scene)

// ── Allow matrix interpolation for animations ─────────────────────────────
Animation.AllowMatricesInterpolation = true

// ── Terrain click → set mortar target ────────────────────────────────────
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
  const pick = pointerInfo.pickInfo
  if (pick?.hit && pick.pickedPoint) {
    ;(scene as any).mortarTarget = pick.pickedPoint.clone()
  }
})

// ── Asset loading (terrain GLTF + sounds) ────────────────────────────────
loadAssets(scene, () => {
  // All assets ready — build game objects
  makeBase(scene)
  for (let i = 0; i < MAX_ROUNDS; i++) addRound(scene)
  addThePackage(scene)
  addPowerStations(scene)
  startAgentAnim(scene)

  // Reset package/mine counters on scene
  scene.mineCounter     = 1
  scene.activatorCounter = 1
  scene.activator_score_thresh_set = false
  scene.activator_last_score = 0

  // Show "Insert Coin" button
  const loadingText = document.getElementById('loading-text')
  if (loadingText) loadingText.style.display = 'none'
  const startBtn = document.getElementById('start')!
  startBtn.style.display = 'block'
  startBtn.onclick = () => {
    // Unlock audio engine (must be from a user gesture)
    try { (Engine as any).audioEngine?.unlock() } catch (_) {}
    scene.getSoundByName?.('insertCoin')?.play()

    // Remove loading overlay
    const overlay = document.getElementById('loading-overlay')
    if (overlay) overlay.style.display = 'none'

    addLevelControl(scene)
  }

  // Wire up fire keys
  addFireListener(scene)
})

// ── Render loop ───────────────────────────────────────────────────────────
engine.runRenderLoop(() => scene.render())
