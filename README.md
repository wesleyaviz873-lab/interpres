# Interpres

<img src="docs/icon.png" alt="Interpres" width="88" align="right" />

Workspace de IA auto-hospedado: **suas chaves, seus modelos, seus arquivos, sua máquina**.

**Português** · [English](README.en.md)

> **Status: versão local funcional (v0.2).** Conta do dono, chaves cifradas,
> conversas persistidas, projetos, anexos, busca em conversas antigas e harnesses
> de código reais funcionando. Streaming de jobs, aprovações e agente local vêm
> depois.

O Interpres é para quem quer a experiência de um chat de IA hospedado **sem
entregar chaves, conversas e arquivos para terceiros**. Cada instalação tem um
único dono, como um n8n auto-hospedado. Não existe cadastro público.

Você escolhe o **harness** (o agente que roda de verdade na sua máquina) e o
**modelo** que quer pagar. Trocar de harness não tira nada do seu computador.

## Para que serve

- Conversar com o modelo que você já paga, com histórico salvo.
- Pedir para um agente **criar, editar e apagar arquivos** dentro de uma pasta de
  projeto que você escolhe.
- Usar o mesmo app com OpenCode, Claude Code, Codex, Gemini ou Hermes — e trocar
  quando quiser.
- Consultar conversas antigas quando precisar de contexto, pagando quase nada
  por isso.
- Deixar tudo acessível no celular por um túnel (Cloudflare ou ngrok), sem abrir
  portas no roteador.

## Como funciona

```
 navegador
    |
    v
 FastAPI (login, conversas, projetos, uploads)  --->  SQLite (local)
    |
    +--> harness na sua máquina (OpenCode / Claude Code / Codex / Gemini / Hermes)
             roda na pasta do projeto, com as ferramentas e o login dele
```

O harness é o **executor**. O Interpres guarda sessões, projetos, histórico,
anexos e a interface. A memória interna de cada harness (skills, aprendizado)
fica dentro dele — e isso é proposital.

## O que já funciona

### Conta e segurança
- Criação do dono na primeira execução, com código de recuperação.
- Login, logout e sessão no servidor (cookie HttpOnly) com proteção CSRF.
- Recuperação por código, ou por e-mail se o SMTP estiver configurado.
- 2FA opcional (Google Authenticator) com códigos de backup.
- CLI administrativo: `list-users` e `reset-password`.
- Chaves de provedores cifradas com `APP_SECRET`; a API nunca devolve a chave.
- Lista de dispositivos conectados, com revogação individual.
- Senhas com Argon2id, limite de tentativas e registro de auditoria.

### Conversas
- Conversas e mensagens persistidas e retomadas ao abrir o app.
- Respostas em Markdown, com links clicáveis, listas, tabelas e blocos de código.
- Imagens e arquivos anexados (até 25 MB) são entregues ao harness.
- Busca local nas conversas antigas; só o trecho escolhido entra no próximo pedido.
- Seletor de modelo agrupado por provedor, com o nome do provedor fixo no topo.

### Projetos
- Escolha a pasta de trabalho pelo seletor nativo do sistema ou cole o caminho.
- Cada projeto guarda seus anexos em `.interpres/uploads`.

### Harnesses
O Interpres detecta os agentes instalados no computador e roda dentro da pasta do
projeto, com ferramentas reais:

| Harness | Como roda | Observações |
|---|---|---|
| OpenCode | `opencode run --auto` | anexos por `--file` |
| Claude Code | `claude -p` | edições automáticas |
| Codex CLI | `codex exec --full-auto` | imagens por `--image` |
| Gemini CLI | `gemini -p` | aprovação de edição automática |
| Hermes Agent | `hermes chat -q` | memória, skills e sessão retomada por conversa |

Só **um harness fica ativo por vez** (Configurações → Harnesses). O ativo aparece
no topo do chat. Harnesses que aceitam modelo podem ser combinados com o
provedor/modelo escolhido; o Hermes cobre o caso de modelo livre.

### Operação
- Túnel opcional: Cloudflare rápido (sem conta), Cloudflare com token e ngrok.
- SQLite com migrações Alembic (PostgreSQL é opção futura).
- Cabeçalhos de segurança e CSP em produção.
- Healthcheck em `/api/health`.
- Uma imagem Docker que compila o frontend e serve pela própria API.

## O que precisa no computador

