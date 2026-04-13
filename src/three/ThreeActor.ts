/**
 * ThreeActor.ts — Grudge Engine (Three.js backend)
 *
 * Actor wrapping a Three.js mesh + AnimationMixer + StateMachine.
 * Mirrors the BabylonJS Actor API so game logic can be shared.
 */

import * as THREE from 'three'
import { StateMachine } from '../core/StateMachine'
import { InputManager } from '../core/InputManager'
import type { State } from '../core/StateMachine'

export interface ThreeActorOptions {
  mesh: THREE.Object3D
  scene: THREE.Scene
  speed?: number
  runMultiplier?: number
  gravity?: number
  jumpForce?: number
  input?: InputManager
}

export class ThreeActor {
  readonly mesh: THREE.Object3D
  readonly scene: THREE.Scene
  readonly fsm: StateMachine<ThreeActor>
  readonly mixer: THREE.AnimationMixer

  speed: number
  runMultiplier: number
  gravity: number
  jumpForce: number
  velocity = new THREE.Vector3()
  grounded = true
  input?: InputManager

  /** Registered animation clips keyed by state name */
  private _clips: Map<string, THREE.AnimationAction> = new Map()

  private _currentAction: THREE.AnimationAction | null = null

  constructor(opts: ThreeActorOptions) {
    this.mesh = opts.mesh
    this.scene = opts.scene
    this.speed = opts.speed ?? 4
    this.runMultiplier = opts.runMultiplier ?? 2
    this.gravity = opts.gravity ?? 20
    this.jumpForce = opts.jumpForce ?? 10
    this.input = opts.input
    this.fsm = new StateMachine<ThreeActor>(this)
    this.mixer = new THREE.AnimationMixer(this.mesh)

    // Listen for animation finish events to chain combos
    this.mixer.addEventListener('finished', () => {
      // Subclasses or states can hook into this
    })
  }

  /** Register an AnimationClip under a state name */
  registerClip(stateName: string, clip: THREE.AnimationClip, loop = true): void {
    const action = this.mixer.clipAction(clip)
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
    if (!loop) action.clampWhenFinished = true
    this._clips.set(stateName, action)
  }

  /** Register an animation from a loaded GLTF animations array */
  registerGltfAnim(stateName: string, clip: THREE.AnimationClip, loop = true): void {
    // Strip Mixamo prefix if present
    clip.tracks.forEach(track => {
      track.name = track.name.replace(/^mixamorig[:\.]/, '')
    })
    this.registerClip(stateName, clip, loop)
  }

  /** Play animation by state name with crossfade */
  playAnim(stateName: string, loop = true, blendTime = 0.15): void {
    const next = this._clips.get(stateName)
    if (!next || next === this._currentAction) return

    next.reset().play()
    if (this._currentAction) {
      this._currentAction.crossFadeTo(next, blendTime, false)
    }
    this._currentAction = next
  }

  /** Register and transition to a named state */
  addState(state: State<ThreeActor>): this {
    this.fsm.register(state)
    return this
  }

  setState(name: string): void {
    this.fsm.setState(name)
  }

  get position(): THREE.Vector3 { return this.mesh.position }
  get rotation(): THREE.Euler { return this.mesh.rotation }

  /** Called every frame by the scene or game loop */
  update(deltaS: number): void {
    this.mixer.update(deltaS)
    this.fsm.update(deltaS)
    this.input?.flush()
  }

  dispose(): void {
    this._clips.forEach(action => {
      action.stop()
      this.mixer.uncacheAction(action.getClip())
    })
    this._clips.clear()
    this.mixer.stopAllAction()
  }
}
