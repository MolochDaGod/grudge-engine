/**
 * ThreePhysics.ts — Grudge Engine (Three.js backend)
 *
 * Physics wrapper using Cannon-ES, mirroring the BabylonJS Havok physics API.
 * Provides the same helpers: enablePhysics, createStaticBox, createDynamicCapsule, etc.
 */

import * as CANNON from 'cannon-es'
import * as THREE from 'three'

let _worldInstance: CANNON.World | null = null

// ── Collision groups (powers of 2) ───────────────────────────────────────────

export const CollisionGroup = {
  SCENE:          0x0002,
  PLAYER:         0x0004,
  ENEMY:          0x0008,
  PLAYER_ATTACK:  0x0010,
  ENEMY_ATTACK:   0x0020,
  TRIGGER:        0x0040,
  SHIELD:         0x0080,
} as const

// ── World setup ──────────────────────────────────────────────────────────────

export function enableCannonPhysics(gravity = new CANNON.Vec3(0, -9.81, 0)): CANNON.World {
  if (_worldInstance) return _worldInstance

  const world = new CANNON.World({
    gravity,
    broadphase: new CANNON.SAPBroadphase(new CANNON.World()),
    allowSleep: true,
  })
  world.defaultContactMaterial.friction = 0.5
  world.defaultContactMaterial.restitution = 0.1

  _worldInstance = world
  return world
}

export function getCannonWorld(): CANNON.World {
  if (!_worldInstance) throw new Error('Cannon physics not enabled. Call enableCannonPhysics() first.')
  return _worldInstance
}

// ── Body helpers ─────────────────────────────────────────────────────────────

export interface BodyOptions {
  mass?: number
  friction?: number
  restitution?: number
  fixedRotation?: boolean
  collisionGroup?: number
  collisionMask?: number
}

export function createStaticBox(
  halfExtents: CANNON.Vec3,
  position: CANNON.Vec3,
  opts: BodyOptions = {},
): CANNON.Body {
  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(halfExtents),
    position,
    collisionFilterGroup: opts.collisionGroup ?? CollisionGroup.SCENE,
    collisionFilterMask: opts.collisionMask ?? -1,
  })
  getCannonWorld().addBody(body)
  return body
}

export function createDynamicBox(
  halfExtents: CANNON.Vec3,
  position: CANNON.Vec3,
  opts: BodyOptions = {},
): CANNON.Body {
  const body = new CANNON.Body({
    mass: opts.mass ?? 1,
    shape: new CANNON.Box(halfExtents),
    position,
    fixedRotation: opts.fixedRotation ?? false,
    collisionFilterGroup: opts.collisionGroup ?? CollisionGroup.PLAYER,
    collisionFilterMask: opts.collisionMask ?? -1,
  })
  const mat = new CANNON.Material()
  mat.friction = opts.friction ?? 0.8
  mat.restitution = opts.restitution ?? 0.1
  body.material = mat
  getCannonWorld().addBody(body)
  return body
}

export function createDynamicCapsule(
  radius: number,
  height: number,
  position: CANNON.Vec3,
  opts: BodyOptions = {},
): CANNON.Body {
  // Cannon-ES doesn't have a native capsule — use cylinder + 2 spheres
  const body = new CANNON.Body({
    mass: opts.mass ?? 1,
    position,
    fixedRotation: opts.fixedRotation ?? true,
    collisionFilterGroup: opts.collisionGroup ?? CollisionGroup.PLAYER,
    collisionFilterMask: opts.collisionMask ?? -1,
  })

  const halfHeight = height / 2 - radius
  body.addShape(new CANNON.Cylinder(radius, radius, halfHeight * 2, 8))
  body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, halfHeight, 0))
  body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(0, -halfHeight, 0))

  const mat = new CANNON.Material()
  mat.friction = opts.friction ?? 1.0
  mat.restitution = opts.restitution ?? 0.05
  body.material = mat

  getCannonWorld().addBody(body)
  return body
}

export function createStaticMesh(
  vertices: Float32Array,
  indices: Uint16Array | Uint32Array,
  position = new CANNON.Vec3(),
): CANNON.Body {
  const trimesh = new CANNON.Trimesh(
    Array.from(vertices),
    Array.from(indices),
  )
  const body = new CANNON.Body({
    mass: 0,
    shape: trimesh,
    position,
    collisionFilterGroup: CollisionGroup.SCENE,
  })
  getCannonWorld().addBody(body)
  return body
}

// ── Sync helpers ─────────────────────────────────────────────────────────────

/** Copy Cannon body position/quaternion to a Three.js mesh */
export function syncBodyToMesh(body: CANNON.Body, mesh: THREE.Object3D): void {
  mesh.position.set(body.position.x, body.position.y, body.position.z)
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
}

/** Step the physics world */
export function stepPhysics(deltaS: number, fixedStep = 1 / 60, maxSubSteps = 3): void {
  getCannonWorld().step(fixedStep, deltaS, maxSubSteps)
}

// ── Raycasting ───────────────────────────────────────────────────────────────

export interface RayHit {
  hit: boolean
  point: CANNON.Vec3
  normal: CANNON.Vec3
  distance: number
  body: CANNON.Body | null
}

export function raycast(from: CANNON.Vec3, to: CANNON.Vec3, mask = -1): RayHit {
  const result = new CANNON.RaycastResult()
  getCannonWorld().raycastClosest(from, to, { collisionFilterMask: mask }, result)
  return {
    hit: result.hasHit,
    point: result.hitPointWorld,
    normal: result.hitNormalWorld,
    distance: result.distance,
    body: result.body,
  }
}

// ── Disposal ─────────────────────────────────────────────────────────────────

export function disposeCannonPhysics(): void {
  if (_worldInstance) {
    // Remove all bodies
    while (_worldInstance.bodies.length > 0) {
      _worldInstance.removeBody(_worldInstance.bodies[0])
    }
    _worldInstance = null
  }
}
