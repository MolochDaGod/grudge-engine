import { Vector3 } from '@babylonjs/core/Maths/math.vector'

export const CIRCLE = 2 * Math.PI
export const DEGREE = Math.PI / 180
export const RIGHT_ANGLE = Math.PI * 0.5

export const dir = {
  forward:    new Vector3(0, 0, 1),
  backward:   new Vector3(0, 0, -1),
  left:       new Vector3(-1, 0, 0),
  right:      new Vector3(1, 0, 0),
  up:         new Vector3(0, 1, 0),
  down:       new Vector3(0, -1, 0),
  upForward:  new Vector3(0, 1, 1),
  upBackward: new Vector3(0, 1, -1),
}

export const JumpStyle = {
  ANIM_JUMP: 'ANIM_JUMP',
  FLY_JUMP:  'FLY_JUMP',
  FLY:       'FLY',
} as const

export const AttackStyle = {
  ONCE: 'ONCE',
  LOOP: 'LOOP',
} as const

export const Reaction = {
  BOUNCE:       'BOUNCE',
  TURN_SMOOTH:  'TURN_SMOOTH',
  STEP_OFF:     'STEP_OFF',
  STOP:         'STOP',
} as const

/** Base AI/Actor states */
export const BaseState = {
  idle:    'idle',
  walk:    'walk',
  run:     'run',
  jump:    'jump',
  fall:    'fall',
  attack:  'attack',
  hurt:    'hurt',
  die:     'die',
  patrol:  'patrol',
  wander:  'wander',
  flee:    'flee',
  follow:  'follow',
  defend:  'defend',
} as const

export type BaseStateName = keyof typeof BaseState
