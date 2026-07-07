#!/usr/bin/env python3
"""Render remote SSH/tmux/TensorBoard command templates."""

from __future__ import annotations

import argparse
import json
import re
import shlex


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return cleaned.strip("._-") or "ai_run"


def q(value: str) -> str:
    return shlex.quote(value)


def q_remote_path(value: str) -> str:
    if value == "~":
        return "~"
    if value.startswith("~/"):
        rest = value[2:]
        return "~" if not rest else "~/" + q(rest)
    return q(value)


def build(args: argparse.Namespace) -> dict:
    run_name = safe_name(args.run_name)
    session = safe_name(args.tmux_session or f"train_{run_name}")
    remote_project = args.remote_project.rstrip("/")
    log_path = f"logs/{run_name}.log"
    checkpoint_dir = f"checkpoints/{run_name}"
    metrics_path = f"metrics/{run_name}.jsonl"
    tensorboard_url = f"http://localhost:{args.tensorboard_port}"

    remote_prepare = [
        f"cd {q_remote_path(remote_project)}",
        "mkdir -p logs runs checkpoints metrics",
        f"export RUN_NAME={q(run_name)}",
        f"export CHECKPOINT_DIR={q(checkpoint_dir)}",
        f"export METRICS_PATH={q(metrics_path)}",
        f"ln -sfn {q(f'{run_name}.log')} logs/latest.log",
    ]

    tensorboard_server = (
        f"cd {q_remote_path(remote_project)} && "
        f"tensorboard --logdir runs --host 127.0.0.1 "
        f"--port {args.tensorboard_port} --reload_interval {args.tensorboard_reload_interval}"
    )
    train_inside_tmux = (
        "set -o pipefail\n"
        + "\n".join(remote_prepare)
        + "\n"
        + f"{args.train_command} 2>&1 | tee {q(log_path)}"
    )

    return {
        "run_name": run_name,
        "tmux_session": session,
        "remote_project": remote_project,
        "log_path": log_path,
        "latest_log": "logs/latest.log",
        "checkpoint_dir": checkpoint_dir,
        "metrics_path": metrics_path,
        "tensorboard": {
            "remote_command": tensorboard_server,
            "local_tunnel": f"ssh -L {args.tensorboard_port}:127.0.0.1:{args.tensorboard_port} {args.ssh_target}",
            "local_url": tensorboard_url,
            "reload_interval_seconds": args.tensorboard_reload_interval,
        },
        "training": {
            "start_tmux": f"ssh {args.ssh_target} {q(f'tmux new-session -s {session}')}",
            "commands_inside_tmux": train_inside_tmux,
            "attach": f"ssh -t {args.ssh_target} {q(f'tmux attach-session -t {session}')}",
            "tail_log": f"ssh {args.ssh_target} {q(f'tail -f {q_remote_path(remote_project)}/logs/latest.log')}",
        },
        "notes": [
            "Start TensorBoard in its own tmux session or service window before training.",
            "Paste commands_inside_tmux after creating or attaching to the training tmux session.",
            "Keep TensorBoard bound to 127.0.0.1 on the remote host and use an SSH tunnel locally.",
            "Use SummaryWriter flush_secs=5 and writer.flush() after important logging intervals for near-real-time charts.",
        ],
    }


def print_markdown(commands: dict) -> None:
    print(f"# Remote Training Commands: {commands['run_name']}")
    print()
    print("## Start TensorBoard on remote")
    print("```bash")
    print(commands["tensorboard"]["remote_command"])
    print("```")
    print()
    print("## Open local tunnel")
    print("```powershell")
    print(commands["tensorboard"]["local_tunnel"])
    print("```")
    print()
    print(f"TensorBoard: {commands['tensorboard']['local_url']}")
    print()
    print("## Start training tmux")
    print("```powershell")
    print(commands["training"]["start_tmux"])
    print("```")
    print()
    print("Paste inside tmux:")
    print("```bash")
    print(commands["training"]["commands_inside_tmux"])
    print("```")
    print()
    print("## Monitor")
    print("```powershell")
    print(commands["training"]["tail_log"])
    print(commands["training"]["attach"])
    print("```")
    print()
    print("## Notes")
    for note in commands["notes"]:
        print(f"- {note}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate remote AI training command templates.")
    parser.add_argument("--ssh-target", required=True, help="SSH target, e.g. user@server or alias.")
    parser.add_argument("--remote-project", required=True, help="Remote project directory.")
    parser.add_argument("--run-name", required=True, help="Run name.")
    parser.add_argument("--train-command", required=True, help="Training command to run inside the remote project.")
    parser.add_argument("--tmux-session", help="Optional tmux session name.")
    parser.add_argument("--tensorboard-port", type=int, default=6006)
    parser.add_argument("--tensorboard-reload-interval", type=int, default=5)
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    args = parser.parse_args()

    commands = build(args)
    if args.format == "json":
        print(json.dumps(commands, indent=2, sort_keys=True))
    else:
        print_markdown(commands)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
