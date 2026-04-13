/**
 * ThreeBaseScene.ts — Grudge Engine (Three.js backend)
 *
 * Abstract base class for Three.js scenes, mirroring the BabylonJS BaseScene API.
 * Subclasses implement build() and optionally update().
 */

import * as THREE from 'three'
import { ThreeEngine } from './ThreeEngine'

export abstract class ThreeBaseScene {
  protected readonly grudge: ThreeEngine
  protected readonly scene: THREE.Scene
  protected readonly renderer: THREE.WebGLRenderer

  constructor() {
    this.grudge = ThreeEngine.instance
    this.scene = this.grudge.scene
    this.renderer = this.grudge.renderer
  }

  /** Override to construct scene content — called once */
  abstract build(): Promise<void>

  /** Override for per-frame logic — deltaS is seconds since last frame */
  update(_deltaS: number): void { /* optional */ }

  /** Call after build() to wire up the render loop */
  start(): void {
    this.grudge.start((deltaMs) => {
      this.update(deltaMs / 1000)
    })
  }

  dispose(): void { /* subclass can clean up */ }
}
