// game/activators.ts — ported from activators.js
import { MeshBuilder }    from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode }  from '@babylonjs/core/Meshes/transformNode'
import { Vector3 }        from '@babylonjs/core/Maths/math.vector'
import { Color3 }         from '@babylonjs/core/Maths/math.color'
import { ActionManager, ExecuteCodeAction } from '@babylonjs/core/Actions'
import type { MCScene, Activator } from './types'
import { getGroundElevation } from './utils'
import { deployMines } from './mines'
import { repairOneStation } from './station'
import {
  roundParticlecolors, roundParticlecolorsBoost,
  blastParticlesProps, blastParticlesPropsBoost,
} from './materials'
import { MORTAR_BOOST_LIFE } from './constants'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const HOLO_ALPHA_MAX  = 0.25
const MAX_AGE         = 1500
const START_FADE_AGE  = 500
const FUSE_TRIGGER    = 64
const SCORE_INCREMENT = 300

function pickActivatorType(scene: MCScene): string {
  if (scene.liveStations === 1) return 'health'
  const types: string[] = []
  if (scene.mines.length < 3) types.push('mine')
  if (!scene.mortarBoost) types.push('bolt')
  if (types.length === 0) return 'none'
  for (const a of scene.activators) {
    const idx = types.indexOf(a.type)
    if (idx > -1) types.splice(idx, 1)
  }
  if (types.length === 0) return 'none'
  return types[Math.floor(Math.random() * types.length)]
}

export function activatorChance(scene: MCScene): void {
  if (scene.activator_score_thresh_set) {
    if (scene.gameScore - scene.activator_last_score > scene.activator_score_thresh) {
      const t = pickActivatorType(scene)
      if (t !== 'none') addActivator(scene, t as any)
      scene.activator_score_thresh_set = false
    }
  } else {
    scene.activator_score_thresh = SCORE_INCREMENT + Math.random() * 3000
    scene.activator_score_thresh_set = true
    scene.activator_last_score = scene.gameScore
  }
}

export function activator_aging(activator: Activator, scene: MCScene): void {
  activator.age++
  if (activator.age > MAX_AGE) destroy_activator(activator, scene)
  else if (activator.age > START_FADE_AGE) {
    const holo = scene.getMaterialByName('holomat')
    if (holo) holo.alpha = HOLO_ALPHA_MAX * (1 - (activator.age - START_FADE_AGE) / (MAX_AGE - START_FADE_AGE))
  }
}

export function updateActivatorColor(activator: Activator, scene: MCScene): void {
  const old = activator.fuselevel
  const f = activator.fusecount
  const l2 = FUSE_TRIGGER * (2/3), l1 = FUSE_TRIGGER * (1/3)
  if (f > l2) { activator.fusecone.material = scene.getMaterialByName('activatorbaseconemat_4'); activator.fuselevel = 3 }
  else if (f > l1) { activator.fusecone.material = scene.getMaterialByName('activatorbaseconemat_3'); activator.fuselevel = 2 }
  else if (f > 0) { activator.fusecone.material = scene.getMaterialByName('activatorbaseconemat_2'); activator.fuselevel = 1 }
  if (activator.fuselevel > old) scene.getSoundByName?.('activatorHit')?.play()
}

export function activator_activate(activator: Activator, scene: MCScene): void {
  switch (activator.type) {
    case 'mine':   deployMines(scene); break
    case 'health': repairOneStation(scene); break
    case 'bolt':   enableMortarBoost(scene); break
  }
  scene.getSoundByName?.('activatorPowerUp')?.play()
  destroy_activator(activator, scene)
}

function destroy_activator(activator: Activator, scene: MCScene): void {
  activator.CoT.dispose()
  const idx = scene.activators.indexOf(activator)
  if (idx > -1) scene.activators.splice(idx, 1)
  scene.getSoundByName?.('power-off')?.play()
}

export function clearActivators(scene: MCScene): void {
  for (const a of [...scene.activators]) destroy_activator(a, scene)
}

