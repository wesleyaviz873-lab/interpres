import { useEffect, useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { RecoveryCode } from '../components/RecoveryCode'
import { Warning } from '../components/icons'
import {
  api,
  type AuthResponse,
  type RecoveryMethods,
  type ResetPasswordResponse,
} from '../lib/api'

type LoginPageProps = {
  onSuccess: (response: AuthResponse) => void
  onSetup: () => void
  initialError?: string
}

type LoginFormProps = {
  initialError: string
  onSuccess: (response: AuthResponse) => void
  onForgot: () => void
  onSetup: () => void
}

function LoginForm({ initialError, onSuccess, onForgot, onSetup }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await api.login(email, password)
      if ('requires_2fa' in result) {
        setChallengeToken(result.challenge_token)
        setCode('')
        return
      }
      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challengeToken) return

    setError('')
    if (!code.trim()) {
      setError('Informe o código de verificação.')
      return
    }

    setLoading(true)
    try {
      const response = await api.login2fa(challengeToken, code.trim())
      onSuccess(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleBackToPassword() {
    setChallengeToken(null)
    setCode('')
    setError('')
  }

  if (challengeToken) {
    return (
      <AuthLayout
        title="Verificação em duas etapas"
        subtitle="Informe o código de 6 dígitos do aplicativo autenticador ou um código de backup."
      >
        <form className="space-y-3" onSubmit={handleVerify}>
          <Field
            label="Código de verificação"
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
            placeholder="123456 ou código de backup"
          />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" loading={loading}>
            Confirmar
          </Button>
        </form>

        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={handleBackToPassword}
            className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </AuthLayout>
    )
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

      <div className="mt-2 text-center text-[11px] leading-5 text-muted">
        Primeiro acesso?{' '}
        <button
          type="button"
          onClick={onSetup}
          className="font-medium text-paper/90 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Criar conta
        </button>
      </div>
    </AuthLayout>
  )
}

type EmailResetFormProps = {
  onDone: (response: ResetPasswordResponse) => void
}

function EmailResetForm({ onDone }: EmailResetFormProps) {
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Informe o e-mail da conta.')
      return
    }

    setLoading(true)
    try {
      await api.forgotPassword(email.trim())
      setCode('')
      setPassword('')
      setConfirm('')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('Informe o código recebido por e-mail.')
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
      const response = await api.resetPassword(email.trim(), code.trim(), password)
      onDone(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'request') {
    return (
      <form className="space-y-3" onSubmit={handleRequest}>
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" loading={loading}>
          Enviar código por e-mail
        </Button>
      </form>
    )
  }

  return (
    <form className="space-y-3" onSubmit={handleReset}>
      <Notice message="Código enviado para o e-mail informado. Confira a caixa de entrada." />
      <Field
        label="Código recebido"
        value={code}
        onChange={setCode}
        autoComplete="one-time-code"
        placeholder="código do e-mail"
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
        Redefinir senha
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setStep('request')
            setCode('')
            setPassword('')
            setConfirm('')
            setError('')
          }}
          className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Enviar para outro e-mail
        </button>
      </div>
    </form>
  )
}

type CodeRecoverFormProps = {
  onDone: (response: ResetPasswordResponse) => void
}

function CodeRecoverForm({ onDone }: CodeRecoverFormProps) {
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
      onDone(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível recuperar o acesso.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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

      <details className="mt-3 rounded-xl border border-line bg-ink/40 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
        <summary className="cursor-pointer font-medium text-paper/90">Não tenho o código</summary>
        <p className="mt-2">
          O código foi mostrado uma única vez na criação da conta, no formato
          <span className="font-mono text-paper/80"> XXXX-XXXX-XXXX</span>.
        </p>
        <p className="mt-2">Sem ele, o dono do servidor pode redefinir a senha:</p>
        <code className="mt-1 block break-all rounded-lg bg-black/40 p-2 font-mono text-[10px] text-paper/80">
          docker compose exec --user interpres interpres python -m app.cli reset-password --email seu@email.com
        </code>
      </details>
    </>
  )
}

