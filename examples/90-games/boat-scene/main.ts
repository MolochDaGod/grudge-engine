/**
 * Boat Scene — Grudge Engine
 *
 * Port of the Babylon.js playground boat/car scene.
 * Original character (Dude.babylon) replaced with Corsair King
 * loaded from Grudge R2 object storage, with retargeted Mixamo animations.
 *
 * Scene contains:
 *  - Procedural boat path (Lissajous curve)
 *  - Ship model from GitHub following the path
 *  - Corsair King FBX character riding the ship (walking anim while moving)
 *  - Animated shark swimming nearby
 *  - Exploding barrel prop
 *  - WaterMaterial ocean with skybox reflection
 *  - Particle engine exhaust
 */

import '@babylonjs/loaders/glTF'
import '@babylonjs/loaders/OBJ'
// FBX loader is part of @babylonjs/loaders
import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { Vector3, Vector2 }  from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }    from '@babylonjs/core/Maths/math.color'
import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }  from '@babylonjs/core/Materials/standardMaterial'
import { Texture }           from '@babylonjs/core/Materials/Textures/texture'
import { CubeTexture }       from '@babylonjs/core/Materials/Textures/cubeTexture'
import { Mesh }              from '@babylonjs/core/Meshes/mesh'
import { Path3D }            from '@babylonjs/core/Maths/math.path'
import { Axis, Space }       from '@babylonjs/core/Maths/math.axis'
import { Animation }         from '@babylonjs/core/Animations/animation'
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing'
import { SceneLoader }       from '@babylonjs/core/Loading/sceneLoader'
import { ParticleHelper }    from '@babylonjs/core/Particles/particleHelper'
import { AnimationGroup }    from '@babylonjs/core/Animations/animationGroup'
import { Skeleton }          from '@babylonjs/core/Bones/skeleton'
import { AbstractMesh }      from '@babylonjs/core/Meshes/abstractMesh'
import { TransformNode }     from '@babylonjs/core/Meshes/transformNode'

import { WaterMaterial }     from '@babylonjs/materials/water/waterMaterial'

const R2_CHAR  = 'https://assets.grudge-studio.com/models/characters/corsair-king'
const R2_SHIP  = 'https://raw.githubusercontent.com/eldinor/ForBJS/master/ship/'
const BJS_MODELS = 'https://models.babylonjs.com/'

// ── Loading UI ────────────────────────────────────────────────────────────
const overlay   = document.getElementById('loading-overlay')!
const loadBar   = document.getElementById('loading-bar')!
const loadStatus = document.getElementById('loading-status')!

let loadStep = 0
const TOTAL_STEPS = 4

function advanceLoad(msg: string) {
  loadStep++
  loadBar.style.width = `${Math.round((loadStep / TOTAL_STEPS) * 100)}%`
  loadStatus.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)
}

// ── Engine + Scene ────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
const scene  = new Scene(engine)
window.addEventListener('resize', () => engine.resize())

// ── Camera with spinTo helper ─────────────────────────────────────────────
const camera = new ArcRotateCamera('camera1', 0, 40 * Math.PI / 180, 20, Vector3.Zero(), scene)
camera.setPosition(new Vector3(-12, 25, -44))
camera.attachControl(canvas, true)

function spinTo(cam: ArcRotateCamera, prop: 'radius' | 'alpha' | 'beta', target: number, speed: number) {
  const ease = new CubicEase()
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT)
  Animation.CreateAndStartAnimation(`spin_${prop}`, cam, prop, speed, 120, (cam as any)[prop], target, 0, ease)
}

// ── Lights ─────────────────────────────────────────────────────────────────
const light = new HemisphericLight('light1', new Vector3(1, 0.5, 0), scene)
light.intensity = 1.0

// ── Skybox ─────────────────────────────────────────────────────────────────
const skybox = MeshBuilder.CreateBox('skyBox', { size: 5000 }, scene)
const skyMat = new StandardMaterial('skyBox', scene)
skyMat.backFaceCulling = false
skyMat.reflectionTexture = new CubeTexture('https://assets.babylonjs.com/textures/TropicalSunnyDay', scene)
skyMat.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE
skyMat.diffuseColor  = new Color3(0, 0, 0)
skyMat.specularColor = new Color3(0, 0, 0)
skyMat.disableLighting = true
skybox.material = skyMat

