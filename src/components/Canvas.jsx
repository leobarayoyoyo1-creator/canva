import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react'
import SystemNode from './SystemNode'
import AddNodeModal from './AddNodeModal'
import { useCanvasStore } from '../store/useCanvasStore'

const nodeTypes = { systemNode: SystemNode }

export default function Canvas() {
  const { nodes, onNodesChange, modal, openModal, closeModal, addNode } = useCanvasStore()
  const { getNode } = useReactFlow()

  const nodesWithCallback = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onAdd: (id) => {
            const node = getNode(id)
            openModal(node?.position ?? null)
          },
        },
      })),
    [nodes, openModal, getNode]
  )

  return (
    <div className="w-full h-full bg-[#13131f]">
      <ReactFlow
        nodes={nodesWithCallback}
        edges={[]}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#ffffff18"
        />

        <Controls
          className="!bg-[#1e1e2e] !border-white/10"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={(n) => {
            const cat = n.data?.category
            const colors = {
              api: '#6366f1',
              database: '#10b981',
              queue: '#f59e0b',
              service: '#8b5cf6',
              other: '#6b7280',
            }
            return colors[cat] ?? '#6b7280'
          }}
          style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
        />

        {/* Botão flutuante para adicionar o primeiro/novo node */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: '#6366f1' }}
          >
            <span className="text-base leading-none">+</span>
            Adicionar Sistema
          </button>
        </div>
      </ReactFlow>

      {modal.open && (
        <AddNodeModal
          nearPosition={modal.position}
          onAdd={addNode}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
