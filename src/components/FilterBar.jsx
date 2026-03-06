import { useState, useEffect } from 'react'
import { CalendarRange, Filter, X } from 'lucide-react'
import { PRIMARY_COLOR } from '../store/useCanvasStore'

export default function FilterBar({ filterDates, onApply, onClear }) {
  const [from, setFrom] = useState(filterDates.from || '')
  const [to,   setTo]   = useState(filterDates.to   || '')

  // Sincroniza ao restaurar filtro do localStorage
  useEffect(() => {
    setFrom(filterDates.from || '')
    setTo(filterDates.to   || '')
  }, [filterDates.from, filterDates.to])

  const valid = from && to && from <= to

  function handleApply() {
    if (!valid) return
    onApply(from, to)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleApply()
  }

  // Formata YYYY-MM-DD → DD/MM/YYYY para exibição
  function fmt(d) {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div
      className="absolute top-4 right-4 z-10 flex flex-col gap-2.5 p-3 rounded-xl shadow-2xl"
      style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', width: 220 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <CalendarRange size={12} className="text-white/40" />
        <span className="text-white/40 text-xs font-medium">Filtrar por data</span>
        {filterDates.active && (
          <span
            className="ml-auto px-1.5 py-0.5 rounded text-white text-[10px] font-semibold"
            style={{ background: PRIMARY_COLOR }}
          >
            ativo
          </span>
        )}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-[11px] w-5 shrink-0">de</span>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#13131f] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-[11px] w-5 shrink-0">até</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#13131f] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Resumo quando ativo */}
      {filterDates.active && (
        <div className="text-[10px] text-white/30 text-center">
          {fmt(filterDates.from)} → {fmt(filterDates.to)}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-1.5">
        <button
          onClick={handleApply}
          disabled={!valid}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ background: PRIMARY_COLOR }}
        >
          <Filter size={10} />
          {filterDates.active ? 'Atualizar' : 'Filtrar'}
        </button>

        {filterDates.active && (
          <button
            onClick={onClear}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
