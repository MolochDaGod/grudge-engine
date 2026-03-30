/**
 * Third-Person Physics Character Controller — Grudge Engine
 *
 * Direct port of the BJS PhysicsCharacterController playground by @CedricGuillemet
 * https://playground.babylonjs.com/#Z17UYS#131
 *
 * Changes from the original playground JS:
 *  - All BABYLON.* replaced with proper modular TypeScript imports
 *  - displayCapsule replaced with our Knight character from Grudge R2
 *  - autoNormalizeCharacter() applied so the model scales to 1.8 m
 *  - Animation switching: idle / walk / jump driven by controller state
 *  - Character rotates to face the direction of movement
 *  - Grudge Engine loading overlay with progress bar
 *  - Engine + render loop created here (playground provides them externally)
 *
 * Controls
 *  WASD / Arrow keys  — Move
 *  Drag mouse         — Orbit camera
 *  Space              — Jump
 */

// Full BJS surface — equivalent to the playground CDN bundle
import '../../../src/babylon-full'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

import HavokPhysics         from '@babylonjs/havok'
import { HavokPlugin }      from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import {
  PhysicsCharacterController,
  CharacterSupportedState,
} from '@babylonjs/core/Physics/v2/characterController'
import { HingeConstraint }  from '@babylonjs/core/Physics/v2/physicsConstraint'

import { Engine }             from '@babylonjs/core/Engines/engine'
import { Scene }              from '@babylonjs/core/scene'
import { FreeCamera }         from '@babylonjs/core/Cameras/freeCamera'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { Color4 }             from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { SceneLoader }        from '@babylonjs/core/Loading/sceneLoader'
import { Texture }            from '@babylonjs/core/Materials/Textures/texture'
import { PointerEventTypes }  from '@babylonjs/core/Events/pointerEvents'
import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents'
import { AbstractMesh }       from '@babylonjs/core/Meshes/abstractMesh'
import { AnimationGroup }     from '@babylonjs/core/Animations/animationGroup'

import { autoNormalizeCharacter } from '../../../src/core/character'

// ── Constants ──────────────────────────────────────────────────────────────
const R2_RTS     = 'https://assets.grudge-studio.com/models/characters/rts'
const LEVEL_BASE = 'https://raw.githubusercontent.com/CedricGuillemet/dump/master/CharController/'

// ── Loading UI ─────────────────────────────────────────────────────────────
const overlay = document.getElementById('loading-overlay')!
const bar     = document.getElementById('loading-bar')!
const status  = document.getElementById('loading-status')!

function setProgress(pct: number, msg: string) {
  bar.style.width    = `${pct}%`
  status.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 600)
}

// ── Engine ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
window.addEventListener('resize', () => engine.resize())

