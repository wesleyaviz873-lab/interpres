# Instalar conversando com uma IA

Você pode colar o texto abaixo em qualquer assistente com acesso ao terminal
(Claude Code, Codex, OpenCode, Hermes, Cursor, etc.). Ele foi escrito para ser
seguido sem improviso e sem pedir suas senhas.

---

## Prompt para copiar

```
Quero instalar o Interpres nesta máquina, seguindo o repositório oficial.

Regras:
1. Antes de qualquer comando, me pergunte: sistema operacional (Windows, Linux ou
   macOS) e se prefiro Docker (só chat) ou modo local (harness mexendo nos
   arquivos).
2. Leia primeiro o README e o docs/INSTALACAO.md do repositório. Se não tiver o
   repositório local, clone em uma pasta de projetos do usuário.
3. Verifique os pré-requisitos antes de instalar: Docker/Compose para Docker;
   Python 3.11+, Node 20+ e o harness escolhido para o modo local.
4. Explique o que vai fazer em uma linha antes de cada bloco de comandos e espere
   meu "ok" para comandos que instalam, copiam ou apagam arquivos.
5. Nunca peça, leia ou cole minhas senhas, tokens ou chaves de API no chat. As
   chaves são cadastradas na interface do Interpres, em Configurações → Chaves de API.
6. Não altere configurações do sistema operacional, não desative firewall e não
   abra portas no roteador.
7. No fim, valide com: GET /api/health retornando status ok, criação da conta do
   dono e uma conversa de teste enviando "responda apenas ok".
8. Se algo falhar, mostre o erro completo e proponha a correção mais simples.
   Não invente caminhos nem portas.

Passos esperados:

Docker:
- clonar o repositório;
- copiar .env.example para .env;
- gerar APP_SECRET com openssl rand -hex 32 e colocar no .env;
- docker compose up -d;
- abrir http://localhost:3000.

Local:
- criar .venv em apps/api e instalar requirements-dev.txt;
- npm install e npm run build em apps/web;
- subir uvicorn com APP_ENV=development, APP_MODE=local e WEB_DIST_DIR apontando
  para apps/web/dist, na porta 8010;
- abrir http://127.0.0.1:8010.

Harness (opcional, só no modo local):
- instalar um CLI e autenticar: OpenCode (npm i -g opencode-ai), Claude Code
  (npm i -g @anthropic-ai/claude-code), Codex (npm i -g @openai/codex),
  Gemini (npm i -g @google/gemini-cli) ou Hermes (pip install hermes-agent);
- em Configurações → Harnesses, testar e ligar o harness;
- escolher a pasta do projeto no chat e pedir "crie um arquivo teste.txt".
```

---

## O que a IA deve verificar

- `docker --version` e `docker compose version` (modo Docker).
- `python --version` e `node --version` (modo local).
- Se a porta escolhida está livre.
- Se o harness responde `--version` e está autenticado.

## O que a IA **não** deve fazer

- Rodar `docker compose down -v` sem você pedir (apaga os dados).
- Colocar chaves em arquivos versionados.
- Expor a instalação na internet sem túnel autenticado.
- Instalar pacotes globais sem avisar.

## Se a IA travar

Peça: "leia docs/INSTALACAO.md e siga a seção Problemas comuns". Ou rode você
mesmo:

```bash
cd apps/api
.venv/Scripts/python -m uvicorn app.main:app --log-level debug
```

E cole o erro para a IA.
