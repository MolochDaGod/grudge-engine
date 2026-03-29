import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { ParticleSystem }   from '@babylonjs/core/Particles/particleSystem'
import { Texture }          from '@babylonjs/core/Materials/Textures/texture'
import { Color4, Color3 }   from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.06, 0.07, 0.1, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.5
const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 14, new Vector3(0, 4, 0), scene)
cam.attachControl(grudge.canvas, true)

const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.12, 0.1, 0.1)
MeshBuilder.CreateGround('g', { width: 20, height: 20 }, scene).material = gm

// Chimney
const chimney = MeshBuilder.CreateCylinder('ch', { diameterTop: 0.3, diameterBottom: 0.5, height: 3 }, scene)
chimney.position.set(0, 1.5, 0)
const cm = new StandardMaterial('cm', scene)
cm.diffuseColor = new Color3(0.25, 0.2, 0.18)
chimney.material = cm

// Smoke
const smoke = new ParticleSystem('smoke', 400, scene)
smoke.emitter = new Vector3(0, 3.1, 0)
smoke.minEmitBox = new Vector3(-0.1, 0, -0.1)
smoke.maxEmitBox = new Vector3(0.1, 0, 0.1)
smoke.particleTexture = new Texture('https://assets.babylonjs.com/textures/smoke_15.png', scene)
smoke.color1 = new Color4(0.4, 0.4, 0.4, 0.5)
smoke.color2 = new Color4(0.6, 0.6, 0.6, 0.3)
smoke.colorDead = new Color4(0.7, 0.7, 0.7, 0)
smoke.minSize = 0.5; smoke.maxSize = 1.8
smoke.minLifeTime = 1.5; smoke.maxLifeTime = 4
smoke.emitRate = 60
smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
smoke.gravity = new Vector3(0, 0.5, 0)
smoke.direction1 = new Vector3(-0.2, 2, -0.2)
smoke.direction2 = new Vector3(0.2, 3, 0.2)
smoke.minAngularSpeed = 0; smoke.maxAngularSpeed = Math.PI / 3
smoke.minEmitPower = 0.5; smoke.maxEmitPower = 1
smoke.updateSpeed = 0.005
smoke.start()

document.getElementById('hud')!.textContent = 'Smoke — volumetric particle system  |  Drag to orbit'
grudge.start()
