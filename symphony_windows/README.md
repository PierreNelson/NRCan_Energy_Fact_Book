# Symphony (Windows, Python)

This folder is a **minimal Windows-native orchestrator** for this repo’s [`WORKFLOW.md`](../WORKFLOW.md). It follows the spirit of [OpenAI Symphony](https://github.com/openai/symphony) ([SPEC](https://github.com/openai/symphony/blob/main/SPEC.md)) without Elixir or WSL.

> **Prototype / trusted environment only** — same warning as upstream Symphony. Do not expose to untrusted input; protect `LINEAR_API_KEY`.

## What it does

1. Loads YAML front matter + **Liquid** prompt body from `WORKFLOW.md`.
2. Polls **Linear** GraphQL for issues in `active_states` for your `project_slug`.
3. Creates one **workspace folder per issue** under `workspace.root`, runs `hooks` via **PowerShell** (`-ExecutionPolicy Bypass -File` on a temp `.ps1`).
4. Spawns **Codex `app-server`** as a subprocess with **cwd = workspace** (see `codex.command` in YAML).

## Deviations from the Elixir reference

| Area | Elixir Symphony | This MVP |
|------|-----------------|----------|
| Shell for hooks | `bash -lc` | PowerShell script file, cwd = workspace |
| HTTP dashboard | Optional `--port` | Not implemented |
| `linear_graphql` tool injection | Yes | **CLI helper** — `linear_graphql_cli.py` + env `SYMPHONY_LINEAR_GRAPHQL_CLI`; prompt suffix tells Codex how to invoke it |
| Template engine | Liquid (strict) | [python-liquid](https://github.com/jg-rust/python-liquid) |

Codex **JSONL protocol** shapes may drift; the client is best-effort and may need updates when the CLI changes.

## Setup (dedicated venv recommended)

From the **repository root** (or this folder):

```powershell
cd path\to\NRCan_Energy_Factbook
python -m venv symphony_windows\.venv
.\symphony_windows\.venv\Scripts\Activate.ps1
pip install -r symphony_windows\requirements.txt
```

Set your API key (same session):

```powershell
$env:LINEAR_API_KEY = "lin_api_..."
```

Edit [`WORKFLOW.md`](../WORKFLOW.md):

- `tracker.project_slug` — from Linear project URL.
- `workspace.root` — **absolute** Windows path, e.g. `C:/Users/You/symphony-workspaces` (create the folder).
- `codex.command` — full path to `codex` if it is not on `PATH`.

## Run

```powershell
python -m symphony_windows --workflow .\WORKFLOW.md
```

Or use [`scripts/run-symphony.ps1`](../scripts/run-symphony.ps1) from the repo root.

- `--log-level DEBUG` for verbose logs.
- Workflow file is reloaded when its **modification time** changes (checked each poll interval).

## Dependencies

See [`requirements.txt`](requirements.txt): `httpx`, `PyYAML`, `python-liquid`, `watchdog` (optional for future use; polling uses mtime).

## Further reading

- **[`docs/SYMPHONY-BEGINNER-GUIDE.md`](../docs/SYMPHONY-BEGINNER-GUIDE.md)** — step-by-step.
- **[`SYMPHONY-SETUP.md`](../SYMPHONY-SETUP.md)** — shorter reference + optional Elixir/WSL appendix.
