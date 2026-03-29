import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'
import { GrudgeEngine } from './GrudgeEngine'

export interface BabylonStarterSceneResult {
  scene: Scene
  camera: FreeCamera
  light: HemisphericLight
  sphere: Mesh
  ground: Mesh
}

/**
 * Canonical Babylon baseline, translated to Grudge Engine helpers.
 * Mirrors the official "Getting Started" example:
 * - canvas → engine
 * - scene
 * - FreeCamera at (0, 5, -10)
 * - HemisphericLight
 * - sphere + ground
 * - camera attached to canvas
 */
export function createBabylonStarterScene(grudge = GrudgeEngine.instance): BabylonStarterSceneResult {
  const scene = grudge.scene

  const camera = new FreeCamera('camera1', new Vector3(0, 5, -10), scene)
  camera.setTarget(Vector3.Zero())
  camera.attachControl(grudge.canvas, false)

  const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene)

  const sphere = MeshBuilder.CreateSphere(
    'sphere1',
    { segments: 16, diameter: 2, sideOrientation: Mesh.FRONTSIDE },
    scene
  )
  sphere.position.y = 1

  const ground = MeshBuilder.CreateGround(
    'ground1',
    { width: 6, height: 6, subdivisions: 2, updatable: false },
    scene
  )

  return { scene, camera, light, sphere, ground }
}
