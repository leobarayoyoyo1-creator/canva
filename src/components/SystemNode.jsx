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

// Área de clique invisível maior que o visual, para facilitar arrastar a conexão
function ConnectionHandle({ type, position, color, visible }) {
  return (
    <div className="relative" style={{ position: 'absolute', ...HANDLE_ANCHOR[position] }}>
      {/* Hit area invisível e grande */}
      <Handle
        type={type}
        position={position}
        style={{
          width: 28,
          height: 28,
          background: 'transparent',
          border: 'none',
          opacity: 0,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          cursor: 'crosshair',
        }}
      />
      {/* Visual do handle */}
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#13131f',
          border: `2.5px solid ${color}`,
          boxShadow: visible ? `0 0 0 3px ${color}25, 0 0 10px ${color}50` : 'none',
          opacity: visible ? 1 : 0,
          transform: `scale(${visible ? 1 : 0.4})`,
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// Posicionamento dos handles nas bordas do node
const HANDLE_ANCHOR = {
  [Position.Left]:  { left: -7,  top: '50%', transform: 'translateY(-50%)' },
  [Position.Right]: { right: -7, top: '50%', transform: 'translateY(-50%)' },
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
      <ConnectionHandle type="target" position={Position.Left}  color={category.color} visible={hovered} />
      <ConnectionHandle type="source" position={Position.Right} color={category.color} visible={hovered} />

      <div
        className="w-56 rounded-xl overflow-hidden border transition-all duration-150"
        style={{
          borderColor: hovered ? `${category.color}80` : 'rgba(255,255,255,0.07)',
          background: '#1e1e2e',
          boxShadow: hovered
            ? `0 0 0 1px ${category.color}30, 0 8px 32px #00000060`
            : '0 4px 16px #00000040',
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

      {/* Botão + para adicionar node conectado — separado do handle por distância suficiente */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          data.onAddNear?.()
        }}
        className="absolute top-1/2 flex items-center justify-center rounded-full text-white shadow-xl transition-all duration-200"
        style={{
          width: 24,
          height: 24,
          right: -46,
          transform: `translateY(-50%) scale(${hovered ? 1 : 0.5})`,
          background: PRIMARY_COLOR,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          boxShadow: `0 0 12px ${PRIMARY_COLOR}60`,
        }}
        title="Adicionar sistema conectado"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
