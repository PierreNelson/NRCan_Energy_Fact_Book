"""Codex app-server subprocess: line-delimited JSON-RPC-style protocol (MVP)."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import shlex
import shutil
from pathlib import Path
from typing import Any

from symphony_windows.config import CodexConfig

log = logging.getLogger(__name__)


def _format_codex_turn_failure(turn: dict[str, Any]) -> str:
    """Human-readable snippet for logs (turn object from turn/completed)."""
    err = turn.get("error")
    if isinstance(err, dict):
        parts = [str(err.get("message", "")).strip()]
        c = err.get("codexErrorInfo")
        if c is not None:
            parts.append(f"codexErrorInfo={c}")
        ad = err.get("additionalDetails")
        if ad is not None:
            parts.append(f"details={ad}")
        text = " | ".join(p for p in parts if p)
        if text:
            return text[:8000]
    try:
        return json.dumps(turn, ensure_ascii=False)[:8000]
    except (TypeError, ValueError):
        return repr(turn)[:8000]


def _split_codex_command(command: str) -> tuple[str, list[str]]:
    """Windows-safe split of codex.command into executable + args."""
    if os.name == "nt":
        parts = shlex.split(command, posix=False)
    else:
        parts = shlex.split(command)
    if not parts:
        return "codex", ["app-server"]
    return parts[0], parts[1:]


def _resolve_codex_argv(exe: str, args: list[str]) -> list[str]:
    """
    Build argv for create_subprocess_exec.

    On Windows, npm global installs `codex.cmd` (and sometimes an extensionless `codex` shell
    script). CreateProcess cannot run .cmd or shell scripts directly — use cmd.exe /c.
    """
    if os.name != "nt":
        resolved = shutil.which(exe) or exe
        return [resolved, *args]

    candidates: list[Path] = []
    p0 = Path(exe)
    if p0.is_file():
        candidates.append(p0.resolve())
    w = shutil.which(exe)
    if w:
        candidates.append(Path(w).resolve())
    wcmd = shutil.which(f"{exe}.cmd")
    if wcmd:
        candidates.append(Path(wcmd).resolve())

    chosen: Path | None = None
    for p in candidates:
        if not p.is_file():
            continue
        s = str(p).lower()
        if s.endswith((".exe", ".com", ".bat", ".cmd")):
            chosen = p
            break
        # e.g. .../npm/codex (no ext) — use npm's codex.cmd beside it
        sibling = p.parent / f"{p.name}.cmd"
        if sibling.is_file():
            chosen = sibling.resolve()
            break

    if chosen is None:
        raise FileNotFoundError(
            f"Cannot find Windows executable for {exe!r}. "
            "Install: npm i -g @openai/codex. "
            "Ensure AppData\\Roaming\\npm is on PATH, or set codex.command to the full path "
            "to codex.cmd plus args (see docs/SYMPHONY-BEGINNER-GUIDE.md)."
        )

    low = str(chosen).lower()
    if low.endswith((".cmd", ".bat")):
        return ["cmd.exe", "/c", str(chosen), *args]
    return [str(chosen), *args]


async def _drain_codex_stderr(stream: asyncio.StreamReader) -> None:
    """Read stderr so the child process never blocks on a full pipe (common on Windows)."""
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace").rstrip()
            if text:
                log.warning("codex stderr: %s", text[:4000])
    except Exception:
        log.debug("codex stderr drain ended", exc_info=True)


async def _read_json_line(
    stream: asyncio.StreamReader,
    timeout: float,
) -> dict[str, Any] | None:
    try:
        raw = await asyncio.wait_for(stream.readline(), timeout=timeout)
    except TimeoutError:
        # Codex may go many seconds without a full JSON line while streaming; outer loop uses turn_deadline.
        return None
    except asyncio.CancelledError:
        raise
    if not raw:
        return None
    line = raw.decode("utf-8", errors="replace").strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        log.debug("Non-JSON line from codex: %s", line[:200])
        return None


async def run_codex_session(
    workspace: Path,
    codex: CodexConfig,
    issue_identifier: str,
    issue_title: str,
    first_prompt: str,
    continuation_prompt: str,
    max_turns: int,
    refresh_issue_active: Any,
    *,
    linear_api_key: str = "",
    linear_endpoint: str = "",
) -> str:
    """
    One Codex app-server process: handshake + up to max_turns turns while issue_still_active is set.
    refresh_issue_active: async callable () -> bool — re-fetch Linear; if False, stop turns.
    Returns last status string.
    """
    exe, args = _split_codex_command(codex.command)
    argv = _resolve_codex_argv(exe, args)
    read_to = codex.read_timeout_ms / 1000.0
    turn_to = codex.turn_timeout_ms / 1000.0

    log.info("Starting Codex: %s in %s", argv, workspace)

    env = os.environ.copy()
    helper = Path(__file__).resolve().parent / "linear_graphql_cli.py"
    env["SYMPHONY_LINEAR_GRAPHQL_CLI"] = str(helper)
    # Ensure Codex inherits the same key Symphony uses (WORKFLOW-resolved or env).
    key = (linear_api_key or env.get("LINEAR_API_KEY", "")).strip()
    if key:
        env["LINEAR_API_KEY"] = key
    ep = (linear_endpoint or "").strip()
    if ep:
        env["LINEAR_GRAPHQL_ENDPOINT"] = ep.rstrip("/")

    proc = await asyncio.create_subprocess_exec(
        *argv,
        cwd=str(workspace),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=10 * 1024 * 1024,
        env=env,
    )
    assert proc.stdin and proc.stdout
    assert proc.stderr is not None
    stderr_task = asyncio.create_task(_drain_codex_stderr(proc.stderr))

    msg_id = 0

    def next_id() -> int:
        nonlocal msg_id
        msg_id += 1
        return msg_id

    async def send(obj: dict[str, Any]) -> None:
        line = json.dumps(obj, ensure_ascii=False) + "\n"
        proc.stdin.write(line.encode("utf-8"))
        await proc.stdin.drain()

    async def wait_for_id(want_id: int) -> dict[str, Any]:
        deadline = asyncio.get_event_loop().time() + turn_to
        while True:
            if proc.returncode is not None:
                raise RuntimeError(
                    f"Codex process exited before replying (exit code {proc.returncode}). "
                    "Run with --log-level DEBUG to see codex stderr lines."
                )
            remaining = max(0.1, deadline - asyncio.get_event_loop().time())
            msg = await _read_json_line(proc.stdout, min(read_to, remaining))
            if msg is None:
                if proc.returncode is not None:
                    raise RuntimeError(
                        f"Codex process exited while waiting for reply (exit code {proc.returncode})"
                    )
                if asyncio.get_event_loop().time() >= deadline:
                    raise TimeoutError("Codex response timeout")
                continue
            if msg.get("method") == "notifications/message":
                continue
            if "id" in msg and msg["id"] == want_id:
                if "error" in msg:
                    raise RuntimeError(f"Codex error: {msg['error']}")
                return msg
            # Some servers send result on different shape
            if "result" in msg and msg.get("id") == want_id:
                return msg

    try:
        return await _run_codex_session_body(
            proc,
            read_to,
            turn_to,
            next_id,
            send,
            wait_for_id,
            codex,
            workspace,
            issue_identifier,
            issue_title,
            first_prompt,
            continuation_prompt,
            max_turns,
            refresh_issue_active,
        )
    finally:
        with contextlib.suppress(ProcessLookupError, asyncio.TimeoutError):
            if proc.returncode is None:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=5)
        with contextlib.suppress(asyncio.TimeoutError, Exception):
            await asyncio.wait_for(stderr_task, timeout=5)


async def _run_codex_session_body(
    proc: asyncio.subprocess.Process,
    read_to: float,
    turn_to: float,
    next_id: Any,
    send: Any,
    wait_for_id: Any,
    codex: CodexConfig,
    workspace: Path,
    issue_identifier: str,
    issue_title: str,
    first_prompt: str,
    continuation_prompt: str,
    max_turns: int,
    refresh_issue_active: Any,
) -> str:
    """Handshake + turn loop (stderr is drained by caller)."""
    # initialize
    i1 = next_id()
    await send(
        {
            "id": i1,
            "method": "initialize",
            "params": {
                "clientInfo": {"name": "symphony_windows", "version": "0.1"},
                "capabilities": {},
            },
        }
    )
    await wait_for_id(i1)
    await send({"method": "initialized", "params": {}})
    log.info("Codex app-server initialized for %s", issue_identifier)

    approval = codex.approval_policy
    if approval is None:
        approval = "never"
    if isinstance(approval, dict):
        approval = "never"

    sandbox = codex.thread_sandbox or "workspace-write"
    cwd = str(workspace.resolve())

    i2 = next_id()
    await send(
        {
            "id": i2,
            "method": "thread/start",
            "params": {
                "approvalPolicy": approval,
                "sandbox": sandbox,
                "cwd": cwd,
            },
        }
    )
    tresp = await wait_for_id(i2)
    result = tresp.get("result") or {}
    thread = result.get("thread") or result
    thread_id = thread.get("id") if isinstance(thread, dict) else result.get("threadId")
    if not thread_id:
        thread_id = result.get("id")
    if not thread_id:
        raise RuntimeError(f"Could not parse thread id from {tresp!r}")

    tid = str(thread_id)
    log.info(
        "Codex thread ready for %s (thread_id=%s%s)",
        issue_identifier,
        tid[:12],
        "…" if len(tid) > 12 else "",
    )

    turn_policy = codex.turn_sandbox_policy or {"type": "workspaceWrite"}

    for turn_num in range(1, max_turns + 1):
        if not await refresh_issue_active():
            log.info(
                "Codex: issue no longer in tracker active_states (Linear refreshed); "
                "stopping before turn %s (no further turns this session)",
                turn_num,
            )
            break

        text = first_prompt if turn_num == 1 else continuation_prompt
        i3 = next_id()
        await send(
            {
                "id": i3,
                "method": "turn/start",
                "params": {
                    "threadId": thread_id,
                    "input": [{"type": "text", "text": text}],
                    "cwd": cwd,
                    "title": f"{issue_identifier}: {issue_title}"[:500],
                    "approvalPolicy": approval,
                    "sandboxPolicy": turn_policy,
                },
            }
        )
        log.info(
            "Codex turn %s/%s started for %s (waiting for completion; no further turn logs until this finishes)",
            turn_num,
            max_turns,
            issue_identifier,
        )

        # turn/start returns a JSON-RPC result immediately (initial turn snapshot).
        # Real work finishes when the server emits turn/completed (see OpenAI app-server docs).
        loop = asyncio.get_event_loop()
        turn_deadline = loop.time() + turn_to
        last_heartbeat = loop.time()
        heartbeat_s = 45.0
        while True:
            rem = max(0.1, turn_deadline - loop.time())
            msg = await _read_json_line(proc.stdout, min(read_to, rem))
            now = loop.time()
            if msg is None:
                if proc.returncode is not None:
                    proc.terminate()
                    return f"codex_exited:{proc.returncode}"
                if now >= turn_deadline:
                    proc.terminate()
                    return "turn_timeout"
                if now - last_heartbeat >= heartbeat_s:
                    log.info(
                        "Codex turn %s/%s still in progress for %s (Codex is working; large turns stay silent on stdout)",
                        turn_num,
                        max_turns,
                        issue_identifier,
                    )
                    last_heartbeat = now
                continue
            last_heartbeat = now
            m = msg.get("method", "")
            if m == "notifications/message":
                params = msg.get("params") or msg.get("result") or {}
                try:
                    snippet = json.dumps(params, ensure_ascii=False)[:500]
                except (TypeError, ValueError):
                    snippet = repr(params)[:500]
                log.debug("codex notification: %s", snippet)
                continue
            if m == "turn/completed" or m == "turn/done":
                params = msg.get("params") or {}
                turn = params.get("turn") or {}
                st = str(turn.get("status", "completed")).lower()
                if st == "failed":
                    detail = _format_codex_turn_failure(turn)
                    log.error(
                        "Codex turn/completed status=failed for %s. %s",
                        issue_identifier,
                        detail or "(no error payload on turn)",
                    )
                    proc.terminate()
                    return "turn_failed:failed"
                if st == "interrupted":
                    return "interrupted"
                break
            if m in ("turn/failed", "turn/cancelled", "turn/error"):
                proc.terminate()
                return f"turn_failed:{m}"
            if msg.get("id") == i3:
                if "error" in msg:
                    proc.terminate()
                    return f"turn_failed:{msg.get('error')}"
                # Ack for turn/start — not the end of the turn; keep reading.
                if "result" in msg:
                    continue
        log.info(
            "Codex turn %s/%s completed for %s",
            turn_num,
            max_turns,
            issue_identifier,
        )
        if turn_num >= max_turns:
            break

    return "completed"
