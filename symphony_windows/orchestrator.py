"""Poll loop, dispatch, concurrency, reconciliation (MVP)."""

from __future__ import annotations

import asyncio
import logging
import symphony_windows
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from symphony_windows.codex_client import run_codex_session
from symphony_windows.config import RuntimeConfig
from symphony_windows.linear_client import LinearClient
from symphony_windows.workspace_manager import (
    ensure_workspace,
    remove_workspace,
    run_hook_windows,
    workspace_path,
)
from symphony_windows.workflow_loader import WorkflowDefinition, parse_workflow_file, reload_workflow

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

CONTINUATION_TEXT = (
    "Continue from the current workspace state. "
    "Follow the workflow instructions until the issue leaves an active state or you are blocked."
)


def _linear_graphql_prompt_suffix() -> str:
    """Appended to Codex prompts so the agent can call Linear without MCP (workpad, state, comments)."""
    helper = Path(symphony_windows.__file__).resolve().parent / "linear_graphql_cli.py"
    path = str(helper)
    return f"""

## Symphony bundled Linear GraphQL (`linear_graphql` replacement)

**Environment (inherited in Codex):** `LINEAR_API_KEY`, `SYMPHONY_LINEAR_GRAPHQL_CLI` (absolute path to `linear_graphql_cli.py`), optional `LINEAR_GRAPHQL_ENDPOINT`.

**How to call Linear:** run **the file** at `SYMPHONY_LINEAR_GRAPHQL_CLI` with **stdin JSON** (do **not** rely on `python -m symphony_windows...` from the issue clone — that package is not installed there).

- **Windows:** `python "%SYMPHONY_LINEAR_GRAPHQL_CLI%"` or `python "<paste path from env>"`
- **PowerShell:** `python $env:SYMPHONY_LINEAR_GRAPHQL_CLI`

**Stdin:** `{{"query": "<GraphQL string>", "variables": {{ ... }} }}`  
**Stdout:** Linear API JSON (`data` / `errors`). Non-zero exit = HTTP or GraphQL errors.

**Workpad (required early):** If status is **Todo**, use **`issueUpdate`** to **In Progress** (use your team’s exact state name), then **`commentCreate`** on this issue with body starting **`## Codex Workpad`** (markdown checklist/plan). Reuse **`commentUpdate`** on that comment id for all later updates — one workpad only.

**PowerShell sanity check:**

```powershell
@'
{{"query":"query Me {{ viewer {{ id }} }}","variables":{{}}}}
'@ | python "{path}"
```

Use **`commentCreate`**, **`commentUpdate`**, **`issueUpdate`**, issue search, etc. This satisfies the workflow’s Linear / `linear_graphql` requirement when MCP is not wired.
"""


@dataclass
class RunningEntry:
    issue_id: str
    identifier: str
    task: asyncio.Task[None]
    started_at: float


