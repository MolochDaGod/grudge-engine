/**
 * ThreeAnimationLibrary.ts — Grudge Engine (Three.js backend)
 *
 * Loads animation GLBs and retargets them onto any Three.js character skeleton.
 * Mirrors the BabylonJS AnimationLibrary API.
 *
 * Uses the same ANIM_MANIFEST from core so both backends share animation definitions.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { ANIM_MANIFEST } from '../core/AnimationLibrary'

// ── Bone name normaliser (same logic as BabylonJS character.ts) ──────────────

function normBoneName(name: string): string {
  return name
    .replace(/^mixamorig[:\.]/, '')
    .replace(/^mixamorig/i, '')
    .replace(/[.\-\s_:]/g, '')
    .toLowerCase()
}

// ── Shared loader instances ──────────────────────────────────────────────────

let _gltfLoader: GLTFLoader | null = null

function getLoader(): GLTFLoader {
  if (!_gltfLoader) {
    _gltfLoader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    _gltfLoader.setDRACOLoader(draco)
  }
  return _gltfLoader
}

// ── ThreeAnimationLibrary ────────────────────────────────────────────────────

export class ThreeAnimationLibrary {
  /** Raw loaded clips keyed by manifest key */
  private _sourceClips: Map<string, THREE.AnimationClip> = new Map()

  /** Retargeted clips keyed by manifest key (after retargetTo) */
  private _retargetedClips: Map<string, THREE.AnimationClip> = new Map()

  /** AnimationMixer for the target character */
  private _mixer: THREE.AnimationMixer | null = null

  /** Currently playing action key */
  private _currentKey: string | null = null
  private _currentAction: THREE.AnimationAction | null = null

  private _loaded = false

  get loaded(): boolean { return this._loaded }
  get count(): number { return this._sourceClips.size }
  get keys(): string[] { return [...this._sourceClips.keys()] }
  get currentKey(): string | null { return this._currentKey }

  // ── Loading ──────────────────────────────────────────────────────────────

  async loadAll(baseUrl: string): Promise<number> {
    const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    const loader = getLoader()
    let loaded = 0
    const entries = Object.entries(ANIM_MANIFEST)

    console.log(`ThreeAnimationLibrary: loading ${entries.length} animations…`)

    for (const [key, filename] of entries) {
      try {
        const gltf = await loader.loadAsync(url + filename + '.glb')
        if (gltf.animations.length > 0) {
          const clip = gltf.animations[0]
          clip.name = key
          // Strip Mixamo prefix from all track names
          clip.tracks.forEach(track => {
            track.name = track.name.replace(/^mixamorig[:\.]/, '')
          })
          this._sourceClips.set(key, clip)
          loaded++
        }
      } catch (e) {
        console.warn(`ThreeAnimationLibrary: failed to load "${key}" (${filename}.glb):`, e)
      }
    }

    this._loaded = true
    console.log(`ThreeAnimationLibrary: ${loaded}/${entries.length} loaded`)
    return loaded
  }

  async loadOne(key: string, baseUrl: string): Promise<boolean> {
    const filename = ANIM_MANIFEST[key]
    if (!filename) { console.warn(`ThreeAnimationLibrary: unknown key "${key}"`); return false }

    const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    try {
      const gltf = await getLoader().loadAsync(url + filename + '.glb')
      if (gltf.animations.length > 0) {
        const clip = gltf.animations[0]
        clip.name = key
        clip.tracks.forEach(track => {
          track.name = track.name.replace(/^mixamorig[:\.]/, '')
        })
        this._sourceClips.set(key, clip)
        return true
      }
    } catch { /* ignore */ }
    return false
  }

  // ── Retargeting ──────────────────────────────────────────────────────────

  /**
   * Retarget all loaded animations onto a target character mesh.
   * Three.js retargeting: match bone names between source clips and target skeleton.
   */
  retargetTo(targetMesh: THREE.Object3D): number {
    this._retargetedClips.clear()
    this._mixer = new THREE.AnimationMixer(targetMesh)

    // Build a set of normalised bone names present in the target
    const targetBones = new Set<string>()
    targetMesh.traverse(child => {
      if ((child as THREE.Bone).isBone) {
        targetBones.add(normBoneName(child.name))
      }
    })

    let mapped = 0
    for (const [key, clip] of this._sourceClips) {
      // Filter tracks to only those whose bones exist in the target
      const validTracks = clip.tracks.filter(track => {
        // Track name format: "boneName.property"
        const dotIdx = track.name.indexOf('.')
        const boneName = dotIdx >= 0 ? track.name.slice(0, dotIdx) : track.name
        return targetBones.has(normBoneName(boneName))
      })

      if (validTracks.length > 0) {
        const retargeted = new THREE.AnimationClip(`rt_${key}`, clip.duration, validTracks)
        this._retargetedClips.set(key, retargeted)
        mapped++
      }
    }

    console.log(`ThreeAnimationLibrary: retargeted ${mapped}/${this._sourceClips.size} to skeleton`)
    return mapped
  }

  // ── Playback ─────────────────────────────────────────────────────────────

  play(key: string, loop = false, speed = 1.0): THREE.AnimationAction | null {
    if (!this._mixer) { console.warn('ThreeAnimationLibrary: no mixer. Call retargetTo() first.'); return null }

    // Stop current
    if (this._currentAction) {
      this._currentAction.stop()
    }

    const clip = this._retargetedClips.get(key) ?? this._sourceClips.get(key)
    if (!clip) {
      console.warn(`ThreeAnimationLibrary: no animation for key "${key}"`)
      return null
    }

    const action = this._mixer.clipAction(clip)
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
    if (!loop) action.clampWhenFinished = true
    action.timeScale = speed
    action.reset().play()

    this._currentKey = key
    this._currentAction = action
    return action
  }

  crossFade(key: string, duration = 0.2, loop = false): THREE.AnimationAction | null {
    if (!this._mixer) return null

    const clip = this._retargetedClips.get(key) ?? this._sourceClips.get(key)
    if (!clip) return null

    const next = this._mixer.clipAction(clip)
    next.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
    if (!loop) next.clampWhenFinished = true
    next.reset().play()

    if (this._currentAction && this._currentAction !== next) {
      this._currentAction.crossFadeTo(next, duration, false)
    }

    this._currentKey = key
    this._currentAction = next
    return next
  }

  stop(): void {
    this._currentAction?.stop()
    this._currentKey = null
    this._currentAction = null
  }

  /** Call in the animation loop to advance the mixer */
  update(deltaS: number): void {
    this._mixer?.update(deltaS)
  }

  dispose(): void {
    this.stop()
    this._mixer?.stopAllAction()
    this._mixer = null
    this._sourceClips.clear()
    this._retargetedClips.clear()
    this._loaded = false
  }
}
