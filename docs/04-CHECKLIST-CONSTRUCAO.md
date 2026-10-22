# Checklist de construcao

Legenda de prioridade:

- **P0**: bloqueia a primeira release publica.
- **P1**: entra na v1 se nao atrasar o nucleo.
- **P2**: depois da v1.

## 1. Repositorio e governanca

- [ ] P0 Nome, descricao e URL do repositorio definidos.
- [ ] P0 Licenca AGPL-3.0 na raiz.
- [ ] P0 README em ingles com resumo em portugues.
- [ ] P0 `.gitignore` cobrindo dados, segredos, builds e dependencias.
- [ ] P0 `.env.example` sem valores reais.
- [ ] P0 `CONTRIBUTING.md`.
- [ ] P0 `SECURITY.md` com canal privado de divulgacao.
- [ ] P0 `CODE_OF_CONDUCT.md`.
- [ ] P1 Templates de issue e pull request.
- [ ] P1 `CHANGELOG.md` e versionamento semantico.
- [ ] P1 Branch protection e revisao obrigatoria.
- [ ] P1 Dependabot ou Renovate.
- [ ] P1 CI: lint, tipos, testes, build, Docker e gitleaks.
- [ ] P1 Release com tag e artefatos.
- [ ] P2 Site de documentacao.
- [ ] P2 Instancia de demonstracao somente leitura.

## 2. Arquitetura e contratos

- [ ] P0 Monorepo com `apps/web`, `apps/api`, `apps/agent`, `packages/shared`.
- [ ] P0 Contrato OpenAPI gerado pela API.
- [ ] P0 Tipos compartilhados entre web e API.
- [ ] P0 Configuracao por ambiente, sem caminho fixo.
- [ ] P0 Migracoes de banco com Alembic.
- [ ] P0 Logs estruturados.
- [ ] P0 Healthcheck e prontidao.
- [ ] P1 Feature flags.
- [ ] P1 Versionamento da API.
- [ ] P1 Limites de upload, contexto e concorrencia.
- [ ] P1 Recuperacao de jobs orfaos no boot.
- [ ] P2 Telemetria opt-in.

## 3. Identidade e acesso

- [ ] P0 Primeiro acesso cria a conta de dono.
- [ ] P0 Hash de senha com Argon2id.
- [ ] P0 Login e logout.
- [ ] P0 Sessao em cookie `HttpOnly`, `Secure`, `SameSite`.
- [ ] P0 Rotacao de sessao no login.
- [ ] P0 CSRF.
- [ ] P0 Rate limit e bloqueio temporario.
- [ ] P0 Reset de senha por CLI.
- [ ] P0 Nenhuma rota protegida sem sessao.
- [ ] P0 Testes de autenticacao e autorizacao.
- [ ] P1 OIDC opcional (Google, GitHub).
- [ ] P1 Cloudflare Access como camada extra.
- [ ] P1 Auditoria de login.
- [ ] P2 Multiusuario com papeis.

## 4. Segredos e chaves

- [ ] P0 Nenhum segredo no codigo, no frontend ou no git.
- [ ] P0 Chaves cifradas em repouso com `APP_SECRET`.
- [ ] P0 Chave nunca retornada pela API depois de salva.
- [ ] P0 Remocao de chaves do log e das mensagens de erro.
- [ ] P0 Rotacao de chaves documentada.
- [ ] P1 Suporte a keyring no modo local.
- [ ] P1 Backup criptografado.
- [ ] P1 Verificacao de que o historico git nao contem segredos.

## 5. Núcleo de conversa

- [ ] P0 Provedores: OpenAI, Anthropic, Google, OpenRouter, OpenCode.
- [ ] P0 Ollama local com deteccao automatica.
- [ ] P0 Endpoint OpenAI-compativel configuravel.
- [ ] P0 Catalogo de modelos por provedor.
- [ ] P0 Teste de conexao por provedor.
- [ ] P0 Conversas e mensagens persistidas.
- [ ] P0 Criar, renomear, excluir e buscar conversas.
- [ ] P0 Streaming de resposta.
- [ ] P0 Markdown, codigo e copia.
- [ ] P0 Anexos de texto e imagem.
- [ ] P0 Tratamento de erro por provedor.
- [ ] P1 Exportacao e importacao de conversas.
- [ ] P1 System prompt e temperatura por conversa.
- [ ] P1 Busca full-text.
- [ ] P2 Comparacao lado a lado de modelos.
- [ ] P2 Templates de prompt.

