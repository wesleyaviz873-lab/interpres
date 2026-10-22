import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, type SessionInfo, type User } from '../lib/api'
import { Button } from './Button'
import { ErrorBanner } from './ErrorBanner'
import { Field } from './Field'
import { RecoveryCode } from './RecoveryCode'
import {
  Key,
  Logout,
  Mail,
  Refresh,
  Settings,
  Shield,
  User as UserIcon,
  Warning,
  X,
} from './icons'

type SettingsModalProps = {
  user: User
  onClose: () => void
  onUserChange: (user: User) => void
  onSessionEnded: () => void
}

type Tab = 'conta' | 'seguranca' | 'sobre'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'conta', label: 'Conta' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'sobre', label: 'Sobre' },
]

export function SettingsModal({ user, onClose, onUserChange, onSessionEnded }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('conta')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60 focus:outline-none"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Settings className="h-4 w-4 text-accent" />
          <h2 id="settings-title" className="text-[13px] font-semibold text-paper">
            Configurações
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-line px-3 py-2" role="tablist" aria-label="Seções">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                tab === item.id
                  ? 'bg-white/[0.07] text-paper'
                  : 'text-muted hover:bg-white/[0.04] hover:text-paper'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === 'conta' ? (
            <AccountSection user={user} onUserChange={onUserChange} />
          ) : null}
          {tab === 'seguranca' ? (
            <SecuritySection user={user} onSessionEnded={onSessionEnded} />
          ) : null}
          {tab === 'sobre' ? <AboutSection /> : null}
        </div>
      </div>
    </div>
  )
}

type SectionProps = {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
}

function Section({ title, description, icon, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-line bg-ink/40 p-4">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <h3 className="text-[13px] font-semibold text-paper">{title}</h3>
      </div>
      {description ? <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p> : null}
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  )
}

function Notice({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] leading-5 text-emerald-200"
    >
      {message}
    </p>
  )
}

type AccountSectionProps = {
  user: User
  onUserChange: (user: User) => void
}

