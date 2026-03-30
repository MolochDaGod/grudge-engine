/**
 * Third-Person Camera — Grudge Engine
 *
 * Havok PhysicsCharacterController with:
 *  - Capsule-based character physics (real collisions, no manual gravity)
 *  - Static ground + dynamic pushable boxes via PhysicsAggregate
 *  - Over-shoulder FreeCamera (Fortnite style: W = away from camera)
 *  - R2 character model loaded and synced to physics capsule
 *
 * ES6 conversion of the BJS character controller playground.
 *
 * Key side-effect imports:
 *  @babylonjs/loaders/glTF              → GLTF loader registration
 *  @babylonjs/core/Physics/v2/physicsEngineComponent → scene.enablePhysics()
 *  @babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent → shadows
 */

// ── Side-effect imports ─────────────────────────────────────────────────────
import '@babylonjs/loaders/glTF'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

// ── Havok WASM ──────────────────────────────────────────────────────────────
import HavokPhysics          from '@babylonjs/havok'
import { HavokPlugin }       from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'

// ── Core ────────────────────────────────────────────────────────────────────
import { Engine }             from '@babylonjs/core/Engines/engine'
import { Scene }              from '@babylonjs/core/scene'
import { FreeCamera }         from '@babylonjs/core/Cameras/freeCamera'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }   from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }    from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { Quaternion }         from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }     from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }   from '@babylonjs/core/Materials/standardMaterial'
import { Texture }            from '@babylonjs/core/Materials/Textures/texture'
import { SceneLoader }        from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh }       from '@babylonjs/core/Meshes/abstractMesh'
import { PointerEventTypes }  from '@babylonjs/core/Events/pointerEvents'
import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents'

// ── Physics V2 ──────────────────────────────────────────────────────────────
import { PhysicsAggregate }            from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType }            from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { PhysicsCharacterController }  from '@babylonjs/core/Physics/v2/characterController'

// ── Grudge asset helpers ────────────────────────────────────────────────────
import { Assets }  from '../../../src/grudge/assets'

// ── Constants ───────────────────────────────────────────────────────────────
const CAPSULE_HEIGHT = 1.8
const CAPSULE_RADIUS = 0.6
const MOVE_SPEED     = 4
const JUMP_VELOCITY  = 5
const GRAVITY_Y      = -0.5

const R2_CHARS = 'https://assets.grudge-studio.com/models/characters/rts'

