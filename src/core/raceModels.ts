/**
 * Grudge Race & Class → 3D Model Mapping
 *
 * Canonical mapping shared across ALL Grudge games and tools.
 * Must match the definitions in Grudge-Builder/client/src/lib/gameData.ts:
 *   6 Races: Human, Barbarian, Undead, Orc, Elf, Dwarf
 *   4 Classes: Worg Shapeshifter, Warrior, Mage Priest, Ranger Scout
 *   3 Factions: Crusade (Human, Barbarian), Legion (Undead, Orc), Fabled (Elf, Dwarf)
 *
 * Also used by:
 *   - GDevelop Assistant characters.tsx / grudgeBackendApi.ts
 *   - ObjectStore 3D_MODELS.html (GRUDGE_RACE_MODELS)
 *
 * All GLB models served from assets.grudge-studio.com (R2 CDN, CORS: *).
 */

export const RACE_MODEL_CDN = 'https://assets.grudge-studio.com/models/characters/rts'

export interface RaceModelEntry {
  /** GLB filename on R2 */
  file: string
  /** Display label */
  label: string
  /** Faction: Crusade, Legion, or Fabled */
  faction: 'Crusade' | 'Legion' | 'Fabled'
  /** Matching 2D sprite set from gameData.ts */
  spriteSet: string
  /** Default scale multiplier (1.0 = identity) */
  scale?: number
}

/**
 * 6 Races → GLB model mapping.
 * Keys are lowercase race IDs matching gameData.ts and the Grudge backend schema.
 */
export const GRUDGE_RACE_MODELS: Record<string, RaceModelEntry> = {
  human:     { file: 'Knight_Male.glb',    label: 'Human',     faction: 'Crusade', spriteSet: 'Soldier',       scale: 1.0 },
  barbarian: { file: 'BarbarianGlad.glb',  label: 'Barbarian', faction: 'Crusade', spriteSet: 'Armored Axeman', scale: 1.05 },
  undead:    { file: 'berserker.glb',      label: 'Undead',    faction: 'Legion',  spriteSet: 'Skeleton',      scale: 1.0 },
  orc:       { file: 'King.glb',           label: 'Orc',       faction: 'Legion',  spriteSet: 'Orc',           scale: 1.1 },
  elf:       { file: 'Wizard.glb',         label: 'Elf',       faction: 'Fabled',  spriteSet: 'Archer',        scale: 1.0 },
  dwarf:     { file: 'Viking_Male.glb',    label: 'Dwarf',     faction: 'Fabled',  spriteSet: 'Knight',        scale: 0.9 },
}

export const DEFAULT_RACE = 'human'

/** All valid race IDs */
export const RACE_IDS = Object.keys(GRUDGE_RACE_MODELS) as string[]

/** Faction → race ID list */
export const FACTION_RACES: Record<string, string[]> = {
  Crusade: ['human', 'barbarian'],
  Legion:  ['undead', 'orc'],
  Fabled:  ['elf', 'dwarf'],
}

/**
 * 4 Classes — IDs match gameData.ts CLASSES[].id
 * Classes don't change the base mesh but may override the sprite set.
 */
export const CLASS_IDS = ['worg', 'warrior', 'mage', 'ranger'] as const
export type ClassId = typeof CLASS_IDS[number]

export const CLASS_LABELS: Record<ClassId, string> = {
  worg:    'Worg Shapeshifter',
  warrior: 'Warrior',
  mage:    'Mage Priest',
  ranger:  'Ranger Scout',
}

/** Get the full CDN URL for a race's GLB model */
export function raceModelUrl(race: string): string {
  const entry = GRUDGE_RACE_MODELS[race.toLowerCase()] ?? GRUDGE_RACE_MODELS[DEFAULT_RACE]
  return `${RACE_MODEL_CDN}/${entry.file}`
}

/** Get the display label for a race */
export function raceLabel(race: string): string {
  const entry = GRUDGE_RACE_MODELS[race.toLowerCase()] ?? GRUDGE_RACE_MODELS[DEFAULT_RACE]
  return entry.label
}

/** Get the RaceModelEntry (or default) */
export function getRaceModel(race: string): RaceModelEntry {
  return GRUDGE_RACE_MODELS[race.toLowerCase()] ?? GRUDGE_RACE_MODELS[DEFAULT_RACE]
}
