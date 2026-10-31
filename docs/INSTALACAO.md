# Instalação

O Interpres roda de duas formas:

| Modo | O que você ganha | O que precisa |
|---|---|---|
| **Docker** | Chat, provedores, conversas, projetos fixos, túnel | Docker + Compose |
| **Local** | Tudo do Docker + seletor de pastas + harnesses do seu PC | Python 3.11+, Node 20+ e um harness |

Escolha Docker se quer só conversar. Escolha local se quer que um agente mexa nos
arquivos do seu computador.

---

## 1. Docker (recomendado para começar)

### Requisitos

- Windows/macOS: Docker Desktop com Compose v2.
- Linux: Docker Engine + plugin Compose.

### Passos

```bash
git clone https://github.com/<seu-usuario>/interpres.git
cd interpres
cp .env.example .env
```

Gere o segredo e edite o `.env`:

```bash
openssl rand -hex 32
```

No `.env`:

```env
APP_SECRET=cole-o-valor-gerado
APP_URL=http://localhost:3000
APP_ENV=production
APP_MODE=server
INTERPRES_PORT=3000
```

Suba:

```bash
docker compose up -d
docker compose logs -f
```

Abra <http://localhost:3000>. A primeira tela cria o **dono** da instalação.

> No Docker o `APP_MODE=server` desliga o seletor de pastas do sistema e usa
> apenas o workspace do container. O OpenCode já vem instalado na imagem e pode
> ser ligado em Configurações → Harnesses, trabalhando dentro de `/workspace`.

### Atualizar

```bash
git pull
docker compose build
docker compose up -d
```

As migrações rodam sozinhas no entrypoint.

### Backup

Os dados estão nos volumes `interpres_data` (banco, uploads, auditoria) e
`interpres_workspace`. Pare o container e copie os volumes, ou faça backup do
arquivo `/data/interpres.db` com o container parado.

### Apagar tudo

```bash
docker compose down -v
```

---

## 2. Local (Windows, Linux ou macOS)

### Requisitos

- Python 3.11 ou 3.12
- Node 20 ou 22
- Um harness instalado e **logado** (veja abaixo)

### Passos

```powershell
# Windows PowerShell
cd apps\api
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt

cd ..\web
npm install
npm run build
```

```bash
# Linux/macOS
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cd ../web
npm install
npm run build
```

Suba a API servindo o build do frontend:

```powershell
# Windows
cd apps\api
$env:APP_ENV = "development"
$env:APP_MODE = "local"
$env:WEB_DIST_DIR = (Resolve-Path ..\web\dist)
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

```bash
# Linux/macOS
cd apps/api
APP_ENV=development APP_MODE=local WEB_DIST_DIR="$(cd ../web/dist && pwd)" \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Abra <http://127.0.0.1:8010>.

### Por que 8010?

A porta 8000 costuma estar ocupada por outras ferramentas. Pode trocar com
`--port`. Só não use a mesma porta para duas coisas.

---

## 3. Instalar um harness

O harness é o agente que executa as tarefas. Instale e faça login antes de ligar
no Interpres.

### OpenCode (recomendado)

```bash
npm install -g opencode-ai
opencode --version
```

Na primeira execução, o OpenCode pede login ou chave. Faça isso uma vez no
terminal.

### Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude
```

Conclua o login na interface.

### Codex CLI

```bash
npm install -g @openai/codex
codex --version
codex
```

O Codex usa sua conta ChatGPT ou uma `OPENAI_API_KEY`. Conta ChatGPT pode não ter
acesso a todos os modelos via CLI.

### Gemini CLI

```bash
npm install -g @google/gemini-cli
gemini --version
```

Precisa de login Google ou da variável `GEMINI_API_KEY`.

### Hermes Agent

```bash
pip install hermes-agent
hermes --version
hermes setup
```

O Hermes é o mais independente de provedor e mantém memória e skills próprias.

Depois de instalar, abra **Configurações → Harnesses**, clique em **Testar** e
ligue apenas o que você quer usar. O ativo aparece no topo do chat.

---

## 4. Verificar se está tudo certo

```bash
curl http://127.0.0.1:8010/api/health
# {"status":"ok","service":"interpres","version":"0.2.0"}
```

Testes automatizados:

```bash
cd apps/api
.venv/Scripts/python -m pytest     # Windows
# .venv/bin/python -m pytest       # Linux/macOS

cd ../web
npm run build
```

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `APP_SECRET must be a random value...` | segredo curto ou `change-me` em produção | gere com `openssl rand -hex 32` |
| Página branca após atualizar | cache do navegador | Ctrl+Shift+R |
| `npm: command not found` | Node não instalado | instale Node 20+ |
| `python: command not found` | Python fora do PATH | use `py -3` no Windows ou o caminho completo |
| Porta em uso | outro app na mesma porta | troque `--port` |
| Harness responde "não tenho acesso" | harness errado ou pasta não escolhida | escolha o projeto e use um harness logado |
| Harness não aparece | CLI não está no PATH | reabra o terminal e rode `--version` |
| Erro de login no harness | CLI não autenticado | rode o CLI no terminal e faça login |
| `sqlite3.OperationalError` ao subir | banco corrompido ou permissão | confira `DATA_DIR` e permissões |

Se nada resolver, rode a API em primeiro plano e leia o log:

```bash
.venv/Scripts/python -m uvicorn app.main:app --log-level debug
```
