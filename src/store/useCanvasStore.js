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

const EDGE_STYLE = {
  type: 'system',
  data: { label: '' },
  markerEnd: { type: MarkerType.ArrowClosed, color: PRIMARY_COLOR },
}

const INITIAL_NODES = [
  {
    id: '1',
    type: 'systemNode',
    position: { x: 300, y: 200 },
    data: { name: 'API Gateway', category: 'api', status: 'active' },
  },
]

function loadFromStorage() {
  try {
    const nodes = localStorage.getItem('canvas-nodes')
    const edges = localStorage.getItem('canvas-edges')
    const parsedEdges = edges ? JSON.parse(edges) : []
    return {
      nodes: nodes ? JSON.parse(nodes) : INITIAL_NODES,
      // migra edges antigas para o tipo customizado
      edges: parsedEdges.map((e) => ({
        ...e,
        type: 'system',
        data: { label: e.data?.label ?? '' },
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

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('canvas-nodes', JSON.stringify(nodes))
  }, [nodes])

  useEffect(() => {
    localStorage.setItem('canvas-edges', JSON.stringify(edges))
  }, [edges])

  // ReactFlow handlers
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, ...EDGE_STYLE }, eds)),
    []
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
    const newId = String(idRef.current++)
    const newNode = {
      id: newId,
      type: 'systemNode',
      position: position ?? { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { name, category, status },
    }
    setNodes((nds) => [...nds, newNode])
    if (sourceNodeId) {
      setEdges((eds) => [
        ...eds,
        { id: `e${sourceNodeId}-${newId}`, source: sourceNodeId, target: newId, ...EDGE_STYLE },
      ])
    }
    closeModal()
    closeContextMenu()
  }, [closeModal, closeContextMenu])

  const updateEdge = useCallback((id, patch) => {
    setEdges((eds) =>
      eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e))
    )
  }, [])

  const updateNode = useCallback((id, data) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
    )
    closeModal()
  }, [closeModal])

  const deleteNode = useCallback((id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    closeModal()
    closeContextMenu()
  }, [closeModal, closeContextMenu])

  // Sticky note
  const addStickyNote = useCallback((position) => {
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
  }, [closeContextMenu])

  const updateStickyNote = useCallback((id, patch) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
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
  }
}
