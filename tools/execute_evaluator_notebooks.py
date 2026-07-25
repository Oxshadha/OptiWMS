from __future__ import annotations

import argparse
from pathlib import Path

import nbformat
from nbclient import NotebookClient


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_ROOTS = [
    ROOT / "Ai miroservices" / "modeling" / "project_operational_baseline",
    ROOT / "Ai miroservices" / "modeling" / "v8_controlled_synthetic_validation",
]


def execute(path: Path, timeout: int) -> None:
    notebook = nbformat.read(path, as_version=4)
    client = NotebookClient(
        notebook,
        timeout=timeout,
        kernel_name="optiwms-evaluator",
        resources={"metadata": {"path": str(path.parent)}},
        allow_errors=False,
    )
    client.execute(cwd=str(path.parent))
    nbformat.write(notebook, path)
    print(f"executed {path.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute and persist evaluator notebook outputs")
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--only", choices=["canonical", "v8", "all"], default="all")
    args = parser.parse_args()
    roots = NOTEBOOK_ROOTS
    if args.only == "canonical":
        roots = NOTEBOOK_ROOTS[:1]
    elif args.only == "v8":
        roots = NOTEBOOK_ROOTS[1:]
    for root in roots:
        for path in sorted(root.glob("*.ipynb")):
            execute(path, args.timeout)


if __name__ == "__main__":
    main()
