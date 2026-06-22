---
name: autodl-api
description: Use AutoDL API documentation and workflows for GPU cloud automation. Use when the user asks Codex to summarize, plan, script, integrate, or operate AutoDL APIs, including account balance, storage/NFS switching, Container Instance Pro lifecycle, private images, elastic deployments, replica scaling, container events, GPU stock, scheduling blacklist, or AutoDL Python/API client code.
---

# AutoDL API

## Operating Principles

Use the official AutoDL API docs as the source of truth when implementing or explaining AutoDL automation. Read `references/api-reference.md` before choosing endpoints, writing client code, or making operational recommendations.

Treat AutoDL API calls as potentially billable and state-changing. Do not create, power on, stop, release, delete, scale, blacklist, or otherwise mutate AutoDL resources unless the user explicitly asks for that action and the target resource is unambiguous.

Keep developer tokens out of source files, logs, command history snippets, and final answers. Prefer `AUTODL_TOKEN` or another environment variable. Never invent a token.

When the user asks for the latest endpoint behavior, pricing, GPU inventory semantics, or eligibility requirements, verify the current official docs before answering because these details can change.

## Workflow

1. Classify the request:
   - General account/storage: balance or NFS/file-storage switching.
   - Container Instance Pro: single GPU instance lifecycle, private image save/list, SSH/Jupyter/service connection info.
   - Elastic Deployment: multi-container scheduling, ReplicaSet/Job/Container deployment, scaling, events, container lists, GPU stock, blacklist, duration packages.
2. Read `references/api-reference.md` for the matching endpoint family.
3. Choose the least destructive API path that satisfies the user request.
4. For code, build a small client wrapper around `https://api.autodl.com`, `Authorization`, JSON bodies, HTTP status checks, and `code == "Success"` response validation.
5. For state-changing operations, require clear user intent, resource identifiers, and safe sequencing. For example, power off a Pro instance before release when following official guidance.
6. For summaries, include capability boundaries and authentication/verification requirements.

## Implementation Guidance

Use `requests.Session` for Python examples. Keep endpoint paths constants or clearly named helper functions. Convert documented money-like integer fields by dividing by `1000` when presenting yuan amounts.

Handle API errors by surfacing the whole returned payload, including `msg` and `request_id` when present. Do not silently retry operations that can create or delete resources.

Some official examples show request bodies for `GET` endpoints. If a library or proxy may strip GET bodies, prefer query params where the docs show them, or call out that the exact behavior should be tested against AutoDL.

When building automation, expose dry-run or print-only mode for create/release/delete/scale workflows whenever practical.

## Common User Requests

- "AutoDL API can do what?" Summarize the three families: general API, Container Instance Pro API, and Elastic Deployment API.
- "Write a script to start an AutoDL instance." Use Container Instance Pro `power_on`; require `instance_uuid`.
- "Create an AutoDL GPU instance." Use Container Instance Pro `create`; require GPU spec, image UUID, CUDA lower bound, GPU count, and disk expansion.
- "Scale my AutoDL deployment." Use Elastic Deployment `replica_num`; require `deployment_uuid` and replica count.
- "Find available 4090 stock." Use Elastic Deployment GPU stock endpoint; require region and optional CUDA/GPU filters.
- "Get SSH/Jupyter URL." Use Pro snapshot for instances or deployment container list for elastic containers.