type RecoverFormProps = {
  emailAvailable: boolean
  onBack: () => void
  onRecovered: (response: ResetPasswordResponse, viaEmail: boolean) => void
}

function RecoverForm({ emailAvailable, onBack, onRecovered }: RecoverFormProps) {
  const [method, setMethod] = useState<'email' | 'code'>(emailAvailable ? 'email' : 'code')

  const subtitle = emailAvailable
    ? 'Receba um código por e-mail ou use o código de recuperação da conta.'
    : 'Use o código de recuperação gerado na criação da conta ou na última troca de código.'

  return (
    <AuthLayout title="Recuperar acesso" subtitle={subtitle}>
      {emailAvailable ? (
        <div
          role="group"
          aria-label="Forma de recuperação"
          className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink/60 p-1"
        >
          <button
            type="button"
            aria-pressed={method === 'email'}
            onClick={() => setMethod('email')}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              method === 'email'
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:text-paper'
            }`}
          >
            Receber por e-mail
          </button>
          <button
            type="button"
            aria-pressed={method === 'code'}
            onClick={() => setMethod('code')}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              method === 'code'
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:text-paper'
            }`}
          >
            Usar código de recuperação
          </button>
        </div>
      ) : null}

      {method === 'email' ? (
        <EmailResetForm onDone={(response) => onRecovered(response, true)} />
      ) : (
        <CodeRecoverForm onDone={(response) => onRecovered(response, false)} />
      )}

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

type RecoveredState = {
  response: ResetPasswordResponse
  viaEmail: boolean
}

export function LoginPage({ onSuccess, onSetup, initialError = '' }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'recover'>('login')
  const [methods, setMethods] = useState<RecoveryMethods | null>(null)
  const [recovered, setRecovered] = useState<RecoveredState | null>(null)

  useEffect(() => {
    let alive = true
    api
      .recoveryMethods()
      .then((data) => {
        if (alive) setMethods(data)
      })
      .catch(() => {
        if (alive) {
          setMethods({ email: false, recovery_code: true, admin_cli: true })
        }
      })
    return () => {
      alive = false
    }
  }, [])

  if (recovered) {
    const viaEmail = recovered.viaEmail

    return (
      <AuthLayout
        title="Acesso recuperado"
        subtitle="Sua senha foi alterada e um novo código de recuperação foi gerado. O código anterior deixou de valer."
      >
        <div className="space-y-3.5">
          {viaEmail ? (
            <details className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-[12px] font-medium text-paper/90">
                Código de recuperação (opcional)
              </summary>
              <div className="mt-2.5">
                <RecoveryCode
                  code={recovered.response.recovery_code}
                  label="Novo código de recuperação"
                />
              </div>
            </details>
          ) : (
            <details open className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-[12px] font-medium text-paper/90">
                Novo código de recuperação (recomendado guardar)
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <RecoveryCode
                  code={recovered.response.recovery_code}
                  label="Novo código de recuperação"
                />
                <div className="flex items-start gap-2 rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
                  <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <p>
                    Guarde o novo código agora: ele aparece uma única vez. O código anterior não
                    funciona mais.
                  </p>
                </div>
              </div>
            </details>
          )}

          <Button type="button" onClick={() => onSuccess(recovered.response)}>
            Entrar no Interpres
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (mode === 'recover') {
    return (
      <RecoverForm
        emailAvailable={methods?.email === true}
        onBack={() => setMode('login')}
        onRecovered={(response, viaEmail) => setRecovered({ response, viaEmail })}
      />
    )
  }

  return (
    <LoginForm
      initialError={initialError}
      onSuccess={onSuccess}
      onForgot={() => setMode('recover')}
      onSetup={onSetup}
    />
  )
}
