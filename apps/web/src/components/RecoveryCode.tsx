import { useEffect, useState } from 'react'
import { copyToClipboard } from '../lib/clipboard'
import { Check, Copy, Warning } from './icons'

type RecoveryCodeProps = {
  code: string
  label?: string
}

export function RecoveryCode({ code, label = 'Código de recuperação' }: RecoveryCodeProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    setFailed(false)
    const ok = await copyToClipboard(code)
    setCopied(ok)
    setFailed(!ok)
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-accent/90">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Código copiado' : 'Copiar código'}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
            copied
              ? 'border-emerald-500/30 text-emerald-300'
              : 'border-line bg-ink/60 text-paper hover:border-white/25'
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-2 select-all break-all font-mono text-[17px] tracking-[0.16em] text-paper">
        {code}
      </p>
      {failed ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-red-300">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Não foi possível copiar automaticamente. Selecione o código e copie manualmente.
        </p>
      ) : null}
    </div>
  )
}
