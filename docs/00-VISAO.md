# Visao

## O problema

Ferramentas de IA para desenvolvedores e criadores normalmente assumem um de dois
extremos:

1. Um site hospedado por terceiros, onde o usuario entrega chaves, arquivos e
   historico para outra empresa.
2. Um programa preso a uma maquina, sem acesso remoto seguro e sem continuidade
   quando o navegador fecha.

O Interpres existe para ocupar o meio: **um workspace de IA que o usuario hospeda,
controla e pode acessar de qualquer lugar, sem abrir a maquina para a internet.**

## Para quem

- Pessoas que usam varias LLMs e querem um unico lugar para conversar, comparar e
  executar tarefas.
- Pessoas que querem usar modelos locais (Ollama) junto com modelos de nuvem.
- Pessoas que querem um agente que leia e edite arquivos, rode comandos e opere o
  computador, mas com permissoes explicitas.
- Pessoas que nao querem depender de um SaaS para acessar o proprio historico.

## Principios

1. **O usuario e o dono.** Chaves, conversas, arquivos e logs ficam na instancia
   dele.
2. **A rede nao e a fronteira de seguranca.** Login, permissoes e isolamento
   existem dentro da aplicacao.
3. **O trabalho continua.** Fechar a janela nao cancela uma tarefa.
4. **Permissao explicita.** Ferramenta perigosa nao roda por padrao.
5. **Instalacao sem friccao.** Docker, um comando, um assistente de primeiro
   acesso.
6. **Uma conta de dono por instalacao.** Simples como o n8n, sem multi-tenant
   prematuro.
7. **Portabilidade.** Windows, Linux e macOS. O nucleo nao depende de caminhos
   fixos nem de um sistema operacional especifico.

## Pilares do produto

### 1. Workspace de conversa

Chat com multiplos provedores, modelos locais, anexos, markdown, blocos de codigo,
historico, busca e exportacao.

### 2. Motor de jobs

Toda tarefa longa roda no servidor como um job persistente. O cliente acompanha,
se reconecta e recebe o resultado mesmo tendo saido da janela.

### 3. Workspace de arquivos

Uma pasta explicita, com leitura, escrita, edicao, busca, diff, lixeira e
desfazer. Nunca o disco inteiro.

### 4. Ferramentas com permissoes

Um registro de ferramentas com manifesto de permissoes (`fs.read`, `fs.write`,
`shell`, `desktop`, `network`), aprovacao para acoes perigosas e log de auditoria.

### 5. Agente local

Um componente opcional que roda no computador do usuario, conecta para fora e
executa ferramentas locais. O hub nunca abre uma porta na maquina do usuario.

### 6. Operacao simples

Docker Compose, volumes claros, backup, restauracao, upgrade, reset de senha,
diagnostico e tunel opcional.

## O que o Interpres nao e

- Nao e um SaaS multi-tenant na v1.
- Nao e um provedor de modelos. Ele usa as chaves e os modelos do usuario.
- Nao e um ambiente de execucao sem supervisao. Acoes perigosas pedem permissao.
- Nao e uma copia do app pessoal atual. E uma nova fundacao, com a mesma alma.

## Criterios de sucesso da v1

- Uma pessoa consegue instalar com Docker em menos de 10 minutos.
- O primeiro acesso cria a conta de dono sem editar arquivos.
- O chat continua respondendo depois que o celular sai da janela.
- A IA so acessa o workspace configurado.
- Ferramentas perigosas ficam desligadas por padrao no modo servidor.
- O agente local conecta por pareamento e pode ser revogado.
- Existe documentacao suficiente para outra pessoa operar e contribuir.
