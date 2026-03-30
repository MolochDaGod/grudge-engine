/**
 * Ragdoll Physics — Grudge Engine
 *
 * Havok physics ragdoll demo using a Grudge R2 character (GLB with Mixamo skeleton).
 * Converted from the BabylonJS UMD playground to proper ES6 @babylonjs/* imports.
 *
 * Key ES6 side-effect imports required:
 *  - @babylonjs/loaders/glTF             → registers the GLTF loader
 *  - @babylonjs/core/Physics/v2/physicsEngineComponent → scene.enablePhysics()
 *  - @babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent → shadows
 *
 * Ragdoll limitation: imported .GLTF/.GLB only work in Right-Handed scenes.
 */

// ── Side-effect imports (register loaders / engine components) ─────────────
import '@babylonjs/loaders/glTF'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

// ── Havok WASM ─────────────────────────────────────────────────────────────
import HavokPhysics          from '@babylonjs/havok'
import { HavokPlugin }       from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'

// ── Core ────────────────────────────────────────────────────────────────────
import { Engine }             from '@babylonjs/core/Engines/engine'
import { Scene }              from '@babylonjs/core/scene'
import { ArcRotateCamera }    from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }   from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }   from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }    from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { Color3 }             from '@babylonjs/core/Maths/math.color'
import { Axis }               from '@babylonjs/core/Maths/math.axis'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { SceneLoader }        from '@babylonjs/core/Loading/sceneLoader'

// ── Physics V2 ──────────────────────────────────────────────────────────────
import { PhysicsAggregate }   from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType }   from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { Ragdoll }            from '@babylonjs/core/Physics/v2/ragdoll'

// ── Debug ───────────────────────────────────────────────────────────────────
import { PhysicsViewer }      from '@babylonjs/core/Debug/physicsViewer'

// ── GUI ─────────────────────────────────────────────────────────────────────
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Button }                 from '@babylonjs/gui/2D/controls/button'
import { Control }                from '@babylonjs/gui/2D/controls/control'

// ── R2 character base ───────────────────────────────────────────────────────
const R2_CHARS = 'https://assets.grudge-studio.com/models/characters/rts'

// ── UI helpers ──────────────────────────────────────────────────────────────
const overlay    = document.getElementById('loading-overlay')!
const statusEl   = document.getElementById('loading-status')!
function setStatus(msg: string) { statusEl.textContent = msg }
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 600)
}

