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
  type DeviceInfo,
  type HealthResponse,
  type OllamaModelsResponse,
  type ProviderInfo,
  type RecoveryMethods,
  type TunnelProvider,
  type TunnelStatus,
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
  Link as LinkIcon,
  Logout,
  Mail,
  Mic,
  Refresh,
  Settings,
  Shield,
  Sliders,
  Terminal,
  User as UserIcon,
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
  | 'tunel'
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
    description: 'Dispositivos, 2FA e recuperação.',
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
  {
    id: 'tunel',
    label: 'Túnel',
    description: 'Acesso público temporário.',
    Icon: LinkIcon,
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
            {section === 'tunel' ? <TunnelSection /> : null}
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

function Details({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-ink/50">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        {label}
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-2.5">{children}</div>
    </details>
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
      <AccountActiveCard user={user} onSessionEnded={onSessionEnded} />
      <DevicesCard onSessionEnded={onSessionEnded} />
      <TwoFactorCard />
      <EmailRecoveryCard />
      <RecoveryCodeCard
        hasRecoveryCode={hasRecoveryCode}
        statusError={statusError}
        onGenerated={() => setHasRecoveryCode(true)}
      />
    </div>
  )
}

function AccountActiveCard({
  user,
  onSessionEnded,
}: {
  user: User
  onSessionEnded: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')

  async function handleLogoutAll() {
    setError('')
    setEnding(true)
    try {
      await api.logoutAll()
      onSessionEnded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível encerrar as sessões.')
    } finally {
      setEnding(false)
    }
  }

  return (
    <Card title="Conta ativa" action={<Chip tone="ok">Ativa</Chip>}>
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-ink px-3 py-2">
        <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-paper">
          {user.email}
        </p>
        {confirming ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={ending}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10.5px] font-medium text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-60"
            >
              {ending ? 'Saindo...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={ending}
              className="rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-muted transition-colors hover:text-paper disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper"
          >
            <Logout className="h-3 w-3" />
            Sair de todos os dispositivos
          </button>
        )}
      </div>
      {error ? <ErrorBanner message={error} /> : null}
    </Card>
  )
}

function DevicesCard({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.devices()
      setDevices(data.devices)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler os dispositivos.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleRevoke(device: DeviceInfo) {
    setError('')
    setRevoking(device.id)
    try {
      await api.revokeDevice(device.id)
      if (device.current) {
        onSessionEnded()
        return
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível revogar o dispositivo.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <Card
      title="Dispositivos conectados"
      action={
        <button
          type="button"
          onClick={() => {
            void refresh()
          }}
          aria-label="Atualizar dispositivos"
          title="Atualizar"
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-paper"
        >
          <Refresh className="h-3.5 w-3.5" />
        </button>
      }
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!devices && !error ? <p className="text-[11px] text-muted">Lendo dispositivos...</p> : null}
      {devices && devices.length === 0 ? (
        <p className="text-[11px] text-muted">Nenhum dispositivo conectado.</p>
      ) : null}

      {devices && devices.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink/40">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center gap-2.5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[11.5px] font-medium text-paper">
                    {device.label || 'Dispositivo'}
                  </p>
                  {device.current ? <Chip tone="ok">Este dispositivo</Chip> : null}
                </div>
                <p className="truncate text-[10.5px] text-muted">
                  {formatLastSeen(device.last_seen_at)}
                  {device.ip ? ` · ${device.ip}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleRevoke(device)
                }}
                disabled={revoking === device.id}
                className="shrink-0 rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-muted transition-colors hover:border-red-500/30 hover:text-red-200 disabled:opacity-60"
              >
                {revoking === device.id ? 'Revogando...' : device.current ? 'Sair' : 'Revogar'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

type RecoveryCodeCardProps = {
  hasRecoveryCode: boolean | null
  statusError: string
  onGenerated: () => void
}

function RecoveryCodeCard({ hasRecoveryCode, statusError, onGenerated }: RecoveryCodeCardProps) {
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
      setNotice('Código gerado. Ele aparece uma única vez.')
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

      <Details label={hasRecoveryCode ? 'Gerar novo código' : 'Gerar código'}>
        <form className="space-y-2" onSubmit={handleSubmit}>
          <Field
            label="Senha atual"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="confirme com sua senha"
          />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" size="sm" fullWidth={false} loading={loading}>
            Gerar código
          </Button>
        </form>
      </Details>
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
        <p className="text-[11px] leading-4 text-muted">Código enviado para o e-mail da conta.</p>
      ) : null}
      {methods && !methods.email ? (
        <Details label="Como ativar">
          <p className="text-[11px] leading-4 text-muted">
            Configure o SMTP no <span className="font-mono text-paper/80">.env</span> e reinicie o
            servidor.
          </p>
          <p className="text-[11px] leading-4 text-muted">Sem SMTP, redefina pela CLI:</p>
          <code className="block break-all rounded-lg border border-line bg-ink px-2.5 py-1.5 font-mono text-[10px] text-paper/80">
            docker compose exec --user interpres interpres python -m app.cli reset-password --email
            seu@email.com
          </code>
        </Details>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-1 self-center sm:self-start">
                <img
                  src={setup.qr_data_url}
                  alt="QR code para configurar o aplicativo autenticador"
                  className="h-32 w-32 rounded-lg border border-line bg-white p-1.5"
                />
                <span className="text-[10px] text-muted">Escaneie no app</span>
              </div>
              <div className="min-w-0 flex-1">
                <Details label="Não consegui escanear">
                  <SecretCopy secret={setup.secret} />
                </Details>
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
                Confirmar
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-ink px-3 py-2">
            <span className="text-[11px] text-muted">Códigos de backup restantes</span>
            <span className="font-mono text-[11.5px] font-medium text-paper">
              {status.backup_codes_remaining}
            </span>
          </div>

          <Disclosure
            title="Desativar 2FA"
            open={disabling}
            onToggle={() => {
              setDisabling((current) => !current)
              setDisableError('')
              setCurrentPassword('')
              setDisableCode('')
            }}
          >
            <form className="space-y-2" onSubmit={handleDisable}>
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
              <Button type="submit" size="sm" fullWidth={false} loading={disableLoading}>
                Desativar 2FA
              </Button>
            </form>
          </Disclosure>
        </div>
      ) : null}
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
      <OllamaSection onProvidersChanged={onProvidersChanged} />

      <p className="text-[11px] leading-4 text-muted">
        Chaves ficam no backend e nunca são exibidas depois de salvas.
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

      {providers
        ?.filter((provider) => provider.id !== 'ollama')
        .map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            onChanged={(configured) => handleProviderChange(provider.id, configured)}
          />
        ))}
    </div>
  )
}

function OllamaSection({ onProvidersChanged }: ProvidersSectionProps) {
  const [ollama, setOllama] = useState<OllamaModelsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError('')
    try {
      setOllama(await api.ollamaModels())
      return true
    } catch (err) {
      setOllama(null)
      setError(err instanceof Error ? err.message : 'Não foi possível detectar o Ollama.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleRefresh() {
    const ok = await refresh()
    if (ok) onProvidersChanged?.()
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')
    setNotice('')

    if (!url.trim()) {
      setSaveError('Informe a URL do Ollama.')
      return
    }

    setSaving(true)
    try {
      await api.saveProvider('ollama', url.trim())
      setUrl('')
      setNotice('Endereço salvo.')
      await refresh()
      onProvidersChanged?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar o endereço.')
    } finally {
      setSaving(false)
    }
  }

  const detected = Boolean(ollama?.reachable && ollama.models.length > 0)

  return (
    <Card
      title="Ollama"
      action={
        <div className="flex items-center gap-1.5">
          {ollama ? (
            <Chip tone={detected ? 'ok' : ollama.reachable ? 'warn' : 'off'}>
              {detected ? 'Detectado' : ollama.reachable ? 'Sem modelos' : 'Não detectado'}
            </Chip>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleRefresh()
            }}
            disabled={loading}
            aria-label="Atualizar Ollama"
            title="Atualizar"
            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-60"
          >
            <Refresh className="h-3 w-3" />
            Atualizar
          </button>
        </div>
      }
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!ollama && !error && loading ? <p className="text-[11px] text-muted">Detectando...</p> : null}
      {!ollama && error ? (
        <Button
          type="button"
          size="sm"
          fullWidth={false}
          variant="secondary"
          loading={loading}
          onClick={() => {
            void handleRefresh()
          }}
        >
          <Refresh className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      ) : null}

      {detected && ollama ? (
        <>
          <p className="text-[11px] leading-4 text-muted">
            {ollama.models.length} modelo(s) instalado(s) em {ollama.base_url}
          </p>
          <div className="flex flex-wrap gap-1">
            {ollama.models.map((model) => (
              <span
                key={model}
                className="rounded-md border border-line bg-ink px-1.5 py-0.5 font-mono text-[10px] text-paper/80"
              >
                {model}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {ollama?.reachable && ollama.models.length === 0 ? (
        <>
          <p className="text-[11px] leading-4 text-muted">
            Ollama respondeu, mas nenhum modelo instalado.
          </p>
          <code className="block rounded-lg border border-line bg-ink px-2.5 py-1.5 font-mono text-[10px] text-paper/80">
            ollama pull llama3.2
          </code>
        </>
      ) : null}

      {ollama && !ollama.reachable ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-4 text-muted">
            Ollama não detectado{ollama.error ? `: ${ollama.error}` : ''}.
          </p>
          <Button
            type="button"
            size="sm"
            fullWidth={false}
            variant="secondary"
            loading={loading}
            onClick={() => {
              void handleRefresh()
            }}
          >
            <Refresh className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <Details label="Endereço personalizado">
        <p className="text-[11px] leading-4 text-muted">
          No Docker, o padrão costuma ser{' '}
          <span className="font-mono text-paper/80">http://host.docker.internal:11434</span>.
        </p>
        <form className="space-y-2" onSubmit={handleSave}>
          <Field
            label="URL do Ollama"
            value={url}
            onChange={setUrl}
            autoComplete="off"
            placeholder={ollama?.base_url || 'http://host.docker.internal:11434'}
            required={false}
          />
          {saveError ? <ErrorBanner message={saveError} /> : null}
          {notice ? <Notice message={notice} /> : null}
          <Button type="submit" size="sm" fullWidth={false} loading={saving}>
            Salvar
          </Button>
        </form>
      </Details>
    </Card>
  )
}

type ProviderRowProps = {
  provider: ProviderInfo
  onChanged: (configured: boolean) => void
}

function ProviderRow({ provider, onChanged }: ProviderRowProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
      onChanged(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.')
    } finally {
      setRemoving(false)
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
          label="Chave de API"
          type="password"
          value={value}
          onChange={setValue}
          autoComplete="off"
          placeholder={provider.placeholder}
          required={false}
        />
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? <Notice message={notice} /> : null}
        <Button type="submit" size="sm" fullWidth={false} loading={saving}>
          Salvar
        </Button>
      </form>
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
        O áudio chega no bloco de mídia. Nada é gravado por esta tela.
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
    <Card title="Memória do projeto">
      <p className="text-[11px] leading-4 text-muted">
        Contexto por workspace e projeto chega no próximo bloco. Nada é armazenado por esta tela.
      </p>
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

const TUNNEL_PROVIDERS: Array<{ id: TunnelProvider; label: string }> = [
  { id: 'cloudflare_quick', label: 'Cloudflare rápido (sem conta)' },
  { id: 'cloudflare_token', label: 'Cloudflare com token' },
  { id: 'ngrok', label: 'ngrok' },
]

function TunnelSection() {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [provider, setProvider] = useState<TunnelProvider>('cloudflare_quick')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.tunnelStatus())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o túnel.')
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .tunnelStatus()
      .then((data) => {
        if (alive) setStatus(data)
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Não foi possível ler o túnel.')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!status?.running) return
    const timer = window.setInterval(() => {
      api
        .tunnelStatus()
        .then((data) => {
          setStatus(data)
          setError('')
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Não foi possível atualizar o túnel.')
        })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [status?.running])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleStart() {
    setError('')

    if (provider !== 'cloudflare_quick' && !token.trim()) {
      setError('Informe o token do provedor.')
      return
    }

    setBusy('start')
    try {
      await api.tunnelStart(provider, token.trim() || undefined)
      setToken('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar o túnel.')
    } finally {
      setBusy(null)
    }
  }

  async function handleStop() {
    setError('')
    setBusy('stop')
    try {
      await api.tunnelStop()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível encerrar o túnel.')
    } finally {
      setBusy(null)
    }
  }

  async function handleCopy() {
    if (!status?.url) return
    setCopied(await copyToClipboard(status.url))
  }

  const activeLabel = status?.provider
    ? status.providers?.[status.provider] ?? status.provider
    : ''

  return (
    <Card title="Túnel" description="Acesso público temporário a esta instalação.">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status?.running ? 'bg-emerald-400' : 'bg-white/20'
            }`}
          />
          <span className="text-[11.5px] font-medium text-paper">
            {loading && !status ? 'Lendo...' : status?.running ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        {status?.running ? <Chip tone="ok">{activeLabel}</Chip> : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {!error && status?.error ? <ErrorBanner message={status.error} /> : null}

      {status?.running ? (
        <div className="space-y-2">
          {status.url ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink px-2.5 py-1.5">
              <a
                href={status.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-paper hover:text-accent"
              >
                {status.url}
              </a>
              <button
                type="button"
                onClick={() => {
                  void handleCopy()
                }}
                aria-label={copied ? 'Link copiado' : 'Copiar link'}
                title={copied ? 'Link copiado' : 'Copiar link'}
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] font-medium transition-colors ${
                  copied
                    ? 'border-emerald-500/30 text-emerald-300'
                    : 'border-line text-muted hover:text-paper'
                }`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={status.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[10.5px] font-medium text-muted transition-colors hover:text-paper"
              >
                <LinkIcon className="h-3 w-3" />
                Abrir
              </a>
            </div>
          ) : (
            <p className="text-[11px] text-muted">Aguardando endereço público...</p>
          )}

          {status.started_at ? (
            <p className="text-[10.5px] text-muted">Desde {formatDateTime(status.started_at)}</p>
          ) : null}

          <Button
            type="button"
            size="sm"
            fullWidth={false}
            variant="secondary"
            loading={busy === 'stop'}
            onClick={() => {
              void handleStop()
            }}
          >
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-1.5 sm:grid-cols-3">
            {TUNNEL_PROVIDERS.map((option) => {
              const selected = provider === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setProvider(option.id)
                    setError('')
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium leading-4 transition-colors ${
                    selected
                      ? 'border-accent/50 bg-accent/[0.08] text-paper'
                      : 'border-line bg-ink text-muted hover:text-paper'
                  }`}
                >
                  {status?.providers?.[option.id] || option.label}
                </button>
              )
            })}
          </div>

          {provider !== 'cloudflare_quick' ? (
            <Field
              label="Token"
              type="password"
              value={token}
              onChange={setToken}
              autoComplete="off"
              placeholder={provider === 'ngrok' ? 'Token do ngrok' : 'Token do Cloudflare'}
              required={false}
            />
          ) : null}

          <Button
            type="button"
            size="sm"
            fullWidth={false}
            loading={busy === 'start'}
            onClick={() => {
              void handleStart()
            }}
          >
            Conectar
          </Button>
        </div>
      )}

      <Details label="Log">
        {status?.log?.length ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-ink p-2 font-mono text-[10px] leading-4 text-muted">
            {status.log.join('\n')}
          </pre>
        ) : (
          <p className="text-[11px] text-muted">Sem registros.</p>
        )}
      </Details>
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
    <Card title="Notificações">
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
        Preferências locais. A entrega chega no bloco de jobs.
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

function formatLastSeen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min atrás`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h atrás`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d atrás`

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
