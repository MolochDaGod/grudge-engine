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

  /** Particle / VFX textures — maps to /effects/<name> */
  effect: (name: string) => assetUrl(`effects/${name}`),

  /** 2-D sprite sheets or atlas images — maps to /sprites/<name> */
  sprite: (name: string) => assetUrl(`sprites/${name}`),

  /**
   * Raw key lookup — returns the full URL for an arbitrary storage key.
   * Useful when the caller already has the exact object-storage path.
   */
  raw: (key: string) => assetUrl(key),

  /**
   * Split a full model URL into the { rootUrl, sceneFilename } pair expected
   * by Babylon.js SceneLoader.ImportMeshAsync.
   */
  splitGlb(url: string): { rootUrl: string; sceneFilename: string } {
    const slash = url.lastIndexOf('/')
    return {
      rootUrl:       url.slice(0, slash + 1),
      sceneFilename: url.slice(slash + 1),
    }
  },
}
