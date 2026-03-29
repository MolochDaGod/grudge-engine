// game/mortars.ts — ported from mortars.js
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector'
import { Ray } from '@babylonjs/core/Culling/ray'
import { Color3 }               from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }          from '@babylonjs/core/Meshes/meshBuilder'
import type { MCScene, Round, AgentInfo, Artifact } from './types'
import {
  MORTAR_VELOCITY, GUN_VELOCITY, PACKAGE_VELOCITY,
  ROUND_PHASES, ROUND_TYPES, ROUND_EXTENTS,
  GUN_POSITION, GUN_RANGE, BLAST_ALPHA,
  MORTAR_BLAST_RADIUS_START, MORTAR_BLAST_LIFE,
  GUN_BLAST_RADIUS_START, GUN_BLAST_LIFE,
  POINTS_AGENT_HIT, POINTS_ARTIFACT_HIT, GAME_PHASES,
} from './constants'
import { TERRAIN_MESH_NAME, CHANGE_LIGHT_ON_BLAST, MORTAR_YPEAK, mcAsset } from './tableConstants'
import { getGroundElevation, getGroundRange } from './utils'
import { getAgentMat } from './materials'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { handleLevelComplete } from './lifecycle'

// ── Keyboard fire listener ────────────────────────────────────────────────
export function addFireListener(scene: MCScene): void {
  window.addEventListener('keydown', (e) => {
    if (e.which === 90 || e.which === 77 || e.which === 81) fireRound(scene, ROUND_TYPES.mortar)
    else if (e.which === 32) fireThePackage(scene)
  })
}

function getReadyRound(scene: MCScene) {
  return scene.rounds.find(r => r.phase === ROUND_PHASES.ready)
}

function fireRound(scene: MCScene, type: string): void {
  const round = getReadyRound(scene)
  if (!round || !scene.mortarTarget) return

  const target = scene.mortarTarget
  const gunPos = new Vector3(GUN_POSITION.x, GUN_POSITION.y, GUN_POSITION.z)
  const dx = target.x - gunPos.x
  const dz = target.z - gunPos.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  if (type === ROUND_TYPES.gun && dist > GUN_RANGE) return

  round.type  = type as any
  round.phase = ROUND_PHASES.launched
  round.pos   = gunPos.clone()
  round.trajectory.heading = Math.atan2(dz, dx) * (180 / Math.PI)
  round.trajectory.t       = 0

  if (type === ROUND_TYPES.mortar) {
    const g   = -9.8
    const t   = dist / MORTAR_VELOCITY
    round.trajectory.y0 = gunPos.y
    round.trajectory.vy = (target.y - gunPos.y - 0.5 * g * t * t) / t
    round.trajectory.g  = g
    round.meshes.mortar.setEnabled(true)
    round.meshes.bullet.setEnabled(false)
    scene.getSoundByName?.('mortar')?.play()
  } else {
    const yDiff = target.y - gunPos.y
    round.trajectory.gunYinc = yDiff / (dist / GUN_VELOCITY)
    round.meshes.mortar.setEnabled(false)
    round.meshes.bullet.setEnabled(true)
    scene.getSoundByName?.('gun')?.play()
  }

  round.meshes.particles.start()
}

function fireThePackage(scene: MCScene): void {
  const tp = scene.thePackage
  if (!tp.loaded || tp.phase !== ROUND_PHASES.ready || !scene.mortarTarget) return

  const target = scene.mortarTarget
  const gunPos = new Vector3(GUN_POSITION.x, GUN_POSITION.y, GUN_POSITION.z)
  const dx = target.x - gunPos.x
  const dz = target.z - gunPos.z
  const dist = Math.sqrt(dx * dx + dz * dz)
  const g = -9.8
  const t = dist / PACKAGE_VELOCITY

  tp.phase = ROUND_PHASES.launched
  tp.pos   = gunPos.clone()
  tp.trajectory.heading = Math.atan2(dz, dx) * (180 / Math.PI)
  tp.trajectory.t   = 0
  tp.trajectory.y0  = gunPos.y
  tp.trajectory.vy  = (target.y - gunPos.y - 0.5 * g * t * t) / t
  tp.trajectory.g   = g
  tp.meshes.package.setEnabled(true)
  scene.getSoundByName?.('heavyMortar')?.play()
}

// ── Hit detection helpers ─────────────────────────────────────────────────
export function updateAgentColor(agent: AgentInfo, scene: MCScene): void {
  agent.meshes.mesh.material = getAgentMat(scene, agent.health)
}

