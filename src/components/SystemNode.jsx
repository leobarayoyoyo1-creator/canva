import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Zap, Database, Layers, Server, Box, Plus } from 'lucide-react'
import { CATEGORIES, STATUSES, PRIMARY_COLOR } from '../store/useCanvasStore'

const CATEGORY_ICONS = {
  api:      Zap,
  database: Database,
  queue:    Layers,
  service:  Server,
  other:    Box,
}

export default function SystemNode({ data }) {
  const [hovered, setHovered] = useState(false)

  const category = CATEGORIES[data.category] ?? CATEGORIES.other
  const status   = STATUSES[data.status]    ?? STATUSES.unknown
  const Icon     = CATEGORY_ICONS[data.category] ?? Box

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: category.color,
          border: '2px solid #1e1e2e',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      />

      <div
        className="w-56 rounded-xl overflow-hidden shadow-xl border transition-all duration-150"
        style={{
          borderColor: hovered ? category.color : 'rgba(255,255,255,0.07)',
          background: '#1e1e2e',
          boxShadow: hovered ? `0 0 0 1px ${category.color}40, 0 8px 24px #00000050` : '0 4px 16px #00000040',
        }}
      >
        <div className="h-1" style={{ background: category.color }} />

        <div className="px-4 py-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${category.color}20` }}
            >
              <Icon size={16} style={{ color: category.color }} />
            </div>
            <span className="text-white font-semibold text-sm leading-tight">
              {data.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${category.color}18`, color: category.color }}
            >
              {category.label}
            </span>

            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status.color, boxShadow: `0 0 5px ${status.color}` }}
              />
              <span className="text-xs text-white/35">{status.label}</span>
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: category.color,
          border: '2px solid #1e1e2e',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          right: -5,
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation()
          data.onAddNear?.()
        }}
        className="absolute top-1/2 flex items-center justify-center rounded-full text-white shadow-lg transition-all duration-150"
        style={{
          width: 22,
          height: 22,
          right: -30,
          transform: 'translateY(-50%)',
          background: PRIMARY_COLOR,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          scale: hovered ? '1' : '0.7',
        }}
        title="Adicionar sistema conectado"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}
