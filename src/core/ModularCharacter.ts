/**
 * ModularCharacter.ts — Grudge Engine
 *
 * Modular equipment system for race characters.
 * Loads a base body GLB (with Mixamo skeleton), then allows equipping/unequipping
 * gear in named slots. Each slot attaches to a specific bone on the skeleton.
 * Unequipped slots render nothing.
 *
 * Race definitions reuse the same base skeleton with different textures/scaling:
 *   Barbarian → BaseMale + barbarian skin
 *   Dwarf     → BaseMale (scaled 0.8) + dwarf skin
 *   Elf       → BaseFemale + elf skin
 *   Human     → BaseMale + human skin
 *   Orc       → BaseMale (scaled 1.1) + orc skin
 *   Undead    → BaseMale + undead skin
 */

import '@babylonjs/loaders/glTF'

import { Scene }           from '@babylonjs/core/scene'
import { SceneLoader }     from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh }    from '@babylonjs/core/Meshes/abstractMesh'
import { TransformNode }   from '@babylonjs/core/Meshes/transformNode'
import { Skeleton }        from '@babylonjs/core/Bones/skeleton'
import { Bone }            from '@babylonjs/core/Bones/bone'
import { AnimationGroup }  from '@babylonjs/core/Animations/animationGroup'
import { Vector3 }         from '@babylonjs/core/Maths/math.vector'
import { Texture }         from '@babylonjs/core/Materials/Textures/texture'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { normBoneName, autoNormalizeCharacter } from './character'

// ── Types ────────────────────────────────────────────────────────────────────

export type EquipSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'cape' | 'back'

export type RaceId = 'barbarian' | 'dwarf' | 'elf' | 'human' | 'orc' | 'undead'

export interface RaceDef {
  id: RaceId
  name: string
  baseModel: string            // GLB filename in models/races/
  scale: number                // uniform scale multiplier
  textureOverride?: string     // optional texture URL to swap
}

export interface SlotAttachment {
  meshes: AbstractMesh[]
  node: TransformNode
}

// ── Bone name → slot mapping (Mixamo skeleton) ──────────────────────────────
const SLOT_BONES: Record<EquipSlot, string[]> = {
  head:     ['head'],
  chest:    ['spine2', 'spine1', 'spine'],
  legs:     ['hips', 'leftupleg', 'rightupleg'],
  feet:     ['leftfoot', 'rightfoot'],
  mainHand: ['righthand', 'righthandindex1', 'handr', 'fistr'],
  offHand:  ['lefthand', 'lefthandindex1', 'handl', 'fistl'],
  cape:     ['spine2', 'spine1'],
  back:     ['spine', 'spine1'],
}

// ── Race definitions ─────────────────────────────────────────────────────────
export const RACE_DEFS: Record<RaceId, RaceDef> = {
  barbarian: { id: 'barbarian', name: 'Barbarian', baseModel: 'Bambi.glb',     scale: 1.0  },
  dwarf:     { id: 'dwarf',     name: 'Dwarf',     baseModel: 'VillHelm.glb',  scale: 0.8  },
  elf:       { id: 'elf',       name: 'Elf',       baseModel: 'BaseFemale.glb', scale: 1.0  },
  human:     { id: 'human',     name: 'Human',     baseModel: 'BaseMale.glb',  scale: 1.0  },
  orc:       { id: 'orc',       name: 'Orc',       baseModel: 'Bambi.glb',     scale: 1.1  },
  undead:    { id: 'undead',    name: 'Undead',    baseModel: 'Enchanter.glb',  scale: 1.0  },
}

// ── ModularCharacter class ───────────────────────────────────────────────────

export class ModularCharacter {
  readonly scene: Scene
  readonly race: RaceDef

  root:      AbstractMesh | null = null
  skeleton:  Skeleton | null     = null
  meshes:    AbstractMesh[]      = []
  animGroups: AnimationGroup[]   = []

  private _slots: Map<EquipSlot, SlotAttachment> = new Map()
  private _disposed = false

  constructor(scene: Scene, race: RaceId | RaceDef) {
    this.scene = scene
    this.race = typeof race === 'string' ? RACE_DEFS[race] : race
  }

  // ── Load base model ──────────────────────────────────────────────────────