export function updateArtifactColor(artifact: Artifact, scene: MCScene): void {
  const pct = artifact.health / 20
  if (pct > 0.66) artifact.meshes.core.material = scene.getMaterialByName('damageMinorMat')
  else if (pct > 0.33) artifact.meshes.core.material = scene.getMaterialByName('damageMajorMat')
  else artifact.meshes.core.material = scene.getMaterialByName('damageCriticalMat')
}

export function killAgent(agent: AgentInfo, scene: MCScene): void {
  scene.gameScore    += POINTS_AGENT_HIT
  scene.packagePoints += POINTS_AGENT_HIT
  agent.meshes.body.dispose()
  agent.particles.stop(); agent.particles.dispose()
  const idx = scene.agents.indexOf(agent)
  if (idx > -1) scene.agents.splice(idx, 1)
  scene.getSoundByName?.('agent-destroyed')?.play()
  scene.onUpdateGUI?.()
}

export function killArtifact(artifact: Artifact, scene: MCScene): void {
  scene.gameScore    += POINTS_ARTIFACT_HIT
  scene.packagePoints += POINTS_ARTIFACT_HIT
  artifact.meshes.shell.dispose()
  const idx = scene.artifacts.indexOf(artifact)
  if (idx > -1) scene.artifacts.splice(idx, 1)
}

// ── Ground collision check ────────────────────────────────────────────────
function hasHitGround(pos: Vector3, scene: MCScene): boolean {
  if (pos.y > 5) return false
  if (pos.x > ROUND_EXTENTS.xMax || pos.x < ROUND_EXTENTS.xMin ||
      pos.z > ROUND_EXTENTS.zMax || pos.z < ROUND_EXTENTS.zMin || pos.y < 0) return true

  const terrainMesh = scene.getMeshByName(TERRAIN_MESH_NAME)
  if (!terrainMesh) return false
  const ray = new Ray(
    new Vector3(pos.x, terrainMesh.getBoundingInfo().boundingBox.maximumWorld.y + 1, pos.z),
    new Vector3(0, -1, 0),
  )
  const worldInverse = new Matrix()
  terrainMesh.getWorldMatrix().invertToRef(worldInverse)
  const localRay = Ray.Transform(ray, worldInverse)
  const pick = terrainMesh.intersects(localRay)
  if (pick.hit && pos.y - pick.pickedPoint!.y < 0.01) return true
  return false
}

// ── Damage check on detonation ────────────────────────────────────────────
function damageAgentsInBlast(blastPos: Vector3, radius: number, scene: MCScene): void {
  for (const agent of [...scene.agents]) {
    const dist = Vector3.Distance(agent.pos, blastPos)
    if (dist < radius) {
      agent.health -= (radius - dist) * scene.BLAST_DAMAGE_COEFF
      updateAgentColor(agent, scene)
      if (agent.health < 0) {
        killAgent(agent, scene)
        if (scene.agents.length === 0) handleLevelComplete(scene)
      }
    }
  }
  for (const artifact of [...scene.artifacts]) {
    const dist = Vector3.Distance(artifact.pos, blastPos)
    if (dist < radius) {
      artifact.health -= (radius - dist) * scene.BLAST_DAMAGE_COEFF
      updateArtifactColor(artifact, scene)
      if (artifact.health < 0) killArtifact(artifact, scene)
    }
  }
}

