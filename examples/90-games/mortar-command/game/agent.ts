// game/agent.ts — ported from agent.js
import { MeshBuilder }    from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode }  from '@babylonjs/core/Meshes/transformNode'
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import { Texture }        from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 }        from '@babylonjs/core/Maths/math.vector'
import { Color4 }         from '@babylonjs/core/Maths/math.color'
import { Animation }      from '@babylonjs/core/Animations/animation'
import type { MCScene, AgentInfo, Artifact, ArtifactType, Round, ThePackage } from './types'
import {
  AGENT_SIZE, ARTIFACT_SIZE, ARTIFACT_INTERACT_COEFF, ARTIFACT_TYPES,
  ARTIFACT_MAX_HEALTH, AGENT_MAX_HEALTH, MAX_ROUNDS, ROUND_PHASES, ROUND_TYPES,
  AGENT_TRAIL_COLOR1, AGENT_TRAIL_COLOR2, AGENT_TRAIL_COLOR_DEAD, phases, edge,
} from './constants'
import { getGroundElevation, randomRotation } from './utils'
import { roundParticlecolors, blastParticlesProps } from './materials'
import { mcAsset } from './tableConstants'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

// ── Agent factory ──────────────────────────────────────────────────────────
function makeAgent(name: string, scene: MCScene) {
  const CoT = new TransformNode(name, scene)

  // Tri-pyramid shaped mesh (polyhedron type 0)
  const agentMesh = MeshBuilder.CreatePolyhedron(`${name}_mesh`,
    { type: 0, size: AGENT_SIZE * 0.5 }, scene) as Mesh
  agentMesh.material = scene.getMaterialByName('agentMat')
  agentMesh.parent = CoT

  // cargo indicator sphere
  const cargo = MeshBuilder.CreateSphere(`${name}_cargo`, { diameter: 0.5 }, scene) as Mesh
  cargo.position.y = 1.5
  cargo.material = scene.getMaterialByName('artifactCoreMat')
  cargo.isVisible = false
  cargo.parent = CoT

  // Particle trail
  const flare = new Texture(mcAsset('textures/flare.png'), scene)
  const particles = new GPUParticleSystem(`${name}_trail`, { capacity: 600 }, scene)
  particles.createPointEmitter(new Vector3(-.5, -.2, 0), new Vector3(.5, .2, 0))
  particles.particleTexture = flare
  particles.emitter = CoT as any
  particles.minSize = 0.05; particles.maxSize = 0.15
  particles.maxLifeTime = 0.3
  particles.color1    = new Color4(...AGENT_TRAIL_COLOR1   as [number,number,number,number])
  particles.color2    = new Color4(...AGENT_TRAIL_COLOR2   as [number,number,number,number])
  particles.colorDead = new Color4(...AGENT_TRAIL_COLOR_DEAD as [number,number,number,number])
  particles.emitRate  = 80
  particles.minEmitPower = 0.5; particles.maxEmitPower = 2
  particles.preWarmCycles = 20; particles.preWarmStepOffset = 5
  particles.start()

  return { body: CoT, mesh: agentMesh, particles, cargo }
}

export function addAgent(scene: MCScene): void {
  const id   = scene.agents.length
  const name = `agent_${id}`
  const meshes = makeAgent(name, scene)

  // Random spawn along the left edge (xMin side)
  const x = -22 + Math.random() * 4
  const z = -12 + Math.random() * 24
  const y = getGroundElevation(x, z, scene)
  meshes.body.position = new Vector3(x, y + 0.5, z)

  const agent: AgentInfo = {
    name, pos: meshes.body.position,
    heading: 90 + (Math.random() * 60 - 30), // roughly facing +x (toward stations)
    norm: new Vector3(0, 1, 0),
    phase: phases.SEEK_ARTIFACT_ZONE,
    nearEdge: edge.NONE,
    steer: { left: 0, right: 0, straight: 0 },
    gridTargetIdx: 0,
    hotGrid: Array(36).fill(0),
    targetSelected: false,
    targetName: 'none',
    artifactCollected: false,
    payloadMass: 0,
    meshes: meshes as any,
    health: AGENT_MAX_HEALTH,
    particles: meshes.particles,
  }
  scene.agents.push(agent)
}

