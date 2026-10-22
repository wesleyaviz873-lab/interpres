import { useCallback, useEffect, useState } from 'react'
import { Check, Warning } from './icons'

type ToastTone = 'success' | 'error'

export type ToastState = {
  text: string
  tone: ToastTone
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({ text, tone })
  }, [])

  return { toast, showToast }
}

type ToastProps = {
  toast: ToastState | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  const tone =
    toast.tone === 'error'
      ? 'border-red-500/30 bg-[#1a1010] text-red-200'
      : 'border-line bg-panel text-paper'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] shadow-xl shadow-black/40 ${tone}`}
      >
        {toast.tone === 'error' ? (
          <Warning className="h-4 w-4 text-red-300" />
        ) : (
          <Check className="h-4 w-4 text-emerald-400" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  )
}
