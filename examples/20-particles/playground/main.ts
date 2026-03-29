/**
 * Particle Playground
 * Combines the node-material particle example (#X3PJMQ) and the
 * JSON-based particle loader with a full stackable layer system.
 *
 * Features:
 *  - Stack unlimited particle layers
 *  - 9 built-in presets  (fire, smoke, sparks, galaxy, snow, magic, burst, rain, vortex)
 *  - Live sliders for every key property on the selected layer
 *  - Load Node Material from BJS snippet
 *  - Load particle system from external JSON
 *  - GPU particles option
 *  - Burst trigger
 */

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { FreeCamera }        from '@babylonjs/core/Cameras/freeCamera'
import { ArcRotateCamera }   from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { Vector3 }           from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }    from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { Texture }           from '@babylonjs/core/Materials/Textures/texture'
import { ParticleSystem }    from '@babylonjs/core/Particles/particleSystem'
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import { SphereParticleEmitter } from '@babylonjs/core/Particles/EmitterTypes/sphereParticleEmitter'
import { ConeParticleEmitter }   from '@babylonjs/core/Particles/EmitterTypes/coneParticleEmitter'
import { NodeMaterial }      from '@babylonjs/core/Materials/Node/nodeMaterial'
import { AssetsManager }     from '@babylonjs/core/Misc/assetsManager'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'

const BJS_FLARE = 'https://assets.babylonjs.com/particles/flare.png'
const DOT_TEX   = 'https://models.babylonjs.com/Demos/particles/textures/dotParticle.png'
const JSON_URL  = 'https://patrickryanms.github.io/BabylonJStextures/Demos/Particles/particleSystem.json'

