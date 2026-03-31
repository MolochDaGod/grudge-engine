/**
 * Corsair King — Character Animation Demo
 *
 * Loads a GLB character from Grudge R2 RTS set with embedded animations,
 * plus optional UAL retargeted animations.  BJS GUI overlay for switching
 * characters and playing/blending animations.
 *
 * Uses GLB instead of FBX (Babylon.js has no in-browser FBX loader).
 */

import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { autoNormalizeCharacter, retargetAnimationGroup } from '../../../src/core/character'
import { GRUDGE_RACE_MODELS, RACE_MODEL_CDN, RACE_IDS, raceLabel, DEFAULT_RACE, type RaceModelEntry } from '../../../src/core/raceModels'

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }  from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }   from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }    from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial }       from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { SceneLoader }       from '@babylonjs/core/Loading/sceneLoader'
import { AnimationGroup }    from '@babylonjs/core/Animations/animationGroup'
import { Skeleton }          from '@babylonjs/core/Bones/skeleton'
import { AbstractMesh }      from '@babylonjs/core/Meshes/abstractMesh'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { StackPanel }             from '@babylonjs/gui/2D/controls/stackPanel'
import { Button }                 from '@babylonjs/gui/2D/controls/button'
import { Control }                from '@babylonjs/gui/2D/controls/control'

const R2_ANIMS = 'https://assets.grudge-studio.com/models/animations'

// Extra RTS characters (non-race models available on R2 for demo/NPC use)
const EXTRA_CHAR_OPTIONS = [
  { id: 'king',   label: 'King',   file: 'King.glb' },
  { id: 'pirate', label: 'Pirate', file: 'Pirate_Male.glb' },
  { id: 'ninja',  label: 'Ninja',  file: 'Ninja_Male.glb' },
  { id: 'goblin', label: 'Goblin', file: 'Goblin_Male.glb' },
]

// ── Loading UI ────────────────────────────────────────────────────────────
const overlay    = document.getElementById('loading-overlay')!
const loadBar    = document.getElementById('loading-bar')!
const loadStatus = document.getElementById('loading-status')!
const animLabel  = document.getElementById('anim-label')!

function setProgress(pct: number, msg: string) {
  loadBar.style.width = `${pct}%`
  loadStatus.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)
}

// ── Engine ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.04, 0.05, 0.08, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 4, 5, new Vector3(0, 1, 0), scene)
camera.attachControl(canvas, true)
camera.lowerRadiusLimit    = 2
camera.upperRadiusLimit    = 12
camera.wheelDeltaPercentage = 0.01

// ── Lights + shadows ─────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.4; hemi.groundColor = new Color3(0.05, 0.05, 0.08)

const dir = new DirectionalLight('dir01', new Vector3(-0.6, -1, -0.5), scene)
dir.position = new Vector3(4, 8, 4); dir.intensity = 1.5

const shadows = new ShadowGenerator(1024, dir)
shadows.useBlurExponentialShadowMap = true; shadows.blurKernel = 24

// ── Ground ───────────────────────────────────────────────────────────────
const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene)
ground.receiveShadows = true
const gmat = new PBRMaterial('gmat', scene)
gmat.albedoColor = new Color3(0.08, 0.09, 0.12)
gmat.metallic = 0.15; gmat.roughness = 0.9
ground.material = gmat

// ── Post-processing ──────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [camera])
pip.fxaaEnabled  = true
pip.bloomEnabled = true; pip.bloomThreshold = 0.5; pip.bloomWeight = 0.3
pip.imageProcessingEnabled = true
pip.imageProcessing.contrast = 1.15; pip.imageProcessing.exposure = 1.1

// ── Animation state ──────────────────────────────────────────────────────
let charMeshes:    AbstractMesh[]   = []
let skeleton:      Skeleton | null  = null
let embedded:      AnimationGroup[] = []
let retargeted:    AnimationGroup[] = []
let current:       AnimationGroup | null = null
let ualLoaded    = false
let ualSrcGroups: AnimationGroup[] = []
let animPanel:     StackPanel | null = null

function play(group: AnimationGroup, loop = true) {
  current?.stop()
  current = group
  group.start(loop)
  animLabel.textContent = group.name.replace(/_retargeted$/, '')
}

function playBlend(a: AnimationGroup, b: AnimationGroup) {
  current?.stop(); current = null
  a.start(true, 0.5); b.start(true, 0.5)
  animLabel.textContent = `${a.name} + ${b.name}`
}

// ── Load UAL animation library ───────────────────────────────────────────
async function ensureUAL(): Promise<void> {
  if (ualLoaded) return
  ualLoaded = true
  try {
    const before = scene.animationGroups.length
    const res = await SceneLoader.ImportMeshAsync('', `${R2_ANIMS}/`, 'UAL1_Standard.glb', scene)
    res.meshes.forEach(m => { m.setEnabled(false); m.isPickable = false })
    ualSrcGroups = scene.animationGroups.slice(before)
    ualSrcGroups.forEach(g => g.stop())
  } catch (e) { console.warn('UAL load failed:', e) }
}

