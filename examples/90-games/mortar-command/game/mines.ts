// game/mines.ts — ported from mines.js
import { MeshBuilder }    from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode }  from '@babylonjs/core/Meshes/transformNode'
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import { Texture }        from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 }        from '@babylonjs/core/Maths/math.vector'
import { Color4 }         from '@babylonjs/core/Maths/math.color'
import type { MCScene, Mine } from './types'
import { POINTS_AGENT_HIT, POINTS_ARTIFACT_HIT } from './constants'
import { getGroundElevation } from './utils'
import { killAgent, killArtifact, updateAgentColor, updateArtifactColor } from './mortars'
import { handleLevelComplete } from './lifecycle'
import { mcAsset } from './tableConstants'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const PROXIMITY_RANGES  = [6, 5, 4, 3]
const MINE_BLAST_DAMAGE  = 3.5
const MINE_BLAST_ALPHA   = 0.8
const MINE_BLAST_LIFE    = 20

const MINE_ZONE_Z = [-9, 0, 9]  // three corridor z positions

function makeMine(name: string, scene: MCScene) {
  const CoT = new TransformNode(`${name}_CoT`, scene)
  const shellXform = new TransformNode(`${name}_mesh_CoT`, scene)
  shellXform.parent = CoT

  const cylinder = MeshBuilder.CreateCylinder(`${name}_cyl`, {
    cap: 3, // BABYLON.Mesh.NO_CAP would be 0, use both caps
    diameter: 1, height: 3,
  }, scene) as Mesh
  cylinder.position.y = 1; cylinder.material = scene.getMaterialByName('mineCoreMat')
  cylinder.parent = shellXform

  const cone = MeshBuilder.CreateCylinder(`${name}_cone`, {
    diameterTop: 0, diameterBottom: 1, height: 1,
  }, scene) as Mesh
  cone.position.y = 3.5; cone.material = scene.getMaterialByName('mineCoreMat')
  cone.parent = shellXform

  // Proximity rings
  const makeRing = (n: string, r: number) => {
    const ring = MeshBuilder.CreateTorus(`${name}_${n}`, { diameter: r * 2, thickness: 0.1, tessellation: 24 }, scene) as Mesh
    ring.material = scene.getMaterialByName('mineRingMat')
    ring.parent = CoT
    return ring
  }
  const ring1 = makeRing('r1', PROXIMITY_RANGES[0])
  const ring2 = makeRing('r2', PROXIMITY_RANGES[1])
  const ring3 = makeRing('r3', PROXIMITY_RANGES[2])

  // Icon
  const icon = MeshBuilder.CreatePlane(`${name}_icon`, { size: 2 }, scene) as Mesh
  icon.position.y = 5; icon.material = scene.getMaterialByName('iconmat_mines')
  icon.billboardMode = 7
  icon.parent = CoT

  // Blast sphere
  const blast = MeshBuilder.CreateSphere(`${name}_blast`, {}, scene) as Mesh
  blast.material = scene.getMaterialByName('mineBlastMat')
  blast.setEnabled(false); blast.parent = CoT

  // Blast particles
  const flare = new Texture(mcAsset('textures/flare.png'), scene)
  const blastParticles = new GPUParticleSystem(`${name}_blast_p`, { capacity: 3000 }, scene)
  const emitter = blastParticles.createHemisphericEmitter(2)
  blastParticles.particleTexture = flare; blastParticles.emitter = CoT as any
  blastParticles.minSize = 0.05; blastParticles.maxSize = 0.4; blastParticles.maxLifeTime = 0.3
  blastParticles.color1    = new Color4(1, .2, 1, 1)
  blastParticles.color2    = new Color4(.5, 0, .5, 1)
  blastParticles.colorDead = new Color4(0.2, 0, 0.2, 0)
  blastParticles.emitRate  = 600; blastParticles.minEmitPower = 2; blastParticles.maxEmitPower = 10

  return { CoT: CoT as any, core: cylinder, shell: shellXform as any, blast, ring1, ring2, ring3, blastParticles, blastEmitter: emitter }
}

export function addMine(scene: MCScene, zone: number): void {
  const name = `mine_${scene.mineCounter++}`
  const m    = makeMine(name, scene)
  const mine: Mine = {
    name, zone, core: m.core, shell: m.shell, blast: m.blast,
    ring1: m.ring1, ring2: m.ring2, ring3: m.ring3,
    blastParticles: m.blastParticles, blastEmitter: m.blastEmitter,
    detonating: false, detonationFrame: 0, blastAge: 0,
    blastLife: MINE_BLAST_LIFE, blastRadiusStart: 1, blastRadiusCurrent: 0,
    blastExpansionVelocity: 0.4,
  }
  scene.mines.push(mine)
}

