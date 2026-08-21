"""Safety and compliance policies for externally fetched target URLs."""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

GOVERNMENT_SUFFIXES = (
    ".gov",
    ".gov.uk",
    ".gov.in",
    ".gc.ca",
    ".gouv.fr",
    ".gov.au",
    ".govt.nz",
    ".mil",
)


def validate_public_http_url(value: str) -> str:
    """Return a normalized public HTTP(S) URL or raise ``ValueError``.

    This deliberately rejects loopback/private destinations and common
    government domains. The hackathon requires public, non-government data,
    and the network restrictions also protect the local app from SSRF-style
    requests when a user pastes an arbitrary URL.
    """

    candidate = value.strip()
    parsed = urlparse(candidate)
    hostname = (parsed.hostname or "").lower().rstrip(".")

    if parsed.scheme not in {"http", "https"} or not hostname:
        raise ValueError("Target URL must use HTTP or HTTPS and include a hostname.")
    if parsed.username or parsed.password:
        raise ValueError("Target URL must not contain embedded credentials.")
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise ValueError("Local network targets are not allowed.")
    if any(hostname == suffix.lstrip(".") or hostname.endswith(suffix) for suffix in GOVERNMENT_SUFFIXES):
        raise ValueError("Government and military websites are not allowed as scraping targets.")

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address is not None and (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved):
        raise ValueError("Private, loopback, link-local, and reserved network targets are not allowed.")

    return candidate


def validate_public_http_urls(values: list[str]) -> list[str]:
    """Validate and de-duplicate target URLs while preserving input order."""

    return list(dict.fromkeys(validate_public_http_url(value) for value in values))