// ── Main (async because Havok + asset loading) ──────────────────────────────
async function main() {
  const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
  window.addEventListener('resize', () => engine.resize())

  const scene = new Scene(engine)

  // ⚠ Ragdoll with GLTF requires right-handed scene
  scene.useRightHandedSystem = true

  // ── Havok init ──────────────────────────────────────────────────────────
  setStatus('Initializing Havok WASM…')
  const havokInstance = await HavokPhysics()
  const hk = new HavokPlugin(true, havokInstance)
  scene.enablePhysics(new Vector3(0, -9.8, 0), hk)

  // ── Camera ──────────────────────────────────────────────────────────────
  const camera = new ArcRotateCamera('cam', 1.1, 1.4, 5, new Vector3(0, 1, 0), scene)
  camera.attachControl(canvas, true)
  camera.lowerRadiusLimit  = 2
  camera.upperRadiusLimit  = 15
  camera.wheelDeltaPercentage = 0.01

  // ── Lights ──────────────────────────────────────────────────────────────
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.7

  const dir = new DirectionalLight('dir', new Vector3(-1, -0.5, -1), scene)
  dir.position = new Vector3(3, 6, 4)

  // ── Shadows ─────────────────────────────────────────────────────────────
  const shadows = new ShadowGenerator(1024, dir)
  shadows.useBlurExponentialShadowMap = true
  shadows.blurKernel = 32

  // ── Ground with physics ─────────────────────────────────────────────────
  const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)
  ground.receiveShadows = true
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

  // ── Load character GLB ────────────────────────────────────────────────
  setStatus('Loading character model…')

  let ragdoll: Ragdoll | null = null

  try {
    const result = await SceneLoader.ImportMeshAsync('', `${R2_CHARS}/`, 'Knight_Male.glb', scene)
    const meshes   = result.meshes
    const skeleton = result.skeletons[0]

    if (!skeleton) {
      setStatus('Error: no skeleton found in model')
      hideOverlay()
      engine.runRenderLoop(() => scene.render())
      return
    }

    // Play the first embedded animation (idle)
    scene.beginAnimation(skeleton, 0, 100, true, 1.0)

    // Add shadow casters
    for (const mesh of meshes) {
      mesh.receiveShadows = true
      shadows.addShadowCaster(mesh, true)
    }

    // Default environment
    const helper = scene.createDefaultEnvironment({ enableGroundShadow: true })
    helper?.setMainColor(Color3.Gray())
    if (helper?.ground) helper.ground.position.y += 0.01

    // ── Ragdoll bone config (Mixamo skeleton) ────────────────────────────
    // Each entry maps bone names → physics box shape size + joint constraints
    const config = [
      { bones: ['mixamorig:Hips'], size: 0.25, boxOffset: 0.01 },
      {
        bones: ['mixamorig:Spine2'],
        size: 0.2,
        boxOffset: 0.05,
        boneOffsetAxis: Axis.Y,
        min: -1,
        max: 1,
        rotationAxis: Axis.Z,
      },
      // Arms
      {
        bones: ['mixamorig:LeftArm', 'mixamorig:RightArm'],
        depth: 0.1, size: 0.1, width: 0.2,
        rotationAxis: Axis.Y,
        boxOffset: 0.10,
        boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig:LeftForeArm', 'mixamorig:RightForeArm'],
        depth: 0.1, size: 0.1, width: 0.2,
        rotationAxis: Axis.Y,
        min: -1, max: 1,
        boxOffset: 0.12,
        boneOffsetAxis: Axis.Y,
      },
      // Legs
      {
        bones: ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'],
        depth: 0.1, size: 0.2, width: 0.08,
        rotationAxis: Axis.Y,
        min: -1, max: 1,
        boxOffset: 0.2,
        boneOffsetAxis: Axis.Y,
      },
      {
        bones: ['mixamorig:LeftLeg', 'mixamorig:RightLeg'],
        depth: 0.08, size: 0.3, width: 0.1,
        rotationAxis: Axis.Y,
        min: -1, max: 1,
        boxOffset: 0.2,
        boneOffsetAxis: Axis.Y,
      },
      // Hands
      {
        bones: ['mixamorig:LeftHand', 'mixamorig:RightHand'],
        depth: 0.2, size: 0.2, width: 0.2,
        rotationAxis: Axis.Y,
        min: -1, max: 1,
        boxOffset: 0.1,
        boneOffsetAxis: Axis.Y,
      },
      // Head
      {
        bones: ['mixamorig:Head'],
        size: 0.7,
        boxOffset: 0.3,
        boneOffsetAxis: Axis.Y,
        min: -1, max: 1,
        rotationAxis: Axis.Z,
      },
    ]

    // Find the root transform node for the character
    const rootNode = meshes[0]
    ragdoll = new Ragdoll(skeleton, rootNode as any, config)

    setStatus('Ready!')
  } catch (e) {
    console.error('Model load failed:', e)
    setStatus(`Load error — check CORS on assets.grudge-studio.com`)
  }

  hideOverlay()

  // ── GUI Buttons ───────────────────────────────────────────────────────
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui', true, scene)

  function createButton(id: string, text: string, top: string) {
    const btn = Button.CreateSimpleButton(id, text)
    btn.width     = 0.2
    btn.height    = '50px'
    btn.color     = '#d4d8e8'
    btn.background = '#1e2330'
    btn.fontSize  = 14
    btn.fontFamily = "'Courier New', monospace"
    btn.cornerRadius = 4
    btn.thickness = 1
    btn.hoverCursor = 'pointer'
    btn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP
    btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    btn.left = '14px'
    btn.top  = top
    btn.onPointerEnterObservable.add(() => { btn.background = '#c8a84b'; btn.color = '#000' })
    btn.onPointerOutObservable.add(()  => { btn.background = '#1e2330'; btn.color = '#d4d8e8' })
    return btn
  }

  const btnRagdoll = createButton('btnRagdoll', 'Ragdoll On', '10px')
  ui.addControl(btnRagdoll)

  const btnImpulse = createButton('btnImpulse', 'Impulse', '70px')
  ui.addControl(btnImpulse)

  const btnDebug = createButton('btnDebug', 'Toggle Physics Debug', '130px')
  ui.addControl(btnDebug)

  btnRagdoll.onPointerClickObservable.add(() => {
    if (ragdoll) {
      ragdoll.ragdoll()
      btnRagdoll.textBlock!.text = 'Ragdoll Active'
    }
  })

  btnImpulse.onPointerClickObservable.add(() => {
    if (ragdoll) {
      ragdoll.getAggregate(0)?.body.applyImpulse(
        new Vector3(200, 200, 200),
        Vector3.ZeroReadOnly,
      )
    }
  })

  // Physics debug viewer
  let viewer: PhysicsViewer | null = null
  btnDebug.onPointerClickObservable.add(() => {
    if (viewer) {
      viewer.dispose()
      viewer = null
      btnDebug.textBlock!.text = 'Toggle Physics Debug'
    } else {
      viewer = new PhysicsViewer()
      scene.transformNodes.forEach((node) => {
        if (node.physicsBody) {
          viewer!.showBody(node.physicsBody)
        }
      })
      btnDebug.textBlock!.text = 'Hide Physics Debug'
    }
  })

  // ── Render loop ─────────────────────────────────────────────────────────
  engine.runRenderLoop(() => scene.render())
}

main().catch(console.error)