## 6. Jobs e continuidade

- [ ] P0 Criar job e retornar `job_id`.
- [ ] P0 Execucao em worker independente do cliente.
- [ ] P0 Eventos persistidos com sequencia.
- [ ] P0 SSE com retomada por `after` ou `Last-Event-ID`.
- [ ] P0 Resultado final gravado mesmo sem cliente.
- [ ] P0 Cancelamento.
- [ ] P0 Timeout.
- [ ] P0 Limpeza de jobs antigos.
- [ ] P0 Recuperacao apos reinicio do servidor.
- [ ] P0 Teste que aborta a conexao e confirma continuidade.
- [ ] P0 Teste de reconexao sem perder eventos.
- [ ] P1 Fila com limite de concorrencia.
- [ ] P1 Notificacao ao concluir.
- [ ] P2 Retry automatico com backoff.
- [ ] P2 Prioridade por tipo de job.

## 7. Workspace e arquivos

- [ ] P0 Raiz configuravel `WORKSPACE_DIR`.
- [ ] P0 Validacao contra `..`, caminho absoluto e symlink.
- [ ] P0 Leitura, escrita e edicao.
- [ ] P0 Listagem e busca.
- [ ] P0 Limite de tamanho.
- [ ] P0 Escrita atomica.
- [ ] P0 Lixeira e desfazer.
- [ ] P0 Testes de path traversal.
- [ ] P1 Diff antes de aplicar.
- [ ] P1 Upload e download.
- [ ] P1 Preview de artefatos.
- [ ] P2 Integracao com Git.
- [ ] P2 Controle de versao por arquivo.

## 8. Ferramentas e permissoes

- [ ] P0 Registro de ferramentas com manifesto.
- [ ] P0 Permissoes `fs.read`, `fs.write`, `shell`, `desktop`, `network`.
- [ ] P0 Negar por padrao.
- [ ] P0 Aprovacao de acoes sensiveis.
- [ ] P0 Auditoria de entrada, saida e resultado.
- [ ] P0 `shell` e `desktop` desligados no modo servidor.
- [ ] P0 Testes de ferramenta sem permissao.
- [ ] P1 Ambiente limpo para subprocessos.
- [ ] P1 Timeout e limite de saida.
- [ ] P1 Lista de comandos permitidos.
- [ ] P2 Mercado de ferramentas.
- [ ] P2 Sandbox por job.

## 9. Agente local

- [ ] P0 Processo separado do hub.
- [ ] P0 Conexao de saida por WebSocket.
- [ ] P0 Pareamento por codigo de uso unico.
- [ ] P0 Lista de dispositivos e revogacao.
- [ ] P0 Permissoes por dispositivo.
- [ ] P0 Ferramentas: arquivos, shell, desktop, screenshot.
- [ ] P0 Botao de emergencia.
- [ ] P0 Auditoria.
- [ ] P0 Instalador para Windows.
- [ ] P1 Instalador para Linux e macOS.
- [ ] P1 Atualizacao assinada.
- [ ] P1 Reconexao automatica.
- [ ] P2 Emulador Android.
- [ ] P2 Gravacao de tela.

## 10. Interface

- [ ] P0 Reaproveitar a UI atual como base visual.
- [ ] P0 Migrar para TypeScript de forma incremental.
- [ ] P0 Tela de primeiro acesso.
- [ ] P0 Tela de login.
- [ ] P0 Chat com streaming e reconexao.
- [ ] P0 Configuracoes de provedores.
- [ ] P0 Configuracoes de workspace.
- [ ] P0 Tela de jobs e auditoria.
- [ ] P0 Responsivo para celular.
- [ ] P0 Estados de erro, offline e reconexao.
- [ ] P0 Acessibilidade basica.
- [ ] P1 Tema claro e escuro.
- [ ] P1 Atalhos de teclado.
- [ ] P1 Onboarding.
- [ ] P2 PWA.
- [ ] P2 Notificacoes push.

