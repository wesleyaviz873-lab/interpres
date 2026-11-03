import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Button } from '../components/Button'
import { MarkdownMessage } from '../components/MarkdownMessage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageLightbox } from '../components/ImageLightbox'
import { ProcessBlock } from '../components/ProcessBlock'
import { QuestionCard } from '../components/QuestionCard'
import { SettingsModal, type SettingsSection } from '../components/SettingsModal'
import { Toast, useToast } from '../components/Toast'
import {
  Camera,
  Chat,
  Check,
  Copy,
  ChevronDown,
  Folder,
  Key,
  Logout,
  Menu,
  Mic,
  Paperclip,
  Send,
  Settings,
  Speaker,
  Terminal,
  Trash,
  User as UserIcon,
  X,
} from '../components/icons'
import {
  api,
  ApiError,
  type ConversationSummary,
  type MessageQuestion,
  type OpenCodeModel,
  type ProjectInfo,
  type ProviderInfo,
  type User,
} from '../lib/api'
import { buildModelOptions, groupModelOptions } from '../lib/models'
import { humanizeProgress } from '../lib/progress'
import { applyAppearance, loadAppearance, loadVoice } from '../lib/preferences'

type SpeechRecognitionResultLike = {
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

type Attachment = {
  file: File
  url: string | null
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  process?: string | null
  question?: MessageQuestion | null
  image?: string | null
}

const MODEL_KEY = 'interpres_model'
const PROJECT_KEY = 'interpres_project'
const CONVERSATION_KEY = 'interpres_conversation'

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

type AppShellProps = {
  user: User
  onUserChange: (user: User) => void
  onLogout: () => void
  onSessionEnded: () => void
}

type SidebarContentProps = {
  user: User
  conversations: ConversationSummary[]
  activeId: string | null
  projectCount: number
  onNewConversation: () => void
  onOpenConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onOpenProjects: () => void
  onOpenSettings: () => void
  onLogout: () => void
  onClose?: () => void
}

function SidebarContent({
  user,
  conversations,
  activeId,
  projectCount,
  onNewConversation,
  onOpenConversation,
  onDeleteConversation,
  onOpenProjects,
  onOpenSettings,
  onLogout,
  onClose,
}: SidebarContentProps) {
  const navBase =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors'
  const navIdle = `${navBase} text-muted hover:bg-white/[0.04] hover:text-paper`

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <img
          src="/icon-192.png"
          alt=""
          className="h-8 w-8 rounded-lg border border-line object-cover"
        />
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-4 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Conversas
          </span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] leading-3 text-muted">
            {conversations.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <p className="px-2.5 py-2 text-[11px] leading-4 text-muted/70">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.map((conversation) => {
                const active = conversation.id === activeId
                return (
                  <li key={conversation.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onOpenConversation(conversation.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`${navBase} pr-8 ${
                        active
                          ? 'bg-white/[0.06] text-paper'
                          : 'text-muted hover:bg-white/[0.04] hover:text-paper'
                      }`}
                      title={conversation.title}
                    >
                      <Chat className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{conversation.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConversation(conversation.id)}
                      aria-label={`Apagar ${conversation.title}`}
                      title="Apagar conversa"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-paper group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-2 pt-2">
        <button type="button" onClick={onOpenProjects} className={navIdle}>
          <Folder className="h-4 w-4" />
          <span className="flex-1 text-left">Projetos</span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] leading-3 text-muted">
            {projectCount}
          </span>
        </button>
        <button type="button" onClick={onOpenSettings} className={navIdle}>
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Configurações</span>
        </button>
      </div>

      <div className="shrink-0 border-t border-line p-3">
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
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [opencodeModels, setOpencodeModels] = useState<OpenCodeModel[]>([])
  const [harness, setHarness] = useState<{ id: string; name: string } | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(
    () => localStorage.getItem(MODEL_KEY) ?? '',
  )
  const [modelOpen, setModelOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [pickingProject, setPickingProject] = useState(false)
  const [projectPathDraft, setProjectPathDraft] = useState('')
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => localStorage.getItem(PROJECT_KEY),
  )
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(
    () => localStorage.getItem('interpres_voice_replies') === '1',
  )
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [job, setJob] = useState<{ id: string; log: string[]; status: string } | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; preview: string } | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [ttsEnabled, setTtsEnabled] = useState(() => loadVoice().tts !== 'none')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const jobLogRef = useRef<HTMLPreElement>(null)
  const filesRef = useRef<Attachment[]>([])
  const { toast, showToast } = useToast()

  filesRef.current = files

  const modelOptions = useMemo(
    () => buildModelOptions(providers, ollamaModels, opencodeModels),
    [providers, ollamaModels, opencodeModels],
  )
  const modelGroups = useMemo(() => groupModelOptions(modelOptions), [modelOptions])
  const selectedModel = modelOptions.find((model) => model.id === selectedModelId) ?? null
  const activeConversation = conversations.find((item) => item.id === activeId) ?? null
  const activeProject = projects.find((item) => item.id === activeProjectId) ?? null
  const jobProgress = useMemo(() => (job ? humanizeProgress(job.log) : null), [job])

  const refreshProviders = useCallback(async () => {
    const [providersResult, ollamaResult, opencodeResult, harnessResult] =
      await Promise.allSettled([
        api.providers(),
        api.ollamaModels(),
        api.opencodeModels(),
        api.harnesses(),
      ])

    const providerList =
      providersResult.status === 'fulfilled' ? providersResult.value.providers : []
    const localModels =
      ollamaResult.status === 'fulfilled' ? ollamaResult.value.models : []
    const liveOpenCode =
      opencodeResult.status === 'fulfilled' ? opencodeResult.value.models : []

    setProviders(providerList)
    setOllamaModels(localModels)
    setOpencodeModels(liveOpenCode)

    if (harnessResult.status === 'fulfilled') {
      const chosen = harnessResult.value.harnesses.find(
        (item) => item.id === harnessResult.value.selected,
      )
      setHarness(chosen ? { id: chosen.id, name: chosen.name } : null)
    }

    const cloudConfigured = providerList.some(
      (provider) => provider.id !== 'ollama' && provider.configured,
    )
    const ollamaReady =
      ollamaResult.status === 'fulfilled' &&
      ollamaResult.value.reachable &&
      localModels.length > 0

    setHasProvider(cloudConfigured || ollamaReady)
  }, [])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setTtsEnabled(loadVoice().tts !== 'none')
    void refreshProviders()
  }, [refreshProviders])

  const refreshConversations = useCallback(async () => {
    try {
      const result = await api.conversations()
      setConversations(result.conversations)
      return result.conversations
    } catch {
      return []
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const result = await api.projects()
      setProjects(result.projects)
      return result.projects
    } catch {
      return []
    }
  }, [])

  const openConversation = useCallback(async (id: string) => {
    setSidebarOpen(false)
    try {
      const result = await api.conversation(id)
      setActiveId(result.conversation.id)
      localStorage.setItem(CONVERSATION_KEY, result.conversation.id)
      setMessages(
        result.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({
            id: message.id,
            role: message.role as 'user' | 'assistant',
            content: message.content,
            process: message.process,
            question: message.question,
            image: message.image,
          })),
      )
      if (result.conversation.project_id) {
        setActiveProjectId(result.conversation.project_id)
        localStorage.setItem(PROJECT_KEY, result.conversation.project_id)
      }
      if (result.conversation.provider && result.conversation.model) {
        const id = `${result.conversation.provider}:${result.conversation.model}`
        setSelectedModelId(id)
        localStorage.setItem(MODEL_KEY, id)
      }
      setDraft('')
      clearFiles()
      setAutoScroll(true)
    } catch {
      showToast('Não consegui abrir essa conversa.', 'error')
    }
  }, [showToast])

  useEffect(() => {
    applyAppearance(loadAppearance())
    void refreshProviders()
  }, [refreshProviders])

  useEffect(() => {
    let alive = true
    async function boot() {
      const [conversationList, projectList] = await Promise.all([
        refreshConversations(),
        refreshProjects(),
      ])
      if (!alive) return

      if (activeProjectId && !projectList.some((item) => item.id === activeProjectId)) {
        setActiveProjectId(null)
        localStorage.removeItem(PROJECT_KEY)
      }

      const saved = localStorage.getItem(CONVERSATION_KEY)
      if (saved && conversationList.some((item) => item.id === saved)) {
        await openConversation(saved)
      }

      const pending = localStorage.getItem('interpres_job')
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as { id?: string; conversationId?: string }
          if (parsed.id && parsed.conversationId) {
            setSending(true)
            void followJob(parsed.id, parsed.conversationId)
          } else {
            localStorage.removeItem('interpres_job')
          }
        } catch {
          localStorage.removeItem('interpres_job')
        }
      }
    }
    void boot()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (modelOptions.length === 0) return
    if (modelOptions.some((model) => model.id === selectedModelId)) return
    const next = modelOptions[0].id
    setSelectedModelId(next)
    localStorage.setItem(MODEL_KEY, next)
  }, [modelOptions, selectedModelId])

  useEffect(() => {
    if (!sidebarOpen) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [sidebarOpen])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recorderRef.current?.stop()
      window.speechSynthesis?.cancel()
      filesRef.current.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url)
      })
    }
  }, [])

  useEffect(() => {
    if (!autoScroll) return
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, job?.log.length, sending, autoScroll])

  useEffect(() => {
    if (!sending) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [sending])

  useEffect(() => {
    const el = jobLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [job?.log.length])

  useEffect(() => {
    const el = textareaRef.current
    if (el && !draft) {
      el.style.height = 'auto'
    }
  }, [draft])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const vv = viewport
    function applyHeight() {
      document.documentElement.style.setProperty('--app-height', `${vv.height}px`)
    }
    applyHeight()
    vv.addEventListener('resize', applyHeight)
    vv.addEventListener('scroll', applyHeight)
    return () => {
      vv.removeEventListener('resize', applyHeight)
      vv.removeEventListener('scroll', applyHeight)
      document.documentElement.style.removeProperty('--app-height')
    }
  }, [])

  function clearFiles() {
    setFiles((current) => {
      current.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url)
      })
      return []
    })
  }

  function handleNewConversation() {
    setSidebarOpen(false)
    setDraft('')
    clearFiles()
    setAutoScroll(true)

    setMessages([])
    setActiveId(null)
    localStorage.removeItem(CONVERSATION_KEY)
    setModelOpen(false)
    setProjectOpen(false)
  }

  function openSettings(section: SettingsSection = 'conta') {
    setSidebarOpen(false)
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length > 0) {
      const items: Attachment[] = picked.map((file) => ({
        file,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }))
      setFiles((current) => [...current, ...items].slice(0, 5))
    }
    event.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((current) => {
      const item = current[index]
      if (item?.url) URL.revokeObjectURL(item.url)
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  async function toggleListening() {
    const prefs = loadVoice()

    if (prefs.stt === 'openai') {
      if (listening) {
        recorderRef.current?.stop()
        return
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        showToast('Este navegador não grava áudio.', 'error')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop())
          setListening(false)
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          if (blob.size < 1200) {
            showToast('Áudio muito curto.', 'error')
            return
          }
          setTranscribing(true)
          api
            .transcribe(blob, prefs.lang)
            .then((result) => {
              const clean = result.text.trim()
              if (clean) {
                setDraft((current) => `${current}${current ? ' ' : ''}${clean}`)
              }
            })
            .catch((error) => {
              showToast(
                error instanceof Error ? error.message : 'Não consegui transcrever.',
                'error',
              )
            })
            .finally(() => setTranscribing(false))
        }
        recorder.start()
        recorderRef.current = recorder
        setListening(true)
      } catch {
        setListening(false)
        showToast('Não consegui acessar o microfone.', 'error')
      }
      return
    }

    const speechWindow = window as SpeechWindow
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      showToast('Este navegador não oferece ditado por voz.', 'error')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new Recognition()
    recognition.lang = prefs.lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      let text = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        text += event.results[index][0]?.transcript ?? ''
      }
      const clean = text.trim()
      if (clean) {
        setDraft((current) => `${current}${current ? ' ' : ''}${clean}`)
      }
    }
    recognition.onerror = () => {
      setListening(false)
      showToast('Não foi possível ouvir o microfone.', 'error')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      showToast('Não foi possível iniciar o microfone.', 'error')
    }
  }

  function cleanupSpeech(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' Código omitido. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, ' link ')
      .replace(/[*_#>|~]/g, ' ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function startSpeak(id: string, text: string) {
    if (!window.speechSynthesis) return
    const clean = cleanupSpeech(text)
    if (!clean) return
    window.speechSynthesis.cancel()
    const prefs = loadVoice()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = prefs.lang
    utterance.rate = 1
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((item) => item.lang === prefs.lang) ??
      voices.find((item) => item.lang.startsWith(prefs.lang.slice(0, 2)))
    if (voice) utterance.voice = voice
    utterance.onend = () => setSpeakingId((current) => (current === id ? null : current))
    utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current))
    setSpeakingId(id)
    window.speechSynthesis.speak(utterance)
  }

  function toggleSpeak(id: string, text: string) {
    if (speakingId === id) {
      window.speechSynthesis?.cancel()
      setSpeakingId(null)
      return
    }
    startSpeak(id, text)
  }

  function toggleVoiceReplies() {
    const next = !voiceReplies
    setVoiceReplies(next)
    localStorage.setItem('interpres_voice_replies', next ? '1' : '0')
    if (!next) {
      window.speechSynthesis?.cancel()
      setSpeakingId(null)
    }
    showToast(next ? 'Respostas em voz ativadas' : 'Respostas em voz desativadas')
  }

  function selectModel(id: string) {
    setSelectedModelId(id)
    localStorage.setItem(MODEL_KEY, id)
    setModelOpen(false)
  }

  async function selectProject(id: string | null) {
    setProjectOpen(false)
    setActiveProjectId(id)
    if (id) localStorage.setItem(PROJECT_KEY, id)
    else localStorage.removeItem(PROJECT_KEY)
    if (activeId) {
      try {
        await api.updateConversation(activeId, { project_id: id })
        await refreshConversations()
      } catch {
        showToast('Não consegui salvar o projeto da conversa.', 'error')
      }
    }
  }

  async function pickProject() {
    if (pickingProject) return
    setPickingProject(true)
    try {
      const result = await api.pickProject()
      if (result.project) {
        await refreshProjects()
        await selectProject(result.project.id)
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não consegui abrir o seletor de pastas.',
        'error',
      )
    } finally {
      setPickingProject(false)
    }
  }

  async function addProjectPath() {
    const path = projectPathDraft.trim()
    if (!path) return
    try {
      const project = await api.addProject(path)
      setProjectPathDraft('')
      await refreshProjects()
      await selectProject(project.id)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não consegui usar essa pasta.',
        'error',
      )
    }
  }

  async function handleDeleteConversation(id: string) {
    try {
      await api.deleteConversation(id)
      if (id === activeId) {
        setActiveId(null)
        setMessages([])
        localStorage.removeItem(CONVERSATION_KEY)
      }
      await refreshConversations()
    } catch {
      showToast('Não consegui apagar a conversa.', 'error')
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget || !activeId) return
    const messageId = deleteTarget.id
    setDeleteTarget(null)
    try {
      await api.deleteMessage(activeId, messageId)
      setMessages((current) => current.filter((message) => message.id !== messageId))
      await refreshConversations()
      showToast('Mensagem excluída')
    } catch {
      showToast('Não consegui excluir a mensagem.', 'error')
    }
  }
  async function captureScreen() {
    if (capturing) return
    setCapturing(true)
    try {
      const result = await api.captureScreenshot(activeId)
      await refreshConversations()
      setActiveId(result.conversation.id)
      localStorage.setItem(CONVERSATION_KEY, result.conversation.id)
      await openConversation(result.conversation.id)
      showToast('Print enviado para a conversa')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Não consegui capturar a tela.',
        'error',
      )
    } finally {
      setCapturing(false)
    }
  }
  async function followJob(jobId: string, conversationId: string) {
    const startedAt = Date.now()
    localStorage.setItem('interpres_job', JSON.stringify({ id: jobId, conversationId }))
    setJob({ id: jobId, log: [], status: 'running' })

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 700))
      let data
      try {
        data = await api.chatJob(jobId)
      } catch (error) {
        const lost = error instanceof ApiError && error.status === 404
        if (lost || Date.now() - startedAt > 50 * 60 * 1000) {
          localStorage.removeItem('interpres_job')
          setJob(null)
          setSending(false)
          showToast('A execução anterior foi perdida.', 'error')
          await openConversation(conversationId)
          return
        }
        continue
      }

      setJob({ id: jobId, log: data.log, status: data.status })
      if (data.status === 'running') {
        if (Date.now() - startedAt > 50 * 60 * 1000) {
          localStorage.removeItem('interpres_job')
          setJob(null)
          setSending(false)
          showToast('A execução demorou demais para responder.', 'error')
          return
        }
        continue
      }

      localStorage.removeItem('interpres_job')
      setJob(null)
      setSending(false)

      if (data.status === 'done' && data.result) {
        const result = data.result
        await openConversation(result.conversation.id)
        if (voiceReplies) {
          const spoken = `${result.reply}${
            result.question ? `. ${result.question.question}` : ''
          }`.trim()
          if (spoken) {
            window.setTimeout(
              () => startSpeak(result.assistant_message_id, spoken),
              250,
            )
          }
        }
      } else {
        const detail = data.error ?? 'erro desconhecido'
        showToast(detail, 'error')
        await openConversation(conversationId)
      }
      return
    }
  }
  async function handleSend(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault()
    const usingOverride = typeof override === 'string'
    const texto = (override ?? draft).trim()
    if ((!texto && files.length === 0) || sending) return

    if (!hasProvider && !harness) {
      openSettings('chaves')
      showToast('Conecte um provedor ou use o Ollama local.', 'error')
      return
    }
    if (!selectedModel && !harness) {
      showToast('Escolha um modelo para continuar.', 'error')
      return
    }

    const anexos = usingOverride ? [] : files.map((item) => item.file.name)
    const conteudo = [texto, anexos.length ? `[Anexos: ${anexos.join(', ')}]` : '']
      .filter(Boolean)
      .join('\n')
    const mensagemUsuario: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: conteudo,
    }
    const historico = [...messages, mensagemUsuario]
    const anexosParaEnviar = usingOverride ? [] : files.map((item) => item.file)

    setMessages(historico)
    if (!usingOverride) {
      setDraft('')
      clearFiles()
      setAutoScroll(true)
    }

    setSending(true)

    const [provider, ...resto] = (selectedModel?.id ?? 'opencode:auto').split(':')
    const model = resto.join(':') || 'auto'

    try {
      const uploaded = await Promise.all(
        anexosParaEnviar.map((file) => api.upload(file, activeProjectId)),
      )
      const started = await api.startChat(
        provider,
        model,
        historico.map(({ role, content }) => ({ role, content })),
        {
          conversationId: activeId,
          projectId: activeProjectId,
          attachments: uploaded.map(({ name, path, mime }) => ({ name, path, mime })),
        },
      )
      setActiveId(started.conversation.id)
      localStorage.setItem(CONVERSATION_KEY, started.conversation.id)
      await refreshConversations()
      void followJob(started.job_id, started.conversation.id)
    } catch (error) {
      setMessages([
        ...historico,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `Não consegui responder: ${
            error instanceof Error ? error.message : 'erro desconhecido'
          }`,
        },
      ])
      setSending(false)
    }
  }
  function handleLogout() {
    setSidebarOpen(false)
    onLogout()
  }

  return (
    <div className="flex overflow-hidden bg-ink" style={{ height: 'var(--app-height, 100dvh)' }}>
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-line bg-panel/60 lg:flex">
        <SidebarContent
          user={user}
          conversations={conversations}
          activeId={activeId}
          projectCount={projects.length}
          onNewConversation={handleNewConversation}
          onOpenConversation={(id) => void openConversation(id)}
          onDeleteConversation={(id) => void handleDeleteConversation(id)}
          onOpenProjects={() => {
            setSidebarOpen(false)
            setProjectOpen(true)
            setModelOpen(false)
          }}
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
              conversations={conversations}
              activeId={activeId}
              projectCount={projects.length}
              onNewConversation={handleNewConversation}
              onOpenConversation={(id) => void openConversation(id)}
              onDeleteConversation={(id) => void handleDeleteConversation(id)}
              onOpenProjects={() => {
                setSidebarOpen(false)
                setProjectOpen(true)
                setModelOpen(false)
              }}
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

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-paper">
              {activeConversation?.title ?? 'Nova conversa'}
            </span>
            <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[9px] leading-3 text-muted">
              {messages.length}
            </span>
            <button
              type="button"
              onClick={() => openSettings('harnesses')}
              title={
                harness
                  ? `Harness ativo: ${harness.name}. Ele usa o modelo e o login do próprio CLI. Clique para trocar.`
                  : 'Nenhum harness ativo. Clique para escolher.'
              }
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                harness
                  ? 'border-accent/35 bg-accent/10 text-accent hover:border-accent/60'
                  : 'border-line text-muted hover:border-white/25 hover:text-paper'
              }`}
            >
              <Terminal className="h-3 w-3 shrink-0" />
              <span className="max-w-[140px] truncate">
                {harness?.name ?? 'Sem harness'}
              </span>
            </button>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {ttsEnabled ? (
              <button
                type="button"
                onClick={toggleVoiceReplies}
                aria-pressed={voiceReplies}
                title={
                  voiceReplies
                    ? 'Respostas em voz ativadas. Clique para desligar.'
                    : 'Responder em voz (fala as respostas)'
                }
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  voiceReplies
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line text-muted hover:border-white/20 hover:text-paper'
                }`}
              >
                <Speaker className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void captureScreen()
              }}
              disabled={capturing}
              title="Capturar e enviar um print da tela"
              aria-label="Capturar e enviar um print da tela"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-white/20 hover:text-paper disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
            {activeProject ? (
              <span
                className="hidden max-w-[200px] items-center gap-1.5 truncate rounded-lg border border-line px-2 py-1 text-[10.5px] text-muted sm:flex"
                title={activeProject.path}
              >
                <Folder className="h-3 w-3 shrink-0" />
                <span className="truncate">{activeProject.name}</span>
              </span>
            ) : null}
            <span className="hidden max-w-[180px] truncate text-[11px] text-muted xl:block">
              {user.email}
            </span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div
              ref={messagesRef}
              onScroll={(event) => {
                const el = event.currentTarget
                const distance = el.scrollHeight - el.scrollTop - el.clientHeight
                setAutoScroll(distance < 80)
              }}
              className="h-full overflow-y-auto px-4 py-6"
            >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
              {messages.map((message, index) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[min(560px,85%)] whitespace-pre-wrap rounded-2xl rounded-tr-md border border-accent/25 bg-accent/15 px-3.5 py-2.5 text-[12.5px] leading-5 text-paper">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className="group min-w-0 max-w-full break-words px-1 text-[13px] leading-6 text-paper/90"
                  >
                    {message.content ? <MarkdownMessage
                      content={message.content}
                      onImageClick={(src, alt) => setLightbox({ src, alt })}
                    /> : null}

                    {message.image ? (
                      <img
                        src={message.image}
                        alt="Print da tela"
                        onClick={() => setLightbox({ src: message.image ?? '', alt: 'Print da tela' })}
                        className="mt-2 max-h-80 w-auto cursor-zoom-in rounded-lg border border-line"
                      />
                    ) : null}

                    {message.question ? (
                      <QuestionCard
                        question={message.question}
                        answered={messages
                          .slice(index + 1)
                          .some((next) => next.role === 'user')}
                        disabled={sending}
                        onAnswer={(answer) =>
                          void handleSend(
                            undefined,
                            `Resposta à pergunta "${message.question?.question}": ${answer}`,
                          )
                        }
                      />
                    ) : null}

                    {message.process ? <ProcessBlock raw={message.process} /> : null}

                    {message.content || message.question || message.image ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        {message.content ? (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(message.content)
                                .then(() => showToast('Resposta copiada'))
                                .catch(() => showToast('Não consegui copiar', 'error'))
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-muted transition-colors hover:bg-white/5 hover:text-paper"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar
                          </button>
                        ) : null}
                        {ttsEnabled && 'speechSynthesis' in window ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleSpeak(
                                message.id,
                                `${message.content}${
                                  message.question ? `. ${message.question.question}` : ''
                                }`,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-muted transition-colors hover:bg-white/5 hover:text-paper"
                          >
                            <Speaker className="h-3 w-3" />
                            {speakingId === message.id ? 'Parar' : 'Ouvir'}
                          </button>
                        ) : null}
                        {activeId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                id: message.id,
                                preview:
                                  (message.content || message.question?.question || 'esta mensagem')
                                    .slice(0, 60),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash className="h-3 w-3" />
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ),
              )}

              {sending ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                    <Chat className="h-4 w-4" />
                  </div>
                  <details className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-panel px-3.5 py-2.5 text-[12px] text-muted">
                    <summary className="flex cursor-pointer select-none items-center gap-1.5">
                      <ChevronDown className="chevron h-3 w-3 shrink-0 transition-transform" />
                      <span className="truncate">
                        {harness ? `Executando no ${harness.name}` : 'Consultando modelo'}
                        {elapsed > 1
                          ? ` · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
                          : '…'}
                      </span>
                      {job ? (
                        <span className="ml-auto shrink-0 text-[10px] text-muted/80">
                          {jobProgress?.lines.length ?? 0}{' '}
                          {(jobProgress?.lines.length ?? 0) === 1 ? 'passo' : 'passos'}
                        </span>
                      ) : null}
                    </summary>
                    <pre
                      ref={jobLogRef}
                      className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-muted"
                    >
                      {jobProgress && jobProgress.lines.length > 0
                        ? `${jobProgress.lines.join('\n')}${
                            jobProgress.skipped > 0
                              ? `\n\n(${jobProgress.skipped} linhas técnicas omitidas)`
                              : ''
                          }`
                        : 'Trabalhando…'}
                    </pre>
                  </details>
                </div>
              ) : null}
              <div ref={chatEndRef} />

              {!hasProvider && !harness ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-panel px-3.5 py-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Key className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-4 text-paper">
                      Nenhum provedor configurado
                    </p>
                    <p className="text-[11px] leading-4 text-muted">
                      Conecte um provedor ou use o Ollama local.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    fullWidth={false}
                    variant="secondary"
                    onClick={() => openSettings('chaves')}
                  >
                    Configurar provedor
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
            {!autoScroll ? (
              <button
                type="button"
                onClick={() => {
                  setAutoScroll(true)
                  const el = messagesRef.current
                  if (el) el.scrollTop = el.scrollHeight
                }}
                className="absolute bottom-3 right-4 z-10 rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] text-paper shadow-lg shadow-black/40 transition-colors hover:border-white/25"
              >
                Ir para o fim
              </button>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-line px-2.5 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-3">
            <form className="mx-auto w-full max-w-3xl" onSubmit={handleSend}>
              <div className="rounded-2xl border border-line bg-panel px-2.5 pb-2 pt-1.5 transition-colors focus-within:border-white/20">
                {files.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5">
                    {files.map((item, index) =>
                      item.url ? (
                        <div
                          key={`${item.file.name}-${item.file.size}-${index}`}
                          className="relative overflow-hidden rounded-xl border border-line bg-ink/70"
                        >
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className="h-[68px] w-[92px] object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-[9px] leading-3 text-paper/90">
                            {item.file.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            aria-label={`Remover ${item.file.name}`}
                            className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-paper/80 transition-colors hover:bg-black/80 hover:text-paper"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span
                          key={`${item.file.name}-${item.file.size}-${index}`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-ink/70 px-2 py-1 text-[10.5px] leading-4 text-paper/80"
                        >
                          <Paperclip className="h-3 w-3 shrink-0 text-muted" />
                          <span className="max-w-[150px] truncate">{item.file.name}</span>
                          <span className="text-muted">{formatBytes(item.file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            aria-label={`Remover ${item.file.name}`}
                            className="rounded p-0.5 text-muted hover:bg-white/5 hover:text-paper"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ),
                    )}
                  </div>
                ) : null}


                <textarea
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    const el = event.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault()
                      void handleSend()
                    }
                  }}
                  ref={textareaRef}
                  placeholder="digite sua mensagem"
                  aria-label="Mensagem"
                  className="max-h-24 min-h-[34px] w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-[13px] leading-5 text-paper placeholder:text-muted/60 focus:outline-none"
                />

                <div className="mt-0.5 flex flex-nowrap items-center gap-1">
                  <div className="relative min-w-0 flex-1 sm:max-w-[15rem]">
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasProvider && !harness) {
                          openSettings('chaves')
                          return
                        }
                        setProjectOpen(false)
                        setModelOpen((current) => !current)
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={modelOpen}
                      className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-ink/60 px-1.5 py-1 text-[10.5px] font-medium text-paper/90 transition-colors hover:border-white/20 sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-[11px]"
                    >
                      <span className="truncate">
                        {selectedModel?.label ?? (hasProvider ? 'Selecionar modelo' : 'Sem modelo')}
                      </span>
                      {selectedModel ? (
                        <span className="hidden rounded bg-accent/15 px-1 py-0.5 text-[9px] font-semibold leading-3 text-accent sm:inline">
                          {selectedModel.badge}
                        </span>
                      ) : null}
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </button>

                    {modelOpen ? (
                      <>
                        <button
                          type="button"
                          aria-label="Fechar seletor de modelo"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setModelOpen(false)}
                        />
                        <div
                          role="listbox"
                          className="absolute bottom-full left-0 z-20 mb-1.5 max-h-72 w-[min(21rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-line bg-panel p-1 shadow-xl shadow-black/50"
                        >
                          {modelGroups.length === 0 ? (
                            <p className="px-2 py-2 text-[11px] leading-4 text-muted">
                              Nenhum modelo disponível. Configure uma chave.
                            </p>
                          ) : (
                            modelGroups.map((group) => (
                              <div key={group.providerId} className="mb-0.5">
                                <div className="sticky top-0 z-[1] -mx-1 mb-1 flex items-center gap-2 border-b border-line/70 bg-panel px-2.5 py-1.5">
                                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-paper/80">
                                    {group.label}
                                  </span>
                                  <span className="ml-auto text-[9px] text-muted">
                                    {group.models.length}
                                  </span>
                                </div>
                                {group.models.map((model) => (
                                  <button
                                    key={model.id}
                                    type="button"
                                    role="option"
                                    aria-selected={model.id === selectedModelId}
                                    onClick={() => selectModel(model.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[11.5px] font-medium text-paper/90">
                                        {model.label}
                                      </span>
                                      <span className="block text-[10px] leading-3 text-muted">
                                        {model.provider}
                                      </span>
                                    </span>
                                    <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] leading-3 text-muted">
                                      {model.badge}
                                    </span>
                                    {model.id === selectedModelId ? (
                                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="relative min-w-0 flex-1 sm:max-w-[12rem]">
                    <button
                      type="button"
                      onClick={() => {
                        setModelOpen(false)
                        setProjectOpen((current) => !current)
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={projectOpen}
                      title={activeProject?.path ?? 'Escolha a pasta do projeto'}
                      className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-1.5 py-1 text-[10.5px] font-medium transition-colors sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                        activeProject
                          ? 'border-accent/30 bg-accent/10 text-paper'
                          : 'border-line bg-ink/60 text-muted hover:border-white/20 hover:text-paper'
                      }`}
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="truncate">{activeProject?.name ?? 'Projeto'}</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </button>

                    {projectOpen ? (
                      <>
                        <button
                          type="button"
                          aria-label="Fechar seletor de projeto"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setProjectOpen(false)}
                        />
                        <div
                          role="listbox"
                          className="absolute bottom-full right-0 z-20 mb-1.5 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-panel shadow-xl shadow-black/50"
                        >
                          <div className="flex items-center gap-2 border-b border-line/70 px-2.5 py-1.5">
                            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-paper/80">
                              Projeto
                            </span>
                            <span className="ml-auto text-[9px] text-muted">
                              {projects.length}
                            </span>
                          </div>

                          <div className="border-b border-line/70 p-1.5">
                            <div className="flex items-center gap-1">
                              <input
                                value={projectPathDraft}
                                onChange={(event) => setProjectPathDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    void addProjectPath()
                                  }
                                }}
                                placeholder="ou cole o caminho da pasta"
                                aria-label="Caminho da pasta do projeto"
                                className="min-w-0 flex-1 rounded-md border border-line bg-ink/60 px-2 py-1 text-[10.5px] text-paper placeholder:text-muted/60 focus:border-white/20 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void addProjectPath()}
                                className="rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-muted transition-colors hover:border-white/25 hover:text-paper"
                              >
                                Usar
                              </button>
                            </div>
                          </div>

                          <div className="max-h-56 overflow-y-auto p-1">
                            <button
                              type="button"
                              role="option"
                              aria-selected={!activeProjectId}
                              onClick={() => void selectProject(null)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                            >
                              <span className="min-w-0 flex-1 text-[11.5px] text-muted">
                                Nenhum projeto
                              </span>
                              {!activeProjectId ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                              ) : null}
                            </button>

                            {projects.map((project) => (
                              <button
                                key={project.id}
                                type="button"
                                role="option"
                                aria-selected={project.id === activeProjectId}
                                onClick={() => void selectProject(project.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                              >
                                <Folder className="h-3.5 w-3.5 shrink-0 text-accent" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11.5px] font-medium text-paper/90">
                                    {project.name}
                                  </span>
                                  <span
                                    className="block truncate text-[9.5px] leading-3 text-muted"
                                    title={project.path}
                                  >
                                    {project.path}
                                  </span>
                                </span>
                                {!project.exists ? (
                                  <span className="text-[9px] uppercase tracking-wide text-red-400">
                                    ausente
                                  </span>
                                ) : null}
                                {project.id === activeProjectId ? (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                                ) : null}
                              </button>
                            ))}
                          </div>

                          <div className="border-t border-line/70 p-1">
                            <button
                              type="button"
                              onClick={() => void pickProject()}
                              disabled={pickingProject}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] font-medium text-accent transition-colors hover:bg-white/5 disabled:opacity-60"
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                              {pickingProject ? 'Escolha a pasta na janela…' : 'Escolher pasta…'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.txt,.md,.json,.csv,.zip"
                      className="hidden"
                      onChange={handleFiles}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Anexar arquivo"
                      title="Anexar imagem ou arquivo"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-paper"
                    >
                      <Paperclip className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void toggleListening()
                      }}
                      disabled={transcribing}
                      aria-label={
                        transcribing
                          ? 'Transcrevendo'
                          : listening
                            ? 'Parar microfone'
                            : 'Gravar áudio'
                      }
                      aria-pressed={listening}
                      title={
                        transcribing
                          ? 'Transcrevendo…'
                          : listening
                            ? 'Parar microfone'
                            : 'Gravar áudio'
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5 ${
                        listening || transcribing
                          ? 'bg-accent/15 text-accent'
                          : 'text-muted hover:text-paper'
                      } disabled:opacity-60`}
                    >
                      <Mic className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="submit"
                      disabled={((!draft.trim() && files.length === 0) || sending)}
                      aria-label="Enviar mensagem"
                      title="Enviar mensagem"
                      className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-black transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <p className="mt-1 hidden px-1 text-[10px] leading-4 text-muted/70 sm:block">
              Enter cria nova linha · Ctrl+Enter envia
            </p>
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


      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Excluir mensagem?"
          message={`A mensagem "${deleteTarget.preview}" será removida da conversa. Não dá para desfazer.`}
          confirmLabel="Excluir"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void confirmDeleteMessage()
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  )
}


