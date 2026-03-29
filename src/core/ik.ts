import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Bone } from '@babylonjs/core/Bones/bone'
import { BoneIKController } from '@babylonjs/core/Bones/boneIKController'
import { BoneLookController } from '@babylonjs/core/Bones/boneLookController'
import type { Vector3 } from '@babylonjs/core/Maths/math.vector'

export function createBoneIK(mesh: AbstractMesh, bone: Bone, target: Vector3, poleTarget: Vector3, options: Record<string, unknown> = {}) {
  return new BoneIKController(mesh, bone, {
    targetMesh: { position: target },
    poleTargetMesh: { position: poleTarget },
    ...options,
  } as never)
}

export function createBoneLook(mesh: AbstractMesh, bone: Bone, target: Vector3, options: Record<string, unknown> = {}) {
  return new BoneLookController(mesh, bone, target, options as never)
}
