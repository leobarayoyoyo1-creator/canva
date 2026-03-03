import { ChevronDown, ChevronRight } from 'lucide-react'

export default function StickyNote({ id, data }) {
  const collapsed = data.collapsed ?? false
  const text = data.text ?? ''

  function handleTextChange(e) {
    data.onUpdate?.(id, { text: e.target.value })
  }

  function toggleCollapse() {
    data.onUpdate?.(id, { collapsed: !collapsed })
  }

  return (
    <div
      className="rounded-xl overflow-hidden shadow-xl border"
      style={{
        background: '#fef08a',
        borderColor: '#fde047',
        minWidth: 220,
        maxWidth: 300,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ background: '#fde047' }}
        onDoubleClick={toggleCollapse}
      >
        <span className="text-xs font-semibold text-yellow-900/60 uppercase tracking-wide">
          Nota
        </span>
        <button
          onClick={toggleCollapse}
          className="text-yellow-900/50 hover:text-yellow-900 transition-colors"
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronDown size={14} />
          }
        </button>
      </div>

      {!collapsed && (
        <div className="p-2">
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Escreva uma nota..."
            className="w-full bg-transparent text-yellow-900 text-sm resize-none outline-none placeholder-yellow-900/40 nodrag"
            rows={4}
          />
        </div>
      )}

      {collapsed && text && (
        <div className="px-3 py-2 text-xs text-yellow-900/60 truncate">
          {text.split('\n')[0]}
        </div>
      )}
    </div>
  )
}
