import { useEffect } from 'react'

// Em dev (Vite na 5173), conecta direto na 3001 — o proxy do Vite bufferiza
// SSE e os eventos não chegam no browser em tempo real.
// Em produção, usa caminho relativo normalmente.
function getSseUrl() {
  if (window.location.port === '5173') {
    return `http://${window.location.hostname}:3001/api/events`
  }
  return '/api/events'
}

/**
 * Conecta ao SSE do servidor e sincroniza o canvas quando o servidor
 * processa uma entrada do n8n e faz broadcast do canvas atualizado.
 */
export function useWebhookListener(onCanvasUpdate) {
  useEffect(() => {
    const es = new EventSource(getSseUrl())

    es.addEventListener('canvas-update', (e) => {
      try {
        onCanvasUpdate(JSON.parse(e.data))
      } catch {
        console.error('[webhook] erro ao processar canvas-update:', e.data)
      }
    })

    es.onerror = () => console.warn('[webhook] SSE reconectando...')

    return () => es.close()
  }, [onCanvasUpdate])
}
