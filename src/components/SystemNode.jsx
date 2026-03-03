import { useState } from 'react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { Zap, Database, Layers, Server, Box, Plus } from 'lucide-react'
import { CATEGORIES, STATUSES, PRIMARY_COLOR } from '../store/useCanvasStore'

const CATEGORY_ICONS = {
  api:      Zap,
  database: Database,
  queue:    Layers,
  service:  Server,
  other:    Box,
}

const BASE_WIDTH  = 224
const BASE_HEIGHT = 96  // 96 = 3 × 32 → centers always on 16px grid

export default function SystemNode({ data, selected, width }) {
  const [hovered, setHovered] = useState(false)

  const category = CATEGORIES[data.category] ?? CATEGORIES.other
  const status   = STATUSES[data.status]    ?? STATUSES.unknown
  const Icon     = CATEGORY_ICONS[data.category] ?? Box

  const scale = (width ?? BASE_WIDTH) / BASE_WIDTH

  // Remove transform here — React Flow's CSS positions handles via translate(-50%,-50%)
  // and any inline transform would override that, causing misalignment after resize
  const handleStyle = {
    width: 20,
    height: 20,
    background: '#1e1e2e',
    border: `2.5px solid ${category.color}`,
    opacity: hovered ? 1 : 0,
    transition: 'opacity 0.18s, box-shadow 0.18s',
    boxShadow: hovered ? `0 0 0 4px ${category.color}20, 0 0 12px ${category.color}50` : 'none',
    cursor: 'crosshair',
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={selected}
        keepAspectRatio
        minWidth={192}
        minHeight={Math.round(192 * BASE_HEIGHT / BASE_WIDTH)}
        onResizeEnd={(_, { x, y, width: w, height: h }) => data.onResizeEnd?.(x, y, w, h)}
        lineStyle={{
          borderColor: `${PRIMARY_COLOR}60`,
          borderStyle: 'dashed',
          borderWidth: 1,
        }}
        handleStyle={{
          width: 9,
          height: 9,
          borderRadius: 3,
          background: PRIMARY_COLOR,
          border: '2px solid #13131f',
        }}
      />

      <Handle type="target" position={Position.Left}  style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      {/* Inner content rendered at BASE dimensions and scaled via CSS transform.
          pointerEvents:none so mouse events reach the outer div for hover tracking. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          pointerEvents: 'none',
        }}
      >
        <div
          className="rounded-xl overflow-hidden border flex flex-col"
          style={{
            width: '100%',
            height: '100%',
            borderColor: selected
              ? `${category.color}90`
              : hovered
              ? `${category.color}60`
              : 'rgba(255,255,255,0.07)',
            background: '#1e1e2e',
            boxShadow: hovered || selected
              ? `0 0 0 1px ${category.color}20, 0 10px 36px #00000065`
              : '0 4px 16px #00000040',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          <div className="shrink-0 h-1" style={{ background: category.color }} />

          <div className="flex-1 px-4 py-3.5 flex flex-col justify-center gap-3 min-h-0">
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
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: status.color, boxShadow: `0 0 5px ${status.color}` }}
                />
                <span className="text-xs text-white/35">{status.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* + button: outside the scaled content, sized and positioned proportionally */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          data.onAddNear?.()
        }}
        className="absolute top-1/2 flex items-center justify-center rounded-full text-white shadow-xl transition-all duration-200"
        style={{
          width: 24 * scale,
          height: 24 * scale,
          right: -42 * scale,
          transform: 'translateY(-50%)',
          background: PRIMARY_COLOR,
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          boxShadow: `0 0 12px ${PRIMARY_COLOR}60`,
        }}
        title="Adicionar sistema conectado"
      >
        <Plus size={13 * scale} />
      </button>
    </div>
  )
}
