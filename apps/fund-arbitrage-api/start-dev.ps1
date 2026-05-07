Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$env:PGHOST = 'localhost'
$env:PGPORT = '5432'
$env:PGUSER = 'admin'
$env:PGPASSWORD = 'admin123'
$env:PGDATABASE = 'fund_assistant_h5'
$env:PGADMIN_DATABASE = 'postgres'
$env:SYNC_ON_STARTUP = 'false'
$env:EMBEDDED_SYNC_ENABLED = 'false'

Set-Location $PSScriptRoot
py -3 main.py
