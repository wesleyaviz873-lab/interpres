const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g

const NOISE = [
  /^\s*at\s+/,
  /\bcom\.android\./,
  /\bandroid\.app\./,
  /\bandroid\.server\./,
  /\bjava\./,
  /\bkotlin\./,
  /PackageManager/,
  /ActivityManager/,
  /handleIncomingUser/,
  /translateUserId/,
  /^\s*#\d+\s+pc\s/,
  /^\s*Caused by:/,
  /^\s*\.\.\.\s*\d+\s+more/,
]

function shortPath(raw: string): string {
  const clean = raw.replace(/[`"']/g, '').trim()
  const parts = clean.split(/[\\/]/).filter(Boolean)
  if (parts.length === 0) return clean
  return parts.slice(-2).join('/')
}

function truncate(text: string, size: number): string {
  const clean = text.split(/\s+/).filter(Boolean).join(' ')
  return clean.length > size ? `${clean.slice(0, size)}…` : clean
}

export function humanizeProgressLine(raw: string): string | null {
  let line = raw.replace(ANSI, '').trim()
  if (!line) return null
  if (line.startsWith('session_id:')) return null
  if (NOISE.some((pattern) => pattern.test(line))) return null

  if (/^Iniciando\s+/i.test(line)) return line
  if (/^Concluído/i.test(line)) return 'Concluído'

  const tool = line.match(/^[←→›>]\s*(Read|Write|Edit|Bash|Glob|Grep|List|Delete|Patch|Task|WebFetch|WebSearch|Todo)\b\s*(.*)$/i)
  if (tool) {
    const verb = tool[1].toLowerCase()
    const rest = tool[2] ?? ''
    if (verb === 'read') return `Lendo ${shortPath(rest)}`
    if (verb === 'write') return `Criando ${shortPath(rest)}`
    if (verb === 'edit') return `Editando ${shortPath(rest)}`
    if (verb === 'delete') return `Apagando ${shortPath(rest)}`
    if (verb === 'bash') return `Executando: ${truncate(rest, 110)}`
    if (verb === 'grep') return `Pesquisando: ${truncate(rest, 80)}`
    if (verb === 'glob') return `Procurando arquivos: ${truncate(rest, 80)}`
    if (verb === 'list') return `Listando ${shortPath(rest)}`
    if (verb === 'task') return `Delegando: ${truncate(rest, 90)}`
    if (verb === 'websearch') return `Pesquisando na web: ${truncate(rest, 80)}`
    if (verb === 'webfetch') return `Abrindo: ${truncate(rest, 80)}`
    if (verb === 'todo') return `Planejando: ${truncate(rest, 90)}`
    return `Usando ${tool[1]}`
  }

  if (/^> build\b/i.test(line)) {
    const model = line.replace(/^> build\s*[·:]\s*/i, '').trim()
    return model ? `Modelo: ${model}` : 'Conectando ao modelo'
  }
  if (/^Wrote file successfully/i.test(line)) return 'Arquivo salvo'
  if (/^┊\s*review diff/i.test(line)) return 'Revisando mudanças'
  if (/^┊\s*/.test(line)) return truncate(line.replace(/^┊\s*/, ''), 140)
  if (/^[ab]\/.*→\s*[ab]\//.test(line)) return null
  if (/^@@/.test(line)) return null
  if (/^[+-][^+-]/.test(line)) return null
  if (/^(Resumed session|Session )/i.test(line)) return null
  if (/^(INFO|DEBUG|WARN|ERROR|TRACE)\b/.test(line)) {
    line = line.replace(/^(INFO|DEBUG|WARN|ERROR|TRACE)\s*[:|-]?\s*/i, '')
    if (!line) return null
  }
  if (/^[{[]/.test(line)) return null
  if (/^[a-zA-Z_$][\w$]*:\d+$/.test(line)) return null

  return truncate(line, 160)
}

export function humanizeProgress(rawLines: string[]): { lines: string[]; skipped: number } {
  const lines: string[] = []
  let skipped = 0
  for (const raw of rawLines) {
    const friendly = humanizeProgressLine(raw)
    if (!friendly) {
      skipped += 1
      continue
    }
    if (lines[lines.length - 1] === friendly) continue
    lines.push(friendly)
  }
  return { lines: lines.slice(-200), skipped }
}
