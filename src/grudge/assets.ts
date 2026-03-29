/**
 * grudge/assets.ts
 * Resolves asset URLs from Grudge object storage (assets.grudge-studio.com)
 * or falls back to /public/assets for local dev.
 *
 * Priority:
 *  1. Absolute URL passed in (http/https) → returned as-is
 *  2. VITE_USE_REMOTE_ASSETS=true → VITE_ASSETS_URL + path
 *  3. Otherwise → /public/ + path (Vite static)
 */

const ASSETS_URL    = import.meta.env.VITE_ASSETS_URL    ?? 'https://assets.grudge-studio.com'
const USE_REMOTE    = (import.meta.env.VITE_USE_REMOTE_ASSETS ?? 'true') === 'true'

/**
 * Resolve an asset path/key to a full URL.
 * @param path  e.g. 'models/characters/warrior.glb' or 'textures/terrain/grass.jpg'
 */
export function assetUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const clean = path.replace(/^\/+/, '')
  return USE_REMOTE
    ? `${ASSETS_URL}/${clean}`
    : `/${clean}`
}

/** Common asset path helpers */
export const Assets = {
  model:   (name: string) => assetUrl(`models/${name}`),
  texture: (name: string) => assetUrl(`textures/${name}`),
  audio:   (name: string) => assetUrl(`audio/${name}`),
  icon:    (name: string) => assetUrl(`icons/${name}`),
  ui:      (name: string) => assetUrl(`ui/${name}`),

  /** Characters — maps to /models/characters/<name>.glb */
  character: (name: string) => assetUrl(`models/characters/${name}.glb`),

  /** Voxel RPG characters from D:/Dungeon-Crawler-Quest assets (uploaded to object storage) */
  voxelChar: (name: string) => assetUrl(`models/voxel/characters/${name}.glb`),

  /** Environment / terrain models */
  env: (name: string) => assetUrl(`models/environment/${name}.glb`),
}
