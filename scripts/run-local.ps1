# Starts the Interpres API in local mode and opens it in the browser.
# Safe to run many times: it only starts the server when port 8010 is free.

param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$api = Join-Path $repo "apps\api"
$web = Join-Path $repo "apps\web"
$envFile = Join-Path $api ".env"
$python = Join-Path $api ".venv\Scripts\python.exe"
$port = 8010
$url = "http://127.0.0.1:$port"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Python do venv nao encontrado em $python. Rode a instalacao descrita em docs/INSTALACAO.md."
}

if (-not (Test-Path -LiteralPath $envFile)) {
    $alphabet = "0123456789abcdef"
    $secret = -join (1..64 | ForEach-Object { $alphabet[(Get-Random -Maximum 16)] })
    @"
APP_ENV=development
APP_SECRET=$secret
APP_MODE=local
APP_URL=$url
DATABASE_URL=sqlite:///$($api.Replace('\', '/'))/data/interpres.db
DATA_DIR=$api\data
WORKSPACE_DIR=$api\workspace
WEB_DIST_DIR=$web\dist
OLLAMA_BASE_URL=http://localhost:11434
"@ | Set-Content -LiteralPath $envFile -Encoding utf8
    Write-Host "Criei $envFile com um APP_SECRET novo."
}

$dist = Join-Path $web "dist"
if (-not (Test-Path -LiteralPath (Join-Path $dist "index.html"))) {
    Write-Host "Compilando o frontend..."
    Push-Location $web
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $web "node_modules"))) {
            npm install
        }
        npm run build
    }
    finally {
        Pop-Location
    }
}

if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
    $logs = Join-Path $repo "logs"
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$port" `
        -WorkingDirectory $api `
        -RedirectStandardOutput (Join-Path $logs "api.out.log") `
        -RedirectStandardError (Join-Path $logs "api.err.log") `
        -WindowStyle Hidden | Out-Null

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 2
            if ($health.StatusCode -eq 200) { break }
        }
        catch {
            continue
        }
    }
}

if (-not $NoBrowser) {
    Start-Process $url
}
