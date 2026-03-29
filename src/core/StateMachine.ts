export interface State<TOwner> {
  readonly name: string
  enter(owner: TOwner, from?: State<TOwner>): void
  update(owner: TOwner, deltaS: number): void
  exit(owner: TOwner): void
}

/**
 * Generic finite state machine.
 * TOwner is the object that owns this FSM (e.g. Actor).
 * States are registered by name; transition via setState().
 */
export class StateMachine<TOwner> {
  private _states  = new Map<string, State<TOwner>>()
  private _current: State<TOwner> | null = null
  private _owner:   TOwner

  constructor(owner: TOwner) {
    this._owner = owner
  }

  get current(): State<TOwner> | null { return this._current }
  get currentName(): string           { return this._current?.name ?? '' }

  register(state: State<TOwner>): this {
    this._states.set(state.name, state)
    return this
  }

  setState(name: string): void {
    const next = this._states.get(name)
    if (!next) { console.warn(`[StateMachine] Unknown state: "${name}"`); return }
    if (next === this._current) return

    const prev = this._current
    prev?.exit(this._owner)
    this._current = next
    next.enter(this._owner, prev ?? undefined)
  }

  update(deltaS: number): void {
    this._current?.update(this._owner, deltaS)
  }
}
