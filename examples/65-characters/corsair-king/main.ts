/**
 * Corsair King — Character Animation Demo
 * Port of the BJS dummy3.babylon skeleton animation playground.
 * Replaces dummy3 with the Corsair King FBX (from Grudge R2),
 * with idle/walk/run/left/right animations and a blend mode.
 *
 * Uses Mixamo-style AnimationGroups loaded from separate FBX files
 * and retargeted to the main character's skeleton.
 */

import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { normBoneName, autoNormalizeCharacter } from '../../../src/core/character'

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }  from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }   from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { Color3 }            from '@babylonjs/core/Maths/math.color'
import { SceneLoader }       from '@babylonjs/core/Loading/sceneLoader'
import { AnimationGroup }    from '@babylonjs/core/Animations/animationGroup'
import { Skeleton }          from '@babylonjs/core/Bones/skeleton'
import { AbstractMesh }      from '@babylonjs/core/Meshes/abstractMesh'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { StackPanel }             from '@babylonjs/gui/2D/controls/stackPanel'
import { Button }                 from '@babylonjs/gui/2D/controls/button'
import { Control }                from '@babylonjs/gui/2D/controls/control'
import { TextBlock }              from '@babylonjs/gui/2D/controls/textBlock'

const R2 = 'https://assets.grudge-studio.com/models/characters/corsair-king'

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
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
window.addEventListener('resize', () => engine.resize())

// ── Camera ────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 4, 5, new Vector3(0, 1, 0), scene)
camera.attachControl(canvas, true)
camera.lowerRadiusLimit   = 2
camera.upperRadiusLimit   = 12
camera.wheelDeltaPercentage = 0.01

