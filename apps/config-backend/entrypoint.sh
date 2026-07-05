#!/bin/bash
set -e

# Run database migrations on startup (SQLite is safe for this)
python manage.py migrate --noinput 2>/dev/null || true

# Start gunicorn
exec gunicorn dj_wx.wsgi:application \
    --bind 0.0.0.0:8081 \
    --workers 4 \
    --threads 2 \
    --timeout 120
