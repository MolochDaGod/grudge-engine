/**
 * Mipmap LOD Viewer
 * Port of the BJS playground #FN0D1D#3 snippet demo.
 *
 * Loads the power plant OBJ via AppendSceneAsync, then applies a
 * NodeRenderGraph that exposes a "Copy mipmap" block.  The block's
 * lodLevel is animated through all available mip levels so you can
 * visually see the mipmap chain of the rendered frame.
 *
 * WebGPU recommended — runs on WebGL2 as well (NRG adapts automatically).
 */

import '@babylonjs/loaders/OBJ'

import { WebGPUEngine }     from '@babylonjs/core/Engines/webgpuEngine'
import { Engine }           from '@babylonjs/core/Engines/engine'
import { Scene }            from '@babylonjs/core/scene'
import { SceneLoader }      from '@babylonjs/core/Loading/sceneLoader'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { NodeRenderGraph }  from '@babylonjs/core/FrameGraph/Node/nodeRenderGraph'
import { Tools }            from '@babylonjs/core/Misc/tools'

// ── Loading UI ───────────────────────────────────────────────────────────────
const overlay    = document.getElementById('loading-overlay')!
const loadBar    = document.getElementById('loading-bar')!
const loadStatus = document.getElementById('loading-status')!
const hud        = document.getElementById('hud')!

function setProgress(pct: number, msg: string) {
  loadBar.style.width = `${pct}%`
  loadStatus.textContent = msg
}
function hideOverlay() {
  overlay.classList.add('hidden')
  setTimeout(() => overlay.remove(), 700)
}

// ── Engine — prefer WebGPU ────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
window.addEventListener('resize', () => engine?.resize())

let engine: Engine | WebGPUEngine

async function init() {
  setProgress(10, 'Detecting GPU…')

  const gpuOk = await WebGPUEngine.IsSupportedAsync
  if (gpuOk) {
    engine = new WebGPUEngine(canvas, { adaptToDeviceRatio: true })
    await (engine as WebGPUEngine).initAsync()
  } else {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
  }

  setProgress(25, 'Loading power plant…')
  await buildScene()
}

async function buildScene() {
  const scene = new Scene(engine)

  // ── Load power plant OBJ ───────────────────────────────────────────────────
  await SceneLoader.AppendAsync(
    'https://assets.babylonjs.com/meshes/PowerPlant/',
    'powerplant.obj',
    scene,
  )
  setProgress(65, 'Building scene…')

  // ── Default camera + environment ───────────────────────────────────────────
  scene.createDefaultCameraOrLight(true, true, true)

  const light = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
  light.intensity = 1.5

  const camera = scene.activeCamera as any
  if (camera) {
    camera.wheelPrecision = 2
    camera.alpha  = -3.12
    camera.beta   = 1.30
    camera.radius = 75.63
    scene.cameraToUseForPointers = camera
  }

  // ── Node Render Graph ──────────────────────────────────────────────────────
  setProgress(80, 'Building render graph…')

  let t = 0

  try {
    const nrg = await NodeRenderGraph.ParseFromSnippetAsync('#FN0D1D#3', scene)
    const copyMipBlock = nrg.getBlockByName('Copy mipmap')

    if (copyMipBlock) {
      copyMipBlock.task.onBeforeTaskExecute.add(() => {
        const w = engine.getRenderWidth(true)
        const h = engine.getRenderHeight(true)
        const numMipmaps = Math.floor(Math.log2(Math.max(w, h))) + 1

        const lod = Math.floor(4 + t / 60) % numMipmaps
        copyMipBlock.task.lodLevel = lod
        t++

        hud.textContent = `LOD ${lod} / ${numMipmaps - 1} mips`
      })
    }

    await nrg.buildAsync()
    setProgress(100, 'Ready')
  } catch (e) {
    // NRG unavailable (e.g. no snippet server access) — fallback to plain scene
    console.warn('NodeRenderGraph unavailable, running plain scene:', e)
    hud.textContent = 'NRG unavailable — plain render'
    setProgress(100, 'Ready (NRG unavailable)')

    // Animate HUD manually so something still updates
    scene.onBeforeRenderObservable.add(() => {
      t++
      hud.textContent = `Frame ${t} — NRG snippet unreachable`
    })
  }

  hideOverlay()
  engine.runRenderLoop(() => scene.render())
}

init().catch(console.error)
