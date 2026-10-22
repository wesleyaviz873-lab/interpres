import { useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { ErrorBanner } from '../components/ErrorBanner'
import { Field } from '../components/Field'
import { api, type AuthResponse } from '../lib/api'

type SetupPageProps = {
  onSuccess: (response: AuthResponse) => void
}

export function SetupPage({ onSuccess }: SetupPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      onSuccess(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
      setLoading(false)
    }
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
