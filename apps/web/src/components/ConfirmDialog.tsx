type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl shadow-black/60">
        <p className="text-[14px] font-semibold text-paper">{title}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-3 py-1.5 text-[11.5px] font-medium text-paper/90 transition-colors hover:border-white/25"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-red-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
