import { useEffect, useRef, useState } from 'react'
import { api, type ConversationSearchResult } from '../lib/api'
import { Button } from './Button'
import { Database, Search, X } from './icons'

type RecallDialogProps = {
  onPick: (result: ConversationSearchResult) => void
  onClose: () => void
}

export function RecallDialog({ onPick, onClose }: RecallDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConversationSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSearch() {
    const term = query.trim()
    if (term.length < 2) {
      setError('Digite ao menos 2 letras.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await api.searchConversations(term)
      setResults(data.results)
      if (data.results.length === 0) setError('Nada encontrado.')
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Não consegui buscar agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-10 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Database className="h-4 w-4 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-paper">Consultar conversas</p>
            <p className="text-[10.5px] leading-4 text-muted">
              Busca local, sem gastar tokens. Só o trecho escolhido vai no próximo pedido.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSearch()
              }
            }}
            placeholder="ex.: deploy argenda, gateway, migração"
            aria-label="Buscar nas conversas"
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink/60 px-2.5 py-1.5 text-[12px] text-paper placeholder:text-muted/60 focus:border-white/20 focus:outline-none"
          />
          <Button type="button" size="sm" fullWidth={false} onClick={() => void handleSearch()}>
            <Search className="h-3.5 w-3.5" />
            {loading ? 'Buscando' : 'Buscar'}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? <p className="px-2 py-1.5 text-[11px] text-muted">{error}</p> : null}
          {results.map((result) => (
            <button
              key={`${result.conversation_id}-${result.created_at}`}
              type="button"
              onClick={() => onPick(result)}
              className="mb-1 w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-line hover:bg-white/5"
            >
              <span className="block truncate text-[11.5px] font-medium text-paper/90">
                {result.title}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-muted">
                {result.snippet}
              </span>
              <span className="mt-0.5 block text-[9.5px] text-muted/70">
                {result.role === 'user' ? 'você' : 'assistente'} ·{' '}
                {new Date(result.created_at).toLocaleDateString('pt-BR')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
