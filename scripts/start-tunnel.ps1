# Starts the existing Cloudflare named tunnel (cloudflared) in the background.
# Safe to run many times: it does nothing when cloudflared is already running.

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$config = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
$binary = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source

if (-not $binary) {
    throw "cloudflared nao encontrado no PATH."
}
if (-not (Test-Path -LiteralPath $config)) {
    throw "Configuracao nao encontrada: $config"
}
if (Get-Process cloudflared -ErrorAction SilentlyContinue) {
    return
}

$logs = Join-Path $repo "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null
Start-Process -FilePath $binary `
    -ArgumentList "tunnel", "run" `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs "cloudflared.out.log") `
    -RedirectStandardError (Join-Path $logs "cloudflared.err.log") | Out-Null
