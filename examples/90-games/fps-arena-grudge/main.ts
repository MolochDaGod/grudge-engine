/**
 * FPS Arena — Grudge Engine
 *
 * Multiplayer-ready FPS with:
 *  - 6 selectable race characters (ModularCharacter)
 *  - 42 retargeted animations (AnimationLibrary)
 *  - Havok PhysicsCharacterController for movement + collision
 *  - Equipment bone-attachment system
 *  - FreeCamera with pointer lock for FPS view
 *  - Raycast shooting with hit detection
 */

// ── Side-effect imports ─────────────────────────────────────────────────────
import '@babylonjs/loaders/glTF'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

// ── Havok ───────────────────────────────────────────────────────────────────
import HavokPhysics     from '@babylonjs/havok'
import { HavokPlugin }  from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'

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
import { PointerEventTypes }  from '@babylonjs/core/Events/pointerEvents'
import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents'

// ── Physics V2 ──────────────────────────────────────────────────────────────
import { PhysicsAggregate }            from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType }            from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { PhysicsCharacterController }  from '@babylonjs/core/Physics/v2/characterController'

// ── Grudge core ─────────────────────────────────────────────────────────────
import { ModularCharacter, type RaceId, RACE_DEFS } from '../../../src/core/ModularCharacter'
import { AnimationLibrary }                          from '../../../src/core/AnimationLibrary'

// ── Constants ───────────────────────────────────────────────────────────────
const CAPSULE_H     = 1.8
const CAPSULE_R     = 0.4
const MOVE_SPEED    = 5
const JUMP_VEL      = 6
const GRAVITY_Y     = -0.5
const MODELS_BASE   = '/models/races/'
const ANIMS_BASE    = '/models/races/animations/'
const EQUIP_BASE    = '/models/races/equipment/'

