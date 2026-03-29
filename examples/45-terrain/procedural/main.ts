import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }           from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { VertexBuffer }     from '@babylonjs/core/Buffers/buffer'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.3, 0.5, 0.7, 1] })
const { scene } = grudge

const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.5
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -0.5), scene)
sun.intensity = 1.0

const cam = new ArcRotateCamera('c', -Math.PI / 4, Math.PI / 3.5, 60, new Vector3(0, 5, 0), scene)
cam.attachControl(grudge.canvas, true)

// Simple 2D noise (value noise)
function smoothstep(t: number) { return t * t * (3 - 2 * t) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const h = (n: number) => { let v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
  return lerp(
    lerp(h(xi + yi * 57), h(xi + 1 + yi * 57), smoothstep(xf)),
    lerp(h(xi + (yi + 1) * 57), h(xi + 1 + (yi + 1) * 57), smoothstep(xf)),
    smoothstep(yf)
  )
}
function fbm(x: number, y: number, octaves = 5): number {
  let v = 0, amp = 0.5, freq = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * freq, y * freq) * amp
    max += amp; freq *= 2; amp *= 0.5
  }
  return v / max
}

// Build terrain mesh
const SIZE = 60, DIVS = 80
const ground = MeshBuilder.CreateGround('terrain', { width: SIZE, height: SIZE, subdivisions: DIVS }, scene)
const positions = ground.getVerticesData(VertexBuffer.PositionKind)!
const SCALE = 12
for (let i = 0; i < positions.length; i += 3) {
  const wx = positions[i] / SIZE + 0.5
  const wz = positions[i + 2] / SIZE + 0.5
  positions[i + 1] = fbm(wx * 4, wz * 4) * SCALE - 1
}
ground.updateVerticesData(VertexBuffer.PositionKind, positions)
ground.createNormals(true)

const mat = new StandardMaterial('tm', scene)
mat.diffuseColor = new Color3(0.25, 0.45, 0.18)
mat.specularColor = new Color3(0.05, 0.05, 0.05)
ground.material = mat

// Water plane
const water = MeshBuilder.CreateGround('water', { width: SIZE, height: SIZE }, scene)
water.position.y = 1.2
const wm = new StandardMaterial('wm', scene)
wm.diffuseColor = new Color3(0.1, 0.3, 0.7)
wm.alpha = 0.6
water.material = wm

document.getElementById('hud')!.textContent = 'Procedural Terrain — FBM noise, 5 octaves  |  Drag to orbit'
grudge.start()
