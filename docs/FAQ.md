# Perguntas frequentes

**Preciso pagar alguma coisa?**
O Interpres é gratuito (MIT). Você paga só o provedor de modelo ou o harness que
usar. O Ollama local não tem custo por token.

**Preciso de chave de API?**
Para modelos em nuvem, sim. Em Configurações → Chaves de API. Para o Ollama local,
não. Para harnesses, a autenticação é feita no próprio CLI.

**Funciona sem internet?**
O app sim. O modelo só responde offline se for local (Ollama) e o harness
conseguir rodar sem rede.

**Onde ficam meus dados?**
Na sua máquina, em SQLite: `apps/api/data/interpres.db` no modo local, ou no volume
`interpres_data` no Docker. Anexos ficam na pasta do projeto.

**A IA pode apagar meus arquivos?**
Sim, dentro da pasta que você escolher, e o harness usa as permissões dele.
Escolha bem o projeto e mantenha backup. O Interpres não oferece desfazer.

**Por que o agente pergunta "qual é a tarefa"?**
Em geral é prompt curto demais ou pasta errada. Diga o que fazer, onde e como saber
que terminou. No Hermes, a sessão é retomada; em outros harnesses cada mensagem
recomeça.

**Posso usar mais de um harness?**
Só um fica ativo por vez. Troque em Configurações → Harnesses.

**Qual harness escolher?**
Comece pelo OpenCode. Para tarefas grandes e migrações, Hermes. Para bug pontual,
Claude Code. Para custo baixo, Codex (com chave).

**O Hermes guarda memória?**
Sim, a memória e as skills dele ficam no próprio Hermes e são retomadas por
conversa. Elas não passam para outro harness.

**Posso usar do celular?**
Sim, com túnel (Cloudflare ou ngrok). Veja docs/TUNEL.md.

**Quantos usuários?**
Um dono por instalação. Não há cadastro público.

**Como recupero a senha?**
Com o código de recuperação criado no primeiro acesso, por e-mail (se SMTP
configurado) ou pelo terminal:

```bash
docker compose exec --user interpres interpres python -m app.cli reset-password --email seu@email.com --generate
```

**Como atualizo?**
Docker: `git pull && docker compose build && docker compose up -d`. Local: atualize
o código, rode as migrações (`alembic upgrade head`) e refaça `npm run build`.

**O que é `.interpres/uploads`?**
A pasta onde os anexos enviados no chat são salvos dentro do projeto.

**A busca em conversas gasta tokens?**
Não. A busca é local; só o trecho que você escolhe entra no próximo pedido.

**Posso usar outra porta?**
Sim: `--port 8010` no uvicorn ou `INTERPRES_PORT` no Docker.

**O app mostra a chave que salvei?**
Não. A API só informa "configurada". A chave é cifrada com `APP_SECRET`.

**Perdi o `.env`. E agora?**
Recupere o `APP_SECRET` de um backup. Sem ele, chaves e 2FA ficam ilegíveis.

**Como contribuir?**
Veja CONTRIBUTING.md. Rode os testes antes: `pytest` na API e `npm run build` no web.
