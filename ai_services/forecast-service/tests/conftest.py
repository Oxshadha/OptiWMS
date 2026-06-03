from __future__ import annotations

import sys
from pathlib import Path


_tests_dir = Path(__file__).resolve().parent
_source_service_dir = _tests_dir.parents[2] / "ai_services" / "forecast-service"

if _source_service_dir.exists():
    sys.path.insert(0, str(_source_service_dir))