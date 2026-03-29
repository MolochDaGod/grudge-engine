/**
 * Grudge Engine — Node/Express Server
 * ─────────────────────────────────────
 * Serves: static dist/, web terminal, scene editor, API proxy
 *
 * Routes:
 *   GET  /                → dist/index.html (gallery)
 *   GET  /terminal        → public/terminal/index.html
 *   GET  /editor          → public/editor/index.html
 *   GET  /api/health      → server health check
 *   GET  /api/scenes      → list all example scenes
 *   GET  /api/files/*     → read source files for editor
 *   PUT  /api/files/*     → write source files from editor
 *   WS   socket.io        → PTY terminal stream
 */

import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import { setupPty } from './pty.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')
const DIST      = path.join(ROOT, 'dist')
const PUBLIC    = path.join(ROOT, 'public')
const EXAMPLES  = path.join(ROOT, 'examples')
const SRC       = path.join(ROOT, 'src')

const PORT      = process.env.PORT || 4000
const API_URL   = process.env.VITE_API_URL   || 'https://api.grudge-studio.com'
const ASSETS_URL= process.env.VITE_ASSETS_URL|| 'https://assets.grudge-studio.com'

const app  = express()
const http = createServer(app)
const io   = new SocketIO(http, { cors: { origin: '*' } })

// ── Middleware ─────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Static: built dist (Babylon scenes/gallery) ───────────────
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
}

// ── Static: public assets (terminal page, editor page, logo) ──
app.use(express.static(PUBLIC))

// ── API: health ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'grudge-engine',
    version: '0.1.0',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    api_url: API_URL,
    assets_url: ASSETS_URL,
  })
})

// ── API: list scenes ──────────────────────────────────────────
app.get('/api/scenes', (_req, res) => {
  const scenes = []
  if (!fs.existsSync(EXAMPLES)) return res.json({ scenes })

  const walk = (dir, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel)
      } else if (entry.name === 'main.ts' || entry.name === 'index.html') {
        const parts = rel.split('/')
        if (parts.length >= 2) {
          const scene = { path: rel, dir: parts.slice(0, -1).join('/') }
          if (!scenes.find(s => s.dir === scene.dir)) scenes.push(scene)
        }
      }
    }
  }
  walk(EXAMPLES)
  res.json({ scenes })
})

// ── API: read source file for editor ─────────────────────────
app.get('/api/files/*', (req, res) => {
  // Allow reading from examples/ and src/
  const filePath = decodeURIComponent(req.params[0])
  const safePath = path.resolve(ROOT, filePath)

  // Security: must stay within project root
  if (!safePath.startsWith(ROOT)) return res.status(403).json({ error: 'Forbidden' })
  if (!fs.existsSync(safePath))   return res.status(404).json({ error: 'Not found' })

  const stat = fs.statSync(safePath)
  if (stat.isDirectory()) {
    const files = fs.readdirSync(safePath).map(f => ({
      name: f,
      isDir: fs.statSync(path.join(safePath, f)).isDirectory(),
      path: `${filePath}/${f}`,
    }))
    return res.json({ files })
  }

  const content = fs.readFileSync(safePath, 'utf-8')
  res.json({ path: filePath, content, size: stat.size })
})

// ── API: write source file from editor ───────────────────────
app.put('/api/files/*', (req, res) => {
  const filePath = decodeURIComponent(req.params[0])
  const safePath = path.resolve(ROOT, filePath)
  if (!safePath.startsWith(ROOT)) return res.status(403).json({ error: 'Forbidden' })

  const { content } = req.body
  if (typeof content !== 'string') return res.status(400).json({ error: 'content required' })

  fs.mkdirSync(path.dirname(safePath), { recursive: true })
  fs.writeFileSync(safePath, content, 'utf-8')
  res.json({ ok: true, path: filePath })
})

// ── SPA fallback: serve dist index for all unmatched routes ───
app.get('*', (_req, res) => {
  const indexPath = path.join(DIST, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('Run `npm run build` first to generate dist/')
  }
})

// ── Socket.io: PTY terminal ───────────────────────────────────
setupPty(io)

// ── Start ─────────────────────────────────────────────────────
http.listen(PORT, () => {
  console.log(`\n🛡  Grudge Engine Server`)
  console.log(`   http://localhost:${PORT}           — Gallery`)
  console.log(`   http://localhost:${PORT}/terminal  — Web Terminal`)
  console.log(`   http://localhost:${PORT}/editor    — Scene Editor`)
  console.log(`   http://localhost:${PORT}/api/health\n`)
})
