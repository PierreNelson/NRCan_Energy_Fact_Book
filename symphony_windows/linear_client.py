"""Linear GraphQL client (candidate issues, state refresh, terminal cleanup)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

ISSUES_PAGE = """
query IssuesForProject($slug: String!, $after: String) {
  issues(
    filter: { project: { slugId: { eq: $slug } } }
    first: 50
    after: $after
    orderBy: updatedAt
  ) {
    nodes {
      id
      identifier
      title
      description
      priority
      url
      createdAt
      updatedAt
      state { id name type }
      labels { nodes { id name } }
      relations {
        nodes {
          type
          issue { id identifier state { name type } }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""

ISSUE_BY_IDS = """
query IssuesByIds($ids: [ID!]!) {
  issues(filter: { id: { in: $ids } } ) {
    nodes {
      id
      identifier
      title
      state { name type }
    }
  }
}
"""



def _normalize_issue(raw: dict[str, Any]) -> dict[str, Any]:
    labels = raw.get("labels") or {}
    label_nodes = labels.get("nodes") or []
    label_names = [str(n.get("name", "")).lower() for n in label_nodes if n.get("name")]

    rels = raw.get("relations") or {}
    blocked_by: list[dict[str, Any]] = []
    for edge in rels.get("nodes") or []:
        if edge.get("type") == "blocks":
            iss = edge.get("issue") or {}
            st = (iss.get("state") or {}) if isinstance(iss.get("state"), dict) else {}
            blocked_by.append(
                {
                    "id": iss.get("id"),
                    "identifier": iss.get("identifier"),
                    "state": st.get("name"),
                }
            )

    st = raw.get("state") or {}
    return {
        "id": raw["id"],
        "identifier": raw["identifier"],
        "title": raw.get("title") or "",
        "description": raw.get("description"),
        "priority": raw.get("priority"),
        "state": st.get("name") or "",
        "url": raw.get("url"),
        "labels": label_names,
        "blocked_by": blocked_by,
        "created_at": raw.get("createdAt"),
        "updated_at": raw.get("updatedAt"),
    }


class LinearClient:
    def __init__(self, endpoint: str, api_key: str) -> None:
        ep = (endpoint or "https://api.linear.app/graphql").strip()
        if not ep.endswith("graphql"):
            ep = ep.rstrip("/") + "/graphql"
        self.endpoint = ep
        self.api_key = api_key
        self._headers = {
            "Authorization": api_key,
            "Content-Type": "application/json",
        }

    async def _post(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                self.endpoint,
                json={"query": query, "variables": variables},
                headers=self._headers,
            )
            r.raise_for_status()
            data = r.json()
        if "errors" in data and data["errors"]:
            log.error("Linear GraphQL errors: %s", data["errors"])
            raise RuntimeError(f"Linear GraphQL: {data['errors']}")
        return data.get("data") or {}

    async def fetch_candidate_issues(self, project_slug: str, active_states: list[str]) -> list[dict[str, Any]]:
        """All issues in project; filtered client-side to active_states (case-insensitive)."""
        active_lower = {s.lower() for s in active_states}
        out: list[dict[str, Any]] = []
        after: str | None = None
        while True:
            data = await self._post(ISSUES_PAGE, {"slug": project_slug, "after": after})
            conn = (data.get("issues") or {})
            nodes = conn.get("nodes") or []
            for n in nodes:
                norm = _normalize_issue(n)
                if norm["state"].lower() in active_lower:
                    out.append(norm)
            page = conn.get("pageInfo") or {}
            if not page.get("hasNextPage"):
                break
            after = page.get("endCursor")
            if not after:
                break
        return out

    async def fetch_issue_states_by_ids(self, issue_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not issue_ids:
            return {}
        data = await self._post(ISSUE_BY_IDS, {"ids": issue_ids})
        nodes = (data.get("issues") or {}).get("nodes") or []
        return {n["id"]: _normalize_issue(n) for n in nodes}

    async def fetch_terminal_issue_identifiers(
        self, project_slug: str, terminal_states: list[str]
    ) -> list[str]:
        """Identifiers in terminal states (paginate all project issues, filter client-side)."""
        term_lower = {s.lower() for s in terminal_states}
        ids: list[str] = []
        after: str | None = None
        while True:
            data = await self._post(ISSUES_PAGE, {"slug": project_slug, "after": after})
            conn = data.get("issues") or {}
            for n in conn.get("nodes") or []:
                st = (n.get("state") or {}).get("name") or ""
                if st.lower() in term_lower and n.get("identifier"):
                    ids.append(n["identifier"])
            page = conn.get("pageInfo") or {}
            if not page.get("hasNextPage"):
                break
            after = page.get("endCursor")
            if not after:
                break
        return ids
