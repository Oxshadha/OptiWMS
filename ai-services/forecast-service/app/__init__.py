"""Compatibility shim for the hyphenated forecast-service tree.

The CI tests live under `ai-services/forecast-service/tests`, but the real
application package is maintained under `ai_services/forecast-service/app`.
Extending `__path__` lets imports like `app.core.config` resolve to the source
tree without duplicating the whole package.
"""

from __future__ import annotations

from pathlib import Path

_current_app_dir = Path(__file__).resolve().parent
_source_app_dir = _current_app_dir.parents[2] / "ai_services" / "forecast-service" / "app"

__path__ = [str(_current_app_dir)]
if _source_app_dir.exists():
    __path__.append(str(_source_app_dir))