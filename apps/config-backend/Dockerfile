FROM python:3.11-slim

LABEL maintainer="GGwujun"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=dj_wx.settings

WORKDIR /app

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
    -r requirements-docker.txt

COPY . .

RUN python manage.py collectstatic --noinput 2>/dev/null || true

RUN chmod +x entrypoint.sh

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8081/ymq/')" || exit 1

CMD ["./entrypoint.sh"]