// ── Water ──────────────────────────────────────────────────────────────────
const waterMesh = MeshBuilder.CreateGround('waterMesh', { width: 2048, height: 2048, subdivisions: 16 }, scene)
waterMesh.position.y = -1.34
const water = new WaterMaterial('water', scene, new Vector2(512, 512) as any)
water.backFaceCulling = true
water.bumpTexture    = new Texture('https://assets.babylonjs.com/textures/waterbump.png', scene)
water.windForce      = -10
water.waveHeight     = 0.7
water.bumpHeight     = 0.2
water.windDirection  = new Vector2(1, 1)
water.waterColor     = new Color3(0, 0, 221 / 255)
water.colorBlendFactor = 0.0
water.addToRenderList(skybox)
waterMesh.material   = water

// ── Car Body (invisible, drives the path) ─────────────────────────────────
const bodyMat = new StandardMaterial('body_mat', scene)
bodyMat.diffuseColor  = new Color3(1.0, 0.25, 0.25)
bodyMat.backFaceCulling = false

const side = [
  new Vector3(-4, 2, -2), new Vector3(4, 2, -2),
  new Vector3(5, -2, -2), new Vector3(-7, -2, -2),
]
side.push(side[0])
const extrudePath = [new Vector3(0, 0, 0), new Vector3(0, 0, 4)]
const carBody = MeshBuilder.ExtrudeShape('body', { shape: side, path: extrudePath, cap: Mesh.CAP_ALL }, scene)
carBody.material  = bodyMat
carBody.isVisible = false

// Wheels (invisible — just drive the animation)
const wheelMat = new StandardMaterial('wheel_mat', scene)
const faceColors: Color3[] = []
faceColors[1] = new Color3(0, 0, 0)
const wheelFI = MeshBuilder.CreateCylinder('wheelFI', { diameter: 3, height: 1, tessellation: 24 }, scene)
wheelFI.material = wheelMat
wheelFI.rotate(Axis.X, Math.PI / 2, Space.WORLD)
wheelFI.parent = carBody
wheelFI.isVisible = false
const wheelFO = wheelFI.createInstance('FO'); wheelFO.parent = carBody; wheelFO.position = new Vector3(-4.5,-2, 2.8); wheelFO.isVisible = false
const wheelRI = wheelFI.createInstance('RI'); wheelRI.parent = carBody; wheelRI.position = new Vector3( 2.5,-2,-2.8); wheelRI.isVisible = false
const wheelRO = wheelFI.createInstance('RO'); wheelRO.parent = carBody; wheelRO.position = new Vector3( 2.5,-2, 2.8); wheelRO.isVisible = false
wheelFI.position = new Vector3(-4.5, -2, -2.8)

// ── Path ──────────────────────────────────────────────────────────────────
const n = 850, r = 70
const points: Vector3[] = []
for (let i = 0; i <= n; i++) {
  points.push(new Vector3(
    (r + (r/5) * Math.sin(8 * i * Math.PI / n)) * Math.sin(2 * i * Math.PI / n),
    0,
    (r + (r/10) * Math.sin(6 * i * Math.PI / n)) * Math.cos(1.5 * i * Math.PI / n),
  ))
}
const track = MeshBuilder.CreateLines('track', { points }, scene)
track.color      = new Color3(0, 0, 0)
track.isVisible  = false

const path3d  = new Path3D(points)
const normals = path3d.getNormals()
const theta0  = Math.acos(Vector3.Dot(Axis.Z, normals[0]))

carBody.position.y = 4
carBody.position.z = r
carBody.rotate(Axis.Y, theta0, Space.WORLD)
const startRotation = carBody.rotationQuaternion!.clone()

camera.setTarget(carBody)

// ── Animation state ───────────────────────────────────────────────────────
let pathIndex  = 0
const pathMax  = 200
let camSwitched = false

// ── Corsair King character state ──────────────────────────────────────────
let corsairRoot:    AbstractMesh | null = null
let corsairSkeleton: Skeleton  | null  = null
let idleAnim:  AnimationGroup | null = null
let walkAnim:  AnimationGroup | null = null
let currentAnim: AnimationGroup | null = null

