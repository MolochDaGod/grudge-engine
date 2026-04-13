/**
 * grudge/asset-manifest.ts — Canonical Shared Asset Manifest
 *
 * SINGLE SOURCE OF TRUTH for all Grudge Studio projects.
 * Referenced by: grudge-engine, Grudge-Engine-Web, GrudgeBuilder, GDevelop Assistant.
 *
 * All paths are relative to the R2 CDN root: https://assets.grudge-studio.com/
 *
 * R2 Bucket: grudge-assets
 * CDN: assets.grudge-studio.com (Cloudflare CNAME → R2 public access)
 * CORS: * (all origins)
 *
 * Directory structure on R2:
 *   models/characters/rts/     — Race base meshes (KayKit RTS style)
 *   models/characters/         — Mixamo-skeleton characters (human.glb, barbarian.glb, etc.)
 *   models/races/              — Modular race base bodies (BaseMale.glb, BaseFemale.glb, etc.)
 *   models/races/equipment/    — Equipment GLBs attached to bone slots
 *   models/races/animations/   — Mixamo animation library (60+ GLBs)
 *   models/environment/        — Environment props (trees, rocks, buildings)
 *   models/voxel/characters/   — Voxel RPG character GLBs
 *   textures/terrain/          — PBR terrain textures (grass, rock, sand, snow)
 *   textures/pbr/              — PBR material sets (albedo, normal, roughness, AO)
 *   sprites/                   — 2D sprite sheets and atlas images
 *   effects/                   — VFX textures (particles, flares, magic)
 *   audio/                     — Sound effects and music
 *   icons/                     — UI icons (items, skills, classes)
 *   ui/                        — UI backgrounds, frames, panels
 *   hdri/                      — HDRI environment maps
 */

import { assetUrl } from './assets'

// ── CDN Base URLs ────────────────────────────────────────────────────────────

export const CDN_BASE = 'https://assets.grudge-studio.com'
export const RACE_MODEL_CDN = `${CDN_BASE}/models/characters/rts`
export const CHAR_MODEL_CDN = `${CDN_BASE}/models/characters`
export const ANIM_CDN = `${CDN_BASE}/models/races/animations`
export const MODULAR_CDN = `${CDN_BASE}/models/races`
export const ENV_CDN = `${CDN_BASE}/models/environment`
export const TEXTURE_CDN = `${CDN_BASE}/textures`
export const SPRITE_CDN = `${CDN_BASE}/sprites`
export const AUDIO_CDN = `${CDN_BASE}/audio`
export const ICON_CDN = `${CDN_BASE}/icons`
export const HDRI_CDN = `${CDN_BASE}/hdri`

// ── Race Models (KayKit RTS) ─────────────────────────────────────────────────
// Used by: grudge-engine character showcase, Grudge-Engine-Web /three demo,
//          GrudgeBuilder 3D character viewer

export interface RaceModelEntry {
  file: string
  label: string
  faction: 'Crusade' | 'Legion' | 'Fabled'
  spriteSet: string
  scale: number
}

export const GRUDGE_RACE_MODELS: Record<string, RaceModelEntry> = {
  human:     { file: 'Knight_Male.glb',   label: 'Human',     faction: 'Crusade', spriteSet: 'Soldier',        scale: 1.0  },
  barbarian: { file: 'BarbarianGlad.glb', label: 'Barbarian', faction: 'Crusade', spriteSet: 'Armored Axeman', scale: 1.05 },
  undead:    { file: 'berserker.glb',     label: 'Undead',    faction: 'Legion',  spriteSet: 'Skeleton',       scale: 1.0  },
  orc:       { file: 'King.glb',          label: 'Orc',       faction: 'Legion',  spriteSet: 'Orc',            scale: 1.1  },
  elf:       { file: 'Wizard.glb',        label: 'Elf',       faction: 'Fabled',  spriteSet: 'Archer',         scale: 1.0  },
  dwarf:     { file: 'Viking_Male.glb',   label: 'Dwarf',     faction: 'Fabled',  spriteSet: 'Knight',         scale: 0.9  },
}

export const RACE_IDS = Object.keys(GRUDGE_RACE_MODELS)
export const DEFAULT_RACE = 'human'

export const FACTION_RACES: Record<string, string[]> = {
  Crusade: ['human', 'barbarian'],
  Legion:  ['undead', 'orc'],
  Fabled:  ['elf', 'dwarf'],
}

// ── Class definitions ────────────────────────────────────────────────────────

export const CLASS_IDS = ['worg', 'warrior', 'mage', 'ranger'] as const
export type ClassId = typeof CLASS_IDS[number]

export const CLASS_LABELS: Record<ClassId, string> = {
  worg:    'Worg Shapeshifter',
  warrior: 'Warrior',
  mage:    'Mage Priest',
  ranger:  'Ranger Scout',
}

