import { useId, useState } from 'react'
import { Eye, EyeOff } from './icons'

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  minLength?: number
  placeholder?: string
  required?: boolean
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  minLength,
  placeholder,
  required = true,
}: FieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-paper/90">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-sm text-paper placeholder:text-muted/50 transition-colors focus:border-accent/70 focus:outline-none ${
            isPassword ? 'pr-11' : ''
          }`}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={placeholder}
          required={required}
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            title={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setVisible((current) => !current)}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
