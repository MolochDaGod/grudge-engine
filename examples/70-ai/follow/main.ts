import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }           from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'
import { InputManager }     from '../../../src/core/InputManager'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.05, 0.06, 0.12, 1] })
const { scene } = grudge
const input = new InputManager()

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.8
const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3.5, 28, Vector3.Zero(), scene)
cam.attachControl(grudge.canvas, true)

const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.12, 0.18, 0.1)
MeshBuilder.CreateGround('g', { width: 40, height: 40 }, scene).material = gm

// Player (target)
const player = MeshBuilder.CreateCapsule('player', { radius: 0.4, height: 1.8 }, scene)
player.position.y = 0.9
const pm = new StandardMaterial('pm', scene)
pm.diffuseColor = new Color3(0.78, 0.65, 0.3)
player.material = pm

// Followers
const followers = Array.from({ length: 5 }, (_, i) => {
  const angle = (i / 5) * Math.PI * 2
  const mesh = MeshBuilder.CreateCapsule(`f${i}`, { radius: 0.3, height: 1.4 }, scene)
  mesh.position.set(Math.cos(angle) * 8, 0.7, Math.sin(angle) * 8)
  const mat = new StandardMaterial(`fm${i}`, scene)
  mat.diffuseColor = new Color3(0.2 + i * 0.15, 0.4, 0.8 - i * 0.1)
  mesh.material = mat
  return { mesh, speed: 2.5 + i * 0.3, stopDist: 1.5 + i * 0.4 }
})

document.getElementById('hud')!.textContent = 'WASD — Move player  |  Followers track you'

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  const spd = input.run ? 8 : 5
  if (input.up)    player.position.z += spd * dt
  if (input.down)  player.position.z -= spd * dt
  if (input.left)  player.position.x -= spd * dt
  if (input.right) player.position.x += spd * dt
  cam.target = Vector3.Lerp(cam.target, player.position.add(new Vector3(0, 1, 0)), 0.1)

  followers.forEach(f => {
    const diff = player.position.subtract(f.mesh.position)
    diff.y = 0
    if (diff.length() > f.stopDist) {
      const dir = diff.normalize()
      f.mesh.position.addInPlace(dir.scale(f.speed * dt))
      f.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })
  input.flush()
})
