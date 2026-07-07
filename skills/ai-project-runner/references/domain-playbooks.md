# Domain Playbooks

Use these compact defaults when instrumenting training projects.

## LLM Fine-Tuning

Track:

- `train/loss`, `train/lr`, `train/tokens_per_second`, `train/grad_norm`
- `eval/loss`, `eval/perplexity`
- task metrics such as exact match, F1, ROUGE, BLEU, win rate, or judge score when relevant

Preserve tokenizer/config files and the exact base model id. Be careful with checkpoint size; keep selected checkpoints under `checkpoints/<run_name>` and record metadata in the run log or `status.md`.

## RL and PPO

Track:

- `train/reward`, `train/reward_mean_100`, `eval/reward`
- `train/episode_length`, `eval/success_rate`
- `train/policy_loss`, `train/value_loss`, `train/entropy`, `train/kl`
- environment id, seed, rollout length, number of envs, gamma, lambda, clip range

RL curves are noisy. Prefer smoothing in TensorBoard and record evaluation episodes separately from training rewards.

## Supervised Training

Track:

- `train/loss`, `train/lr`
- `val/loss`, `val/accuracy`, `val/f1`, `val/auc` as appropriate
- confusion matrix, sample predictions, or error cases as artifacts when helpful

Checkpoint best model by validation metric and record the selection rule.

## Debug Signals

If training diverges, first inspect:

- recent `logs/latest.log`
- TensorBoard loss/lr/grad norm curves
- NaN/Inf warnings
- data batch shape and label distribution
- GPU memory and batch size
- resume checkpoint compatibility

Only then edit model, optimizer, scheduler, precision, or data code.
