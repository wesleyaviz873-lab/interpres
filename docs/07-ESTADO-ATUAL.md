# Estado atual da fundação

Atualizado em 2026-10-22.

## O que já está implementado

### Identidade e sessão

- `GET /api/setup/status`: informa se a instalação ainda não tem dono.
- `POST /api/setup`: cria a única conta de dono, com e-mail normalizado e senha
  mínima de 10 caracteres. Recusa a segunda criação com `409`.
- `POST /api/auth/login`: valida e-mail e senha, aplica rate limit por IP/e-mail
  e cria sessão no banco.
- `POST /api/auth/logout`: exige CSRF e invalida a sessão no servidor.
- `GET /api/auth/me`: devolve o usuário, o token CSRF e se há código de
  recuperação configurado.
- `POST /api/auth/recover`: troca a senha usando o código de recuperação,
  invalida todas as sessões antigas, gera um novo código e já cria uma sessão.
- `POST /api/auth/change-password`: exige senha atual e CSRF; mantém a sessão
  atual e invalida as outras.
- `POST /api/auth/change-email`: exige senha atual e CSRF; recusa e-mail já usado.
- `POST /api/auth/recovery-code`: gera um novo código de recuperação; o anterior
  deixa de valer.
- `POST /api/auth/logout-all`: encerra todas as sessões da conta.
- Senhas com Argon2id (`pwdlib`).
- Código de recuperação de uso único, com hash Argon2 no banco.
- Recuperação por e-mail opcional: código de 6 dígitos, hash Argon2, validade de
  15 minutos, limite de tentativas e envio por SMTP.
- 2FA opcional (TOTP/Google Authenticator): QR code, segredo cifrado com
  `APP_SECRET`, códigos de backup de uso único e desafio de login separado.
- CLI administrativo: `list-users` e `reset-password` (também desativa 2FA ao
  redefinir, para não trancar o dono fora).
- Chaves de provedores cifradas com `APP_SECRET`; a API nunca devolve a chave
  salva, só o estado "configurada".
- Detecção automática do Ollama e listagem dos modelos instalados, sem campo de
  chave de API para o provedor local.
- Detecção somente leitura dos agentes de código instalados no host.
- Sessões com duração deslizante de 30 dias enquanto a conta é usada.
- Lista de dispositivos conectados com revogação individual e "sair de todos".
- Gerenciador de túnel com Cloudflare rápido (sem conta), Cloudflare com token
  e ngrok; iniciar/parar e copiar/abrir a URL pública.
- Imagem Docker inclui `cloudflared` e `ngrok`.
- Preferências de aparência, voz e notificações no navegador; a aparência
  aplica tamanho de fonte e cor de destaque.
- Configurações completas: Conta, Segurança, Chaves de API, Voz, Harnesses,
  Memória do Projeto, Backend / Endpoint, Aparência, Notificações e Sobre.
  Sem Dev Mode.
- Setup em uma etapa: cria a conta e entra direto na janela; o código de
  recuperação é configurado depois, em Segurança.
- Sessão com token opaco; o banco guarda apenas o hash SHA-256.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` quando a URL é HTTPS.
- CSRF obrigatório em `POST/PUT/PATCH/DELETE` autenticados.
- `audit_log` registra criação do dono, login, falha de login e logout.

### Aplicação

- FastAPI modular (`app/main.py`, `app/routes/`, `app/auth.py`).
- SQLAlchemy 2 + Alembic. Migração inicial em
  `apps/api/migrations/versions/0001_initial.py`.
- Healthcheck público em `GET /api/health`.
- Headers de segurança e CSP em produção.
- Documentação OpenAPI desligada em produção.
- Banco SQLite no volume `interpres_data`.

### Interface

- Setup em duas etapas: criação da conta e exibição obrigatória do código de
  recuperação, com cópia e confirmação de que foi guardado.
- Login com "Esqueci minha senha" e fluxo de recuperação por código.
- Botão de olho para mostrar/ocultar a senha em todos os campos de senha.
- Janela principal do Interpres: sidebar, estado vazio de conversas, menu mobile
  e modal de configurações.
- Configurações: conta (e-mail, senha, código de recuperação), segurança
  (validade da sessão e sair de todos os dispositivos) e sobre.
- Layout escuro, responsivo e sem dependência de serviço externo.
- Build servido pela própria API em produção.

### Empacotamento

- Imagem Docker multi-stage: Node compila o frontend; Python roda a API.
- `docker-compose.yml` com volumes `interpres_data` e `interpres_workspace`.
- Entrypoint roda `alembic upgrade head` antes do uvicorn.
- Processo da aplicação roda como usuário `interpres` (via `gosu`).
- Healthcheck do container.

### Verificação

- `pytest`: 38 testes passando.
- `npm run build`: TypeScript e Vite passando.
- Imagem Docker construída e container testado com:
  - criação do dono;
  - sessão persistindo após restart;
  - logout invalidando a sessão;
  - `/api/health` saudável;
  - frontend servido pela API.

## O que ainda não existe

- Chat, conversas e o motor que usa as chaves já armazenadas.
- Jobs persistentes e reconexão.
- Workspace e ferramentas.
- Criptografia de chaves de API.
- Agente local.
- OIDC / Cloudflare Access opcional.
- Passkeys e outros métodos de segurança.
- Configuração de SMTP pela interface (hoje é por `.env`).
- Aprovação explícita de novo dispositivo (hoje o dono revoga os não usados).
- Testes E2E de navegador.
- CI no GitHub Actions.
- Instalador `install.sh` / `install.ps1` e prompt de instalação por IA.

## Privacidade do repositório

O repositório público não contém dados do autor original: sem caminhos
`D:\...`, sem domínios pessoais, sem nomes de clientes, sem chaves de API e sem
o `.env`. O `.env.example` só tem nomes de variáveis e valores de exemplo.
O `.env` real fica no `.gitignore`.

## Próxima ordem de trabalho

1. Provedores e catálogo de modelos (incluindo Ollama).
2. Conversas e mensagens.
3. Motor de jobs com eventos persistidos e SSE com retomada.
4. Workspace isolado e ferramentas com permissão.
5. Agente local.
6. Instalação assistida e documentação de VPS/túnel.
