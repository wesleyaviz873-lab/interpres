# Arquitetura

## Visao geral

```
+----------------------------+
|  Web (React + Vite)        |
|  desktop, celular, PWA     |
+-------------+--------------+
              | HTTPS + SSE/WebSocket
              v
+----------------------------+
|  Hub (FastAPI)             |
|  auth, API, jobs, tools    |
+------+-----------+---------+
       |           |
       |           +--> Provedores de LLM (nuvem)
       |           +--> Ollama / endpoint compativel
       |
       +--> SQLite/Postgres (data)
       +--> Workspace (arquivos permitidos)
       +--> Job store (eventos persistentes)
       |
       | (conexao de saida, opcional)
       v
+----------------------------+
|  Agente local              |
|  Windows / Linux / macOS   |
|  arquivos, shell, desktop  |
+----------------------------+
```

## Componentes

### Web

- React, Vite, Tailwind CSS, TypeScript.
- Conversas, mensagens, anexos, seletor de modelo, configuracoes, auditoria.
- Nao executa logica de negocio. Conversa com a API por contratos tipados.
- Recebe eventos de job por SSE. Se cair, reconecta com `Last-Event-ID`.

### Hub (API)

- FastAPI, SQLAlchemy, Alembic.
- Autenticacao, sessoes, CSRF, rate limit.
- CRUD de conversas, mensagens, configuracoes e chaves criptografadas.
- Registro de ferramentas e politicas de permissao.
- Motor de jobs e armazenamento de eventos.
- Servidor de arquivos estaticos do build web em producao.

### Motor de jobs

O nucleo da confiabilidade. Toda operacao longa e um job:

```
POST /api/jobs          -> cria o job e retorna 202 + job_id
GET  /api/jobs/{id}     -> estado atual, resultado parcial, erro
GET  /api/jobs/{id}/events?after=N -> SSE com eventos a partir de N
POST /api/jobs/{id}/cancel
```

Regras:

- O job roda em um worker do servidor, nunca dentro do ciclo de vida da conexao
  HTTP do navegador.
- Cada evento e persistido com um numero de sequencia.
- O cliente pode desconectar e voltar; recebe o que perdeu.
- Reinicio do servidor marca jobs interrompidos e permite retomar ou falhar com
  mensagem clara.
- Limite de concorrencia por instalacao.
- Timeout, cancelamento e limpeza de jobs antigos.

### Workspace

- Um diretorio raiz configuravel (`WORKSPACE_DIR`).
- Toda operacao de arquivo resolve o caminho e confirma que ele esta dentro da
  raiz, inclusive contra symlinks.
- Escrita atomica, diff antes de aplicar, lixeira e desfazer.
- Nunca aceitar caminho absoluto do cliente sem validacao.

### Ferramentas

Cada ferramenta declara um manifesto:

```json
{
  "name": "write_file",
  "description": "Escreve um arquivo dentro do workspace.",
  "permissions": ["fs.write"],
  "risk": "medium",
  "requiresApproval": false
}
```

- `fs.read`, `fs.write`, `shell`, `desktop`, `network`, `agent.pair`.
- Modo servidor: `shell`, `desktop` e `network` desligados por padrao.
- Acoes de risco alto pedem aprovacao na interface.
- Toda execucao gera um evento de auditoria.

### Agente local

- Processo separado, instalado pelo usuario.
- Conecta para o hub por WebSocket de saida.
- Pareamento por codigo curto, com expiracao.
- Lista de dispositivos e revogacao.
- Capacidades declaradas: arquivos, shell, desktop, emulador, screenshot.
- O hub envia uma tarefa; o agente executa e devolve eventos.
- Permissoes sao concedidas no hub, nao no agente.
- Botao de emergencia para desconectar e encerrar tarefas.

### Dados

Entidades principais:

- `users` (dono da instalacao)
- `sessions`
- `api_keys` (valor cifrado)
- `conversations`
- `messages`
- `jobs`
- `job_events`
- `workspaces`
- `tool_grants`
- `audit_log`
- `devices` (agentes locais)

Migracoes com Alembic. SQLite por padrao; Postgres para instalacoes maiores.

## Modos de execucao

| Modo | Onde roda | Recursos |
|---|---|---|
| `local` | Docker no computador do usuario | Chat, workspace, ferramentas locais, desktop, emulador |
| `server` | VPS ou tunel | Chat, workspace, ferramentas explicitamente habilitadas |
| `hub + agent` | Hub remoto + agente no PC | Tudo, com o agente conectando para fora |

O modo `server` e o padrao de uma instalacao exposta na internet. O modo `local`
e o padrao de quem quer o controle total da maquina.

## Fluxo de uma mensagem

1. O cliente cria um job de chat.
2. O hub persiste a mensagem do usuario.
3. O worker chama o provedor e grava cada trecho como evento.
4. O cliente acompanha por SSE.
5. Se o cliente cair, o worker continua.
6. Ao terminar, o hub grava a mensagem final e marca o job como concluido.
7. Ao voltar, o cliente busca o estado e os eventos que faltaram.

## Fluxo de uma tarefa no agente local

1. O usuario escolhe uma ferramenta e um dispositivo pareado.
2. O hub cria um job e verifica a permissao.
3. Se a acao for sensivel, o hub pede aprovacao.
4. O hub envia a tarefa ao agente por WebSocket.
5. O agente executa e devolve eventos.
6. O hub grava os eventos e o resultado.
7. Tudo fica no log de auditoria.

## Stack e justificativa

- **React + TypeScript:** a interface atual ja e React; TypeScript reduz erros em
  um projeto publico.
- **FastAPI:** o backend atual ja e Python/FastAPI; os adaptadores de provedores
  podem ser aproveitados.
- **SQLite + SQLAlchemy + Alembic:** instalacao simples; Postgres opcional.
- **SSE:** suficiente para streaming e reconexao; WebSocket fica para o agente.
- **Docker Compose:** familiar para o publico de self-hosting.
- **Go ou Rust no agente:** binario unico, sem runtime pesado, cross-platform.

## Estrutura do repositorio

```
interpres/
  apps/
    web/
    api/
    agent/
  packages/
    shared/
  docker/
  docs/
  scripts/
```

## Decisoes que nao devem ser revertidas sem discussao

- Uma conta de dono por instalacao na v1.
- Jobs persistentes, nunca trabalho preso a conexao do navegador.
- Workspace unico, nunca acesso ao disco inteiro.
- Permissoes e auditoria desde o primeiro dia.
- Agente local separado do hub.
- Nenhum segredo no codigo ou no frontend.
