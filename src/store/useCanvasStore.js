import { useState, useCallback, useRef, useEffect } from 'react'
import { applyNodeChanges, applyEdgeChanges, addEdge, MarkerType } from '@xyflow/react'

export const CATEGORIES = {
  api:      { label: 'API',          color: '#6366f1' },
  database: { label: 'Banco de Dados', color: '#10b981' },
  queue:    { label: 'Fila',          color: '#f59e0b' },
  service:  { label: 'Serviço',       color: '#8b5cf6' },
  other:    { label: 'Outro',         color: '#6b7280' },
}

export const STATUSES = {
  active:   { label: 'Ativo',         color: '#22c55e' },
  inactive: { label: 'Inativo',       color: '#ef4444' },
  unknown:  { label: 'Desconhecido',  color: '#9ca3af' },
}

export const PRIMARY_COLOR = '#6366f1'
export const SNAP_GRID     = 16

const EDGE_STYLE = {
  type: 'system',
  data: { label: '' },
  markerEnd: { type: MarkerType.ArrowClosed, color: PRIMARY_COLOR },
}

const DEFAULT_NODE_WIDTH  = 224
const DEFAULT_NODE_HEIGHT = 96   // 96 = 3 × 32 → center always on 16px grid

const INITIAL_NODES = [
  {
    id: '1',
    type: 'systemNode',
    position: { x: 300, y: 200 },
    style: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
    data: { name: 'API Gateway', category: 'api', status: 'active' },
  },
]

function loadFromStorage() {
  try {
    const nodes = localStorage.getItem('canvas-nodes')
    const edges = localStorage.getItem('canvas-edges')
    const parsedEdges = edges ? JSON.parse(edges) : []
    return {
      nodes: nodes
        ? JSON.parse(nodes).map((n) => ({
            ...n,
            style: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT, ...n.style },
          }))
        : INITIAL_NODES,
      // migra edges antigas para o tipo customizado e garante sourceHandle/targetHandle
      edges: parsedEdges.map((e) => ({
        ...e,
        type: 'system',
        data: { label: e.data?.label ?? '' },
        sourceHandle: e.sourceHandle ?? 'right',
        targetHandle: e.targetHandle ?? 'left',
      })),
    }
  } catch (e) {
    console.warn('Erro ao carregar canvas do localStorage:', e)
    return { nodes: INITIAL_NODES, edges: [] }
  }
}

