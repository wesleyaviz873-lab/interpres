import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
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
  const [saved, setSaved] = useState(false)

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
    return (
      <AuthLayout
        title="Guarde o código de recuperação"
        subtitle="Sua conta de dono foi criada. Este código é a única forma de recuperar o acesso se você esquecer a senha."
      >
        <div className="space-y-3.5">
          <RecoveryCode code={response.recovery_code} />

          <div className="flex items-start gap-2 rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p>Ele aparece uma única vez e não pode ser consultado depois. Não feche esta página antes de guardar.</p>
          </div>

          <p className="text-[11px] leading-4 text-muted">
            Sem o código, o dono do servidor pode redefinir a senha com{' '}
            <code className="break-all font-mono text-[10px] text-paper/80">
              docker compose exec --user interpres interpres python -m app.cli reset-password --email seu@email.com
            </code>
            .
          </p>

          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-paper/90">
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>Salvei o código em um lugar seguro</span>
          </label>

          <Button
            type="button"
            disabled={!saved}
            onClick={() => onSuccess(response)}
          >
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
