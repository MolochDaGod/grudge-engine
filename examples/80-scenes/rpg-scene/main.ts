import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }  from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }           from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'
import { InputManager }     from '../../../src/core/InputManager'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.05, 0.06, 0.1, 1] })
const { scene } = grudge
const input = new InputManager()

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.4
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -0.5), scene)
sun.position = new Vector3(20, 40, 20); sun.intensity = 1.1
const shadows = new ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true

const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3.5, 18, new Vector3(0, 1, 0), scene)
cam.lowerRadiusLimit = 4; cam.upperRadiusLimit = 30
cam.attachControl(grudge.canvas, true)

// Ground
const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.15, 0.22, 0.12)
const ground = MeshBuilder.CreateGround('g', { width: 50, height: 50 }, scene)
ground.material = gm; ground.receiveShadows = true

// Ruins / obstacles
[[0,0,10],[8,0,-5],[-9,0,-3],[4,0,6],[-5,0,8]].forEach(([x,,z], i) => {
  const h = 1 + (i % 3)
  const b = MeshBuilder.CreateBox(`r${i}`, { width: 1.5 + (i%2), height: h, depth: 1.5 }, scene)
  b.position.set(x, h/2, z)
  const m = new StandardMaterial(`rm${i}`, scene)
  m.diffuseColor = new Color3(0.35, 0.3, 0.28)
  b.material = m; b.receiveShadows = true; shadows.addShadowCaster(b)
})

// Player
const player = MeshBuilder.CreateCapsule('player', { radius: 0.4, height: 1.8 }, scene)
player.position.y = 0.9
const pm = new StandardMaterial('pm', scene)
pm.diffuseColor = new Color3(0.78, 0.65, 0.3)
player.material = pm; shadows.addShadowCaster(player)

let score = 0
const hud = document.getElementById('hud')!

// Orcs (enemies)
type Orc = { mesh: ReturnType<typeof MeshBuilder.CreateCapsule>; hp: number; speed: number; dead: boolean }
const orcs: Orc[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  const r = 10 + (i % 3) * 3
  const mesh = MeshBuilder.CreateCapsule(`orc${i}`, { radius: 0.45, height: 2 }, scene)
  mesh.position.set(Math.cos(angle) * r, 1, Math.sin(angle) * r)
  const m = new StandardMaterial(`om${i}`, scene)
  m.diffuseColor = new Color3(0.2, 0.5, 0.15)
  mesh.material = m; shadows.addShadowCaster(mesh)
  return { mesh, hp: 3, speed: 1.5 + Math.random(), dead: false }
})

// Attack cooldown
let attackCd = 0
const ATTACK_RANGE = 2.5

grudge.start((deltaMs) => {
  const dt = deltaMs / 1000
  attackCd = Math.max(0, attackCd - dt)

  // Player movement
  const spd = input.run ? 9 : 5
  if (input.up)    player.position.z += spd * dt
  if (input.down)  player.position.z -= spd * dt
  if (input.left)  player.position.x -= spd * dt
  if (input.right) player.position.x += spd * dt
  cam.target = Vector3.Lerp(cam.target, player.position.add(new Vector3(0,1,0)), 0.1)

  // Attack
  if (input.attack && attackCd <= 0) {
    attackCd = 0.6
    orcs.forEach(orc => {
      if (orc.dead) return
      const dist = Vector3.Distance(player.position, orc.mesh.position)
      if (dist < ATTACK_RANGE) {
        orc.hp--
        if (orc.hp <= 0) {
          orc.dead = true
          orc.mesh.isVisible = false
          score++
        }
      }
    })
  }

  // Orcs pursue player
  const alive = orcs.filter(o => !o.dead)
  alive.forEach(orc => {
    const diff = player.position.subtract(orc.mesh.position)
    diff.y = 0
    if (diff.length() > 1.2) {
      const dir = diff.normalize()
      orc.mesh.position.addInPlace(dir.scale(orc.speed * dt))
      orc.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })

  const remaining = alive.length
  hud.textContent = remaining === 0
    ? `Victory! All orcs defeated! Score: ${score}`
    : `WASD Move  |  J/Click ATTACK  |  Orcs: ${remaining}  |  Kills: ${score}`
  input.flush()
})
