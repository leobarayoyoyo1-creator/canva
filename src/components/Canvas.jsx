import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  SelectionMode,
  ConnectionLineType,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import SystemNode from './SystemNode'
import SystemEdge from './SystemEdge'
import StickyNote from './StickyNote'
import GuideLines from './GuideLines'
import NodeModal from './NodeModal'
import ContextMenu from './ContextMenu'
import { useCanvasStore, CATEGORIES, PRIMARY_COLOR, SNAP_GRID } from '../store/useCanvasStore'

const nodeTypes = {
  systemNode: SystemNode,
  stickyNote: StickyNote,
}

const edgeTypes = {
  system: SystemEdge,
}

// Threshold para ativar guia de alinhamento (em coordenadas de flow)
const GUIDE_THRESHOLD = 6

export default function Canvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    modal, openAddModal, openEditModal, closeModal,
    contextMenu, openContextMenu, closeContextMenu,
    addNode, updateNode, deleteNode,
    updateEdge,
    addStickyNote, updateStickyNote,
    snapNodeToGrid,
    copySelected, pasteClipboard,
    undo, redo,
  } = useCanvasStore()

  const { getNode, screenToFlowPosition } = useReactFlow()

  const [guides, setGuides] = useState([])

  // Global keyboard shortcuts (copy, paste, undo, redo)
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return   // don't intercept text editing
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'c') { e.preventDefault(); copySelected() }
      if (e.key === 'v') { e.preventDefault(); pasteClipboard() }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [copySelected, pasteClipboard, undo, redo])

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
                  ? { x: node.position.x + (node.measured?.width ?? 224) + 48, y: node.position.y }
                  : null
                openAddModal(pos, n.id)
              },
              onResizeEnd: (x, y, w, h) => snapNodeToGrid(n.id, x, y, w, h),
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
    [nodes, getNode, openAddModal, updateStickyNote, snapNodeToGrid]
  )

  const edgesWithCallbacks = useMemo(
    () => edges.map((e) => ({
      ...e,
      data: { ...e.data, onUpdate: updateEdge },
    })),
    [edges, updateEdge]
  )

  // Detecta alinhamento durante drag e gera guias visuais
  const onNodeDrag = useCallback((_, draggingNode) => {
    if (draggingNode.type !== 'systemNode') return

    const others = nodes.filter(
      (n) => n.id !== draggingNode.id && n.type === 'systemNode'
    )

    const dw = draggingNode.measured?.width  ?? 224
    const dh = draggingNode.measured?.height ?? 80
    const dx = draggingNode.position.x
    const dy = draggingNode.position.y

    const newGuides = []

    const addGuide = (type, position) => {
      if (!newGuides.find((g) => g.type === type && g.position === position)) {
        newGuides.push({ type, position })
      }
    }

    for (const other of others) {
      const ow = other.measured?.width  ?? 224
      const oh = other.measured?.height ?? 80
      const ox = other.position.x
      const oy = other.position.y

      // Alinhamento vertical (guias na horizontal — topo, centro, base)
      const yAlignments = [
        [dy,          oy],            // topo com topo
        [dy + dh,     oy + oh],       // base com base
        [dy + dh / 2, oy + oh / 2],   // centro com centro
        [dy,          oy + oh],       // topo com base
        [dy + dh,     oy],            // base com topo
      ]
      for (const [a, b] of yAlignments) {
        if (Math.abs(a - b) <= GUIDE_THRESHOLD) addGuide('horizontal', b)
      }

      // Alinhamento horizontal (guias na vertical — esquerda, centro, direita)
      const xAlignments = [
        [dx,          ox],            // esquerda com esquerda
        [dx + dw,     ox + ow],       // direita com direita
        [dx + dw / 2, ox + ow / 2],   // centro com centro
        [dx,          ox + ow],       // esquerda com direita
        [dx + dw,     ox],            // direita com esquerda
      ]
      for (const [a, b] of xAlignments) {
        if (Math.abs(a - b) <= GUIDE_THRESHOLD) addGuide('vertical', b)
      }
    }

    setGuides(newGuides)
  }, [nodes])

  const onNodeDragStop = useCallback(() => setGuides([]), [])

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
    <div className="relative w-full h-full bg-[#13131f]" onClick={closeContextMenu}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edgesWithCallbacks}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid
        snapGrid={[SNAP_GRID, SNAP_GRID]}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{
          stroke: `${PRIMARY_COLOR}90`,
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.01}
        maxZoom={20}
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
          gap={SNAP_GRID}
          size={1.5}
          color="#ffffff18"
        />

        <Controls
          showInteractive={false}
          style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
        />

        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'stickyNote') return '#fde047'
            return CATEGORIES[n.data?.category]?.color ?? CATEGORIES.other.color
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)' }}
        />

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); openAddModal(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shadow-xl transition-all hover:brightness-110 active:scale-95"
            style={{ background: PRIMARY_COLOR }}
          >
            <Plus size={14} />
            Adicionar Sistema
          </button>
        </div>
      </ReactFlow>

      <GuideLines guides={guides} />

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
