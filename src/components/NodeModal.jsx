import { useState } from 'react'
import { CATEGORIES, STATUSES, PRIMARY_COLOR } from '../store/useCanvasStore'
import { Trash2 } from 'lucide-react'

export default function NodeModal({ mode = 'add', initialData, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [category, setCategory] = useState(initialData?.category ?? 'api')
  const [status, setStatus] = useState(initialData?.status ?? 'active')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), category, status })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm p-6 text-white">
        <h2 className="text-base font-semibold mb-5">
          {mode === 'add' ? 'Novo Sistema' : 'Editar Sistema'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wider">Nome</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: API de Pagamento"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wider">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left"
                  style={{
                    borderColor: category === key ? color : 'rgba(255,255,255,0.08)',
                    background: category === key ? `${color}20` : 'transparent',
                    color: category === key ? color : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/40 uppercase tracking-wider">Status</label>
            <div className="flex gap-2">
              {Object.entries(STATUSES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors"
                  style={{
                    borderColor: status === key ? color : 'rgba(255,255,255,0.08)',
                    background: status === key ? `${color}20` : 'transparent',
                    color: status === key ? color : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
                Deletar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-30 hover:brightness-110"
              style={{ background: PRIMARY_COLOR }}
            >
              {mode === 'add' ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
