import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FilterBar from './FilterBar'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  SelectionMode,
  ConnectionLineType,
  ConnectionMode,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import SystemNode from './SystemNode'
import SystemEdge from './SystemEdge'
import StickyNote from './StickyNote'
import TextCard from './TextCard'
import GuideLines from './GuideLines'
import NodeModal from './NodeModal'
import ContextMenu from './ContextMenu'
import { useCanvasStore, CATEGORIES, PRIMARY_COLOR, SNAP_GRID } from '../store/useCanvasStore'
import { useWebhookListener } from '../hooks/useWebhookListener'

const nodeTypes = {
  systemNode: SystemNode,
  stickyNote: StickyNote,
  textCard:   TextCard,
}

const edgeTypes = {
  system: SystemEdge,
}

// Threshold para ativar guia de alinhamento (em coordenadas de flow)
const GUIDE_THRESHOLD = 6

// Returns which sides of `node` are touching another systemNode or textCard.
// Used to merge borders visually when nodes are adjacent.
const TOUCH_THRESHOLD = 2   // px tolerance for floating-point positions
const DEFAULT_DIMS = {
  systemNode: [224, 96],
  textCard:   [240, 160],
}

function getTouchingSides(node, allNodes) {
  // sides: hide the border on this side entirely
  // corners: square this specific corner (only when the adjacent node covers it)
  const ts = {
    left: false, right: false, top: false, bottom: false,
    topLeft: false, topRight: false, bottomLeft: false, bottomRight: false,
  }
  const [dw, dh] = DEFAULT_DIMS[node.type] ?? [224, 96]
  const nL = node.position.x
  const nT = node.position.y
  const nR = nL + (node.measured?.width  ?? dw)
  const nB = nT + (node.measured?.height ?? dh)

  for (const other of allNodes) {
    if (other.id === node.id) continue
    if (other.type !== 'systemNode' && other.type !== 'textCard') continue
    const [ow, oh] = DEFAULT_DIMS[other.type] ?? [224, 96]
    const oL = other.position.x
    const oT = other.position.y
    const oR = oL + (other.measured?.width  ?? ow)
    const oB = oT + (other.measured?.height ?? oh)

    const yOverlap = nB > oT + TOUCH_THRESHOLD && nT < oB - TOUCH_THRESHOLD
    const xOverlap = nR > oL + TOUCH_THRESHOLD && nL < oR - TOUCH_THRESHOLD

    if (Math.abs(nL - oR) <= TOUCH_THRESHOLD && yOverlap) {
      ts.left = true
      if (oT <= nT + TOUCH_THRESHOLD) ts.topLeft    = true
      if (oB >= nB - TOUCH_THRESHOLD) ts.bottomLeft  = true
    }
    if (Math.abs(nR - oL) <= TOUCH_THRESHOLD && yOverlap) {
      ts.right = true
      if (oT <= nT + TOUCH_THRESHOLD) ts.topRight   = true
      if (oB >= nB - TOUCH_THRESHOLD) ts.bottomRight = true
    }
    if (Math.abs(nT - oB) <= TOUCH_THRESHOLD && xOverlap) {
      ts.top = true
      if (oL <= nL + TOUCH_THRESHOLD) ts.topLeft  = true
      if (oR >= nR - TOUCH_THRESHOLD) ts.topRight = true
    }
    if (Math.abs(nB - oT) <= TOUCH_THRESHOLD && xOverlap) {
      ts.bottom = true
      if (oL <= nL + TOUCH_THRESHOLD) ts.bottomLeft  = true
      if (oR >= nR - TOUCH_THRESHOLD) ts.bottomRight = true
    }
  }
  return ts
}

