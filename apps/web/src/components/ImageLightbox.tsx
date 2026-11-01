import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { X } from './icons'

type ImageLightboxProps = {
  src: string
  alt: string
  onClose: () => void
}

type Point = { x: number; y: number }

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Point>())
  const drag = useRef({ start: { x: 0, y: 0 }, origin: { x: 0, y: 0 } })
  const pinch = useRef({ startDistance: 0, startScale: 1 })
  const lastTap = useRef(0)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function reset() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) {
      drag.current.start = { x: event.clientX, y: event.clientY }
      drag.current.origin = offset
    } else if (pointers.current.size === 2) {
      const points = Array.from(pointers.current.values())
      pinch.current.startDistance = distance(points[0], points[1])
      pinch.current.startScale = scale
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2) {
      const points = Array.from(pointers.current.values())
      const current = distance(points[0], points[1])
      if (pinch.current.startDistance > 0) {
        const next = Math.min(5, Math.max(1, (current / pinch.current.startDistance) * pinch.current.startScale))
        setScale(next)
        if (next <= 1.02) setOffset({ x: 0, y: 0 })
      }
      return
    }

    if (scale > 1) {
      setOffset({
        x: drag.current.origin.x + (event.clientX - drag.current.start.x),
        y: drag.current.origin.y + (event.clientY - drag.current.start.y),
      })
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0 && scale <= 1.02) {
      const now = Date.now()
      if (now - lastTap.current < 280) {
        setScale(2.5)
        lastTap.current = 0
      } else {
        lastTap.current = now
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex touch-none select-none items-center justify-center overflow-hidden bg-black/95"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
      onWheel={(event) => {
        event.preventDefault()
        const next = Math.min(5, Math.max(1, scale - event.deltaY * 0.0015))
        setScale(next)
        if (next <= 1.02) setOffset({ x: 0, y: 0 })
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-[12px] text-paper/80">{alt || 'Print da tela'}</p>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            reset()
          }}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-paper/80 transition-colors hover:bg-white/10"
        >
          Redefinir
        </button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-paper/80 transition-colors hover:bg-white/10"
        >
          Original
        </a>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          aria-label="Fechar imagem"
          className="rounded-lg border border-white/15 p-1.5 text-paper/80 transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[86vh] max-w-[96vw] cursor-grab object-contain active:cursor-grabbing"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: pointers.current.size === 0 ? 'transform 120ms ease-out' : 'none',
          touchAction: 'none',
        }}
      />

      <p className="absolute inset-x-0 bottom-4 text-center text-[10.5px] text-paper/50">
        Afaste os dedos para ampliar · arraste para mover · toque duas vezes para zoom
      </p>
    </div>
  )
}
