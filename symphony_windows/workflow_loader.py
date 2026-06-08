"""Load WORKFLOW.md: YAML front matter + Liquid prompt template."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from liquid import Template

from symphony_windows.config import RuntimeConfig

log = logging.getLogger(__name__)


@dataclass
class WorkflowDefinition:
    config: RuntimeConfig
    prompt_template: str
    source_path: Path

    def render_prompt(self, issue: dict[str, Any], attempt: int | None) -> str:
        """Render Liquid body with issue + attempt (strict unknown vars will error)."""
        tpl = Template(self.prompt_template)
        # Liquid expects string-keyed dicts; normalize issue for template dot access
        ctx: dict[str, Any] = {"issue": issue, "attempt": attempt}
        return str(tpl.render(**ctx))


def parse_workflow_file(path: Path) -> WorkflowDefinition:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError("WORKFLOW.md must start with YAML front matter (---)")

    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ValueError("WORKFLOW.md: missing closing --- for front matter")

    fm_yaml = parts[1].strip()
    body = parts[2].lstrip("\n")

    data = yaml.safe_load(fm_yaml)
    if not isinstance(data, dict):
        raise ValueError("YAML front matter must decode to a mapping")

    cfg = RuntimeConfig.from_front_matter(data)
    return WorkflowDefinition(config=cfg, prompt_template=body, source_path=path.resolve())


def reload_workflow(path: Path) -> WorkflowDefinition:
    """Re-read file from disk (for hot reload)."""
    return parse_workflow_file(path)