## 11. Instalacao e operacao

- [ ] P0 Dockerfile da API.
- [ ] P0 Dockerfile do web ou build servido pela API.
- [ ] P0 `docker-compose.yml` com volumes `data` e `workspace`.
- [ ] P0 Container nao-root.
- [ ] P0 Healthcheck.
- [ ] P0 `.env.example` completo.
- [ ] P0 `install.sh`.
- [ ] P0 `install.ps1`.
- [ ] P0 Assistente de primeiro acesso.
- [ ] P0 Reset de senha.
- [ ] P0 Backup e restauracao.
- [ ] P0 Upgrade de versao.
- [ ] P0 Rollback.
- [ ] P1 Perfil Cloudflare Tunnel.
- [ ] P1 Perfil Tailscale Funnel.
- [ ] P1 Guia de VPS com TLS e firewall.
- [ ] P1 Diagnostico `doctor`.
- [ ] P2 Pacote para Easypanel, Coolify ou Dokploy.
- [ ] P2 Helm chart.

## 12. Documentacao

- [ ] P0 README com o que e, para quem e como instalar.
- [ ] P0 Guia de instalacao local.
- [ ] P0 Guia de instalacao em VPS.
- [ ] P0 Guia de tunel.
- [ ] P0 Guia de seguranca.
- [ ] P0 Guia de backup e restauracao.
- [ ] P0 Guia de upgrade.
- [ ] P0 Solucao de problemas.
- [ ] P0 FAQ.
- [ ] P0 `INSTALL_WITH_AI.md`.
- [ ] P1 Referencia da API.
- [ ] P1 Guia de ferramentas.
- [ ] P1 Guia do agente local.
- [ ] P1 Arquitetura ilustrada.
- [ ] P1 Screenshots e GIF.
- [ ] P2 Video de instalacao.

## 13. Qualidade e testes

- [ ] P0 Testes unitarios da API.
- [ ] P0 Testes de autenticacao.
- [ ] P0 Testes de jobs e reconexao.
- [ ] P0 Testes de path traversal.
- [ ] P0 Testes de permissoes.
- [ ] P0 Testes do frontend.
- [ ] P0 CI em Linux e Windows.
- [ ] P0 Gitleaks.
- [ ] P0 `pip-audit` e `npm audit`.
- [ ] P1 E2E com Playwright: login, chat, reconexao, aprovacao.
- [ ] P1 Teste de carga de streaming.
- [ ] P1 Cobertura minima definida.
- [ ] P2 Teste de upgrade e rollback automatizado.
- [ ] P2 Fuzzing de caminhos e entradas.

## 14. Migracao do app atual

- [ ] P0 Exportar conversas do backend atual.
- [ ] P0 Exportar conversas locais do navegador.
- [ ] P0 Importar conversas no novo app.
- [ ] P0 Reconfigurar chaves de API.
- [ ] P0 Importar memoria de projeto.
- [ ] P0 Rodar os dois apps em paralelo.
- [ ] P0 Checklist de virada.
- [ ] P0 Plano de rollback.
- [ ] P1 Script de migracao assistida.
- [ ] P2 Importacao automatica de configuracoes.

## 15. Portfolio e publicacao

- [ ] P0 README com screenshots reais.
- [ ] P0 Diagrama de arquitetura.
- [ ] P0 Secao de seguranca explicando as decisoes.
- [ ] P0 Licenca e aviso de uso responsavel.
- [ ] P0 Primeira release.
- [ ] P1 Post explicando a arquitetura de jobs.
- [ ] P1 Post explicando o agente local.
- [ ] P1 Guia de contribuicao para iniciantes.
- [ ] P2 Roadmap publico com votacao.
- [ ] P2 Discussoes e comunidade.

## Definicao de pronto

Uma entrega so conta como pronta quando:

- o codigo compila e os testes passam;
- a documentacao correspondente foi atualizada;
- nenhuma informacao sensivel foi adicionada ao repositorio;
- o comportamento foi verificado em uma instalacao limpa;
- existe um caminho de rollback quando a mudanca toca dados ou producao.
