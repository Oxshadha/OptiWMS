#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import nbformat


def clean_notebook(path: Path) -> bool:
    nb = nbformat.read(path, as_version=4)
    changed = False

    for cell in nb.cells:
        if cell.get("cell_type") != "code":
            continue

        outputs = cell.get("outputs", [])
        new_outputs = []
        for out in outputs:
            otype = out.get("output_type")

            if otype == "stream":
                text = out.get("text", "")
                if isinstance(text, list):
                    text = "".join(text)
                # Keep short one-line streams, drop long logs.
                if len(text) <= 300 and "\n" not in text.strip("\n"):
                    new_outputs.append(out)
                else:
                    changed = True
                continue

            if otype in {"display_data", "execute_result"}:
                data = out.get("data", {})
                if "text/plain" in data:
                    txt = data["text/plain"]
                    if isinstance(txt, list):
                        txt = "".join(txt)
                    if len(txt) > 1200:
                        data["text/plain"] = txt[:1200] + "\n...[truncated]"
                        out["data"] = data
                        changed = True
                new_outputs.append(out)
                continue

            # Keep tracebacks/errors for debugging context.
            if otype == "error":
                new_outputs.append(out)
                continue

            new_outputs.append(out)

        if new_outputs != outputs:
            cell["outputs"] = new_outputs
            changed = True

    if changed:
        nbformat.write(nb, path)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean notebook outputs while preserving rich charts.")
    parser.add_argument("notebooks", nargs="+", help="Notebook paths")
    args = parser.parse_args()

    cleaned = 0
    for raw in args.notebooks:
        p = Path(raw)
        if not p.exists() or p.suffix != ".ipynb":
            continue
        if clean_notebook(p):
            cleaned += 1
            print(f"[cleaned] {p}")
    print(f"[done] cleaned_notebooks={cleaned}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

