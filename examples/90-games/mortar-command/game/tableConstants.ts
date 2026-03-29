// game/tableConstants.ts — ported from per-table-constants.js
export const MORTAR_YPEAK       = 7
export const TERRAIN_MESH_NAME  = 'TerrainMesh_primitive0'
export const LEVELS_MODE        = 'manual'
export const GLTF_FILE          = 'NTC_Draco.gltf'
export const MC_TABLE_XFORM     = { pos: [-25, 2.5, 14.6] as [number,number,number], scale: [50, 100, -50] as [number,number,number] }
export const TABLE_BACKGROUND_ALPHA = 0.95
export const MC_SCENE_CLEAR_COLOR   = [0.38, 0.36, 0.41] as [number,number,number]
export const MC_NUM_LIGHTS      = 1
export const MC_LIGHT1_POS      = [0.2, 1, 0.2] as [number,number,number]
export const MC_LIGHT1_INTENSITY = 1
export const CHANGE_LIGHT_ON_BLAST = true
export const HAS_WATER          = false
export const WATERBOX = { xMax:12, xMin:-4, zMax:8, zMin:-11.5 }

// R2 CDN base for mortar-command assets
export const MC_ASSET_BASE = 'https://assets.grudge-studio.com/game-assets/mortar-command'
export const mcAsset = (path: string) => `${MC_ASSET_BASE}/${path}`
