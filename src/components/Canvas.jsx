import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  SelectionMode,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import SystemNode from './SystemNode'
import StickyNote from './StickyNote'
import NodeModal from './NodeModal'
import ContextMenu from './ContextMenu'
import { useCanvasStore } from '../store/useCanvasStore'

const nodeTypes = {
  systemNode: SystemNode,
  stickyNote: StickyNote,
}

export default function Canvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    modal, openAddModal, openEditModal, closeModal,
    contextMenu, openContextMenu, closeContextMenu,
    addNode, updateNode, deleteNode,
    addStickyNote, updateStickyNote,
  } = useCanvasStore()

  const { getNode, screenToFlowPosition } = useReactFlow()

  // Injeta callbacks nos dados dos nodes sem serializar funções no estado
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === 'systemNode') {
          return {
            ...n,
            data: {
              ...n.data,
              onAddNear: () => {
                const node = getNode(n.id)
                const pos = node
                  ? { x: node.position.x + 260, y: node.position.y }
                  : null
                openAddModal(pos, n.id)
              },
            },
          }
        }
        if (n.type === 'stickyNote') {
          return {
            ...n,
            data: { ...n.data, onUpdate: updateStickyNote },
          }
        }
        return n
      }),
    [nodes, getNode, openAddModal, updateStickyNote]
  )

  const onPaneContextMenu = useCallback(
    (e) => {
      e.preventDefault()
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      openContextMenu(e.clientX, e.clientY, 'pane', flowPos)
    },
    [screenToFlowPosition, openContextMenu]
  )

  const onNodeContextMenu = useCallback(
    (e, node) => {
      e.preventDefault()
      if (node.type === 'stickyNote') return
      openContextMenu(e.clientX, e.clientY, 'node', null, node.id)
    },
    [openContextMenu]
  )

  const modalNode = modal.nodeId ? nodes.find((n) => n.id === modal.nodeId) : null

  return (
    <div className="w-full h-full bg-[#13131f]" onClick={closeContextMenu}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.15}
        maxZoom={2.5}
        panOnDrag={[1]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        deleteKeyCode="Delete"
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeContextMenu}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#ffffff15"
        />

        <Controls
          showInteractive={false}
          style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
        />

        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'stickyNote') return '#fde047'
            const map = { api: '#6366f1', database: '#10b981', queue: '#f59e0b', service: '#8b5cf6', other: '#6b7280' }
            return map[n.data?.category] ?? '#6b7280'
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
        />

        {/* Botão flutuante */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); openAddModal(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shadow-xl transition-all hover:brightness-110 active:scale-95"
            style={{ background: '#6366f1' }}
          >
            <Plus size={14} />
            Adicionar Sistema
          </button>
        </div>
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu.open && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onAddSystem={() => {
            closeContextMenu()
            openAddModal(contextMenu.flowPosition)
          }}
          onAddNote={() => addStickyNote(contextMenu.flowPosition)}
          onEdit={() => {
            closeContextMenu()
            openEditModal(contextMenu.nodeId)
          }}
          onDelete={() => deleteNode(contextMenu.nodeId)}
          onClose={closeContextMenu}
        />
      )}

      {/* Node Modal */}
      {modal.open && (
        <NodeModal
          mode={modal.mode}
          initialData={modalNode?.data}
          onSave={(data) => {
            if (modal.mode === 'add') addNode(data, modal.position, modal.sourceNodeId)
            else updateNode(modal.nodeId, data)
          }}
          onDelete={modal.nodeId ? () => deleteNode(modal.nodeId) : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
