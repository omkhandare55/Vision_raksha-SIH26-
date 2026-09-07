# scripts/start_dev.ps1
# RetinAI — One-command local dev startup
# Usage: .\scripts\start_dev.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RetinAI — DR Screening System" -ForegroundColor Cyan
Write-Host "  SIH26038 | MathWorks | SIH 2026" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check prerequisites ───────────────────────────────────────
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

$pythonOk = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$nodeOk   = $null -ne (Get-Command node   -ErrorAction SilentlyContinue)

if (-not $pythonOk) { Write-Host "ERROR: Python not found. Install Python 3.11+" -ForegroundColor Red; exit 1 }
if (-not $nodeOk)   { Write-Host "ERROR: Node.js not found. Install Node 18+"    -ForegroundColor Red; exit 1 }

Write-Host "  Python: $(python --version)" -ForegroundColor Green
Write-Host "  Node  : $(node --version)"   -ForegroundColor Green

# ── Activate venv (create if missing) ────────────────────────
Write-Host ""
Write-Host "[2/4] Setting up Python environment..." -ForegroundColor Yellow

$backendPath = ".\backend"
$venvPath    = "$backendPath\venv"

if (-not (Test-Path $venvPath)) {
    Write-Host "  Creating virtual environment..."
    python -m venv $venvPath
}

Write-Host "  Installing backend dependencies..." -ForegroundColor Cyan
& "$venvPath\Scripts\pip.exe" install -r "$backendPath\requirements.txt" -q

# ── Copy .env if missing ──────────────────────────────────────
if (-not (Test-Path "$backendPath\.env")) {
    Copy-Item "$backendPath\.env.example" "$backendPath\.env"
    Write-Host "  Created .env from template" -ForegroundColor Yellow
}

# ── Install frontend deps ─────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Setting up frontend..." -ForegroundColor Yellow
$frontendPath = ".\frontend\dr-dashboard"

if (-not (Test-Path "$frontendPath\node_modules")) {
    Write-Host "  Installing npm packages..."
    Push-Location $frontendPath
    npm install --silent
    Pop-Location
}

# ── Start services ────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start backend
Write-Host "  Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Cyan
$backend = Start-Process -NoNewWindow -PassThru -FilePath "$venvPath\Scripts\uvicorn.exe" `
    -ArgumentList "main:app","--host","0.0.0.0","--port","8000","--reload" `
    -WorkingDirectory (Resolve-Path $backendPath)

Start-Sleep 3

# Start frontend
Write-Host "  Starting React frontend on http://localhost:5173 ..." -ForegroundColor Cyan
$frontend = Start-Process -NoNewWindow -PassThru -FilePath "cmd" `
    -ArgumentList "/c","npm","run","dev" `
    -WorkingDirectory (Resolve-Path $frontendPath)

# ── Ready ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  RetinAI is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend   : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs  : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health    : http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "  Model Status: EfficientNet-B5 Loaded and Active" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop both services." -ForegroundColor Gray
Write-Host ""

# Wait for Ctrl+C
try {
    while ($true) { Start-Sleep 1 }
} finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($backend  -and -not $backend.HasExited)  { $backend.Kill()  }
    if ($frontend -and -not $frontend.HasExited) { $frontend.Kill() }
    Write-Host "Done." -ForegroundColor Green
}
