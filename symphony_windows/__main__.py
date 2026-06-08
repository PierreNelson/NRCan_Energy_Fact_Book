"""CLI: python -m symphony_windows --workflow path/to/WORKFLOW.md"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from symphony_windows.orchestrator import Orchestrator

log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Windows-native Symphony MVP: Linear + per-issue workspaces + Codex app-server.",
    )
    parser.add_argument(
        "--workflow",
        type=Path,
        default=Path("WORKFLOW.md"),
        help="Absolute or relative path to WORKFLOW.md",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        help="DEBUG, INFO, WARNING, ERROR",
    )
    args = parser.parse_args()
    level = getattr(logging, args.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stderr,
    )
    # httpx/httpcore log every GraphQL request at INFO — always suppress so DEBUG stays readable.
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if level <= logging.DEBUG:
        log.info(
            "DEBUG: extra detail from codex_client (notifications, non-JSON lines); "
            "turn progress at INFO is: started → (heartbeats) → completed"
        )
    wf = args.workflow.resolve()
    if not wf.is_file():
        log.error("Workflow file not found: %s", wf)
        sys.exit(1)

    orch = Orchestrator(wf)
    errs = orch.cfg.validate()
    if errs:
        for e in errs:
            log.error("Config: %s", e)
        sys.exit(1)

    log.info("Symphony Windows MVP — workflow=%s workspace.root=%s", wf, orch.cfg.workspace.root)
    try:
        asyncio.run(orch.run_forever())
    except KeyboardInterrupt:
        log.info("Interrupted, exiting.")
        orch.stop()


if __name__ == "__main__":
    main()
