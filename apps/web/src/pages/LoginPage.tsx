import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
import { RecoveryCode } from '../components/RecoveryCode'
import { Warning } from '../components/icons'
import { api, type AuthResponse, type RecoverResponse } from '../lib/api'

type LoginPageProps = {
  onSuccess: (response: AuthResponse) => void
  initialError?: string
}

type LoginFormProps = {
  initialError: string
  onSuccess: (response: AuthResponse) => void
  onForgot: () => void
}

function LoginForm({ initialError, onSuccess, onForgot }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.login(email, password)
      onSuccess(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse o workspace desta instalação com a conta de dono."
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="sua senha"
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>

      <div className="mt-3.5 text-center">
        <button
          type="button"
          onClick={onForgot}
          className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </AuthLayout>
  )
}

type RecoverFormProps = {
  onBack: () => void
  onRecovered: (response: RecoverResponse) => void
}

function RecoverForm({ onBack, onRecovered }: RecoverFormProps) {
  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!recoveryCode.trim()) {
      setError('Informe o código de recuperação.')
      return
    }
    if (password.length < 10) {
      setError('Use uma senha nova com pelo menos 10 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais.')
      return
    }

    setLoading(true)
    try {
      const response = await api.recover(email, recoveryCode.trim(), password)
      onRecovered(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível recuperar o acesso.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Recuperar acesso"
      subtitle="Use o código de recuperação gerado na criação da conta ou na última troca de código."
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        <Field
          label="Código de recuperação"
          value={recoveryCode}
          onChange={setRecoveryCode}
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
        />
        <Field
          label="Nova senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={10}
          placeholder="mínimo de 10 caracteres"
        />
        <Field
          label="Confirme a nova senha"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={10}
          placeholder="repita a senha"
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" loading={loading}>
          Recuperar acesso
        </Button>
      </form>

      <div className="mt-3.5 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Voltar para o login
        </button>
      </div>
    </AuthLayout>
  )
}

export function LoginPage({ onSuccess, initialError = '' }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'recover'>('login')
  const [recovered, setRecovered] = useState<RecoverResponse | null>(null)

  if (recovered) {
    return (
      <AuthLayout
        title="Acesso recuperado"
        subtitle="Sua senha foi alterada e um novo código de recuperação foi gerado. O código antigo deixou de valer."
      >
        <div className="space-y-3.5">
          <RecoveryCode code={recovered.recovery_code} label="Novo código de recuperação" />

          <div className="flex items-start gap-2 rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p>Guarde o novo código agora: ele aparece uma única vez. O código anterior não funciona mais.</p>
          </div>

          <Button type="button" onClick={() => onSuccess(recovered)}>
            Entrar no Interpres
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (mode === 'recover') {
    return (
      <RecoverForm
        onBack={() => setMode('login')}
        onRecovered={(response) => setRecovered(response)}
      />
    )
  }

  return (
    <LoginForm
      initialError={initialError}
      onSuccess={onSuccess}
      onForgot={() => setMode('recover')}
    />
  )
}
