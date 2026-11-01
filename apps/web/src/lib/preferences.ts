export type AccentKey = 'orange' | 'purple' | 'cyan' | 'green' | 'red'

export type AppearancePreferences = {
  fontSize: number
  accent: AccentKey
  animations: boolean
  timestamps: boolean
}

export type VoicePreferences = {
  stt: 'openai' | 'local'
  tts: 'none' | 'browser'
  lang: string
}

export type NotificationPreferences = {
  jobs: boolean
  completed: boolean
  errors: boolean
}

export const ACCENTS: Array<{ id: AccentKey; label: string; color: string }> = [
  { id: 'orange', label: 'Laranja', color: '#f97316' },
  { id: 'purple', label: 'Roxo', color: '#a855f7' },
  { id: 'cyan', label: 'Ciano', color: '#22d3ee' },
  { id: 'green', label: 'Verde', color: '#22c55e' },
  { id: 'red', label: 'Vermelho', color: '#ef4444' },
]

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  fontSize: 13.5,
  accent: 'orange',
  animations: true,
  timestamps: false,
}

export const DEFAULT_VOICE: VoicePreferences = {
  stt: 'local',
  tts: 'browser',
  lang: 'pt-BR',
}

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  jobs: true,
  completed: true,
  errors: true,
}

const APPEARANCE_KEY = 'interpres.appearance'
const VOICE_KEY = 'interpres.voice'
const NOTIFICATIONS_KEY = 'interpres.notifications'

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function loadAppearance(): AppearancePreferences {
  const data = readJson(APPEARANCE_KEY)
  if (!isRecord(data)) return DEFAULT_APPEARANCE

  const fontSize =
    typeof data.fontSize === 'number' && Number.isFinite(data.fontSize)
      ? Math.min(17, Math.max(12, data.fontSize))
      : DEFAULT_APPEARANCE.fontSize
  const accent = ACCENTS.some((item) => item.id === data.accent)
    ? (data.accent as AccentKey)
    : DEFAULT_APPEARANCE.accent

  return {
    fontSize,
    accent,
    animations:
      typeof data.animations === 'boolean' ? data.animations : DEFAULT_APPEARANCE.animations,
    timestamps:
      typeof data.timestamps === 'boolean' ? data.timestamps : DEFAULT_APPEARANCE.timestamps,
  }
}

export function saveAppearance(preferences: AppearancePreferences): void {
  writeJson(APPEARANCE_KEY, preferences)
}

export function applyAppearance(preferences: AppearancePreferences): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const accent = ACCENTS.find((item) => item.id === preferences.accent)?.color ?? '#f97316'
  root.style.fontSize = `${preferences.fontSize}px`
  root.style.setProperty('--interpres-accent', accent)
  root.dataset.animations = preferences.animations ? 'on' : 'off'
}

export function loadVoice(): VoicePreferences {
  const data = readJson(VOICE_KEY)
  if (!isRecord(data)) return DEFAULT_VOICE

  return {
    stt: data.stt === 'openai' ? 'openai' : 'local',
    tts: data.tts === 'none' ? 'none' : 'browser',
    lang:
      typeof data.lang === 'string' && data.lang.length >= 2
        ? data.lang
        : DEFAULT_VOICE.lang,
  }
}

export function saveVoice(preferences: VoicePreferences): void {
  writeJson(VOICE_KEY, preferences)
}

export function loadNotifications(): NotificationPreferences {
  const data = readJson(NOTIFICATIONS_KEY)
  if (!isRecord(data)) return DEFAULT_NOTIFICATIONS

  return {
    jobs: typeof data.jobs === 'boolean' ? data.jobs : DEFAULT_NOTIFICATIONS.jobs,
    completed:
      typeof data.completed === 'boolean' ? data.completed : DEFAULT_NOTIFICATIONS.completed,
    errors: typeof data.errors === 'boolean' ? data.errors : DEFAULT_NOTIFICATIONS.errors,
  }
}

export function saveNotifications(preferences: NotificationPreferences): void {
  writeJson(NOTIFICATIONS_KEY, preferences)
}
