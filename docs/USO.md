# Como usar (e gastar menos tokens)

O Interpres não é só um chat: ele deixa um agente trabalhar dentro de uma pasta que
você escolhe. A forma de usar muda bastante o custo e o resultado.

## O ciclo básico

1. **Escolha o projeto** (a pasta). Tudo que o agente ler ou escrever acontece ali.
2. **Escolha o harness** em Configurações → Harnesses. Só um fica ligado.
3. **Escreva o pedido** de forma direta: o que fazer, onde e como saber que ficou
   pronto.
4. **Leia a resposta** e confirme o que mudou (o agente costuma listar os arquivos).

## Um projeto por assunto

Não use a pasta inteira do usuário. Crie uma pasta por projeto:

```
C:\projetos\argenda
C:\projetos\site-pessoal
C:\projetos\experimentos
```

Assim o agente não se perde e você limita o alcance dele. O Interpres salva o
projeto por conversa.

## Qual harness usar

| Situação | Melhor escolha | Por quê |
|---|---|---|
| Corrigir um bug pontual | Claude Code | foco e execução disciplinada |
| Tarefa grande, migração, vários arquivos | Hermes | planeja, usa memória e sessão |
| Custo baixo, tarefa bem definida | Codex (com chave) | barato por tarefa |
| Modelo específico (DeepSeek, Kimi...) | Hermes | aceita qualquer provedor |
| Inspeção rápida, ler repositório | Gemini | contexto grande |
| Uso diário, sem muita configuração | OpenCode | já vem pronto e é rápido |

Se estiver em dúvida, comece pelo OpenCode. Troque quando o tipo de tarefa mudar.

## Chave de API x harness

Os harnesses (OpenCode, Claude Code, Codex, Gemini, Hermes) usam o **modelo e o
login do próprio CLI**. A chave cadastrada em Configurações → Chaves de API é usada
somente quando **nenhum harness está ligado**, no modo de conversa direta.

Se você cadastrou uma chave e o chat continua sem usá-la, confira: há um harness
ativo no topo da tela (chip com o nome dele). Desligue todos em Configurações →
Harnesses para falar direto com o provedor da chave.

## Combinar harness com modelo

O modelo do seletor é usado quando o harness aceita `--model`. O Hermes aceita
qualquer provedor; Claude Code e Codex são presos aos provedores deles. Se o
objetivo é economizar, use o harness cujo provedor você já paga.

## Como economizar tokens

1. **Use a sessão.** No Hermes, a conversa é retomada com `--resume`; não repita
   contexto que ele já viu.
2. **Pedidos curtos e específicos.** "Crie `src/auth.ts` com login por e-mail,
   usando o banco existente" custa menos que três parágrafos de contexto.
3. **Não anexe arquivo por anexar.** Se o agente consegue ler a pasta, você não
   precisa mandar o arquivo.
4. **Divida a tarefa.** Um pedido por objetivo evita reanálise e retrabalho.
5. **Evite "explique o projeto inteiro".** Peça o arquivo ou o trecho específico.

## Anexos

- Imagens e arquivos até 25 MB, salvos em `<projeto>/.interpres/uploads`.
- No OpenCode vão por `--file`; no Codex e Hermes, imagens por `--image`.
- O caminho real é informado no prompt, então o agente pode abrir o arquivo.

## O que evitar

- Apontar o projeto para `C:\` ou para a pasta do usuário inteira.
- Ligar um harness sem estar logado nele (vai falhar ou pedir permissão).
- Rodar dois harnesses ao mesmo tempo (a interface permite só um ativo).
- Deixar o app aberto em rede pública sem túnel com autenticação.
- Colar chaves de API no chat. Use Configurações → Chaves de API.

## Exemplos de pedidos que funcionam

```
Crie um README curto para este projeto, em português, com instalação e uso.
```

```
Rode os testes e me diga o que falhou. Não altere arquivos ainda.
```

```
Refatore src/api/client.ts para usar fetch com timeout e trate erro 401.
```

```
Explique o que mudou desde o último commit, em 5 tópicos.
```

## Limites atuais

- Um dono por instalação (sem multiusuário).
- Um harness ativo por vez.
- Sem streaming nem botão de cancelar (a resposta chega inteira).
- Sem aprovação por ferramenta: o harness usa as permissões dele.
- Memória/skills ficam dentro de cada harness, não são compartilhadas.