**Opção 1 — Docker (mais simples):**
- Docker Desktop (Windows/macOS) ou Docker + Compose (Linux).
- Nada de Python ou Node.

**Opção 2 — local (para usar harnesses de verdade):**
- Windows 10/11, Linux ou macOS.
- Python 3.11+ e Node 20+.
- Pelo menos um harness instalado e logado:
  - OpenCode: `npm install -g opencode-ai`
  - Claude Code: instalador oficial da Anthropic
  - Codex CLI: `npm install -g @openai/codex`
  - Gemini CLI: `npm install -g @google/gemini-cli`
  - Hermes Agent: `pip install hermes-agent` e `hermes setup`

O desenvolvedor do harness precisa estar autenticado (login no CLI ou chave de
API). O Interpres não guarda a senha dessas ferramentas.

## Instalação rápida (Docker)

```bash
git clone https://github.com/<seu-usuario>/interpres.git
cd interpres
cp .env.example .env
# gere um segredo real e coloque em APP_SECRET:
#   openssl rand -hex 32
# a produção recusa o "change-me"
docker compose up -d
```

Abra <http://localhost:3000> e crie a conta do dono.

## Instalação local (Windows, Linux ou macOS)

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt  # Linux/macOS

cd ../web
npm install
npm run build
```

Na pasta `apps/api`, suba a API apontando para o build do frontend:

```powershell
# Windows PowerShell
$env:APP_ENV = "development"
$env:APP_MODE = "local"
$env:WEB_DIST_DIR = "C:\caminho\para\interpres\apps\web\dist"
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

```bash
# Linux/macOS
APP_ENV=development APP_MODE=local WEB_DIST_DIR="$(pwd)/../web/dist" \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Abra <http://127.0.0.1:8010>.

`APP_MODE=local` libera o seletor de pastas e os harnesses. `APP_MODE=server`
mantém só chat, provedores e workspace.

## Primeiros passos

1. Crie a conta do dono.
2. Em **Configurações → Chaves de API**, cole a chave do provedor (ou aponte o
   Ollama local).
3. Em **Configurações → Harnesses**, clique em **Instalar** se precisar, depois
   ligue o harness que você quer usar.
4. No chat, escolha a pasta em **Projeto** (ex.: `C:\projetos\app`).
5. Mande o pedido. Se quiser consultar algo de uma conversa antiga, use o botão
   de banco ao lado do clipe.

## Túnel (celular fora de casa)

Use **Configurações → Túnel**:
- **Cloudflare rápido**: sem conta, gera uma URL temporária.
- **Cloudflare com token**: túnel nomeado, URL estável.
- **ngrok**: precisa de conta e token.

A imagem Docker já vem com `cloudflared` e `ngrok`. Passo a passo em
[docs/TUNEL.md](docs/TUNEL.md).

## Privacidade e segurança

- Sem telemetria e sem serviço externo obrigatório.
- Chaves cifradas com `APP_SECRET`; a API só informa se estão configuradas.
- Conversas, mensagens, projetos e anexos ficam na sua máquina.
- `.env`, banco, uploads e build ficam no `.gitignore`.
- O repositório público não contém caminhos, e-mails, nomes de clientes ou chaves.

Leia também [docs/SEGURANCA.md](docs/02-SEGURANCA.md) e [SECURITY.md](SECURITY.md).

## Estrutura

```
apps/
  api/       FastAPI, SQLAlchemy, Alembic, autenticação, harnesses, testes
  web/       React, TypeScript, Vite, Tailwind
docker/      Dockerfile e entrypoint
docs/        visão, arquitetura, segurança, instalação, uso e FAQ
```

## Documentação

- [Instalação detalhada](docs/INSTALACAO.md)
- [Como usar (e economizar tokens)](docs/USO.md)
- [Túnel: Cloudflare e ngrok](docs/TUNEL.md)
- [Instalar conversando com uma IA](docs/PROMPT-IA.md)
- [Perguntas frequentes](docs/FAQ.md)
- [Visão](docs/00-VISAO.md) · [Arquitetura](docs/01-ARQUITETURA.md) ·
  [Segurança](docs/02-SEGURANCA.md) · [Roadmap](docs/03-ROADMAP.md) ·
  [Estado atual](docs/07-ESTADO-ATUAL.md)

## Licença

MIT. Veja [LICENSE](LICENSE).
