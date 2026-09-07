# tests/conftest.py
import os
os.environ.setdefault("DATABASE_URL", "")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest
from fastapi.testclient import TestClient


class AuthenticatedClient:
    """Wrapper around TestClient that auto-injects Authorization header."""

    def __init__(self, base_client: TestClient, token: str):
        self._client = base_client
        self._headers = {"Authorization": f"Bearer {token}"}

    def _merge_headers(self, kwargs):
        headers = {**self._headers, **kwargs.pop("headers", {})}
        kwargs["headers"] = headers
        return kwargs

    def get(self, url, **kwargs):
        return self._client.get(url, **self._merge_headers(kwargs))

    def post(self, url, **kwargs):
        return self._client.post(url, **self._merge_headers(kwargs))

    def put(self, url, **kwargs):
        return self._client.put(url, **self._merge_headers(kwargs))

    def patch(self, url, **kwargs):
        return self._client.patch(url, **self._merge_headers(kwargs))

    def delete(self, url, **kwargs):
        return self._client.delete(url, **self._merge_headers(kwargs))


@pytest.fixture(scope="session")
def _base_client():
    """Raw TestClient without auth — used internally."""
    from main import app
    from ai.pipeline import init_pipeline
    init_pipeline(model_path="nonexistent.pth")   # forces demo mode
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def _admin_token(_base_client):
    """Get an admin JWT token for testing."""
    r = _base_client.post("/auth/login",
        json={"username": "admin", "password": "admin123"})
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def _doctor_token(_base_client):
    """Get a doctor JWT token for testing."""
    r = _base_client.post("/auth/login",
        json={"username": "doctor_demo", "password": "doctor123"})
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def client(_base_client, _doctor_token):
    """
    Session-scoped authenticated client.
    Uses doctor role (has access to all clinical endpoints).
    This replaces the old unauthenticated client fixture.
    """
    return AuthenticatedClient(_base_client, _doctor_token)


@pytest.fixture(scope="session")
def raw_client(_base_client):
    """Unauthenticated client for testing auth enforcement."""
    return _base_client
