import { useEffect, useState } from 'react'
import { AppShell } from './pages/AppShell'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { api, ApiError, setCsrfToken, type AuthResponse, type User } from './lib/api'

type View = 'loading' | 'setup' | 'login' | 'app'

export function App() {
  const [view, setView] = useState<View>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    let alive = true

    async function boot() {
      try {
        const status = await api.setupStatus()
        if (!alive) return
        if (status.needs_setup) {
          setView('setup')
          return
        }

        const response = await api.me()
        if (!alive) return
        setCsrfToken(response.csrf_token)
        setUser(response.user)
        setView('app')
      } catch (error) {
        if (!alive) return
        if (error instanceof ApiError && error.status === 401) {
          setView('login')
          return
        }
        setBootError(error instanceof Error ? error.message : 'Não foi possível falar com a API.')
        setView('login')
      }
    }

    void boot()
    return () => {
      alive = false
    }
  }, [])

  function handleAuth(response: AuthResponse) {
    setCsrfToken(response.csrf_token)
    setUser(response.user)
    setView('app')
  }

  function handleUserChange(updated: User) {
    setUser(updated)
  }

  async function handleLogout() {
    await api.logout().catch(() => null)
    setCsrfToken('')
    setUser(null)
    setView('login')
  }

  function handleSessionEnded() {
    setCsrfToken('')
    setUser(null)
    setView('login')
  }

  async function handleGoSetup() {
    setBootError('')
    try {
      const status = await api.setupStatus()
      if (status.needs_setup) {
        setView('setup')
        return
      }
      setBootError('Esta instalação já tem um dono. Entre com a conta existente.')
      setView('login')
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Não foi possível falar com a API.')
      setView('login')
    }
  }

  if (view === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Iniciando o Interpres...
        </div>
      </div>
    )
  }

  if (view === 'setup') {
    return <SetupPage onSuccess={handleAuth} />
  }

  if (view === 'app' && user) {
    return (
      <AppShell
        user={user}
        onUserChange={handleUserChange}
        onLogout={handleLogout}
        onSessionEnded={handleSessionEnded}
      />
    )
  }

  return <LoginPage onSuccess={handleAuth} onSetup={handleGoSetup} initialError={bootError} />
}
