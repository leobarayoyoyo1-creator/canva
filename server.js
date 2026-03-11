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

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    key        TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#6b7280',
    icon       TEXT NOT NULL DEFAULT 'Box',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`)

// Seed default categories if table is empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get()
if (catCount.c === 0) {
  const ins = db.prepare('INSERT INTO categories (key, label, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
  ;[
    ['client',   'Cliente',         '#3b82f6', 'User',     0],
    ['product',  'Produto',         '#f97316', 'Wrench',   1],
    ['api',      'API',             '#6366f1', 'Zap',      2],
    ['database', 'Banco de Dados',  '#10b981', 'Database',  3],
    ['queue',    'Fila',            '#f59e0b', 'Layers',   4],
    ['service',  'Serviço',         '#8b5cf6', 'Server',   5],
    ['other',    'Outro',           '#6b7280', 'Box',      6],
  ].forEach(row => ins.run(...row))
}

const getCanvas  = db.prepare('SELECT nodes, edges FROM canvas WHERE id = 1')
const saveCanvas = db.prepare('UPDATE canvas SET nodes = ?, edges = ? WHERE id = 1')

const getCategories   = db.prepare('SELECT * FROM categories ORDER BY sort_order, key')
const insertCategory  = db.prepare('INSERT INTO categories (key, label, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
const updateCategoryQ = db.prepare('UPDATE categories SET label = ?, color = ?, icon = ? WHERE key = ?')
const deleteCategoryQ = db.prepare('DELETE FROM categories WHERE key = ?')

// ── Canvas constants ──────────────────────────────────────────────────────────
const PRIMARY_COLOR       = '#6366f1'
const SNAP_GRID           = 16
const DEFAULT_NODE_WIDTH  = 224
const DEFAULT_NODE_HEIGHT = 96

// Dimensões por categoria (espelhado de useCanvasStore.js → NODE_DIMS)
const NODE_DIMS = {
  client:  { width: 256, height: 112 },
  product: { width: 192, height: 80  },
}
function getNodeDims(category) {
  return NODE_DIMS[category] ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }
}

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

  const clientDims = getNodeDims('client')

  if (existingClient) {
    clientId = existingClient.id
    clientX  = existingClient.position.x
    clientY  = existingClient.position.y
  } else {
    const allY = nodes.map(n => n.position.y + (n.measured?.height ?? getNodeDims(n.data?.category).height) + 80)
    clientY  = snap16(allY.length > 0 ? Math.max(...allY) : 160)
    clientX  = 100
    clientId = String(idCounter++)
    newNodes.push({
      id: clientId,
      type: 'systemNode',
      position: { x: clientX, y: clientY },
      style: { width: clientDims.width, height: clientDims.height },
      data: { name: nome, category: 'client', status: 'active' },
    })
  }

  // 2. Produtos já conectados a este cliente (source=cliente, target=produto)
  const existingProducts = edges
    .filter(e => e.source === clientId)
    .map(e => nodes.find(n => n.id === e.target))
    .filter(n => n?.type === 'systemNode' && n?.data?.category === 'product')

  // Deduplicação: mesmo código já existe para este cliente → ignora
  if (existingProducts.some(n => n.data.name.trim().toLowerCase() === codigo.trim().toLowerCase())) {
    return { newNodes: [], newEdges: [] }
  }

  const productDims = getNodeDims('product')

  // Posiciona à direita do produto mais à direita; se não há produtos, à direita do cliente
  let productX, productY
  if (existingProducts.length > 0) {
    const rightmost = existingProducts.reduce((a, b) => a.position.x > b.position.x ? a : b)
    productX = snap16(rightmost.position.x + (rightmost.measured?.width ?? productDims.width) + 32)
    productY = rightmost.position.y
  } else {
    productX = snap16(clientX + clientDims.width + 48)
    productY = snap16(clientY + (clientDims.height - productDims.height) / 2)  // centralizado verticalmente no cliente
  }

  // 3. Criar node de produto (o modelo fica embutido em data.text — sem textCard separado)
  const productId     = String(idCounter++)
  const productHeight = modelo ? 160 : productDims.height
  newNodes.push({
    id: productId,
    type: 'systemNode',
    position: { x: productX, y: productY },
    style: { width: productDims.width, height: productHeight },
    data: { name: codigo, category: 'product', status: 'unknown', createdAt, text: modelo },
  })
  newEdges.push({
    id: `e${clientId}-${productId}`,
    source: clientId,
    sourceHandle: 'right',
    target: productId,
    targetHandle: 'left',
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

  // Duplicata detectada em processEntrada — nada a fazer
  if (!newNodes.length) {
    return res.json({ ok: true, duplicata: true, clientes_conectados: sseClients.length })
  }

  const updatedNodes = [...nodes, ...newNodes]
  const updatedEdges = [...edges, ...newEdges]

  saveCanvas.run(JSON.stringify(updatedNodes), JSON.stringify(updatedEdges))

  broadcast('canvas-update', { nodes: updatedNodes, edges: updatedEdges })

  res.json({ ok: true, clientes_conectados: sseClients.length })
})

// ── Category CRUD ─────────────────────────────────────────────────────────────
app.get('/api/categories', (_req, res) => {
  res.json(getCategories.all())
})

app.post('/api/categories', (req, res) => {
  const { key, label, color, icon } = req.body
  if (!key || !label) return res.status(400).json({ error: 'key e label são obrigatórios' })
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM categories').get()
  try {
    insertCategory.run(key, label, color ?? '#6b7280', icon ?? 'Box', max.m + 1)
    res.json({ ok: true })
  } catch {
    res.status(409).json({ error: 'Categoria já existe com essa chave' })
  }
})

app.put('/api/categories/:key', (req, res) => {
  const { label, color, icon } = req.body
  const existing = db.prepare('SELECT * FROM categories WHERE key = ?').get(req.params.key)
  if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' })
  updateCategoryQ.run(label ?? existing.label, color ?? existing.color, icon ?? existing.icon, req.params.key)
  res.json({ ok: true })
})

app.delete('/api/categories/:key', (req, res) => {
  deleteCategoryQ.run(req.params.key)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001
app.listen(PORT, '0.0.0.0', () => console.log(`[server] http://localhost:${PORT}`))
