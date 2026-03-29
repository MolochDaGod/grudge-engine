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
const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 32, Vector3.Zero(), scene)
cam.attachControl(grudge.canvas, true)

const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.1, 0.14, 0.1)
MeshBuilder.CreateGround('g', { width: 50, height: 50 }, scene).material = gm

// Player
const player = MeshBuilder.CreateCapsule('p', { radius: 0.4, height: 1.8 }, scene)
player.position.y = 0.9
const pm = new StandardMaterial('pm', scene)
pm.diffuseColor = new Color3(0.3, 0.7, 0.3)
player.material = pm
let prevPos = player.position.clone()
let playerVelocity = Vector3.Zero()

// Pursuers
const pursuers = Array.from({ length: 4 }, (_, i) => {
  const angle = (i / 4) * Math.PI * 2
  const mesh = MeshBuilder.CreateCapsule(`pu${i}`, { radius: 0.35, height: 1.6 }, scene)
  mesh.position.set(Math.cos(angle) * 15, 0.8, Math.sin(angle) * 15)
  const mat = new StandardMaterial(`pum${i}`, scene)
  mat.diffuseColor = new Color3(0.8, 0.2, 0.2)
  mesh.material = mat
  return { mesh, speed: 3.5 + i * 0.3 }
})

document.getElementById('hud')!.textContent = 'WASD — Move  |  Pursuers predict your path'

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  prevPos = player.position.clone()
  const spd = input.run ? 9 : 6
  if (input.up)    player.position.z += spd * dt
  if (input.down)  player.position.z -= spd * dt
  if (input.left)  player.position.x -= spd * dt
  if (input.right) player.position.x += spd * dt
  player.position.x = Math.max(-20, Math.min(20, player.position.x))
  player.position.z = Math.max(-20, Math.min(20, player.position.z))

  playerVelocity = player.position.subtract(prevPos).scale(1 / dt)
  cam.target = Vector3.Lerp(cam.target, player.position.add(new Vector3(0,1,0)), 0.08)

  pursuers.forEach(pu => {
    const toTarget = player.position.subtract(pu.mesh.position)
    const dist = toTarget.length()
    // Predict ahead by time-to-reach / 2
    const timeAhead = dist / pu.speed * 0.4
    const predicted = player.position.add(playerVelocity.scale(timeAhead))
    const diff = predicted.subtract(pu.mesh.position)
    diff.y = 0
    if (diff.length() > 0.3) {
      const dir = diff.normalize()
      pu.mesh.position.addInPlace(dir.scale(pu.speed * dt))
      pu.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })
  input.flush()
})
