import { UniversalCamera }   from '@babylonjs/core/Cameras/universalCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }  from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }   from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }  from '@babylonjs/core/Materials/standardMaterial'
import { Ray }               from '@babylonjs/core/Culling/ray'
import { Color3 }            from '@babylonjs/core/Maths/math.color'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }      from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.04, 0.04, 0.08, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.3
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -0.5), scene)
sun.position = new Vector3(10, 20, 10); sun.intensity = 1
const shadows = new ShadowGenerator(512, sun)

// FPS Camera
const cam = new UniversalCamera('fps', new Vector3(0, 1.7, 0), scene)
cam.setTarget(new Vector3(0, 1.7, 5))
cam.speed = 0.15; cam.minZ = 0.05
cam.keysUp=[87]; cam.keysDown=[83]; cam.keysLeft=[65]; cam.keysRight=[68]
cam.attachControl(grudge.canvas, true)
grudge.canvas.addEventListener('click', () => grudge.canvas.requestPointerLock())

// Ground + arena walls
const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.12, 0.12, 0.15)
MeshBuilder.CreateGround('g', { width: 40, height: 40 }, scene).material = gm

const WALL_H = 4, WALL_W = 40
const wallDefs: [number, number, number, number, number][] = [
  [0, WALL_H/2, 20, WALL_W, WALL_H],
  [0, WALL_H/2, -20, WALL_W, WALL_H],
  [20, WALL_H/2, 0, WALL_H, WALL_W],
  [-20, WALL_H/2, 0, WALL_H, WALL_W],
]
wallDefs.forEach(([x, y, z, w, h], i) => {
  const b = MeshBuilder.CreateBox(`wall${i}`, { width: w, height: h, depth: 0.5 }, scene)
  b.position.set(x, y, z)
  const m = new StandardMaterial(`wm${i}`, scene); m.diffuseColor = new Color3(0.2, 0.2, 0.25); b.material = m
})

// Crates for cover
for (let i = 0; i < 10; i++) {
  const s = 1 + Math.random()
  const b = MeshBuilder.CreateBox(`c${i}`, { size: s }, scene)
  const angle = (i / 10) * Math.PI * 2
  b.position.set(Math.cos(angle) * (6 + Math.random() * 4), s / 2, Math.sin(angle) * (6 + Math.random() * 4))
  const m = new StandardMaterial(`cm${i}`, scene); m.diffuseColor = new Color3(0.35, 0.28, 0.18); b.material = m
  shadows.addShadowCaster(b); b.receiveShadows = true
}

// Enemies
type Enemy = { mesh: ReturnType<typeof MeshBuilder.CreateCapsule>; hp: number; speed: number; dead: boolean }
let wave = 1, kills = 0

function spawnWave(w: number): Enemy[] {
  return Array.from({ length: 3 + w }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const r = 12 + Math.random() * 5
    const mesh = MeshBuilder.CreateCapsule(`e${w}_${i}`, { radius: 0.4, height: 1.8 }, scene)
    mesh.position.set(Math.cos(angle) * r, 0.9, Math.sin(angle) * r)
    const m = new StandardMaterial(`em${w}_${i}`, scene)
    m.diffuseColor = new Color3(0.7, 0.15, 0.1)
    mesh.material = m; shadows.addShadowCaster(mesh)
    return { mesh, hp: 2 + w, speed: 1.2 + w * 0.2, dead: false }
  })
}

let enemies = spawnWave(wave)
const hud = document.getElementById('hud')!
let shootCd = 0

// Shoot on click
document.addEventListener('click', () => {
  if (!document.pointerLockElement || shootCd > 0) return
  shootCd = 0.3
  const ray = scene.createPickingRay(grudge.canvas.width / 2, grudge.canvas.height / 2, null, cam)
  const hit = scene.pickWithRay(ray)
  if (hit?.pickedMesh) {
    const target = enemies.find(e => !e.dead && e.mesh === hit.pickedMesh)
    if (target) {
      target.hp--
      if (target.hp <= 0) { target.dead = true; target.mesh.isVisible = false; kills++ }
    }
  }
})

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) hud.textContent = 'Click to play  |  WASD Move  |  Click Shoot'
})

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  shootCd = Math.max(0, shootCd - dt)

  enemies.forEach(e => {
    if (e.dead) return
    const diff = cam.position.subtract(e.mesh.position); diff.y = 0
    if (diff.length() > 1.2) {
      const dir = diff.normalize()
      e.mesh.position.addInPlace(dir.scale(e.speed * dt))
      e.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })

  const alive = enemies.filter(e => !e.dead)
  if (alive.length === 0) {
    wave++
    enemies = spawnWave(wave)
  }
  if (document.pointerLockElement)
    hud.textContent = `WASD Move  |  Click Shoot  |  Wave: ${wave}  |  Kills: ${kills}  |  Enemies: ${alive.length}`
  else
    hud.textContent = 'Click to play  |  WASD Move  |  Click Shoot'
})
