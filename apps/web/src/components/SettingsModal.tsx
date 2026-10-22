import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  api,
  type AgentInfo,
  type HealthResponse,
  type OllamaModelsResponse,
  type ProviderInfo,
  type RecoveryMethods,
  type SessionInfo,
  type TwoFactorSetupResponse,
  type TwoFactorStatus,
  type User,
} from '../lib/api'
import { copyToClipboard } from '../lib/clipboard'
import {
  ACCENTS,
  applyAppearance,
  loadAppearance,
  loadNotifications,
  loadVoice,
  saveAppearance,
  saveNotifications,
  saveVoice,
  type AppearancePreferences,
  type NotificationPreferences,
  type VoicePreferences,
} from '../lib/preferences'
import { Button } from './Button'
import { ErrorBanner } from './ErrorBanner'
import { Field } from './Field'
import { Notice } from './Notice'
import { RecoveryCode } from './RecoveryCode'
import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  Globe,
  Info,
  Key,
  Logout,
  Mail,
  Mic,
  Refresh,
  Settings,
  Shield,
  Sliders,
  Terminal,
  User as UserIcon,
  Warning,
  X,
} from './icons'

export type SettingsSection =
  | 'conta'
  | 'seguranca'
  | 'chaves'
  | 'voz'
  | 'harnesses'
  | 'memoria'
  | 'backend'
  | 'aparencia'
  | 'notificacoes'
  | 'sobre'

type SettingsModalProps = {
  user: User
  initialSection?: SettingsSection
  onClose: () => void
  onUserChange: (user: User) => void
  onSessionEnded: () => void
  onProvidersChanged?: () => void
}

type SectionDefinition = {
  id: SettingsSection
  label: string
  description: string
  Icon: ComponentType<{ className?: string }>
}

const SECTIONS: SectionDefinition[] = [
  { id: 'conta', label: 'Conta', description: 'E-mail e senha da conta.', Icon: UserIcon },
  {
    id: 'seguranca',
    label: 'Segurança',
    description: 'Recuperação de acesso, 2FA e sessões.',
    Icon: Shield,
  },
  {
    id: 'chaves',
    label: 'Chaves de API',
    description: 'Provedores de modelo desta instalação.',
    Icon: Key,
  },
  { id: 'voz', label: 'Voz', description: 'Preferências de áudio.', Icon: Mic },
  { id: 'harnesses', label: 'Harnesses', description: 'Agentes locais detectados.', Icon: Terminal },
  {
    id: 'memoria',
    label: 'Memória do Projeto',
    description: 'Contexto por workspace e projeto.',
    Icon: Database,
  },
  {
    id: 'backend',
    label: 'Backend / Endpoint',
    description: 'Conexão com a API desta instalação.',
    Icon: Globe,
  },
  { id: 'aparencia', label: 'Aparência', description: 'Fonte, cor e animações.', Icon: Sliders },
  {
    id: 'notificacoes',
    label: 'Notificações',
    description: 'Avisos de trabalho em segundo plano.',
    Icon: Bell,
  },
  { id: 'sobre', label: 'Sobre', description: 'Versão e licença.', Icon: Info },
]

