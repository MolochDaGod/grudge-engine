import '@babylonjs/core/Physics/physicsEngineComponent'
import HavokPhysics from '@babylonjs/havok'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'

let _havokPromise: Promise<Awaited<ReturnType<typeof HavokPhysics>>> | null = null

export async function getHavokInstance() {
  if (!_havokPromise) _havokPromise = HavokPhysics()
  return _havokPromise
}

export async function enableHavokPhysics(scene: Scene, gravity = new Vector3(0, -9.81, 0)) {
  const hk = await getHavokInstance()
  const plugin = new HavokPlugin(true, hk)
  scene.enablePhysics(gravity, plugin)
  return plugin
}

export function createStaticBox(mesh: AbstractMesh, scene: Scene, options: Record<string, unknown> = {}) {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, ...options }, scene)
}

export function createDynamicBox(mesh: AbstractMesh, scene: Scene, options: Record<string, unknown> = {}) {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 1, restitution: 0.1, friction: 0.8, ...options }, scene)
}

export function createDynamicCapsule(mesh: AbstractMesh, scene: Scene, options: Record<string, unknown> = {}) {
  return new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0.05, friction: 1, ...options }, scene)
}

export function createStaticMesh(mesh: AbstractMesh, scene: Scene, options: Record<string, unknown> = {}) {
  return new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0, ...options }, scene)
}
