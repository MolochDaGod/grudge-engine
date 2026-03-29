import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

export function configureCharacterCollisions(mesh: AbstractMesh, ellipsoid = new Vector3(0.45, 0.9, 0.45), ellipsoidOffset = new Vector3(0, 0.9, 0)) {
  mesh.checkCollisions = true
  mesh.ellipsoid = ellipsoid
  mesh.ellipsoidOffset = ellipsoidOffset
  return mesh
}

export function moveCharacterWithCollisions(mesh: AbstractMesh, movement: Vector3) {
  mesh.moveWithCollisions(movement)
}
