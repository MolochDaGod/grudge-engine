import type { Scene } from '@babylonjs/core/scene'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin'
import Recast from 'recast-detour'

let _recastPromise: Promise<unknown> | null = null

export const DEFAULT_NAVMESH_PARAMS = {
  cs: 0.2,
  ch: 0.2,
  walkableSlopeAngle: 45,
  walkableHeight: 2.0,
  walkableClimb: 0.5,
  walkableRadius: 0.6,
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
}

export async function getRecastInstance() {
  if (!_recastPromise) {
    const RecastCtor = Recast as unknown as { new(): Promise<unknown> }
    _recastPromise = new RecastCtor()
  }
  return _recastPromise
}

export async function createNavigationPlugin() {
  const recast = await getRecastInstance()
  return new RecastJSPlugin(recast)
}

export async function buildNavMesh(meshes: Mesh[], scene: Scene, params = DEFAULT_NAVMESH_PARAMS) {
  const plugin = await createNavigationPlugin()
  plugin.createNavMesh(meshes, params)
  return {
    plugin,
    debugMesh: plugin.createDebugNavMesh(scene),
  }
}
