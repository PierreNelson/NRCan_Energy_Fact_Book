"""
Run Linear GraphQL from stdin (JSON) — same auth as Symphony polling.

Uses only the Python standard library (no httpx) so `python` on PATH works inside Codex.

Usage (PowerShell):
  @'
  {"query": "query { viewer { id } }", "variables": {}}
  '@ | python -m symphony_windows.linear_graphql_cli

Requires LINEAR_API_KEY in the environment.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_ENDPOINT = "https://api.linear.app/graphql"


def main() -> None:
    api_key = (os.environ.get("LINEAR_API_KEY") or "").strip()
    if not api_key:
        sys.stderr.write("linear_graphql_cli: LINEAR_API_KEY is not set in the environment.\n")
        sys.exit(2)

    raw = sys.stdin.read()
    if not raw.strip():
        sys.stderr.write('linear_graphql_cli: stdin must be JSON: {"query": "...", "variables": {}}\n')
        sys.exit(2)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"linear_graphql_cli: invalid JSON on stdin: {e}\n")
        sys.exit(2)

    query = payload.get("query")
    if not query or not isinstance(query, str):
        sys.stderr.write('linear_graphql_cli: missing string "query" in stdin JSON\n')
        sys.exit(2)

    variables = payload.get("variables")
    if variables is None:
        variables = {}
    if not isinstance(variables, dict):
        sys.stderr.write('linear_graphql_cli: "variables" must be a JSON object\n')
        sys.exit(2)

    endpoint = (os.environ.get("LINEAR_GRAPHQL_ENDPOINT") or DEFAULT_ENDPOINT).strip().rstrip("/")
    if not endpoint.endswith("graphql"):
        endpoint = f"{endpoint}/graphql"

    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        sys.stdout.write(err_body or str(e))
        if not (err_body or "").endswith("\n"):
            sys.stdout.write("\n")
        sys.exit(1)
    except urllib.error.URLError as e:
        sys.stderr.write(f"linear_graphql_cli: request failed: {e}\n")
        sys.exit(1)

    sys.stdout.write(text)
    if not text.endswith("\n"):
        sys.stdout.write("\n")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        sys.exit(1)

    if isinstance(data, dict) and data.get("errors"):
        sys.exit(1)


if __name__ == "__main__":
    main()