export type WeaponType = 'sword-shield' | 'greatsword' | 'longbow' | 'magic' | 'unarmed'

export const CLASS_WEAPON_MAP: Record<ClassId, WeaponType> = {
  warrior: 'sword-shield',
  ranger:  'longbow',
  mage:    'magic',
  worg:    'greatsword',
}

// ── Animation Manifest (shared by BabylonJS + Three.js) ──────────────────────
// Maps gameplay state key → GLB filename (without extension) on R2

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
  sword_powerup:               'sword_and_shield_power_up',
  sword_cast:                  'sword_and_shield_casting',

  // Melee — combos
  club_combo:                  'one_hand_club_combo',
  sword_combo:                 'one_hand_sword_combo',
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

  // Utility
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

// ── Modular Character Base Bodies ────────────────────────────────────────────

export type ModularBodyId = 'BaseMale' | 'BaseFemale' | 'Bambi' | 'VillHelm' | 'Enchanter'

export const MODULAR_BODIES: Record<string, { file: string; label: string }> = {
  BaseMale:   { file: 'BaseMale.glb',   label: 'Base Male'   },
  BaseFemale: { file: 'BaseFemale.glb', label: 'Base Female' },
  Bambi:      { file: 'Bambi.glb',      label: 'Bambi'       },
  VillHelm:   { file: 'VillHelm.glb',   label: 'VillHelm'    },
  Enchanter:  { file: 'Enchanter.glb',  label: 'Enchanter'   },
}

// ── Equipment Slots ──────────────────────────────────────────────────────────

export type EquipSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'cape' | 'back'

export const SLOT_BONE_NAMES: Record<EquipSlot, string[]> = {
  head:     ['head'],
  chest:    ['spine2', 'spine1', 'spine'],
  legs:     ['hips', 'leftupleg', 'rightupleg'],
  feet:     ['leftfoot', 'rightfoot'],
  mainHand: ['righthand', 'righthandindex1', 'handr'],
  offHand:  ['lefthand', 'lefthandindex1', 'handl'],
  cape:     ['spine2', 'spine1'],
  back:     ['spine', 'spine1'],
}

// ── Terrain Textures ─────────────────────────────────────────────────────────

export const TERRAIN_TEXTURES = {
  grass:  { albedo: 'terrain/grass_albedo.jpg',  normal: 'terrain/grass_normal.jpg'  },
  rock:   { albedo: 'terrain/rock_albedo.jpg',   normal: 'terrain/rock_normal.jpg'   },
  sand:   { albedo: 'terrain/sand_albedo.jpg',   normal: 'terrain/sand_normal.jpg'   },
  snow:   { albedo: 'terrain/snow_albedo.jpg',   normal: 'terrain/snow_normal.jpg'   },
  dirt:   { albedo: 'terrain/dirt_albedo.jpg',   normal: 'terrain/dirt_normal.jpg'   },
}

// ── URL Helpers ──────────────────────────────────────────────────────────────

export function raceModelUrl(raceId: string): string {
  const entry = GRUDGE_RACE_MODELS[raceId.toLowerCase()] ?? GRUDGE_RACE_MODELS[DEFAULT_RACE]
  return `${RACE_MODEL_CDN}/${entry.file}`
}

export function animUrl(key: string): string {
  const filename = ANIM_MANIFEST[key]
  if (!filename) throw new Error(`Unknown animation key: "${key}"`)
  return `${ANIM_CDN}/${filename}.glb`
}

export function modularBodyUrl(id: string): string {
  const entry = MODULAR_BODIES[id] ?? MODULAR_BODIES['BaseMale']
  return `${MODULAR_CDN}/${entry.file}`
}

export function equipmentUrl(name: string): string {
  return `${MODULAR_CDN}/equipment/${name}.glb`
}

export function terrainTextureUrl(terrain: keyof typeof TERRAIN_TEXTURES, map: 'albedo' | 'normal'): string {
  return assetUrl(`textures/${TERRAIN_TEXTURES[terrain][map]}`)
}

// ── Full Asset Index (for verification/preloading) ───────────────────────────

/** Returns all asset URLs that should exist on R2 */
export function getAllAssetUrls(): string[] {
  const urls: string[] = []

  // Race models
  for (const entry of Object.values(GRUDGE_RACE_MODELS)) {
    urls.push(`${RACE_MODEL_CDN}/${entry.file}`)
  }

  // Animation GLBs
  for (const filename of Object.values(ANIM_MANIFEST)) {
    urls.push(`${ANIM_CDN}/${filename}.glb`)
  }

  // Modular bodies
  for (const entry of Object.values(MODULAR_BODIES)) {
    urls.push(`${MODULAR_CDN}/${entry.file}`)
  }

  return urls
}
