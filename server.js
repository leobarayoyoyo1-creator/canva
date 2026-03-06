import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(join(__dirname, 'canvas.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS canvas (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    nodes TEXT    NOT NULL DEFAULT '[]',
    edges TEXT    NOT NULL DEFAULT '[]'
  );
  INSERT OR IGNORE INTO canvas (id, nodes, edges) VALUES (1, '[]', '[]');
`)

const getCanvas  = db.prepare('SELECT nodes, edges FROM canvas WHERE id = 1')
const saveCanvas = db.prepare('UPDATE canvas SET nodes = ?, edges = ? WHERE id = 1')

// ── Canvas constants (espelhados do frontend) ─────────────────────────────────
const CATEGORIES = {
  client:   { color: '#3b82f6' },
  product:  { color: '#f97316' },
  api:      { color: '#6366f1' },
  database: { color: '#10b981' },
  queue:    { color: '#f59e0b' },
  service:  { color: '#8b5cf6' },
  other:    { color: '#6b7280' },
}
const PRIMARY_COLOR       = '#6366f1'
const SNAP_GRID           = 16
const DEFAULT_NODE_WIDTH  = 224
const DEFAULT_NODE_HEIGHT = 96

function snap16(v) { return Math.round(v / SNAP_GRID) * SNAP_GRID }

// Retorna o próximo ID disponível com base nos nodes existentes
function nextId(nodes) {
  return Math.max(0, ...nodes.map(n => parseInt(n.id) || 0)) + 1
}

const EDGE_STYLE = {
  type: 'system',
  data: { label: '' },
  markerEnd: { type: 'arrowclosed', color: PRIMARY_COLOR },
}

// Lógica de criação de nodes a partir de uma entrada de webhook
function processEntrada({ nome, codigo, modelo, createdAt }, nodes, edges) {
  const newNodes = []
  const newEdges = []
  let idCounter = nextId([...nodes, ...newNodes])

  // 1. Encontrar ou criar cliente
  const existingClient = nodes.find(n =>
    n.type === 'systemNode' &&
    n.data.category === 'client' &&
    n.data.name.trim().toLowerCase() === nome.trim().toLowerCase()
  )

  let clientId, clientX, clientY

  if (existingClient) {
    clientId = existingClient.id
    clientX  = existingClient.position.x
    clientY  = existingClient.position.y
  } else {
    const allY = nodes.map(n => n.position.y + (n.measured?.height ?? DEFAULT_NODE_HEIGHT) + 80)
    clientY  = snap16(allY.length > 0 ? Math.max(...allY) : 160)
    clientX  = 100
    clientId = String(idCounter++)
    newNodes.push({
      id: clientId,
      type: 'systemNode',
      position: { x: clientX, y: clientY },
      style: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
      data: { name: nome, category: 'client', status: 'active' },
    })
  }

  // 2. Contar produtos já conectados a este cliente
  const existingProductCount = edges
    .filter(e => e.source === clientId || e.target === clientId)
    .map(e => e.source === clientId ? e.target : e.source)
    .filter(pid => {
      const n = nodes.find(n => n.id === pid)
      return n?.type === 'systemNode' && n?.data.category === 'product'
    }).length

  const productY = snap16(clientY + existingProductCount * 240)
  const productX = snap16(clientX + 320)

  // 3. Criar node de produto
  const productId = String(idCounter++)
  newNodes.push({
    id: productId,
    type: 'systemNode',
    position: { x: productX, y: productY },
    style: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
    data: { name: codigo, category: 'product', status: 'unknown', createdAt },
  })
  newEdges.push({
    id: `e${clientId}-${productId}`,
    source: clientId,
    sourceHandle: 'right',
    target: productId,
    targetHandle: 'left',
    ...EDGE_STYLE,
  })

  // 4. Criar TextCard de modelo abaixo do produto
  const modelId = String(idCounter++)
  newNodes.push({
    id: modelId,
    type: 'textCard',
    position: { x: productX, y: snap16(productY + DEFAULT_NODE_HEIGHT + 32) },
    style: { width: DEFAULT_NODE_WIDTH, height: 64 },
    data: {
      text: modelo,
      fontSize: 13,
      textColor: '#e2e8f0',
      bgColor: '#1e1e2e',
      accentColor: CATEGORIES.product.color,
      createdAt,
    },
  })
  newEdges.push({
    id: `e${productId}-${modelId}`,
    source: productId,
    sourceHandle: 'bottom',
    target: modelId,
    targetHandle: 'top',
    ...EDGE_STYLE,
  })

  return { newNodes, newEdges }
}

// ── SSE clients ───────────────────────────────────────────────────────────────
const sseClients = []

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  sseClients.forEach(c => c.res.write(payload))
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// GET /api/canvas — load saved canvas
app.get('/api/canvas', (_req, res) => {
  const row = getCanvas.get()
  res.json({
    nodes: JSON.parse(row.nodes),
    edges: JSON.parse(row.edges),
  })
})

// POST /api/canvas — save canvas (chamado pelo frontend, debounced)
app.post('/api/canvas', (req, res) => {
  const { nodes, edges } = req.body
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: 'nodes e edges devem ser arrays' })
  }
  saveCanvas.run(JSON.stringify(nodes), JSON.stringify(edges))
  res.json({ ok: true })
})

// GET /api/events — SSE stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.write('event: connected\ndata: {}\n\n')

  const client = { id: Date.now(), res }
  sseClients.push(client)
  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === client.id)
    if (idx > -1) sseClients.splice(idx, 1)
  })
})

// POST /api/webhook/entrada — n8n envia { nome, codigo, modelo } aqui
// O servidor processa, salva no banco e faz broadcast do canvas atualizado
app.post('/api/webhook/entrada', (req, res) => {
  const { nome, codigo, modelo, data } = req.body ?? {}

  if (!nome || !codigo || !modelo) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, codigo, modelo' })
  }

  // `data` é opcional — se não vier, usa a data atual do servidor (YYYY-MM-DD)
  const createdAt = data ?? new Date().toISOString().split('T')[0]

  const row = getCanvas.get()
  const nodes = JSON.parse(row.nodes)
  const edges = JSON.parse(row.edges)

  const { newNodes, newEdges } = processEntrada({ nome, codigo, modelo, createdAt }, nodes, edges)

  const updatedNodes = [...nodes, ...newNodes]
  const updatedEdges = [...edges, ...newEdges]

  saveCanvas.run(JSON.stringify(updatedNodes), JSON.stringify(updatedEdges))

  broadcast('canvas-update', { nodes: updatedNodes, edges: updatedEdges })

  res.json({ ok: true, clientes_conectados: sseClients.length })
})

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001
app.listen(PORT, '0.0.0.0', () => console.log(`[server] http://localhost:${PORT}`))
