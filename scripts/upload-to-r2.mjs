/**
 * scripts/upload-to-r2.mjs
 *
 * Generic utility: upload a local directory tree to Grudge R2.
 *
 * Usage:
 *   node scripts/upload-to-r2.mjs <localDir> <r2Prefix>
 *
 * Example:
 *   node scripts/upload-to-r2.mjs D:/path/to/models models/characters
 */

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const BUCKET    = 'grudge-assets'
const WRANGLER_CWD = 'D:/GrudgeStudio/grudge-studio-backend/cloudflare/workers/r2-cdn'

const MIME = {
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  '.vrm':  'model/gltf-binary',
  '.fbx':  'application/octet-stream',
  '.obj':  'text/plain',
  '.mtl':  'text/plain',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.mp4':  'video/mp4',
  '.hdr':  'image/vnd.radiance',
  '.env':  'image/vnd.radiance',
  '.ktx':  'image/ktx',
  '.ktx2': 'image/ktx2',
  '.basis':'application/octet-stream',
}

function getMime(file) {
  const ext = path.extname(file).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

function getAllFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const rel  = base ? `${base}/${e.name}` : e.name
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...getAllFiles(full, rel))
    else files.push({ rel, full })
  }
  return files
}

const [,, localDir, r2Prefix] = process.argv
if (!localDir || !r2Prefix) {
  console.error('Usage: node upload-to-r2.mjs <localDir> <r2Prefix>')
  process.exit(1)
}

if (!fs.existsSync(localDir)) {
  console.error(`Directory not found: ${localDir}`)
  process.exit(1)
}

const files = getAllFiles(path.resolve(localDir))
console.log(`\n📦  Uploading ${files.length} files → ${BUCKET}/${r2Prefix}/\n`)

let ok = 0, fail = 0
for (const { rel, full } of files) {
  const key  = `${r2Prefix}/${rel.replace(/\\/g, '/')}`
  const mime = getMime(full)
  const cmd  = [
    'npx', 'wrangler', 'r2', 'object', 'put',
    `${BUCKET}/${key}`,
    `--file="${full}"`,
    `--content-type="${mime}"`,
    '--remote',
  ].join(' ')

  try {
    execSync(cmd, { cwd: WRANGLER_CWD, stdio: 'pipe' })
    console.log(`  ✅  ${key}`)
    ok++
  } catch (e) {
    const msg = e.stderr?.toString().trim() ?? e.message
    console.error(`  ❌  ${key}`)
    console.error('     ', msg.split('\n')[0])
    fail++
  }
}

console.log(`\n════════════════════════════════`)
console.log(`  ✅ ${ok}  ❌ ${fail}`)
console.log(`  CDN: https://assets.grudge-studio.com/${r2Prefix}/`)
console.log(`════════════════════════════════\n`)