// ── UI refs ─────────────────────────────────────────────────────────────────
const raceSelect = document.getElementById('race-select')!
const raceLabel  = document.getElementById('race-label')!
const animLabel  = document.getElementById('anim-label')!
const hpFill     = document.getElementById('hp-fill')!

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
  window.addEventListener('resize', () => engine.resize())

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.05, 0.07, 0.12, 1)

  // ── Havok physics ─────────────────────────────────────────────────────
  const havok = await HavokPhysics()
  const hk    = new HavokPlugin(false, havok)
  scene.enablePhysics(new Vector3(0, -9.8, 0), hk)

  // ── Camera (FPS — pointer lock) ────────────────────────────────────────
  const camera = new FreeCamera('cam', new Vector3(0, 5, -8), scene)
  camera.attachControl(canvas, true)
  camera.speed    = 0
  camera.keysUp   = [87]  // W
  camera.keysDown = [83]  // S
  camera.keysLeft = [65]  // A
  camera.keysRight = [68] // D
  camera.minZ = 0.1

  // Pointer lock on click
  canvas.addEventListener('click', () => canvas.requestPointerLock?.())

  // ── Lighting ──────────────────────────────────────────────────────────
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.5

  const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
  sun.position  = new Vector3(20, 40, 20)
  sun.intensity = 1.2

  const shadows = new ShadowGenerator(1024, sun)
  shadows.useBlurExponentialShadowMap = true

  // ── Ground ────────────────────────────────────────────────────────────
  const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100, subdivisions: 4 }, scene)
  const gMat = new StandardMaterial('gMat', scene)
  gMat.diffuseColor = new Color3(0.18, 0.22, 0.14)
  try {
    const tex = new Texture('/textures/terrain/grass_diffuse.jpg', scene)
    tex.uScale = 12; tex.vScale = 12
    gMat.diffuseTexture = tex
  } catch { /* solid fallback */ }
  ground.material = gMat
  ground.receiveShadows = true
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

  // ── Environment boxes ─────────────────────────────────────────────────
  const boxMat = new StandardMaterial('boxMat', scene)
  boxMat.diffuseColor = new Color3(0.3, 0.3, 0.35)
  const boxPositions = [[5,5],[-6,3],[8,-7],[-4,-8],[0,12],[15,0],[-12,-5],[10,-15]]
  for (const [x, z] of boxPositions) {
    const h = 1.5 + Math.random() * 2
    const box = MeshBuilder.CreateBox(`box_${x}_${z}`, { width: 2, height: h, depth: 2 }, scene)
    box.position.set(x, h / 2, z)
    box.material = boxMat
    box.receiveShadows = true
    shadows.addShadowCaster(box)
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene)
  }

  // ── Physics character controller ──────────────────────────────────────
  const startPos = new Vector3(0, 1, -8)
  const charCtrl = new PhysicsCharacterController(startPos, {
    capsuleHeight: CAPSULE_H,
    capsuleRadius: CAPSULE_R,
  }, scene)

  camera.position.copyFrom(startPos)
  camera.position.y += CAPSULE_H / 2

  // ── Animation library (load eagerly, retarget on character load) ──────
  const animLib = new AnimationLibrary(scene)
  // Load a small set of essential anims first for responsiveness
  const essentialAnims = ['idle', 'walk', 'run', 'sword_attack_1', 'battlecry', 'kick']
  for (const key of essentialAnims) {
    await animLib.loadOne(key, ANIMS_BASE).catch(() => {})
  }

  // ── Character state ───────────────────────────────────────────────────
  let character: ModularCharacter | null = null
  let hitPoints = 100

  function updateHP(hp: number) {
    hitPoints = Math.max(0, Math.min(100, hp))
    hpFill.style.width = hitPoints + '%'
  }

  // ── Race selection handler ────────────────────────────────────────────
  async function selectRace(raceId: RaceId) {
    raceSelect.classList.add('hidden')
    raceLabel.textContent = RACE_DEFS[raceId].name

    // Dispose previous character
    character?.dispose()

    // Load new character
    character = new ModularCharacter(scene, raceId)
    try {
      await character.load(MODELS_BASE)
    } catch (e) {
      console.error('Character load failed:', e)
      raceLabel.textContent = `${RACE_DEFS[raceId].name} (load failed — check CORS)`
      camera.speed = 0.6
      engine.runRenderLoop(() => scene.render())
      return
    }

    // Add shadows
    for (const m of character.meshes) {
      shadows.addShadowCaster(m, true)
      m.receiveShadows = true
    }

    // Equip a default weapon (sword to mainHand)
    try {
      await character.equip('mainHand', EQUIP_BASE + 'spear.glb')
    } catch { /* equipment load failed, continue without */ }

    // Retarget animations to this character's skeleton
    if (character.skeleton) {
      animLib.retargetTo(character.skeleton)
      animLib.play('idle', true)
      animLabel.textContent = 'idle'
    }

    // Enable camera movement
    camera.speed = 0.6
    updateHP(100)

    // Load remaining animations in background
    animLib.loadAll(ANIMS_BASE).then(() => {
      if (character?.skeleton) animLib.retargetTo(character.skeleton)
    }).catch(() => {})
  }

  // Wire up race buttons
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.race-btn')) {
    btn.addEventListener('click', () => selectRace(btn.dataset.race as RaceId))
  }

  // ── Input state ───────────────────────────────────────────────────────
  const inputDir = new Vector3(0, GRAVITY_Y, 0)
  const charQuat = Quaternion.Identity()

  scene.onKeyboardObservable.add((kbInfo) => {
    const down = kbInfo.type === KeyboardEventTypes.KEYDOWN
    const key  = kbInfo.event.key.toLowerCase()

    // Movement
    if (key === 'w' || key === 'arrowup')    inputDir.z = down ? 1 : 0
    if (key === 's' || key === 'arrowdown')  inputDir.z = down ? -1 : 0
    if (key === 'a' || key === 'arrowleft')  inputDir.x = down ? -1 : 0
    if (key === 'd' || key === 'arrowright') inputDir.x = down ? 1 : 0
    if (key === ' ' && down)                 inputDir.y = JUMP_VEL
    if (key === ' ' && !down)                inputDir.y = GRAVITY_Y

    // Animation hotkeys (on keydown only)
    if (!down) return

    if (key === '1') { animLib.play('sword_attack_1'); animLabel.textContent = 'sword_attack_1' }
    if (key === '2') { animLib.play('kick'); animLabel.textContent = 'kick' }
    if (key === '3') { animLib.play('spell_cast'); animLabel.textContent = 'spell_cast' }
    if (key === '4') { animLib.play('greatsword_slash_1'); animLabel.textContent = 'greatsword_slash_1' }
    if (key === '5') { animLib.play('dual_weapon_combo'); animLabel.textContent = 'dual_weapon_combo' }
    if (key === 'b') { animLib.play('battlecry'); animLabel.textContent = 'battlecry' }
    if (key === 'tab') {
      kbInfo.event.preventDefault()
      animLib.play('dance_bboy', true)
      animLabel.textContent = 'dance_bboy'
    }
  })

  // ── Mouse click → raycast attack ──────────────────────────────────────
  scene.onPointerObservable.add((pi) => {
    if (pi.type !== PointerEventTypes.POINTERDOWN) return
    if (!character) return

    // Play attack animation
    animLib.play('sword_attack_1')
    animLabel.textContent = 'sword_attack_1'

    // Raycast from camera center
    const ray = scene.createPickingRay(
      engine.getRenderWidth() / 2,
      engine.getRenderHeight() / 2,
      null,
      camera,
    )
    const hit = scene.pickWithRay(ray)
    if (hit?.pickedMesh && hit.pickedPoint) {
      // Visual impact marker
      const impact = MeshBuilder.CreateSphere('impact', { diameter: 0.3 }, scene)
      impact.position.copyFrom(hit.pickedPoint)
      const impMat = new StandardMaterial('impMat', scene)
      impMat.emissiveColor = new Color3(1, 0.3, 0)
      impMat.alpha = 0.8
      impact.material = impMat
      setTimeout(() => impact.dispose(), 500)
    }
  })

  // ── Before render: sync character to physics, camera follow ───────────
  scene.onBeforeRenderObservable.add(() => {
    const pos = charCtrl.getPosition()

    // Sync character model position
    if (character?.root) {
      character.root.position.set(pos.x, pos.y - CAPSULE_H / 2, pos.z)

      // Face camera direction
      character.root.rotation.y = camera.rotation.y + Math.PI
    }

    // Camera tracks character head height
    camera.position.set(pos.x, pos.y + CAPSULE_H * 0.4, pos.z)

    // Auto-return to idle after one-shot animations
    const playing = animLib.currentKey
    if (playing && playing !== 'idle' && playing !== 'walk' && playing !== 'run') {
      const group = animLib.get(playing)
      if (group && !group.isPlaying) {
        animLib.play('idle', true)
        animLabel.textContent = 'idle'
      }
    }

    // Walk/run animation based on movement
    const moving = Math.abs(inputDir.x) > 0.01 || Math.abs(inputDir.z) > 0.01
    if (moving && animLib.currentKey === 'idle') {
      animLib.play('walk', true)
      animLabel.textContent = 'walk'
    } else if (!moving && animLib.currentKey === 'walk') {
      animLib.play('idle', true)
      animLabel.textContent = 'idle'
    }
  })

  // ── After physics: apply displacement ─────────────────────────────────
  scene.onAfterPhysicsObservable.add(() => {
    if (scene.deltaTime === undefined) return
    const dt = scene.deltaTime / 1000
    if (dt === 0) return

    Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, charQuat)
    const displacement = inputDir.scale(dt * MOVE_SPEED).applyRotationQuaternion(charQuat)
    charCtrl.moveWithCollisions(displacement)
  })

  // ── Render loop (start even before race is selected — shows the level) ─
  engine.runRenderLoop(() => scene.render())
}

main().catch(console.error)