// ── Lights + shadows ─────────────────────────────────────────────────────
const hemi = new HemisphericLight('light1', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.6
hemi.specular  = Color3.Black()

const dir = new DirectionalLight('dir01', new Vector3(0, -0.5, -1), scene)
dir.position = new Vector3(0, 5, 5)

const shadows = new ShadowGenerator(1024, dir)
shadows.useBlurExponentialShadowMap = true
shadows.blurKernel = 32

// ── Post-processing ───────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [camera])
pip.fxaaEnabled = true
pip.bloomEnabled = true; pip.bloomThreshold = 0.5; pip.bloomWeight = 0.3

// ── Retarget helper ────────────────────────────────────────────────────────
function retarget(source: AnimationGroup, target: Skeleton, name: string): AnimationGroup {
  const g = new AnimationGroup(name, scene)
  for (const ta of source.targetedAnimations) {
    const bone  = (ta.target as any)
    const bname = bone?.name ?? bone?.id
    if (!bname) continue
    // Normalised match: strips Mixamo prefix + punctuation so any naming
    // convention works (e.g. "mixamorig:Hips" matches "Hips" or "hips")
    const srcNorm = normBoneName(bname)
    const tb = target.bones.find(b => normBoneName(b.name) === srcNorm)
    if (tb) g.addTargetedAnimation(ta.animation, tb)
  }
  return g
}

// ── Animation state ───────────────────────────────────────────────────────
interface AnimDef { key: string; label: string; file: string }
const ANIM_DEFS: AnimDef[] = [
  { key: 'idle',    label: 'Idle',       file: 'idle.fbx'      },
  { key: 'walk',    label: 'Walk',       file: 'walking.fbx'   },
  { key: 'run',     label: 'Run',        file: 'running.fbx'   },
  { key: 'left',    label: 'Left Turn',  file: 'left_turn.fbx' },
  { key: 'right',   label: 'Right Turn', file: 'right_turn.fbx'},
]

const anims: Record<string, AnimationGroup> = {}
let current: AnimationGroup | null = null
let skeleton: Skeleton | null = null
let charMeshes: AbstractMesh[] = []

function play(key: string, loop = true) {
  const g = anims[key]; if (!g) return
  current?.stop()
  current = g
  g.start(loop)
  animLabel.textContent = ANIM_DEFS.find(d => d.key === key)?.label ?? key
}

// ── Blend helper (walk + left simultaneously at 0.5 weight each) ──────────
function playBlend(keyA: string, keyB: string) {
  current?.stop()
  const a = anims[keyA], b = anims[keyB]
  if (!a || !b) { play(keyA); return }
  current = null
  a.start(true, 0.5); b.start(true, 0.5)
  if (typeof (a as any).weight !== 'undefined') (a as any).weight = 0.5
  if (typeof (b as any).weight !== 'undefined') (b as any).weight = 0.5
  animLabel.textContent = 'Walk + Left Blend'
}

// ── Load everything ───────────────────────────────────────────────────────
async function load() {
  setProgress(10, 'Loading character…')

  let charResult: any
  try {
    charResult = await SceneLoader.ImportMeshAsync('', `${R2}/`, 'character.fbx', scene)
  } catch (e) {
    setProgress(100, 'Character load failed')
    console.error(e); hideOverlay(); return
  }

  charMeshes = charResult.meshes
  skeleton   = charResult.skeletons[0] ?? null
  const root = charMeshes[0]

  // Scale and centre — auto-normalize handles Mixamo FBX cm-scale;
  // the hardcoded 0.025 fallback is only used if the character is
  // already in a reasonable range (which it won't be for a raw FBX).
  autoNormalizeCharacter(root)
  root.position  = new Vector3(0, 0, 0)

  // Shadows
  shadows.addShadowCaster(root, true)
  charMeshes.forEach(m => { m.receiveShadows = true })

  // Default environment
  const helper = scene.createDefaultEnvironment({ enableGroundShadow: true })
  helper?.setMainColor(Color3.Gray())
  if (helper?.ground) helper.ground.position.y += 0.01

  // Focus camera on character
  camera.setTarget(new Vector3(0, 1, 0))

  setProgress(30, 'Loading animations…')

  // Load animations sequentially
  for (let i = 0; i < ANIM_DEFS.length; i++) {
    const def = ANIM_DEFS[i]
    setProgress(30 + (i / ANIM_DEFS.length) * 60, `Loading ${def.label}…`)
    try {
      const res = await SceneLoader.ImportMeshAsync('', `${R2}/`, def.file, scene)
      // Get last animation group added
      const rawGroup = scene.animationGroups[scene.animationGroups.length - 1]
      // Hide duplicate meshes from animation FBX
      res.meshes.forEach(m => { if (!charMeshes.includes(m)) m.dispose() })

      if (skeleton && rawGroup) {
        anims[def.key] = retarget(rawGroup, skeleton, def.key)
        rawGroup.stop()
      } else if (rawGroup) {
        anims[def.key] = rawGroup
      }
    } catch (e) { console.warn(`${def.label} anim failed:`, e) }
  }

  setProgress(95, 'Building UI…')

  // ── BJS GUI buttons ──────────────────────────────────────────────────────
  const ui      = AdvancedDynamicTexture.CreateFullscreenUI('UI')
  const panel   = new StackPanel()
  panel.width   = '140px'
  panel.fontSize = '13px'
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT
  panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER
  ui.addControl(panel)

  const makeBtn = (label: string, onClick: () => void) => {
    const btn = Button.CreateSimpleButton(`btn_${label}`, label)
    btn.paddingTop = '8px'
    btn.width      = '120px'
    btn.height     = '44px'
    btn.color      = '#d4d8e8'
    btn.background = '#1e2330'
    btn.cornerRadius = 4
    btn.thickness  = 1
    btn.hoverCursor = 'pointer'
    btn.onPointerEnterObservable.add(() => { btn.background = '#c8a84b'; btn.color = '#000' })
    btn.onPointerOutObservable.add(()  => { btn.background = '#1e2330'; btn.color = '#d4d8e8' })
    btn.onPointerDownObservable.add(onClick)
    panel.addControl(btn)
    return btn
  }

  makeBtn('Idle',       () => play('idle'))
  makeBtn('Walk',       () => play('walk'))
  makeBtn('Run',        () => play('run'))
  makeBtn('Left Turn',  () => play('left'))
  makeBtn('Right Turn', () => play('right'))
  makeBtn('Blend Walk+Left', () => playBlend('walk', 'left'))

  setProgress(100, 'Ready')
  hideOverlay()

  // Start with idle
  play('idle')

  engine.runRenderLoop(() => scene.render())
}

load()
