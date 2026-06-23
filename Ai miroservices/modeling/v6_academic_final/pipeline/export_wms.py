#!/usr/bin/env python3
"""Export WMS outbound backfill CSV for v6 training (Phase 4)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

from pipeline.data_loader import export_wms_from_csv, wms_data_ready

_V6_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize WMS/backfill CSV for v6 training")
    parser.add_argument("--config", default=str(_V6_ROOT / "pipeline" / "config.yaml"))
    parser.add_argument("--source-csv", required=True, help="Backfill or synthetic runtime history CSV")
    args = parser.parse_args()

    cfg = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    out = (_V6_ROOT / cfg["paths"]["wms_export_csv"]).resolve()
    export_wms_from_csv(Path(args.source_csv), out)

    ready, info = wms_data_ready(cfg)
    result = {"export_path": str(out), "wms_ready": ready, "wms_info": info}
    print(json.dumps(result, indent=2))
    return 0 if ready else 2


if __name__ == "__main__":
    raise SystemExit(main())
