"""
Shared HTTP GET with retry for transient connection and gateway errors.
"""

import time
from typing import Any, Dict, Optional

import requests


def fetch_get(
    url: str,
    *,
    timeout: int = 120,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    max_retries: int = 3,
    retry_delay_seconds: int = 2,
    label: str = "HTTP",
) -> requests.Response:
    """
    GET with retries on connection errors, timeouts, and HTTP 502/503/504.

    Raises:
        requests.exceptions.HTTPError: Non-retryable HTTP errors
        Exception: After all retries exhausted
    """
    last_error: Optional[Exception] = None
    req_headers = headers or {}

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                delay = retry_delay_seconds * attempt
                print(
                    f"  Retrying {label} fetch "
                    f"(attempt {attempt + 1}/{max_retries}, wait {delay}s)..."
                )
                time.sleep(delay)

            response = requests.get(
                url,
                timeout=timeout,
                headers=req_headers,
                params=params,
            )
            response.raise_for_status()
            return response

        except requests.exceptions.HTTPError as e:
            code = e.response.status_code if e.response is not None else None
            if code in (502, 503, 504):
                last_error = e
                if attempt < max_retries - 1:
                    continue
                break
            raise

        except (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            ConnectionResetError,
            OSError,
        ) as e:
            last_error = e
            if attempt < max_retries - 1:
                continue
            break

    raise Exception(f"{label} request failed after {max_retries} attempts: {last_error}") from last_error


def resilience_from_config(config) -> tuple[int, int]:
    """Return (max_retries, retry_delay_seconds) from a Config instance."""
    resilience = getattr(config, 'resilience', {}) or {}
    if callable(resilience):
        resilience = resilience()
    return (
        resilience.get('fetch_max_retries', 3),
        resilience.get('fetch_retry_delay_seconds', 2),
    )
