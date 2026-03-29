import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { PointLight }        from '@babylonjs/core/Lights/pointLight'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }  from '@babylonjs/core/Materials/standardMaterial'
import { ParticleSystem }    from '@babylonjs/core/Particles/particleSystem'
import { Texture }           from '@babylonjs/core/Materials/Textures/texture'
import { Color4, Color3 }    from '@babylonjs/core/Maths/math.color'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }      from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.02, 0.02, 0.04, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.1
const fireLight = new PointLight('fl', new Vector3(0, 1.5, 0), scene)
fireLight.diffuse = new Color3(1, 0.5, 0.1)
fireLight.intensity = 2

const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 8, new Vector3(0, 2, 0), scene)
cam.attachControl(grudge.canvas, true)

// Ground
const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.1, 0.08, 0.06)
MeshBuilder.CreateGround('g', { width: 20, height: 20 }, scene).material = gm

// Log base
const log = MeshBuilder.CreateCylinder('log', { diameter: 0.4, height: 0.2 }, scene)
log.position.y = 0.1
const lm = new StandardMaterial('lm', scene)
lm.diffuseColor = new Color3(0.3, 0.18, 0.08)
log.material = lm

// Fire particles
const fire = new ParticleSystem('fire', 800, scene)
fire.emitter = new Vector3(0, 0.2, 0)
fire.minEmitBox = new Vector3(-0.15, 0, -0.15)
fire.maxEmitBox = new Vector3(0.15, 0, 0.15)

// Use built-in flare texture
fire.particleTexture = new Texture('https://assets.babylonjs.com/textures/flare.png', scene)

fire.color1 = new Color4(1, 0.6, 0.1, 1)
fire.color2 = new Color4(1, 0.2, 0.0, 0.8)
fire.colorDead = new Color4(0.2, 0.1, 0, 0)

fire.minSize = 0.2; fire.maxSize = 0.7
fire.minLifeTime = 0.2; fire.maxLifeTime = 0.6
fire.emitRate = 300
fire.blendMode = ParticleSystem.BLENDMODE_ADD
fire.gravity = new Vector3(0, -1, 0)
fire.direction1 = new Vector3(-0.3, 3, -0.3)
fire.direction2 = new Vector3(0.3, 4, 0.3)
fire.minAngularSpeed = 0; fire.maxAngularSpeed = Math.PI / 4
fire.minEmitPower = 0.5; fire.maxEmitPower = 1.5
fire.updateSpeed = 0.01
fire.start()

// Embers
const embers = new ParticleSystem('embers', 50, scene)
embers.emitter = new Vector3(0, 0.5, 0)
embers.particleTexture = new Texture('https://assets.babylonjs.com/textures/flare.png', scene)
embers.color1 = new Color4(1, 0.4, 0, 1)
embers.color2 = new Color4(1, 0.6, 0, 0.6)
embers.colorDead = new Color4(0, 0, 0, 0)
embers.minSize = 0.03; embers.maxSize = 0.08
embers.minLifeTime = 0.8; embers.maxLifeTime = 2
embers.emitRate = 20
embers.blendMode = ParticleSystem.BLENDMODE_ADD
embers.direction1 = new Vector3(-1, 4, -1)
embers.direction2 = new Vector3(1, 6, 1)
embers.gravity = new Vector3(0, -2, 0)
embers.minEmitPower = 0.5; embers.maxEmitPower = 2
embers.updateSpeed = 0.01
embers.start()

// Animate fire light flicker
grudge.start((deltaMs) => {
  const t = grudge.engine.getDeltaTime() / 1000
  fireLight.intensity = 1.8 + Math.sin(Date.now() * 0.02) * 0.4 + Math.random() * 0.3
})
document.getElementById('hud')!.textContent = 'Fire — Babylon.js particle system  |  Drag to orbit'
