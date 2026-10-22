import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'sm'
  fullWidth?: boolean
}

export function Button({
  children,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-black hover:bg-orange-400'
      : 'border border-line bg-transparent text-paper hover:border-white/25 hover:bg-white/5'
  const sizes = size === 'sm' ? 'px-3 py-2 text-[12px]' : 'px-4 py-2.5 text-sm'
  const width = fullWidth ? 'w-full' : ''

  return (
    <button
      className={`${base} ${styles} ${sizes} ${width} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