// ── Engine + Scene ────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
const scene  = new Scene(engine)
scene.clearColor = new Color4(0.067, 0.054, 0.157, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('camera', 0, Math.PI / 2, 10, Vector3.Zero(), scene)
camera.setTarget(Vector3.Zero())
camera.attachControl(canvas, true)
camera.lowerRadiusLimit = 2; camera.upperRadiusLimit = 40; camera.wheelPrecision = 15

// ── Lights ────────────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.5

// ── Shared invisible emitter mesh ────────────────────────────────────────
const emitterMesh = MeshBuilder.CreateBox('emitter', { size: 0.1 }, scene)
emitterMesh.isVisible = false

// ── Post-processing ───────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [camera])
pip.bloomEnabled = true; pip.bloomThreshold = 0.2; pip.bloomWeight = 0.5; pip.bloomKernel = 32
pip.fxaaEnabled  = true

// ── Layer state ───────────────────────────────────────────────────────────
interface Layer {
  id:     number
  name:   string
  ps:     ParticleSystem | GPUParticleSystem
  visible: boolean
}

let layers: Layer[]    = []
let activeLid: number  = -1
let nextId             = 0

// ── UI refs ───────────────────────────────────────────────────────────────
const overlay    = document.getElementById('loading-overlay')!
const sysList    = document.getElementById('sys-list')!
const noSel      = document.getElementById('no-selection')!
const layerCtrl  = document.getElementById('layer-controls')!
const fpsCounter = document.getElementById('fps-counter')!
const stackCount = document.getElementById('stack-count')!
const btnToggle  = document.getElementById('btn-toggle')!

// ── Slider wiring ─────────────────────────────────────────────────────────
function sl(id: string, valId: string, fmt: (v: number) => string, apply: (ps: any, v: number) => void) {
  const input = document.getElementById(id) as HTMLInputElement
  const disp  = document.getElementById(valId)!
  input.addEventListener('input', () => {
    const v = parseFloat(input.value)
    disp.textContent = fmt(v)
    const active = layers.find(l => l.id === activeLid)
    if (active) apply(active.ps, v)
  })
  return (v: number) => { input.value = String(v); disp.textContent = fmt(v) }
}

const setEmitRate  = sl('s-emitrate', 'v-emitrate', v => String(v),    (ps,v) => ps.emitRate = v)
const setMinSize   = sl('s-minsize',  'v-minsize',  v => v.toFixed(2), (ps,v) => ps.minSize  = v)
const setMaxSize   = sl('s-maxsize',  'v-maxsize',  v => v.toFixed(2), (ps,v) => ps.maxSize  = v)
const setMinLife   = sl('s-minlife',  'v-minlife',  v => v.toFixed(1), (ps,v) => ps.minLifeTime = v)
const setMaxLife   = sl('s-maxlife',  'v-maxlife',  v => v.toFixed(1), (ps,v) => ps.maxLifeTime = v)
const setMinPower  = sl('s-minpower', 'v-minpower', v => v.toFixed(1), (ps,v) => ps.minEmitPower = v)
const setMaxPower  = sl('s-maxpower', 'v-maxpower', v => v.toFixed(1), (ps,v) => ps.maxEmitPower = v)
const setGravity   = sl('s-gravity',  'v-gravity',  v => v.toFixed(1), (ps,v) => { if (ps.gravity) ps.gravity.y = v })
const setOpacity   = sl('s-opacity',  'v-opacity',  v => v.toFixed(2), (ps,v) => ps.updateSpeed  = v < 0.1 ? 0.0001 : 0.01)

function hexToC4(hex: string, a = 1): Color4 {
  const r = parseInt(hex.slice(1,3),16)/255
  const g = parseInt(hex.slice(3,5),16)/255
  const b = parseInt(hex.slice(5,7),16)/255
  return new Color4(r,g,b,a)
}
;['c-color1','c-color2','c-colordead'].forEach(id => {
  document.getElementById(id)!.addEventListener('input', (e) => {
    const hex = (e.target as HTMLInputElement).value
    const layer = layers.find(l => l.id === activeLid); if (!layer) return
    if (id === 'c-color1')    layer.ps.color1    = hexToC4(hex)
    if (id === 'c-color2')    layer.ps.color2    = hexToC4(hex)
    if (id === 'c-colordead') layer.ps.colorDead = hexToC4(hex, 0)
  })
})

const selBlend = document.getElementById('sel-blend') as HTMLSelectElement
selBlend.addEventListener('change', () => {
  const v = parseInt(selBlend.value)
  const layer = layers.find(l => l.id === activeLid); if (!layer) return
  layer.ps.blendMode = v === 3 ? ParticleSystem.BLENDMODE_ONEONE
                     : v === 2 ? ParticleSystem.BLENDMODE_MULTIPLIED
                     : v === 1 ? ParticleSystem.BLENDMODE_ADD
                               : ParticleSystem.BLENDMODE_STANDARD
})

const selEmitter = document.getElementById('sel-emitter') as HTMLSelectElement
selEmitter.addEventListener('change', () => {
  const layer = layers.find(l => l.id === activeLid); if (!layer) return
  const ps = layer.ps as ParticleSystem
  if (selEmitter.value === 'sphere') ps.particleEmitterType = new SphereParticleEmitter(1)
  else if (selEmitter.value === 'cone') ps.particleEmitterType = new ConeParticleEmitter(0.5, Math.PI/6)
  else { ps.emitter = emitterMesh; ps.direction1 = new Vector3(-1,1,-1); ps.direction2 = new Vector3(1,1,1) }
})

// ── Sync controls → selected layer ───────────────────────────────────────
function syncUI(ps: ParticleSystem | GPUParticleSystem) {
  setEmitRate(ps.emitRate)
  setMinSize(ps.minSize); setMaxSize(ps.maxSize)
  setMinLife(ps.minLifeTime); setMaxLife(ps.maxLifeTime)
  setMinPower(ps.minEmitPower); setMaxPower(ps.maxEmitPower)
  setGravity(ps.gravity?.y ?? -1)
  noSel.style.display = 'none'; layerCtrl.style.display = ''
  const c1h = '#'+[...new Float32Array([ps.color1.r, ps.color1.g, ps.color1.b])].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')
  ;(document.getElementById('c-color1') as HTMLInputElement).value = c1h
  btnToggle.textContent = ps.isStarted() ? 'Pause' : 'Resume'
}

// ── Stack list rendering ──────────────────────────────────────────────────
function renderList() {
  sysList.innerHTML = ''
  for (const layer of layers) {
    const item = document.createElement('div')
    item.className = 'sys-item' + (layer.id === activeLid ? ' active' : '')
    item.innerHTML = `
      <span class="sys-vis" title="Toggle visibility">${layer.visible ? '👁' : '🚫'}</span>
      <span class="sys-name">${layer.name}</span>
      <span class="sys-del" title="Remove">✕</span>
    `
    item.querySelector('.sys-vis')!.addEventListener('click', (e) => {
      e.stopPropagation()
      layer.visible = !layer.visible
      layer.visible ? layer.ps.start() : layer.ps.stop()
      renderList()
    })
    item.querySelector('.sys-del')!.addEventListener('click', (e) => {
      e.stopPropagation()
      layer.ps.dispose()
      layers = layers.filter(l => l.id !== layer.id)
      if (activeLid === layer.id) { activeLid = -1; noSel.style.display = ''; layerCtrl.style.display = 'none' }
      renderList(); updateCount()
    })
    item.addEventListener('click', () => {
      activeLid = layer.id
      syncUI(layer.ps)
      renderList()
    })
    sysList.appendChild(item)
  }
  updateCount()
}

function updateCount() {
  stackCount.textContent = `${layers.length} layer${layers.length !== 1 ? 's' : ''}`
}

// ── Create a base particle system ─────────────────────────────────────────
function makePS(name: string, gpu = false): ParticleSystem | GPUParticleSystem {
  const ps = gpu
    ? new GPUParticleSystem(name, { capacity: 4000 }, scene)
    : new ParticleSystem(name, 4000, scene)

  ps.particleTexture = new Texture(BJS_FLARE, scene)
  ps.emitter         = emitterMesh
  ps.minSize         = 0.1;   ps.maxSize      = 1.0
  ps.minLifeTime     = 0.5;   ps.maxLifeTime  = 5.0
  ps.emitRate        = 200
  ps.minEmitPower    = 0.5;   ps.maxEmitPower = 3.0
  ps.blendMode       = ParticleSystem.BLENDMODE_ONEONE
  ps.direction1      = new Vector3(-1, 1, -1)
  ps.direction2      = new Vector3(1, 1, 1)
  ps.color1          = new Color4(1, 1, 0, 1)
  ps.color2          = new Color4(1, 0.5, 0, 1)
  ps.colorDead       = new Color4(0.1, 0, 0, 0)
  ps.gravity         = new Vector3(0, -1, 0)
  ps.renderingGroupId = 1
  return ps
}

function addLayer(name: string, ps?: ParticleSystem | GPUParticleSystem, gpu = false): Layer {
  const sys = ps ?? makePS(name, gpu)
  sys.start()
  const layer: Layer = { id: nextId++, name, ps: sys, visible: true }
  layers.push(layer)
  activeLid = layer.id
  syncUI(layer.ps)
  renderList()
  return layer
}

// ── Presets ───────────────────────────────────────────────────────────────
const PRESETS: Record<string, (ps: ParticleSystem | GPUParticleSystem) => void> = {
  fire(ps) {
    ps.emitRate = 400; ps.minSize = 0.2; ps.maxSize = 1.2
    ps.minLifeTime = 0.3; ps.maxLifeTime = 1.5
    ps.minEmitPower = 1; ps.maxEmitPower = 5
    ps.gravity = new Vector3(0, 2, 0)
    ps.direction1 = new Vector3(-0.5, 1, -0.5); ps.direction2 = new Vector3(0.5, 2, 0.5)
    ps.color1 = new Color4(1, 0.5, 0.1, 1); ps.color2 = new Color4(1, 0.2, 0, 1)
    ps.colorDead = new Color4(0.2, 0, 0, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
  },
  smoke(ps) {
    ps.emitRate = 80; ps.minSize = 0.8; ps.maxSize = 3.0
    ps.minLifeTime = 2; ps.maxLifeTime = 8
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.8
    ps.gravity = new Vector3(0, 0.5, 0)
    ps.color1 = new Color4(0.4, 0.4, 0.4, 0.4); ps.color2 = new Color4(0.2, 0.2, 0.2, 0.3)
    ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
  },
  sparks(ps) {
    ps.emitRate = 300; ps.minSize = 0.04; ps.maxSize = 0.15
    ps.minLifeTime = 0.3; ps.maxLifeTime = 1.2
    ps.minEmitPower = 3; ps.maxEmitPower = 8
    ps.gravity = new Vector3(0, -9.8, 0)
    ps.direction1 = new Vector3(-3, 3, -3); ps.direction2 = new Vector3(3, 6, 3)
    ps.color1 = new Color4(1, 0.9, 0.2, 1); ps.color2 = new Color4(1, 0.4, 0, 1)
    ps.colorDead = new Color4(0.3, 0.1, 0, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
  },
  galaxy(ps) {
    ps.emitRate = 150; ps.minSize = 0.05; ps.maxSize = 0.25
    ps.minLifeTime = 3; ps.maxLifeTime = 8
    ps.minEmitPower = 0.5; ps.maxEmitPower = 2
    ps.gravity = new Vector3(0, 0, 0)
    if ('particleEmitterType' in ps) ps.particleEmitterType = new SphereParticleEmitter(3)
    ps.color1 = new Color4(0.4, 0.6, 1, 1); ps.color2 = new Color4(0.8, 0.3, 1, 1)
    ps.colorDead = new Color4(0.05, 0, 0.1, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
  },
  snow(ps) {
    ps.emitRate = 120; ps.minSize = 0.05; ps.maxSize = 0.18
    ps.minLifeTime = 4; ps.maxLifeTime = 10
    ps.minEmitPower = 0.1; ps.maxEmitPower = 0.4
    ps.gravity = new Vector3(0, -0.3, 0)
    ps.direction1 = new Vector3(-0.5, -1, -0.5); ps.direction2 = new Vector3(0.5, -1, 0.5)
    ps.color1 = new Color4(1, 1, 1, 0.9); ps.color2 = new Color4(0.8, 0.9, 1, 0.8)
    ps.colorDead = new Color4(0.6, 0.7, 1, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
    if (ps.emitter instanceof Vector3 === false) (ps.emitter as any).scaling?.setAll?.(8)
  },
  magic(ps) {
    ps.emitRate = 250; ps.minSize = 0.08; ps.maxSize = 0.4
    ps.minLifeTime = 0.8; ps.maxLifeTime = 3
    ps.minEmitPower = 0.5; ps.maxEmitPower = 2.5
    ps.gravity = new Vector3(0, 1.5, 0)
    ps.color1 = new Color4(0.6, 0.2, 1, 1); ps.color2 = new Color4(0.1, 0.8, 1, 1)
    ps.colorDead = new Color4(0.3, 0, 0.5, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
  },
  explosion(ps) {
    ps.emitRate = 0; ps.minSize = 0.1; ps.maxSize = 1.5
    ps.minLifeTime = 0.2; ps.maxLifeTime = 1.5
    ps.minEmitPower = 4; ps.maxEmitPower = 12
    ps.gravity = new Vector3(0, -5, 0)
    ps.direction1 = new Vector3(-1, -1, -1); ps.direction2 = new Vector3(1, 1, 1)
    ps.color1 = new Color4(1, 0.6, 0, 1); ps.color2 = new Color4(1, 0.2, 0, 1)
    ps.colorDead = new Color4(0.2, 0.1, 0, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
    ps.manualEmitCount = 500
  },
  rain(ps) {
    ps.emitRate = 500; ps.minSize = 0.02; ps.maxSize = 0.06
    ps.minLifeTime = 0.5; ps.maxLifeTime = 1.5
    ps.minEmitPower = 8; ps.maxEmitPower = 14
    ps.gravity = new Vector3(0, -20, 0)
    ps.direction1 = new Vector3(-0.1, -1, -0.1); ps.direction2 = new Vector3(0.1, -1, 0.1)
    ps.color1 = new Color4(0.5, 0.7, 1, 0.8); ps.color2 = new Color4(0.4, 0.6, 0.9, 0.6)
    ps.colorDead = new Color4(0.2, 0.4, 0.8, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD
  },
  vortex(ps) {
    ps.emitRate = 200; ps.minSize = 0.06; ps.maxSize = 0.3
    ps.minLifeTime = 1.5; ps.maxLifeTime = 4
    ps.minEmitPower = 1; ps.maxEmitPower = 3
    ps.gravity = new Vector3(0, 0, 0)
    if ('particleEmitterType' in ps) ps.particleEmitterType = new ConeParticleEmitter(1, Math.PI / 8)
    ps.color1 = new Color4(0.2, 0.8, 1, 1); ps.color2 = new Color4(0.5, 0.1, 0.8, 1)
    ps.colorDead = new Color4(0, 0.1, 0.3, 0)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
  },
}

document.getElementById('preset-grid')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-preset]') as HTMLElement
  if (!btn) return
  const key = btn.dataset.preset!
  const fn  = PRESETS[key]; if (!fn) return
  const ps  = makePS(key)
  fn(ps)
  ps.start()
  const layer = addLayer(key, ps)
  syncUI(layer.ps)
})

// ── Add / Clear buttons ───────────────────────────────────────────────────
document.getElementById('btn-add')!.addEventListener('click', () => {
  addLayer(`Layer ${nextId}`)
})
document.getElementById('btn-clear')!.addEventListener('click', () => {
  layers.forEach(l => l.ps.dispose())
  layers = []; activeLid = -1
  noSel.style.display = ''; layerCtrl.style.display = 'none'
  renderList()
})

// ── Toggle / Burst ────────────────────────────────────────────────────────
btnToggle.addEventListener('click', () => {
  const layer = layers.find(l => l.id === activeLid); if (!layer) return
  if (layer.ps.isStarted()) { layer.ps.stop(); btnToggle.textContent = 'Resume' }
  else { layer.ps.start(); btnToggle.textContent = 'Pause' }
})
document.getElementById('btn-burst')!.addEventListener('click', () => {
  const layer = layers.find(l => l.id === activeLid); if (!layer) return
  const ps = layer.ps as ParticleSystem
  const prev = ps.emitRate
  ps.manualEmitCount = 300
  ps.emitRate = 0
  setTimeout(() => { ps.emitRate = prev; ps.manualEmitCount = -1 }, 50)
})

// ── Node Material ─────────────────────────────────────────────────────────
document.getElementById('btn-node-mat')!.addEventListener('click', async () => {
  const ps = makePS('NodeMat')
  ps.color1 = new Color4(1, 1, 0.5, 1); ps.color2 = new Color4(1, 0.5, 0, 1)
  ps.gravity = new Vector3(0, 0.5, 0)
  try {
    const nm = await NodeMaterial.ParseFromSnippetAsync('#X3PJMQ', scene) as any
    nm.createEffectForParticles(ps)
  } catch (e) { console.warn('NodeMaterial snippet unavailable:', e) }
  ps.start()
  addLayer('NodeMat', ps)
})

// ── Load JSON from URL ────────────────────────────────────────────────────
document.getElementById('btn-load-json')!.addEventListener('click', () => {
  const sphere = MeshBuilder.CreateSphere('jsonSphere', { diameter: 2, segments: 32 }, scene)
  sphere.isVisible = false

  const mgr = new AssetsManager(scene)
  const texTask  = mgr.addTextureTask('jsonTex', DOT_TEX)
  const fileTask = mgr.addTextFileTask('jsonFile', JSON_URL)
  mgr.onFinish = () => {
    try {
      const data = JSON.parse(fileTask.text)
      const ps   = ParticleSystem.Parse(data, scene, '', false, 1000) as ParticleSystem
      ps.particleTexture = texTask.texture
      ps.emitter = sphere
      ps.start()
      addLayer('JSON System', ps)
    } catch (e) { console.warn('JSON particle load failed:', e) }
  }
  mgr.load()
})

// ── GPU Particles ─────────────────────────────────────────────────────────
document.getElementById('btn-gpu')!.addEventListener('click', () => {
  const ps = makePS('GPU Layer', true) as GPUParticleSystem
  ps.createSphereEmitter(2)
  ps.color1 = new Color4(0.4, 0.8, 1, 1); ps.color2 = new Color4(0.8, 0.4, 1, 1)
  ps.gravity = new Vector3(0, 0, 0)
  ps.emitRate = 600
  ps.start()
  addLayer('GPU Layer', ps)
})

// ── Boot: add a fire preset by default ───────────────────────────────────
const defaultPs = makePS('fire')
PRESETS.fire(defaultPs)
defaultPs.start()
addLayer('fire', defaultPs)

overlay.classList.add('hidden')
setTimeout(() => overlay.remove(), 600)

// ── FPS counter ───────────────────────────────────────────────────────────
let fpsFrames = 0
scene.onBeforeRenderObservable.add(() => {
  fpsFrames++
  if (fpsFrames % 30 === 0) fpsCounter.textContent = `${engine.getFps().toFixed(0)} fps`
})

engine.runRenderLoop(() => scene.render())
