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

const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 30, Vector3.Zero(), scene)
cam.attachControl(grudge.canvas, true)

// Ground
const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.12, 0.18, 0.1)
const ground = MeshBuilder.CreateGround('g', { width: 40, height: 40 }, scene)
ground.material = gm

// Waypoints (shown as markers)
const waypoints = [
  new Vector3(-10, 0, -10), new Vector3(10, 0, -10),
  new Vector3(10, 0, 10),   new Vector3(-10, 0, 10),
]
waypoints.forEach((wp, i) => {
  const m = MeshBuilder.CreateCylinder(`wp${i}`, { diameter: 0.5, height: 0.1 }, scene)
  m.position.copyFrom(wp)
  const mat = new StandardMaterial(`wpm${i}`, scene)
  mat.emissiveColor = new Color3(0.2, 0.8, 0.4)
  m.material = mat
})

// AI Agents patrolling
const agentColors = [new Color3(0.8, 0.3, 0.2), new Color3(0.2, 0.5, 0.9), new Color3(0.9, 0.7, 0.1)]
const agents = agentColors.map((col, i) => {
  const mesh = MeshBuilder.CreateCapsule(`agent${i}`, { radius: 0.3, height: 1.4 }, scene)
  mesh.position.set(waypoints[i % waypoints.length].x, 0.7, waypoints[i % waypoints.length].z)
  const mat = new StandardMaterial(`am${i}`, scene)
  mat.diffuseColor = col
  mesh.material = mat
  return { mesh, wpIdx: i % waypoints.length, speed: 3 + i * 0.5 }
})

document.getElementById('hud')!.textContent = 'AI Patrol — agents follow waypoints in sequence'

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  agents.forEach(a => {
    const target = waypoints[a.wpIdx]
    const diff = target.subtract(a.mesh.position)
    diff.y = 0
    const dist = diff.length()
    if (dist < 0.3) {
      a.wpIdx = (a.wpIdx + 1) % waypoints.length
    } else {
      const dir = diff.normalize()
      a.mesh.position.addInPlace(dir.scale(a.speed * dt))
      a.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })
})
