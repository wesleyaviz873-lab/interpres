# Túnel: usar no celular ou fora de casa

O Interpres fica em `127.0.0.1` (só na sua máquina). Para acessar do celular ou de
outro lugar, use um túnel. Ele cria uma URL pública que encaminha para a sua
instalação.

> Antes de expor, defina uma senha forte e, se possível, ligue 2FA em
> Configurações → Segurança. A URL pública fica acessível para quem tiver o link.

## Opção 1 — Cloudflare rápido (sem conta)

1. Abra **Configurações → Túnel**.
2. Escolha **Cloudflare rápido (sem conta)**.
3. Clique em **Iniciar**.
4. Copie a URL `https://....trycloudflare.com` e abra no celular.

Vantagens: não precisa de conta. Desvantagem: a URL muda quando o túnel reinicia.

## Opção 2 — Cloudflare com token (URL estável)

1. Crie um túnel no painel da Cloudflare (Zero Trust → Networks → Tunnels).
2. Copie o **token** do túnel.
3. No Interpres: **Configurações → Túnel**, escolha **Cloudflare com token** e
   cole o token.
4. Inicie e copie a URL configurada no painel.

Vantagens: URL fixa e domínio próprio. Requer conta Cloudflare.

## Opção 3 — ngrok

1. Crie uma conta em <https://ngrok.com> e copie o authtoken.
2. No Interpres: **Configurações → Túnel**, escolha **ngrok**, cole o token.
3. Inicie e abra a URL mostrada.

Vantagem: simples. Desvantagem: plano gratuito tem limites e aviso de domínio.

## Segurança ao expor

- Use senha longa e única para o dono.
- Ligue 2FA.
- Não compartilhe a URL publicamente.
- Encerre o túnel quando não estiver usando.
- Em produção de verdade, prefira Cloudflare Access (OIDC) ou uma VPN.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| URL abre mas não conecta | confirme que a API está rodando e o túnel aponta para a porta certa |
| "Tunnel not found" no Cloudflare com token | token inválido ou túnel não criado no painel |
| ngrok pede autenticação | falta o authtoken em Configurações → Túnel |
| Sessão cai ao trocar de rede | normal: o cookie vale para o domínio do túnel |

## Variáveis úteis

No `.env`:

```env
APP_URL=https://seu-dominio-ou-tunel
CLOUDFLARE_TUNNEL_TOKEN=opcional
```

`APP_URL` em `https://` faz o cookie de sessão virar `Secure`.

## Túnel nomeado (URL fixa)

Se você já tem um túnel da Cloudflare criado no painel e um `config.yml` em
`~/.cloudflared`, aponte o hostname para `http://localhost:8010` e deixe o
`cloudflared tunnel run` rodando. A URL (`https://seu-dominio`) nunca muda.

Não rode o túnel rápido em paralelo com o nomeado: use um ou outro.

Se o hostname estiver protegido por **Cloudflare Access**, você verá a tela de
login do Access antes da tela de login do Interpres. É esperado: são duas camadas.