export function SettingsModal({
  user,
  initialSection = 'conta',
  onClose,
  onUserChange,
  onSessionEnded,
  onProvidersChanged,
}: SettingsModalProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const dialogRef = useRef<HTMLDivElement>(null)
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm sm:p-6"
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
        className="relative flex h-dvh w-full flex-col overflow-hidden border border-line bg-panel shadow-2xl shadow-black/60 focus:outline-none sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-4xl sm:flex-row sm:rounded-2xl"
      >
        <aside className="flex shrink-0 flex-col border-b border-line bg-ink/40 sm:w-56 sm:border-b-0 sm:border-r">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
            <Settings className="h-4 w-4 text-accent" />
            <h2 id="settings-title" className="text-[13px] font-semibold text-paper">
              Configurações
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar configurações"
              className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav
            className="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:overflow-y-auto"
            aria-label="Seções de configuração"
          >
            {SECTIONS.map((item) => {
              const Icon = item.Icon
              const isActive = item.id === section
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors sm:w-full ${
                    isActive
                      ? 'bg-white/[0.07] text-paper'
                      : 'text-muted hover:bg-white/[0.04] hover:text-paper'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : ''}`} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto hidden border-t border-line px-3 py-2.5 sm:block">
            <p className="truncate text-[10.5px] text-muted" title={user.email}>
              {user.email}
            </p>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="hidden shrink-0 items-start gap-3 border-b border-line px-4 py-3 sm:flex">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-paper">{active.label}</h3>
              <p className="mt-0.5 text-[11px] leading-4 text-muted">{active.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar configurações"
              className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {section === 'conta' ? (
              <AccountSection user={user} onUserChange={onUserChange} />
            ) : null}
            {section === 'seguranca' ? (
              <SecuritySection user={user} onSessionEnded={onSessionEnded} />
            ) : null}
            {section === 'chaves' ? (
              <ProvidersSection onProvidersChanged={onProvidersChanged} />
            ) : null}
            {section === 'voz' ? <VoiceSection /> : null}
            {section === 'harnesses' ? <HarnessesSection /> : null}
            {section === 'memoria' ? <ProjectMemorySection /> : null}
            {section === 'backend' ? <BackendSection /> : null}
            {section === 'aparencia' ? <AppearanceSection /> : null}
            {section === 'notificacoes' ? <NotificationsSection /> : null}
            {section === 'sobre' ? <AboutSection /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

type CardProps = {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

function Card({ title, description, action, children }: CardProps) {
  return (
    <section className="rounded-xl border border-line bg-ink/40 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-semibold leading-4 text-paper">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  )
}

type DisclosureProps = {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

function Disclosure({ title, summary, open, onToggle, children }: DisclosureProps) {
  return (
    <div className="rounded-xl border border-line bg-ink/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="text-[12px] font-medium text-paper">{title}</span>
        {summary ? <span className="ml-auto text-[10.5px] text-muted">{summary}</span> : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-2.5 border-t border-line px-3.5 py-3">{children}</div> : null}
    </div>
  )
}

function Chip({ tone, children }: { tone: 'ok' | 'off' | 'warn'; children: ReactNode }) {
  const styles =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-line bg-ink text-muted'

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-3 ${styles}`}
    >
      {children}
    </span>
  )
}

type ToggleProps = {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium leading-4 text-paper">{label}</p>
        {description ? (
          <p className="text-[10.5px] leading-4 text-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

type AccountSectionProps = {
  user: User
  onUserChange: (user: User) => void
}

function AccountSection({ user, onUserChange }: AccountSectionProps) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

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

  return (
    <div className="space-y-2.5">
      <Card title="Conta" description="Uma instalação, uma conta de dono.">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-ink px-3 py-2">
          <Mail className="h-4 w-4 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">E-mail atual</p>
            <p className="truncate text-[12.5px] font-medium text-paper">{user.email}</p>
          </div>
        </div>
        <p className="text-[11px] leading-4 text-muted">
          Alterações de e-mail e senha exigem a senha atual.
        </p>
      </Card>

      <Disclosure
        title="Alterar e-mail"
        summary={newEmail ? 'novo e-mail informado' : undefined}
        open={emailOpen}
        onToggle={() => {
          setEmailOpen((open) => !open)
          setEmailError('')
          setEmailNotice('')
          setEmailPassword('')
        }}
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
          <Button type="submit" size="sm" fullWidth={false} loading={emailLoading}>
            Salvar novo e-mail
          </Button>
        </form>
      </Disclosure>

      <Disclosure
        title="Alterar senha"
        summary={passwordNotice || undefined}
        open={passwordOpen}
        onToggle={() => {
          setPasswordOpen((open) => !open)
          setPasswordError('')
          setPasswordNotice('')
        }}
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
          <Button type="submit" size="sm" fullWidth={false} loading={passwordLoading}>
            Alterar senha
          </Button>
        </form>
      </Disclosure>
    </div>
  )
}

type SecuritySectionProps = {
  user: User
  onSessionEnded: () => void
}

function SecuritySection({ user, onSessionEnded }: SecuritySectionProps) {
  const [hasRecoveryCode, setHasRecoveryCode] = useState<boolean | null>(null)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .me()
      .then((data) => {
        if (alive) setHasRecoveryCode(data.has_recovery_code)
      })
      .catch((err: unknown) => {
        if (alive) {
          setStatusError(
            err instanceof Error ? err.message : 'Não foi possível ler o estado da segurança.',
          )
        }
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-2.5">
      <RecoveryCodeCard
        hasRecoveryCode={hasRecoveryCode}
        statusError={statusError}
        onGenerated={() => setHasRecoveryCode(true)}
      />
      <EmailRecoveryCard />
      <TwoFactorCard />
      <SessionCard user={user} />
      <LogoutAllCard onSessionEnded={onSessionEnded} />
    </div>
  )
}

type RecoveryCodeCardProps = {
  hasRecoveryCode: boolean | null
  statusError: string
  onGenerated: () => void
}

function RecoveryCodeCard({ hasRecoveryCode, statusError, onGenerated }: RecoveryCodeCardProps) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!password) {
      setError('Informe a senha atual.')
      return
    }

    setLoading(true)
    try {
      const response = await api.recoveryCode(password)
      setCode(response.recovery_code)
      setPassword('')
      setOpen(false)
      setNotice('Código gerado. Ele aparece uma única vez — copie ou baixe agora.')
      onGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o código.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Código de recuperação"
      description="Alternativa ao e-mail para recuperar o acesso."
      action={
        hasRecoveryCode === null ? undefined : (
          <Chip tone={hasRecoveryCode ? 'ok' : 'off'}>
            {hasRecoveryCode ? 'Ativo' : 'Não configurado'}
          </Chip>
        )
      }
    >
      {statusError ? <ErrorBanner message={statusError} /> : null}
      {notice ? <Notice message={notice} /> : null}
      {code ? <RecoveryCode code={code} label="Código de recuperação" /> : null}
      {code ? (
        <p className="text-[11px] leading-4 text-muted">
          Guarde agora: ele não será mostrado novamente.
        </p>
      ) : null}

      {open ? (
        <form className="space-y-2.5" onSubmit={handleSubmit}>
          <Field
            label="Senha atual"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="confirme com sua senha"
          />
          {error ? <ErrorBanner message={error} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" fullWidth={false} loading={loading}>
              Gerar código
            </Button>
            <Button
              type="button"
              size="sm"
              fullWidth={false}
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setOpen(false)
                setPassword('')
                setError('')
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          fullWidth={false}
          variant="secondary"
          onClick={() => {
            setOpen(true)
            setError('')
            setNotice('')
          }}
        >
          <Refresh className="h-3.5 w-3.5" />
          {hasRecoveryCode ? 'Gerar novo código' : 'Gerar código de recuperação'}
        </Button>
      )}
    </Card>
  )
}

function EmailRecoveryCard() {
  const [methods, setMethods] = useState<RecoveryMethods | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .recoveryMethods()
      .then((data) => {
        if (alive) setMethods(data)
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível ler os métodos de recuperação.',
          )
        }
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Card
      title="Recuperação por e-mail"
      description="Redefinição de senha com um código enviado para a caixa de entrada."
      action={
        methods === null ? undefined : (
          <Chip tone={methods.email ? 'ok' : 'off'}>
            {methods.email ? 'Ativa' : 'Desativada'}
          </Chip>
        )
      }
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!methods && !error ? <p className="text-[11px] text-muted">Lendo métodos...</p> : null}
      {methods?.email ? (
        <p className="text-[11px] leading-4 text-muted">
          O código de redefinição é enviado para o e-mail da conta.
        </p>
      ) : null}
      {methods && !methods.email ? (
        <>
          <p className="rounded-lg border border-line bg-ink/60 px-3 py-2 text-[11px] leading-4 text-muted">
            Desativada — configure SMTP no <span className="font-mono text-paper/80">.env</span> e
            reinicie o servidor.
          </p>
          <p className="text-[11px] leading-4 text-muted">
            Enquanto isso, o dono do servidor pode redefinir a senha pela CLI:
          </p>
          <code className="block break-all rounded-lg border border-line bg-ink px-2.5 py-1.5 font-mono text-[10px] text-paper/80">
            docker compose exec --user interpres interpres python -m app.cli reset-password --email
            seu@email.com
          </code>
        </>
      ) : null}
    </Card>
  )
}

function TwoFactorCard() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [notice, setNotice] = useState('')

  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [code, setCode] = useState('')
  const [enableLoading, setEnableLoading] = useState(false)
  const [enableError, setEnableError] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  const [disabling, setDisabling] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableError, setDisableError] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .twoFactorStatus()
      .then((data) => {
        if (alive) setStatus(data)
      })
      .catch((err: unknown) => {
        if (alive) {
          setStatusError(
            err instanceof Error ? err.message : 'Não foi possível ler o estado do 2FA.',
          )
        }
      })
    return () => {
      alive = false
    }
  }, [])

  async function loadStatus() {
    try {
      const data = await api.twoFactorStatus()
      setStatus(data)
      setStatusError('')
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Não foi possível ler o estado do 2FA.')
    }
  }

  async function handleStartSetup() {
    setSetupError('')
    setNotice('')
    setSetupLoading(true)
    try {
      setSetup(await api.twoFactorSetup())
      setCode('')
      setEnableError('')
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Não foi possível iniciar a configuração.')
    } finally {
      setSetupLoading(false)
    }
  }

  function cancelSetup() {
    setSetup(null)
    setCode('')
    setEnableError('')
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnableError('')

    if (!code.trim()) {
      setEnableError('Informe o código de 6 dígitos.')
      return
    }

    setEnableLoading(true)
    try {
      const response = await api.twoFactorEnable(code.trim())
      setBackupCodes(response.backup_codes)
      setStatus({ enabled: true, backup_codes_remaining: response.backup_codes.length })
      setSetup(null)
      setCode('')
      setNotice('2FA ativado. Guarde os códigos de backup.')
      await loadStatus()
    } catch (err) {
      setEnableError(err instanceof Error ? err.message : 'Não foi possível ativar o 2FA.')
    } finally {
      setEnableLoading(false)
    }
  }

  async function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDisableError('')

    if (!currentPassword) {
      setDisableError('Informe a senha atual.')
      return
    }
    if (!disableCode.trim()) {
      setDisableError('Informe o código do autenticador ou um código de backup.')
      return
    }

    setDisableLoading(true)
    try {
      await api.twoFactorDisable(currentPassword, disableCode.trim())
      setDisabling(false)
      setCurrentPassword('')
      setDisableCode('')
      setBackupCodes(null)
      setStatus({ enabled: false, backup_codes_remaining: 0 })
      setNotice('2FA desativado.')
      await loadStatus()
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : 'Não foi possível desativar o 2FA.')
    } finally {
      setDisableLoading(false)
    }
  }

  return (
    <Card
      title="Autenticação em dois fatores"
      description="Código de 6 dígitos de um aplicativo como Google Authenticator ou 1Password."
      action={
        status === null ? undefined : (
          <Chip tone={status.enabled ? 'ok' : 'off'}>
            {status.enabled ? 'Ativada' : 'Desativada'}
          </Chip>
        )
      }
    >
      {statusError ? <ErrorBanner message={statusError} /> : null}
      {notice ? <Notice message={notice} /> : null}
      {backupCodes ? (
        <BackupCodes codes={backupCodes} onDismiss={() => setBackupCodes(null)} />
      ) : null}
      {!status && !statusError ? <p className="text-[11px] text-muted">Lendo estado...</p> : null}

      {status && !status.enabled ? (
        setup ? (
          <form className="space-y-2.5" onSubmit={handleEnable}>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <img
                src={setup.qr_data_url}
                alt="QR code para configurar o aplicativo autenticador"
                className="h-32 w-32 shrink-0 self-center rounded-lg border border-line bg-white p-1.5 sm:self-start"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[11px] leading-4 text-muted">
                  Escaneie o QR code ou informe a chave manualmente no aplicativo.
                </p>
                <SecretCopy secret={setup.secret} />
              </div>
            </div>
            <Field
              label="Código de 6 dígitos"
              value={code}
              onChange={setCode}
              autoComplete="one-time-code"
              placeholder="123456"
            />
            {enableError ? <ErrorBanner message={enableError} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" fullWidth={false} loading={enableLoading}>
                Confirmar e ativar
              </Button>
              <Button
                type="button"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onClick={cancelSetup}
                disabled={enableLoading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] leading-4 text-muted">
              Desativada. Ative para exigir um código além da senha a cada login.
            </p>
            {setupError ? <ErrorBanner message={setupError} /> : null}
            <Button
              type="button"
              size="sm"
              fullWidth={false}
              loading={setupLoading}
              onClick={handleStartSetup}
            >
              Ativar 2FA
            </Button>
          </div>
        )
      ) : null}

      {status && status.enabled ? (
        <div className="space-y-2.5">
          <p className="text-[11px] text-muted">
            Códigos de backup restantes: {status.backup_codes_remaining}
          </p>

          {disabling ? (
            <form className="space-y-2.5" onSubmit={handleDisable}>
              <Field
                label="Senha atual"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                placeholder="confirme com sua senha"
              />
              <Field
                label="Código do autenticador ou backup"
                value={disableCode}
                onChange={setDisableCode}
                autoComplete="one-time-code"
                placeholder="123456 ou código de backup"
              />
              {disableError ? <ErrorBanner message={disableError} /> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  fullWidth={false}
                  variant="secondary"
                  loading={disableLoading}
                >
                  Desativar 2FA
                </Button>
                <Button
                  type="button"
                  size="sm"
                  fullWidth={false}
                  variant="secondary"
                  onClick={() => {
                    setDisabling(false)
                    setCurrentPassword('')
                    setDisableCode('')
                    setDisableError('')
                  }}
                  disabled={disableLoading}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              fullWidth={false}
              variant="secondary"
              onClick={() => setDisabling(true)}
            >
              Desativar 2FA
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  )
}

function SessionCard({ user }: { user: User }) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [sessionError, setSessionError] = useState('')

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

  return (
    <Card
      title="Sessão atual"
      description="Validade e limites desta sessão neste navegador."
      action={<Chip tone="off">HttpOnly</Chip>}
    >
      {sessionError ? <ErrorBanner message={sessionError} /> : null}
      {!session && !sessionError ? <p className="text-[11px] text-muted">Lendo sessão...</p> : null}
      {session ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat label="Expira em" value={formatDuration(session.expires_in_seconds)} />
          <Stat label="Duração total" value={formatDuration(session.session_ttl)} />
          <Stat label="Expira em (data)" value={formatDateTime(session.expires_at)} />
          <Stat label="Conta" value={session.user.email || user.email} />
        </div>
      ) : null}
      <p className="rounded-lg border border-line bg-ink/60 px-3 py-2 text-[11px] leading-4 text-muted">
        A sessão usa cookie <span className="font-mono text-paper/80">HttpOnly</span>. Ações que
        alteram dados exigem o cabeçalho{' '}
        <span className="font-mono text-paper/80">X-CSRF-Token</span>.
      </p>
    </Card>
  )
}

function LogoutAllCard({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState('')

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
    <Card
      title="Encerrar sessões"
      description="Sai deste dispositivo e de qualquer outro onde a conta esteja aberta."
    >
      {confirming ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-red-200">
            <Warning className="h-3.5 w-3.5" />
            Encerrar todas as sessões?
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-red-200/80">
            Você precisará entrar novamente em todos os dispositivos.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
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
    </Card>
  )
}

type ProvidersSectionProps = {
  onProvidersChanged?: () => void
}

function ProvidersSection({ onProvidersChanged }: ProvidersSectionProps) {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const data = await api.providers()
      setProviders(data.providers)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler os provedores.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function handleProviderChange(id: string, configured: boolean) {
    setProviders((current) =>
      current
        ? current.map((item) => (item.id === id ? { ...item, configured } : item))
        : current,
    )
    onProvidersChanged?.()
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-4 text-muted">
        As chaves ficam no backend desta instalação. Chaves salvas nunca são exibidas aqui.
      </p>

      {error ? (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          <Button
            type="button"
            size="sm"
            fullWidth={false}
            variant="secondary"
            onClick={() => {
              void refresh()
            }}
          >
            <Refresh className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!providers && !error ? <p className="text-[11px] text-muted">Lendo provedores...</p> : null}

      {providers?.map((provider) => (
        <ProviderRow
          key={provider.id}
          provider={provider}
          onChanged={(configured) => handleProviderChange(provider.id, configured)}
        />
      ))}
    </div>
  )
}

type ProviderRowProps = {
  provider: ProviderInfo
  onChanged: (configured: boolean) => void
}

function ProviderRow({ provider, onChanged }: ProviderRowProps) {
  const isOllama = provider.id === 'ollama'
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [testing, setTesting] = useState(false)
  const [ollama, setOllama] = useState<OllamaModelsResponse | null>(null)

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!value.trim()) {
      setError('Informe um valor antes de salvar.')
      return
    }

    setSaving(true)
    try {
      await api.saveProvider(provider.id, value.trim())
      setValue('')
      setNotice('Configuração salva.')
      onChanged(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setError('')
    setNotice('')
    setRemoving(true)
    try {
      await api.deleteProvider(provider.id)
      setNotice('Configuração removida.')
      setOllama(null)
      onChanged(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.')
    } finally {
      setRemoving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setError('')
    setNotice('')
    try {
      setOllama(await api.ollamaModels())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível testar o Ollama.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-ink/40 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[12.5px] font-semibold text-paper">{provider.label}</h3>
            <Chip tone={provider.configured ? 'ok' : 'off'}>
              {provider.configured ? 'Configurada' : 'Não configurada'}
            </Chip>
          </div>
          {provider.hint ? (
            <p className="mt-0.5 text-[11px] leading-4 text-muted">{provider.hint}</p>
          ) : null}
        </div>
        {provider.configured ? (
          <Button
            type="button"
            size="sm"
            fullWidth={false}
            variant="secondary"
            loading={removing}
            onClick={handleRemove}
          >
            Remover
          </Button>
        ) : null}
      </div>

      <form className="mt-2.5 space-y-2" onSubmit={handleSave}>
        <Field
          label={isOllama ? 'URL base' : 'Chave de API'}
          type={isOllama ? 'text' : 'password'}
          value={value}
          onChange={setValue}
          autoComplete="off"
          placeholder={provider.placeholder}
          required={false}
        />
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? <Notice message={notice} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" fullWidth={false} loading={saving}>
            Salvar
          </Button>
          {isOllama ? (
            <Button
              type="button"
              size="sm"
              fullWidth={false}
              variant="secondary"
              loading={testing}
              onClick={handleTest}
            >
              Testar conexão
            </Button>
          ) : null}
        </div>
      </form>

      {isOllama && ollama ? (
        ollama.reachable ? (
          <div className="mt-2 rounded-lg border border-line bg-ink px-3 py-2">
            <p className="text-[11px] leading-4 text-muted">
              {ollama.models.length === 0
                ? 'O Ollama respondeu, mas nenhum modelo foi encontrado.'
                : `${ollama.models.length} modelo(s) em ${ollama.base_url}`}
            </p>
            {ollama.models.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ollama.models.map((model) => (
                  <span
                    key={model}
                    className="rounded-md border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px] text-paper/80"
                  >
                    {model}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] leading-4 text-red-200">
            Ollama não respondeu{ollama.error ? `: ${ollama.error}` : ''}.
          </p>
        )
      ) : null}
    </div>
  )
}

function VoiceSection() {
  const [preferences, setPreferences] = useState<VoicePreferences>(() => loadVoice())

  function update(patch: Partial<VoicePreferences>) {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    saveVoice(next)
  }

  return (
    <Card title="Voz" description="Preferências para o bloco de áudio.">
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-paper/90">
          Transcrição (STT)
        </span>
        <select
          value={preferences.stt}
          onChange={(event) =>
            update({ stt: event.target.value === 'local' ? 'local' : 'openai' })
          }
          className="w-full rounded-lg border border-line bg-ink px-2.5 py-2 text-[12px] text-paper focus:border-accent/70 focus:outline-none"
        >
          <option value="openai">OpenAI</option>
          <option value="local">Local</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-paper/90">
          Resposta falada (TTS)
        </span>
        <select
          value={preferences.tts}
          onChange={(event) =>
            update({ tts: event.target.value === 'openai' ? 'openai' : 'none' })
          }
          className="w-full rounded-lg border border-line bg-ink px-2.5 py-2 text-[12px] text-paper focus:border-accent/70 focus:outline-none"
        >
          <option value="none">Nenhuma</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>

      <p className="text-[11px] leading-4 text-muted">
        O processamento de áudio chega no bloco de mídia. Nada é gravado ou enviado por esta tela.
      </p>
    </Card>
  )
}

function HarnessesSection() {
  const [agents, setAgents] = useState<AgentInfo[] | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const data = await api.agents()
      setAgents(data.agents)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível detectar os agentes.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <Card
      title="Harnesses"
      description="Agentes de linha de comando detectados nesta instalação."
      action={
        <Button
          type="button"
          size="sm"
          fullWidth={false}
          variant="secondary"
          onClick={() => {
            void refresh()
          }}
        >
          <Refresh className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      }
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!agents && !error ? <p className="text-[11px] text-muted">Detectando agentes...</p> : null}
      {agents && agents.length === 0 ? (
        <p className="text-[11px] text-muted">Nenhum agente detectado.</p>
      ) : null}

      {agents && agents.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink/40">
          {agents.map((agent) => (
            <li key={agent.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color || '#f97316' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-paper">{agent.name}</p>
                <p className="truncate font-mono text-[10.5px] text-muted">{agent.command}</p>
              </div>
              <Chip tone={agent.installed ? 'ok' : 'off'}>
                {agent.installed ? 'Instalado' : 'Ausente'}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] leading-4 text-muted">
        A execução de agentes chega no bloco do agente local. Esta tela apenas detecta o que
        existe no servidor.
      </p>
    </Card>
  )
}

function ProjectMemorySection() {
  return (
    <Card
      title="Memória do projeto"
      description="Contexto por workspace e projeto, em um só lugar."
    >
      <p className="text-[11px] leading-5 text-muted">
        A memória do projeto chega no próximo bloco. Ela vai guardar decisões, arquivos e contexto
        por workspace, com controle do que é lembrado.
      </p>
      <p className="text-[11px] leading-5 text-muted">Nada é armazenado por esta tela hoje.</p>
    </Card>
  )
}

function BackendSection() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    setLoading(true)
    setError('')
    try {
      setHealth(await api.health())
    } catch (err) {
      setHealth(null)
      setError(err instanceof Error ? err.message : 'Não foi possível falar com a API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Backend / Endpoint"
      description="A API desta instalação responde na mesma origem do painel."
    >
      <div className="flex items-center gap-3 rounded-lg border border-line bg-ink px-3 py-2">
        <Globe className="h-4 w-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
            API desta instalação
          </p>
          <p className="truncate font-mono text-[11.5px] text-paper">{window.location.origin}</p>
        </div>
        <Chip tone="off">mesma origem</Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          fullWidth={false}
          variant="secondary"
          loading={loading}
          onClick={handleTest}
        >
          Testar conexão
        </Button>
        {health ? <Chip tone="ok">online</Chip> : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {health ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Status" value={health.status} />
          <Stat label="Serviço" value={health.service} />
          <Stat label="Versão" value={health.version} />
        </div>
      ) : null}
    </Card>
  )
}

function AppearanceSection() {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => loadAppearance())
  const [notice, setNotice] = useState('')

  function update(patch: Partial<AppearancePreferences>) {
    setPreferences((current) => ({ ...current, ...patch }))
    setNotice('')
  }

  function handleSave() {
    saveAppearance(preferences)
    applyAppearance(preferences)
    setNotice('Aparência salva.')
  }

  return (
    <Card title="Aparência" description="Ajustes visuais salvos neste navegador.">
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="interpres-font-size" className="text-[11px] font-medium text-paper/90">
            Tamanho da fonte
          </label>
          <span className="rounded-md border border-line bg-ink px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
            {preferences.fontSize.toFixed(1)} px
          </span>
        </div>
        <input
          id="interpres-font-size"
          type="range"
          min={12}
          max={17}
          step={0.5}
          value={preferences.fontSize}
          onChange={(event) => update({ fontSize: Number(event.target.value) })}
          className="mt-1.5 w-full"
          style={{ accentColor: 'var(--interpres-accent)' }}
        />
      </div>

      <div>
        <p className="text-[11px] font-medium text-paper/90">Cor de destaque</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Cor de destaque">
          {ACCENTS.map((item) => {
            const selected = preferences.accent === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={selected}
                title={item.label}
                onClick={() => update({ accent: item.id })}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                  selected
                    ? 'border-white/30 bg-white/10 text-paper'
                    : 'border-line text-muted hover:text-paper'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <Toggle
        label="Animações"
        description="Transições e movimentos da interface."
        checked={preferences.animations}
        onChange={(checked) => update({ animations: checked })}
      />
      <Toggle
        label="Horários"
        description="Mostrar horário nas mensagens."
        checked={preferences.timestamps}
        onChange={(checked) => update({ timestamps: checked })}
      />

      <Button type="button" size="sm" fullWidth={false} onClick={handleSave}>
        Salvar configurações
      </Button>
      {notice ? <Notice message={notice} /> : null}
    </Card>
  )
}

function NotificationsSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => loadNotifications())

  function update(patch: Partial<NotificationPreferences>) {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    saveNotifications(next)
  }

  return (
    <Card title="Notificações" description="Avisos sobre o trabalho em segundo plano.">
      <Toggle
        label="Novos agendamentos e jobs"
        checked={preferences.jobs}
        onChange={(checked) => update({ jobs: checked })}
      />
      <Toggle
        label="Conclusão"
        checked={preferences.completed}
        onChange={(checked) => update({ completed: checked })}
      />
      <Toggle
        label="Erros"
        checked={preferences.errors}
        onChange={(checked) => update({ errors: checked })}
      />
      <p className="text-[11px] leading-4 text-muted">
        A entrega de notificações chega no bloco de jobs. Por enquanto, as preferências ficam
        salvas neste navegador.
      </p>
    </Card>
  )
}

function AboutSection() {
  return (
    <Card
      title="Interpres"
      description="Workspace de IA auto-hospedado, com seus modelos, seus arquivos e suas regras."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Stat label="Versão" value="0.1.0" />
        <Stat label="Licença" value="AGPL-3.0" />
      </div>
      <p className="text-[11px] leading-5 text-muted">
        Software livre, sem cadastro público. Os dados desta instalação ficam no seu servidor, sob
        o seu controle.
      </p>
      <p className="text-[11px] leading-5 text-muted">
        Chat, jobs persistentes, voz e memória de projeto entram nos próximos blocos.
      </p>
    </Card>
  )
}

function SecretCopy({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    const ok = await copyToClipboard(secret)
    setCopied(ok)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-[11px] text-paper">
        {secret}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Chave copiada' : 'Copiar chave'}
        title={copied ? 'Chave copiada' : 'Copiar chave'}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
          copied
            ? 'border-emerald-500/30 text-emerald-300'
            : 'border-line bg-ink/60 text-paper hover:border-white/25'
        }`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

type BackupCodesProps = {
  codes: string[]
  onDismiss: () => void
}

function BackupCodes({ codes, onDismiss }: BackupCodesProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopyAll() {
    setFailed(false)
    const ok = await copyToClipboard(codes.join('\n'))
    setCopied(ok)
    setFailed(!ok)
  }

  function handleDownload() {
    const content = [
      'Interpres — códigos de backup de autenticação em dois fatores',
      '',
      ...codes,
      '',
      'Cada código funciona uma única vez.',
      'Guarde este arquivo em um lugar seguro.',
      '',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'interpres-codigos-backup.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">
          Códigos de backup
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink/60 px-2 py-1 text-[11px] font-medium text-paper transition-colors hover:border-white/25"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar .txt
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            aria-label={copied ? 'Códigos copiados' : 'Copiar todos os códigos'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
              copied
                ? 'border-emerald-500/30 text-emerald-300'
                : 'border-line bg-ink/60 text-paper hover:border-white/25'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiados' : 'Copiar todos'}
          </button>
        </div>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[12px] text-paper">
        {codes.map((item) => (
          <li
            key={item}
            className="select-all rounded-lg border border-line bg-ink/60 px-2 py-1.5 text-center tracking-[0.08em]"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] leading-4 text-emerald-200/90">
        Guarde agora. Cada código funciona uma única vez e não será mostrado de novo.
      </p>
      {failed ? (
        <p className="mt-1 text-[11px] leading-4 text-red-300">
          Não foi possível copiar automaticamente. Selecione os códigos manualmente.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-[11px] font-medium text-emerald-200 underline-offset-2 transition-colors hover:text-emerald-100 hover:underline"
      >
        Já salvei
      </button>
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
