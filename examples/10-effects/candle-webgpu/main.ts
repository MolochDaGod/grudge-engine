/**
 * Candle — WebGPU Compute Flame
 * Port of the BJS "2X6FE4#1" NodeRenderGraph candle demo.
 *
 * WebGPU path : NodeRenderGraph + custom WGSL compute shader
 *               (procedural flame written directly into the framebuffer)
 * WebGL2 path : FireMaterial billboard plane (original BJS fallback)
 *
 * Model: candle.babylon from playground.babylonjs.com
 */

import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import FlameComputeShader from './flame.compute.wgsl?raw'

import { WebGPUEngine }        from '@babylonjs/core/Engines/webgpuEngine'
import { Engine }              from '@babylonjs/core/Engines/engine'
import { Scene }               from '@babylonjs/core/scene'
import { ArcRotateCamera }     from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }    from '@babylonjs/core/Lights/hemisphericLight'
import { SpotLight }           from '@babylonjs/core/Lights/spotLight'
import { Vector3, Matrix }   from '@babylonjs/core/Maths/math.vector'
import { Viewport }           from '@babylonjs/core/Maths/math.viewport'
import { Color3 }              from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }         from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh }                from '@babylonjs/core/Meshes/mesh'
import { Texture }             from '@babylonjs/core/Materials/Textures/texture'
import { TextureSampler }      from '@babylonjs/core/Materials/Textures/textureSampler'
import { ShadowGenerator }     from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { SceneLoader }         from '@babylonjs/core/Loading/sceneLoader'
import { NodeRenderGraph }     from '@babylonjs/core/FrameGraph/Node/nodeRenderGraph'
import { FireMaterial }        from '@babylonjs/materials/fire/fireMaterial'

// ── Loading UI ──────────────────────────────────────────────────────────────
const overlay    = document.getElementById('loading-overlay')!
const loadBar    = document.getElementById('loading-bar')!
const loadStatus = document.getElementById('loading-status')!
const badge      = document.getElementById('engine-badge')!

function setProgress(pct: number, msg: string) {
  loadBar.style.width = `${pct}%`
  loadStatus.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)
}

// ── Engine — prefer WebGPU ─────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
let engine: Engine | WebGPUEngine
window.addEventListener('resize', () => engine?.resize())

async function init() {
  setProgress(10, 'Detecting GPU…')
  const gpuOk = await WebGPUEngine.IsSupportedAsync

  if (gpuOk) {
    badge.textContent = 'WebGPU'
    badge.className   = 'badge-webgpu'
    engine = new WebGPUEngine(canvas, { adaptToDeviceRatio: true, stencil: true })
    await (engine as WebGPUEngine).initAsync()
  } else {
    badge.textContent = 'WebGL2'
    badge.className   = 'badge-webgl2'
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
  }

  setProgress(20, 'Loading candle…')
  await buildScene()
}