  /**
   * Load the base body GLB. Call once after construction.
   * @param modelsBaseUrl  URL prefix for the models/races/ folder
   */
  async load(modelsBaseUrl: string): Promise<this> {
    const url = modelsBaseUrl.endsWith('/') ? modelsBaseUrl : modelsBaseUrl + '/'
    const result = await SceneLoader.ImportMeshAsync('', url, this.race.baseModel, this.scene)

    this.root       = result.meshes[0]
    this.meshes     = result.meshes
    this.skeleton   = result.skeletons[0] ?? null
    this.animGroups = result.animationGroups

    // Apply race scaling
    autoNormalizeCharacter(this.root)
    if (this.race.scale !== 1) {
      this.root.scaling.scaleInPlace(this.race.scale)
    }

    // Apply texture override if provided
    if (this.race.textureOverride) {
      this._applyTextureOverride(this.race.textureOverride)
    }

    return this
  }

  // ── Equipment management ─────────────────────────────────────────────────

  /**
   * Equip a GLB model to a named slot (attaches to bone).
   * Disposes any previously equipped item in that slot.
   */
  async equip(slot: EquipSlot, glbUrl: string): Promise<SlotAttachment | null> {
    if (!this.skeleton || !this.root) return null

    // Unequip existing item in this slot
    this.unequip(slot)

    // Find the target bone
    const bone = this._findSlotBone(slot)
    if (!bone) {
      console.warn(`ModularCharacter: no bone found for slot "${slot}"`)
      return null
    }

    // Load the equipment GLB
    const { rootUrl, sceneFilename } = this._splitUrl(glbUrl)
    const result = await SceneLoader.ImportMeshAsync('', rootUrl, sceneFilename, this.scene)

    // Create attachment node parented to the bone
    const node = new TransformNode(`equip_${slot}`, this.scene)
    node.attachToBone(bone, this.root)

    // Parent all loaded meshes to the attachment node
    for (const mesh of result.meshes) {
      mesh.parent = node
    }

    const attachment: SlotAttachment = { meshes: result.meshes, node }
    this._slots.set(slot, attachment)

    return attachment
  }

  /**
   * Unequip (remove + dispose) the item in a slot.
   */
  unequip(slot: EquipSlot): void {
    const existing = this._slots.get(slot)
    if (!existing) return

    for (const mesh of existing.meshes) mesh.dispose()
    existing.node.dispose()
    this._slots.delete(slot)
  }

  /**
   * Check if a slot has equipment.
   */
  hasEquipped(slot: EquipSlot): boolean {
    return this._slots.has(slot)
  }

  /**
   * Get all equipped slot names.
   */
  get equippedSlots(): EquipSlot[] {
    return [...this._slots.keys()]
  }

  // ── Visibility ───────────────────────────────────────────────────────────

  /**
   * Set visibility of the entire character (body + all equipment).
   */
  setVisible(visible: boolean): void {
    for (const mesh of this.meshes) mesh.isVisible = visible
    for (const [, att] of this._slots) {
      for (const mesh of att.meshes) mesh.isVisible = visible
    }
  }

  // ── Position / Rotation ──────────────────────────────────────────────────

  get position(): Vector3 {
    return this.root?.position ?? Vector3.Zero()
  }
  set position(v: Vector3) {
    if (this.root) this.root.position.copyFrom(v)
  }

  get rotation(): Vector3 {
    return this.root?.rotation ?? Vector3.Zero()
  }
  set rotation(v: Vector3) {
    if (this.root) this.root.rotation.copyFrom(v)
  }

  // ── Disposal ─────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    // Unequip all slots
    for (const slot of [...this._slots.keys()]) this.unequip(slot)

    // Dispose animation groups
    for (const g of this.animGroups) g.dispose()

    // Dispose meshes
    for (const m of this.meshes) m.dispose()

    this.root = null
    this.skeleton = null
    this.meshes = []
    this.animGroups = []
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _findSlotBone(slot: EquipSlot): Bone | null {
    if (!this.skeleton) return null
    const candidates = SLOT_BONES[slot]
    for (const name of candidates) {
      const bone = this.skeleton.bones.find(b => normBoneName(b.name) === name)
      if (bone) return bone
    }
    return null
  }

  private _splitUrl(url: string): { rootUrl: string; sceneFilename: string } {
    const idx = url.lastIndexOf('/')
    return {
      rootUrl:       url.slice(0, idx + 1),
      sceneFilename: url.slice(idx + 1),
    }
  }

  private _applyTextureOverride(textureUrl: string): void {
    const tex = new Texture(textureUrl, this.scene)
    for (const mesh of this.meshes) {
      if (mesh.material && (mesh.material as StandardMaterial).diffuseTexture !== undefined) {
        (mesh.material as StandardMaterial).diffuseTexture = tex
      }
    }
  }
}
