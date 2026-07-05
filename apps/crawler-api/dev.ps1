# Dev launch script for crawler-api (FastAPI).
# Usage: run  .\dev.ps1  from this project's directory.
# Calls the venv python directly, no manual activation needed.

$ErrorActionPreference = 'Stop'
$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $AppRoot 'venv\Scripts\python.exe'

if (-not (Test-Path $VenvPython)) {
    Write-Host "venv not found. Create it first:  python -m venv venv  then  pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}

Write-Host "Starting crawler-api (FastAPI/uvicorn) -> http://localhost:8091  (docs: /docs)" -ForegroundColor Cyan
& $VenvPython (Join-Path $AppRoot 'start.py')
