# Roadmap

O roadmap e organizado por fases com criterio de saida. Nenhuma fase avanca sem
os testes e a documentacao correspondentes.

## Fase 0: Fundacao documental

**Entregas**

- Visao, arquitetura, seguranca, roadmap e checklist.
- Licenca MIT.
- Estrutura de pastas do repositorio.
- Decisoes registradas.

**Criterio de saida**

- Documentos revisados e aprovados.
- Nenhuma duvida aberta sobre o modelo de uma conta por instalacao.
- Nenhuma duvida aberta sobre o modo de execucao e o agente local.

## Fase 1: Esqueleto executavel

**Entregas**

- API FastAPI modular com healthcheck.
- Web React/TypeScript com tela de login vazia.
- Docker Compose com volumes `data` e `workspace`.
- `.env.example`, script de instalacao e CI.
- Banco com a primeira migracao.

**Criterio de saida**

- `docker compose up` sobe a aplicacao.
- `/health` responde.
- CI passa em Linux e Windows.
- Nenhum segredo no repositorio.

## Fase 2: Conta de dono e sessao

**Entregas**

- Primeiro acesso cria o dono.
- Login, logout, sessao, CSRF e rate limit.
- Reset de senha por CLI.
- Auditoria de login.
- Testes de autenticacao.

**Criterio de saida**

- Sem sessao, nenhuma rota protegida responde.
- CSRF e rate limit cobertos por teste.
- Fluxo de primeiro acesso documentado.

## Fase 3: Núcleo de chat

**Entregas**

- Provedores OpenAI, Anthropic, Google, OpenRouter, OpenCode, Ollama e endpoint
  compativel.
- Catalogo de modelos e teste de conexao.
- Conversas, mensagens, titulos, busca e exportacao.
- Interface de chat reaproveitada e migrada para TypeScript.

**Criterio de saida**

- Conversa completa com pelo menos dois provedores.
- Ollama detectado automaticamente.
- Historico persiste e reabre.

## Fase 4: Jobs e reconexao

**Entregas**

- Motor de jobs com eventos persistidos.
- SSE com `Last-Event-ID` ou `after`.
- Cancelamento, timeout e limpeza.
- Interface que retoma jobs ativos.
- Teste que simula queda do cliente.

**Criterio de saida**

- Fechar a janela nao interrompe o job.
- Reabrir a janela mostra o resultado.
- Reinicio do servidor lida com jobs orfaos.

## Fase 5: Workspace e ferramentas

**Entregas**

- Leitura, escrita, edicao, busca, diff, lixeira e desfazer.
- Registro de ferramentas com permissoes.
- Aprovacao de acoes sensiveis.
- Auditoria.
- Testes de path traversal e permissao.

**Criterio de saida**

- A IA nao sai do workspace em nenhum teste.
- Ferramenta sem permissao falha fechado.
- Acao sensivel exige aprovacao.

## Fase 6: Agente local

**Entregas**

- Binario/servico para Windows, Linux e macOS.
- Pareamento, lista de dispositivos e revogacao.
- WebSocket de saida.
- Ferramentas locais com permissoes.
- Botao de emergencia.
- Instalador e documentacao.

**Criterio de saida**

- O hub controla um PC remoto sem porta aberta.
- Revogar o dispositivo interrompe o acesso.
- Toda acao fica auditada.

## Fase 7: Instalacao e operacao

**Entregas**

- `install.sh` e `install.ps1`.
- Assistente de primeiro acesso.
- Perfis de tunel Cloudflare e Tailscale.
- Guia de VPS.
- Backup, restauracao, upgrade e rollback.
- Diagnostico (`doctor`).
- Prompt de instalacao para agentes de IA.

**Criterio de saida**

- Instalacao limpa em menos de 10 minutos.
- Restauracao de backup testada.
- Upgrade de versao testado.

## Fase 8: Publicacao

**Entregas**

- README com screenshots e GIF.
- Documentacao completa.
- Templates de issue e PR.
- CHANGELOG e versao.
- Release com compose versionado.
- Politica de seguranca e divulgacao.

**Criterio de saida**

- Repositorio publico sem segredos.
- Primeira release `v0.1.0` ou `v1.0.0`.
- Instalacao reproduzida por outra pessoa.

## Depois da v1

- Multiusuario com isolamento.
- Sandbox por job.
- Mercado de ferramentas e skills.
- Integracoes com Git, bancos e servicos.
- Aplicativo desktop nativo.
- PWA e notificacoes.
- Telemetria opt-in.