class Orchestrator:
    def __init__(self, workflow_path: Path) -> None:
        self.workflow_path = workflow_path
        self.workflow: WorkflowDefinition = parse_workflow_file(workflow_path)
        self.cfg: RuntimeConfig = self.workflow.config
        self.linear = LinearClient(self.cfg.tracker.endpoint, self.cfg.tracker.api_key)
        self.claimed: set[str] = set()
        self.running: dict[str, RunningEntry] = {}
        self._lock = asyncio.Lock()
        self._stop = asyncio.Event()
        try:
            self._workflow_mtime: float | None = workflow_path.stat().st_mtime
        except OSError:
            self._workflow_mtime = None

    def reload_workflow_if_changed(self) -> None:
        """Re-parse WORKFLOW.md when its mtime changes (cheap check each poll tick)."""
        try:
            m = self.workflow_path.stat().st_mtime
        except OSError:
            return
        if self._workflow_mtime is not None and m == self._workflow_mtime:
            return
        try:
            self.workflow = reload_workflow(self.workflow_path)
            self.cfg = self.workflow.config
            self._workflow_mtime = m
            log.info("Reloaded workflow from %s", self.workflow_path)
        except Exception as e:
            log.error("Workflow reload failed, keeping last good: %s", e)

    async def startup_terminal_cleanup(self) -> None:
        ids = await self.linear.fetch_terminal_issue_identifiers(
            self.cfg.tracker.project_slug,
            self.cfg.tracker.terminal_states,
        )
        for ident in ids:
            remove_workspace(self.cfg.workspace.root, ident, self.cfg.hooks)

    async def reconcile(self) -> None:
        if not self.running:
            return
        ids = list(self.running.keys())
        states = await self.linear.fetch_issue_states_by_ids(ids)
        term = {s.lower() for s in self.cfg.tracker.terminal_states}
        for iid, entry in list(self.running.items()):
            info = states.get(iid)
            if not info:
                continue
            if info.get("state", "").lower() in term:
                log.info("Issue %s terminal, stopping worker", entry.identifier)
                entry.task.cancel()
                try:
                    await entry.task
                except asyncio.CancelledError:
                    pass
                self.claimed.discard(iid)
                del self.running[iid]
                remove_workspace(self.cfg.workspace.root, entry.identifier, self.cfg.hooks)

    async def _issue_active(self, issue_id: str) -> bool:
        st = await self.linear.fetch_issue_states_by_ids([issue_id])
        info = st.get(issue_id)
        if not info:
            return False
        active = {s.lower() for s in self.cfg.tracker.active_states}
        return info.get("state", "").lower() in active

    async def _worker(self, issue: dict[str, Any], attempt: int | None) -> None:
        iid = issue["id"]
        ident = issue["identifier"]
        path = workspace_path(self.cfg.workspace.root, ident)

        try:
            path, _ = ensure_workspace(
                self.cfg.workspace.root,
                ident,
                self.cfg.hooks,
            )
            run_hook_windows(self.cfg.hooks.before_run, path, self.cfg.hooks.timeout_ms, "before_run")

            base_prompt = self.workflow.render_prompt(issue, attempt)
            linear_suffix = _linear_graphql_prompt_suffix()
            prompt = base_prompt + linear_suffix

            async def still_active() -> bool:
                return await self._issue_active(iid)

            status = await run_codex_session(
                path,
                self.cfg.codex,
                ident,
                issue.get("title") or "",
                prompt,
                CONTINUATION_TEXT + linear_suffix,
                self.cfg.agent.max_turns,
                still_active,
                linear_api_key=self.cfg.tracker.api_key,
                linear_endpoint=self.cfg.tracker.endpoint,
            )
            log.info("Worker finished for %s (codex status=%s)", ident, status)
        except asyncio.CancelledError:
            log.info("Worker cancelled for %s", ident)
            raise
        except Exception as e:
            log.exception("Worker failed %s: %s", ident, e)
        finally:
            try:
                run_hook_windows(self.cfg.hooks.after_run, path, self.cfg.hooks.timeout_ms, "after_run")
            except Exception:
                log.exception("after_run hook failed for %s", ident)
            async with self._lock:
                self.claimed.discard(iid)
                self.running.pop(iid, None)

    def _sort_candidates(self, issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
        def key(x: dict[str, Any]) -> tuple[int, str, str]:
            p = x.get("priority")
            pr = int(p) if p is not None else 99
            created = str(x.get("created_at") or "")
            return (pr, created, x.get("identifier") or "")

        return sorted(issues, key=key)

    async def tick(self) -> None:
        self.reload_workflow_if_changed()
        errs = self.cfg.validate()
        if errs:
            log.warning("Config invalid: %s", errs)
            return

        await self.reconcile()

        try:
            candidates = await self.linear.fetch_candidate_issues(
                self.cfg.tracker.project_slug,
                self.cfg.tracker.active_states,
            )
        except Exception as e:
            log.error("Linear fetch failed: %s", e)
            return

        candidates = self._sort_candidates(candidates)
        max_n = self.cfg.agent.max_concurrent_agents
        slots = max_n - len(self.running)
        if slots <= 0:
            return

        term = {s.lower() for s in self.cfg.tracker.terminal_states}
        for issue in candidates:
            if slots <= 0:
                break
            iid = issue["id"]
            if iid in self.claimed or iid in self.running:
                continue
            if (issue.get("state") or "").lower() == "todo":
                blocked = False
                for b in issue.get("blocked_by") or []:
                    bst = (b.get("state") or "").lower()
                    if bst and bst not in term:
                        blocked = True
                        break
                if blocked:
                    continue

            async with self._lock:
                if iid in self.claimed or iid in self.running:
                    continue
                self.claimed.add(iid)
                task = asyncio.create_task(self._worker(issue, None))
                self.running[iid] = RunningEntry(
                    issue_id=iid,
                    identifier=issue["identifier"],
                    task=task,
                    started_at=asyncio.get_event_loop().time(),
                )
                slots -= 1
                log.info("Dispatched %s", issue["identifier"])

    async def run_forever(self) -> None:
        await self.startup_terminal_cleanup()
        interval = max(1, self.cfg.polling.interval_ms) / 1000.0
        while not self._stop.is_set():
            try:
                await self.tick()
            except Exception:
                log.exception("tick error")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass

    def stop(self) -> None:
        self._stop.set()
