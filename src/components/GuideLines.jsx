import { useViewport } from '@xyflow/react'
import { PRIMARY_COLOR } from '../store/useCanvasStore'

export default function GuideLines({ guides }) {
  const { x: panX, y: panY, zoom } = useViewport()

  if (!guides.length) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
      {guides.map((guide, i) => {
        if (guide.type === 'vertical') {
          const screenX = Math.round(guide.position * zoom + panX)
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: screenX,
                width: 1,
                background: `linear-gradient(to bottom, transparent 0%, ${PRIMARY_COLOR}cc 8%, ${PRIMARY_COLOR}cc 92%, transparent 100%)`,
              }}
            />
          )
        }
        const screenY = Math.round(guide.position * zoom + panY)
        return (
          <div
            key={i}
            className="absolute left-0 right-0"
            style={{
              top: screenY,
              height: 1,
              background: `linear-gradient(to right, transparent 0%, ${PRIMARY_COLOR}cc 8%, ${PRIMARY_COLOR}cc 92%, transparent 100%)`,
            }}
          />
        )
      })}
    </div>
  )
}
