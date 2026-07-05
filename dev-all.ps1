# Start both backends (config-backend + crawler-api) at once.
# Usage: run  .\dev-all.ps1  from the repo root.
# Each service launches in its own PowerShell window so they don't interfere.

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$configBackend = Join-Path $RepoRoot 'apps\config-backend\dev.ps1'
$crawlerApi    = Join-Path $RepoRoot 'apps\crawler-api\dev.ps1'

foreach ($script in @($configBackend, $crawlerApi)) {
    if (-not (Test-Path $script)) {
        Write-Host "Missing launch script: $script" -ForegroundColor Red
        exit 1
    }
}

# Use powershell.exe for older Windows PowerShell; switch to pwsh if you have PS7+.
$PsExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

Write-Host "Launching both backends in separate windows ..." -ForegroundColor Cyan
Start-Process $PsExe -ArgumentList "-NoExit", "-File", $configBackend
Start-Process $PsExe -ArgumentList "-NoExit", "-File", $crawlerApi
Write-Host "Started:" -ForegroundColor Green
Write-Host "  config-backend -> http://localhost:8000  (admin: /admin/)"
Write-Host "  crawler-api    -> http://localhost:8091  (docs:  /docs)"
Write-Host "Close the corresponding window to stop a service."
