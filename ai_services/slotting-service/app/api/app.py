"""
app/api/app.py — Legacy compatibility shim (no longer the uvicorn entry point).

The canonical entry point is now app/main.py:
    uvicorn app.main:app --host 0.0.0.0 --port 8093

This file is kept so that any direct imports from app.api.app continue to work,
but all application setup (CORS, routing, healthcheck) lives in app/main.py.
"""

# Re-export the app instance from the canonical entry point so that any code
# doing `from app.api.app import app` still gets the real application.
from app.main import app  # noqa: F401

__all__ = ["app"]