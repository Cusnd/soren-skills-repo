# Project Patterns

Prefer a script-and-config project for repeatable training.

## Recommended Layout

```text
project/
  train.py
  configs/
  src/
  scripts/
  logs/
  runs/
  checkpoints/
  metrics/
```

`train.py` should accept at least:

- config path
- run name
- output root or checkpoint directory
- resume checkpoint when supported
- output root or metrics path when supported

## Minimal Run Metadata

Each run should preserve:

- run name
- start time
- training command
- config snapshot
- git commit and dirty state when available
- package/environment summary when practical
- TensorBoard run directory
- TensorBoard URL
- checkpoint directory
- log file path
- metrics JSONL path when used

## Output Rules

- Keep TensorBoard event files under `runs/<run_name>`.
- Keep checkpoints under `checkpoints/<run_name>`.
- Keep terminal logs under `logs/<run_name>.log`.
- Keep machine-readable metrics under `metrics/<run_name>.jsonl` when the project already uses JSONL or needs offline analysis.
- Keep `logs/latest.log` pointing at the most recent run log.

## Config Rules

Prefer checked-in YAML/TOML/JSON configs for stable experiments. Do not hide important hyperparameters only in shell history. For one-off overrides, record them in the run log, config snapshot, status file, or metrics JSONL metadata.

## Dependency Rules

Use the project's own environment for training and tests. Do not install training dependencies into Codex's utility environment unless the task is only inspecting files or generating commands.
