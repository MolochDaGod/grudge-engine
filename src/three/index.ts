/**
 * Grudge Engine — Three.js Backend
 *
 * Import from 'src/three' to use the Three.js rendering backend.
 * Import from 'src/core' for the BabylonJS backend (default).
 *
 * Both backends share:
 *   - src/shared/interfaces.ts — engine-agnostic interfaces
 *   - src/core/StateMachine.ts — FSM (pure logic, no renderer dependency)
 *   - src/core/InputManager.ts — keyboard/mouse input (DOM events only)
 *   - src/core/constants.ts    — shared gameplay constants
 *   - src/core/raceModels.ts   — race/class definitions
 *   - src/core/AnimationLibrary.ts — ANIM_MANIFEST (shared animation keys)
 *   - src/grudge/assets.ts     — R2 CDN asset URL resolver
 */

export { ThreeEngine }              from './ThreeEngine'
export type { ThreeEngineOptions }  from './ThreeEngine'

export { ThreeBaseScene }           from './ThreeBaseScene'

export { ThreeActor }               from './ThreeActor'
export type { ThreeActorOptions }   from './ThreeActor'

export { ThreeAnimationLibrary }    from './ThreeAnimationLibrary'

export {
  loadModel,
  loadRaceModel,
  autoNormalizeCharacter,
}                                   from './ThreeModelLoader'
export type { ThreeModelResult, NormalizeResult } from './ThreeModelLoader'

export {
  enableCannonPhysics,
  getCannonWorld,
  createStaticBox,
  createDynamicBox,
  createDynamicCapsule,
  createStaticMesh,
  syncBodyToMesh,
  stepPhysics,
  raycast,
  disposeCannonPhysics,
  CollisionGroup,
}                                   from './ThreePhysics'
export type { BodyOptions, RayHit } from './ThreePhysics'
