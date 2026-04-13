/**
 * shared/interfaces.ts — Grudge Engine
 *
 * Engine-agnostic interfaces for the multi-engine architecture.
 * Both the BabylonJS backend (src/core/) and Three.js backend (src/three/)
 * implement these contracts, allowing game code to be renderer-independent.
 *
 * Game code writes to these interfaces. The backend is selected at init time.
 */

// ── Vector / Math (simple POJOs so they're engine-agnostic) ──────────────────

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Color3 {
  r: number
  g: number
  b: number
}

export interface Color4 extends Color3 {
  a: number
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export type RendererBackend = 'babylon' | 'three'

export interface IGrudgeRenderer {
  readonly backend: RendererBackend
  readonly canvas: HTMLCanvasElement

  /** Initialise the rendering engine with a canvas */
  init(canvas: HTMLCanvasElement): void

  /** Start the render loop with an optional per-frame callback */
  start(onFrame?: (deltaMs: number) => void): void

  /** Resize the renderer to match canvas dimensions */
  resize(): void

  /** Dispose all GPU resources */
  dispose(): void
}

// ── Scene ────────────────────────────────────────────────────────────────────

export interface IGrudgeScene {
  /** Add an entity to the scene */
  addEntity(entity: IGrudgeEntity): void

  /** Remove an entity from the scene */
  removeEntity(entity: IGrudgeEntity): void

  /** Find entities by tag */
  queryByTag(tag: string): IGrudgeEntity[]

  /** Serialise scene to a portable JSON format */
  serialize(): Record<string, unknown>

  /** Load scene from a portable JSON format */
  deserialize(data: Record<string, unknown>): void

  /** Dispose the scene */
  dispose(): void
}

// ── Camera ───────────────────────────────────────────────────────────────────

export type CameraMode = 'orbit' | 'follow' | 'fps' | 'free'

export interface IGrudgeCamera {
  position: Vec3
  target: Vec3
  fov: number
  mode: CameraMode

  /** Attach camera to a canvas for user input */
  attachControl(canvas: HTMLCanvasElement): void

  /** Follow an entity */
  follow(entity: IGrudgeEntity, offset?: Vec3): void

  /** Detach controls */
  detachControl(): void
}

// ── Entity ───────────────────────────────────────────────────────────────────

export interface IGrudgeEntity {
  readonly id: string
  name: string
  tags: Set<string>

  position: Vec3
  rotation: Vec3
  scale: Vec3
  visible: boolean

  /** Per-frame update */
  update(deltaS: number): void

  /** Clean up */
  dispose(): void
}

// ── Mesh ─────────────────────────────────────────────────────────────────────

export interface IGrudgeMesh extends IGrudgeEntity {
  /** Load a GLB model */
  loadModel(url: string): Promise<void>

  /** Play a named animation */
  playAnimation(name: string, loop?: boolean, speed?: number): void

  /** Stop current animation */
  stopAnimation(): void

  /** Set material property */
  setMaterialColor(color: Color3): void
}

// ── Light ────────────────────────────────────────────────────────────────────

export type LightType = 'directional' | 'hemispheric' | 'point' | 'spot'

export interface IGrudgeLight {
  type: LightType
  color: Color3
  intensity: number
  castShadow: boolean
  position: Vec3
  direction?: Vec3
}

// ── Physics ──────────────────────────────────────────────────────────────────

export type PhysicsShape = 'box' | 'sphere' | 'capsule' | 'mesh'

export interface IGrudgePhysics {
  /** Initialise physics engine */
  init(gravity?: Vec3): Promise<void>

  /** Add a physics body to an entity */
  addBody(entity: IGrudgeEntity, shape: PhysicsShape, mass: number): void

  /** Cast a ray and return hit info */
  raycast(from: Vec3, to: Vec3): { hit: boolean; point?: Vec3; entity?: IGrudgeEntity }

  /** Step the physics simulation */
  step(deltaS: number): void

  /** Dispose physics world */
  dispose(): void
}

// ── State Machine (engine-agnostic, pure logic) ──────────────────────────────

export interface IState<TOwner> {
  readonly name: string
  enter(owner: TOwner, from?: IState<TOwner>): void
  update(owner: TOwner, deltaS: number): void
  exit(owner: TOwner): void
}

// ── Engine Factory ───────────────────────────────────────────────────────────

export interface GrudgeEngineConfig {
  backend: RendererBackend
  canvasId?: string
  assets?: {
    cdn: string
    fallback?: string
  }
}
