from __future__ import annotations

import json
import time
from typing import Any

from app.config import CACHE_ENABLED, REDIS_URL

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None


class CacheService:
    def __init__(self) -> None:
        self._memory: dict[str, tuple[float, str]] = {}
        self._client = None
        if CACHE_ENABLED and REDIS_URL and redis is not None:
            try:
                self._client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
                self._client.ping()
            except Exception:
                self._client = None

    def get_json(self, key: str) -> dict[str, Any] | None:
        payload = self._get(key)
        if payload is None:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        self._set(key, json.dumps(value, ensure_ascii=False), ttl_seconds)

    def delete(self, key: str) -> None:
        if self._client is not None:
            try:
                self._client.delete(key)
                return
            except Exception:
                pass
        self._memory.pop(key, None)

    def _get(self, key: str) -> str | None:
        if not CACHE_ENABLED:
            return None
        if self._client is not None:
            try:
                return self._client.get(key)
            except Exception:
                pass

        item = self._memory.get(key)
        if item is None:
            return None
        expires_at, payload = item
        if expires_at < time.time():
            self._memory.pop(key, None)
            return None
        return payload

    def _set(self, key: str, value: str, ttl_seconds: int) -> None:
        if not CACHE_ENABLED:
            return
        if self._client is not None:
            try:
                self._client.setex(key, ttl_seconds, value)
                return
            except Exception:
                pass
        self._memory[key] = (time.time() + ttl_seconds, value)


cache_service = CacheService()
