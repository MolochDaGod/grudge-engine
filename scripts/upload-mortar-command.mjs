/**
 * scripts/upload-mortar-command.mjs
 *
 * Uploads all mortarcommand public/ assets to the Grudge R2 bucket
 * under the game-assets/mortar-command/ prefix, so they can be
 * served at:
 *   https://assets.grudge-studio.com/game-assets/mortar-command/<key>
 *
 * Usage:
 *   node scripts/upload-mortar-command.mjs
 *
 * Requirements:
 *   npx wrangler must be authenticated (runs from grudge-engine root,
 *   wrangler reads credentials from ~/.wrangler/config/default.toml or
 *   CLOUDFLARE_API_TOKEN env var).
 */

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const BUCKET      = 'grudge-assets'
const R2_PREFIX   = 'game-assets/mortar-command'
const ASSETS_SRC  = path.resolve('D:/Desktop/mortarcommand/public')

// MIME type map
const MIME = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.wav':  'audio/wav',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
}

function getMime(file) {
  const ext = path.extname(file).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

function getAllFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      files.push(...getAllFiles(full, rel))
    } else {
      files.push({ rel, full })
    }
  }
  return files
}

// Collect everything under public/ except index.html (served by Vite)
const files = getAllFiles(ASSETS_SRC).filter(f =>
  !f.rel.endsWith('index.html') &&
  !f.rel.endsWith('manifest.json')
)

console.log(`\n📦  Uploading ${files.length} mortar-command assets to R2\n`)

let ok = 0, fail = 0
for (const { rel, full } of files) {
  const key      = `${R2_PREFIX}/${rel.replace(/\\/g, '/')}`
  const mime     = getMime(full)
  const cmd = [
    'npx', 'wrangler', 'r2', 'object', 'put',
    `${BUCKET}/${key}`,
    `--file="${full}"`,
    `--content-type="${mime}"`,
  ].join(' ')

  try {
    execSync(cmd, {
      cwd: 'D:/GrudgeStudio/grudge-studio-backend/cloudflare/workers/r2-cdn',
      stdio: 'pipe',
    })
    console.log(`  ✅  ${key}`)
    ok++
  } catch (e) {
    console.error(`  ❌  ${key}`)
    console.error('     ', e.stderr?.toString().trim() ?? e.message)
    fail++
  }
}

console.log(`\n════════════════════════════════════════`)
console.log(`  ✅ ${ok} uploaded   ❌ ${fail} failed`)
console.log(`  CDN: https://assets.grudge-studio.com/${R2_PREFIX}/`)
console.log(`════════════════════════════════════════\n`)
