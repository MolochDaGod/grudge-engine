// game/constants.ts — ported from mortarcommand/src/components/constants.js

export interface LevelDef {
  agents: number[]
  artifacts: { small: number; med: number; large: number }
  tip: string
}

export const GAME_LEVELS: LevelDef[] = [
  { agents:[100,100,100,100], artifacts:{small:1,med:1,large:2}, tip:'Tip: If things are moving a bit slowly, make your browser window smaller.' },
  { agents:[100,100,100,100,100,100], artifacts:{small:2,med:1,large:2}, tip:'Tip: When a hologram appears, shoot the activator at the pedestal base to unlock assets.' },
  { agents:[100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: When the green progress bar is full your heavy mortar is ready (space-bar)' },
  { agents:[100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: Damaged bots will move more slowly.' },
  { agents:[100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: Use mouse buttons to pan/rotate/zoom if you want.' },
  { agents:[100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: Destroy ore deposits to delay the bots.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Send suggestions to mortarcommander@gmail.com' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: The larger ore deposits do more damage to your stations.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: Activators are created as your score increases.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Tip: You cannot damage your own stations.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'There are 20 levels in this version.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'The mines activator will deploy up to 3 proximity mines.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'The health activator will repair one destroyed station.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'The boost activator will increase mortar lethality.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Mortars are like real estate, location is everything.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'You can use the Q-key or the Z-key or the M-key to fire.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'You are doing well, commander.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'Two more levels.' },
  { agents:[100], artifacts:{small:2,med:2,large:3}, tip:'The calm before the storm.' },
  { agents:[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100], artifacts:{small:2,med:2,large:3}, tip:'The storm.' },
]

export const AGENT_MAX_SPEED  = 0.3
export const AGENT_MIN_SPEED  = 0.15
export const AGENT_SIZE       = 1.3
export const AGENT_SENSOR_RADIUS = 4
export const AGENT_MAX_HEALTH = 100

export const phases = {
  SEEK_ARTIFACT_ZONE: 'Seek Artifact Zone',
  LOCATE_ARTIFACT:    'Locate Artifact',
  COLLECT_ARTIFACT:   'Collect Artifact',
  SEEK_STATION:       'Seek Station',
} as const
export type Phase = typeof phases[keyof typeof phases]

export const ARTIFACT_TYPES = {
  small:  { mass: 1, scale: 0.6 },
  medium: { mass: 4, scale: 1 },
  large:  { mass: 8, scale: 1.5 },
} as const

export const ARTIFACT_SIZE          = 1
export const ARTIFACT_MAX_HEALTH    = 20
export const ARTIFACT_INTERACT_COEFF = 1.5
export const ARTIFACT_ZONE_LINE     = -12.5
export const ARTIFACT_AREA = { xMin: -22.55, xMax: -14.55, zMin: -11.5, zMax: 11.5 }

export const STATION_SIZE          = 1
export const STATION_INTERACT_COEFF = 2.5
export const STATION_MAX_HEALTH    = 12

export const FRAMETHRESH_GUI = 20

export const VEL_COEFF = 100

export const FIELD_EXTENTS = { xMax: 24.6, xMin: -24.6, zMax: 14.6, zMin: -14.6 }
export const ROUND_EXTENTS = { xMax: 27.6, xMin: -27.6, zMax: 17.6, zMin: -17.6 }
export const GUTTER_WIDTH  = 2

export const edge = { NONE:'+none', PLUS_X:'+x', MINUS_X:'-x', PLUS_Z:'+z', MINUS_Z:'-z' } as const
export type Edge = typeof edge[keyof typeof edge]

export const hotgrid = {
  CELL_SIZE: 3,
  ROWS:      9,
  COLUMNS:   4,
  extents: { XMIN: -24.55, XMAX: -12.55, ZMIN: -13.5, ZMAX: 13.5 },
}

export const MAX_ROUNDS     = 4
export const ROUND_PHASES   = { ready:'ready', launched:'launched', detonated:'detonated' } as const
export type RoundPhase = typeof ROUND_PHASES[keyof typeof ROUND_PHASES]

export const ROUND_TYPES    = { gun:'gun', mortar:'mortar', thePackage:'thePackage' } as const
export type RoundType = typeof ROUND_TYPES[keyof typeof ROUND_TYPES]

export const GUN_RANGE      = 24.0
export const GUN_VELOCITY   = 1
export const MORTAR_VELOCITY = 0.55
export const PACKAGE_VELOCITY = 0.3
export const GUN_POSITION   = { x: 24, y: 7, z: 0 }
export const BLAST_ALPHA    = 0.9
export const MORTAR_BLAST_RADIUS_START = 1
export const MORTAR_BLAST_LIFE = 10
export const GUN_BLAST_RADIUS_START = 0.3
export const GUN_BLAST_LIFE = 8

export const POINTS_AGENT_HIT    = 50
export const POINTS_ARTIFACT_HIT = 10

export const GAME_PHASES = {
  startLevel: 'startLevel',
  playing:    'playing',
  endLevel:   'endLevel',
  gameOver:   'gameOver',
} as const
export type GamePhase = typeof GAME_PHASES[keyof typeof GAME_PHASES]

export const PACKAGE_POINTS_THRESH = 12000
export const MORTAR_BOOST_LIFE     = 1000
export const LEVELS_MODE           = 'manual'

export const AGENT_TRAIL_COLOR1    = [.5,  .5,  0.3, 1.0]
export const AGENT_TRAIL_COLOR2    = [.4,  .4,  0.2, 1.0]
export const AGENT_TRAIL_COLOR_DEAD = [0.3, 0.1, 0,   0.0]
export const WATER_TRAIL_COLOR1    = [.5,  .5,  1,   1.0]
export const WATER_TRAIL_COLOR2    = [.2,  .25, .4,  1.0]
export const WATER_TRAIL_COLOR_DEAD = [0,  .1,  .3,  0.0]
