import '@babylonjs/core/Rendering/boundingBoxRenderer'
import { ArcRotateCamera }    from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }   from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }   from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 }     from '@babylonjs/core/Maths/math.color'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { VertexBuffer }       from '@babylonjs/core/Buffers/buffer'
import { FloatArray }         from '@babylonjs/core/types'
import { SkyMaterial }        from '@babylonjs/materials/sky/skyMaterial'
import { WaterMaterial }      from '@babylonjs/materials/water/waterMaterial'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { GrudgeEngine }       from '../../../src/core/GrudgeEngine'

// ── Perlin noise ────────────────────────────────────────────────────────
const P = new Uint8Array(512)
;(() => { const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[p[i], p[j]] = [p[j], p[i]] } for (let i = 0; i < 512; i++) P[i] = p[i & 255] })()
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function grad(hash: number, x: number, y: number) {
  const h = hash & 3
  return (h < 2 ? (h === 0 ? x : -x) : 0) + (h < 2 ? 0 : (h === 2 ? y : -y))
}
function perlin(x: number, y: number): number {
  const xi = x & 255, yi = y & 255
  const xf = x - Math.floor(x), yf = y - Math.floor(y)
  const u = fade(xf), v = fade(yf)
  const aa = P[P[xi] + yi], ab = P[P[xi] + yi + 1]
  const ba = P[P[xi + 1] + yi], bb = P[P[xi + 1] + yi + 1]
  return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
              lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v)
}
function fbm(x: number, y: number, oct = 6): number {
  let v = 0, a = 0.5, f = 1, m = 0
  for (let i = 0; i < oct; i++) { v += perlin(x * f, y * f) * a; m += a; f *= 2.1; a *= 0.48 }
  return v / m
}

// ── Height → biome colour ───────────────────────────────────────────────
function biomeColor(h: number): [number, number, number] {
  if (h < 0.12) return [0.08, 0.18, 0.42]   // deep water
  if (h < 0.18) return [0.12, 0.28, 0.52]   // shallow water
  if (h < 0.24) return [0.76, 0.70, 0.50]   // sand
  if (h < 0.45) return [0.22, 0.50, 0.18]   // grass
  if (h < 0.60) return [0.16, 0.38, 0.14]   // dark grass
  if (h < 0.75) return [0.40, 0.36, 0.30]   // rock
  if (h < 0.88) return [0.55, 0.52, 0.48]   // high rock
  return [0.92, 0.94, 0.96]                 // snow
}

// ── Engine + Scene ──────────────────────────────────────────────────────
const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.55, 0.75, 0.95, 1] })
const { scene } = grudge

// Fog
scene.fogMode = 2  // exponential
scene.fogDensity = 0.006
scene.fogColor = new Color3(0.65, 0.78, 0.92)

// ── Lighting ────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.45; hemi.groundColor = new Color3(0.15, 0.12, 0.1)

const sun = new DirectionalLight('sun', new Vector3(-0.6, -1, -0.4), scene)
sun.position = new Vector3(30, 50, 30); sun.intensity = 1.1

// ── Camera ──────────────────────────────────────────────────────────────
const cam = new ArcRotateCamera('c', -Math.PI / 3, Math.PI / 3.5, 65, new Vector3(0, 6, 0), scene)
cam.lowerRadiusLimit = 15; cam.upperRadiusLimit = 150
cam.lowerBetaLimit = 0.1; cam.upperBetaLimit = Math.PI / 2.1
cam.attachControl(grudge.canvas, true)

// ── Skybox ──────────────────────────────────────────────────────────────
const skybox = MeshBuilder.CreateBox('skybox', { size: 800 }, scene)
const skyMat = new SkyMaterial('sky', scene)
skyMat.backFaceCulling = false
skyMat.luminance = 1.0; skyMat.turbidity = 10; skyMat.rayleigh = 2
skyMat.mieCoefficient = 0.005; skyMat.mieDirectionalG = 0.8
skyMat.inclination = 0.46; skyMat.azimuth = 0.25
skybox.material = skyMat; skybox.infiniteDistance = true

// ── Terrain mesh ────────────────────────────────────────────────────────
const SIZE = 100, DIVS = 200, MAX_H = 18
const ground = MeshBuilder.CreateGround('terrain', { width: SIZE, height: SIZE, subdivisions: DIVS, updatable: true }, scene)
const positions = ground.getVerticesData(VertexBuffer.PositionKind)!
const colors: number[] = []

for (let i = 0; i < positions.length; i += 3) {
  const wx = positions[i] / SIZE + 0.5
  const wz = positions[i + 2] / SIZE + 0.5
  const h = fbm(wx * 5 + 0.3, wz * 5 + 0.7) * 0.5 + 0.5  // [0..1]
  positions[i + 1] = h * MAX_H
  const [r, g, b] = biomeColor(h)
  colors.push(r, g, b, 1)
}
ground.updateVerticesData(VertexBuffer.PositionKind, positions)
ground.setVerticesData(VertexBuffer.ColorKind, new Float32Array(colors) as FloatArray)
ground.createNormals(true)

const tMat = new StandardMaterial('tm', scene)
tMat.diffuseColor = Color3.White()
tMat.specularColor = new Color3(0.05, 0.05, 0.05)
tMat.useVertexColors = true as any
;(tMat as any).vertexColorEnabled = true
ground.material = tMat

// ── Water ───────────────────────────────────────────────────────────────
const WATER_LEVEL = MAX_H * 0.20
const waterMesh = MeshBuilder.CreateGround('water', { width: SIZE + 30, height: SIZE + 30, subdivisions: 32 }, scene)
waterMesh.position.y = WATER_LEVEL
const waterMat = new WaterMaterial('wm', scene)
waterMat.windForce = -5; waterMat.waveHeight = 0.15; waterMat.waveLength = 0.3
waterMat.windDirection.set(1, 1)
waterMat.waterColor = new Color3(0.05, 0.18, 0.35)
waterMat.colorBlendFactor = 0.3
waterMat.bumpHeight = 0.08
waterMat.addToRenderList(ground)
waterMat.addToRenderList(skybox)
waterMesh.material = waterMat

// ── Post-processing ─────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [cam])
pip.fxaaEnabled = true
pip.bloomEnabled = true; pip.bloomThreshold = 0.6; pip.bloomWeight = 0.25
pip.imageProcessingEnabled = true
pip.imageProcessing.contrast = 1.1; pip.imageProcessing.exposure = 1.05
pip.imageProcessing.vignetteEnabled = true; pip.imageProcessing.vignetteWeight = 1.5

document.getElementById('hud')!.textContent = 'Heightmap Terrain — Perlin FBM, biome colours, sky + water  |  Drag to orbit'
grudge.start()