async function buildScene() {
  const scene = new Scene(engine)

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 10, Vector3.Zero(), scene)
  camera.minZ           = 0.1
  camera.wheelPrecision = 15
  camera.attachControl(canvas, true)

  // ── Lights ────────────────────────────────────────────────────────────────
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
  hemiLight.intensity = 0.4

  const spotLight = new SpotLight('light', new Vector3(2, 2, 2), new Vector3(-1, -2, -1), 3, 1, scene)
  spotLight.shadowMinZ = 0.1
  spotLight.shadowMaxZ = 10

  // ── Shadows ────────────────────────────────────────────────────────────────
  const shadows = new ShadowGenerator(1024, spotLight)
  shadows.useBlurExponentialShadowMap = true
  shadows.blurKernel = 32

  // ── Load candle model ──────────────────────────────────────────────────────
  setProgress(40, 'Importing candle mesh…')
  let plane: any = null
  try {
    const result = await SceneLoader.ImportMeshAsync(
      '', 'https://playground.babylonjs.com/scenes/', 'candle.babylon', scene,
    )
    const meshes = result.meshes
    plane = scene.getMeshByName('Plane')
    if (plane) plane.receiveShadows = true
    for (const m of meshes) {
      if (m !== plane) { m.receiveShadows = true }
    }
    shadows.addShadowCaster(meshes[0], true)
  } catch (e) {
    // Fallback: simple box if candle unavailable
    console.warn('candle.babylon unavailable, using placeholder:', e)
    const box = MeshBuilder.CreateBox('candle', { width: 0.5, height: 2, depth: 0.5 }, scene)
    box.position.y = 1
    shadows.addShadowCaster(box)
    plane = MeshBuilder.CreateGround('Plane', { width: 8, height: 8 }, scene)
    plane.receiveShadows = true
  }

  setProgress(65, 'Setting up environment…')

  // ── Flame position (tip of the candle wick) ────────────────────────────────
  const posFlame = new Vector3(0, 2.5 - 1.5 / 2, -0.1)

  scene.cameraToUseForPointers = camera

  // ── WebGPU path: NodeRenderGraph + compute shader ─────────────────────────
  if ((engine as any).isWebGPU) {
    setProgress(80, 'Building WebGPU render graph…')
    try {
      const nrg = await NodeRenderGraph.ParseFromSnippetAsync('2X6FE4#1', scene)
      const csBlock = nrg.getBlockByName('Compute Shader') as any

      // Inject our custom flame WGSL
      csBlock.shaderPath = { computeSource: FlameComputeShader }
      csBlock.shaderOptions = {
        bindingsMapping: {
          screen:          { group: 0, binding: 0 },
          bilinear_repeat: { group: 0, binding: 1 },
          channel0:        { group: 0, binding: 2 },
          params:          { group: 0, binding: 3 },
          depth:           { group: 0, binding: 4 },
        },
      }

      const csTask = csBlock.task

      // Uniform buffer: posFlame (vec4) + elapsedTime (f32)
      const ubo = csTask.createUniformBuffer('params', { posFlame: 4, elapsedTime: 1 })

      // Noise texture for FBM detail (use BJS cloud texture as noise stand-in)
      const noiseTex = new Texture('https://assets.babylonjs.com/textures/cloud.png', scene)
      noiseTex.name  = 'noise'
      csTask.setTextureSampler('bilinear_repeat', new TextureSampler().setParameters())
      csTask.setTexture('channel0', noiseTex, false)

      // Wire frame dimensions and depth texture
      const renderTask = nrg.getBlockByName('Main Rendering')?.task as any
      const frameGraph  = (nrg as any).frameGraph

      frameGraph?.onBuildObservable?.add(() => {
        const screen = frameGraph.textureManager.getTextureFromHandle(renderTask?.outputTexture)
        const depth  = frameGraph.textureManager.getTextureFromHandle(renderTask?.outputDepthTexture)
        if (!screen || !depth) return
        csTask.dispatchSize.x = Math.ceil(screen.width  / 16)
        csTask.dispatchSize.y = Math.ceil(screen.height / 16)
        csTask.setInternalTexture('screen', screen)
        csTask.setInternalTexture('depth',  depth)
      })

      // Per-frame: project flame world pos to screen space
      csTask.execute = () => {
        const vp    = new Viewport(0, 0, engine.getRenderWidth(true), engine.getRenderHeight(true))
        const pos2D = Vector3.Project(posFlame, Matrix.IdentityReadOnly, camera.getTransformationMatrix(), vp)
        const posV  = Vector3.TransformCoordinates(posFlame, camera.getViewMatrix())
        ubo.updateFloat4('posFlame', pos2D.x, pos2D.y, pos2D.z, posV.z)
        ubo.updateFloat ('elapsedTime', performance.now() / 1000)
      }

      await nrg.buildAsync()
      setProgress(100, 'Ready')
    } catch (e) {
      console.warn('NRG unavailable on WebGPU path, using FireMaterial:', e)
      addFireMaterial(scene, posFlame)
    }
  } else {
    // ── WebGL2 path: FireMaterial billboard ──────────────────────────────────
    setProgress(85, 'Building WebGL2 fire material…')
    addFireMaterial(scene, posFlame)
    setProgress(100, 'Ready')
  }

  hideOverlay()
  engine.runRenderLoop(() => scene.render())
}

function addFireMaterial(scene: Scene, pos: Vector3): void {
  const fire = new FireMaterial('fire', scene)
  fire.diffuseTexture    = new Texture('https://assets.babylonjs.com/textures/fire.png', scene)
  fire.distortionTexture = new Texture('https://assets.babylonjs.com/textures/distortion.png', scene)
  fire.opacityTexture    = new Texture('https://assets.babylonjs.com/textures/candleOpacity.png', scene)
  fire.speed             = 5.0

  const fplane = MeshBuilder.CreatePlane('fireplane', { size: 1.5 }, scene)
  fplane.position      = pos.clone()
  fplane.scaling.x     = 0.1
  fplane.scaling.y     = 0.7
  fplane.billboardMode = Mesh.BILLBOARDMODE_Y
  fplane.material      = fire
}

init().catch(console.error)
