import { Engine }       from '@babylonjs/core/Engines/engine'
import { Scene }        from '@babylonjs/core/scene'
import { Color4 }       from '@babylonjs/core/Maths/math.color'

export interface EngineOptions {
  canvasId?: string
  antialias?: boolean
  adaptToDeviceRatio?: boolean
  clearColor?: [number, number, number, number]
}

/**
 * GrudgeEngine — singleton wrapper around Babylon Engine + Scene.
 * Call GrudgeEngine.create() once, then use .engine / .scene everywhere.
 */
export class GrudgeEngine {
  readonly engine: Engine
  readonly scene:  Scene
  readonly canvas: HTMLCanvasElement

  private static _instance: GrudgeEngine | null = null

  private constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas
    this.engine = new Engine(canvas, opts.antialias ?? true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: opts.adaptToDeviceRatio ?? true,
    })
    this.scene = new Scene(this.engine)

    const [r, g, b, a] = opts.clearColor ?? [0.05, 0.05, 0.1, 1]
    this.scene.clearColor = new Color4(r, g, b, a)

    // Resize handler
    window.addEventListener('resize', () => this.engine.resize())
  }

  /** Create (or return existing) GrudgeEngine instance */
  static create(opts: EngineOptions = {}): GrudgeEngine {
    if (GrudgeEngine._instance) return GrudgeEngine._instance

    const id = opts.canvasId ?? 'grudge-canvas'
    let canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.id = id
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;'
      document.body.appendChild(canvas)
    }

    GrudgeEngine._instance = new GrudgeEngine(canvas, opts)
    return GrudgeEngine._instance
  }

  static get instance(): GrudgeEngine {
    if (!GrudgeEngine._instance) throw new Error('GrudgeEngine not yet created.')
    return GrudgeEngine._instance
  }

  /** Start the render loop with an optional per-frame callback */
  start(onFrame?: (deltaMs: number) => void): void {
    this.engine.runRenderLoop(() => {
      const delta = this.engine.getDeltaTime()
      onFrame?.(delta)
      this.scene.render()
    })
  }

  /** Dispose everything */
  dispose(): void {
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
    window.removeEventListener('resize', () => this.engine.resize())
    GrudgeEngine._instance = null
  }
}
