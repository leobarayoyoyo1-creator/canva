import { useEffect, useRef, useState } from 'react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import { PRIMARY_COLOR } from '../store/useCanvasStore'

const DEFAULT_W = 240

const FONT_SIZES = [
  { label: 'XS', value: 11 },
  { label: 'S',  value: 13 },
  { label: 'M',  value: 16 },
  { label: 'L',  value: 20 },
  { label: 'XL', value: 28 },
]

const TEXT_COLORS = [
  '#ffffff', '#e2e8f0', '#94a3b8',
  '#fbbf24', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe',
]

const BG_COLORS = [
  '#1e1e2e', '#1e293b', '#0f172a', '#27272a',
  '#1c1917', '#1a1a2e', '#0a1929', '#0c1a0e',
]

export default function TextCard({ id, data, selected, width }) {
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const textareaRef  = useRef()
  const hoverTimer   = useRef()

  const onEnter = () => { clearTimeout(hoverTimer.current); setHovered(true) }
  const onLeave = () => { hoverTimer.current = setTimeout(() => setHovered(false), 120) }

  const text        = data.text        ?? ''
  const fontSize    = data.fontSize    ?? 14
  const textColor   = data.textColor   ?? '#e2e8f0'
  const bgColor     = data.bgColor     ?? '#1e1e2e'
  const accentColor = data.accentColor ?? PRIMARY_COLOR
  const ts          = data.touchingSides ?? { left: false, right: false, top: false, bottom: false }

  // Text scales proportionally with card width
  const scale = (width ?? DEFAULT_W) / DEFAULT_W
  const displayFontSize = fontSize * scale

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  function update(patch) {
    data.onUpdate?.(id, patch)
  }

  function handleDoubleClick(e) {
    e.stopPropagation()
    setEditing(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') e.target.blur()
  }

  const showToolbar = selected || hovered

  const handleStyle = {
    width: 12,
    height: 12,
    background: '#1e1e2e',
    border: `2px solid ${accentColor}`,
    opacity: hovered ? 1 : 0,
    transition: 'opacity 0.18s',
    cursor: 'crosshair',
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Handle id="left"   type="source" position={Position.Left}   style={handleStyle} />
      <Handle id="right"  type="source" position={Position.Right}  style={handleStyle} />
      <Handle id="top"    type="source" position={Position.Top}    style={handleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />

      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineStyle={{
          borderColor: `${accentColor}60`,
          borderStyle: 'dashed',
          borderWidth: 1,
        }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: accentColor,
          border: '2px solid #13131f',
        }}
        onResizeEnd={(_, { x, y, width: w, height: h }) => data.onResizeEnd?.(x, y, w, h)}
      />

      {/* Toolbar — floats above the card */}
      {showToolbar && (
        <div
          className="absolute left-0 nodrag nopan flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-2xl"
          style={{
            bottom: 'calc(100% + 8px)',
            zIndex: 10,
            background: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.10)',
            whiteSpace: 'nowrap',
          }}
        >
          {FONT_SIZES.map(({ label, value }) => (
            <button
              key={value}
              onMouseDown={e => e.preventDefault()}  // keep textarea focused
              onClick={() => update({ fontSize: value })}
              className="px-1.5 py-0.5 rounded transition-all hover:bg-white/10"
              style={{
                fontSize: 10,
                fontWeight: fontSize === value ? 700 : 400,
                color: fontSize === value ? accentColor : 'rgba(255,255,255,0.45)',
              }}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-4 bg-white/15 mx-0.5" />

          {TEXT_COLORS.map(color => (
            <button
              key={`t-${color}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => update({ textColor: color })}
              title={`Texto: ${color}`}
              className="w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 shrink-0"
              style={{
                background: color,
                outline: textColor === color ? `2px solid ${color}` : 'none',
                outlineOffset: 2,
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          ))}

          <div className="w-px h-4 bg-white/15 mx-0.5" />

          {BG_COLORS.map(color => (
            <button
              key={`b-${color}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => update({ bgColor: color })}
              title={`Fundo: ${color}`}
              className="w-3.5 h-3.5 rounded transition-transform hover:scale-125 shrink-0"
              style={{
                background: color,
                outline: bgColor === color ? `2px solid rgba(255,255,255,0.35)` : 'none',
                outlineOffset: 2,
                border: '1px solid rgba(255,255,255,0.20)',
              }}
            />
          ))}
        </div>
      )}

      {/* Card body
          — no nodrag here in view mode → whole card is draggable
          — nodrag only on textarea when editing                     */}
      <div
        className="w-full h-full overflow-hidden flex flex-col"
        style={{
          background: bgColor,
          borderStyle: 'solid',
          borderTopWidth:    ts.top    ? 0 : 1,
          borderRightWidth:  ts.right  ? 0 : 1,
          borderBottomWidth: ts.bottom ? 0 : 1,
          borderLeftWidth:   ts.left   ? 0 : 1,
          // Same border-color logic as SystemNode so they look identical when merged
          borderColor: selected
            ? `${accentColor}90`
            : hovered
            ? `${accentColor}60`
            : 'rgba(255,255,255,0.07)',
          borderTopLeftRadius:     ts.topLeft     ? 0 : 12,
          borderTopRightRadius:    ts.topRight    ? 0 : 12,
          borderBottomRightRadius: ts.bottomRight ? 0 : 12,
          borderBottomLeftRadius:  ts.bottomLeft  ? 0 : 12,
          // Remove the 1px glow ring — it bleeds through the junction
          boxShadow: selected || hovered
            ? `0 10px 36px #00000065`
            : '0 4px 16px #00000040',
          transition: 'border-color 0.15s, box-shadow 0.15s, border-radius 0.1s',
          cursor: editing ? 'default' : 'grab',
        }}
        onDoubleClick={!editing ? handleDoubleClick : undefined}
      >
        {/* Thin accent stripe — hidden if top side is merged */}
        {!ts.top && (
          <div className="h-0.5 w-full shrink-0" style={{ background: accentColor }} />
        )}

        {editing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => update({ text: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva aqui..."
            className="nodrag nopan flex-1 bg-transparent resize-none outline-none px-3 pt-2 pb-3"
            style={{
              fontSize: displayFontSize,
              color: textColor,
              lineHeight: 1.6,
              cursor: 'text',
            }}
          />
        ) : (
          <div
            className="flex-1 px-3 pt-2 pb-3 overflow-hidden whitespace-pre-wrap break-words select-none"
            style={{
              fontSize: displayFontSize,
              color: text ? textColor : `${textColor}30`,
              lineHeight: 1.6,
            }}
          >
            {text || 'Duplo clique para editar...'}
          </div>
        )}
      </div>
    </div>
  )
}
