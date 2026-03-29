/**
 * Water + Sky + Procedural Textures
 * Uses @babylonjs/materials (WaterMaterial, SkyMaterial)
 * and @babylonjs/procedural-textures (WoodProceduralTexture, MarbleProceduralTexture)
 */

import { Engine }              from '@babylonjs/core/Engines/engine'
import { Scene }               from '@babylonjs/core/scene'
import { ArcRotateCamera }     from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 }             from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }      from '@babylonjs/core/Maths/math.color'
import { HemisphericLight }    from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }    from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }         from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }    from '@babylonjs/core/Materials/standardMaterial'
import { PBRMaterial }         from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Texture }             from '@babylonjs/core/Materials/Textures/texture'
import { ShadowGenerator }     from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { GlowLayer }           from '@babylonjs/core/Layers/glowLayer'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'

// @babylonjs/materials
import { WaterMaterial }  from '@babylonjs/materials/water/waterMaterial'
import { SkyMaterial }    from '@babylonjs/materials/sky/skyMaterial'
import { FireMaterial }   from '@babylonjs/materials/fire/fireMaterial'

// @babylonjs/procedural-textures
import { WoodProceduralTexture }   from '@babylonjs/procedural-textures/wood/woodProceduralTexture'
import { MarbleProceduralTexture } from '@babylonjs/procedural-textures/marble/marbleProceduralTexture'
import { CloudProceduralTexture }  from '@babylonjs/procedural-textures/cloud/cloudProceduralTexture'

const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.5, 0.7, 0.9, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ──────────────────────────────────────────────────────────
const cam = new ArcRotateCamera('cam', -Math.PI/2.5, Math.PI/4, 30, new Vector3(0,1,0), scene)
cam.lowerRadiusLimit = 5; cam.upperRadiusLimit = 60; cam.wheelPrecision = 20
cam.attachControl(canvas, true)

// ── Lights ──────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0,1,0), scene)
hemi.intensity = 0.5

const sun = new DirectionalLight('sun', new Vector3(-1,-2,-1), scene)
sun.position  = new Vector3(20,40,20)
sun.intensity = 1.8

const shadows = new ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true

// ── Sky ──────────────────────────────────────────────────────────────
const skybox   = MeshBuilder.CreateBox('sky', { size: 1000 }, scene)
const skyMat   = new SkyMaterial('sky', scene)
skyMat.backFaceCulling = false
skyMat.luminance   = 1
skyMat.turbidity   = 5
skyMat.rayleigh    = 3
skyMat.mieCoefficient = 0.005
skyMat.mieDirectionalG = 0.98
skyMat.inclination    = 0.48    // sun angle (0 = sunset, 0.5 = noon)
skyMat.azimuth        = 0.25
skybox.material = skyMat

// ── Terrain island ───────────────────────────────────────────────────
const island = MeshBuilder.CreateGround('island', { width:28, height:28, subdivisions:10 }, scene)
island.receiveShadows = true

// Marble material on island
const marbleTex = new MarbleProceduralTexture('marble', 512, scene)
marbleTex.numberOfTilesHeight = 3
marbleTex.numberOfTilesWidth  = 3
marbleTex.jointColor   = new Color3(0.6, 0.5, 0.4)

const islandMat = new StandardMaterial('islandMat', scene)
islandMat.diffuseTexture = marbleTex
island.material = islandMat

// Elevate island slightly so it sits in the water
island.position.y = 0.6

// ── Dock planks — wood procedural ───────────────────────────────────
const woodTex = new WoodProceduralTexture('wood', 512, scene)
woodTex.ampScale = 70
woodTex.woodColor = new Color3(0.45, 0.28, 0.12)

const plankMat = new StandardMaterial('plankMat', scene)
plankMat.diffuseTexture = woodTex

for (let i = 0; i < 5; i++) {
  const plank = MeshBuilder.CreateBox(`plank${i}`, { width:1.8, height:0.15, depth:6 }, scene)
  plank.position.set(16 - i * 1.9, 0.4, 0)
  plank.material = plankMat
  plank.receiveShadows = true
  shadows.addShadowCaster(plank)
}

// ── Columns ──────────────────────────────────────────────────────────
const colMat = new PBRMaterial('colMat', scene)
colMat.albedoColor = new Color3(0.82, 0.8, 0.75); colMat.metallic = 0; colMat.roughness = 0.7

const colPositions: [number,number][] = [[-8,6],[-8,-6],[8,6],[8,-6]]
for (const [x,z] of colPositions) {
  const col = MeshBuilder.CreateCylinder(`col_${x}`, { diameter:0.9, height:6, tessellation:16 }, scene)
  col.position.set(x, 3.6, z)
  col.material = colMat; col.receiveShadows = true
  shadows.addShadowCaster(col)
}

// ── Fire on altar ────────────────────────────────────────────────────
const fireMesh = MeshBuilder.CreatePlane('fire', { size: 3 }, scene)
fireMesh.position.set(0, 2, 0)
fireMesh.billboardMode = 7
const fireMat = new FireMaterial('fire', scene)
fireMat.diffuseTexture  = new Texture('https://assets.babylonjs.com/textures/fire.png', scene)
fireMat.distortionTexture = new Texture('https://assets.babylonjs.com/textures/distortion.png', scene)
fireMat.opacityTexture  = new Texture('https://assets.babylonjs.com/textures/candleOpacity.png', scene)
fireMat.speed = 5; fireMat.colorMultiplier = 1.3
fireMesh.material = fireMat

// ── Water ────────────────────────────────────────────────────────────
const waterMesh = MeshBuilder.CreateGround('water', { width:200, height:200, subdivisions:32 }, scene)
const waterMat  = new WaterMaterial('water', scene, new Vector3(512, 512, 1) as any)
waterMat.bumpTexture    = new Texture('https://assets.babylonjs.com/textures/waterbump.png', scene)
waterMat.windForce      = -12
waterMat.waveHeight     = 0.3
waterMat.bumpHeight     = 0.3
waterMat.waveLength     = 0.1
waterMat.colorBlendFactor = 0
waterMat.waterColor     = new Color3(0.1, 0.3, 0.6)
waterMat.colorBlendFactor2 = 0.2
// Add reflective meshes
waterMat.addToRenderList(skybox)
waterMat.addToRenderList(island)
waterMesh.material = waterMat

// ── Default pipeline — bloom + tone mapping ───────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [cam])
pip.bloomEnabled = true; pip.bloomThreshold = 0.4; pip.bloomWeight = 0.4
pip.imageProcessingEnabled = true
pip.imageProcessing.toneMappingEnabled = true
pip.imageProcessing.toneMappingType   = 1 // ACES

// ── Animate sun/sky ───────────────────────────────────────────────────
let t = 0
scene.onBeforeRenderObservable.add(() => {
  t += engine.getDeltaTime() * 0.0001
  skyMat.inclination = 0.48 - Math.sin(t) * 0.05
})

engine.runRenderLoop(() => scene.render())
