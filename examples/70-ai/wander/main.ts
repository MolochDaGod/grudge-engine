import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }           from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.05, 0.06, 0.12, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.8
const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 35, Vector3.Zero(), scene)
cam.attachControl(grudge.canvas, true)

const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.12, 0.18, 0.1)
MeshBuilder.CreateGround('g', { width: 50, height: 50 }, scene).material = gm

const BOUNDS = 18

type Wanderer = { mesh: ReturnType<typeof MeshBuilder.CreateCapsule>; target: Vector3; timer: number; speed: number }

function newTarget(): Vector3 {
  return new Vector3((Math.random() - 0.5) * BOUNDS * 2, 0.7, (Math.random() - 0.5) * BOUNDS * 2)
}

const wanderers: Wanderer[] = Array.from({ length: 8 }, (_, i) => {
  const mesh = MeshBuilder.CreateCapsule(`w${i}`, { radius: 0.3, height: 1.4 }, scene)
  mesh.position.set((Math.random() - 0.5) * 20, 0.7, (Math.random() - 0.5) * 20)
  const mat = new StandardMaterial(`wm${i}`, scene)
  mat.diffuseColor = new Color3(0.3 + (i % 3) * 0.25, 0.5, 0.7 - (i % 3) * 0.15)
  mesh.material = mat
  return { mesh, target: newTarget(), timer: Math.random() * 3, speed: 2 + Math.random() * 2 }
})

document.getElementById('hud')!.textContent = 'AI Wander — agents choose random destinations'

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  wanderers.forEach(w => {
    w.timer -= dt
    const diff = w.target.subtract(w.mesh.position)
    diff.y = 0
    if (diff.length() < 0.5 || w.timer <= 0) {
      w.target = newTarget()
      w.timer = 2 + Math.random() * 4
    } else {
      const dir = diff.normalize()
      w.mesh.position.addInPlace(dir.scale(w.speed * dt))
      w.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })
})
