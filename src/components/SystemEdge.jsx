import { useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useNodes } from '@xyflow/react'
import { PRIMARY_COLOR } from '../store/useCanvasStore'
import { computeSmartPath } from '../utils/smartPath'

export default function SystemEdge({
  id,
  source, target,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
  selected,
  markerEnd,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')

  const nodes = useNodes()

  // Try smart routing first; fall back to standard bezier if no obstacle found
  const smartResult = useMemo(
    () => computeSmartPath(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target, nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target,
     // depend on node positions/sizes (stringify is cheap for ~20 nodes)
     // eslint-disable-next-line react-hooks/exhaustive-deps
     nodes.map(n => `${n.id}:${n.position.x},${n.position.y},${n.measured?.width},${n.measured?.height}`).join('|')]
  )

  const [edgePath, labelX, labelY] = smartResult ?? getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const label = data?.label ?? ''

  function startEdit(e) {
    e.stopPropagation()
    setDraft(label)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    data?.onUpdate?.(id, { label: draft.trim() })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Escape') e.target.blur()
  }

  return (
    <>
      {/* Invisible wide path for easier click-to-select */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: 'pointer' }}
      />

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#a5b4fc' : `${PRIMARY_COLOR}99`,
          strokeWidth: selected ? 2.5 : 1.5,
          filter: selected ? `drop-shadow(0 0 6px ${PRIMARY_COLOR}80)` : 'none',
          transition: 'stroke 0.15s, stroke-width 0.15s, filter 0.15s',
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={onKeyDown}
              className="bg-[#1e1e2e] border border-indigo-500 rounded-md px-2 py-0.5 text-xs text-white outline-none w-28 text-center shadow-lg"
              placeholder="ex: HTTP, gRPC…"
            />
          ) : label ? (
            <span
              onClick={startEdit}
              className="bg-[#1e1e2e] border border-white/15 rounded-md px-2 py-0.5 text-xs text-white/60 cursor-pointer select-none transition-all hover:border-indigo-400/60 hover:text-white/90"
            >
              {label}
            </span>
          ) : (
            <span
              onClick={startEdit}
              className="block w-5 h-5 rounded-full border border-white/0 text-white/0 cursor-pointer select-none transition-all hover:border-white/20 hover:text-white/40 hover:bg-[#1e1e2e] flex items-center justify-center text-xs"
              title="Adicionar tipo de conexão"
            >
              +
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