export function deployMines(scene: MCScene): void {
  const occupied = scene.mines.map(m => m.zone)
  for (let zone = 0; zone < 3; zone++) {
    if (!occupied.includes(zone)) addMine(scene, zone)
  }
  placeMines(scene)
}

export function placeMines(scene: MCScene): void {
  for (const mine of scene.mines) {
    const x = -5 + Math.random() * 10
    const z = MINE_ZONE_Z[mine.zone]
    const y = getGroundElevation(x, z, scene)
    mine.core.parent!.position = new Vector3(x, y, z)
  }
}

export function clearMines(scene: MCScene): void {
  for (const mine of scene.mines) {
    mine.core.parent?.dispose()
    mine.blastParticles.stop()
  }
  scene.mines = []
}

export function updateMines(scene: MCScene): void {
  for (const mine of [...scene.mines]) {
    if (mine.detonating) {
      mine.blastAge = scene.gameFrame - mine.detonationFrame
      if (mine.blastAge > mine.blastLife) {
        destroyMine(mine, scene)
      } else {
        mine.blastRadiusCurrent = mine.blastRadiusStart + mine.blastExpansionVelocity * mine.blastAge
        mine.blast.scaling = new Vector3(mine.blastRadiusCurrent, mine.blastRadiusCurrent, mine.blastRadiusCurrent)
        mine.blast.material!.alpha = MINE_BLAST_ALPHA - (mine.blastAge / mine.blastLife) * MINE_BLAST_ALPHA
        damageAgents(mine, scene)
        damageArtifacts(mine, scene)
      }
    } else {
      let prox = 0
      for (const agent of scene.agents) {
        const range = Vector3.Distance(agent.pos, mine.core.position)
        if      (range < PROXIMITY_RANGES[3]) prox = Math.max(prox, 4)
        else if (range < PROXIMITY_RANGES[2]) prox = Math.max(prox, 3)
        else if (range < PROXIMITY_RANGES[1]) prox = Math.max(prox, 2)
        else if (range < PROXIMITY_RANGES[0]) prox = Math.max(prox, 1)
      }
      updateProximityIndicator(scene, mine, prox)
      if (prox === 4) detonate(scene, mine)
    }
  }
}

function detonate(scene: MCScene, mine: Mine): void {
  scene.getSoundByName?.('mine')?.play()
  mine.detonating = true; mine.detonationFrame = scene.gameFrame
  mine.blastAge = 0; mine.blastRadiusCurrent = mine.blastRadiusStart
  mine.shell.setEnabled(false)
  mine.blast.setEnabled(true)
  mine.blastEmitter.radius = mine.blastRadiusStart
  mine.blastParticles.start()
}

function destroyMine(mine: Mine, scene: MCScene): void {
  mine.core.parent?.dispose()
  mine.blastParticles.stop()
  const idx = scene.mines.indexOf(mine)
  if (idx > -1) scene.mines.splice(idx, 1)
}

function updateProximityIndicator(scene: MCScene, mine: Mine, prox: number): void {
  const unlit = scene.getMaterialByName('mineRingMat')
  const lit   = scene.getMaterialByName('mineRingLitMat')
  mine.ring1.material = prox > 0 ? lit : unlit
  mine.ring2.material = prox > 1 ? lit : unlit
  mine.ring3.material = prox > 2 ? lit : unlit
}

function damageAgents(mine: Mine, scene: MCScene): void {
  for (const agent of [...scene.agents]) {
    const range = Vector3.Distance(agent.pos, mine.core.position)
    const r     = 2 * mine.blastRadiusCurrent
    if (range < r) {
      agent.health -= (r - range) * MINE_BLAST_DAMAGE
      updateAgentColor(agent, scene)
      scene.gameScore    += POINTS_AGENT_HIT
      scene.packagePoints += POINTS_AGENT_HIT
      if (agent.health < 0) {
        killAgent(agent, scene)
        if (scene.agents.length === 0) handleLevelComplete(scene)
      }
    }
  }
}

function damageArtifacts(mine: Mine, scene: MCScene): void {
  for (const artifact of [...scene.artifacts]) {
    if (!artifact.detected) continue
    const range = Vector3.Distance(artifact.pos, mine.core.position)
    if (range < mine.blastRadiusCurrent) {
      artifact.health -= (mine.blastRadiusCurrent - range) * MINE_BLAST_DAMAGE
      updateArtifactColor(artifact, scene)
      scene.gameScore    += POINTS_ARTIFACT_HIT
      scene.packagePoints += POINTS_ARTIFACT_HIT
      if (artifact.health < 0) killArtifact(artifact, scene)
    }
  }
}
