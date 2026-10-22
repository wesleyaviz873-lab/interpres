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
  email_recovery: boolean
}

export type LoginResult =
  | AuthResponse
  | { requires_2fa: true; challenge_token: string }

export type MeResponse = AuthResponse & {
  has_recovery_code: boolean
  two_factor_enabled: boolean
}

export type RecoverResponse = AuthResponse & {
  recovery_code: string
}

export type ResetPasswordResponse = RecoverResponse

export type RecoveryMethods = {
  email: boolean
  recovery_code: true
  admin_cli: true
}

export type TwoFactorStatus = {
  enabled: boolean
  backup_codes_remaining: number
}

export type TwoFactorSetupResponse = {
  secret: string
  otpauth_uri: string
  qr_data_url: string
}

export type TwoFactorEnableResponse = {
  backup_codes: string[]
}

export type SessionInfo = {
  user: User
  csrf_token: string
  expires_at: string
  expires_in_seconds: number
  session_ttl: number
}

export type DeviceInfo = {
  id: string
  label: string
  ip: string
  created_at: string
  last_seen_at: string
  current: boolean
}

export type DevicesResponse = {
  devices: DeviceInfo[]
}

export type TunnelProvider = 'cloudflare_quick' | 'cloudflare_token' | 'ngrok'

export type TunnelStatus = {
  running: boolean
  provider: string | null
  url: string | null
  started_at: string | null
  error: string | null
  log: string[]
  providers: Record<string, string>
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

export type ProviderInfo = {
  id: string
  label: string
  placeholder: string
  configured: boolean
  hint: string
}

export type ProvidersResponse = {
  providers: ProviderInfo[]
}

export type OllamaModelsResponse = {
  reachable: boolean
  base_url: string
  models: string[]
  error?: string
}

export type AgentInfo = {
  id: string
  name: string
  command: string
  color: string
  installed: boolean
}

export type AgentsResponse = {
  agents: AgentInfo[]
}

export type HealthResponse = {
  status: string
  service: string
  version: string
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

  login(email: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  login2fa(challengeToken: string, code: string): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    })
  },

  me(): Promise<MeResponse> {
    return request<MeResponse>('/api/auth/me')
  },

  recoveryMethods(): Promise<RecoveryMethods> {
    return request<RecoveryMethods>('/api/auth/recovery-methods')
  },

  forgotPassword(email: string): Promise<OkResponse> {
    return request<OkResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<ResetPasswordResponse> {
    return request<ResetPasswordResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password: newPassword }),
    })
  },

  twoFactorStatus(): Promise<TwoFactorStatus> {
    return request<TwoFactorStatus>('/api/auth/2fa/status')
  },

  twoFactorSetup(): Promise<TwoFactorSetupResponse> {
    return request<TwoFactorSetupResponse>('/api/auth/2fa/setup', {
      method: 'POST',
    })
  },

  twoFactorEnable(code: string): Promise<TwoFactorEnableResponse> {
    return request<TwoFactorEnableResponse>('/api/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  twoFactorDisable(currentPassword: string, code: string): Promise<OkResponse> {
    return request<OkResponse>('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, code }),
    })
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

  devices(): Promise<DevicesResponse> {
    return request<DevicesResponse>('/api/auth/devices')
  },

  revokeDevice(id: string): Promise<OkResponse> {
    return request<OkResponse>(`/api/auth/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  tunnelStatus(): Promise<TunnelStatus> {
    return request<TunnelStatus>('/api/tunnel/status')
  },

  tunnelStart(provider: TunnelProvider, token?: string): Promise<TunnelStatus> {
    return request<TunnelStatus>('/api/tunnel/start', {
      method: 'POST',
      body: JSON.stringify(token ? { provider, token } : { provider }),
    })
  },

  tunnelStop(): Promise<OkResponse> {
    return request<OkResponse>('/api/tunnel/stop', { method: 'POST' })
  },

  providers(): Promise<ProvidersResponse> {
    return request<ProvidersResponse>('/api/providers')
  },

  saveProvider(id: string, value: string): Promise<OkResponse> {
    return request<OkResponse>(`/api/providers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  },

  deleteProvider(id: string): Promise<OkResponse> {
    return request<OkResponse>(`/api/providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  ollamaModels(): Promise<OllamaModelsResponse> {
    return request<OllamaModelsResponse>('/api/providers/ollama/models')
  },

  agents(): Promise<AgentsResponse> {
    return request<AgentsResponse>('/api/agents')
  },

  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/api/health')
  },
}
