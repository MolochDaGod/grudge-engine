/**
 * Physics + Particles
 * Port of the Havok physics helper playground, enhanced with particle effects
 * for every physics event:
 *
 *  Radial Explosion → burst spark + shockwave ring + fire particles
 *  Gravitational Field → spiraling blue/purple orbs drawn toward origin
 *  Updraft → rising dust/smoke column with embers
 *  Vortex → tornado of multi-colored shards
 *  Box impacts → micro-spark bursts on high-velocity contacts
 *
 * Controls: checkbox panel (left) for Aggregate / Viewer / Instances modes
 */

import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import HavokPhysics                from '@babylonjs/havok'
import { HavokPlugin }             from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import { PhysicsAggregate }        from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsBody }             from '@babylonjs/core/Physics/v2/physicsBody'
import { PhysicsShapeBox }         from '@babylonjs/core/Physics/v2/physicsShape'
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { PhysicsHelper, PhysicsRadialImpulseFalloff } from '@babylonjs/core/Physics/physicsHelper'

import { Engine }            from '@babylonjs/core/Engines/engine'
import { Scene }             from '@babylonjs/core/scene'
import { FreeCamera }        from '@babylonjs/core/Cameras/freeCamera'
import { HemisphericLight }  from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }  from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }   from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }    from '@babylonjs/core/Maths/math.color'
import { Matrix }            from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder }       from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }  from '@babylonjs/core/Materials/standardMaterial'
import { Mesh }              from '@babylonjs/core/Meshes/mesh'
import { ParticleSystem }    from '@babylonjs/core/Particles/particleSystem'
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import { SphereParticleEmitter } from '@babylonjs/core/Particles/EmitterTypes/sphereParticleEmitter'
import { ConeParticleEmitter }   from '@babylonjs/core/Particles/EmitterTypes/coneParticleEmitter'
import { CylinderParticleEmitter } from '@babylonjs/core/Particles/EmitterTypes/cylinderParticleEmitter'
import { Texture }           from '@babylonjs/core/Materials/Textures/texture'
import { GlowLayer }         from '@babylonjs/core/Layers/glowLayer'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { StackPanel }             from '@babylonjs/gui/2D/controls/stackPanel'
import { Button }                 from '@babylonjs/gui/2D/controls/button'
import { Checkbox }               from '@babylonjs/gui/2D/controls/checkbox'
import { Control }                from '@babylonjs/gui/2D/controls/control'
import { TextBlock }              from '@babylonjs/gui/2D/controls/textBlock'

const FLARE = 'https://assets.babylonjs.com/particles/flare.png'

// ── Engine + Scene ─────────────────────────────────────────────────────────
const canvas = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
window.addEventListener('resize', () => engine.resize())

