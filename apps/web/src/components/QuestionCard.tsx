import { useState } from 'react'
import type { MessageQuestion } from '../lib/api'
import { Send } from './icons'

type QuestionCardProps = {
  question: MessageQuestion
  answered: boolean
  disabled: boolean
  onAnswer: (answer: string) => void
}

export function QuestionCard({ question, answered, disabled, onAnswer }: QuestionCardProps) {
  const [other, setOther] = useState('')

  if (answered) return null

  return (
    <div className="mt-2 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
        Precisa de uma decisão
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-paper">{question.question}</p>

      {question.options.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(option)}
              className="w-full rounded-lg border border-line bg-ink/60 px-2.5 py-1.5 text-left text-[11.5px] text-paper/90 transition-colors hover:border-accent/40 hover:bg-accent/10 disabled:opacity-50"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          const text = other.trim()
          if (!text || disabled) return
          onAnswer(text)
          setOther('')
        }}
      >
        <input
          value={other}
          onChange={(event) => setOther(event.target.value)}
          placeholder="Outra resposta"
          aria-label="Outra resposta"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink/60 px-2 py-1 text-[11.5px] text-paper placeholder:text-muted/60 focus:border-accent/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !other.trim()}
          aria-label="Enviar resposta"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-black transition-colors hover:bg-orange-400 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
