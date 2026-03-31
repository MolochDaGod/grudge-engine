import '@babylonjs/core/Rendering/boundingBoxRenderer'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 }   from '@babylonjs/core/Maths/math.color'
import { Vector3, Matrix }  from '@babylonjs/core/Maths/math.vector'
import { VertexBuffer }     from '@babylonjs/core/Buffers/buffer'
import { FloatArray }       from '@babylonjs/core/types'
import { SkyMaterial }      from '@babylonjs/materials/sky/skyMaterial'
import { WaterMaterial }    from '@babylonjs/materials/water/waterMaterial'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'

// ── Perlin noise + ridge FBM ─────────────────────────────────────────────
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
function fbm(x: number, y: number, oct = 7): number {
  let v = 0, a = 0.5, f = 1, m = 0
  for (let i = 0; i < oct; i++) { v += perlin(x * f, y * f) * a; m += a; f *= 2.03; a *= 0.47 }
  return v / m
}
// Ridge noise: inverts abs value for sharp peaks
function ridge(x: number, y: number, oct = 5): number {
  let v = 0, a = 0.6, f = 1, m = 0
  for (let i = 0; i < oct; i++) {
    const n = 1.0 - Math.abs(perlin(x * f, y * f))
    v += n * n * a; m += a; f *= 2.2; a *= 0.45
  }
  return v / m
}

// ── Height → biome colour ───────────────────────────────────────────────
function biomeColor(h: number): [number, number, number] {
  if (h < 0.10) return [0.06, 0.15, 0.38]   // deep water
  if (h < 0.16) return [0.10, 0.25, 0.48]   // shallow water
  if (h < 0.22) return [0.72, 0.66, 0.46]   // sand
  if (h < 0.40) return [0.20, 0.48, 0.16]   // grass
  if (h < 0.55) return [0.14, 0.36, 0.12]   // dark grass
  if (h < 0.70) return [0.38, 0.34, 0.28]   // rock
  if (h < 0.85) return [0.52, 0.50, 0.46]   // high rock
  return [0.90, 0.92, 0.95]                 // snow
}

// ── Engine + Scene ──────────────────────────────────────────────────────
const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.50, 0.70, 0.90, 1] })
const { scene } = grudge

scene.fogMode = 2
scene.fogDensity = 0.005
scene.fogColor = new Color3(0.60, 0.74, 0.88)

// ── Lighting ────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.4; hemi.groundColor = new Color3(0.12, 0.10, 0.08)

const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene)
sun.position = new Vector3(25, 45, 25); sun.intensity = 1.15

// ── Camera ──────────────────────────────────────────────────────────────
const cam = new ArcRotateCamera('c', -Math.PI / 4, Math.PI / 3.5, 55, new Vector3(0, 5, 0), scene)
cam.lowerRadiusLimit = 12; cam.upperRadiusLimit = 140
cam.lowerBetaLimit = 0.1; cam.upperBetaLimit = Math.PI / 2.1
cam.attachControl(grudge.canvas, true)

// ── Skybox ──────────────────────────────────────────────────────────────
const skybox = MeshBuilder.CreateBox('skybox', { size: 800 }, scene)
const skyMat = new SkyMaterial('sky', scene)
skyMat.backFaceCulling = false
skyMat.luminance = 1.0; skyMat.turbidity = 8; skyMat.rayleigh = 2.5
skyMat.mieCoefficient = 0.005; skyMat.mieDirectionalG = 0.82
skyMat.inclination = 0.42; skyMat.azimuth = 0.3
skybox.material = skyMat; skybox.infiniteDistance = true

// ── Terrain mesh with domain-warped ridge noise ──────────────────────
const SIZE = 80, DIVS = 200, MAX_H = 20
const ground = MeshBuilder.CreateGround('terrain', { width: SIZE, height: SIZE, subdivisions: DIVS, updatable: true }, scene)
const positions = ground.getVerticesData(VertexBuffer.PositionKind)!
const colors: number[] = []
const heightMap: number[] = []  // store heights for tree placement

