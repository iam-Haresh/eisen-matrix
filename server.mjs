// Zero-dependency companion server (Node built-ins only, works on Node 18+).
//
// It does two things:
//   1. Persists your tasks to a real JSON file at a CONFIGURABLE path, exposing
//      a tiny API the browser app talks to (GET/PUT /api/tasks).
//   2. In production, also serves the built UI from ./dist so the whole app is
//      one process on one port.
//
// Configure the data file path (first match wins):
//   1. env var  EISENHOWER_DATA_FILE=/absolute/or/relative/path.json
//   2. eisenhower.config.json  ->  { "dataFile": "..." }   (relative to this file)
//   3. default: ./data/tasks.json
//
// Configure the port with  PORT=1234  (default 4317).

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, extname, resolve, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4317
// Bind to loopback only by default so the server is NOT reachable from the
// local network. Set HOST=0.0.0.0 explicitly if you really want LAN access.
const HOST = process.env.HOST || '127.0.0.1'
const DIST = join(__dirname, 'dist')

// Reject oversized request bodies to avoid memory exhaustion.
const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MB

// Only same-machine origins may make cross-origin (esp. state-changing) calls.
// This blocks a random website you're visiting from reading or overwriting your
// tasks file via fetch() to localhost.
const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function resolveDataFile() {
  if (process.env.EISENHOWER_DATA_FILE) {
    return resolve(process.env.EISENHOWER_DATA_FILE)
  }
  const cfgPath = join(__dirname, 'eisenhower.config.json')
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
      if (cfg.dataFile) return resolve(__dirname, cfg.dataFile)
    } catch (e) {
      console.warn('Ignoring bad eisenhower.config.json:', e.message)
    }
  }
  return join(__dirname, 'data', 'tasks.json')
}

const DATA_FILE = resolveDataFile()
// Cleared completed tasks are appended here, alongside the data file.
const COMPLETED_FILE = join(dirname(DATA_FILE), 'completed_tasks.json')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

async function readTasks() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return [] // file may not exist yet — that's fine
  }
}

async function writeTasks(tasks) {
  await mkdir(dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(tasks, null, 2))
}

async function appendCompleted(tasks) {
  let existing = []
  try {
    const parsed = JSON.parse(await readFile(COMPLETED_FILE, 'utf8'))
    if (Array.isArray(parsed)) existing = parsed
  } catch {
    // file may not exist yet — that's fine
  }
  const stamp = new Date().toISOString()
  const appended = tasks.map((t) => ({ ...t, completedAt: stamp }))
  await mkdir(dirname(COMPLETED_FILE), { recursive: true })
  await writeFile(COMPLETED_FILE, JSON.stringify([...existing, ...appended], null, 2))
  return appended.length
}

// Read the request body, enforcing the size cap. Returns null when too large
// (the request is destroyed and the caller should respond 413).
async function readBody(req) {
  let body = ''
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      req.destroy()
      return null
    }
    body += chunk
  }
  return body
}

// Reflect the Origin only when it's an allowed same-machine origin. Requests
// with no Origin header (curl, same-origin navigations) are fine. Returns the
// raw Origin header so callers can decide whether to block a mutation.
function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Vary', 'Origin')
  }
  return origin
}

// A cross-site Origin (present and not localhost) is blocked for mutations.
function isForbiddenOrigin(origin) {
  return !!origin && !ALLOWED_ORIGIN.test(origin)
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

async function serveStatic(pathname, res) {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<h1>Eisenhower API is running</h1>' +
        '<p>The UI is not built yet. Run <code>npm run build</code> then reload, ' +
        'or use <code>npm run dev</code> for the live dev server.</p>',
    )
    return
  }
  let rel = decodeURIComponent(pathname)
  if (rel === '/') rel = '/index.html'
  const filePath = normalize(join(DIST, rel))
  // Prevent path traversal outside dist.
  if (filePath !== DIST && !filePath.startsWith(DIST + sep)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  try {
    const data = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    })
    res.end(data)
  } catch {
    // SPA fallback.
    try {
      const data = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

const server = createServer(async (req, res) => {
  const origin = applyCors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(isForbiddenOrigin(origin) ? 403 : 204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/tasks') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { tasks: await readTasks(), dataFile: DATA_FILE })
      return
    }
    if (req.method === 'PUT') {
      // Block state-changing requests coming from another website.
      if (isForbiddenOrigin(origin)) {
        sendJSON(res, 403, { ok: false, error: 'Cross-origin request blocked' })
        return
      }
      const body = await readBody(req)
      if (body === null) {
        sendJSON(res, 413, { ok: false, error: 'Payload too large' })
        return
      }
      try {
        const parsed = JSON.parse(body)
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
        await writeTasks(parsed)
        sendJSON(res, 200, { ok: true, dataFile: DATA_FILE, count: parsed.length })
      } catch (e) {
        sendJSON(res, 400, { ok: false, error: e.message })
      }
      return
    }
    res.writeHead(405)
    res.end('Method not allowed')
    return
  }

  // Append cleared completed tasks to completed_tasks.json.
  if (url.pathname === '/api/completed') {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method not allowed')
      return
    }
    if (isForbiddenOrigin(origin)) {
      sendJSON(res, 403, { ok: false, error: 'Cross-origin request blocked' })
      return
    }
    const body = await readBody(req)
    if (body === null) {
      sendJSON(res, 413, { ok: false, error: 'Payload too large' })
      return
    }
    try {
      const parsed = JSON.parse(body)
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
      const count = await appendCompleted(parsed)
      sendJSON(res, 200, { ok: true, completedFile: COMPLETED_FILE, count })
    } catch (e) {
      sendJSON(res, 400, { ok: false, error: e.message })
    }
    return
  }

  if (req.method === 'GET') {
    await serveStatic(url.pathname, res)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST
  console.log(`Eisenhower server:  http://${shownHost}:${PORT}  (bound to ${HOST})`)
  console.log(`Saving tasks to:    ${DATA_FILE}`)
})