function AccountSection({ user, onUserChange }: AccountSectionProps) {
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [codePassword, setCodePassword] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [codeError, setCodeError] = useState('')
  const [codeNotice, setCodeNotice] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailError('')
    setEmailNotice('')

    if (!newEmail.trim()) {
      setEmailError('Informe o novo e-mail.')
      return
    }

    setEmailLoading(true)
    try {
      const response = await api.changeEmail(emailPassword, newEmail.trim())
      onUserChange(response.user)
      setNewEmail('')
      setEmailPassword('')
      setEmailNotice('E-mail atualizado.')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Não foi possível alterar o e-mail.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    if (newPassword.length < 10) {
      setPasswordError('Use uma senha nova com pelo menos 10 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As duas senhas novas não são iguais.')
      return
    }

    setPasswordLoading(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordNotice('Senha alterada.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.')
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCodeError('')
    setCodeNotice('')
    setCode(null)

    setCodeLoading(true)
    try {
      const response = await api.recoveryCode(codePassword)
      setCode(response.recovery_code)
      setCodePassword('')
      setCodeNotice('Novo código gerado. O código anterior deixou de valer.')
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Não foi possível gerar o código.')
    } finally {
      setCodeLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Section title="Conta" description="Uma instalação, uma conta de dono." icon={<UserIcon className="h-4 w-4" />}>
        <div className="rounded-xl border border-line bg-ink px-3.5 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">E-mail atual</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-paper">{user.email}</p>
        </div>
      </Section>

      <Section
        title="Alterar e-mail"
        description="O novo e-mail passa a valer para o próximo login."
        icon={<Mail className="h-4 w-4" />}
      >
        <form className="space-y-2.5" onSubmit={handleEmailSubmit}>
          <Field
            label="Novo e-mail"
            type="email"
            value={newEmail}
            onChange={setNewEmail}
            autoComplete="email"
            placeholder="novo@exemplo.com"
          />
          <Field
            label="Senha atual"
            type="password"
            value={emailPassword}
            onChange={setEmailPassword}
            autoComplete="current-password"
            placeholder="confirme com sua senha"
          />
          {emailError ? <ErrorBanner message={emailError} /> : null}
          {emailNotice ? <Notice message={emailNotice} /> : null}
          <Button type="submit" size="sm" loading={emailLoading}>
            Salvar novo e-mail
          </Button>
        </form>
      </Section>

      <Section
        title="Alterar senha"
        description="Mínimo de 10 caracteres. A sessão atual continua ativa."
        icon={<Key className="h-4 w-4" />}
      >
        <form className="space-y-2.5" onSubmit={handlePasswordSubmit}>
          <Field
            label="Senha atual"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="sua senha atual"
          />
          <Field
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={10}
            placeholder="mínimo de 10 caracteres"
          />
          <Field
            label="Confirme a nova senha"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            minLength={10}
            placeholder="repita a nova senha"
          />
          {passwordError ? <ErrorBanner message={passwordError} /> : null}
          {passwordNotice ? <Notice message={passwordNotice} /> : null}
          <Button type="submit" size="sm" loading={passwordLoading}>
            Alterar senha
          </Button>
        </form>
      </Section>

      <Section
        title="Código de recuperação"
        description="Gere um novo código se o atual pode ter sido exposto."
        icon={<Refresh className="h-4 w-4" />}
      >
        <form className="space-y-2.5" onSubmit={handleCodeSubmit}>
          <Field
            label="Senha atual"
            type="password"
            value={codePassword}
            onChange={setCodePassword}
            autoComplete="current-password"
            placeholder="confirme com sua senha"
          />
          {codeError ? <ErrorBanner message={codeError} /> : null}
          {codeNotice ? <Notice message={codeNotice} /> : null}
          {code ? <RecoveryCode code={code} label="Novo código de recuperação" /> : null}
          <Button type="submit" size="sm" variant="secondary" loading={codeLoading}>
            Gerar novo código de recuperação
          </Button>
        </form>
      </Section>
    </div>
  )
}

type SecuritySectionProps = {
  user: User
  onSessionEnded: () => void
}

function SecuritySection({ user, onSessionEnded }: SecuritySectionProps) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .session()
      .then((data) => {
        if (alive) setSession(data)
      })
      .catch((err: unknown) => {
        if (alive) {
          setSessionError(err instanceof Error ? err.message : 'Não foi possível ler a sessão.')
        }
      })
    return () => {
      alive = false
    }
  }, [])

  async function handleLogoutAll() {
    setEndError('')
    setEnding(true)
    try {
      await api.logoutAll()
      onSessionEnded()
    } catch (err) {
      setEndError(err instanceof Error ? err.message : 'Não foi possível encerrar as sessões.')
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="space-y-3">
      <Section
        title="Sessão atual"
        description="Validade e limites desta sessão neste navegador."
        icon={<Shield className="h-4 w-4" />}
      >
        {sessionError ? <ErrorBanner message={sessionError} /> : null}
        {!session && !sessionError ? (
          <p className="text-[12px] text-muted">Lendo sessão...</p>
        ) : null}
        {session ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Stat label="Expira em" value={formatDuration(session.expires_in_seconds)} />
            <Stat label="Duração total" value={formatDuration(session.session_ttl)} />
            <Stat label="Expira em (data)" value={formatDateTime(session.expires_at)} />
            <Stat label="Conta" value={session.user.email || user.email} />
          </div>
        ) : null}
        <p className="rounded-xl border border-line bg-ink/60 px-3.5 py-2.5 text-[11px] leading-4 text-muted">
          A sessão usa cookie <span className="font-mono text-paper/80">HttpOnly</span>, então o
          token não é acessível pelo JavaScript. Ações que alteram dados exigem o cabeçalho{' '}
          <span className="font-mono text-paper/80">X-CSRF-Token</span>.
        </p>
      </Section>

      <Section
        title="Encerrar sessões"
        description="Sai deste dispositivo e de qualquer outro onde a conta esteja aberta."
        icon={<Logout className="h-4 w-4" />}
      >
        {confirming ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-red-200">
              <Warning className="h-3.5 w-3.5" />
              Encerrar todas as sessões?
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-red-200/80">
              Você precisará entrar novamente em todos os dispositivos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={ending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                fullWidth={false}
                loading={ending}
                onClick={handleLogoutAll}
              >
                Sair de todos
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onClick={() => setConfirming(true)}
          >
            <Logout className="h-3.5 w-3.5" />
            Sair de todos os dispositivos
          </Button>
        )}
        {endError ? <ErrorBanner message={endError} /> : null}
      </Section>

      <Section
        title="Outros métodos"
        description="Autenticação em dois fatores, passkeys e login por OIDC entram em blocos futuros."
        icon={<Key className="h-4 w-4" />}
      >
        <p className="text-[11px] leading-4 text-muted">
          Nada para ativar nesta versão. Quando existirem, esses métodos aparecerão aqui com
          estado real — sem opções simuladas.
        </p>
      </Section>
    </div>
  )
}

function AboutSection() {
  return (
    <div className="space-y-3">
      <Section
        title="Interpres"
        description="Workspace de IA auto-hospedado."
        icon={<Shield className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat label="Versão" value="0.1.0" />
          <Stat label="Licença" value="AGPL-3.0" />
        </div>
        <p className="text-[11px] leading-5 text-muted">
          Software livre, sem cadastro público. Os dados desta instalação ficam no seu próprio
          servidor, sob o seu controle.
        </p>
      </Section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-0.5 truncate text-[12px] font-medium text-paper" title={value}>
        {value}
      </p>
    </div>
  )
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0) {
    return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
  }
  return `${minutes} min`
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