for (let i = 0; i < positions.length; i += 3) {
  const wx = positions[i] / SIZE + 0.5
  const wz = positions[i + 2] / SIZE + 0.5
  // Domain warping: offset coordinates by noise for organic shapes
  const warpX = fbm(wx * 3 + 7.1, wz * 3 + 3.2, 3) * 0.4
  const warpZ = fbm(wx * 3 + 1.5, wz * 3 + 9.8, 3) * 0.4
  // Blend smooth fbm with sharp ridge noise
  const smooth = fbm((wx + warpX) * 4, (wz + warpZ) * 4) * 0.5 + 0.5
  const sharp  = ridge((wx + warpX) * 3.5 + 2.0, (wz + warpZ) * 3.5 + 1.0)
  const h = smooth * 0.6 + sharp * 0.4
  positions[i + 1] = h * MAX_H
  heightMap.push(h)
  const [r, g, b] = biomeColor(h)
  colors.push(r, g, b, 1)
}
ground.updateVerticesData(VertexBuffer.PositionKind, positions)
ground.setVerticesData(VertexBuffer.ColorKind, new Float32Array(colors) as FloatArray)
ground.createNormals(true)

const tMat = new StandardMaterial('tm', scene)
tMat.diffuseColor = Color3.White()
tMat.specularColor = new Color3(0.04, 0.04, 0.04)
tMat.useVertexColors = true as any
;(tMat as any).vertexColorEnabled = true
ground.material = tMat

// ── Instanced trees (simple cylinder trunk + sphere canopy) ──────────
const trunk = MeshBuilder.CreateCylinder('trunk', { height: 1.2, diameterTop: 0.15, diameterBottom: 0.25, tessellation: 6 }, scene)
const trunkMat = new StandardMaterial('bark', scene)
trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.12)
trunk.material = trunkMat

const canopy = MeshBuilder.CreateSphere('canopy', { diameter: 1.4, segments: 5 }, scene)
const canopyMat = new StandardMaterial('leaf', scene)
canopyMat.diffuseColor = new Color3(0.15, 0.45, 0.12)
canopy.material = canopyMat

const treeMatrices: Matrix[] = []
const canopyMatrices: Matrix[] = []
const WATER_LEVEL_H = 0.22  // normalised threshold above which trees can grow
for (let i = 0; i < positions.length; i += 3) {
  const vi = i / 3
  const h = heightMap[vi]
  if (h < WATER_LEVEL_H + 0.04 || h > 0.65) continue  // no trees in water/sand or on rock/snow
  if (Math.random() > 0.004) continue  // sparse placement
  const x = positions[i], y = positions[i + 1], z = positions[i + 2]
  const s = 0.8 + Math.random() * 0.8  // size variation
  treeMatrices.push(Matrix.Compose(new Vector3(s, s * 1.2, s), Vector3.Zero().toQuaternion(), new Vector3(x, y + s * 0.6, z)))
  canopyMatrices.push(Matrix.Compose(new Vector3(s, s, s), Vector3.Zero().toQuaternion(), new Vector3(x, y + s * 1.5, z)))
}
if (treeMatrices.length > 0) {
  const tbuf = new Float32Array(treeMatrices.length * 16)
  const cbuf = new Float32Array(canopyMatrices.length * 16)
  treeMatrices.forEach((m, i) => m.copyToArray(tbuf, i * 16))
  canopyMatrices.forEach((m, i) => m.copyToArray(cbuf, i * 16))
  trunk.thinInstanceSetBuffer('matrix', tbuf, 16)
  canopy.thinInstanceSetBuffer('matrix', cbuf, 16)
}

// ── Water ───────────────────────────────────────────────────────────────
const WATER_Y = MAX_H * 0.18
const waterMesh = MeshBuilder.CreateGround('water', { width: SIZE + 25, height: SIZE + 25, subdivisions: 32 }, scene)
waterMesh.position.y = WATER_Y
const waterMat = new WaterMaterial('wm', scene)
waterMat.windForce = -4; waterMat.waveHeight = 0.12; waterMat.waveLength = 0.25
waterMat.windDirection.set(1, 0.5)
waterMat.waterColor = new Color3(0.04, 0.16, 0.32)
waterMat.colorBlendFactor = 0.25
waterMat.bumpHeight = 0.06
waterMat.addToRenderList(ground)
waterMat.addToRenderList(skybox)
if (treeMatrices.length > 0) { waterMat.addToRenderList(trunk); waterMat.addToRenderList(canopy) }
waterMesh.material = waterMat

// ── Post-processing ─────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [cam])
pip.fxaaEnabled = true
pip.bloomEnabled = true; pip.bloomThreshold = 0.55; pip.bloomWeight = 0.2
pip.imageProcessingEnabled = true
pip.imageProcessing.contrast = 1.1; pip.imageProcessing.exposure = 1.08
pip.imageProcessing.vignetteEnabled = true; pip.imageProcessing.vignetteWeight = 1.4

document.getElementById('hud')!.textContent = 'Procedural Terrain — Ridge + FBM noise, biomes, trees, sky + water  |  Drag to orbit'
grudge.start()
