import { useState } from 'react'
import { Pencil, Trash2, Plus, X } from 'lucide-react'
import { PRIMARY_COLOR } from '../store/useCanvasStore'
import { ICON_MAP, ICON_NAMES, getIcon } from '../utils/iconRegistry'

const COLOR_PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#6b7280',
]

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'categoria'
}

export default function CategoryManager({ categories, onAdd, onEdit, onRemove, onClose }) {
  const [editing, setEditing] = useState(null)   // null | 'new' | category key
  const [form, setForm] = useState({ label: '', color: '#6b7280', icon: 'Box' })
  const [saving, setSaving] = useState(false)

  function startNew() {
    setForm({ label: '', color: '#6b7280', icon: 'Box' })
    setEditing('new')
  }

  function startEdit(key) {
    const cat = categories[key]
    setForm({ label: cat.label, color: cat.color, icon: cat.icon ?? 'Box' })
    setEditing(key)
  }

  async function handleSave() {
    if (!form.label.trim()) return
    setSaving(true)
    try {
      if (editing === 'new') {
        let key = slugify(form.label)
        if (categories[key]) {
          let i = 2
          while (categories[`${key}-${i}`]) i++
          key = `${key}-${i}`
        }
        await onAdd({ key, label: form.label.trim(), color: form.color, icon: form.icon })
      } else {
        await onEdit(editing, { label: form.label.trim(), color: form.color, icon: form.icon })
      }
      setEditing(null)
    } catch (e) {
      console.error('Erro ao salvar categoria:', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(key) {
    await onRemove(key)
    if (editing === key) setEditing(null)
  }

  const entries = Object.entries(categories)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 text-white max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Gerenciar Categorias</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 mb-4">
          {entries.map(([key, cat]) => {
            const Icon = getIcon(cat.icon)
            return (
              <div
                key={key}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${cat.color}20` }}
                >
                  <Icon size={14} style={{ color: cat.color }} />
                </div>
                <span className="flex-1 text-sm text-white/80">{cat.label}</span>
                <span className="text-[10px] text-white/20 font-mono">{key}</span>
                <button
                  onClick={() => startEdit(key)}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition-all p-1"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(key)}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add button or edit form */}
        {editing === null ? (
          <button
            onClick={startNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/15 text-sm text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
          >
            <Plus size={14} />
            Nova Categoria
          </button>
        ) : (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="text-xs text-white/40 uppercase tracking-wider">
              {editing === 'new' ? 'Nova Categoria' : `Editar: ${categories[editing]?.label ?? editing}`}
            </div>

            <input
              autoFocus
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Nome da categoria"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
            />

            {/* Color picker */}
            <div>
              <label className="text-xs text-white/30 mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className="w-6 h-6 rounded-md transition-transform hover:scale-110 shrink-0"
                    style={{
                      background: color,
                      outline: form.color === color ? '2px solid white' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs text-white/30 mb-1.5 block">Ícone</label>
              <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto p-1 bg-white/[0.02] rounded-lg">
                {ICON_NAMES.map(name => {
                  const Ic = ICON_MAP[name]
                  return (
                    <button
                      key={name}
                      onClick={() => setForm(f => ({ ...f, icon: name }))}
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-all hover:bg-white/10"
                      style={{
                        background: form.icon === name ? `${form.color}25` : 'transparent',
                        outline: form.icon === name ? `1.5px solid ${form.color}` : 'none',
                      }}
                      title={name}
                    >
                      <Ic size={15} style={{ color: form.icon === name ? form.color : 'rgba(255,255,255,0.4)' }} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.label.trim() || saving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-30 hover:brightness-110"
                style={{ background: PRIMARY_COLOR }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
