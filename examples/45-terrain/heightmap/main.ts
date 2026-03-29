import { ArcRotateCamera }    from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }   from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }   from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }             from '@babylonjs/core/Maths/math.color'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { Texture }            from '@babylonjs/core/Materials/Textures/texture'
import { DynamicTexture }     from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { VertexBuffer }       from '@babylonjs/core/Buffers/buffer'
import { GrudgeEngine }       from '../../../src/core/GrudgeEngine'
import { Assets }             from '../../../src/grudge/assets'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.25, 0.45, 0.65, 1] })
const { scene } = grudge

const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.5
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -0.5), scene)
sun.intensity = 1.0
const cam = new ArcRotateCamera('c', -Math.PI / 3, Math.PI / 3.5, 70, new Vector3(0, 8, 0), scene)
cam.attachControl(grudge.canvas, true)

// Generate a heightmap texture procedurally via DynamicTexture
const HM_RES = 256
const hmTex = new DynamicTexture('hm', { width: HM_RES, height: HM_RES }, scene, false)
const ctx = hmTex.getContext() as CanvasRenderingContext2D
const imgData = ctx.createImageData(HM_RES, HM_RES)
const sin = Math.sin, cos = Math.cos
for (let y = 0; y < HM_RES; y++) {
  for (let x = 0; x < HM_RES; x++) {
    const nx = x / HM_RES, ny = y / HM_RES
    let h = sin(nx * 8) * cos(ny * 6) * 0.5 + 0.5
    h += sin(nx * 16 + 1.3) * cos(ny * 12 - 0.7) * 0.25
    h = Math.max(0, Math.min(1, h))
    const v = h * 255
    const idx = (y * HM_RES + x) * 4
    imgData.data[idx] = v; imgData.data[idx+1] = v
    imgData.data[idx+2] = v; imgData.data[idx+3] = 255
  }
}
ctx.putImageData(imgData, 0, 0)
hmTex.update()

// Build ground and displace vertices
const SIZE = 80, DIVS = 100
const ground = MeshBuilder.CreateGround('terrain', { width: SIZE, height: SIZE, subdivisions: DIVS }, scene)
const positions = ground.getVerticesData(VertexBuffer.PositionKind)!
const pixels = imgData.data
const MAX_H = 14
for (let i = 0; i < positions.length; i += 3) {
  const nx = (positions[i] / SIZE + 0.5) * HM_RES | 0
  const nz = (positions[i+2] / SIZE + 0.5) * HM_RES | 0
  const px = Math.max(0, Math.min(HM_RES - 1, nx))
  const pz = Math.max(0, Math.min(HM_RES - 1, nz))
  const height = pixels[(pz * HM_RES + px) * 4] / 255
  positions[i+1] = height * MAX_H
}
ground.updateVerticesData(VertexBuffer.PositionKind, positions)
ground.createNormals(true)

const mat = new StandardMaterial('tm', scene)
mat.diffuseColor = new Color3(0.22, 0.42, 0.15)
mat.specularColor = new Color3(0.02, 0.02, 0.02)
ground.material = mat

// Ocean
const ocean = MeshBuilder.CreateGround('ocean', { width: SIZE + 20, height: SIZE + 20 }, scene)
ocean.position.y = 1.8
const om = new StandardMaterial('om', scene)
om.diffuseColor = new Color3(0.08, 0.25, 0.65)
om.alpha = 0.65
ocean.material = om

document.getElementById('hud')!.textContent = 'Heightmap Terrain — sine-wave composite map  |  Drag to orbit'
grudge.start()
