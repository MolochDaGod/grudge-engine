/**
 * character.ts — Grudge Engine character loading utilities
 *
 * Provides three essential helpers for robust character loading:
 *
 *  normBoneName           — normalise a bone name for skeleton-agnostic retargeting
 *                           (strips Mixamo "mixamorig:" prefix, punctuation, case)
 *
 *  autoNormalizeCharacter — auto-scales a character root mesh to a target height.
 *                           Handles Mixamo FBX exports (~100:1 cm scale) as well
 *                           as oversized / undersized models. Safe to call even
 *                           when the character is already in the correct range.
 *
 *  retargetAnimationGroup — maps an AnimationGroup from one skeleton to another
 *                           using normalised bone-name matching. Returns null when
 *                           no bones could be mapped.
 *
 * Usage
 * -----
 *   import { autoNormalizeCharacter, retargetAnimationGroup } from '../../../src/core/character'
 *
 *   const result = await SceneLoader.ImportMeshAsync(...)
 *   autoNormalizeCharacter(result.meshes[0])        // ← normalise to 1.8 m
 *   const retargeted = retargetAnimationGroup(      // ← retarget anim library
 *     sourceGroup, result.skeletons[0], 'idle', scene
 *   )
 */

import { AbstractMesh }   from '@babylonjs/core/Meshes/abstractMesh'
import { Skeleton }       from '@babylonjs/core/Bones/skeleton'
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { Scene }          from '@babylonjs/core/scene'

// ── Bone-name normaliser ─────────────────────────────────────────────────────

/**
 * Normalise a bone name so that Mixamo, KayKit, and generic skeletons can be
 * compared against each other during retargeting.
 *
 * Steps applied:
 *  1. Strip leading `mixamorig:` or `mixamorig` prefix (case-insensitive)
 *  2. Remove all punctuation / whitespace / separators (. - _ : space)
 *  3. Lower-case the result
 *
 * Examples
 *   "mixamorig:Hips"  → "hips"
 *   "Hips"            → "hips"
 *   "hand_r"          → "handr"
 *   "RightHand"       → "righthand"
 */
export function normBoneName(name: string): string {
  return name
    .replace(/^mixamorig:/i, '')
    .replace(/^mixamorig/i,  '')
    .replace(/[.\-\s_:]/g,   '')
    .toLowerCase()
}

// ── Auto-scale normalisation ─────────────────────────────────────────────────

/** Result from autoNormalizeCharacter */
export interface NormalizeResult {
  /** Scale factor that was applied (1 = no change). */
  scale: number
  /** Measured height of the mesh hierarchy before scaling, in original units. */
  rawHeight: number
  /** Whether the scale was adjusted (false = height was already in range). */
  adjusted: boolean
}

/**
 * Auto-scale a loaded character root mesh so its height equals `targetMeters`.
 *
 * Why this is needed
 * ------------------
 * Mixamo characters downloaded as FBX and converted to GLB retain cm-scale
 * units: a character that is 180 cm tall will have a bounding-box height of
 * ~180 scene-units (instead of 1.8 m).  Placing an ArcRotateCamera at radius 5
 * targeting `Vector3(0, 1, 0)` would put the viewpoint inside the character's
 * ankle — making it appear invisible.
 *
 * Safe ranges
 * -----------
 *  Height 0.5 – 3.0 m → assumed already correct, no scaling applied.
 *  Height > 3.0        → divide down to targetMeters (typical Mixamo FBX at 100:1).
 *  Height < 0.5        → scale up to targetMeters (tiny/voxel exports).
 *
 * @param root          Root mesh of the loaded character (result.meshes[0]).
 * @param targetMeters  Desired height in scene units. Default 1.8 (average human).
 * @returns             NormalizeResult with the scale applied and raw height.
 */
export function autoNormalizeCharacter(
  root: AbstractMesh,
  targetMeters = 1.8,
): NormalizeResult {
  const bounds    = root.getHierarchyBoundingVectors(true)
  const rawHeight = bounds.max.y - bounds.min.y

  const inRange = rawHeight >= 0.5 && rawHeight <= 3.0
  if (inRange) {
    return { scale: 1, rawHeight, adjusted: false }
  }

  const scale = targetMeters / Math.max(rawHeight, 0.001)
  root.scaling.scaleInPlace(scale)

  return { scale, rawHeight, adjusted: true }
}

// ── Animation retargeting ────────────────────────────────────────────────────

/**
 * Retarget an AnimationGroup from one skeleton to another using normalised
 * bone-name matching (via `normBoneName`).
 *
 * How it works
 * ------------
 * For each TargetedAnimation in `source`, the target bone is looked up in
 * `targetSkeleton` by comparing their normalised names.  If a match is found
 * the animation curve is added to the new group, otherwise it is skipped.
 *
 * This means a single UAL (Universal Animation Library) file recorded on a
 * Mixamo skeleton can drive any KayKit or generic humanoid skeleton that shares
 * the same bone layout, regardless of naming conventions.
 *
 * @param source          The source AnimationGroup (e.g. from a UAL GLB).
 * @param targetSkeleton  The skeleton to drive.
 * @param newName         Name for the resulting AnimationGroup.
 * @param scene           Active Babylon.js scene.
 * @returns               The retargeted group, or null if no bones were mapped.
 */
export function retargetAnimationGroup(
  source: AnimationGroup,
  targetSkeleton: Skeleton,
  newName: string,
  scene: Scene,
): AnimationGroup | null {
  const group  = new AnimationGroup(newName, scene)
  let   mapped = 0

  for (const ta of source.targetedAnimations) {
    const srcBone = ta.target as any
    const srcNorm = normBoneName(srcBone?.name ?? srcBone?.id ?? '')
    if (!srcNorm) continue

    const dstBone = targetSkeleton.bones.find(b => normBoneName(b.name) === srcNorm)
    if (dstBone) {
      group.addTargetedAnimation(ta.animation, dstBone)
      mapped++
    }
  }

  if (mapped === 0) { group.dispose(); return null }
  return group
}