export default function Canvas() {
  const {
    nodes, edges,
    initialized,
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
    setCanvasFromServer,
  } = useCanvasStore()

  useWebhookListener(setCanvasFromServer)

  const { getNode, screenToFlowPosition, fitView } = useReactFlow()

  const [guides, setGuides] = useState([])

  // Tracks last snapped color per textCard during drag — avoids redundant setNodes calls
  const snapColorRef = useRef({})

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterDates, setFilterDates] = useState(() => {
    try {
      const s = localStorage.getItem('canvas-filter')
      return s ? JSON.parse(s) : { active: false, from: '', to: '' }
    } catch { return { active: false, from: '', to: '' } }
  })
  // filterPositions: posições temporárias dos nodes durante o filtro (não vão pro banco)
  const [filterPositions, setFilterPositions] = useState({})

  useEffect(() => {
    localStorage.setItem('canvas-filter', JSON.stringify(filterDates))
  }, [filterDates])

  const applyFilter = useCallback((from, to) => {
    setFilterPositions({})
    setFilterDates({ active: true, from, to })
  }, [])

  const clearFilter = useCallback(() => {
    setFilterPositions({})
    setFilterDates({ active: false, from: '', to: '' })
  }, [])

  // Computed: quais nodes/edges são visíveis e suas posições de layout
  // Layout: clientX=100, productX=420, groups de 240px, gap entre clientes=80px
  const filterData = useMemo(() => {
    if (!filterDates.active || !filterDates.from || !filterDates.to) return null

    const { from, to } = filterDates

    const matchingProducts = nodes.filter(n =>
      n.type === 'systemNode' &&
      n.data?.category === 'product' &&
      n.data?.createdAt >= from &&
      n.data?.createdAt <= to
    )

    const visibleIds   = new Set()
    const clientGroups = new Map()   // clientKey → { clientNode | null, productIds[] }

    for (const product of matchingProducts) {
      visibleIds.add(product.id)

      const clientEdge = edges.find(e => e.target === product.id && e.targetHandle === 'left')
      const clientNode = clientEdge ? nodes.find(n => n.id === clientEdge.source) : null
      const clientKey  = clientNode?.id ?? `__orphan_${product.id}`

      if (clientNode) visibleIds.add(clientNode.id)
      if (!clientGroups.has(clientKey)) {
        clientGroups.set(clientKey, { clientNode: clientNode ?? null, productIds: [] })
      }
      clientGroups.get(clientKey).productIds.push(product.id)

      const tcEdge = edges.find(e => e.source === product.id && e.sourceHandle === 'bottom')
      if (tcEdge) {
        const tc = nodes.find(n => n.id === tcEdge.target)
        if (tc) visibleIds.add(tc.id)
      }
    }

    const layoutPositions = {}
    let yOffset = 100
    for (const { clientNode, productIds } of clientGroups.values()) {
      if (clientNode) layoutPositions[clientNode.id] = { x: 100, y: yOffset }

      for (let i = 0; i < productIds.length; i++) {
        const pid = productIds[i]
        const py  = yOffset + i * 240
        layoutPositions[pid] = { x: 420, y: py }

        const tcEdge = edges.find(e => e.source === pid && e.sourceHandle === 'bottom')
        if (tcEdge && nodes.find(n => n.id === tcEdge.target)) {
          layoutPositions[tcEdge.target] = { x: 420, y: py + 128 }  // 96 + 32
        }
      }
      yOffset += Math.max(1, productIds.length) * 240 + 80
    }

    return { visibleIds, layoutPositions, count: matchingProducts.length }
  }, [filterDates, nodes, edges])

  // fitView sempre que o filtro muda (aplicado, limpo ou datas alteradas)
  useEffect(() => {
    if (!initialized) return
    const t = setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 200)
    return () => clearTimeout(t)
  }, [filterDates, fitView, initialized])

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

  // Injeta callbacks nos dados dos nodes sem serializar funções no estado.
  // Quando filtro ativo: esconde nodes fora do range e aplica posições de layout.
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => {
        // Filtro: esconde nodes fora do conjunto visível
        if (filterData && !filterData.visibleIds.has(n.id)) {
          return { ...n, hidden: true }
        }

        // Posição de display: override durante filtro, real caso contrário
        const pos = filterData
          ? (filterPositions[n.id] ?? filterData.layoutPositions[n.id] ?? n.position)
          : n.position

        // Durante filtro, desliga border-merging (layout limpo)
        const touchingSides = filterData ? {} : undefined

        if (n.type === 'systemNode') {
          return {
            ...n,
            position: pos,
            data: {
              ...n.data,
              touchingSides: touchingSides ?? getTouchingSides(n, nodes),
              onAddNear: () => {
                const node = getNode(n.id)
                const p = node
                  ? { x: node.position.x + (node.measured?.width ?? 224) + 48, y: node.position.y }
                  : null
                openAddModal(p, n.id)
              },
              onResizeEnd: (x, y, w, h) => snapNodeToGrid(n.id, x, y, w, h),
            },
          }
        }
        if (n.type === 'stickyNote') {
          return { ...n, position: pos, data: { ...n.data, onUpdate: updateStickyNote } }
        }
        if (n.type === 'textCard') {
          return {
            ...n,
            position: pos,
            data: {
              ...n.data,
              touchingSides: touchingSides ?? getTouchingSides(n, nodes),
              onUpdate: updateStickyNote,
              onResizeEnd: (x, y, w, h) => snapTextCardGrid(n.id, x, y, w, h),
            },
          }
        }
        return { ...n, position: pos }
      }),
    [nodes, getNode, openAddModal, updateStickyNote, snapNodeToGrid, snapTextCardGrid, filterData, filterPositions]
  )

  const edgesWithCallbacks = useMemo(
    () => edges.map((e) => {
      const base = { ...e, data: { ...e.data, onUpdate: updateEdge } }
      if (filterData && (!filterData.visibleIds.has(e.source) || !filterData.visibleIds.has(e.target))) {
        return { ...base, hidden: true }
      }
      return base
    }),
    [edges, updateEdge, filterData]
  )

  // Durante o filtro, intercepta mudanças de posição para atualizar filterPositions
  // em vez do estado real dos nodes (que nunca muda durante o filtro).
  const handleNodesChange = useCallback((changes) => {
    if (!filterData) { onNodesChange(changes); return }

    const passThrough = []
    const posUpdates  = {}

    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        posUpdates[c.id] = c.position
        // Passa só o flag dragging para manter o estado interno do ReactFlow correto
        passThrough.push({ type: 'position', id: c.id, dragging: c.dragging })
      } else {
        passThrough.push(c)
      }
    }

    if (Object.keys(posUpdates).length > 0) {
      setFilterPositions(prev => ({ ...prev, ...posUpdates }))
    }
    if (passThrough.length > 0) onNodesChange(passThrough)
  }, [filterData, onNodesChange])

  // Detecta alinhamento durante drag e gera guias visuais.
  // Para textCards, detecta color-snap com nodes/cards tocados.
  const onNodeDrag = useCallback((_, draggingNode) => {
    // Durante filtro: sem guias e sem color-snap
    if (filterData) return
    // ── Alignment guides (systemNode only) ──────────────────────────────────
    if (draggingNode.type === 'systemNode') {
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

        const yAlignments = [
          [dy,          oy],
          [dy + dh,     oy + oh],
          [dy + dh / 2, oy + oh / 2],
          [dy,          oy + oh],
          [dy + dh,     oy],
        ]
        for (const [a, b] of yAlignments) {
          if (Math.abs(a - b) <= GUIDE_THRESHOLD) addGuide('horizontal', b)
        }

        const xAlignments = [
          [dx,          ox],
          [dx + dw,     ox + ow],
          [dx + dw / 2, ox + ow / 2],
          [dx,          ox + ow],
          [dx + dw,     ox],
        ]
        for (const [a, b] of xAlignments) {
          if (Math.abs(a - b) <= GUIDE_THRESHOLD) addGuide('vertical', b)
        }
      }

      setGuides(newGuides)
      return
    }

    // ── Color snap (textCard only) ───────────────────────────────────────────
    if (draggingNode.type === 'textCard') {
      const dL = draggingNode.position.x
      const dT = draggingNode.position.y
      const dR = dL + (draggingNode.measured?.width  ?? 240)
      const dB = dT + (draggingNode.measured?.height ?? 160)

      const touches = (n) => {
        const nL = n.position.x
        const nT = n.position.y
        const nR = nL + (n.measured?.width  ?? (n.type === 'textCard' ? 240 : 224))
        const nB = nT + (n.measured?.height ?? (n.type === 'textCard' ? 160 :  96))
        return dL <= nR && dR >= nL && dT <= nB && dB >= nT
      }

      // Priority 1: systemNode (use category color)
      let snapColor = null
      for (const n of nodes) {
        if (n.id === draggingNode.id || n.type !== 'systemNode') continue
        if (touches(n)) {
          snapColor = CATEGORIES[n.data?.category]?.color ?? CATEGORIES.other.color
          break
        }
      }

      // Priority 2: another textCard
      if (!snapColor) {
        for (const n of nodes) {
          if (n.id === draggingNode.id || n.type !== 'textCard') continue
          if (touches(n)) {
            snapColor = n.data?.accentColor ?? PRIMARY_COLOR
            break
          }
        }
      }

      // Only call setNodes when color actually changes
      const prev = snapColorRef.current[draggingNode.id]
      if (snapColor && snapColor !== prev) {
        snapColorRef.current[draggingNode.id] = snapColor
        snapCardColor(draggingNode.id, snapColor)
      }
    }
  }, [nodes, snapCardColor, filterData])

  const onNodeDragStop = useCallback((_, node) => {
    setGuides([])
    // Durante filtro: sem edge-snap (o usuário organiza livremente)
    if (filterData) return

    if (node?.type !== 'textCard') return
    delete snapColorRef.current[node.id]

    // Edge snap: if the card overlaps any systemNode or textCard, push it to
    // exact edge contact using the axis of minimum penetration.
    const cL = node.position.x
    const cT = node.position.y
    const cW = node.measured?.width  ?? 240
    const cH = node.measured?.height ?? 160
    const cR = cL + cW
    const cB = cT + cH

    let bestX = null
    let bestY = null
    let minPen = Infinity

    for (const n of nodes) {
      if (n.id === node.id) continue
      if (n.type !== 'systemNode' && n.type !== 'textCard') continue

      const nL = n.position.x
      const nT = n.position.y
      const nW = n.measured?.width  ?? (n.type === 'textCard' ? 240 : 224)
      const nH = n.measured?.height ?? (n.type === 'textCard' ? 160 :  96)
      const nR = nL + nW
      const nB = nT + nH

      // Skip if not overlapping
      if (cR <= nL || cL >= nR || cB <= nT || cT >= nB) continue

      // Penetration depth on each axis
      const dL = cR - nL   // push card left:  card.right aligns to node.left
      const dR = nR - cL   // push card right: card.left  aligns to node.right
      const dT = cB - nT   // push card up:    card.bottom aligns to node.top
      const dB = nB - cT   // push card down:  card.top   aligns to node.bottom

      const pen = Math.min(dL, dR, dT, dB)
      if (pen >= minPen) continue
      minPen = pen

      if      (pen === dL) { bestX = nL - cW; bestY = cT }
      else if (pen === dR) { bestX = nR;       bestY = cT }
      else if (pen === dT) { bestX = cL;       bestY = nT - cH }
      else                 { bestX = cL;       bestY = nB }
    }

    if (bestX !== null) placeCardAtEdge(node.id, bestX, bestY)
  }, [nodes, placeCardAtEdge, filterData])

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
      const menuType = node.type === 'textCard' ? 'textCard' : 'node'
      openContextMenu(e.clientX, e.clientY, menuType, null, node.id)
    },
    [openContextMenu]
  )

  const modalNode = modal.nodeId ? nodes.find((n) => n.id === modal.nodeId) : null

  if (!initialized) {
    return (
      <div className="w-full h-full bg-[#13131f] flex items-center justify-center">
        <span className="text-white/40 text-sm">Carregando canvas…</span>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-[#13131f]" onClick={closeContextMenu}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edgesWithCallbacks}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid
        snapGrid={[SNAP_GRID, SNAP_GRID]}
        connectionMode={ConnectionMode.Loose}
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
            if (n.type === 'textCard')   return n.data?.accentColor ?? PRIMARY_COLOR
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

      <FilterBar
        filterDates={filterDates}
        onApply={applyFilter}
        onClear={clearFilter}
      />

      {filterData?.count === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/25 text-sm">Nenhuma entrada no período selecionado</span>
        </div>
      )}

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
          onAddCard={() => addTextCard(contextMenu.flowPosition)}
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