// ───────────────────────────────────────────────────────────────────────────
async function createScene(): Promise<Scene> {
// ───────────────────────────────────────────────────────────────────────────

  setProgress(5, 'Starting engine...')
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.12, 0.14, 0.18, 1)

  // Camera
  const camera = new FreeCamera('camera1', new Vector3(0, 5, -5), scene)
  camera.setTarget(Vector3.Zero())

  // Light
  const light     = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.7

  // Havok physics
  setProgress(15, 'Loading Havok physics...')
  const havok = await HavokPhysics()
  const hk    = new HavokPlugin(false, havok)
  scene.enablePhysics(new Vector3(0, -9.8, 0), hk)

  // Level
  setProgress(30, 'Loading level...')
  await SceneLoader.ImportMeshAsync('', LEVEL_BASE, 'levelTest.glb', scene)

  const lightmap    = new Texture(`${LEVEL_BASE}lightmap.jpg`, scene)
  const lightmapped = ['level_primitive0', 'level_primitive1', 'level_primitive2']
  lightmapped.forEach(name => {
    const mesh = scene.getMeshByName(name) as any
    if (!mesh) return
    new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0 }, scene)
    mesh.isPickable                                 = false
    mesh.material.lightmapTexture                  = lightmap
    mesh.material.useLightmapAsShadowmap           = true
    mesh.material.lightmapTexture.uAng             = Math.PI
    mesh.material.lightmapTexture.level            = 1.6
    mesh.material.lightmapTexture.coordinatesIndex = 1
    mesh.freezeWorldMatrix()
    mesh.doNotSyncBoundingInfo = true
  })

  const cubeNames = ['Cube', 'Cube.001', 'Cube.002', 'Cube.003', 'Cube.004', 'Cube.005']
  cubeNames.forEach(name => {
    const m = scene.getMeshByName(name)
    if (m) new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0.1 }, scene)
  })

  const planeMesh = scene.getMeshByName('Cube.006') as any
  if (planeMesh) planeMesh.scaling.set(0.03, 3, 1)
  const cube007   = scene.getMeshByName('Cube.007')
  if (cube007 && planeMesh) {
    const fixedMass = new PhysicsAggregate(cube007,   PhysicsShapeType.BOX, { mass: 0 },   scene)
    const plane     = new PhysicsAggregate(planeMesh, PhysicsShapeType.BOX, { mass: 0.1 }, scene)
    const joint     = new HingeConstraint(
      new Vector3(0.75, 0, 0),
      new Vector3(-0.25, 0, 0),
      new Vector3(0, 0, -1),
      new Vector3(0, 0, 1),
      scene,
    )
    fixedMass.body.addConstraint(plane.body, joint)
  }

  // ── Character controller ────────────────────────────────────────────────
  let   charState          = 'IN_AIR'
  const inAirSpeed         = 8.0
  const onGroundSpeed      = 10.0
  const jumpHeight         = 1.5
  let   wantJump           = false
  const inputDirection     = new Vector3(0, 0, 0)
  const forwardLocalSpace  = new Vector3(0, 0, 1)
  let   charOrientation    = Quaternion.Identity()
  const charGravity        = new Vector3(0, -18, 0)

  const capsH   = 1.8
  const capsR   = 0.6
  const spawnPos = new Vector3(3, 0.3, -8)

  const controller = new PhysicsCharacterController(
    spawnPos, { capsuleHeight: capsH, capsuleRadius: capsR }, scene,
  )
  camera.setTarget(spawnPos.clone())

  // ── Character visual ────────────────────────────────────────────────────
  setProgress(60, 'Loading character...')

  // Fallback capsule (shown only if the GLB fails)
  const fallback   = MeshBuilder.CreateCapsule('charFallback', { height: capsH, radius: capsR }, scene)
  fallback.isVisible = false

  let charRoot:    AbstractMesh | null   = null
  let animGroups:  AnimationGroup[]      = []
  let currentAnim: AnimationGroup | null = null
  let lastAnimKey  = ''

  try {
    const before = scene.animationGroups.length
    const result = await SceneLoader.ImportMeshAsync('', `${R2_RTS}/`, 'Knight_Male.glb', scene)
    charRoot     = result.meshes[0]
    autoNormalizeCharacter(charRoot)
    charRoot.position.copyFrom(spawnPos)
    animGroups   = scene.animationGroups.slice(before)
    animGroups.forEach(g => g.stop())
    if (animGroups.length > 0) {
      currentAnim = animGroups[0]
      currentAnim.start(true)
    }
  } catch {
    console.warn('[third-person] Knight GLB failed — using capsule fallback')
    fallback.isVisible = true
  }

  function switchAnim(key: string) {
    if (key === lastAnimKey || animGroups.length === 0) return
    lastAnimKey = key
    const order: Record<string, number> = { idle: 0, walk: 1, jump: 2 }
    const next =
      animGroups.find(g => g.name.toLowerCase().includes(key)) ??
      animGroups[Math.min(order[key] ?? 0, animGroups.length - 1)]
    if (next === currentAnim) return
    currentAnim?.stop()
    currentAnim = next
    next.start(true)
  }

  controller.onTriggerCollisionObservable.add((ev: any) => {
    console.log(`[char] collision: ${ev?.collider?.transformNode?.name ?? 'unknown'}`)
  })

  // ── State helpers ────────────────────────────────────────────────────────
  function getNextState(supportInfo: any): string {
    if (charState === 'IN_AIR') {
      return supportInfo.supportedState === CharacterSupportedState.SUPPORTED
        ? 'ON_GROUND' : 'IN_AIR'
    }
    if (charState === 'ON_GROUND') {
      if (supportInfo.supportedState !== CharacterSupportedState.SUPPORTED) return 'IN_AIR'
      if (wantJump) return 'START_JUMP'
      return 'ON_GROUND'
    }
    if (charState === 'START_JUMP') return 'IN_AIR'
    return charState
  }

  function getDesiredVelocity(
    dt: number, supportInfo: any, orientation: Quaternion, currentVelocity: Vector3,
  ): Vector3 {
    const next = getNextState(supportInfo)
    if (next !== charState) charState = next

    const upWorld      = charGravity.normalizeToNew().scaleInPlace(-1)
    const forwardWorld = forwardLocalSpace.applyRotationQuaternion(orientation)

    if (charState === 'IN_AIR') {
      const desired = inputDirection.scale(inAirSpeed).applyRotationQuaternion(orientation)
      const out     = controller.calculateMovement(
        dt, forwardWorld, upWorld, currentVelocity, Vector3.ZeroReadOnly, desired, upWorld,
      )
      out.addInPlace(upWorld.scale(-out.dot(upWorld)))
      out.addInPlace(upWorld.scale(currentVelocity.dot(upWorld)))
      out.addInPlace(charGravity.scale(dt))
      return out
    }

    if (charState === 'ON_GROUND') {
      const desired = inputDirection.scale(onGroundSpeed).applyRotationQuaternion(orientation)
      const out     = controller.calculateMovement(
        dt, forwardWorld, supportInfo.averageSurfaceNormal,
        currentVelocity, supportInfo.averageSurfaceVelocity, desired, upWorld,
      )
      out.subtractInPlace(supportInfo.averageSurfaceVelocity)
      if (out.dot(upWorld) > 1e-3) {
        const vLen = out.length()
        out.normalizeFromLength(vLen)
        const hLen = vLen / supportInfo.averageSurfaceNormal.dot(upWorld)
        const proj = supportInfo.averageSurfaceNormal.cross(out).cross(upWorld)
        proj.scaleInPlace(hLen)
        out.copyFrom(proj)
      }
      out.addInPlace(supportInfo.averageSurfaceVelocity)
      return out
    }

    if (charState === 'START_JUMP') {
      const u   = Math.sqrt(2 * charGravity.length() * jumpHeight)
      const rel = currentVelocity.dot(upWorld)
      return currentVelocity.add(upWorld.scale(u - rel))
    }

    return Vector3.Zero()
  }

  // ── Render tick ──────────────────────────────────────────────────────────
  let prevPos = spawnPos.clone()

  scene.onBeforeRenderObservable.add(() => {
    const pos    = controller.getPosition()
    const visual = charRoot ?? fallback

    visual.position.copyFrom(pos)

    // Rotate character to face movement
    if (charRoot) {
      const delta = pos.subtract(prevPos)
      if (delta.lengthSquared() > 0.0001) {
        charRoot.rotation.y = Math.atan2(delta.x, delta.z)
      }
      prevPos.copyFrom(pos)
    }

    // Anim state
    if (charState === 'IN_AIR' || charState === 'START_JUMP') switchAnim('jump')
    else if (inputDirection.lengthSquared() > 0)               switchAnim('walk')
    else                                                         switchAnim('idle')

    // Camera follow (verbatim from playground)
    const camDir = camera.getDirection(new Vector3(0, 0, 1))
    camDir.y = 0
    camDir.normalize()
    camera.setTarget(Vector3.Lerp(camera.getTarget(), pos, 0.1))
    const dist   = Vector3.Distance(camera.position, pos)
    const amount = (Math.min(dist - 6, 0) + Math.max(dist - 9, 0)) * 0.04
    camDir.scaleAndAddToRef(amount, camera.position)
    camera.position.y += (pos.y + 2 - camera.position.y) * 0.04
  })

  // ── Physics tick ─────────────────────────────────────────────────────────
  scene.onAfterPhysicsObservable.add(() => {
    const dt = (scene.deltaTime ?? 0) / 1000
    if (dt === 0) return
    const support = controller.checkSupport(dt, new Vector3(0, -1, 0))
    Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, charOrientation)
    const vel = getDesiredVelocity(dt, support, charOrientation, controller.getVelocity())
    controller.setVelocity(vel)
    controller.integrate(dt, support, charGravity)
  })

  // ── Mouse — orbit camera ─────────────────────────────────────────────────
  let mouseDown = false
  scene.onPointerObservable.add(info => {
    if (info.type === PointerEventTypes.POINTERDOWN) { mouseDown = true;  return }
    if (info.type === PointerEventTypes.POINTERUP)   { mouseDown = false; return }
    if (info.type === PointerEventTypes.POINTERMOVE && mouseDown) {
      const tgt = camera.getTarget().clone()
      camera.position.addInPlace(
        camera.getDirection(Vector3.Right()).scale((info.event as PointerEvent).movementX * -0.02),
      )
      camera.setTarget(tgt)
    }
  })

  // ── Keyboard — WASD + Space ──────────────────────────────────────────────
  scene.onKeyboardObservable.add(kb => {
    const down = kb.type === KeyboardEventTypes.KEYDOWN
    const k    = kb.event.key
    if (k === 'w' || k === 'ArrowUp')    inputDirection.z = down ? 1  : 0
    if (k === 's' || k === 'ArrowDown')  inputDirection.z = down ? -1 : 0
    if (k === 'a' || k === 'ArrowLeft')  inputDirection.x = down ? -1 : 0
    if (k === 'd' || k === 'ArrowRight') inputDirection.x = down ? 1  : 0
    if (k === ' ') wantJump = down
  })

  setProgress(100, 'Ready')
  hideOverlay()
  return scene
}

// Init
createScene().then(scene => engine.runRenderLoop(() => scene.render()))
