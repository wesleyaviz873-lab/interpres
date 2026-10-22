import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
import { Notice } from '../components/Notice'
import { RecoveryCode } from '../components/RecoveryCode'
import { Warning } from '../components/icons'
import { api, type AuthResponse, type SetupResponse } from '../lib/api'

type SetupPageProps = {
  onSuccess: (response: AuthResponse) => void
}

export function SetupPage({ onSuccess }: SetupPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SetupResponse | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 10) {
      setError('Use uma senha com pelo menos 10 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais.')
      return
    }

    setLoading(true)
    try {
      const created = await api.setup(email, password)
      setResponse(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  if (response) {
    const emailRecovery = response.email_recovery

    return (
      <AuthLayout
        title={emailRecovery ? 'Conta criada' : 'Guarde o código de recuperação'}
        subtitle={
          emailRecovery
            ? 'Sua conta de dono foi criada. A recuperação de senha está disponível por e-mail.'
            : 'Sua conta de dono foi criada. Guarde o código abaixo para recuperar o acesso se esquecer a senha.'
        }
      >
        <div className="space-y-3.5">
          {emailRecovery ? <Notice message="Recuperação por e-mail ativa" /> : null}

          {emailRecovery ? (
            <details className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-[12px] font-medium text-paper/90">
                Código de backup (opcional)
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <RecoveryCode code={response.recovery_code} label="Código de backup" />
                <p className="text-[11px] leading-4 text-muted">
                  Ele aparece uma única vez. Guarde se quiser recuperar o acesso sem depender do
                  e-mail.
                </p>
              </div>
            </details>
          ) : (
            <details open className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-[12px] font-medium text-paper/90">
                Código de recuperação (recomendado guardar)
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <RecoveryCode code={response.recovery_code} />

                <div className="flex items-start gap-2 rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
                  <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <p>
                    Sem o código, o administrador do servidor pode redefinir a senha pela CLI
                    (<span className="font-mono text-paper/80">reset-password</span>).
                  </p>
                </div>
              </div>
            </details>
          )}

          <Button type="button" onClick={() => onSuccess(response)}>
            Entrar no Interpres
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Primeiro acesso"
      subtitle="Crie a conta de dono desta instalação. Ela é a única conta administrativa; não existe cadastro público."
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
          autoComplete="new-password"
          minLength={10}
          placeholder="mínimo de 10 caracteres"
        />
        <Field
          label="Confirme a senha"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={10}
          placeholder="repita a senha"
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" loading={loading}>
          Criar conta de dono
        </Button>
      </form>
    </AuthLayout>
  )
}
