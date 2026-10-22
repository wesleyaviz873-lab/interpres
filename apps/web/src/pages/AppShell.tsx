import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { SettingsModal, type SettingsSection } from '../components/SettingsModal'
import { Toast, useToast } from '../components/Toast'
import {
  Chat,
  Folder,
  Key,
  Logout,
  Menu,
  Send,
  Settings,
  User as UserIcon,
  X,
} from '../components/icons'
import { api, type User } from '../lib/api'
import { applyAppearance, loadAppearance } from '../lib/preferences'

type AppShellProps = {
  user: User
  onUserChange: (user: User) => void
  onLogout: () => void
  onSessionEnded: () => void
}

type SidebarContentProps = {
  user: User
  onNewConversation: () => void
  onOpenSettings: () => void
  onLogout: () => void
  onClose?: () => void
}

function SidebarContent({
  user,
  onNewConversation,
  onOpenSettings,
  onLogout,
  onClose,
}: SidebarContentProps) {
  const navBase =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors'
  const navActive = `${navBase} bg-white/[0.06] text-paper`
  const navIdle = `${navBase} text-muted hover:bg-white/[0.04] hover:text-paper`
  const navDisabled = `${navBase} cursor-not-allowed text-muted/50`

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-xs font-semibold text-accent">
          I
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-4 tracking-wide text-paper">Interpres</p>
          <p className="text-[10px] leading-3 text-muted">workspace de IA</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="px-3 py-3">
        <Button type="button" size="sm" onClick={onNewConversation}>
          <Chat className="h-3.5 w-3.5" />
          Nova conversa
        </Button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2" aria-label="Navegação principal">
        <button type="button" aria-current="page" className={navActive}>
          <Chat className="h-4 w-4" />
          <span className="flex-1 text-left">Conversas</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] leading-3 text-muted">
            0
          </span>
        </button>
        <button type="button" disabled className={navDisabled} title="Em breve">
          <Folder className="h-4 w-4" />
          <span className="flex-1 text-left">Projetos</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase leading-3 tracking-wide">
            Em breve
          </span>
        </button>
        <button type="button" onClick={onOpenSettings} className={navIdle}>
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Configurações</span>
        </button>
      </nav>

      <div className="mt-auto border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-ink/60 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted">
            <UserIcon className="h-3.5 w-3.5" />
          </div>
          <p className="min-w-0 flex-1 truncate text-[11px] text-paper/90" title={user.email}>
            {user.email}
          </p>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            title="Sair"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            <Logout className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}

export function AppShell({ user, onUserChange, onLogout, onSessionEnded }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('conta')
  const [hasProvider, setHasProvider] = useState(false)
  const [draft, setDraft] = useState('')
  const { toast, showToast } = useToast()

  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const refreshProviders = useCallback(async () => {
    try {
      const data = await api.providers()
      setHasProvider(data.providers.some((provider) => provider.configured))
    } catch {
      setHasProvider(false)
    }
  }, [])

  useEffect(() => {
    applyAppearance(loadAppearance())
    void refreshProviders()
  }, [refreshProviders])

  useEffect(() => {
    if (!sidebarOpen) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [sidebarOpen])

  function handleNewConversation() {
    setSidebarOpen(false)
    setDraft('')
    showToast('As conversas chegam no próximo bloco do Interpres.')
  }

  function openSettings(section: SettingsSection = 'conta') {
    setSidebarOpen(false)
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!draft.trim()) return

    setDraft('')
    if (!hasProvider) {
      openSettings('chaves')
      showToast('Configure uma chave de API para usar o chat.', 'error')
      return
    }
    showToast('O motor de chat será ativado no próximo bloco.')
  }

  function handleLogout() {
    setSidebarOpen(false)
    onLogout()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-ink">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-panel/60 lg:flex">
        <SidebarContent
          user={user}
          onNewConversation={handleNewConversation}
          onOpenSettings={() => openSettings('conta')}
          onLogout={handleLogout}
        />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
          />
          <aside
            id="app-sidebar"
            className="relative flex h-full w-72 flex-col border-r border-line bg-panel shadow-2xl shadow-black/60"
          >
            <SidebarContent
              user={user}
              onNewConversation={handleNewConversation}
              onOpenSettings={() => openSettings('conta')}
              onLogout={handleLogout}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-paper lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-paper">Nova conversa</span>
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] leading-3 text-muted">
              0
            </span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="hidden max-w-[180px] truncate text-[11px] text-muted sm:block">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => openSettings('conta')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                  <Chat className="h-4 w-4" />
                </div>
                <div className="min-w-0 max-w-[min(560px,85%)] rounded-2xl rounded-tl-md border border-line bg-panel px-3.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                    Interpres
                  </p>
                  <p className="mt-1 text-[12.5px] leading-5 text-paper/90">
                    {hasProvider
                      ? 'Tudo pronto. O motor de chat e os jobs entram no próximo bloco.'
                      : 'Olá! Configure uma chave de API em Configurações para começar.'}
                  </p>
                </div>
              </div>

              {!hasProvider ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-panel px-3.5 py-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Key className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-4 text-paper">
                      Nenhum provedor configurado
                    </p>
                    <p className="text-[11px] leading-4 text-muted">
                      Conecte OpenAI, Anthropic, Google, OpenRouter, OpenCode ou Ollama.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    fullWidth={false}
                    variant="secondary"
                    onClick={() => openSettings('chaves')}
                  >
                    Configurar chave de API
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-line px-4 py-3">
            <form className="mx-auto w-full max-w-3xl" onSubmit={handleSend}>
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-panel px-2.5 py-2 transition-colors focus-within:border-white/20">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder="Escreva uma mensagem..."
                  aria-label="Mensagem"
                  className="max-h-32 min-h-[26px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[13px] leading-5 text-paper placeholder:text-muted/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Enviar mensagem"
                  title="Enviar mensagem"
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-black transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10.5px] leading-4 text-muted">
                {hasProvider
                  ? 'O motor de chat será ativado no próximo bloco.'
                  : 'Configure uma chave de API para habilitar o chat.'}
              </p>
            </form>
          </div>
        </main>
      </div>

      {settingsOpen ? (
        <SettingsModal
          user={user}
          initialSection={settingsSection}
          onClose={closeSettings}
          onUserChange={onUserChange}
          onSessionEnded={onSessionEnded}
          onProvidersChanged={() => {
            void refreshProviders()
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  )
}