export function useCanvasStore() {
  const saved = loadFromStorage()
  const idRef = useRef(
    Math.max(0, ...saved.nodes.map((n) => parseInt(n.id) || 0)) + 1
  )

  const [nodes, setNodes] = useState(saved.nodes)
  const [edges, setEdges] = useState(saved.edges)

  // modal: { open, mode: 'add'|'edit', nodeId, position, sourceNodeId }
  const [modal, setModal] = useState({ open: false, mode: 'add', nodeId: null, position: null, sourceNodeId: null })

  // contextMenu: { open, x, y, type: 'pane'|'node', flowPosition, nodeId }
  const [contextMenu, setContextMenu] = useState({ open: false })

  // clipboard: { nodes, edges } — not persisted, lives only in this session
  const clipboardRef  = useRef({ nodes: [], edges: [] })
  const pasteCountRef = useRef(0)

  // History for undo / redo — stores plain { nodes, edges } snapshots.
  // Uses a ref so history updates never trigger re-renders.
  const historyRef = useRef({ past: [], future: [] })
  // Always-current ref so snapshot() captures state without stale closures.
  const latestRef  = useRef({ nodes: saved.nodes, edges: saved.edges })

  // Keep latestRef in sync so snapshot() always sees the most recent state
  useEffect(() => { latestRef.current = { nodes, edges } }, [nodes, edges])

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('canvas-nodes', JSON.stringify(nodes))
  }, [nodes])

  useEffect(() => {
    localStorage.setItem('canvas-edges', JSON.stringify(edges))
  }, [edges])

  // Save current state into the undo stack; clears the redo stack.
  // Call this BEFORE any state-mutating action so undo restores the
  // state that existed before that action.
  const snapshot = useCallback(() => {
    const { nodes: n, edges: e } = latestRef.current
    historyRef.current = {
      past:   [...historyRef.current.past.slice(-99), { nodes: n, edges: e }],
      future: [],
    }
  }, [])

  const undo = useCallback(() => {
    const { past, future } = historyRef.current
    if (!past.length) return
    const { nodes: n, edges: e } = latestRef.current
    historyRef.current = {
      past:   past.slice(0, -1),
      future: [{ nodes: n, edges: e }, ...future.slice(0, 99)],
    }
    setNodes(past[past.length - 1].nodes)
    setEdges(past[past.length - 1].edges)
  }, [])

  const redo = useCallback(() => {
    const { past, future } = historyRef.current
    if (!future.length) return
    const { nodes: n, edges: e } = latestRef.current
    historyRef.current = {
      past:   [...past.slice(-99), { nodes: n, edges: e }],
      future: future.slice(1),
    }
    setNodes(future[0].nodes)
    setEdges(future[0].edges)
  }, [])

  // ReactFlow handlers
  const onNodesChange = useCallback(
    (changes) => {
      // Track node deletions via the Delete key
      if (changes.some((c) => c.type === 'remove')) snapshot()
      setNodes((nds) => applyNodeChanges(changes, nds))
    },
    [snapshot]
  )
  const onEdgesChange = useCallback(
    (changes) => {
      // Track edge deletions via the Delete key
      if (changes.some((c) => c.type === 'remove')) snapshot()
      setEdges((eds) => applyEdgeChanges(changes, eds))
    },
    [snapshot]
  )
  const onConnect = useCallback(
    (connection) => {
      snapshot()
      setEdges((eds) => addEdge({ ...connection, ...EDGE_STYLE }, eds))
    },
    [snapshot]
  )

  // Modal actions
  const openAddModal = useCallback((position, sourceNodeId = null) => {
    setModal({ open: true, mode: 'add', nodeId: null, position, sourceNodeId })
  }, [])

  const openEditModal = useCallback((nodeId) => {
    setModal({ open: true, mode: 'edit', nodeId, position: null, sourceNodeId: null })
  }, [])

  const closeModal = useCallback(() => {
    setModal({ open: false, mode: 'add', nodeId: null, position: null, sourceNodeId: null })
  }, [])

  // Context menu actions
  const openContextMenu = useCallback((x, y, type, flowPosition, nodeId = null) => {
    setContextMenu({ open: true, x, y, type, flowPosition, nodeId })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ open: false })
  }, [])

  // Node CRUD
  const addNode = useCallback(({ name, category, status }, position, sourceNodeId = null) => {
    snapshot()
    const newId = String(idRef.current++)
    const newNode = {
      id: newId,
      type: 'systemNode',
      position: position ?? { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      style: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
      data: { name, category, status },
    }
    setNodes((nds) => [...nds, newNode])
    if (sourceNodeId) {
      setEdges((eds) => [
        ...eds,
        {
          id: `e${sourceNodeId}-${newId}`,
          source: sourceNodeId,
          sourceHandle: 'right',
          target: newId,
          targetHandle: 'left',
          ...EDGE_STYLE,
        },
      ])
    }
    closeModal()
    closeContextMenu()
  }, [snapshot, closeModal, closeContextMenu])

  const updateEdge = useCallback((id, patch) => {
    snapshot()
    setEdges((eds) =>
      eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e))
    )
  }, [snapshot])

  const updateNode = useCallback((id, data) => {
    snapshot()
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
    )
    closeModal()
  }, [snapshot, closeModal])

  const deleteNode = useCallback((id) => {
    snapshot()
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    closeModal()
    closeContextMenu()
  }, [snapshot, closeModal, closeContextMenu])

  // Copy / paste ----------------------------------------------------------

  const copySelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (!selectedNodes.length) return
    const selectedIds = new Set(selectedNodes.map((n) => n.id))
    const selectedEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    )
    clipboardRef.current = { nodes: selectedNodes, edges: selectedEdges }
    pasteCountRef.current = 0
  }, [nodes, edges])

  const pasteClipboard = useCallback(() => {
    const { nodes: cbNodes, edges: cbEdges } = clipboardRef.current
    if (!cbNodes.length) return
    snapshot()

    pasteCountRef.current += 1
    const offset = SNAP_GRID * 2 * pasteCountRef.current  // 32px per paste step

    // Map old IDs → new IDs
    const idMap = {}
    const newNodes = cbNodes.map((n) => {
      const newId = String(idRef.current++)
      idMap[n.id] = newId
      return {
        ...n,
        id: newId,
        selected: true,
        position: {
          x: n.position.x + offset,
          y: n.position.y + offset,
        },
      }
    })

    const newEdges = cbEdges.map((e) => ({
      ...e,
      id: `e${idMap[e.source]}-${idMap[e.target]}`,
      source: idMap[e.source],
      target: idMap[e.target],
      selected: false,
    }))

    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ])
    setEdges((eds) => [...eds, ...newEdges])
  }, [snapshot])

  // Snap a systemNode's position and dimensions to the grid after resize.
  // Must go through setNodes directly — useReactFlow().updateNode bypasses
  // the controlled state and gets overwritten on the next render.
  const snapNodeToGrid = useCallback((id, x, y, w, h) => {
    const snap16 = (v) => Math.round(v / SNAP_GRID) * SNAP_GRID
    const snap32 = (v) => Math.round(v / (SNAP_GRID * 2)) * (SNAP_GRID * 2)
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== id
          ? n
          : {
              ...n,
              position: { x: snap16(x), y: snap16(y) },
              style: { ...n.style, width: snap32(w), height: snap32(h) },
            }
      )
    )
  }, [])

  // Sticky note
  const addStickyNote = useCallback((position) => {
    snapshot()
    const newId = String(idRef.current++)
    setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: 'stickyNote',
        position: position ?? { x: 300, y: 300 },
        connectable: false,
        data: { text: '', collapsed: false },
      },
    ])
    closeContextMenu()
  }, [snapshot, closeContextMenu])

  const updateStickyNote = useCallback((id, patch) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    )
  }, [])

  // Text card
  const addTextCard = useCallback((position) => {
    snapshot()
    const snap16 = (v) => Math.round(v / SNAP_GRID) * SNAP_GRID
    const pos = position ?? { x: 288, y: 288 }
    const newId = String(idRef.current++)
    setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: 'textCard',
        position: { x: snap16(pos.x), y: snap16(pos.y) },
        style: { width: 240, height: 160 },
        connectable: false,
        data: {
          text: '',
          fontSize: 14,
          textColor: '#e2e8f0',
          bgColor: '#1e1e2e',
          accentColor: PRIMARY_COLOR,
        },
      },
    ])
    closeContextMenu()
  }, [snapshot, closeContextMenu])

  // TextCard resize snap — uses snap16 for all values (not snap32 like systemNodes)
  const snapTextCardGrid = useCallback((id, x, y, w, h) => {
    const snap16 = (v) => Math.round(v / SNAP_GRID) * SNAP_GRID
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== id ? n : {
          ...n,
          position: { x: snap16(x), y: snap16(y) },
          style: { ...n.style, width: snap16(w), height: snap16(h) },
        }
      )
    )
  }, [])

  // Moves a textCard to an exact position (edge snap on drag stop) — no snapshot
  const placeCardAtEdge = useCallback((id, x, y) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, position: { x, y } } : n))
    )
  }, [])

  // Updates accentColor without snapshot — it's automatic (color snap during drag)
  const snapCardColor = useCallback((id, color) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, accentColor: color } } : n))
    )
  }, [])

  return {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    modal, openAddModal, openEditModal, closeModal,
    contextMenu, openContextMenu, closeContextMenu,
    addNode, updateNode, deleteNode,
    updateEdge,
    addStickyNote, updateStickyNote,
    addTextCard, snapTextCardGrid, placeCardAtEdge, snapCardColor,
    snapNodeToGrid,
    copySelected, pasteClipboard,
    undo, redo,
  }
}
