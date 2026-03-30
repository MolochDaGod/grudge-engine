/**
 * scripts/screenshot-examples.mjs
 *
 * Takes screenshots of every Grudge Engine example from the live Vercel URL
 * and saves them to public/thumbs/<name>.jpg (1280×720).
 *
 * Usage:
 *   node scripts/screenshot-examples.mjs
 *
 * Each example gets a configurable wait time so 3D scenes can render.
 */

import puppeteer from 'puppeteer'
import path     from 'path'
import fs       from 'fs'

const BASE  = 'https://grudge-engine-psi.vercel.app'
const OUT   = path.resolve('public/thumbs')
const W     = 1280
const H     = 720

fs.mkdirSync(OUT, { recursive: true })

// ── Example definitions ─────────────────────────────────────────────────────
// waitMs: time to let the WebGL scene render before capture
// click: optional [x,y] to click before capture (e.g. dismiss overlays)
const EXAMPLES = [
  // Gallery
  { name: 'gallery',             path: '/',                                          waitMs: 2000 },

  // Baseline
  { name: 'object-storage-starter', path: '/examples/00-baseline/object-storage-starter/', waitMs: 5000 },

  // Effects
  { name: 'webgpu',              path: '/examples/10-effects/webgpu/',               waitMs: 5000 },
  { name: 'post-processing',     path: '/examples/10-effects/post-processing/',      waitMs: 4000 },
  { name: 'water-sky',           path: '/examples/10-effects/water-sky/',            waitMs: 6000 },
  { name: 'candle-webgpu',       path: '/examples/10-effects/candle-webgpu/',        waitMs: 7000 },
  { name: 'mipmap-lod',          path: '/examples/10-effects/mipmap-lod/',           waitMs: 12000 },

  // Particles
  { name: 'particle-playground', path: '/examples/20-particles/playground/',         waitMs: 4000 },
  { name: 'fire',                path: '/examples/20-particles/fire/',               waitMs: 3000 },
  { name: 'rain',                path: '/examples/20-particles/rain/',               waitMs: 3000 },
  { name: 'smoke',               path: '/examples/20-particles/smoke/',              waitMs: 3000 },

  // Player
  { name: 'third-person',        path: '/examples/30-player/third-person/',          waitMs: 5000 },
  { name: 'first-person',        path: '/examples/30-player/first-person/',          waitMs: 4000 },

  // Terrain
  { name: 'heightmap',           path: '/examples/45-terrain/heightmap/',            waitMs: 5000 },
  { name: 'procedural',          path: '/examples/45-terrain/procedural/',           waitMs: 4000 },

  // Models
  { name: 'weapon-viewer',       path: '/examples/55-models/weapon-viewer/',         waitMs: 6000 },

  // Characters
  { name: 'character-editor',    path: '/examples/65-characters/character-editor/',  waitMs: 4000 },
  { name: 'corsair-king',        path: '/examples/65-characters/corsair-king/',      waitMs: 8000 },

  // AI
  { name: 'patrol',              path: '/examples/70-ai/patrol/',                    waitMs: 4000 },
  { name: 'follow',              path: '/examples/70-ai/follow/',                    waitMs: 4000 },
  { name: 'wander',              path: '/examples/70-ai/wander/',                    waitMs: 4000 },
  { name: 'pursue',              path: '/examples/70-ai/pursue/',                    waitMs: 4000 },

  // Scenes
  { name: 'rpg-scene',           path: '/examples/80-scenes/rpg-scene/',             waitMs: 5000 },
  { name: 'fps-arena',           path: '/examples/80-scenes/fps-arena/',             waitMs: 5000 },

  // Games
  { name: 'physics-particles',   path: '/examples/90-games/physics-particles/',      waitMs: 7000 },
  { name: 'boat-scene',          path: '/examples/90-games/boat-scene/',             waitMs: 15000 },
  { name: 'mortar-command',      path: '/examples/90-games/mortar-command/',         waitMs: 8000 },
]

async function screenshot(browser, ex) {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })

  // Suppress dialog overlays (alert/confirm/prompt)
  page.on('dialog', d => d.dismiss().catch(() => {}))

  // Block audio (avoids autoplay policy noise)
  await page.setRequestInterception(true)
  page.on('request', req => {
    const t = req.resourceType()
    if (t === 'media' || t === 'font') req.abort()
    else req.continue()
  })

  const url = BASE + ex.path
  console.log(`  📷  ${ex.name.padEnd(26)} → ${url}`)

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // Wait for WebGL to render frames
  await new Promise(r => setTimeout(r, ex.waitMs))

  // Try to dismiss any loading overlays by clicking the start button if present
  try {
    const startBtn = await page.$('#start')
    if (startBtn) {
      await startBtn.click()
      await new Promise(r => setTimeout(r, 1500))
    }
  } catch {}

  // Try to hide loading overlay if it's still visible
  await page.evaluate(() => {
    const el = document.getElementById('loading-overlay')
    if (el) el.style.display = 'none'
    const lm = document.getElementById('loading-msg')
    if (lm) lm.style.display = 'none'
  }).catch(() => {})

  const outPath = path.join(OUT, `${ex.name}.jpg`)
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 90, fullPage: false })
  console.log(`  ✅  Saved → ${outPath}`)

  await page.close()
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📸  Grudge Engine Screenshot Tool`)
  console.log(`    Base URL : ${BASE}`)
  console.log(`    Output   : ${OUT}`)
  console.log(`    Examples : ${EXAMPLES.length}\n`)

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-gpu-blacklist',
      '--use-gl=angle',         // Enable hardware-accelerated WebGL
      '--enable-webgl',
      '--enable-webgl2',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1280,720',
    ],
    defaultViewport: { width: W, height: H },
  })

  let ok = 0, fail = 0

  for (const ex of EXAMPLES) {
    try {
      await screenshot(browser, ex)
      ok++
    } catch (e) {
      console.error(`  ❌  ${ex.name}: ${e.message?.slice(0, 80)}`)
      fail++
    }
  }

  await browser.close()

  console.log(`\n════════════════════════════════════`)
  console.log(`  ✅ ${ok} captured   ❌ ${fail} failed`)
  console.log(`  Thumbs saved to: ${OUT}`)
  console.log(`════════════════════════════════════\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
