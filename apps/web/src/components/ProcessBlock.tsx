import { useMemo } from 'react'
import { humanizeProgress } from '../lib/progress'

type ProcessBlockProps = {
  raw: string
}

export function ProcessBlock({ raw }: ProcessBlockProps) {
  const view = useMemo(() => humanizeProgress(raw.split('\n')), [raw])

  return (
    <details className="mt-2 rounded-lg border border-line/70 bg-ink/40 px-2.5 py-1.5">
      <summary className="flex cursor-pointer select-none items-center gap-1 text-[10.5px] font-medium text-muted transition-colors hover:text-paper">
        <span className="chevron-arrow inline-block transition-transform">▸</span>
        <span className="process-closed">Ver processo</span>
        <span className="process-open">Ocultar processo</span>
      </summary>
      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-muted">
        {view.lines.join('\n') || 'Sem detalhes legíveis.'}
        {view.skipped > 0 ? `\n\n(${view.skipped} linhas técnicas omitidas)` : ''}
      </pre>
      <details className="mt-2 border-t border-line/60 pt-1.5">
        <summary className="cursor-pointer select-none text-[10px] text-muted/70 transition-colors hover:text-paper">
          Log técnico
        </summary>
        <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-muted/80">
          {raw}
        </pre>
      </details>
    </details>
  )
}
