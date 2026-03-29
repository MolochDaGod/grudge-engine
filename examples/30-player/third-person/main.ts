/**
 * Third-Person Camera Demo
 * Demonstrates the Grudge Engine core:
 *  - GrudgeEngine bootstrap
 *  - InputManager
 *  - Actor + StateMachine
 *  - Over-shoulder camera (Fortnite/WoW style)
 *  - GLB model loading from Grudge object storage
 */

import '@babylonjs/loaders/glTF'
import { SceneLoader }        from '@babylonjs/core/Loading/sceneLoader'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }   from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }    from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { ArcRotateCamera }    from '@babylonjs/core/Cameras/arcRotateCamera'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }   from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }             from '@babylonjs/core/Maths/math.color'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { Texture }            from '@babylonjs/core/Materials/Textures/texture'
import { AbstractMesh }       from '@babylonjs/core/Meshes/abstractMesh'

import { GrudgeEngine }  from '../../../src/core/GrudgeEngine'
import { InputManager }  from '../../../src/core/InputManager'
import { Actor }         from '../../../src/core/Actor'
import { Assets }        from '../../../src/grudge/assets'

// ── Bootstrap ────────────────────────────────────────────────────────────────
const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.05, 0.07, 0.12, 1] })
const { scene, engine } = grudge
const input = new InputManager()

// ── Lighting ─────────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.5

const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
sun.position = new Vector3(20, 40, 20)
sun.intensity = 1.2

const shadows = new ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true

// ── Ground ───────────────────────────────────────────────────────────────────
const ground = MeshBuilder.CreateGround('ground', { width: 80, height: 80, subdivisions: 4 }, scene)
const groundMat = new StandardMaterial('groundMat', scene)
groundMat.diffuseColor = new Color3(0.18, 0.22, 0.14)

// Try loading a grass texture from object storage; fall back to solid color
const grassUrl = Assets.texture('terrain/grass_diffuse.jpg')
try {
  const tex = new Texture(grassUrl, scene)
  tex.uScale = 12; tex.vScale = 12
  groundMat.diffuseTexture = tex
} catch { /* use solid color fallback */ }

ground.material = groundMat
ground.receiveShadows = true

// ── Some environment props ────────────────────────────────────────────────────
const addBox = (x: number, z: number, h = 1.5) => {
  const box = MeshBuilder.CreateBox(`box_${x}_${z}`, { width: 1.5, height: h, depth: 1.5 }, scene)
  box.position.set(x, h / 2, z)
  const m = new StandardMaterial(`bm_${x}`, scene)
  m.diffuseColor = new Color3(0.3, 0.3, 0.35)
  box.material = m
  box.receiveShadows = true
  shadows.addShadowCaster(box)
  return box
}
addBox(5, 5); addBox(-6, 3); addBox(8, -7, 2.5); addBox(-4, -8)

// ── Player mesh (placeholder capsule + optional GLB) ─────────────────────────
const capsule = MeshBuilder.CreateCapsule('player', { radius: 0.4, height: 1.8 }, scene)
capsule.position.y = 0.9
const pMat = new StandardMaterial('pMat', scene)
pMat.diffuseColor = new Color3(0.78, 0.66, 0.3)
capsule.material = pMat
shadows.addShadowCaster(capsule)

let charMesh: AbstractMesh | null = null

// Try loading a GLB from object storage — use capsule as fallback
const charUrl = Assets.voxelChar('warrior')
SceneLoader.ImportMeshAsync('', charUrl.replace(/\/[^/]+$/, '/'), charUrl.split('/').pop()!, scene)
  .then(result => {
    charMesh = result.meshes[0]
    charMesh.parent = capsule
    charMesh.position.y = -0.9
    charMesh.scaling.setAll(0.8)
    capsule.isVisible = false
    result.meshes.forEach(m => { shadows.addShadowCaster(m); m.receiveShadows = true })
  })
  .catch(() => { /* capsule stays visible */ })

// ── Actor + states ────────────────────────────────────────────────────────────
const player = new Actor({ mesh: capsule, scene, speed: 5, runMultiplier: 2, gravity: 20, jumpForce: 8, input })

// Idle state
player.addState({
  name: 'idle',
  enter(a) { a.velocity.x = 0; a.velocity.z = 0 },
  update(a, dt) {
    if (a.input?.up || a.input?.down || a.input?.left || a.input?.right)
      a.setState('walk')
    applyGravity(a, dt)
  },
  exit() {},
})

// Walk state
player.addState({
  name: 'walk',
  enter() {},
  update(a, dt) {
    if (!a.input?.up && !a.input?.down && !a.input?.left && !a.input?.right) {
      a.setState('idle'); return
    }
    if (a.input?.run) { a.setState('run'); return }

    const spd = a.speed
    moveCharacter(a, spd, dt)
    applyGravity(a, dt)
  },
  exit() {},
})

// Run state
player.addState({
  name: 'run',
  enter() {},
  update(a, dt) {
    if (!a.input?.up && !a.input?.down && !a.input?.left && !a.input?.right) {
      a.setState('idle'); return
    }
    if (!a.input?.run) { a.setState('walk'); return }

    moveCharacter(a, a.speed * a.runMultiplier, dt)
    applyGravity(a, dt)
  },
  exit() {},
})

player.setState('idle')

// ── Camera — over-shoulder ArcRotate ─────────────────────────────────────────
const cam = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 8, capsule.position, scene)
cam.lowerRadiusLimit  = 2
cam.upperRadiusLimit  = 20
cam.upperBetaLimit    = Math.PI / 2.1
cam.wheelPrecision    = 30
cam.panningSensibility = 0

// Lock onto player — right-drag rotates camera (no pan)
scene.onPointerObservable.add(ev => {
  if (ev.event.buttons === 2) {
    const e = ev.event as PointerEvent
    cam.alpha -= e.movementX * 0.005
    cam.beta  -= e.movementY * 0.005
  }
})

// ── Movement helpers ──────────────────────────────────────────────────────────
function moveCharacter(a: Actor, speed: number, dt: number): void {
  // Camera-relative movement (Fortnite-style: W = away from camera)
  const forward = Vector3.Normalize(cam.target.subtract(cam.position))
  forward.y = 0
  const right = Vector3.Cross(Vector3.Up(), forward).normalize()

  const move = Vector3.Zero()
  if (a.input?.up)    move.addInPlace(forward)
  if (a.input?.down)  move.subtractInPlace(forward)
  if (a.input?.left)  move.subtractInPlace(right)
  if (a.input?.right) move.addInPlace(right)

  if (move.lengthSquared() > 0) {
    move.normalize().scaleInPlace(speed)
    a.mesh.position.addInPlace(move.scale(dt))

    // Face movement direction
    const angle = Math.atan2(move.x, move.z)
    a.mesh.rotation.y = angle
  }

  // Update camera target to follow player
  cam.target = Vector3.Lerp(cam.target, a.mesh.position.add(new Vector3(0, 1, 0)), 0.15)
}

function applyGravity(a: Actor, dt: number): void {
  if (!a.grounded) {
    a.velocity.y -= a.gravity * dt
    a.mesh.position.y += a.velocity.y * dt
  }
  if (a.mesh.position.y <= 0.9) {
    a.mesh.position.y = 0.9
    a.velocity.y = 0
    a.grounded = true
  }
  if (a.input?.jump && a.grounded) {
    a.velocity.y = a.jumpForce
    a.grounded = false
  }
}

// ── Render loop ───────────────────────────────────────────────────────────────
grudge.start((deltaMs) => {
  player.update(deltaMs / 1000)
})
