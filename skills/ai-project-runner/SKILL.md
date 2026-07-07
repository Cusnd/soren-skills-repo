---
name: ai-project-runner
description: Prepare, adapt, launch, monitor, or debug AI training projects including LLM fine-tuning, RL/PPO, supervised PyTorch training, remote GPU runs, TensorBoard real-time monitoring, MLflow experiment tracking, checkpoints, artifacts, logs, and SSH/tmux training workflows. Use when Codex works on training scripts, configs, observability, experiment management, or remote long-running AI jobs.
---

# AI Project Runner

Use this skill to make AI training projects observable and repeatable. Default to: Codex edits code, SSH/tmux runs long training on a Linux GPU server, TensorBoard monitors live training curves, MLflow records experiments and artifacts, and `logs/latest.log` captures terminal output.

## Workflow

1. Inspect the project before changing it.
   - Prefer `scripts/inspect_ai_project.py <project>` for a read-only summary.
   - Identify train entrypoints, config files, dependency files, existing trackers, output directories, checkpoint code, and logging style.
2. Choose the narrow task:
   - **Bootstrap**: add a clean training layout, config pattern, logs, checkpoints, runs, and metrics directories.
   - **Instrument**: add TensorBoard and MLflow logging to an existing training loop.
   - **Launch**: generate SSH/tmux/TensorBoard/MLflow/tail commands for a remote run.
   - **Monitor**: check tmux sessions, GPU status, status files, and log tails without mutating the remote machine.
   - **Debug**: use logs, recent metrics, checkpoints, and reproducible configs before changing training code.
3. Keep long training out of notebooks by default. Use JupyterLab for data exploration, small batch debugging, plotting, and inspection.
4. Do not run remote writes, kill sessions, delete checkpoints, push code, deploy services, or expose ports publicly unless the user explicitly asks.

## Observability Split

- **TensorBoard**: first choice for real-time training monitoring. Use it for high-frequency `loss`, `reward`, `lr`, image, histogram, embedding, graph, and step-level signals.
- **MLflow**: first choice for experiment management. Use it for run metadata, params, tags, metrics snapshots, artifacts, checkpoints, model outputs, run comparison, and system metrics when enabled.
- **`logs/latest.log`**: source of truth for stdout, stderr, tqdm, stack traces, warnings, and dense debug prints.
- **tmux**: stable long-running process host. Attach only when interaction or live terminal control is needed.

## Reference Routing

Load only the reference needed for the current task:

- `references/remote-ssh-tmux.md`: remote launch, tmux sessions, log tailing, SSH tunnels, safe remote logging.
- `references/tensorboard-monitoring.md`: PyTorch `SummaryWriter`, scalar/image/histogram conventions, `runs/<run_name>`, TensorBoard server and tunnel.
- `references/mlflow-experiment-management.md`: MLflow server, tracking URI, run naming, params, artifacts, checkpoints, system metrics.
- `references/project-patterns.md`: recommended project layout and minimal metadata for reproducible AI runs.
- `references/domain-playbooks.md`: compact guidance for LLM fine-tuning, RL/PPO, and supervised training.

## Scripts

- `scripts/inspect_ai_project.py`: read-only project scanner. Use before planning or editing an unfamiliar AI repo.
- `scripts/render_remote_training_commands.py`: generate SSH/tmux/TensorBoard/MLflow/tail command templates without executing them.
- `scripts/check_remote_run.ps1`: read-only remote status helper using SSH from Windows PowerShell.

## Safety Rules

- Treat SSH credentials, API keys, W&B tokens, MLflow auth, Hugging Face tokens, cloud credentials, and `.env` files as secrets.
- Never print full `.env` files, tokens, private keys, cookies, or password-like command arguments.
- Prefer local-only service binding on remote hosts: `--host 127.0.0.1` for TensorBoard and MLflow, then use SSH tunnels.
- Before changing training code, preserve existing behavior and configs unless the user asks for a refactor.
- Before launching long jobs, ensure the command records run name, config path, git revision when available, log path, checkpoint path, and tracking URLs.
- For high-risk training changes such as distributed training, data migration, checkpoint format changes, or production model publishing, make a short plan first and keep changes backwards-compatible.