export function destroyAgent(agent: AgentInfo, scene: MCScene): void {
  agent.meshes.body.dispose()
  agent.particles.stop()
  agent.particles.dispose()
  const idx = scene.agents.indexOf(agent)
  if (idx > -1) scene.agents.splice(idx, 1)
  scene.agentsDestroyed = (scene.agentsDestroyed ?? 0) + 1
  scene.getSoundByName?.('agent-destroyed')?.play()
}

// ── Artifact factory ───────────────────────────────────────────────────────
function makeArtifact(name: string, size: number, scene: MCScene) {
  const coreSize  = size * ARTIFACT_SIZE
  const core      = MeshBuilder.CreatePolyhedron(`${name}_core`, { type: 2, size: coreSize }, scene) as Mesh
  core.rotationQuaternion = randomRotation()
  core.material           = scene.getMaterialByName('artifactCoreMat')

  const shellRadius = coreSize * ARTIFACT_INTERACT_COEFF
  const shell       = MeshBuilder.CreateIcoSphere(`${name}_shell`, { radius: shellRadius, subdivisions: 4 }, scene) as Mesh
  shell.material    = scene.getMaterialByName('artifactShellMat')
  shell.addChild(core)
  return { core, shell, shellRadius }
}

export function addArtifact(scene: MCScene, type?: ArtifactType, position?: Vector3): void {
  const name = `artifact_${scene.nextArtifactId++}`
  if (!type) {
    const r = Math.random() * 100
    type = r < 20 ? ARTIFACT_TYPES.small : r > 80 ? ARTIFACT_TYPES.large : ARTIFACT_TYPES.medium
  }
  const meshes = makeArtifact(name, type.scale, scene)
  meshes.shell.position = position ?? generateArtifactPosition(scene)

  const artifact: Artifact = {
    name, type, pos: meshes.shell.position,
    meshes: { core: meshes.core, shell: meshes.shell },
    interactRadius: meshes.shellRadius, detected: false, health: ARTIFACT_MAX_HEALTH,
  }
  setArtifactDetected(artifact, false)
  scene.artifacts.push(artifact)
}

export function setArtifactDetected(artifact: Artifact, detected: boolean): void {
  artifact.detected          = detected
  artifact.meshes.shell.isVisible = detected
  artifact.meshes.core.isVisible  = detected
}

function generateArtifactPosition(scene: MCScene): Vector3 {
  const { xMin, xMax, zMin, zMax } = { xMin:-22.55, xMax:-14.55, zMin:-11.5, zMax:11.5 }
  const x = xMin + (xMax - xMin) * Math.random()
  const z = zMin + (zMax - zMin) * Math.random()
  const y = getGroundElevation(x, z, scene)
  return new Vector3(x, y, z)
}

// ── Rounds / Projectiles ───────────────────────────────────────────────────
function makeRound(name: string, scene: MCScene) {
  const CoT          = new TransformNode(name, scene)
  const flare        = new Texture(mcAsset('textures/flare.png'), scene)

  const mortar = MeshBuilder.CreateSphere(`${name}_mortar`, {}, scene) as Mesh
  mortar.material = scene.getMaterialByName('mortarMat')
  mortar.scaling  = new Vector3(.3, .3, .3)
  mortar.setEnabled(false); mortar.parent = CoT

  const bullet = MeshBuilder.CreateCylinder(`${name}_bullet`, {}, scene) as Mesh
  bullet.scaling  = new Vector3(.05, .6, .05)
  bullet.material = scene.getMaterialByName('bulletMat')
  bullet.setEnabled(false); bullet.parent = CoT

  const blast = MeshBuilder.CreateSphere(`${name}_blast`, {}, scene) as Mesh
  blast.material = scene.getMaterialByName('blastMat')
  blast.setEnabled(false); blast.parent = CoT

  const particleOrigin = new TransformNode(`${name}_pOrigin`, scene)
  particleOrigin.parent = CoT; particleOrigin.position.y = 0

  const particles = new GPUParticleSystem(`${name}_trail`, { capacity: 800 }, scene)
  particles.createPointEmitter(new Vector3(1, -.5, 0), new Vector3(1, .5, 0))
  particles.particleTexture = flare; particles.emitter = particleOrigin as any
  particles.minSize = 0.01; particles.maxSize = 0.06
  particles.maxLifeTime = .001; particles.color1 = roundParticlecolors.particles_color1
  particles.color2 = roundParticlecolors.particles_color2
  particles.colorDead = roundParticlecolors.particles_colorDead
  particles.emitRate = 100; particles.minEmitPower = 1; particles.maxEmitPower = 4
  particles.preWarmCycles = 100; particles.preWarmStepOffset = 5

  const blastParticles = new GPUParticleSystem(`${name}_blast_p`, { capacity: 2000 }, scene)
  blastParticles.createHemisphericEmitter(1)
  blastParticles.particleTexture = flare; blastParticles.emitter = particleOrigin as any
  blastParticles.minSize = blastParticlesProps.minSize; blastParticles.maxSize = blastParticlesProps.maxSize
  blastParticles.maxLifeTime = blastParticlesProps.maxLifeTime
  blastParticles.color1 = blastParticlesProps.color1; blastParticles.color2 = blastParticlesProps.color2
  blastParticles.colorDead = blastParticlesProps.colorDead; blastParticles.emitRate = blastParticlesProps.emitRate
  blastParticles.minEmitPower = blastParticlesProps.minEmitPower; blastParticles.maxEmitPower = blastParticlesProps.maxEmitPower
  blastParticles.preWarmCycles = 100; blastParticles.preWarmStepOffset = 5

  return { body: CoT, mortar, bullet, blast, particles, blastParticles, particleOrigin }
}

