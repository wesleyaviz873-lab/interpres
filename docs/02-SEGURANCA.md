# Seguranca

## Premissa

O Interpres executa codigo, le arquivos e pode controlar um computador. Por isso,
a seguranca nao pode depender apenas de "estar em localhost" ou de um tunel.

## Ativos

- Chaves de API dos provedores.
- Conversas e arquivos do usuario.
- Sessoes e credenciais de acesso.
- O workspace e o historico de jobs.
- O agente local e as permissoes concedidas a ele.
- O log de auditoria.

## Atores e fronteiras

| Ator | Confianca |
|---|---|
| Dono da instalacao | Total, apos autenticacao |
| Navegador do dono | Confiavel, mas pode estar em rede hostil |
| Internet | Nao confiavel |
| Provedores de LLM | Externos; recebem apenas o que o usuario enviar |
| Agente local | Confiavel, mas com permissoes limitadas |
| Conteudo gerado pela IA | Nao confiavel; pode conter instrucoes maliciosas |

## Ameacas principais

1. **Acesso nao autenticado ao painel.** Qualquer pessoa que descubra a URL pode
   ler arquivos ou executar comandos.
2. **Sequestro de sessao.** Cookie roubado ou CSRF.
3. **Vazamento de chaves.** Chave no frontend, no git, em logs ou em resposta da
   API.
4. **Path traversal.** A IA ou um usuario tenta sair do workspace.
5. **Execucao arbitraria.** Ferramenta de shell usada sem permissao.
6. **Prompt injection.** Conteudo de um site ou arquivo tenta convencer a IA a
   executar uma acao perigosa.
7. **Agente local comprometido.** Um dispositivo pareado recebe tarefas demais.
8. **Dependencia comprometida.** Pacote malicioso no build.
9. **Exposicao por Docker.** Porta aberta em `0.0.0.0`, volume com o disco
   inteiro, container privilegiado.
10. **Negacao de servico.** Jobs infinitos, uploads gigantes, laco de ferramentas.

## Controles

### Autenticacao

- Conta de dono criada no primeiro acesso.
- Senha com Argon2id.
- Sem cadastro publico por padrao.
- Reset de senha por CLI, com acesso ao host.
- Opcional: OIDC (Google, GitHub) e Cloudflare Access como camada extra.
- Bloqueio temporario apos tentativas repetidas.

### Sessao

- Cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rotacao de sessao no login.
- Expiracao configuravel.
- CSRF token em formularios e chamadas que mudam estado.
- Logout invalida a sessao no servidor.

### Chaves de API

- Cifradas em repouso com `APP_SECRET`.
- Nunca enviadas ao frontend depois de salvas.
- Nao aparecem em logs, mensagens de erro ou telemetria.
- Removidas de backups nao criptografados.
- Rotacao documentada.

### Workspace

- Raiz unica e configuravel.
- Resolucao de caminho com `realpath` e verificacao de prefixo.
- Bloqueio de symlinks que apontem para fora.
- Limite de tamanho por arquivo e por job.
- Escrita atomica e lixeira.

### Ferramentas

- Permissoes declaradas por ferramenta.
- `shell` e `desktop` desligados por padrao no modo servidor.
- Aprovacao explicita para acoes destrutivas.
- Lista de comandos permitidos quando o shell estiver habilitado.
- Ambiente limpo, sem variaveis sensiveis herdadas.
- Timeout e limite de saida.
- Auditoria de entrada, saida, duracao e resultado.

### Agente local

- Pareamento por codigo de uso unico e curto.
- Conexao de saida; nenhuma porta aberta.
- Lista de dispositivos com revogacao.
- Permissoes por dispositivo e por ferramenta.
- Botao de emergencia.
- Atualizacao assinada.

### Aplicacao

- CORS com lista explicita, nunca `*`.
- CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- Limite de corpo e de upload.
- Rate limit por IP e por sessao.
- Erros nao expoem stack trace em producao.
- Logs estruturados sem dados sensiveis.

### Docker

- Container nao-root.
- Root filesystem somente leitura quando possivel.
- Sem `privileged`, sem `network_mode: host` por padrao.
- Volumes explicitos: `data` e `workspace`.
- Porta publicada apenas no servidor de entrada.
- Healthcheck e reinicio controlado.
- Imagens com tag fixa e verificacao de dependencias.

### Cadeia de suprimentos

- Dependabot ou Renovate.
- `pip-audit` e `npm audit` no CI.
- Gitleaks no CI e no pre-commit.
- Build reproduzivel.
- Releases assinadas.
- Revisao de dependencias novas.

## Padroes seguros

- Negar por padrao.
- Menor privilegio.
- Defesa em profundidade.
- Falhar fechado.
- Nao confiar em entrada do cliente.
- Nao confiar em conteudo gerado pela IA.
- Nao esconder erros de seguranca atras de mensagens genericas.

## Fora de escopo da v1

- Multiusuario com isolamento completo.
- Sandbox de sistema operacional por job.
- Auditoria externa certificada.
- Alta disponibilidade.

## Resposta a incidente

1. Revogar sessoes e chaves afetadas.
2. Desconectar agentes locais.
3. Preservar logs.
4. Publicar correcao e aviso.
5. Documentar causa e prevencao.

## Checklist antes de qualquer release publico

- [ ] Nenhum segredo no repositorio nem no historico.
- [ ] Auth testada contra acesso sem sessao.
- [ ] CSRF e rate limit testados.
- [ ] Path traversal testado com `..`, symlink e caminho absoluto.
- [ ] Shell e desktop desligados no modo servidor.
- [ ] Chaves nao aparecem em respostas nem em logs.
- [ ] Container nao-root.
- [ ] Dependencias auditadas.
- [ ] Backup e restauracao testados.
- [ ] Politica de divulgacao responsavel publicada.
