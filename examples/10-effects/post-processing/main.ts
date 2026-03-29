/**
 * Post-Processing Showcase
 * Toggleable: SSAO2, Bloom, FXAA, Film Grain
 * All from @babylonjs/core — no extra package needed.
 */

import { Engine }               from '@babylonjs/core/Engines/engine'
import { Scene }                from '@babylonjs/core/scene'
import { ArcRotateCamera }      from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 }              from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }       from '@babylonjs/core/Maths/math.color'
import { HemisphericLight }     from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }     from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }          from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial }          from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { StandardMaterial }     from '@babylonjs/core/Materials/standardMaterial'
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { GlowLayer }            from '@babylonjs/core/Layers/glowLayer'

const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.06, 0.07, 0.10, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ──────────────────────────────────────────────────────────
const cam = new ArcRotateCamera('cam', -Math.PI/4, Math.PI/3.2, 22, new Vector3(0, 1, 0), scene)
cam.lowerRadiusLimit = 5; cam.upperRadiusLimit = 40; cam.wheelPrecision = 20
cam.attachControl(canvas, true)

// ── Lights ──────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0,1,0), scene)
hemi.intensity = 0.35; hemi.groundColor = new Color3(0.04,0.04,0.06)

const sun = new DirectionalLight('sun', new Vector3(-0.5,-1,-0.3), scene)
sun.position  = new Vector3(10,20,10)
sun.intensity = 2.5
sun.shadowEnabled = true

// ── Scene geometry ───────────────────────────────────────────────────
// Ground
const ground = MeshBuilder.CreateGround('ground', { width:30, height:30, subdivisions:6 }, scene)
const gm = new PBRMaterial('gm', scene)
gm.albedoColor = new Color3(0.12,0.13,0.16)
gm.metallic = 0.6; gm.roughness = 0.4
ground.material = gm; ground.receiveShadows = true

// Column ring — to show SSAO in crevices
const nCols = 8
for (let i = 0; i < nCols; i++) {
  const angle  = (i / nCols) * Math.PI * 2
  const col    = MeshBuilder.CreateCylinder(`col${i}`, { diameter:0.7, height:5, tessellation:12 }, scene)
  col.position = new Vector3(Math.cos(angle)*7, 2.5, Math.sin(angle)*7)
  const cm = new PBRMaterial(`cm${i}`, scene)
  cm.albedoColor = new Color3(0.7, 0.68, 0.65)
  cm.metallic = 0.1; cm.roughness = 0.6
  col.material = cm
  col.receiveShadows = true
  // Cap
  const cap = MeshBuilder.CreateBox(`cap${i}`, { width:1, height:0.3, depth:1 }, scene)
  cap.position = new Vector3(Math.cos(angle)*7, 5.15, Math.sin(angle)*7)
  cap.material = cm; cap.receiveShadows = true
}

// Central emissive altar
const altar = MeshBuilder.CreateBox('altar', { width:2.5, height:0.4, depth:2.5 }, scene)
altar.position.y = 0.2
const am = new PBRMaterial('am', scene)
am.albedoColor   = new Color3(0.2, 0.1, 0.35)
am.emissiveColor = new Color3(0.35, 0.1, 0.7)
am.metallic = 0.8; am.roughness = 0.2
altar.material = am

// Floating glowing crystal
const crystal = MeshBuilder.CreatePolyhedron('crystal', { type: 3, size: 0.8 }, scene)
crystal.position.y = 2.2
const crMat = new PBRMaterial('crMat', scene)
crMat.albedoColor   = new Color3(0.6, 0.2, 1.0)
crMat.emissiveColor = new Color3(0.4, 0.1, 0.8)
crMat.metallic = 0; crMat.roughness = 0.05; crMat.alpha = 0.7; crMat.transparencyMode = 2
crystal.material = crMat

const glow = new GlowLayer('glow', scene, { blurKernelSize: 32 })
glow.addIncludedOnlyMesh(crystal); glow.addIncludedOnlyMesh(altar as any)
glow.intensity = 0.9

// ── SSAO2 pipeline ───────────────────────────────────────────────────
const ssao = new SSAO2RenderingPipeline('ssao', scene, {
  ssaoRatio: 0.5,
  blurRatio:  1,
}, [cam])
ssao.radius      = 3.5
ssao.totalStrength = 1.3
ssao.base        = 0.1
ssao.maxZ        = 100
ssao.minZAspect  = 0.2

// ── Default rendering pipeline (Bloom + FXAA + Grain) ────────────────
const pipeline = new DefaultRenderingPipeline('default', true, scene, [cam])
pipeline.bloomEnabled        = true
pipeline.bloomThreshold      = 0.3
pipeline.bloomWeight         = 0.6
pipeline.bloomKernel         = 64
pipeline.bloomScale          = 0.5
pipeline.fxaaEnabled         = true
pipeline.grainEnabled        = true
pipeline.grain.intensity     = 12
pipeline.grain.animated      = true
pipeline.imageProcessingEnabled = true
pipeline.imageProcessing.contrast    = 1.3
pipeline.imageProcessing.exposure    = 1.1
pipeline.imageProcessing.vignetteEnabled = true
pipeline.imageProcessing.vignetteWeight  = 2

// ── Toggle buttons ───────────────────────────────────────────────────
function wire(id: string, toggle: (on: boolean) => void) {
  const btn = document.getElementById(id)!
  btn.addEventListener('click', () => {
    btn.classList.toggle('on')
    toggle(btn.classList.contains('on'))
  })
}
wire('btn-ssao',  on => ssao.totalStrength      = on ? 1.3 : 0)
wire('btn-bloom', on => pipeline.bloomEnabled   = on)
wire('btn-fxaa',  on => pipeline.fxaaEnabled    = on)
wire('btn-grain', on => pipeline.grainEnabled   = on)

// ── Animate crystal ──────────────────────────────────────────────────
let t = 0
scene.onBeforeRenderObservable.add(() => {
  t += engine.getDeltaTime() * 0.001
  crystal.position.y = 2.2 + Math.sin(t) * 0.3
  crystal.rotation.y += 0.012
  crystal.rotation.z  = Math.sin(t * 0.7) * 0.15
})

engine.runRenderLoop(() => scene.render())
