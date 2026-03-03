import { useState, useCallback } from 'react'
import { applyNodeChanges } from '@xyflow/react'
import { createContext, useContext, useRef } from 'react'

const CATEGORIES = {
  api: { label: 'API', color: '#6366f1' },
  database: { label: 'Banco de Dados', color: '#10b981' },
  queue: { label: 'Fila', color: '#f59e0b' },
  service: { label: 'Serviço', color: '#8b5cf6' },
  other: { label: 'Outro', color: '#6b7280' },
}

const STATUSES = {
  active: { label: 'Ativo', color: '#22c55e' },
  inactive: { label: 'Inativo', color: '#ef4444' },
  unknown: { label: 'Desconhecido', color: '#9ca3af' },
}

export { CATEGORIES, STATUSES }

export function useCanvasStore() {
  const idRef = useRef(1)

  const [nodes, setNodes] = useState([
    {
      id: '1',
      type: 'systemNode',
      position: { x: 300, y: 200 },
      data: { name: 'API Gateway', category: 'api', status: 'active' },
    },
  ])

  const [modal, setModal] = useState({ open: false, position: null })

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )

  const openModal = useCallback((position) => {
    setModal({ open: true, position })
  }, [])

  const closeModal = useCallback(() => {
    setModal({ open: false, position: null })
  }, [])

  const addNode = useCallback(({ name, category, status }, nearPosition) => {
    idRef.current += 1
    const newNode = {
      id: String(idRef.current),
      type: 'systemNode',
      position: nearPosition
        ? { x: nearPosition.x + 220, y: nearPosition.y }
        : { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { name, category, status },
    }
    setNodes((nds) => [...nds, newNode])
    closeModal()
  }, [closeModal])

  return { nodes, onNodesChange, modal, openModal, closeModal, addNode }
}
