#!/usr/bin/env node
/**
 * scripts/convert-fbx-to-glb.js
 *
 * Batch-converts uMMORPG FBX assets → GLB using the fbx2gltf npm package.
 * Outputs:
 *   public/models/races/          — base character meshes
 *   public/models/races/animations/ — 42 Mixamo animation clips
 *   public/models/races/equipment/  — weapons, shields, hat, etc.
 *
 * Usage:  node scripts/convert-fbx-to-glb.js
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_BASE = path.join(ROOT, 'public', 'models', 'races')

// Resolve fbx2gltf binary from node_modules
let fbx2gltfBin
try {
  const mod = await import('fbx2gltf')
  fbx2gltfBin = mod.default || mod
  // fbx2gltf exports the path to the binary
  if (typeof fbx2gltfBin === 'object' && fbx2gltfBin.default) fbx2gltfBin = fbx2gltfBin.default
} catch {
  // Fallback: look for it in node_modules/.bin
  fbx2gltfBin = path.join(ROOT, 'node_modules', '.bin', 'fbx2gltf')
}

// Source paths
const GRUDGE_ASSETS = 'D:\\GRUDGE-NEW-GGG\\FRESH GRUDGE\\Assets'
const ANIM_DIR = path.join(GRUDGE_ASSETS, 'uMMORPG', 'Prefabs', 'Entities', 'Players', 'Player Animation')
const ALLSTAR = path.join(GRUDGE_ASSETS, 'AllStarCharacterLibrary')
const SKELETON_DATA = path.join(GRUDGE_ASSETS, '!! Characters!!', 'SkeletonData', 'Equipment')
const BLINK_WEAPONS = path.join(GRUDGE_ASSETS, 'Blink', 'Art', 'Weapons', 'Stylized')

// ── Conversion helper ──────────────────────────────────────────────────────
async function convertFbx(inputPath, outputDir, outputName) {
  const outPath = path.join(outputDir, outputName || path.basename(inputPath, path.extname(inputPath)) + '.glb')

  if (!fs.existsSync(inputPath)) {
    console.warn(`  SKIP (not found): ${inputPath}`)
    return false
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  try {
    // fbx2gltf npm package: the default export is a function(inputPath, outputPath, args)
    if (typeof fbx2gltfBin === 'function') {
      await fbx2gltfBin(inputPath, outPath, ['--binary', '--draco'])
    } else {
      // Binary path fallback
      await execFileAsync(fbx2gltfBin, [
        '--input', inputPath,
        '--output', outPath,
        '--binary',
      ])
    }
    const size = fs.existsSync(outPath) ? (fs.statSync(outPath).size / 1024).toFixed(0) + 'KB' : '??'
    console.log(`  ✓ ${path.basename(outPath)} (${size})`)
    return true
  } catch (err) {
    console.error(`  ✗ ${path.basename(inputPath)}: ${err.message?.slice(0, 120)}`)
    return false
  }
}

// ── Phase 1: Base character meshes ─────────────────────────────────────────
async function convertBaseMeshes() {
  console.log('\n═══ Phase 1: Base Character Meshes ═══')
  const meshes = [
    { src: path.join(ALLSTAR, 'RootAnimsMale', 'BaseMale.fbx'), name: 'BaseMale.glb' },
    { src: path.join(ALLSTAR, 'RootAnimsFemale', 'BaseFemale.fbx'), name: 'BaseFemale.glb' },
    { src: path.join(ALLSTAR, 'Characters', 'Bambi', 'Bambi.FBX'), name: 'Bambi.glb' },
    { src: path.join(ALLSTAR, 'Characters', 'VillHelm', 'VillHelm.FBX'), name: 'VillHelm.glb' },
    { src: path.join(GRUDGE_ASSETS, '!! Characters!!', 'Enchanter', 'Enchanter.FBX'), name: 'Enchanter.glb' },
    { src: path.join(GRUDGE_ASSETS, '!! Characters!!', 'maw_j_laygo.fbx'), name: 'maw_j_laygo.glb' },
  ]

  let ok = 0
  for (const m of meshes) {
    if (await convertFbx(m.src, OUT_BASE, m.name)) ok++
  }
  console.log(`  ${ok}/${meshes.length} base meshes converted`)
}

// ── Phase 2: Animations ────────────────────────────────────────────────────
async function convertAnimations() {
  console.log('\n═══ Phase 2: Animation FBXs ═══')
  const animDir = path.join(OUT_BASE, 'animations')

  if (!fs.existsSync(ANIM_DIR)) {
    console.warn(`  Animation directory not found: ${ANIM_DIR}`)
    return
  }

  const fbxFiles = fs.readdirSync(ANIM_DIR).filter(f => f.toLowerCase().endsWith('.fbx'))
  console.log(`  Found ${fbxFiles.length} animation FBXs`)

  let ok = 0
  for (const fbx of fbxFiles) {
    const slug = fbx.replace(/\.fbx$/i, '').replace(/\s+/g, '_').replace(/[()]/g, '').toLowerCase()
    if (await convertFbx(path.join(ANIM_DIR, fbx), animDir, slug + '.glb')) ok++
  }
  console.log(`  ${ok}/${fbxFiles.length} animations converted`)
}

// ── Phase 3: Equipment ─────────────────────────────────────────────────────
async function convertEquipment() {
  console.log('\n═══ Phase 3: Equipment FBXs ═══')
  const equipDir = path.join(OUT_BASE, 'equipment')

  // SkeletonData equipment
  const skeletonEquip = [
    { src: path.join(SKELETON_DATA, 'Hat', 'hatr.FBX'), name: 'hat.glb' },
    { src: path.join(SKELETON_DATA, 'Shields', 'bronzeshield.FBX'), name: 'shield_bronze.glb' },
    { src: path.join(SKELETON_DATA, 'Shields', 'magicshield.FBX'), name: 'shield_magic.glb' },
    { src: path.join(SKELETON_DATA, 'Weapons', 'spear.FBX'), name: 'spear.glb' },
  ]

  let ok = 0
  for (const e of skeletonEquip) {
    if (await convertFbx(e.src, equipDir, e.name)) ok++
  }

  // Blink weapons — bows, crossbows, maces (tier 1-3)
  const blinkCategories = ['Bows/Meshes_Bows', 'Crossbows/Meshes_Crossbows', 'Maces/Meshes_Maces']
  for (const cat of blinkCategories) {
    const dir = path.join(BLINK_WEAPONS, cat)
    if (!fs.existsSync(dir)) { console.warn(`  SKIP (not found): ${dir}`); continue }

    const fbxFiles = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.fbx'))
    for (const fbx of fbxFiles) {
      const slug = fbx.replace(/\.fbx$/i, '').replace(/\s+/g, '_').toLowerCase()
      if (await convertFbx(path.join(dir, fbx), equipDir, slug + '.glb')) ok++
    }
  }

  console.log(`  ${ok} equipment pieces converted`)
}

// ── Run all ────────────────────────────────────────────────────────────────
console.log('FBX → GLB Batch Converter')
console.log(`Output: ${OUT_BASE}`)

await convertBaseMeshes()
await convertAnimations()
await convertEquipment()

console.log('\n✅ Conversion complete!')
