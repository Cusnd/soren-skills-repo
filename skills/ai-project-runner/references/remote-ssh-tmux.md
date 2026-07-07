# Remote SSH and tmux

Use SSH/tmux for stable remote training. Keep commands observable, resumable, and local-only for dashboards.

## Standard Remote Layout

Create or use these directories inside the remote project:

```bash
logs/
runs/
checkpoints/
metrics/
```

Maintain:

- `logs/<run_name>.log`: stdout/stderr for the run.
- `logs/latest.log`: symlink to the active or most recent run log.
- `status.md` or `state.json`: compact current phase, run name, command, start time, and dashboard ports.

## Launch Pattern

Prefer a named tmux session per run:

```bash
cd ~/project
export RUN_NAME="exp_$(date +%Y%m%d_%H%M%S)"
mkdir -p logs runs checkpoints metrics
ln -sfn "${RUN_NAME}.log" logs/latest.log
tmux new-session -s "train_${RUN_NAME}"
```

Inside tmux:

```bash
set -o pipefail
python train.py --config configs/train.yaml --run-name "$RUN_NAME" 2>&1 | tee "logs/${RUN_NAME}.log"
```

Detach with `Ctrl+b`, then `d`. Reattach with:

```bash
tmux attach-session -t "train_${RUN_NAME}"
```

## Local Monitoring Commands

From the local machine:

```bash
ssh user@server 'tail -f ~/project/logs/latest.log'
ssh user@server 'tmux list-sessions'
ssh user@server 'nvidia-smi'
```

For dashboards, bind on the remote loopback interface and tunnel:

```bash
ssh -L 6006:127.0.0.1:6006 user@server
```

## Remote Logging Rules

- Log the exact non-secret command before long setup or training starts.
- Redact tokens, API keys, passwords, private keys, cookies, and full `.env` values.
- Record command exit code and a short result summary.
- For training, mirror epoch/step, latest loss/reward/metric, checkpoint path, and dashboard URLs into `status.md` or `state.json` when practical.
- Do not kill tmux sessions, overwrite logs, or delete checkpoints unless the user explicitly asks.
