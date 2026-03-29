import { Scene }           from '@babylonjs/core/scene'
import { AbstractMesh }    from '@babylonjs/core/Meshes/abstractMesh'
import { Vector3 }         from '@babylonjs/core/Maths/math.vector'
import { AnimationGroup }  from '@babylonjs/core/Animations/animationGroup'
import { StateMachine }    from './StateMachine'
import { InputManager }    from './InputManager'
import type { State }      from './StateMachine'

export interface ActorOptions {
  mesh:            AbstractMesh
  scene:           Scene
  speed?:          number
  runMultiplier?:  number
  gravity?:        number
  jumpForce?:      number
  input?:          InputManager
}

/**
 * Actor — base class for player and AI characters.
 * Wraps a Babylon mesh + AnimationGroup map + StateMachine.
 */
export class Actor {
  readonly mesh:    AbstractMesh
  readonly scene:   Scene
  readonly fsm:     StateMachine<Actor>

  speed:          number
  runMultiplier:  number
  gravity:        number
  jumpForce:      number
  velocity:       Vector3 = Vector3.Zero()
  grounded        = true
  input?:         InputManager

  /** Registered animations keyed by state name */
  private _anims: Map<string, AnimationGroup> = new Map()

  constructor(opts: ActorOptions) {
    this.mesh          = opts.mesh
    this.scene         = opts.scene
    this.speed         = opts.speed         ?? 4
    this.runMultiplier = opts.runMultiplier  ?? 2
    this.gravity       = opts.gravity       ?? 20
    this.jumpForce     = opts.jumpForce     ?? 10
    this.input         = opts.input
    this.fsm           = new StateMachine<Actor>(this)
  }

  /** Register an AnimationGroup under a state name */
  registerAnim(stateName: string, group: AnimationGroup): void {
    this._anims.set(stateName, group)
  }

  /** Play animation by state name with optional crossfade */
  playAnim(stateName: string, loop = true, blendTime = 0.15): void {
    this._anims.forEach((group, key) => {
      if (key === stateName) {
        group.start(loop, 1, group.from, group.to, false)
      } else {
        group.stop()
      }
    })
    void blendTime // Future: AnimationGroup blending
  }

  /** Register and transition to a named state */
  addState(state: State<Actor>): this {
    this.fsm.register(state)
    return this
  }

  setState(name: string): void {
    this.fsm.setState(name)
  }

  get position(): Vector3 { return this.mesh.position }
  get rotation(): Vector3 { return this.mesh.rotation }

  /** Called every frame by the scene or game loop */
  update(deltaS: number): void {
    this.fsm.update(deltaS)
    this.input?.flush()
  }

  dispose(): void {
    this._anims.forEach(g => g.dispose())
    this.mesh.dispose()
  }
}