// ── Per-frame round update ────────────────────────────────────────────────
export function updateRounds(scene: MCScene): void {
  for (const round of scene.rounds) {
    if (round.phase === ROUND_PHASES.ready) continue

    if (round.phase === ROUND_PHASES.detonated) {
      round.blastAge = scene.gameFrame - round.detonationFrame
      if (round.blastAge > round.blastLife) {
        if (CHANGE_LIGHT_ON_BLAST) scene.getLightByName?.('light1')?.diffuse && (scene.getLightByName('light1')!.diffuse = Color3.White())
        round.phase = ROUND_PHASES.ready
        round.pos   = new Vector3(0, 0, 0)
        round.meshes.body.position = round.pos
        round.blastRadiusCurrent = 0
        round.target?.dispose(); round.target = null
        round.meshes.blast.setEnabled(false)
        round.meshes.blastParticles.stop()
        round.meshes.particles.stop()
      } else {
        round.blastRadiusCurrent = round.blastRadiusStart + round.blastExpansionVelocity * round.blastAge
        round.meshes.blast.scaling = new Vector3(round.blastRadiusCurrent, round.blastRadiusCurrent, round.blastRadiusCurrent)
        round.meshes.blast.material!.alpha = BLAST_ALPHA - (round.blastAge / round.blastLife) * BLAST_ALPHA
        damageAgentsInBlast(round.pos, round.blastRadiusCurrent, scene)
      }
      continue
    }

    // launched
    const t = ++round.trajectory.t
    const hvecx = Math.cos(round.trajectory.heading * Math.PI / 180)
    const hvecz = Math.sin(round.trajectory.heading * Math.PI / 180)

    if (round.type === ROUND_TYPES.mortar) {
      round.pos.y = round.trajectory.y0 + round.trajectory.vy * t + 0.5 * round.trajectory.g * t * t
      round.pos.x += hvecx * MORTAR_VELOCITY
      round.pos.z += hvecz * MORTAR_VELOCITY
    } else {
      round.pos.y -= round.trajectory.gunYinc
      round.pos.x += hvecx * GUN_VELOCITY
      round.pos.z += hvecz * GUN_VELOCITY
    }
    round.meshes.body.position = round.pos

    if (hasHitGround(round.pos, scene)) {
      if (CHANGE_LIGHT_ON_BLAST) {
        const light = scene.getLightByName('light1')
        if (light) light.diffuse = new Color3(1, .8, .8)
      }
      scene.getSoundByName?.(round.type === ROUND_TYPES.mortar ? 'mortarHit' : 'gunhit')?.play()
      round.phase = ROUND_PHASES.detonated
      round.detonationFrame = scene.gameFrame
      round.blastAge = 0
      round.blastRadiusCurrent = round.blastRadiusStart
      round.meshes.mortar.setEnabled(false)
      round.meshes.bullet.setEnabled(false)
      round.meshes.blast.setEnabled(true)
      round.meshes.blastParticles.start()

      // Reticle marker at hit point
      if (round.target) round.target.dispose()
      round.target = MeshBuilder.CreateDisc(`target_${Date.now()}`, { radius: round.blastRadiusStart }, scene) as Mesh
      round.target.position = round.pos.clone(); round.target.position.y += 0.05
      round.target.rotation.x = Math.PI / 2
      round.target.material = scene.getMaterialByName('reticleMat')
      scene.fireTargets.push(round.target)
    }
  }
}

// ── Package per-frame update ──────────────────────────────────────────────
export function updateThePackage(scene: MCScene): void {
  const tp = scene.thePackage
  if (tp.phase === ROUND_PHASES.ready) return

  if (tp.phase === ROUND_PHASES.detonated) {
    tp.blastAge = scene.gameFrame - tp.detonationFrame
    if (tp.blastAge > tp.blastLife) {
      if (CHANGE_LIGHT_ON_BLAST) {
        const light = scene.getLightByName('light1')
        if (light) light.diffuse = Color3.White()
      }
      tp.blastAge = 0; tp.phase = ROUND_PHASES.ready
      tp.pos = new Vector3(0, 0, 0); tp.meshes.body.position = tp.pos
      tp.blastRadiusCurrent = 0
      tp.meshes.target?.dispose(); tp.meshes.target = null
      tp.meshes.blast.setEnabled(false)
      tp.meshes.blastParticles.stop()
    } else {
      tp.blastRadiusCurrent = tp.blastRadiusStart + tp.blastExpansionVelocity * tp.blastAge
      tp.meshes.blastEmitter.radius = tp.blastRadiusCurrent
      tp.meshes.blast.scaling = new Vector3(tp.blastRadiusCurrent, tp.blastRadiusCurrent, tp.blastRadiusCurrent)
      tp.meshes.blast.material!.alpha = BLAST_ALPHA - (tp.blastAge / tp.blastLife) * BLAST_ALPHA
      damageAgentsInBlast(tp.pos, tp.blastRadiusCurrent * 2, scene)
    }
    return
  }

  // launched
  const t = ++tp.trajectory.t
  const hvecx = Math.cos(tp.trajectory.heading * Math.PI / 180)
  const hvecz = Math.sin(tp.trajectory.heading * Math.PI / 180)
  tp.pos.y = tp.trajectory.y0 + tp.trajectory.vy * t + 0.5 * tp.trajectory.g * t * t
  tp.pos.x += hvecx * PACKAGE_VELOCITY
  tp.pos.z += hvecz * PACKAGE_VELOCITY
  tp.meshes.body.position = tp.pos
  tp.meshes.package.rotation.z -= .08

  if (hasHitGround(tp.pos, scene)) {
    if (CHANGE_LIGHT_ON_BLAST) {
      const light = scene.getLightByName('light1')
      if (light) light.diffuse = new Color3(1, .8, .8)
    }
    scene.getSoundByName?.('heavyMortar')?.play()
    tp.phase = ROUND_PHASES.detonated; tp.detonationFrame = scene.gameFrame
    tp.blastAge = 0; tp.blastRadiusCurrent = tp.blastRadiusStart
    tp.meshes.package.setEnabled(false)
    tp.meshes.blast.setEnabled(true)
    tp.meshes.blastEmitter.radius = tp.blastRadiusStart
    tp.meshes.blastParticles.start()
  }
}
