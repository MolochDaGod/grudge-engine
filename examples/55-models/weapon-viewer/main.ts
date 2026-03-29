/**
 * Weapon Viewer
 * Loads KayKit fantasy weapon GLTFs from Grudge R2 object storage.
 * PBR lighting + Glow layer + SSAO + Bloom.
 */

import '@babylonjs/loaders/glTF'

import { Engine }               from '@babylonjs/core/Engines/engine'
import { Scene }                from '@babylonjs/core/scene'
import { ArcRotateCamera }      from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 }              from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }       from '@babylonjs/core/Maths/math.color'
import { HemisphericLight }     from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }     from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }          from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial }          from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { SceneLoader }          from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh }         from '@babylonjs/core/Meshes/abstractMesh'
import { GlowLayer }            from '@babylonjs/core/Layers/glowLayer'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { SkyMaterial }          from '@babylonjs/materials/sky/skyMaterial'
import { HighlightLayer }       from '@babylonjs/core/Layers/highlightLayer'

const R2 = 'https://assets.grudge-studio.com/models/weapons/kaykit'

const WEAPONS: Array<{ id: string; label: string }> = [
  { id:'sword_A',        label:'Sword A' },
  { id:'sword_B',        label:'Sword B' },
  { id:'sword_C',        label:'Sword C (Broad)' },
  { id:'sword_D',        label:'Sword D (Great)' },
  { id:'sword_E',        label:'Sword E (Elvish)' },
  { id:'axe_A',          label:'Axe A' },
  { id:'axe_B',          label:'Axe B' },
  { id:'axe_C',          label:'Battle Axe' },
  { id:'hammer_A',       label:'Hammer A' },
  { id:'hammer_B',       label:'Hammer B' },
  { id:'hammer_C',       label:'Warhammer' },
  { id:'bow_A',          label:'Bow A' },
  { id:'bow_B',          label:'Bow B' },
  { id:'bow_A_withString', label:'Bow + String' },
  { id:'dagger_A',       label:'Dagger A' },
  { id:'dagger_B',       label:'Dagger B' },
  { id:'staff_A',        label:'Staff A' },
  { id:'staff_B',        label:'Staff B' },
  { id:'wand_A',         label:'Wand' },
  { id:'spear_A',        label:'Spear' },
  { id:'halberd',        label:'Halberd' },
  { id:'shield_A',       label:'Shield A' },
  { id:'shield_B',       label:'Shield B' },
  { id:'shield_C',       label:'Shield C (Kite)' },
]

