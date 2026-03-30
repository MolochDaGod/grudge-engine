/**
 * AnimationLibrary.ts — Grudge Engine
 *
 * Loads a library of animation GLBs (converted from Mixamo FBXs) and retargets
 * them onto any character skeleton. Provides a state-machine-friendly API
 * where you play animations by gameplay state name (e.g. "idle", "sword_attack").
 *
 * Usage:
 *   const lib = new AnimationLibrary(scene)
 *   await lib.loadAll('/models/races/animations/')
 *   lib.retargetTo(character.skeleton!)
 *   lib.play('idle', true)
 *   lib.play('sword_and_shield_attack')
 */

import '@babylonjs/loaders/glTF'

import { Scene }           from '@babylonjs/core/scene'
import { SceneLoader }     from '@babylonjs/core/Loading/sceneLoader'
import { Skeleton }        from '@babylonjs/core/Bones/skeleton'
import { AnimationGroup }  from '@babylonjs/core/Animations/animationGroup'
import { retargetAnimationGroup } from './character'

// ── Animation manifest ───────────────────────────────────────────────────────
// Maps a gameplay state key → the GLB filename (without .glb extension).
// These filenames match the output of scripts/convert-fbx-to-glb.js.

export const ANIM_MANIFEST: Record<string, string> = {
  // Locomotion
  idle:                        'idle',
  walk:                        'swagger_walk',
  run:                         'dancing_running_man',
  crouch_idle:                 'crouch_idle',
  crouch_enter:                'standing_to_crouch',
  crouch_exit:                 'cover_to_stand',
  climb:                       'climbing_ladder',
  sit:                         'male_sitting_pose',

  // Melee — 1H Sword
  sword_attack_1:              'sword_and_shield_attack',
  sword_attack_2:              'sword_and_shield_attack_1',
  sword_attack_3:              'sword_and_shield_attack_2',
  sword_slash_1:               'sword_and_shield_slash',
  sword_slash_2:               'sword_and_shield_slash_1',
  sword_slash_3:               'sword_and_shield_slash_1',
  sword_powerup:               'sword_and_shield_power_up',
  sword_cast:                  'sword_and_shield_casting',

  // Melee — 1H Club / Mace
  club_combo:                  'one_hand_club_combo',
  sword_combo:                 'one_hand_sword_combo',

  // Melee — 2H
  greatsword_slash_1:          'great_sword_slash',
  greatsword_slash_2:          'great_sword_slash_1',
  two_hand_club_combo:         'two_hand_club_combo',
  two_hand_sword_combo:        'two_hand_sword_combo',
  dual_weapon_combo:           'dual_weapon_combo',

  // Magic
  spell_cast:                  'spell_casting',
  cast_1h:                     'standing_1h_cast_spell_01',
  cast_2h:                     'standing_2h_cast_spell_01',
  magic_area_1:                'standing_2h_magic_area_attack_01',
  magic_area_2:                'standing_2h_magic_area_attack_02',
  magic_attack_1:              'standing_2h_magic_attack_01',
  magic_attack_2:              'standing_2h_magic_attack_03',
  magic_attack_3:              'standing_2h_magic_attack_04',

  // Ranged / Utility
  kick:                        'kick',
  throw:                       'throw_object',
  disarmed:                    'disarmed',

  // Social / Emotes
  battlecry:                   'standing_taunt_battlecry',
  dance_bboy:                  'bboy_hip_hop_move',
  dance_hiphop:                'hip_hop_dancing',
  dance_silly:                 'silly_dancing',
  dance_spin:                  'northern_soul_spin_combo',
  react:                       'reacting',
  pat:                         'patting',
  look_around:                 'look_over_shoulder',
}

// ── AnimationLibrary class ───────────────────────────────────────────────────

export class AnimationLibrary {
  readonly scene: Scene

  /** Raw loaded AnimationGroups keyed by manifest key (before retargeting) */
  private _sourceGroups: Map<string, AnimationGroup> = new Map()

  /** Retargeted AnimationGroups keyed by manifest key (after retargetTo) */
  private _retargetedGroups: Map<string, AnimationGroup> = new Map()

  /** Currently playing animation key */
  private _currentKey: string | null = null

  private _loaded = false

  constructor(scene: Scene) {
    this.scene = scene
  }

  /** Whether the library has been loaded */
  get loaded(): boolean { return this._loaded }

  /** Number of animations loaded */
  get count(): number { return this._sourceGroups.size }

  /** List of available animation keys */
  get keys(): string[] { return [...this._sourceGroups.keys()] }

  // ── Loading ──────────────────────────────────────────────────────────────

