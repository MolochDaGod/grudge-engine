/**
 * ThreeModelLoader.ts — Grudge Engine (Three.js backend)
 *
 * Utilities for loading GLB/GLTF models with Draco compression,
 * auto-normalizing character scale, and configuring shadows.
 * Mirrors the BabylonJS character.ts + SceneLoader patterns.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { assetUrl } from '../grudge/assets'

// ── Shared loader ────────────────────────────────────────────────────────────

let _loader: GLTFLoader | null = null

function getLoader(): GLTFLoader {
  if (!_loader) {
    _loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    _loader.setDRACOLoader(draco)
  }
  return _loader
}

// ── Load result ──────────────────────────────────────────────────────────────

export interface ThreeModelResult {
  root: THREE.Object3D
  meshes: THREE.Mesh[]
  animations: THREE.AnimationClip[]
  skeleton: THREE.Skeleton | null
}

// ── Load a GLB model ─────────────────────────────────────────────────────────

export async function loadModel(url: string): Promise<ThreeModelResult> {
  const resolved = url.startsWith('http') ? url : assetUrl(url)
  const gltf = await getLoader().loadAsync(resolved)

  const root = gltf.scene
  const meshes: THREE.Mesh[] = []
  let skeleton: THREE.Skeleton | null = null

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshes.push(mesh)
    }
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skeleton = (child as THREE.SkinnedMesh).skeleton
    }
  })

  return {
    root,
    meshes,
    animations: gltf.animations,
    skeleton,
  }
}

// ── Auto-normalize character height ──────────────────────────────────────────

export interface NormalizeResult {
  scale: number
  rawHeight: number
  adjusted: boolean
}

/**
 * Auto-scale a loaded character root so its height equals targetMeters.
 * Same logic as BabylonJS autoNormalizeCharacter.
 */
export function autoNormalizeCharacter(
  root: THREE.Object3D,
  targetMeters = 1.8,
): NormalizeResult {
  const box = new THREE.Box3().setFromObject(root)
  const rawHeight = box.max.y - box.min.y

  if (rawHeight >= 0.5 && rawHeight <= 3.0) {
    return { scale: 1, rawHeight, adjusted: false }
  }

  const scale = targetMeters / Math.max(rawHeight, 0.001)
  root.scale.multiplyScalar(scale)

  return { scale, rawHeight, adjusted: true }
}

// ── Character model loader (race-aware) ──────────────────────────────────────

import { GRUDGE_RACE_MODELS, RACE_MODEL_CDN } from '../core/raceModels'

export async function loadRaceModel(
  raceId: string,
  scene: THREE.Scene,
): Promise<ThreeModelResult> {
  const entry = GRUDGE_RACE_MODELS[raceId.toLowerCase()] ?? GRUDGE_RACE_MODELS['human']
  const url = `${RACE_MODEL_CDN}/${entry.file}`
  const result = await loadModel(url)

  autoNormalizeCharacter(result.root)
  if (entry.scale && entry.scale !== 1) {
    result.root.scale.multiplyScalar(entry.scale)
  }

  scene.add(result.root)
  return result
}
