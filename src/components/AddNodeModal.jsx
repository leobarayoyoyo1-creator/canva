import { useState } from 'react'
import { CATEGORIES, STATUSES } from '../store/useCanvasStore'

export default function AddNodeModal({ onAdd, onClose, nearPosition }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('api')
  const [status, setStatus] = useState('active')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), category, status }, nearPosition)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm p-6 text-white">
        <h2 className="text-lg font-semibold mb-5">Novo Sistema</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wider">Nome</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: API de Pagamento"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wider">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
                  style={{
                    borderColor: category === key ? color : 'rgba(255,255,255,0.1)',
                    background: category === key ? `${color}22` : 'transparent',
                    color: category === key ? color : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wider">Status</label>
            <div className="flex gap-2">
              {Object.entries(STATUSES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors"
                  style={{
                    borderColor: status === key ? color : 'rgba(255,255,255,0.1)',
                    background: status === key ? `${color}22` : 'transparent',
                    color: status === key ? color : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: '#6366f1' }}
            >
              Criar Sistema
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