// ── Engine + Scene ──────────────────────────────────────────────────
const canvas    = document.getElementById('grudge-canvas') as HTMLCanvasElement
const nameTag   = document.getElementById('name-tag')!
const loadingEl = document.getElementById('loading')!
const engine    = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene     = new Scene(engine)
scene.clearColor = new Color4(0.04, 0.05, 0.09, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ───────────────────────────────────────────────────────────
const cam = new ArcRotateCamera('cam', -Math.PI/2, Math.PI/3, 5, new Vector3(0,1,0), scene)
cam.lowerRadiusLimit = 1; cam.upperRadiusLimit = 20; cam.wheelPrecision = 25
cam.attachControl(canvas, true)

// ── Lights ────────────────────────────────────────────────────────────
const hemi  = new HemisphericLight('hemi', new Vector3(0,1,0), scene)
hemi.intensity = 0.4; hemi.groundColor = new Color3(0.05,0.05,0.1)

const key = new DirectionalLight('key', new Vector3(-1,-2,-1), scene)
key.position = new Vector3(5,10,5); key.intensity = 2.2

const fill = new DirectionalLight('fill', new Vector3(1,-0.5,1), scene)
fill.position = new Vector3(-5,8,-5); fill.intensity = 0.8
fill.diffuse = new Color3(0.5, 0.6, 0.9)

// ── Pedestal ──────────────────────────────────────────────────────────
const pedestal = MeshBuilder.CreateCylinder('ped', { diameter:1.2, height:0.25, tessellation:32 }, scene)
pedestal.position.y = -0.125
const pedMat = new PBRMaterial('pedMat', scene)
pedMat.albedoColor = new Color3(0.1, 0.12, 0.15)
pedMat.metallic    = 0.9; pedMat.roughness = 0.15
pedestal.material  = pedMat

// Glow rim
const pedRim = MeshBuilder.CreateTorus('pedRim', { diameter:1.22, thickness:0.04, tessellation:64 }, scene)
pedRim.position.y = 0.0
const rimMat = new PBRMaterial('rimMat', scene)
rimMat.albedoColor   = new Color3(0.4, 0.8, 1.0)
rimMat.emissiveColor = new Color3(0.4, 0.8, 1.0)
rimMat.metallic = 0; rimMat.roughness = 0
pedRim.material = rimMat

const glow = new GlowLayer('glow', scene)
glow.addIncludedOnlyMesh(pedRim as any); glow.intensity = 0.8

// ── Post processing ───────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [cam])
pip.bloomEnabled = true; pip.bloomThreshold = 0.5; pip.bloomWeight = 0.5; pip.bloomKernel = 32
pip.fxaaEnabled  = true
pip.imageProcessingEnabled = true
pip.imageProcessing.contrast = 1.2; pip.imageProcessing.exposure = 1.1
pip.imageProcessing.vignetteEnabled = true; pip.imageProcessing.vignetteWeight = 1.5

// ── Highlight layer for hover ─────────────────────────────────────────
const hl = new HighlightLayer('hl', scene)

// ── State ─────────────────────────────────────────────────────────────
let currentMeshes: AbstractMesh[] = []
let autoRotate = true

async function loadWeapon(weaponId: string, label: string, btn: HTMLButtonElement) {
  // Clear previous
  currentMeshes.forEach(m => m.dispose())
  currentMeshes = []
  loadingEl.textContent = `Loading ${label}…`
  nameTag.textContent   = ''

  document.querySelectorAll('.w-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')

  try {
    const result = await SceneLoader.ImportMeshAsync('', `${R2}/`, `${weaponId}.gltf`, scene)
    currentMeshes = result.meshes
    loadingEl.textContent = ''
    nameTag.textContent   = label

    // Centre and scale
    const root = result.meshes[0]
    root.position = new Vector3(0, 0.15, 0)
    root.scaling.setAll(3)

    // Fit camera
    const bounds = root.getHierarchyBoundingVectors()
    const size   = Vector3.Distance(bounds.min, bounds.max)
    cam.setTarget(new Vector3(0, size * 0.3, 0))
    cam.radius   = size * 2.2

    // Highlight rims
    result.meshes.forEach(m => { if (m.isPickable) hl.addMesh(m as any, Color3.Teal()) })
    setTimeout(() => result.meshes.forEach(m => hl.removeMesh(m as any)), 800)

  } catch (e) {
    loadingEl.textContent = `Failed: ${label} (not yet in R2)`
    console.warn(e)
  }
}

// ── Build toolbar ─────────────────────────────────────────────────────
const bar = document.getElementById('weapon-bar')!
WEAPONS.forEach(w => {
  const btn = document.createElement('button')
  btn.className   = 'w-btn'
  btn.textContent = w.label
  btn.onclick     = () => loadWeapon(w.id, w.label, btn)
  bar.appendChild(btn)
})

// Auto-load first weapon
const firstBtn = bar.firstElementChild as HTMLButtonElement
loadWeapon(WEAPONS[0].id, WEAPONS[0].label, firstBtn)

// ── Animate pedestal / auto-rotate ────────────────────────────────────
let t = 0
scene.onBeforeRenderObservable.add(() => {
  t += engine.getDeltaTime() * 0.001
  pedRim.rotation.y += 0.008
  if (autoRotate && currentMeshes[0]) {
    currentMeshes[0].rotation.y += 0.006
  }
})

canvas.addEventListener('pointerdown', () => { autoRotate = false })

engine.runRenderLoop(() => scene.render())
