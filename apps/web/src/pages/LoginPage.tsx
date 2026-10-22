import { useEffect, useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { RecoveryCode } from '../components/RecoveryCode'
import { Check, Copy, Warning } from '../components/icons'
import { copyToClipboard } from '../lib/clipboard'
import {
  api,
  type AuthResponse,
  type RecoveryMethods,
  type RecoveryOptions,
  type ResetPasswordResponse,
} from '../lib/api'

const CLI_RESET_COMMAND =
  'docker compose exec --user interpres interpres python -m app.cli reset-password --email seu@email.com --generate'

type LoginPageProps = {
  onSuccess: (response: AuthResponse) => void
  onSetup: () => void
  initialError?: string
}

type LoginFormProps = {
  initialError: string
  emailLoginAvailable: boolean
  onSuccess: (response: AuthResponse) => void
  onForgot: () => void
  onSetup: () => void
}

function LoginForm({
  initialError,
  emailLoginAvailable,
  onSuccess,
  onForgot,
  onSetup,
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [emailLogin, setEmailLogin] = useState(false)

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

  if (emailLogin) {
    return <EmailLoginForm onSuccess={onSuccess} onBack={() => setEmailLogin(false)} />
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

      {emailLoginAvailable ? (
        <button
          type="button"
          onClick={() => setEmailLogin(true)}
          className="mt-2 w-full rounded-xl border border-line px-3.5 py-2.5 text-[12px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper"
        >
          Entrar com código por e-mail
        </button>
      ) : null}

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

type EmailLoginFormProps = {
  onSuccess: (response: AuthResponse) => void
  onBack: () => void
}

function EmailLoginForm({ onSuccess, onBack }: EmailLoginFormProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError('Informe o e-mail da conta.')
      return
    }

    setLoading(true)
    try {
      await api.emailCode(email.trim())
      setCode('')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!code.trim()) {
      setError('Informe o código recebido.')
      return
    }

    setLoading(true)
    try {
      const response = await api.emailLogin(email.trim(), code.trim())
      onSuccess(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    setResending(true)
    try {
      await api.emailCode(email.trim())
      setNotice('Novo código enviado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar o código.')
    } finally {
      setResending(false)
    }
  }

  if (step === 'email') {
    return (
      <AuthLayout
        title="Entrar com código"
        subtitle="Enviamos um código de 6 dígitos para o e-mail da conta."
      >
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
            Enviar código
          </Button>
        </form>

        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            Voltar para o login com senha
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Código por e-mail"
      subtitle={`Digite o código enviado para ${email.trim()}.`}
    >
      <form className="space-y-3" onSubmit={handleLogin}>
        <Field
          label="Código recebido"
          value={code}
          onChange={setCode}
          autoComplete="one-time-code"
          placeholder="000000"
        />
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? <Notice message={notice} /> : null}
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setStep('email')
            setCode('')
            setError('')
            setNotice('')
          }}
          className="font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Trocar e-mail
        </button>
        <button
          type="button"
          onClick={() => {
            void handleResend()
          }}
          disabled={resending}
          className="font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline disabled:opacity-60"
        >
          {resending ? 'Enviando...' : 'Reenviar código'}
        </button>
      </div>

      <div className="mt-3.5 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Voltar para o login com senha
        </button>
      </div>
    </AuthLayout>
  )
}

type EmailResetFormProps = {
  email: string
  onDone: (response: ResetPasswordResponse) => void
}

function EmailResetForm({ email, onDone }: EmailResetFormProps) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

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
      const response = await api.resetPassword(email, code.trim(), password)
      onDone(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    setResending(true)
    try {
      await api.forgotPassword(email)
      setNotice('Novo código enviado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar o código.')
    } finally {
      setResending(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleReset}>
      <Notice message={`Código enviado para ${email}. Confira a caixa de entrada.`} />
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
      {notice ? <Notice message={notice} /> : null}
      <Button type="submit" loading={loading}>
        Redefinir senha
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            void handleResend()
          }}
          disabled={resending}
          className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline disabled:opacity-60"
        >
          {resending ? 'Enviando...' : 'Reenviar código'}
        </button>
      </div>
    </form>
  )
}

type CodeRecoverFormProps = {
  email: string
  onDone: (response: ResetPasswordResponse) => void
}

