import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CATEGORIES, STATUSES } from '../store/useCanvasStore'

export default function SystemNode({ data, id }) {
  const [hovered, setHovered] = useState(false)

  const category = CATEGORIES[data.category] ?? CATEGORIES.other
  const status = STATUSES[data.status] ?? STATUSES.unknown

  function handleAddClick(e) {
    e.stopPropagation()
    if (data.onAdd) data.onAdd(id)
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Node card */}
      <div
        className="w-52 rounded-xl overflow-hidden shadow-xl border transition-all duration-150"
        style={{
          borderColor: hovered ? category.color : 'rgba(255,255,255,0.08)',
          background: '#1e1e2e',
        }}
      >
        {/* Header strip com cor da categoria */}
        <div
          className="h-1 w-full"
          style={{ background: category.color }}
        />

        {/* Body */}
        <div className="px-4 py-3 flex flex-col gap-2">
          {/* Status dot + categoria */}
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: `${category.color}22`,
                color: category.color,
              }}
            >
              {category.label}
            </span>

            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: status.color, boxShadow: `0 0 4px ${status.color}` }}
              />
              <span className="text-xs text-white/40">{status.label}</span>
            </div>
          </div>

          {/* Nome */}
          <p className="text-white font-semibold text-sm leading-tight">
            {data.name}
          </p>
        </div>
      </div>

      {/* Botão + (aparece no hover, à direita do node) */}
      <button
        onClick={handleAddClick}
        className="absolute top-1/2 -translate-y-1/2 -right-5 w-8 h-8 rounded-full flex items-center justify-center text-white text-base font-bold shadow-lg transition-all duration-150 z-10"
        style={{
          background: '#6366f1',
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transform: `translateY(-50%) scale(${hovered ? 1 : 0.7})`,
        }}
        title="Adicionar sistema"
      >
        +
      </button>

      {/* ReactFlow handles (hidden visually, mas necessários para a lib) */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