function playAnim(group: AnimationGroup | null, loop = true) {
  if (!group || group === currentAnim) return
  currentAnim?.stop()
  currentAnim = group
  group.start(loop)
}

/**
 * Retarget an AnimationGroup from one skeleton to another by matching bone names.
 * Used to apply Mixamo animation FBXs to the main textured character.
 */
function retargetAnimGroup(
  source: AnimationGroup,
  targetSkeleton: Skeleton,
  name: string,
): AnimationGroup {
  const retargeted = new AnimationGroup(name, scene)
  for (const ta of source.targetedAnimations) {
    const sourceBone = ta.target as any
    const boneName   = sourceBone?.name ?? sourceBone?.id
    if (!boneName) continue
    const targetBone = targetSkeleton.bones.find(b => b.name === boneName)
    if (targetBone) retargeted.addTargetedAnimation(ta.animation, targetBone)
  }
  return retargeted
}

// ── Load everything ───────────────────────────────────────────────────────
async function loadAll() {

  // 1. Ship model (GitHub)
  advanceLoad('Loading ship model…')
  try {
    const ship = await SceneLoader.ImportMeshAsync('', R2_SHIP, 'scene.gltf', scene)
    ship.meshes[0].scaling    = new Vector3(0.1, 0.1, 0.1)
    ship.meshes[0].position.y += 9
    ship.meshes[0].parent     = carBody

    // Engine particle fx
    const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 1, segments: 32 }, scene)
    sphere.isVisible = false
    sphere.position  = new Vector3(7, -1, 5)
    sphere.parent    = carBody
    try {
      const sys = await ParticleHelper.CreateFromSnippetAsync('7VWTHG#4', scene, false) as any
      sys.emitter = sphere
      const spClone  = sphere.clone('spClone')
      spClone.position  = new Vector3(7, -1, -5)
      spClone.parent    = carBody
      const sysClone = sys.clone()
      sysClone.emitter  = spClone
    } catch { /* particle snippet optional */ }
  } catch (e) { console.warn('Ship load failed:', e) }

  // 2. Shark
  advanceLoad('Loading shark…')
  try {
    const cylinder = MeshBuilder.CreateCylinder('cylinder', { height: 2, diameter: 1 }, scene)
    cylinder.position  = new Vector3(4, 0, 9)
    cylinder.isVisible = false

    const shark = await SceneLoader.ImportMeshAsync('', BJS_MODELS, 'shark.glb', scene)
    shark.meshes[0].position = cylinder.position
    shark.meshes[0].rotate(new Vector3(1, 0, -1), -Math.PI / 2, Space.WORLD)
    if (scene.animationGroups[1]) {
      scene.animationGroups[1].start(true)
    }
  } catch (e) { console.warn('Shark load failed:', e) }

  // 3. Exploding barrel
  advanceLoad('Loading barrel…')
  try {
    const barrel = await SceneLoader.ImportMeshAsync('', BJS_MODELS, 'ExplodingBarrel.glb', scene)
    barrel.meshes[0].position = new Vector3(14, 0.5, 2)
    barrel.meshes[0].scaling  = new Vector3(0.1, 0.1, 0.1)
    barrel.meshes[0].rotate(new Vector3(1, 0, -1), -Math.PI, Space.WORLD)
  } catch (e) { console.warn('Barrel load failed:', e) }

  // 4. Corsair King character + Mixamo animations
  advanceLoad('Loading Corsair King…')
  try {
    // Load main character (has embedded textures from Meshy AI)
    const charResult = await SceneLoader.ImportMeshAsync('', `${R2_CHAR}/`, 'character.fbx', scene)
    corsairRoot     = charResult.meshes[0]
    corsairSkeleton = charResult.skeletons[0] ?? null

    // Scale and position on the boat (same position as original Dude)
    corsairRoot.scaling   = new Vector3(0.03, 0.03, 0.03)
    corsairRoot.position  = carBody.position.clone()
    corsairRoot.position.y = 5.2

    // Load walking animation FBX
    try {
      const walkResult = await SceneLoader.ImportMeshAsync('', `${R2_CHAR}/`, 'walking.fbx', scene)
      // Find the newly-added animation group (last one)
      const rawWalk = scene.animationGroups[scene.animationGroups.length - 1]
      // Hide duplicate meshes from animation FBX
      walkResult.meshes.forEach(m => { if (m !== corsairRoot) m.dispose() })

      if (corsairSkeleton && rawWalk) {
        walkAnim = retargetAnimGroup(rawWalk, corsairSkeleton, 'walk')
        rawWalk.stop()
      } else if (rawWalk) {
        walkAnim = rawWalk
      }
    } catch (e) { console.warn('Walk anim load failed:', e) }

    // Load idle animation FBX
    try {
      const idleResult = await SceneLoader.ImportMeshAsync('', `${R2_CHAR}/`, 'idle.fbx', scene)
      const rawIdle = scene.animationGroups[scene.animationGroups.length - 1]
      idleResult.meshes.forEach(m => { if (m !== corsairRoot) m.dispose() })

      if (corsairSkeleton && rawIdle) {
        idleAnim = retargetAnimGroup(rawIdle, corsairSkeleton, 'idle')
        rawIdle.stop()
      } else if (rawIdle) {
        idleAnim = rawIdle
      }
    } catch (e) { console.warn('Idle anim load failed:', e) }

    // Start with walk animation (character is moving on the boat)
    playAnim(walkAnim ?? idleAnim)

  } catch (e) { console.warn('Corsair King load failed:', e) }

  hideOverlay()
  startLoop()
}