  /**
   * Load all animations from the manifest.
   * @param baseUrl  URL to the animations/ folder (e.g. '/models/races/animations/')
   */
  async loadAll(baseUrl: string): Promise<number> {
    const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    let loaded = 0

    const entries = Object.entries(ANIM_MANIFEST)
    console.log(`AnimationLibrary: loading ${entries.length} animations…`)

    for (const [key, filename] of entries) {
      try {
        const result = await SceneLoader.ImportMeshAsync('', url, filename + '.glb', this.scene)

        // The last animation group added to the scene is our target
        const group = this.scene.animationGroups[this.scene.animationGroups.length - 1]
        if (group) {
          group.stop()
          group.name = key
          this._sourceGroups.set(key, group)
          loaded++
        }

        // Dispose the dummy meshes from the animation GLB (we only want the anim data)
        for (const m of result.meshes) m.dispose()
      } catch (e) {
        console.warn(`AnimationLibrary: failed to load "${key}" (${filename}.glb):`, e)
      }
    }

    this._loaded = true
    console.log(`AnimationLibrary: ${loaded}/${entries.length} loaded`)
    return loaded
  }

  /**
   * Load a single animation by manifest key.
   */
  async loadOne(key: string, baseUrl: string): Promise<boolean> {
    const filename = ANIM_MANIFEST[key]
    if (!filename) { console.warn(`AnimationLibrary: unknown key "${key}"`); return false }

    const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
    try {
      const result = await SceneLoader.ImportMeshAsync('', url, filename + '.glb', this.scene)
      const group = this.scene.animationGroups[this.scene.animationGroups.length - 1]
      if (group) {
        group.stop()
        group.name = key
        this._sourceGroups.set(key, group)
      }
      for (const m of result.meshes) m.dispose()
      return true
    } catch { return false }
  }

  // ── Retargeting ──────────────────────────────────────────────────────────

  /**
   * Retarget all loaded animations onto a new skeleton.
   * Call this after loading animations AND after loading the character.
   */
  retargetTo(skeleton: Skeleton): number {
    // Dispose any previously retargeted groups
    for (const [, g] of this._retargetedGroups) g.dispose()
    this._retargetedGroups.clear()

    let mapped = 0
    for (const [key, source] of this._sourceGroups) {
      const retargeted = retargetAnimationGroup(source, skeleton, `rt_${key}`, this.scene)
      if (retargeted) {
        this._retargetedGroups.set(key, retargeted)
        mapped++
      }
    }

    console.log(`AnimationLibrary: retargeted ${mapped}/${this._sourceGroups.size} to skeleton`)
    return mapped
  }

  // ── Playback ─────────────────────────────────────────────────────────────

  /**
   * Play an animation by state key. Stops the current animation first.
   * @param key     Manifest key (e.g. "idle", "sword_attack_1")
   * @param loop    Whether to loop. Default: false
   * @param speed   Playback speed multiplier. Default: 1.0
   * @returns       The playing AnimationGroup, or null if not found
   */
  play(key: string, loop = false, speed = 1.0): AnimationGroup | null {
    // Stop current
    if (this._currentKey) {
      const current = this._retargetedGroups.get(this._currentKey) ?? this._sourceGroups.get(this._currentKey)
      current?.stop()
    }

    // Find retargeted first, fall back to source
    const group = this._retargetedGroups.get(key) ?? this._sourceGroups.get(key)
    if (!group) {
      console.warn(`AnimationLibrary: no animation for key "${key}"`)
      return null
    }

    group.start(loop, speed)
    this._currentKey = key
    return group
  }

  /**
   * Cross-fade from current animation to a new one.
   * @param key       Target animation key
   * @param duration  Blend duration in seconds
   * @param loop      Whether to loop the target
   */
  crossFade(key: string, duration = 0.2, loop = false): AnimationGroup | null {
    const target = this._retargetedGroups.get(key) ?? this._sourceGroups.get(key)
    if (!target) return null

    // Simple cross-fade: start target, let current fade out naturally
    // BJS doesn't have built-in blending between groups yet, so we do stop → start
    if (this._currentKey && this._currentKey !== key) {
      const current = this._retargetedGroups.get(this._currentKey) ?? this._sourceGroups.get(this._currentKey)
      current?.stop()
    }

    target.start(loop, 1.0)
    this._currentKey = key
    void duration // reserved for future weight-based blending
    return target
  }

  /** Stop the currently playing animation */
  stop(): void {
    if (this._currentKey) {
      const group = this._retargetedGroups.get(this._currentKey) ?? this._sourceGroups.get(this._currentKey)
      group?.stop()
      this._currentKey = null
    }
  }

  /** Get the AnimationGroup for a key (retargeted if available) */
  get(key: string): AnimationGroup | null {
    return this._retargetedGroups.get(key) ?? this._sourceGroups.get(key) ?? null
  }

  /** Currently playing animation key */
  get currentKey(): string | null { return this._currentKey }

  // ── Disposal ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.stop()
    for (const [, g] of this._retargetedGroups) g.dispose()
    for (const [, g] of this._sourceGroups) g.dispose()
    this._retargetedGroups.clear()
    this._sourceGroups.clear()
    this._currentKey = null
    this._loaded = false
  }
}
