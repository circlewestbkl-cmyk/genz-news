import express from 'express'
import { createServer as createJsonServer } from 'json-server'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// JSON Server middleware
const jsonServer = createJsonServer({
  db: join(__dirname, 'db.json'),
  readOnly: false,
  noCors: false,
})

// Use JSON Server router and defaults
app.use(jsonServer.router)
app.use(jsonServer.defaults)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 JSON Server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}`)
})