export function addRound(scene: MCScene): void {
  const name   = `round_${scene.rounds.length}`
  const meshes = makeRound(name, scene)
  const round: Round = {
    name, type: ROUND_TYPES.mortar, phase: ROUND_PHASES.ready,
    pos: new Vector3(0, 0, 0), trajectory: { heading:0, y0:0, vy:0, g:0, t:0, gunYinc:0 },
    meshes: meshes as any, blastLife: 10, blastAge: 0,
    blastRadiusStart: 1, blastRadiusCurrent: 0, blastExpansionVelocity: 0.3,
    detonationFrame: 0, target: null,
  }
  scene.rounds.push(round)
}

// ── The Package ──────────────────────────────────────────────────────────
export function addThePackage(scene: MCScene): void {
  const name  = 'thePackage'
  const CoT   = new TransformNode(name, scene)
  const flare = new Texture(mcAsset('textures/flare.png'), scene)
  const mat   = scene.getMaterialByName('packageMat')

  const pkg = MeshBuilder.CreatePolyhedron(`${name}_mesh`, { type: 4, size: 0.35 }, scene) as Mesh
  pkg.material = mat; pkg.parent = CoT

  const blast = MeshBuilder.CreateSphere(`${name}_blast`, {}, scene) as Mesh
  blast.material = scene.getMaterialByName('blastMat')
  blast.setEnabled(false); blast.parent = CoT

  const particleOrigin = new TransformNode(`${name}_pOrigin`, scene)
  particleOrigin.parent = CoT

  const blastParticles = new GPUParticleSystem(`${name}_blast_p`, { capacity: 10000 }, scene)
  const emitter = blastParticles.createHemisphericEmitter(3)
  blastParticles.particleTexture = flare; blastParticles.emitter = particleOrigin as any
  blastParticles.minSize = 0.1; blastParticles.maxSize = 0.5; blastParticles.maxLifeTime = .1
  blastParticles.color1    = new Color4(1, .2, .2, 1)
  blastParticles.color2    = new Color4(.8, .8, .3, 1)
  blastParticles.colorDead = new Color4(0.1, 0, 0.1, 0)
  blastParticles.emitRate  = 1300; blastParticles.minEmitPower = 5; blastParticles.maxEmitPower = 16
  blastParticles.preWarmCycles = 100; blastParticles.preWarmStepOffset = 5

  const tp: ThePackage = {
    meshes: { body: CoT, package: pkg, blast, blastParticles, blastEmitter: emitter, particleOrigin, target: null },
    phase: ROUND_PHASES.ready, pos: new Vector3(0, 0, 0),
    trajectory: { heading:0, y0:0, vy:0, g:0, t:0, gunYinc:0 },
    blastLife: 40, blastAge: 0, blastRadiusStart: 2, blastRadiusCurrent: 0,
    blastExpansionVelocity: 0.5, detonationFrame: 0, loaded: false,
  }
  scene.thePackage = tp
}
