@echo off
set PGHOST=localhost
set PGPORT=5432
set PGUSER=admin
set PGPASSWORD=admin123
set PGDATABASE=fund_assistant_h5
set PGADMIN_DATABASE=postgres
set SYNC_ON_STARTUP=false
set EMBEDDED_SYNC_ENABLED=false

cd /d "%~dp0"
py -3 main.py
