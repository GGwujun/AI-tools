# Dev launch script for config-backend (Django).
# Usage: run  .\dev.ps1  from this project's directory.
# Calls the venv python directly, no manual activation needed.

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $AppRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $VenvPython)) {
    Write-Host "venv not found, creating .venv ..." -ForegroundColor Yellow
    python -m venv (Join-Path $AppRoot '.venv')
    & $VenvPython -m pip install django==3.2.23 djangorestframework==3.14.0 PyMySQL==1.1.1 requests==2.31.0 pytz==2024.2 uvicorn==0.22.0
}

# Default to SQLite for local dev so MySQL isn't required.
# To use MySQL instead, clear this env var and set the CONFIG_BACKEND_DB_* vars.
if (-not $env:CONFIG_BACKEND_USE_SQLITE) { $env:CONFIG_BACKEND_USE_SQLITE = '1' }

Write-Host "Starting config-backend (Django runserver) -> http://localhost:8000" -ForegroundColor Cyan
& $VenvPython (Join-Path $AppRoot 'manage.py') runserver 0.0.0.0:8000
