/**
 * InputManager — lightweight keyboard + mouse tracker.
 * Usage:
 *   const input = new InputManager()
 *   // in update loop:
 *   if (input.keys['KeyW']) { ... }
 *   if (input.mouse.left) { ... }
 */
export class InputManager {
  readonly keys: Record<string, boolean> = {}
  readonly mouse = { left: false, right: false, middle: false, x: 0, y: 0, dx: 0, dy: 0 }

  /** True while pointer is locked */
  get pointerLocked(): boolean {
    return !!document.pointerLockElement
  }

  // Convenience getters matching original threejs-games API
  get up():      boolean { return !!(this.keys['KeyW'] || this.keys['ArrowUp']) }
  get down():    boolean { return !!(this.keys['KeyS'] || this.keys['ArrowDown']) }
  get left():    boolean { return !!(this.keys['KeyA'] || this.keys['ArrowLeft']) }
  get right():   boolean { return !!(this.keys['KeyD'] || this.keys['ArrowRight']) }
  get run():     boolean { return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) }
  get jump():    boolean { return !!this.keys['Space'] }
  get attack():  boolean { return !!(this.keys['KeyJ'] || this.mouse.left) }
  get interact():boolean { return !!this.keys['KeyE'] }
  get dodge():   boolean { return !!(this.keys['KeyQ']) }
  get tab():     boolean { return !!this.keys['Tab'] }

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown',   this._onKeyDown)
    target.addEventListener('keyup',     this._onKeyUp)
    target.addEventListener('mousedown', this._onMouseDown as EventListener)
    target.addEventListener('mouseup',   this._onMouseUp as EventListener)
    target.addEventListener('mousemove', this._onMouseMove as EventListener)
  }

  private _onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent
    // Prevent default on game keys to avoid scroll/focus stealing
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(ke.code))
      ke.preventDefault()
    this.keys[ke.code] = true
  }

  private _onKeyUp = (e: Event): void => {
    this.keys[(e as KeyboardEvent).code] = false
  }

  private _onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouse.left   = true
    if (e.button === 1) this.mouse.middle = true
    if (e.button === 2) this.mouse.right  = true
  }

  private _onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouse.left   = false
    if (e.button === 1) this.mouse.middle = false
    if (e.button === 2) this.mouse.right  = false
  }

  private _onMouseMove = (e: MouseEvent): void => {
    this.mouse.dx = e.movementX
    this.mouse.dy = e.movementY
    this.mouse.x  = e.clientX
    this.mouse.y  = e.clientY
  }

  /** Clear per-frame deltas — call at end of each frame */
  flush(): void {
    this.mouse.dx = 0
    this.mouse.dy = 0
  }

  dispose(target: EventTarget = window): void {
    target.removeEventListener('keydown',   this._onKeyDown)
    target.removeEventListener('keyup',     this._onKeyUp)
    target.removeEventListener('mousedown', this._onMouseDown as EventListener)
    target.removeEventListener('mouseup',   this._onMouseUp as EventListener)
    target.removeEventListener('mousemove', this._onMouseMove as EventListener)
  }
}