function enableMortarBoost(scene: MCScene): void {
  scene.mortarBoost = true; scene.mortarBoostFrame = scene.gameFrame
  scene.getMaterialByName('mortarMat')?.diffuseColor && (scene.getMaterialByName('mortarMat') as any).diffuseColor.set(.2, .7, .2)
  const bmat = scene.getMaterialByName('bulletMat') as any
  if (bmat) { bmat.diffuseColor = new Color3(0,1,0); bmat.emissiveColor = new Color3(0,1,0) }
  for (const r of scene.rounds) {
    r.meshes.particles.color1 = roundParticlecolorsBoost.particles_color1
    r.meshes.particles.color2 = roundParticlecolorsBoost.particles_color2
    r.meshes.particles.colorDead = roundParticlecolorsBoost.particles_colorDead
    r.meshes.bullet.scaling = new Vector3(0.08, 0.9, 0.08)
    r.meshes.blastParticles.color1 = blastParticlesPropsBoost.color1
    r.meshes.blastParticles.color2 = blastParticlesPropsBoost.color2
    r.meshes.blastParticles.colorDead = blastParticlesPropsBoost.colorDead
    r.meshes.blastParticles.emitRate = blastParticlesPropsBoost.emitRate
    r.meshes.blastParticles.minEmitPower = blastParticlesPropsBoost.minEmitPower
    r.meshes.blastParticles.maxEmitPower = blastParticlesPropsBoost.maxEmitPower
  }
  scene.BLAST_DAMAGE_COEFF = 9
}

export function disableMortarBoost(scene: MCScene): void {
  scene.mortarBoost = false
  const mm = scene.getMaterialByName('mortarMat') as any
  if (mm) mm.diffuseColor = new Color3(1,1,1)
  const bmat = scene.getMaterialByName('bulletMat') as any
  if (bmat) { bmat.diffuseColor = new Color3(1,1,1); bmat.emissiveColor = new Color3(1,1,1) }
  for (const r of scene.rounds) {
    r.meshes.particles.color1 = roundParticlecolors.particles_color1
    r.meshes.particles.color2 = roundParticlecolors.particles_color2
    r.meshes.particles.colorDead = roundParticlecolors.particles_colorDead
    r.meshes.bullet.scaling = new Vector3(0.05, 0.6, 0.05)
    r.meshes.blastParticles.color1 = blastParticlesProps.color1
    r.meshes.blastParticles.color2 = blastParticlesProps.color2
    r.meshes.blastParticles.colorDead = blastParticlesProps.colorDead
    r.meshes.blastParticles.emitRate = blastParticlesProps.emitRate
    r.meshes.blastParticles.minEmitPower = blastParticlesProps.minEmitPower
    r.meshes.blastParticles.maxEmitPower = blastParticlesProps.maxEmitPower
  }
  scene.BLAST_DAMAGE_COEFF = 3
}

export function addActivator(scene: MCScene, type: 'mine' | 'health' | 'bolt'): void {
  const name = `activator_${scene.activatorCounter++}`
  const CoT  = new TransformNode(`${name}_CoT`, scene)
  const xform = new TransformNode(`${name}_xform`, scene)
  xform.parent = CoT; xform.position.y = .8; xform.rotation.y = 1.571
  xform.scaling = new Vector3(.8, .8, .8)

  const rotator = new TransformNode(`${name}_rotator`, scene)
  rotator.parent = xform

  const holo = MeshBuilder.CreatePolyhedron(`${name}_holo`, { type: 7, size: 1 }, scene) as Mesh
  holo.material = scene.getMaterialByName('holomat')
  holo.parent = rotator

  const pedestal = MeshBuilder.CreateCylinder(`${name}_pedestal`,
    { diameterTop: 0, tessellation: 16, height: .8 }, scene) as Mesh
  pedestal.material = scene.getMaterialByName('activatorbasemat')
  pedestal.position.y = -.4; pedestal.parent = CoT

  const fusecone = MeshBuilder.CreateCylinder(`${name}_fusecone`,
    { diameterTop: 0, diameterBottom: .5, height: .5, tessellation: 16 }, scene) as Mesh
  fusecone.material = scene.getMaterialByName('activatorbaseconemat_1')
  fusecone.parent = pedestal

  // Random position on the field
  const x = -20 + Math.random() * 40
  const z = -12 + Math.random() * 24
  const y = getGroundElevation(x, z, scene)
  CoT.position = new Vector3(x, y, z)

  // Action manager to detect click on pedestal (shoot-to-activate)
  pedestal.actionManager = new ActionManager(scene)
  pedestal.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      act.fusecount++
      updateActivatorColor(act, scene)
      if (act.fusecount >= FUSE_TRIGGER) activator_activate(act, scene)
    }),
  )

  const act: Activator = {
    name, type, CoT, rotator, fusecone, pedestal,
    fusecount: 0, fuselevel: 0, age: 0,
    pos: CoT.position,
    mesh: holo,
  }
  scene.activators.push(act)
  scene.getSoundByName?.('newActivator')?.play()
}
