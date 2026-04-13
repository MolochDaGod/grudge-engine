/**
 * ThreeEngine.ts — Grudge Engine (Three.js backend)
 *
 * Singleton wrapper around Three.js WebGLRenderer + Scene, mirroring
 * the same API surface as GrudgeEngine (BabylonJS) so game code can
 * be written against the shared interfaces.
 *
 * Usage:
 *   import { ThreeEngine } from '../three'
 *   const engine = ThreeEngine.create({ canvasId: 'game' })
 *   engine.start((deltaMs) => { ... })
 */

import * as THREE from 'three'
import type { IGrudgeRenderer, RendererBackend } from '../shared/interfaces'

export interface ThreeEngineOptions {
  canvasId?: string
  antialias?: boolean
  clearColor?: [number, number, number]
  shadowMap?: boolean
  toneMapping?: THREE.ToneMapping
  pixelRatio?: number
}

export class ThreeEngine implements IGrudgeRenderer {
  readonly backend: RendererBackend = 'three'
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly canvas: HTMLCanvasElement
  readonly clock: THREE.Clock

  private static _instance: ThreeEngine | null = null
  private _rafId: number | null = null

  private constructor(canvas: HTMLCanvasElement, opts: ThreeEngineOptions) {
    this.canvas = canvas
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.antialias ?? true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(opts.pixelRatio ?? Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = opts.toneMapping ?? THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    if (opts.shadowMap ?? true) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    this.scene = new THREE.Scene()
    const [r, g, b] = opts.clearColor ?? [0.05, 0.05, 0.1]
    this.scene.background = new THREE.Color(r, g, b)

    window.addEventListener('resize', this._onResize)
  }

  // ── IGrudgeRenderer ────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement): void {
    // Already initialised in constructor
    void canvas
  }

  /** Create (or return existing) ThreeEngine instance */
  static create(opts: ThreeEngineOptions = {}): ThreeEngine {
    if (ThreeEngine._instance) return ThreeEngine._instance

    const id = opts.canvasId ?? 'grudge-canvas'
    let canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.id = id
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;'
      document.body.appendChild(canvas)
    }

    ThreeEngine._instance = new ThreeEngine(canvas, opts)
    return ThreeEngine._instance
  }

  static get instance(): ThreeEngine {
    if (!ThreeEngine._instance) throw new Error('ThreeEngine not yet created.')
    return ThreeEngine._instance
  }

  /** Start the render loop. Camera must be set via scene or passed separately. */
  start(onFrame?: (deltaMs: number) => void): void {
    const loop = () => {
      this._rafId = requestAnimationFrame(loop)
      const delta = this.clock.getDelta() * 1000 // convert to ms for parity with BabylonJS
      onFrame?.(delta)
      // Render using the first camera found in scene, or a default
      const camera = this.scene.children.find(c => c instanceof THREE.Camera) as THREE.Camera | undefined
      if (camera) {
        this.renderer.render(this.scene, camera)
      }
    }
    loop()
  }

  /** Start with an explicit camera (preferred) */
  startWithCamera(camera: THREE.Camera, onFrame?: (deltaMs: number) => void): void {
    const loop = () => {
      this._rafId = requestAnimationFrame(loop)
      const delta = this.clock.getDelta() * 1000
      onFrame?.(delta)
      this.renderer.render(this.scene, camera)
    }
    loop()
  }

  resize(): void {
    this._onResize()
  }

  dispose(): void {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    this.renderer.dispose()
    this.scene.clear()
    window.removeEventListener('resize', this._onResize)
    ThreeEngine._instance = null
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _onResize = (): void => {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.renderer.setSize(w, h)
    // Update all cameras in scene
    this.scene.traverse((child) => {
      if (child instanceof THREE.PerspectiveCamera) {
        child.aspect = w / h
        child.updateProjectionMatrix()
      }
    })
  }
}
