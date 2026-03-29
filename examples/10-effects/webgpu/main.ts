/**
 * WebGPU Engine Demo
 * Falls back to WebGL2 when WebGPU is unavailable.
 * Showcases: PBR materials, GPU particles, Glow layer, HDR sky.
 */

import { WebGPUEngine }         from '@babylonjs/core/Engines/webgpuEngine'
import { Engine }               from '@babylonjs/core/Engines/engine'
import { Scene }                from '@babylonjs/core/scene'
import { ArcRotateCamera }      from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 }              from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }       from '@babylonjs/core/Maths/math.color'
import { HemisphericLight }     from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }     from '@babylonjs/core/Lights/directionalLight'
import { PointLight }           from '@babylonjs/core/Lights/pointLight'
import { MeshBuilder }          from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial }          from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { GlowLayer }            from '@babylonjs/core/Layers/glowLayer'
import { GPUParticleSystem }    from '@babylonjs/core/Particles/gpuParticleSystem'
import { Texture }              from '@babylonjs/core/Materials/Textures/texture'
import { CubeTexture }          from '@babylonjs/core/Materials/Textures/cubeTexture'

const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const hud    = document.getElementById('hud')!

async function createEngine(): Promise<Engine | WebGPUEngine> {
  const webGPUSupported = await WebGPUEngine.IsSupportedAsync
  if (webGPUSupported) {
    hud.textContent = 'WebGPU ✓ — PBR + GPU Particles + Glow Layer'
    hud.style.color  = '#4bffa5'
    const eng = new WebGPUEngine(canvas, { adaptToDeviceRatio: true })
    await eng.initAsync()
    return eng
  }
  hud.textContent = 'WebGL2 (WebGPU not available) — PBR + Glow + Particles'
  hud.style.color  = '#c8a84b'
  return new Engine(canvas, true, { adaptToDeviceRatio: true })
}

createEngine().then(engine => {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.03, 0.03, 0.06, 1)

  window.addEventListener('resize', () => engine.resize())

  // ── Camera ─────────────────────────────────────────────────────────
  const cam = new ArcRotateCamera('cam', -Math.PI/2, Math.PI/3, 14, Vector3.Zero(), scene)
  cam.lowerRadiusLimit = 4; cam.upperRadiusLimit = 30; cam.wheelPrecision = 30
  cam.attachControl(canvas, true)

  // ── Lights ──────────────────────────────────────────────────────────
  const hemi = new HemisphericLight('hemi', new Vector3(0,1,0), scene)
  hemi.intensity = 0.3; hemi.groundColor = new Color3(0.05,0.05,0.1)

  const sun = new DirectionalLight('sun', new Vector3(-1,-2,-1), scene)
  sun.position = new Vector3(10,20,10); sun.intensity = 1.8

  // Emissive point light for the orb
  const orbLight = new PointLight('orbLight', new Vector3(0,1,0), scene)
  orbLight.diffuse   = new Color3(0.4, 0.8, 1)
  orbLight.intensity = 60
  orbLight.range     = 12

  // ── Ground — PBR rough dark metal ───────────────────────────────────
  const ground = MeshBuilder.CreateGround('ground', { width:20, height:20, subdivisions:4 }, scene)
  const gMat   = new PBRMaterial('groundPBR', scene)
  gMat.albedoColor   = new Color3(0.05, 0.06, 0.08)
  gMat.metallic      = 0.9
  gMat.roughness     = 0.2
  gMat.reflectivityColor = new Color3(0.6, 0.6, 0.6)
  ground.material    = gMat

  // ── PBR sphere grid ──────────────────────────────────────────────────
  const metals = [
    { name:'gold',   albedo: new Color3(1.0, 0.77, 0.0),  m:1.0, r:0.1 },
    { name:'chrome', albedo: new Color3(0.8, 0.8,  0.8),  m:1.0, r:0.05 },
    { name:'copper', albedo: new Color3(0.95, 0.64, 0.54), m:1.0, r:0.2 },
    { name:'matte',  albedo: new Color3(0.2, 0.4,  0.8),  m:0.0, r:0.9 },
    { name:'glass',  albedo: new Color3(0.9, 0.95, 1.0),  m:0.0, r:0.05 },
  ]
  metals.forEach((def, i) => {
    const sx = (i - 2) * 3
    const sphere = MeshBuilder.CreateSphere(`sphere_${def.name}`, { diameter:1.6, segments:32 }, scene)
    sphere.position.set(sx, 0.8, 0)
    const mat = new PBRMaterial(`mat_${def.name}`, scene)
    mat.albedoColor = def.albedo
    mat.metallic    = def.m
    mat.roughness   = def.r
    if (def.name === 'glass') { mat.alpha = 0.3; mat.transparencyMode = 2 }
    sphere.material = mat
  })

  // ── Glowing energy orb ───────────────────────────────────────────────
  const orb  = MeshBuilder.CreateSphere('orb', { diameter: 1.4, segments:32 }, scene)
  orb.position.set(0, 3.5, 0)
  const orbMat = new PBRMaterial('orbMat', scene)
  orbMat.albedoColor   = new Color3(0.4, 0.9, 1.0)
  orbMat.emissiveColor = new Color3(0.4, 0.9, 1.0)
  orbMat.metallic      = 0
  orbMat.roughness     = 0.05
  orb.material = orbMat

  // Glow layer — works on both WebGL2 and WebGPU
  const glow   = new GlowLayer('glow', scene, { blurKernelSize: 64 })
  glow.intensity = 1.2
  glow.addIncludedOnlyMesh(orb)

  // ── GPU Particle system — energy trail ──────────────────────────────
  const emitter = orb
  const ps = new GPUParticleSystem('orbParticles', { capacity: 3000 }, scene)
  ps.particleTexture = new Texture('https://assets.babylonjs.com/particles/flare.png', scene)
  ps.emitter         = emitter
  ps.createSphereEmitter(0.8)
  ps.minSize      = 0.04; ps.maxSize      = 0.18
  ps.minLifeTime  = 0.5;  ps.maxLifeTime  = 1.5
  ps.emitRate     = 200
  ps.blendMode    = GPUParticleSystem.BLENDMODE_ONEONE
  ps.gravity      = new Vector3(0, 2, 0)
  ps.color1       = new Color4(0.4, 0.9, 1.0, 1)
  ps.color2       = new Color4(0.2, 0.5, 1.0, 1)
  ps.colorDead    = new Color4(0.0, 0.1, 0.4, 0)
  ps.minEmitPower = 0.5; ps.maxEmitPower = 2
  ps.updateSpeed  = 0.01
  ps.start()

  // ── Animate orb ─────────────────────────────────────────────────────
  let t = 0
  scene.onBeforeRenderObservable.add(() => {
    t += scene.getEngine().getDeltaTime() * 0.001
    orb.position.y      = 3.5 + Math.sin(t * 1.3) * 0.5
    orbLight.position   = orb.position
    orb.rotation.y     += 0.01
    orbLight.intensity  = 50 + Math.sin(t * 2.7) * 20
  })

  engine.runRenderLoop(() => scene.render())
})
