"""Typed runtime config from WORKFLOW.md front matter."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


def _expand_env_in_str(value: str) -> str:
    """Expand $VAR and %VAR% style placeholders in path-like strings."""
    if not isinstance(value, str):
        return value

    def repl_dollar(m: re.Match) -> str:
        name = m.group(1) or m.group(2)
        return os.environ.get(name, "")

    # $VAR or ${VAR}
    out = re.sub(r"\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))", repl_dollar, value)
    # %VAR% (Windows)
    def repl_pct(m: re.Match) -> str:
        return os.environ.get(m.group(1), m.group(0))

    out = re.sub(r"%([A-Za-z_][A-Za-z0-9_]*)%", repl_pct, out)
    return out


def expand_workspace_root(raw: str) -> Path:
    """Expand ~, env vars, and return absolute Path."""
    s = _expand_env_in_str(raw.strip())
    if s.startswith("~"):
        s = str(Path.home()) + s[1:]
    p = Path(s).expanduser()
    if not p.is_absolute():
        p = Path.cwd() / p
    return p.resolve()


@dataclass
class TrackerConfig:
    kind: str = "linear"
    endpoint: str = "https://api.linear.app/graphql"
    api_key: str = ""
    project_slug: str = ""
    active_states: list[str] = field(default_factory=lambda: ["Todo", "In Progress"])
    terminal_states: list[str] = field(
        default_factory=lambda: ["Closed", "Cancelled", "Canceled", "Duplicate", "Done"]
    )


@dataclass
class PollingConfig:
    interval_ms: int = 30000


@dataclass
class WorkspaceConfig:
    root: Path = field(default_factory=lambda: Path.cwd() / "symphony_workspaces")


@dataclass
class HooksConfig:
    after_create: str | None = None
    before_run: str | None = None
    after_run: str | None = None
    before_remove: str | None = None
    timeout_ms: int = 60000


@dataclass
class AgentConfig:
    max_concurrent_agents: int = 10
    max_turns: int = 20


@dataclass
class CodexConfig:
    command: str = "codex app-server"
    approval_policy: Any = None
    thread_sandbox: str | None = None
    turn_sandbox_policy: dict[str, Any] | None = None
    turn_timeout_ms: int = 3_600_000
    read_timeout_ms: int = 5000
    stall_timeout_ms: int = 300_000


@dataclass
class RuntimeConfig:
    tracker: TrackerConfig
    polling: PollingConfig
    workspace: WorkspaceConfig
    hooks: HooksConfig
    agent: AgentConfig
    codex: CodexConfig

    @classmethod
    def from_front_matter(cls, data: dict[str, Any]) -> RuntimeConfig:
        t = data.get("tracker") or {}
        api_key = t.get("api_key") or "$LINEAR_API_KEY"
        api_key = _expand_env_in_str(api_key) if api_key.startswith("$") else api_key
        if api_key == "$LINEAR_API_KEY" or not api_key:
            api_key = os.environ.get("LINEAR_API_KEY", "")

        tracker = TrackerConfig(
            kind=str(t.get("kind", "linear")),
            endpoint=str(t.get("endpoint", "https://api.linear.app/graphql")),
            api_key=api_key,
            project_slug=str(t.get("project_slug", "")),
            active_states=list(t.get("active_states") or ["Todo", "In Progress"]),
            terminal_states=list(
                t.get("terminal_states")
                or ["Closed", "Cancelled", "Canceled", "Duplicate", "Done"]
            ),
        )

        p = data.get("polling") or {}
        polling = PollingConfig(interval_ms=int(p.get("interval_ms", 30000)))

        w = data.get("workspace") or {}
        root_raw = w.get("root", os.environ.get("SYMPHONY_WORKSPACE_ROOT", str(Path.cwd() / "symphony_workspaces")))
        workspace = WorkspaceConfig(root=expand_workspace_root(str(root_raw)))

        h = data.get("hooks") or {}
        hooks = HooksConfig(
            after_create=h.get("after_create"),
            before_run=h.get("before_run"),
            after_run=h.get("after_run"),
            before_remove=h.get("before_remove"),
            timeout_ms=int(h.get("timeout_ms", 60000)),
        )

        a = data.get("agent") or {}
        agent = AgentConfig(
            max_concurrent_agents=int(a.get("max_concurrent_agents", 10)),
            max_turns=int(a.get("max_turns", 20)),
        )

        c = data.get("codex") or {}
        codex = CodexConfig(
            command=str(c.get("command", "codex app-server")),
            approval_policy=c.get("approval_policy"),
            thread_sandbox=c.get("thread_sandbox"),
            turn_sandbox_policy=c.get("turn_sandbox_policy"),
            turn_timeout_ms=int(c.get("turn_timeout_ms", 3_600_000)),
            read_timeout_ms=int(c.get("read_timeout_ms", 5000)),
            stall_timeout_ms=int(c.get("stall_timeout_ms", 300_000)),
        )

        return cls(
            tracker=tracker,
            polling=polling,
            workspace=workspace,
            hooks=hooks,
            agent=agent,
            codex=codex,
        )

    def validate(self) -> list[str]:
        errors: list[str] = []
        if self.tracker.kind != "linear":
            errors.append(f"Unsupported tracker.kind: {self.tracker.kind}")
        if not self.tracker.api_key:
            errors.append("Missing LINEAR_API_KEY (or tracker.api_key in WORKFLOW.md)")
        if not self.tracker.project_slug or self.tracker.project_slug.startswith("REPLACE"):
            errors.append("Set tracker.project_slug in WORKFLOW.md to your Linear project slug")
        if not self.codex.command:
            errors.append("codex.command is empty")
        return errors
