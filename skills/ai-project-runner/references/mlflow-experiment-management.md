# MLflow Experiment Management

Use MLflow as the default experiment ledger, not as the terminal console.

## Remote Server

Run on the remote server:

```bash
cd ~/project
mlflow server \
  --backend-store-uri sqlite:///mlflow.db \
  --default-artifact-root ./mlruns \
  --host 127.0.0.1 \
  --port 5000
```

Tunnel from local:

```bash
ssh -L 5000:127.0.0.1:5000 user@server
```

Open locally:

```text
http://localhost:5000
```

## Training Code Pattern

```python
import mlflow

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("my-training-project")

with mlflow.start_run(run_name=run_name):
    mlflow.log_params({
        "lr": lr,
        "batch_size": batch_size,
        "model": model_name,
    })

    for step, batch in enumerate(train_loader):
        loss = train_step(batch)
        if step % 50 == 0:
            mlflow.log_metric("train_loss", float(loss.item()), step=step)
```

Use manual logging for custom PyTorch loops, RL loops, and LLM fine-tuning. Autologging can be useful for supported frameworks, but custom loops usually need explicit metrics.

## What MLflow Should Record

- Params: config values, model name, dataset id/path, seed, optimizer, scheduler, precision, batch size, sequence length.
- Tags: git commit, hostname, device type, task name, data version, code path, user-provided notes.
- Metrics: sampled training metrics, evaluation metrics, best metric, final metric.
- Artifacts: config snapshot, logs, tokenizer/config files, plots, evaluation reports, selected checkpoints.
- Models: final or best model only when size and storage policy allow it.

Do not log massive checkpoints every few steps unless the user asks and storage is planned.

## System Metrics

MLflow can record CPU, GPU, memory, network, and disk metrics when system metrics logging is enabled. Check that the remote environment has `psutil`; for NVIDIA GPU metrics, check `nvidia-ml-py`.

Use system metrics for dashboard context, but keep `nvidia-smi`, logs, and tmux available for operational debugging.

## Boundary

MLflow is good for quasi-real-time experiment curves and comparisons. It is not good for character-by-character stdout, tqdm animation, dense debug logs, or interactive control. Use `logs/latest.log` and tmux for those.