function CodeRecoverForm({ email: initialEmail, onDone }: CodeRecoverFormProps) {
  const [email, setEmail] = useState(initialEmail)
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

type RecoverStep = 'lookup' | 'choose' | 'email' | 'code' | 'unavailable'

type RecoverFormProps = {
  onBack: () => void
  onRecovered: (response: ResetPasswordResponse, viaEmail: boolean) => void
}

function RecoverForm({ onBack, onRecovered }: RecoverFormProps) {
  const [step, setStep] = useState<RecoverStep>('lookup')
  const [email, setEmail] = useState('')
  const [options, setOptions] = useState<RecoveryOptions | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Informe o e-mail da conta.')
      return
    }

    setLoading(true)
    try {
      const result = await api.recoveryOptions(email.trim())
      setEmail(email.trim())
      setOptions(result)
      if (result.email_configured) {
        setStep('choose')
      } else if (result.has_recovery_code) {
        setStep('code')
      } else {
        setStep('unavailable')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar esta conta.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCode() {
    setError('')
    setSending(true)
    try {
      await api.forgotPassword(email)
      setStep('email')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setSending(false)
    }
  }

  function handleChangeEmail() {
    setStep('lookup')
    setOptions(null)
    setError('')
  }

  const subtitle =
    step === 'lookup'
      ? 'Informe o e-mail da conta para ver o que está configurado nesta instalação.'
      : 'Siga o caminho disponível para esta conta.'

  return (
    <AuthLayout title="Esqueci minha senha" subtitle={subtitle}>
      {step === 'lookup' ? (
        <form className="space-y-3" onSubmit={handleLookup}>
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
            Continuar
          </Button>
        </form>
      ) : null}

      {step === 'choose' ? (
        <div className="space-y-2.5">
          <IdentityLine email={email} hint="Recuperação por e-mail disponível." />
          {error ? <ErrorBanner message={error} /> : null}
          <Button
            type="button"
            loading={sending}
            onClick={() => {
              void handleSendCode()
            }}
          >
            Receber código por e-mail
          </Button>
          {options?.has_recovery_code ? (
            <button
              type="button"
              onClick={() => setStep('code')}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-[12px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper"
            >
              Usar código de recuperação
            </button>
          ) : null}
          <BackToEmail onClick={handleChangeEmail} />
        </div>
      ) : null}

      {step === 'email' ? (
        <EmailResetForm email={email} onDone={(response) => onRecovered(response, true)} />
      ) : null}

      {step === 'code' ? (
        <CodeRecoverForm email={email} onDone={(response) => onRecovered(response, false)} />
      ) : null}

      {step === 'unavailable' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
            <p className="text-[12px] font-medium text-paper">
              Esta conta não tem recuperação configurada.
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              Redefina a senha no servidor com o comando abaixo.
            </p>
          </div>
          <CommandBox command={CLI_RESET_COMMAND} />
          <p className="text-[11px] leading-4 text-muted">
            Configurar o SMTP no <span className="font-mono text-paper/80">.env</span> habilita a
            recuperação por e-mail.
          </p>
          <BackToEmail onClick={handleChangeEmail} />
        </div>
      ) : null}

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

function IdentityLine({ email, hint }: { email: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
      <p className="truncate text-[12px] font-medium text-paper">{email}</p>
      <p className="mt-0.5 text-[10.5px] leading-4 text-muted">{hint}</p>
    </div>
  )
}

function BackToEmail({ onClick }: { onClick: () => void }) {
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onClick}
        className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
      >
        Usar outro e-mail
      </button>
    </div>
  )
}

function CommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    setFailed(false)
    const ok = await copyToClipboard(command)
    setCopied(ok)
    setFailed(!ok)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 rounded-xl border border-line bg-ink px-3 py-2">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-[10.5px] leading-4 text-paper/80">
          {command}
        </code>
        <button
          type="button"
          onClick={() => {
            void handleCopy()
          }}
          aria-label={copied ? 'Comando copiado' : 'Copiar comando'}
          title={copied ? 'Comando copiado' : 'Copiar comando'}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${
            copied
              ? 'border-emerald-500/30 text-emerald-300'
              : 'border-line text-muted hover:text-paper'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {failed ? (
        <p className="text-[10.5px] leading-4 text-red-300">
          Não foi possível copiar. Selecione o comando manualmente.
        </p>
      ) : null}
    </div>
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
        onBack={() => setMode('login')}
        onRecovered={(response, viaEmail) => setRecovered({ response, viaEmail })}
      />
    )
  }

  return (
    <LoginForm
      initialError={initialError}
      emailLoginAvailable={methods?.email === true}
      onSuccess={onSuccess}
      onForgot={() => setMode('recover')}
      onSetup={onSetup}
    />
  )
}