async function main() {
  const scene = new Scene(engine)

  // ── Havok ───────────────────────────────────────────────────────────────
  const havok  = await HavokPhysics()
  const plugin = new HavokPlugin(true, havok)
  scene.enablePhysics(new Vector3(0, -10, 0), plugin)
  const physicsHelper = new PhysicsHelper(scene)

  // ── Physics config flags ────────────────────────────────────────────────
  let useAggregate = false
  let useInstances = false
  let useParticles = true   // our addition

  // ── Camera ──────────────────────────────────────────────────────────────
  const camera = new FreeCamera('camera1', new Vector3(0, 24, -64), scene)
  camera.setTarget(Vector3.Zero())
  camera.attachControl(canvas, true)

  // ── Lights + shadows ────────────────────────────────────────────────────
  const hemi = new HemisphericLight('light1', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.7

  const dir = new DirectionalLight('dir', new Vector3(-1, -2, -1), scene)
  dir.position  = new Vector3(20, 40, 20)
  dir.intensity = 0.8
  const shadows = new ShadowGenerator(1024, dir)
  shadows.useBlurExponentialShadowMap = true

  // ── Glow layer (makes particles luminous) ───────────────────────────────
  const glow = new GlowLayer('glow', scene, { blurKernelSize: 32 })
  glow.intensity = 1.4

  // ── Post-processing ─────────────────────────────────────────────────────
  const pip = new DefaultRenderingPipeline('pip', true, scene, [camera])
  pip.bloomEnabled = true; pip.bloomThreshold = 0.3; pip.bloomWeight = 0.6
  pip.fxaaEnabled  = true

  // ── Ground ──────────────────────────────────────────────────────────────
  const ground = MeshBuilder.CreateGround('ground1', { width: 64, height: 64, subdivisions: 2 }, scene)
  ground.receiveShadows = true
  const groundMat = new StandardMaterial('gmat', scene)
  groundMat.diffuseColor = new Color3(0.15, 0.17, 0.2)
  ground.material = groundMat

  const groundShape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(64, 0.001, 64), scene)
  groundShape.material = { friction: 0.2, restitution: 0.3 }
  const groundBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, false, scene)
  groundBody.shape = groundShape
  groundBody.setMassProperties({ mass: 0 })

  // ── Shared physics shape for boxes ──────────────────────────────────────
  const BOX_SIZE   = 2
  const boxShape   = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE), scene)
  boxShape.material = { friction: 0.2, restitution: 0.3 }

  const boxMat = new StandardMaterial('boxMat', scene)
  boxMat.diffuseColor = new Color3(0.2, 0.4, 0.8)
  boxMat.specularColor = new Color3(0.5, 0.5, 0.5)

  // ── Box creation ────────────────────────────────────────────────────────
  let baseBox: Mesh | null = null
  const boxes: Mesh[] = []

  function createBoxes() {
    const pad = 4, min = -12, max = 12, maxY = 8
    let idx = 0

    let baseMatArr: Matrix[] = []
    if (useInstances) {
      baseBox = MeshBuilder.CreateBox('baseBox', { size: BOX_SIZE }, scene)
      baseBox.material = boxMat
    }

    for (let x = min; x <= max; x += BOX_SIZE + pad) {
      for (let z = min; z <= max; z += BOX_SIZE + pad) {
        for (let y = BOX_SIZE / 2; y <= maxY; y += BOX_SIZE) {
          if (useInstances) {
            const m = Matrix.Identity()
            m.setTranslationFromFloats(x, y, z)
            baseMatArr.push(m.clone())
          } else {
            const box = MeshBuilder.CreateBox(`box_${idx++}`, { size: BOX_SIZE }, scene)
            box.position.set(x, y, z)
            box.material = boxMat
            box.receiveShadows = true
            shadows.addShadowCaster(box)
            boxes.push(box)

            if (useAggregate) {
              const agg = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: BOX_SIZE, restitution: 0.2, friction: 0.3 }, scene)
              box.metadata = { aggregate: agg }
            } else {
              const body = new PhysicsBody(box, PhysicsMotionType.DYNAMIC, false, scene)
              body.shape = boxShape
              body.setMassProperties({ mass: BOX_SIZE })
            }
          }
        }
      }
    }

    if (useInstances && baseBox && baseMatArr.length) {
      const buf = new Float32Array(baseMatArr.length * 16)
      baseMatArr.forEach((m, i) => m.copyToArray(buf, i * 16))
      baseBox.thinInstanceSetBuffer('matrix', buf, 16, false)
      const body = new PhysicsBody(baseBox, PhysicsMotionType.DYNAMIC, false, scene)
      body.shape = boxShape
      body.setMassProperties({ mass: BOX_SIZE })
    }

    // ── Initial spawn sparkle burst ─────────────────────────────────────
    if (useParticles) {
      const spawnPS = makePS('spawn', 2000)
      spawnPS.emitter = new Vector3(0, 8, 0) as any
      spawnPS.createSphereEmitter(14)
      spawnPS.emitRate = 0
      spawnPS.manualEmitCount = 300
      spawnPS.minSize = 0.05; spawnPS.maxSize = 0.2
      spawnPS.minLifeTime = 0.5; spawnPS.maxLifeTime = 2
      spawnPS.minEmitPower = 2; spawnPS.maxEmitPower = 6
      spawnPS.gravity = new Vector3(0, -5, 0)
      spawnPS.color1 = new Color4(0.3, 0.6, 1, 1)
      spawnPS.color2 = new Color4(0.5, 0.8, 1, 0.8)
      spawnPS.colorDead = new Color4(0, 0.1, 0.3, 0)
      spawnPS.blendMode = ParticleSystem.BLENDMODE_ONEONE
      spawnPS.start()
      setTimeout(() => spawnPS.dispose(), 4000)
    }
  }

  function restartScene() {
    baseBox?.dispose()
    baseBox = null
    for (const m of boxes) {
      if (m.metadata?.aggregate) m.metadata.aggregate.dispose()
      else m.physicsBody?.dispose()
      m.dispose()
    }
    boxes.length = 0
    createBoxes()
  }

  createBoxes()

  // ── Particle helpers ────────────────────────────────────────────────────
  function makePS(name: string, capacity = 1000): ParticleSystem {
    const ps = new ParticleSystem(name, capacity, scene)
    ps.particleTexture = new Texture(FLARE, scene)
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
    ps.renderingGroupId = 1
    return ps
  }

  // EXPLOSION — shockwave ring + sparks + fire core
  function particleExplosion(origin: Vector3) {
    // ── Core fire burst ─────────────────────────────────────────────────
    const fire = makePS('exp_fire', 800)
    fire.emitter = origin.clone() as any
    fire.createSphereEmitter(0.3)
    fire.emitRate = 0; fire.manualEmitCount = 600
    fire.minSize = 0.15; fire.maxSize = 1.2
    fire.minLifeTime = 0.3; fire.maxLifeTime = 1.5
    fire.minEmitPower = 6; fire.maxEmitPower = 18
    fire.gravity = new Vector3(0, -3, 0)
    fire.direction1 = new Vector3(-1, -1, -1); fire.direction2 = new Vector3(1, 1, 1)
    fire.color1    = new Color4(1, 0.7, 0.1, 1)
    fire.color2    = new Color4(1, 0.2, 0, 1)
    fire.colorDead = new Color4(0.15, 0, 0, 0)
    fire.start()

    // ── Sparks (fast, gravity-pulled) ────────────────────────────────────
    const sparks = makePS('exp_sparks', 500)
    sparks.emitter = origin.clone() as any
    sparks.createSphereEmitter(0.1)
    sparks.emitRate = 0; sparks.manualEmitCount = 300
    sparks.minSize = 0.04; sparks.maxSize = 0.12
    sparks.minLifeTime = 0.5; sparks.maxLifeTime = 2
    sparks.minEmitPower = 12; sparks.maxEmitPower = 28
    sparks.gravity = new Vector3(0, -15, 0)
    sparks.color1    = new Color4(1, 1, 0.5, 1)
    sparks.color2    = new Color4(1, 0.8, 0.1, 1)
    sparks.colorDead = new Color4(0.3, 0.1, 0, 0)
    sparks.start()

    // ── Shockwave ring (expanding disc of particles) ─────────────────────
    const ring = makePS('exp_ring', 300)
    ring.emitter = origin.clone() as any
    ring.createConeEmitter(0.05, Math.PI / 2)  // flat cone = ring
    ring.emitRate = 0; ring.manualEmitCount = 200
    ring.minSize = 0.08; ring.maxSize = 0.25
    ring.minLifeTime = 0.6; ring.maxLifeTime = 1.2
    ring.minEmitPower = 10; ring.maxEmitPower = 16
    ring.gravity = new Vector3(0, 0, 0)
    ring.color1    = new Color4(1, 0.9, 0.6, 0.9)
    ring.color2    = new Color4(0.8, 0.4, 0.1, 0.5)
    ring.colorDead = new Color4(0.2, 0.1, 0, 0)
    ring.start()

    // ── Smoke trail (slow, rising) ───────────────────────────────────────
    const smoke = makePS('exp_smoke', 200)
    smoke.emitter = origin.clone() as any
    smoke.createSphereEmitter(1)
    smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
    smoke.emitRate = 60; smoke.manualEmitCount = -1
    smoke.minSize = 0.5; smoke.maxSize = 2.5
    smoke.minLifeTime = 2; smoke.maxLifeTime = 5
    smoke.minEmitPower = 0.3; smoke.maxEmitPower = 1
    smoke.gravity = new Vector3(0, 0.8, 0)
    smoke.color1    = new Color4(0.3, 0.3, 0.3, 0.4)
    smoke.color2    = new Color4(0.2, 0.2, 0.2, 0.2)
    smoke.colorDead = new Color4(0.1, 0.1, 0.1, 0)
    smoke.start()

    setTimeout(() => { fire.dispose(); sparks.dispose(); ring.dispose() }, 2000)
    setTimeout(() => smoke.dispose(), 4000)
  }

  // GRAVITATIONAL FIELD — orbs drawn inward with fading trails
  function particleGravityField(origin: Vector3, radius: number) {
    const attract = makePS('grav', 1200)
    attract.emitter = origin.clone() as any
    attract.createSphereEmitter(radius)
    attract.emitRate = 200
    attract.minSize = 0.08; attract.maxSize = 0.3
    attract.minLifeTime = 1; attract.maxLifeTime = 3
    attract.minEmitPower = -6; attract.maxEmitPower = -1   // negative = inward
    attract.gravity = new Vector3(0, 0, 0)
    attract.color1    = new Color4(0.3, 0.5, 1, 1)
    attract.color2    = new Color4(0.6, 0.2, 1, 1)
    attract.colorDead = new Color4(0.05, 0, 0.2, 0)
    attract.start()

    // Core glow at origin
    const core = makePS('grav_core', 200)
    core.emitter = origin.clone() as any
    core.createSphereEmitter(0.3)
    core.emitRate = 80
    core.minSize = 0.2; core.maxSize = 0.7
    core.minLifeTime = 0.3; core.maxLifeTime = 0.8
    core.minEmitPower = 0.5; core.maxEmitPower = 2
    core.gravity = new Vector3(0, 0, 0)
    core.color1    = new Color4(0.8, 0.4, 1, 1)
    core.color2    = new Color4(0.4, 0.2, 1, 1)
    core.colorDead = new Color4(0.1, 0, 0.3, 0)
    core.start()

    return { attract, core }
  }

  // UPDRAFT — column of rising dust, ash, and glowing embers
  function particleUpdraft(origin: Vector3, radius: number, height: number) {
    // Dust column
    const dust = makePS('updraft_dust', 600)
    dust.emitter = origin.clone() as any
    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD
    ;(dust as any).createCylinderEmitter?.(radius, height, 1, 0) // try cylinder
    if (!(dust as any).createCylinderEmitter) {
      dust.particleEmitterType = new ConeParticleEmitter(radius, Math.PI / 12)
    }
    dust.emitRate = 120
    dust.minSize = 0.3; dust.maxSize = 1.5
    dust.minLifeTime = 1.5; dust.maxLifeTime = 4
    dust.minEmitPower = 2; dust.maxEmitPower = 8
    dust.gravity = new Vector3(0, 3, 0)   // net upward
    dust.direction1 = new Vector3(-0.3, 1, -0.3)
    dust.direction2 = new Vector3(0.3, 3, 0.3)
    dust.color1    = new Color4(0.55, 0.45, 0.35, 0.5)
    dust.color2    = new Color4(0.4, 0.35, 0.28, 0.3)
    dust.colorDead = new Color4(0.2, 0.17, 0.14, 0)
    dust.start()

    // Glowing embers
    const embers = makePS('updraft_embers', 300)
    embers.emitter = origin.clone() as any
    embers.particleEmitterType = new ConeParticleEmitter(radius * 0.5, Math.PI / 8)
    embers.emitRate = 60
    embers.minSize = 0.04; embers.maxSize = 0.14
    embers.minLifeTime = 1; embers.maxLifeTime = 3.5
    embers.minEmitPower = 3; embers.maxEmitPower = 9
    embers.gravity = new Vector3(0, 2, 0)
    embers.color1    = new Color4(1, 0.7, 0.2, 1)
    embers.color2    = new Color4(1, 0.3, 0, 0.8)
    embers.colorDead = new Color4(0.2, 0.05, 0, 0)
    embers.start()

    return { dust, embers }
  }

  // VORTEX — spiraling shard tornado
  function particleVortex(origin: Vector3, radius: number, height: number) {
    // Outer swirl
    const swirl = makePS('vortex_swirl', 1500)
    swirl.emitter = origin.add(new Vector3(0, height / 2, 0)) as any
    swirl.particleEmitterType = new ConeParticleEmitter(radius, Math.PI / 3)
    swirl.emitRate = 300
    swirl.minSize = 0.06; swirl.maxSize = 0.28
    swirl.minLifeTime = 1; swirl.maxLifeTime = 4
    swirl.minEmitPower = 3; swirl.maxEmitPower = 10
    swirl.gravity = new Vector3(0, 2, 0)   // upward in vortex
    swirl.color1    = new Color4(0.2, 0.9, 1, 1)
    swirl.color2    = new Color4(0.6, 0.2, 1, 1)
    swirl.colorDead = new Color4(0, 0.1, 0.3, 0)
    swirl.start()

    // Inner core lightning-like streaks
    const core = makePS('vortex_core', 400)
    core.emitter = origin.add(new Vector3(0, height * 0.2, 0)) as any
    core.particleEmitterType = new ConeParticleEmitter(radius * 0.15, Math.PI / 16)
    core.emitRate = 120
    core.minSize = 0.03; core.maxSize = 0.12
    core.minLifeTime = 0.5; core.maxLifeTime = 1.5
    core.minEmitPower = 5; core.maxEmitPower = 14
    core.gravity = new Vector3(0, 5, 0)
    core.color1    = new Color4(1, 1, 0.8, 1)
    core.color2    = new Color4(0.4, 0.8, 1, 1)
    core.colorDead = new Color4(0, 0.1, 0.2, 0)
    core.start()

    // Debris (tumbling chunks)
    const debris = makePS('vortex_debris', 200)
    debris.emitter = origin.add(new Vector3(0, height * 0.5, 0)) as any
    debris.createSphereEmitter(radius * 0.8)
    debris.blendMode = ParticleSystem.BLENDMODE_STANDARD
    debris.emitRate = 50
    debris.minSize = 0.2; debris.maxSize = 0.7
    debris.minLifeTime = 2; debris.maxLifeTime = 6
    debris.minEmitPower = 2; debris.maxEmitPower = 6
    debris.gravity = new Vector3(0, 1, 0)
    debris.color1    = new Color4(0.5, 0.4, 0.3, 0.9)
    debris.color2    = new Color4(0.4, 0.35, 0.25, 0.7)
    debris.colorDead = new Color4(0.2, 0.15, 0.1, 0)
    debris.start()

    return { swirl, core, debris }
  }

  // ── GUI ──────────────────────────────────────────────────────────────────
  const ui    = AdvancedDynamicTexture.CreateFullscreenUI('ui')
  const panel = new StackPanel('panel')
  panel.width    = '220px'
  panel.adaptHeightToChildren = true
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP
  panel.paddingLeft = '14px'
  panel.paddingTop  = '14px'
  ui.addControl(panel)

  // Bodies counter
  const counter = new TextBlock('counter', 'bodies: 0')
  counter.color = '#c8a84b'; counter.fontSize = 13; counter.resizeToFit = true; counter.paddingBottom = '8px'
  panel.addControl(counter)
  scene.onBeforeRenderObservable.add(() => { counter.text = `bodies: ${plugin.numBodies}` })

  const addCheck = (label: string, val: boolean, cb: (v: boolean) => void) => {
    const chk = new Checkbox('chk')
    chk.width = '18px'; chk.height = '18px'; chk.isChecked = val; chk.color = '#4bffa5'
    chk.onIsCheckedChangedObservable.add(cb)
    const row = Control.AddHeader(chk, label, '190px') as any
    row.width = '100%'; row.height = '36px'; row.color = '#d4d8e8'; row.fontSize = 12
    panel.addControl(row)
  }

  const addBtn = (label: string, fn: () => void) => {
    const btn = Button.CreateSimpleButton('btn', label)
    btn.width = '100%'; btn.height = '38px'; btn.paddingTop = '4px'
    btn.color = '#d4d8e8'; btn.background = '#1e2330'
    btn.fontSize = 12; btn.cornerRadius = 3; btn.thickness = 1
    btn.hoverCursor = 'pointer'
    btn.onPointerEnterObservable.add(() => { btn.background = '#c8a84b'; btn.color = '#000' })
    btn.onPointerOutObservable.add(()   => { btn.background = '#1e2330'; btn.color = '#d4d8e8' })
    btn.onPointerClickObservable.add(fn)
    panel.addControl(btn)
  }

  addCheck('Use Aggregate',   useAggregate, v => { useAggregate = v })
  addCheck('Use Instances',   useInstances, v => { useInstances = v })
  addCheck('Particle Effects', useParticles, v => { useParticles = v })

  // ── Physics event buttons ─────────────────────────────────────────────
  const RADIUS = 8, STRENGTH = 20

  addBtn('Radial Explosion', () => {
    const origins = [new Vector3(-8, 6, 0), new Vector3(0, 0, 0)]
    origins.forEach((origin, i) => {
      setTimeout(() => {
        const event = physicsHelper.applyRadialExplosionImpulse(origin, {
          radius: RADIUS, strength: STRENGTH,
          falloff: PhysicsRadialImpulseFalloff.Linear,
        })
        // Visual debug sphere
        const sph = MeshBuilder.CreateSphere('dbg', { diameter: RADIUS * 2 }, scene)
        sph.position = origin.clone()
        const m = new StandardMaterial('dbgm', scene); m.alpha = 0.18
        m.emissiveColor = new Color3(1, 0.5, 0.1)
        sph.material = m

        if (useParticles) particleExplosion(origin)

        setTimeout(() => { event.dispose(); sph.dispose() }, 1500)
      }, i * 2000 + 1000)
    })
  })

  addBtn('Gravitational Field', () => {
    const origin = new Vector3(0, 6, 10)
    setTimeout(() => {
      const event = physicsHelper.gravitationalField(origin, {
        radius: RADIUS, strength: STRENGTH,
        falloff: PhysicsRadialImpulseFalloff.Linear,
      })
      event.enable()

      const sph = MeshBuilder.CreateSphere('dbg', { diameter: RADIUS * 2 }, scene)
      sph.position = origin.clone()
      const m = new StandardMaterial('dbgm', scene); m.alpha = 0.15
      m.emissiveColor = new Color3(0.4, 0.2, 1)
      sph.material = m

      let psHandles: any = null
      if (useParticles) psHandles = particleGravityField(origin, RADIUS)

      setTimeout(() => {
        event.disable(); event.dispose(); sph.dispose()
        if (psHandles) { psHandles.attract.dispose(); psHandles.core.dispose() }
      }, 3000)
    }, 1000)
  })

  addBtn('Updraft', () => {
    const origin = new Vector3(10, 0, 10)
    const h = 20, r = 12
    setTimeout(() => {
      const event = physicsHelper.updraft(origin, { radius: r, strength: 2, height: h })
      event.enable()

      const cyl = MeshBuilder.CreateCylinder('dbg', { height: h, diameter: r * 2 }, scene)
      cyl.position = origin.add(new Vector3(0, h / 2, 0))
      const m = new StandardMaterial('dbgm', scene); m.alpha = 0.12
      m.emissiveColor = new Color3(0.8, 0.6, 0.2)
      cyl.material = m

      let psHandles: any = null
      if (useParticles) psHandles = particleUpdraft(origin, r, h)

      setTimeout(() => {
        event.disable(); event.dispose(); cyl.dispose()
        if (psHandles) { psHandles.dust.dispose(); psHandles.embers.dispose() }
      }, 2000)
    }, 1000)
  })

  addBtn('Vortex', () => {
    const origin = new Vector3(0, -8, 8)
    const r = 20, h = 30
    setTimeout(() => {
      const event = physicsHelper.vortex(origin, { radius: r, strength: 40, height: h })
      event.enable()

      const cyl = MeshBuilder.CreateCylinder('dbg', { height: h, diameter: r * 2 }, scene)
      cyl.position = origin.add(new Vector3(0, h / 2, 0))
      const m = new StandardMaterial('dbgm', scene); m.alpha = 0.10
      m.emissiveColor = new Color3(0.2, 0.8, 1)
      cyl.material = m

      let psHandles: any = null
      if (useParticles) psHandles = particleVortex(origin, r, h)

      setTimeout(() => {
        event.disable(); event.dispose(); cyl.dispose()
        if (psHandles) {
          psHandles.swirl.dispose(); psHandles.core.dispose(); psHandles.debris.dispose()
        }
      }, 10000)
    }, 1000)
  })

  addBtn('Restart Scene', restartScene)

  engine.runRenderLoop(() => scene.render())
}

main().catch(console.error)
