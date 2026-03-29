import { Scene }        from '@babylonjs/core/scene'
import { Engine }       from '@babylonjs/core/Engines/engine'
import { GrudgeEngine } from './GrudgeEngine'

/**
 * BaseScene — abstract class every Grudge Engine demo/game extends.
 * Subclasses implement build() to set up cameras, lights, meshes, actors.
 * update() is called each frame with deltaSeconds.
 */
export abstract class BaseScene {
  protected readonly grudge: GrudgeEngine
  protected readonly scene:  Scene
  protected readonly engine: Engine

  constructor() {
    this.grudge = GrudgeEngine.instance
    this.scene  = this.grudge.scene
    this.engine = this.grudge.engine
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