// ── Main (async for Havok init) ─────────────────────────────────────────────
async function main() {
  const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
  window.addEventListener('resize', () => engine.resize())

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.05, 0.07, 0.12, 1)

  // ── Havok physics ───────────────────────────────────────────────────────
  const havok  = await HavokPhysics()
  const hk     = new HavokPlugin(false, havok)
  scene.enablePhysics(new Vector3(0, -9.8, 0), hk)

  // ── Camera (FreeCamera — we control position manually for 3rd-person) ──
  const camera = new FreeCamera('cam', new Vector3(0, 5, -5), scene)
  camera.attachControl(canvas, true)
  camera.minZ = 0.1

  // ── Lighting ──────────────────────────────────────────────────────────
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.5

  const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
  sun.position  = new Vector3(20, 40, 20)
  sun.intensity = 1.2

  const shadows = new ShadowGenerator(1024, sun)
  shadows.useBlurExponentialShadowMap = true
  shadows.blurKernel = 16

  // ── Ground (static physics) ────────────────────────────────────────────
  const ground = MeshBuilder.CreateGround('ground', { width: 80, height: 80, subdivisions: 4 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.18, 0.22, 0.14)

  try {
    const tex = new Texture(Assets.texture('terrain/grass_diffuse.jpg'), scene)
    tex.uScale = 12; tex.vScale = 12
    groundMat.diffuseTexture = tex
  } catch { /* solid color fallback */ }

  ground.material = groundMat
  ground.receiveShadows = true
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

  // ── Environment boxes (dynamic — character can push them) ──────────────
  const boxMat = new StandardMaterial('boxMat', scene)
  boxMat.diffuseColor = new Color3(0.3, 0.3, 0.35)

  function addBox(x: number, z: number, h = 1.5) {
    const box = MeshBuilder.CreateBox(`box_${x}_${z}`, { width: 1.5, height: h, depth: 1.5 }, scene)
    box.position.set(x, h / 2, z)
    box.material = boxMat
    box.receiveShadows = true
    shadows.addShadowCaster(box)
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0.1 }, scene)
  }
  addBox(5, 5); addBox(-6, 3); addBox(8, -7, 2.5); addBox(-4, -8); addBox(0, 10, 3)

  // ── Ramp (static) ──────────────────────────────────────────────────────
  const ramp = MeshBuilder.CreateBox('ramp', { width: 4, height: 0.2, depth: 2 }, scene)
  ramp.position.set(-10, 0.5, 0)
  ramp.rotation.z = -0.3
  ramp.material = boxMat
  ramp.receiveShadows = true
  new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0 }, scene)

  // ── Character capsule (visual only — physics is on the CharacterController) ─
  const displayCapsule = MeshBuilder.CreateCapsule('charDisplay', {
    height: CAPSULE_HEIGHT,
    radius: CAPSULE_RADIUS,
  }, scene)
  const capsuleMat = new StandardMaterial('capsuleMat', scene)
  capsuleMat.diffuseColor = new Color3(0.78, 0.66, 0.3)
  capsuleMat.alpha = 0.3
  displayCapsule.material = capsuleMat

  // ── Havok PhysicsCharacterController ───────────────────────────────────
  const startPos = new Vector3(3, 0.3, -8)
  const characterController = new PhysicsCharacterController(startPos, {
    capsuleHeight: CAPSULE_HEIGHT,
    capsuleRadius: CAPSULE_RADIUS,
  }, scene)

  camera.setTarget(startPos)

  // ── Load R2 character model ────────────────────────────────────────────
  let charMesh: AbstractMesh | null = null
  try {
    const result = await SceneLoader.ImportMeshAsync('', `${R2_CHARS}/`, 'Knight_Male.glb', scene)
    charMesh = result.meshes[0]
    charMesh.scaling.setAll(1)
    displayCapsule.isVisible = false
    result.meshes.forEach(m => { shadows.addShadowCaster(m); m.receiveShadows = true })
    if (result.animationGroups.length > 0) result.animationGroups[0].start(true)
  } catch (e) {
    console.warn('Character load failed (CORS?), using capsule:', e)
    capsuleMat.alpha = 1
  }

  // ── Input state ────────────────────────────────────────────────────────
  const inputDirection      = new Vector3(0, GRAVITY_Y, 0)
  const characterOrientation = Quaternion.Identity()

  scene.onKeyboardObservable.add((kbInfo) => {
    switch (kbInfo.type) {
      case KeyboardEventTypes.KEYDOWN:
        if (kbInfo.event.key === 'w' || kbInfo.event.key === 'ArrowUp')    inputDirection.z =  1
        if (kbInfo.event.key === 's' || kbInfo.event.key === 'ArrowDown')  inputDirection.z = -1
        if (kbInfo.event.key === 'a' || kbInfo.event.key === 'ArrowLeft')  inputDirection.x = -1
        if (kbInfo.event.key === 'd' || kbInfo.event.key === 'ArrowRight') inputDirection.x =  1
        if (kbInfo.event.key === ' ')                                       inputDirection.y = JUMP_VELOCITY
        break
      case KeyboardEventTypes.KEYUP:
        if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(kbInfo.event.key))    inputDirection.z = 0
        if (['a', 'd', 'ArrowLeft', 'ArrowRight'].includes(kbInfo.event.key)) inputDirection.x = 0
        if (kbInfo.event.key === ' ')                                           inputDirection.y = GRAVITY_Y
        break
    }
  })

  // ── Mouse drag → rotate camera around character ────────────────────────
  let isMouseDown = false
  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        isMouseDown = true
        break
      case PointerEventTypes.POINTERUP:
        isMouseDown = false
        break
      case PointerEventTypes.POINTERMOVE:
        if (isMouseDown && pointerInfo.event) {
          const tgt = camera.getTarget().clone()
          const right = camera.getDirection(Vector3.Right())
          camera.position.addInPlace(right.scale((pointerInfo.event as PointerEvent).movementX * -0.02))
          camera.setTarget(tgt)
        }
        break
    }
  })

  // ── Before render: sync visuals to physics, follow camera ──────────────
  scene.onBeforeRenderObservable.add(() => {
    const charPos = characterController.getPosition()
    displayCapsule.position.copyFrom(charPos)

    // Sync loaded character mesh
    if (charMesh) {
      charMesh.position.set(charPos.x, charPos.y - (CAPSULE_HEIGHT / 2), charPos.z)

      // Face movement direction
      if (Math.abs(inputDirection.x) > 0.01 || Math.abs(inputDirection.z) > 0.01) {
        const camDir   = camera.getDirection(new Vector3(0, 0, 1))
        camDir.y = 0; camDir.normalize()
        const camRight = Vector3.Cross(Vector3.Up(), camDir).normalize()
        const moveDir  = camDir.scale(inputDirection.z).add(camRight.scale(inputDirection.x))
        if (moveDir.lengthSquared() > 0.001) {
          charMesh.rotation.y = Math.atan2(moveDir.x, moveDir.z)
        }
      }
    }

    // Camera follow
    const camForward = camera.getDirection(new Vector3(0, 0, 1))
    camForward.y = 0; camForward.normalize()

    camera.setTarget(Vector3.Lerp(camera.getTarget(), charPos, 0.1))

    const dist   = Vector3.Distance(camera.position, charPos)
    const amount = (Math.min(dist - 6, 0) + Math.max(dist - 9, 0)) * 0.04
    camForward.scaleAndAddToRef(amount, camera.position)
    camera.position.y += (charPos.y + 2 - camera.position.y) * 0.04
  })

  // ── After physics: apply displacement via character controller ──────────
  scene.onAfterPhysicsObservable.add(() => {
    if (scene.deltaTime === undefined) return
    const dt = scene.deltaTime / 1000
    if (dt === 0) return

    Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, characterOrientation)
    const displacement = inputDirection.scale(dt * MOVE_SPEED).applyRotationQuaternion(characterOrientation)
    characterController.moveWithCollisions(displacement)
  })

  // ── Render loop ─────────────────────────────────────────────────────────
  engine.runRenderLoop(() => scene.render())
}

main().catch(console.error)
