// Vercel Catch-All Serverless API — replicates JSON Server behavior
// Handles: /api/articles, /api/articles/:id, /api/comments, etc.
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

// ── DB access ──
const DB_PATH = join(process.cwd(), 'db.json')
let _db = null

function getDb() {
  if (!_db) {
    try {
      _db = JSON.parse(readFileSync(DB_PATH, 'utf8'))
    } catch {
      _db = {}
    }
  }
  return _db
}

function saveDb(db) {
  _db = db
  try {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  } catch {
    // Vercel serverless is read-only — saves only work locally
  }
}

// ── Query helpers ──
function applyFilters(items, params) {
  let result = [...items]

  for (const [key, value] of Object.entries(params)) {
    if (['_sort', '_order', '_limit', '_start', 'q', 'status_ne'].includes(key)) continue
    result = result.filter(item => String(item[key]) === String(value))
  }

  if (params.status_ne) {
    result = result.filter(item => item.status !== params.status_ne)
  }

  if (params.q) {
    const kw = params.q.toLowerCase()
    result = result.filter(item =>
      Object.values(item).some(v =>
        typeof v === 'string' && v.toLowerCase().includes(kw)
      )
    )
  }

  if (params._sort) {
    const fields = params._sort.split(',')
    const orders = (params._order || '').split(',').map(o => o === 'desc' ? -1 : 1)
    result.sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const av = a[fields[i]] ?? '', bv = b[fields[i]] ?? ''
        if (av < bv) return -1 * (orders[i] || 1)
        if (av > bv) return 1 * (orders[i] || 1)
      }
      return 0
    })
  }

  const start = parseInt(params._start) || 0
  const limit = parseInt(params._limit) || Infinity
  if (params._start || params._limit) {
    result = result.slice(start, start + limit)
  }

  return result
}

function parseBody(req) {
  if (typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body) } catch { return {} }
}

// ── Handler ──
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const db = getDb()
  const url = new URL(req.url, 'http://localhost')
  // Extract slug from URL path: /api/articles/11 -> 'articles/11'
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Remove 'api' prefix if present
  const slugParts = pathParts[0] === 'api' ? pathParts.slice(1) : pathParts
  const slug = slugParts.join('/')
  const params = Object.fromEntries(url.searchParams.entries())

  const parts = slug.split('/').filter(Boolean)
  const collection = parts[0]
  const id = parts[1]

  // Health
  if (collection === 'health') {
    return res.json({ status: 'ok', collections: Object.keys(db) })
  }

  // Root — list collections
  if (!collection) {
    const info = {}
    for (const [k, v] of Object.entries(db)) {
      info[k] = { count: Array.isArray(v) ? v.length : 0 }
    }
    return res.json(info)
  }

  if (!db[collection]) {
    return res.status(404).json({ error: `"${collection}" not found` })
  }

  const items = Array.isArray(db[collection]) ? [...db[collection]] : [db[collection]]

  // ── GET ──
  if (req.method === 'GET') {
    if (id) {
      const item = items.find(i => String(i.id) === String(id))
      if (!item) return res.status(404).json({ error: 'Not found' })
      return res.json(item)
    }
    return res.json(applyFilters(items, params))
  }

  // ── POST ──
  if (req.method === 'POST') {
    const body = parseBody(req)
    const maxId = items.reduce((m, i) => Math.max(m, parseInt(i.id) || 0), 0)
    const newItem = { id: maxId + 1, ...body }
    db[collection].push(newItem)
    saveDb(db)
    return res.status(201).json(newItem)
  }

  // ── PATCH ──
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'ID required' })
    const idx = db[collection].findIndex(i => String(i.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    db[collection][idx] = { ...db[collection][idx], ...parseBody(req) }
    saveDb(db)
    return res.json(db[collection][idx])
  }

  // ── PUT ──
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'ID required' })
    const idx = db[collection].findIndex(i => String(i.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    db[collection][idx] = { ...parseBody(req), id: parseInt(id) }
    saveDb(db)
    return res.json(db[collection][idx])
  }

  // ── DELETE ──
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID required' })
    const idx = db[collection].findIndex(i => String(i.id) === String(id))
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    const deleted = db[collection].splice(idx, 1)[0]
    saveDb(db)
    return res.json(deleted)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
}
