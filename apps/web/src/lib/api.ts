export type User = {
  id: string
  email: string
  created_at: string
}

export type AuthResponse = {
  user: User
  csrf_token: string
}

export type SetupResponse = AuthResponse & {
  recovery_code: string
}

export type MeResponse = AuthResponse & {
  has_recovery_code: boolean
}

export type RecoverResponse = AuthResponse & {
  recovery_code: string
}

export type SessionInfo = {
  user: User
  csrf_token: string
  expires_at: string
  expires_in_seconds: number
  session_ttl: number
}

export type RecoveryCodeResponse = {
  recovery_code: string
}

export type ChangeEmailResponse = {
  user: User
}

export type OkResponse = {
  ok: boolean
}

export type SetupStatus = {
  needs_setup: boolean
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let csrfToken = ''

export function setCsrfToken(token: string): void {
  csrfToken = token
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (csrfToken && method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  const data = (await response.json().catch(() => null)) as { detail?: string } | null
  if (!response.ok) {
    throw new ApiError(response.status, data?.detail ?? `Erro ${response.status}`)
  }
  return data as T
}

export const api = {
  setupStatus(): Promise<SetupStatus> {
    return request<SetupStatus>('/api/setup/status')
  },

  setup(email: string, password: string): Promise<SetupResponse> {
    return request<SetupResponse>('/api/setup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  me(): Promise<MeResponse> {
    return request<MeResponse>('/api/auth/me')
  },

  logout(): Promise<OkResponse> {
    return request<OkResponse>('/api/auth/logout', { method: 'POST' })
  },

  recover(email: string, recoveryCode: string, newPassword: string): Promise<RecoverResponse> {
    return request<RecoverResponse>('/api/auth/recover', {
      method: 'POST',
      body: JSON.stringify({
        email,
        recovery_code: recoveryCode,
        new_password: newPassword,
      }),
    })
  },

  changePassword(currentPassword: string, newPassword: string): Promise<OkResponse> {
    return request<OkResponse>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  },

  changeEmail(currentPassword: string, newEmail: string): Promise<ChangeEmailResponse> {
    return request<ChangeEmailResponse>('/api/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_email: newEmail,
      }),
    })
  },

  recoveryCode(currentPassword: string): Promise<RecoveryCodeResponse> {
    return request<RecoveryCodeResponse>('/api/auth/recovery-code', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword }),
    })
  },

  logoutAll(): Promise<OkResponse> {
    return request<OkResponse>('/api/auth/logout-all', { method: 'POST' })
  },

  session(): Promise<SessionInfo> {
    return request<SessionInfo>('/api/auth/session')
  },
}