// ── Main render loop ──────────────────────────────────────────────────────
function startLoop() {
  scene.registerAfterRender(() => {

    // Update path index
    if (pathIndex <= pathMax - 1 && pathIndex <= n - 1) {

      // Move car along path
      carBody.position.x = points[pathIndex].x
      carBody.position.z = points[pathIndex].z

      // Wheel spin
      const norm = normals[pathIndex]
      wheelFI.rotate(norm, Math.PI / 32, Space.WORLD)
      wheelFO.rotate(norm, Math.PI / 32, Space.WORLD)
      wheelRI.rotate(norm, Math.PI / 32, Space.WORLD)
      wheelRO.rotate(norm, Math.PI / 32, Space.WORLD)

      // Steer car body
      const theta = Math.acos(
        Math.min(1, Math.max(-1, Vector3.Dot(normals[pathIndex], normals[pathIndex + 1])))
      )
      const cross = Vector3.Cross(normals[pathIndex], normals[pathIndex + 1])
      const dir   = cross.y === 0 ? 1 : cross.y / Math.abs(cross.y)
      carBody.rotate(Axis.Y, dir * theta, Space.WORLD)

      // Corsair King follows the boat
      if (corsairRoot) {
        corsairRoot.position    = carBody.position.clone()
        corsairRoot.position.y  = 5.2
        corsairRoot.rotation.y += 0.01   // slow spin on deck
      }

      pathIndex++

      // When path ends — camera cinematic + switch animation
      if (pathIndex > 848 && !camSwitched) {
        camSwitched = true
        spinTo(camera, 'radius', 25, 40)
        spinTo(camera, 'alpha',  0.75, 50)
        spinTo(camera, 'beta',   0.8, 50)

        // Switch shark animation
        if (scene.animationGroups[1]) scene.animationGroups[1].stop()
        if (scene.animationGroups[2]) { scene.animationGroups[2].start(true) }

        // Switch character to idle
        playAnim(idleAnim ?? walkAnim)
      }

      if (pathIndex === 0) {
        carBody.rotationQuaternion = startRotation
      }
    }
  })

  // Right-click → switch camera view
  scene.onPointerDown = (e) => {
    if ((e as PointerEvent).button === 2) {
      pathMax // just reference to keep alive
      if (!camSwitched) {
        camera.setTarget(Vector3.Zero())
        spinTo(camera, 'radius', 50, 10)
        spinTo(camera, 'alpha',  3.4, 50)
        spinTo(camera, 'beta',   1.4, 50)
      }
    }
  }

  engine.runRenderLoop(() => scene.render())
}

// ── Kick off ──────────────────────────────────────────────────────────────
loadAll()