function refreshAnims() {
  if (!animPanel) return
  animPanel.clearControls()
  const all = [...embedded, ...retargeted]
  for (const g of all) {
    const cleanName = g.name.replace(/_retargeted$/, '').replace(/_/g, ' ')
    const btn = Button.CreateSimpleButton(`anim_${g.name}`, cleanName)
    btn.paddingTop = '4px'; btn.width = '140px'; btn.height = '30px'
    btn.color = '#c4c8d8'; btn.background = '#161a24'; btn.cornerRadius = 3; btn.thickness = 1
    btn.hoverCursor = 'pointer'
    btn.onPointerEnterObservable.add(() => { btn.background = '#3a4060' })
    btn.onPointerOutObservable.add(()  => { btn.background = '#161a24' })
    btn.onPointerDownObservable.add(() => play(g))
    animPanel.addControl(btn)
  }
  if (all.length >= 2) {
    const btn = Button.CreateSimpleButton('blend', '⚡ Blend 1+2')
    btn.paddingTop = '6px'; btn.width = '140px'; btn.height = '34px'
    btn.color = '#c8a84b'; btn.background = '#1e2330'; btn.cornerRadius = 4; btn.thickness = 1
    btn.hoverCursor = 'pointer'
    btn.onPointerDownObservable.add(() => playBlend(all[0], all[1]))
    animPanel.addControl(btn)
  }
}

// ── Load character ───────────────────────────────────────────────────────
async function loadChar(file: string, label: string) {
  current?.stop(); current = null
  charMeshes.forEach(m => m.dispose()); charMeshes = []
  embedded.forEach(g => g.dispose()); embedded = []
  retargeted.forEach(g => g.dispose()); retargeted = []
  skeleton = null

  setProgress(20, `Loading ${label}…`)

  try {
    const before = scene.animationGroups.length
    const result = await SceneLoader.ImportMeshAsync('', `${RACE_MODEL_CDN}/`, file, scene)
    charMeshes = result.meshes
    skeleton   = result.skeletons[0] ?? null
    embedded   = scene.animationGroups.slice(before)
    embedded.forEach(g => g.stop())

    const root = charMeshes[0]
    autoNormalizeCharacter(root)
    root.position.y = 0

    shadows.addShadowCaster(root, true)
    charMeshes.forEach(m => { m.receiveShadows = true })

    const bounds = root.getHierarchyBoundingVectors()
    const height = bounds.max.y - bounds.min.y
    camera.setTarget(new Vector3(0, height * 0.5, 0))
    camera.radius = Math.max(3, height * 1.8)

    setProgress(60, 'Retargeting animations…')
    if (skeleton && ualLoaded && ualSrcGroups.length > 0) {
      retargeted = ualSrcGroups
        .map(g => retargetAnimationGroup(g, skeleton!, g.name + '_retargeted', scene))
        .filter(Boolean) as AnimationGroup[]
    }

    if (embedded.length > 0) play(embedded[0])
    refreshAnims()

    setProgress(100, 'Ready')
    hideOverlay()
  } catch (e) {
    console.error('Character load failed:', e)
    setProgress(100, `Failed: ${label}`)
    hideOverlay()
  }
}

// ── Build BJS GUI ────────────────────────────────────────────────────────
function buildUI() {
  const ui    = AdvancedDynamicTexture.CreateFullscreenUI('UI')
  const panel = new StackPanel()
  panel.width   = '150px'
  panel.fontSize = '12px'
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER
  panel.paddingRight = '10px'
  ui.addControl(panel)

  const makeBtn = (label: string, onClick: () => void) => {
    const btn = Button.CreateSimpleButton(`btn_${label}`, label)
    btn.paddingTop = '6px'; btn.width = '140px'; btn.height = '36px'
    btn.color = '#d4d8e8'; btn.background = '#1e2330'; btn.cornerRadius = 4; btn.thickness = 1
    btn.hoverCursor = 'pointer'
    btn.onPointerEnterObservable.add(() => { btn.background = '#c8a84b'; btn.color = '#000' })
    btn.onPointerOutObservable.add(()  => { btn.background = '#1e2330'; btn.color = '#d4d8e8' })
    btn.onPointerDownObservable.add(onClick)
    panel.addControl(btn)
    return btn
  }

  // Race character selector (canonical Grudge races)
  for (const raceId of RACE_IDS) {
    const entry = GRUDGE_RACE_MODELS[raceId]
    makeBtn(`⚔ ${entry.label}`, () => loadChar(entry.file, entry.label))
  }

  // Extra NPC / demo models
  for (const ch of EXTRA_CHAR_OPTIONS) {
    makeBtn(ch.label, () => loadChar(ch.file, ch.label))
  }

  // Separator
  const sep = Button.CreateSimpleButton('sep', '─── Animations ───')
  sep.width = '140px'; sep.height = '26px'; sep.paddingTop = '10px'
  sep.color = '#6b7399'; sep.background = 'transparent'; sep.thickness = 0
  sep.isHitTestVisible = false
  panel.addControl(sep)

  // Dynamic anim panel
  animPanel = new StackPanel()
  animPanel.width = '140px'
  panel.addControl(animPanel)

  // UAL load button
  makeBtn('📦 Load UAL Anims', async () => {
    await ensureUAL()
    if (skeleton && ualSrcGroups.length > 0 && retargeted.length === 0) {
      retargeted = ualSrcGroups
        .map(g => retargetAnimationGroup(g, skeleton!, g.name + '_retargeted', scene))
        .filter(Boolean) as AnimationGroup[]
    }
    refreshAnims()
  })
}

// ── Init ──────────────────────────────────────────────────────────────────
buildUI()
setProgress(5, 'Starting…')
// Default to Human race model (canonical starting race)
loadChar(GRUDGE_RACE_MODELS[DEFAULT_RACE].file, raceLabel(DEFAULT_RACE))
engine.runRenderLoop(() => scene.render())
