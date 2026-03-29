// game/types.ts  — shared interfaces used across all game modules
import type { Scene }           from '@babylonjs/core/scene'
import type { AbstractMesh }    from '@babylonjs/core/Meshes/abstractMesh'
import type { TransformNode }   from '@babylonjs/core/Meshes/transformNode'
import type { Mesh }            from '@babylonjs/core/Meshes/mesh'
import type { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import type { ParticleSystem }  from '@babylonjs/core/Particles/particleSystem'
import type { Vector3 }         from '@babylonjs/core/Maths/math.vector'
import type { Phase, Edge, RoundPhase, RoundType, GamePhase } from './constants'

// ── Agent ────────────────────────────────────────────────────────────────────
export interface AgentMeshes {
  body:       TransformNode
  mesh:       AbstractMesh
  particles:  GPUParticleSystem
  cargo:      Mesh
}

export interface AgentInfo {
  name:             string
  pos:              Vector3
  heading:          number
  norm:             Vector3
  phase:            Phase
  nearEdge:         Edge
  steer:            { left:number; right:number; straight:number }
  gridTargetIdx:    number
  hotGrid:          number[]
  targetSelected:   boolean
  targetName:       string
  artifactCollected: boolean
  payloadMass:      number
  meshes:           AgentMeshes
  health:           number
  particles:        GPUParticleSystem
}

// ── Artifact ─────────────────────────────────────────────────────────────────
export interface ArtifactType { mass: number; scale: number }
export interface ArtifactMeshes { core: Mesh; shell: Mesh; }
export interface Artifact {
  name:          string
  type:          ArtifactType
  pos:           Vector3
  meshes:        ArtifactMeshes
  interactRadius: number
  detected:      boolean
  health:        number
}

// ── Power station ────────────────────────────────────────────────────────────
export interface PowerStation {
  name:        string
  id:          number
  pos:         Vector3
  mesh:        TransformNode
  shell:       Mesh
  innerCore:   Mesh
  pylons:      Mesh[]
  particles:   GPUParticleSystem | null
  health:      number
  interactRadius: number
}

// ── Rounds / Projectiles ─────────────────────────────────────────────────────
export interface RoundTrajectory {
  heading:    number
  y0:         number
  vy:         number
  g:          number
  t:          number
  gunYinc:    number
}

export interface RoundMeshes {
  body:           TransformNode
  mortar:         Mesh
  bullet:         Mesh
  blast:          Mesh
  particles:      GPUParticleSystem
  blastParticles: GPUParticleSystem
  particleOrigin: TransformNode
}

export interface Round {
  name:           string
  type:           RoundType
  phase:          RoundPhase
  pos:            Vector3
  trajectory:     RoundTrajectory
  meshes:         RoundMeshes
  blastLife:      number
  blastAge:       number
  blastRadiusStart: number
  blastRadiusCurrent: number
  blastExpansionVelocity: number
  detonationFrame: number
  target:         Mesh | null
}

// ── The Package ───────────────────────────────────────────────────────────────
export interface PackageMeshes {
  body:           TransformNode
  package:        Mesh
  blast:          Mesh
  blastParticles: GPUParticleSystem
  blastEmitter:   { radius: number }
  particleOrigin: TransformNode
  target:         Mesh | null
}

export interface ThePackage {
  meshes:        PackageMeshes
  phase:         RoundPhase
  pos:           Vector3
  trajectory:    RoundTrajectory
  blastLife:     number
  blastAge:      number
  blastRadiusStart: number
  blastRadiusCurrent: number
  blastExpansionVelocity: number
  detonationFrame: number
  loaded:        boolean
}

// ── Mine ────────────────────────────────────────────────────────────────────
export interface Mine {
  name:           string
  zone:           number
  core:           Mesh
  shell:          TransformNode
  blast:          Mesh
  ring1:          Mesh
  ring2:          Mesh
  ring3:          Mesh
  blastParticles: GPUParticleSystem | ParticleSystem
  blastEmitter:   { radius: number }
  detonating:     boolean
  detonationFrame: number
  blastAge:       number
  blastLife:      number
  blastRadiusStart: number
  blastRadiusCurrent: number
  blastExpansionVelocity: number
}

// ── Activator ────────────────────────────────────────────────────────────────
export interface Activator {
  name:       string
  type:       'mine' | 'health' | 'bolt'
  CoT:        TransformNode
  rotator:    TransformNode
  fusecone:   Mesh
  pedestal:   Mesh
  fusecount:  number
  fuselevel:  number
  pos:        Vector3
  age:        number
  mesh:       AbstractMesh
}

// ── Scene extension ───────────────────────────────────────────────────────────
// Augments Babylon Scene with game-specific state.
export interface MCScene extends Scene {
  agents:               AgentInfo[]
  artifacts:            Artifact[]
  powerStations:        PowerStation[]
  wreckedStations:      PowerStation[]
  liveStations:         number
  rounds:               Round[]
  thePackage:           ThePackage
  mines:                Mine[]
  activators:           Activator[]
  fireTargets:          Mesh[]

  gameFrame:            number
  gamePhase:            GamePhase
  gameStarted:          boolean
  gameLevel:            number
  gameScore:            number
  hiGameScore:          number
  gameNumber:           number
  gameScores:           number[]
  packagePoints:        number

  nextArtifactId:       number

  mineCounter:          number
  activatorCounter:     number
  activator_score_thresh_set: boolean
  activator_score_thresh: number
  activator_last_score: number

  mortarBoost:          boolean
  mortarBoostFrame:     number

  BLAST_DAMAGE_COEFF:   number

  onUpdateGUI:          () => void
}
