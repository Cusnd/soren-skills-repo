# TensorBoard Monitoring

Use TensorBoard as the default real-time training dashboard.

## PyTorch Pattern

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter(log_dir=f"runs/{run_name}")

for step, batch in enumerate(train_loader):
    loss = train_step(batch)

    if step % 10 == 0:
        writer.add_scalar("train/loss", float(loss.item()), step)
        writer.add_scalar("train/lr", optimizer.param_groups[0]["lr"], step)

writer.close()
```

Use a `runs/<run_name>` directory and keep `run_name` aligned with the log file, checkpoint directory, MLflow run, and config snapshot.

## Naming Conventions

Use stable names so experiments compare cleanly:

- `train/loss`, `train/lr`, `train/grad_norm`
- `val/loss`, `val/accuracy`, `val/f1`
- `eval/reward`, `eval/episode_length`, `eval/success_rate`
- `system/gpu_memory_allocated` only if collected by training code

For LLM work, add task-specific metrics such as `train/tokens_per_second`, `train/perplexity`, `eval/perplexity`, or `eval/rouge_l`.

For RL work, log both noisy and smoothed signals, such as `train/reward`, `train/reward_mean_100`, `train/policy_loss`, `train/value_loss`, and `train/entropy`.

## What To Log

- Scalars every 10 to 100 steps for ordinary training.
- Images or generated samples every evaluation interval, not every batch.
- Histograms for weights or gradients sparingly, usually once per epoch or during debugging.
- Embeddings only when the dataset size is bounded and the output is useful.

Avoid logging huge tensors, every batch image, or per-token debug values unless the user is diagnosing a specific issue.

## Remote Server

Run on the remote server:

```bash
cd ~/project
tensorboard --logdir runs --host 127.0.0.1 --port 6006
```

Tunnel from local:

```bash
ssh -L 6006:127.0.0.1:6006 user@server
```

Open locally:

```text
http://localhost:6006
```

If TensorBoard is blank, verify that event files exist under `runs/<run_name>` and that the training code flushes or closes the writer.
