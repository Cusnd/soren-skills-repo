#!/usr/bin/env python3
"""Read-only AI training project inspector."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Iterable


NOISY_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".next",
    "target",
    ".cache",
    "coverage",
    "wandb",
    "mlruns",
    "runs",
    "logs",
    "checkpoints",
}

TRAIN_NAME_HINTS = (
    "train",
    "finetune",
    "fine_tune",
    "fine-tune",
    "fit",
    "ppo",
    "sft",
    "dpo",
    "pretrain",
)

CONFIG_SUFFIXES = {".yaml", ".yml", ".json", ".toml", ".ini"}
DEPENDENCY_NAMES = {
    "requirements.txt",
    "requirements-dev.txt",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "environment.yml",
    "environment.yaml",
    "conda.yml",
    "conda.yaml",
    "Pipfile",
    "poetry.lock",
    "uv.lock",
}

TRACKER_PATTERNS = {
    "tensorboard": ("SummaryWriter", "torch.utils.tensorboard", "tensorboardX", "tensorboard"),
    "mlflow": ("import mlflow", "mlflow.", "MLFLOW_"),
    "wandb": ("import wandb", "wandb.", "WANDB_"),
    "jsonl_metrics": ("metrics.jsonl", ".jsonl"),
}


def iter_files(root: Path, max_files: int) -> Iterable[Path]:
    seen = 0
    for current, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in NOISY_DIRS and not d.startswith(".ipynb_checkpoints")]
        for filename in filenames:
            if seen >= max_files:
                return
            path = Path(current) / filename
            if path.is_file():
                seen += 1
                yield path


def rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def read_small_text(path: Path, max_bytes: int) -> str:
    try:
        if path.stat().st_size > max_bytes:
            with path.open("rb") as handle:
                return handle.read(max_bytes).decode("utf-8", errors="ignore")
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def classify(root: Path, files: list[Path], max_read_bytes: int) -> dict:
    train_entrypoints: list[str] = []
    configs: list[str] = []
    dependencies: list[str] = []
    notebooks: list[str] = []
    tracker_hits: dict[str, list[str]] = {name: [] for name in TRACKER_PATTERNS}

    for path in files:
        name_lower = path.name.lower()
        stem_lower = path.stem.lower()
        relative = rel(path, root)

        if path.suffix == ".py" and any(hint in stem_lower for hint in TRAIN_NAME_HINTS):
            train_entrypoints.append(relative)
        if path.suffix in CONFIG_SUFFIXES and (
            "config" in relative.lower()
            or "configs/" in relative.lower()
            or any(hint in stem_lower for hint in TRAIN_NAME_HINTS)
        ):
            configs.append(relative)
        if path.name in DEPENDENCY_NAMES:
            dependencies.append(relative)
        if path.suffix == ".ipynb":
            notebooks.append(relative)

        if path.suffix in {".py", ".ipynb", ".yaml", ".yml", ".json", ".toml", ".sh", ".ps1", ".md"}:
            text = read_small_text(path, max_read_bytes)
            if text:
                for tracker, patterns in TRACKER_PATTERNS.items():
                    if any(pattern in text for pattern in patterns):
                        tracker_hits[tracker].append(relative)

    existing_dirs = []
    for dirname in ("configs", "src", "scripts", "logs", "runs", "checkpoints", "metrics", "mlruns", "outputs"):
        if (root / dirname).is_dir():
            existing_dirs.append(dirname)

    missing_observability = []
    if not tracker_hits["tensorboard"]:
        missing_observability.append("tensorboard")
    if not tracker_hits["mlflow"]:
        missing_observability.append("mlflow")
    if "logs" not in existing_dirs:
        missing_observability.append("logs")
    if "runs" not in existing_dirs:
        missing_observability.append("runs")
    if "checkpoints" not in existing_dirs:
        missing_observability.append("checkpoints")

    return {
        "project_root": str(root),
        "train_entrypoints": sorted(set(train_entrypoints)),
        "config_files": sorted(set(configs)),
        "dependency_files": sorted(set(dependencies)),
        "notebooks": sorted(set(notebooks)),
        "existing_output_dirs": existing_dirs,
        "tracker_hits": {k: sorted(set(v)) for k, v in tracker_hits.items() if v},
        "missing_observability": missing_observability,
        "recommendations": recommendations(train_entrypoints, tracker_hits, existing_dirs),
    }


def recommendations(train_entrypoints: list[str], tracker_hits: dict[str, list[str]], existing_dirs: list[str]) -> list[str]:
    items = []
    if not train_entrypoints:
        items.append("Identify or create a script entrypoint such as train.py before planning remote launch commands.")
    if not tracker_hits["tensorboard"]:
        items.append("Add TensorBoard SummaryWriter logging for real-time training curves.")
    if not tracker_hits["mlflow"]:
        items.append("Add MLflow run metadata, params, sampled metrics, and artifact/checkpoint logging.")
    for dirname in ("logs", "runs", "checkpoints"):
        if dirname not in existing_dirs:
            items.append(f"Create or configure a {dirname}/ output directory.")
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only AI training project inspector.")
    parser.add_argument("project", nargs="?", default=".", help="Project directory to inspect.")
    parser.add_argument("--max-files", type=int, default=2000, help="Maximum files to inspect.")
    parser.add_argument("--max-read-bytes", type=int, default=200_000, help="Maximum bytes to read per text file.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON.")
    args = parser.parse_args()

    root = Path(args.project).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Not a directory: {root}")

    files = list(iter_files(root, args.max_files))
    result = classify(root, files, args.max_read_bytes)
    result["files_scanned"] = len(files)
    result["truncated"] = len(files) >= args.max_files
    print(json.dumps(result, indent=2 if args.pretty else None, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
