// game/utils.ts — ported from utils.js
import { Vector3, Vector2, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Ray }  from '@babylonjs/core/Culling/ray'
import type { MCScene } from './types'
import { TERRAIN_MESH_NAME } from './tableConstants'

export function randomRotation(): Quaternion {
  const r = Math.random()
  const axis = r < 0.33 ? Axis.X : r < 0.66 ? Axis.Y : Axis.Z
  return Quaternion.RotationAxis(axis, Math.random() * Math.PI)
}

export function getGroundElevation(x: number, z: number, scene: MCScene): number {
  const terrainMesh = scene.getMeshByName(TERRAIN_MESH_NAME)
  if (!terrainMesh) return 0

  const ray = new Ray(
    new Vector3(x, terrainMesh.getBoundingInfo().boundingBox.maximumWorld.y + 1, z),
    new Vector3(0, -1, 0),
  )
  const worldInverse = new Matrix()
  terrainMesh.getWorldMatrix().invertToRef(worldInverse)
  const localRay = Ray.Transform(ray, worldInverse)
  const pick = terrainMesh.intersects(localRay)
  return pick.hit ? pick.pickedPoint!.y : 0
}

export function getXZpos(posxyz: Vector3): Vector2 {
  return new Vector2(posxyz.x, posxyz.z)
}

export function getGroundRange(p0: Vector3, p1: Vector3): number {
  return Vector2.Distance(getXZpos(p0), getXZpos(p1))
}

export function headingToVector2(heading: number): Vector2 {
  const rad = heading * (Math.PI / 180)
  return Vector2.Normalize(new Vector2(Math.cos(rad), Math.sin(rad)))
}

export function getAngle(v1: Vector3, v2: Vector3): number {
  const dot = Vector3.Dot(v1, v2)
  return Math.acos(dot / (v1.length() * v2.length()))
}

export function getAngleOriented(v1: Vector2, v2: Vector2): number {
  return Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y)
}

export function randn_bm(min: number, max: number, skew: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  let num = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  num = num / 10 + 0.5
  if (num > 1 || num < 0) return randn_bm(min, max, skew)
  num = Math.pow(num, skew) * (max - min) + min
  return num
}
