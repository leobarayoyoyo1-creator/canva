import { useEffect, useRef } from 'react'
import { Server, StickyNote, Pencil, Trash2 } from 'lucide-react'

export default function ContextMenu({ x, y, type, onAddSystem, onAddNote, onEdit, onDelete, onClose }) {
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Ajusta posição se sair da tela
  const style = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 120),
    zIndex: 50,
  }

  return (
    <div
      ref={ref}
      className="bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-48"
      style={style}
    >
      {type === 'pane' ? (
        <>
          <MenuItem icon={Server} label="Adicionar Sistema" onClick={onAddSystem} />
          <MenuItem icon={StickyNote} label="Adicionar Nota" onClick={onAddNote} />
        </>
      ) : (
        <>
          <MenuItem icon={Pencil} label="Editar Sistema" onClick={onEdit} />
          <div className="h-px bg-white/10 mx-3" />
          <MenuItem icon={Trash2} label="Deletar" onClick={onDelete} danger />
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5 text-left"
      style={{ color: danger ? '#ef4444' : 'rgba(255,255,255,0.75)' }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
