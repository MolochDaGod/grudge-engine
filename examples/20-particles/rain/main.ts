import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { ParticleSystem }   from '@babylonjs/core/Particles/particleSystem'
import { Texture }          from '@babylonjs/core/Materials/Textures/texture'
import { Color4, Color3 }   from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.08, 0.1, 0.15, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.4
const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3.5, 18, new Vector3(0, 3, 0), scene)
cam.attachControl(grudge.canvas, true)

const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.1, 0.12, 0.14)
MeshBuilder.CreateGround('g', { width: 30, height: 30 }, scene).material = gm

// Buildings
[[0, 4, 6], [-5, 3, -4], [6, 2.5, -3]].forEach(([x, h, z], i) => {
  const b = MeshBuilder.CreateBox(`b${i}`, { width: 2, height: h, depth: 2 }, scene)
  b.position.set(x, h / 2, z)
  const m = new StandardMaterial(`bm${i}`, scene)
  m.diffuseColor = new Color3(0.2, 0.2, 0.25)
  b.material = m
})

// Rain
const rain = new ParticleSystem('rain', 3000, scene)
rain.emitter = new Vector3(0, 12, 0)
rain.minEmitBox = new Vector3(-15, 0, -15)
rain.maxEmitBox = new Vector3(15, 0, 15)
rain.particleTexture = new Texture('https://assets.babylonjs.com/textures/flare.png', scene)
rain.color1 = new Color4(0.6, 0.7, 1, 0.6)
rain.color2 = new Color4(0.4, 0.5, 0.9, 0.4)
rain.colorDead = new Color4(0, 0, 0, 0)
rain.minSize = 0.04; rain.maxSize = 0.08
rain.minLifeTime = 0.5; rain.maxLifeTime = 1.0
rain.emitRate = 1500
rain.blendMode = ParticleSystem.BLENDMODE_ADD
rain.gravity = new Vector3(0, -20, 0)
rain.direction1 = new Vector3(-0.5, -10, -0.5)
rain.direction2 = new Vector3(0.5, -12, 0.5)
rain.minEmitPower = 8; rain.maxEmitPower = 12
rain.updateSpeed = 0.005
rain.start()

document.getElementById('hud')!.textContent = 'Rain — 3000 particles  |  Drag to orbit'
grudge.start()
