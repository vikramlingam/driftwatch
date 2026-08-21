"""Bright Data integration, resilient live documentation scraper, and AI repair."""
import asyncio
import re
import time
import uuid
from datetime import UTC, datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import ValidationError

from .config import settings
from .db import Database
from .models import (
    DocUpdateItem,
    RecoveryEvidenceReport,
    ScrapePipelineResult,
    SelfHealingLoopResponse,
)
from .policy import validate_public_http_urls

# Excluded non-code artifacts and URL domains
TOKEN_STOPWORDS = {
    "github.com", "github", "http", "https", "com", "org", "io", "url", "uri",
    "href", "src", "path", "file", "version", "latest", "true", "false", "null",
    "pull", "pr", "issue", "commit", "release", "releases", "changelog", "docs",
    "documentation", "tiangolo", "anthropic", "openai", "stripe", "fastapi",
    "fix", "fixes", "add", "adds", "update", "updates", "support", "supports",
    "tool", "tools", "client", "model", "models", "schema", "schemas", "data",
    "unittest", "pytest", "typing", "sys", "os", "json", "time", "re",
    "console", "console.error", "console.log", "logger", "logger.error", "logger.warning",
}


def extract_code_tokens(text: str) -> list[str]:
    """Extract genuine code identifiers, method names, or class symbols from text without URL noise."""
    # 1. Strip markdown link destinations [text](url) to prevent extracting domain names
    clean_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    clean_text = re.sub(r"https?://\S+", "", clean_text)
    clean_text = re.sub(r"@\w+", "", clean_text)  # Remove @username mentions
    clean_text = re.sub(r"#\d+", "", clean_text)  # Remove PR/issue numbers like #16049

    # 2. Extract backticked code tokens and dot-qualified/snake_case API symbols
    backticked = re.findall(r"`([A-Za-z0-9_\-\./]{2,60})`", clean_text)
    identifiers = re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]{1,35}\.[a-zA-Z0-9_]{1,35})\b", clean_text)
    api_calls = re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]{2,35}\(\))\b", clean_text)

    # 3. Known API SDK names or specific signatures
    sdk_keywords = re.findall(
        r"\b(stripe\.Charge|stripe\.PaymentIntent|openai\.ChatCompletion|boto3\.client|botocore\.exceptions|createClient|Runnable|get_collection|embeddings|mcpServers|payment_intents?|charge_refunds?)\b",
        clean_text,
        re.IGNORECASE,
    )

    all_raw = backticked + identifiers + api_calls + sdk_keywords
    valid_tokens = []
    for t in all_raw:
        cleaned = t.strip("`'\".,;:()[]{}<>").strip()
        lower = cleaned.lower()
        if (
            cleaned
            and len(cleaned) >= 3
            and lower not in TOKEN_STOPWORDS
            and not lower.startswith("http")
            and not lower.startswith("github")
            and not cleaned.isdigit()
            and "/" not in cleaned  # Exclude paths or URLs
            and cleaned not in valid_tokens
        ):
            valid_tokens.append(cleaned)

    return valid_tokens[:10]


def extract_release_date(text: str, fallback: datetime | None = None) -> datetime:
    """Extract authentic release date (YYYY-MM-DD or Month DD, YYYY) from changelog headings/text."""
    if not text:
        return fallback or datetime.now(timezone.utc)

    # 1. Search for ISO-8601 date: YYYY-MM-DD (e.g. 2026-06-16, 2026-05-17, 2026-03-25, 2026-08-14T18:39:21Z)
    iso_match = re.search(r"\b(202[0-9]-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))(?:T|\b|\s|$)", text)
    if iso_match:
        try:
            return datetime.strptime(iso_match.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    # 2. Search for "Month DD, YYYY" (e.g. "June 16, 2026", "May 17, 2026", "March 25, 2026")
    month_regex = r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    text_match_1 = re.search(rf"\b{month_regex}\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(202[0-9])\b", text, re.IGNORECASE)
    if text_match_1:
        month_str, day_str, year_str = text_match_1.group(1).capitalize(), text_match_1.group(2), text_match_1.group(3)
        for fmt in ("%B %d %Y", "%b %d %Y"):
            try:
                return datetime.strptime(f"{month_str} {day_str} {year_str}", fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

    # 3. Search for "DD Month YYYY" (e.g. "16 June 2026")
    text_match_2 = re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{month_regex},?\s+(202[0-9])\b", text, re.IGNORECASE)
    if text_match_2:
        day_str, month_str, year_str = text_match_2.group(1), text_match_2.group(2).capitalize(), text_match_2.group(3)
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                return datetime.strptime(f"{day_str} {month_str} {year_str}", fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

    return fallback or datetime.now(timezone.utc)


def classify_category_and_urgency(text: str) -> tuple[str, str]:
    """Classify update into schema contract categories and urgency."""
    lower = text.lower()
    if any(k in lower for k in ["breaking", "removed", "no longer", "deleted", "dropped", "incompatible"]):
        return "BREAKING_CHANGE", "HIGH"
    if any(k in lower for k in ["deprecat", "sunset", "obsolete", "discontinued", "phase out"]):
        return "DEPRECATION", "MEDIUM"
    if any(k in lower for k in ["schema", "tool", "parameter", "mcp", "protocol", "argument", "signature", "function call"]):
        return "TOOL_SCHEMA_CHANGE", "MEDIUM"
    return "FEATURE_UPDATE", "LOW"


async def scrape_stripe_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic changelog entries directly from Stripe docs."""
    items: list[dict[str, Any]] = []
    response = await client.get(url)
    if response.status_code != 200:
        return items
    soup = BeautifulSoup(response.text, "html.parser")
    h3_elements = soup.find_all("h3")
    for h3 in h3_elements:
        date_title = h3.get_text().strip()
        if not date_title:
            continue
        container = h3.find_parent("div")
        for _ in range(4):
            if container and len(container.get_text()) > 80:
                break
            if container and container.parent:
                container = container.parent
        raw_text = container.get_text(" ", strip=True) if container else ""
        summary = raw_text.replace(date_title, "").strip()
        if not summary or len(summary) < 5:
            continue
        category, urgency = classify_category_and_urgency(summary)
        discovered_at = extract_release_date(f"{date_title} {summary}")
        items.append({
            "entry_id": f"stripe-{date_title.replace('.', '-').replace(' ', '-')}",
            "ecosystem": "Stripe",
            "title": f"Stripe API {date_title}",
            "category": category,
            "urgency": urgency,
            "plain_summary": summary[:400],
            "affected_code": extract_code_tokens(summary),
            "source_url": url,
            "discovered_at": discovered_at,
        })
    return items


async def scrape_openai_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic OpenAI changelog updates."""
    feed_url = "https://raw.githubusercontent.com/openai/openai-python/main/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:20]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"\[?(\d+\.\d+\.\d+)\]?", header)
        version = version_match.group(1) if version_match else "Latest"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"openai-v{version}",
            "ecosystem": "OpenAI",
            "title": f"OpenAI SDK v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/openai/openai-python/releases/tag/v{version}" if version_match else "https://platform.openai.com/docs/changelog",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_anthropic_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic Anthropic changelog updates."""
    feed_url = "https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:20]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"(\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"anthropic-v{version}",
            "ecosystem": "Anthropic",
            "title": f"Anthropic SDK v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/anthropics/anthropic-sdk-python/releases/tag/v{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_aws_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic AWS Boto3 changelog updates."""
    feed_url = "https://raw.githubusercontent.com/boto/boto3/develop/CHANGELOG.rst"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n(\d+\.\d+\.\d+)\n=+\n", response.text)
    items: list[dict[str, Any]] = []
    for i in range(1, min(len(sections) - 1, 30), 2):
        version = sections[i]
        body = sections[i + 1].strip()
        body_clean = re.sub(r"\* api-change:``(.*?)``:", r"Service: \1 -", body)
        body_clean = " ".join(body_clean.split())
        if not body_clean or len(body_clean) < 10:
            continue
        category, urgency = classify_category_and_urgency(body_clean)
        discovered_at = extract_release_date(f"{version} {body_clean}")
        items.append({
            "entry_id": f"aws-boto3-{version}",
            "ecosystem": "AWS",
            "title": f"AWS Boto3 {version}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body_clean[:400],
            "affected_code": extract_code_tokens(body_clean),
            "source_url": "https://aws.amazon.com/releasenotes/",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_gcp_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic Google Cloud / Gemini GenAI SDK changelog updates."""
    feed_url = "https://raw.githubusercontent.com/googleapis/python-genai/main/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:20]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"\[?(\d+\.\d+\.\d+)\]?", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"gcp-genai-v{version}",
            "ecosystem": "GCP",
            "title": f"Google Cloud GenAI SDK v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/googleapis/python-genai/releases/tag/v{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_supabase_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic Supabase SDK changelog updates."""
    feed_url = "https://raw.githubusercontent.com/supabase/supabase-js/master/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:20]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"\[?(\d+\.\d+\.\d+)\]?", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"supabase-v{version}",
            "ecosystem": "Supabase",
            "title": f"Supabase JS v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/supabase/supabase-js/releases/tag/v{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_fastapi_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic FastAPI framework release notes."""
    feed_url = "https://raw.githubusercontent.com/fastapi/fastapi/master/docs/en/docs/release-notes.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:20]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"(\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"fastapi-v{version}",
            "ecosystem": "FastAPI",
            "title": f"FastAPI Framework {version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": "https://fastapi.tiangolo.com/release-notes/",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_langchain_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic LangChain & LangGraph agent framework changelog."""
    feed_url = "https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/core/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:15]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"(\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"langchain-v{version}",
            "ecosystem": "LangChain & Agents",
            "title": f"LangChain Core v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/langchain-ai/langchain/releases/tag/langchain-core%3D%3D{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_ollama_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic Ollama local LLM tool calling releases."""
    feed_url = "https://raw.githubusercontent.com/ollama/ollama/main/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:15]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"(\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"ollama-v{version}",
            "ecosystem": "Ollama & Local LLMs",
            "title": f"Ollama Model Runner v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/ollama/ollama/releases/tag/v{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_chromadb_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic ChromaDB vector database releases."""
    feed_url = "https://raw.githubusercontent.com/chroma-core/chroma/main/CHANGELOG.md"
    response = await client.get(feed_url)
    if response.status_code != 200:
        return []
    sections = re.split(r"\n##\s+", response.text)
    items: list[dict[str, Any]] = []
    for s in sections[1:15]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0]
        version_match = re.search(r"(\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else "Update"
        body_lines = [l.strip().lstrip("-* ") for l in lines[1:] if l.strip() and not l.startswith("#")]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue
        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        first_line = body_lines[0] if body_lines else f"v{version}"
        items.append({
            "entry_id": f"chromadb-v{version}",
            "ecosystem": "ChromaDB & Vector",
            "title": f"ChromaDB v{version}: {first_line[:60]}",
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:400],
            "affected_code": extract_code_tokens(body),
            "source_url": f"https://github.com/chroma-core/chroma/releases/tag/{version}",
            "discovered_at": discovered_at,
        })
    return items


async def scrape_mcp_changelog(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape authentic Model Context Protocol (MCP) live commits from GitHub."""
    api_url = "https://api.github.com/repos/modelcontextprotocol/specification/commits"
    response = await client.get(api_url, headers={"User-Agent": "DriftWatch-Scraper"})
    items: list[dict[str, Any]] = []
    if response.status_code != 200:
        return items
    
    commits = response.json()
    if not isinstance(commits, list):
        return items

    for c in commits[:30]:
        sha = c.get("sha", "")[:7]
        commit_data = c.get("commit", {})
        message = commit_data.get("message", "").strip()
        if not message or "Merge pull request" in message or "Merge branch" in message:
            continue
            
        summary = message.split("\n\n")[0]
        date_str = commit_data.get("author", {}).get("date", "")
        discovered_at = extract_release_date(date_str) if date_str else datetime.now(timezone.utc)
        
        category, urgency = classify_category_and_urgency(summary)
        items.append({
            "entry_id": f"mcp-commit-{sha}",
            "ecosystem": "MCP & Agent Tools",
            "title": f"MCP Protocol Update: {summary[:50]}...",
            "category": category,
            "urgency": urgency,
            "plain_summary": summary[:400],
            "affected_code": extract_code_tokens(summary),
            "source_url": c.get("html_url", "https://github.com/modelcontextprotocol/specification"),
            "discovered_at": discovered_at,
        })
    return items


async def scrape_raw_markdown_changelog(
    url: str, client: httpx.AsyncClient, default_ecosystem: str | None = None
) -> list[dict[str, Any]]:
    """Parse raw GitHub/online Markdown or RST changelog into authentic advisory records."""
    response = await client.get(url)
    if response.status_code != 200:
        return []
    text = response.text
    if not text.strip():
        return []

    # Infer ecosystem name if not provided
    ecosystem = default_ecosystem
    if not ecosystem:
        lower_url = url.lower()
        if "crewai" in lower_url:
            ecosystem = "CrewAI & Multi-Agent"
        elif "litellm" in lower_url:
            ecosystem = "LiteLLM (AI Gateway)"
        elif "langgraph" in lower_url:
            ecosystem = "LangGraph (Stateful)"
        elif "dspy" in lower_url:
            ecosystem = "DSPy (Prompt Optimizer)"
        elif "vllm" in lower_url:
            ecosystem = "vLLM (Inference Engine)"
        elif "transformers" in lower_url or "huggingface" in lower_url:
            ecosystem = "Hugging Face Transformers"
        elif "instructor" in lower_url:
            ecosystem = "Instructor (Structured LLM)"
        elif "llama_index" in lower_url or "llama-index" in lower_url:
            ecosystem = "LlamaIndex & RAG"
        elif "qdrant" in lower_url:
            ecosystem = "Qdrant Vector Engine"
        elif "weaviate" in lower_url:
            ecosystem = "Weaviate Vector DB"
        elif "pinecone" in lower_url:
            ecosystem = "Pinecone Vector"
        elif "prisma" in lower_url:
            ecosystem = "Prisma ORM"
        elif "drizzle" in lower_url:
            ecosystem = "Drizzle ORM"
        elif "tailwind" in lower_url:
            ecosystem = "Tailwind CSS v4"
        elif "astro" in lower_url:
            ecosystem = "Astro Web Framework"
        elif "bun" in lower_url:
            ecosystem = "Bun Runtime"
        elif "next.js" in lower_url or "vercel/next" in lower_url:
            ecosystem = "Next.js 15 & React 19"
        elif "pydantic" in lower_url:
            ecosystem = "Pydantic v2"
        else:
            path_parts = urlparse(url).path.split("/")
            ecosystem = path_parts[2].replace("-", " ").title() if len(path_parts) > 2 else "Custom"

    items: list[dict[str, Any]] = []

    # Split by level 2 release headers (## [v1.0.0])
    sections = re.split(r"\n##\s+", text)
    if len(sections) <= 1:
        sections = re.split(r"\n#\s+", text)
    if len(sections) <= 1:
        sections = re.split(r"\n(?=[0-9]+\.[0-9]+\.[0-9]+(?:\n[=\-]+\n))", text)

    for s in sections[1:30]:
        lines = s.strip().splitlines()
        if not lines:
            continue
        header = lines[0].strip("# \t*")
        version_match = re.search(r"(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?|v\d+\.\d+\.\d+)", header)
        version = version_match.group(1) if version_match else header[:30]

        # Extract authentic body lines including subheadings
        body_lines = [
            l.strip().lstrip("-*# ").strip()
            for l in lines[1:]
            if l.strip() and not l.strip().startswith("==") and not l.strip().startswith("--")
        ]
        body = " ".join(body_lines)
        if not body or len(body) < 10:
            continue

        category, urgency = classify_category_and_urgency(f"{header} {body}")
        discovered_at = extract_release_date(f"{header} {body}")
        code_tokens = extract_code_tokens(f"{header} {body}")

        clean_slug = re.sub(r"[^a-zA-Z0-9_\-]", "-", f"{ecosystem.lower()}-{version}").strip("-")
        first_line = body_lines[0] if body_lines else header
        title = f"{ecosystem} {version}: {first_line[:60]}" if len(first_line) > 0 else f"{ecosystem} {version}"
        items.append({
            "entry_id": clean_slug[:45],
            "ecosystem": ecosystem,
            "title": title,
            "category": category,
            "urgency": urgency,
            "plain_summary": body[:450],
            "affected_code": code_tokens,
            "source_url": url,
            "discovered_at": discovered_at,
        })
    return items


async def scrape_custom_html_url(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Scrape generic HTML documentation page."""
    response = await client.get(url)
    if response.status_code != 200:
        return []
    soup = BeautifulSoup(response.text, "html.parser")
    items: list[dict[str, Any]] = []
    domain = urlparse(url).netloc or "Documentation"

    for tag in soup.find_all(["article", "section", "h2", "h3"])[:15]:
        text = tag.get_text(" ", strip=True)
        if len(text) < 25:
            continue
        title = text[:80].split(".")[0].strip()
        if len(title) < 3:
            continue
        summary = text[:350].strip()
        if len(summary) < 10:
            continue
        category, urgency = classify_category_and_urgency(summary)
        items.append({
            "entry_id": str(uuid.uuid5(uuid.NAMESPACE_URL, url + title)),
            "ecosystem": domain.replace("www.", "").split(".")[0].capitalize(),
            "title": title,
            "category": category,
            "urgency": urgency,
            "plain_summary": summary,
            "affected_code": extract_code_tokens(summary),
            "source_url": url,
        })
    return items


async def trigger_scrape(urls: list[str], collector_id: str | None = None) -> str:
    coll_id = collector_id or settings.bright_data_collector_id
    if not coll_id:
        raise ValueError("No Bright Data collector ID provided.")
    endpoint = f"https://api.brightdata.com/dca/trigger?collector={coll_id}&queue_next=1"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {settings.bright_data_api_token}"},
            json=[{"url": u} for u in urls],
        )
        response.raise_for_status()
        data = response.json()
        collection_id = data.get("collection_id") or data.get("id") or data.get("collectionId")
        if not collection_id:
            raise RuntimeError("Bright Data accepted the request but did not return a collection ID.")
        return str(collection_id)


async def poll_results(collection_id: str, max_wait: int = 15, interval: int = 3) -> list[dict]:
    endpoint = f"https://api.brightdata.com/dca/dataset?id={collection_id}"
    deadline = time.monotonic() + max_wait
    async with httpx.AsyncClient(timeout=10) as client:
        while time.monotonic() < deadline:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {settings.bright_data_api_token}"},
            )
            if 400 <= response.status_code < 500:
                response.raise_for_status()
            if response.status_code >= 500 or not response.content.strip():
                await asyncio.sleep(interval)
                continue
            try:
                data = response.json()
            except ValueError:
                await asyncio.sleep(interval)
                continue
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and data.get("status") in {"ready", "completed", "done"}:
                return data.get("data", data.get("results", []))
            await asyncio.sleep(interval)
    raise TimeoutError(f"Collection {collection_id} did not finish within {max_wait} seconds")


def _normalize(raw: dict[str, Any], default_url: str, execution_engine: str) -> dict[str, Any]:
    title = str(raw.get("title") or raw.get("name") or raw.get("headline") or "").strip()
    if not title or len(title) < 3:
        raise ValueError("Missing or invalid 'title' (minimum 3 characters required).")

    summary = str(raw.get("plain_summary") or raw.get("summary") or raw.get("description") or "").strip()
    if not summary or len(summary) < 5:
        raise ValueError("Missing or invalid 'plain_summary' (minimum 5 characters required).")

    source_url = str(raw.get("source_url") or default_url or "").strip()
    if not source_url or not source_url.startswith("http"):
        raise ValueError("Missing or invalid 'source_url' (valid HTTP/HTTPS URL required).")

    category = str(raw.get("category", "")).upper().strip()
    if category not in {"BREAKING_CHANGE", "DEPRECATION", "FEATURE_UPDATE", "TOOL_SCHEMA_CHANGE"}:
        category, _ = classify_category_and_urgency(f"{title} {summary}")

    urgency = str(raw.get("urgency", "")).upper().strip()
    if urgency not in {"HIGH", "MEDIUM", "LOW"}:
        _, urgency = classify_category_and_urgency(f"{title} {summary}")

    entry_id = str(raw.get("entry_id") or raw.get("id") or "").strip()
    if not entry_id:
        entry_id = str(uuid.uuid5(uuid.NAMESPACE_URL, source_url + "#" + title))

    ecosystem = str(raw.get("ecosystem") or "").strip()
    if not ecosystem:
        domain = urlparse(source_url).netloc.replace("www.", "")
        ecosystem = domain.split(".")[0].capitalize() if domain else "Custom"

    affected_code = raw.get("affected_code")
    if not isinstance(affected_code, list):
        affected_code = extract_code_tokens(f"{title} {summary}")
    else:
        affected_code = [str(x).strip() for x in affected_code if str(x).strip()]

    raw_date = raw.get("discovered_at") or raw.get("date") or raw.get("published_at")
    if raw_date and isinstance(raw_date, datetime):
        discovered_at = raw_date
    elif raw_date and isinstance(raw_date, str):
        discovered_at = extract_release_date(raw_date)
    else:
        discovered_at = extract_release_date(f"{title} {summary}")

    return {
        "entry_id": entry_id,
        "ecosystem": ecosystem,
        "title": title,
        "category": category,
        "urgency": urgency,
        "plain_summary": summary,
        "affected_code": affected_code,
        "source_url": source_url,
        "discovered_at": discovered_at,
        "execution_engine": execution_engine,
        "scraped_at": datetime.now(timezone.utc),
    }


async def scrape_target_url(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Route target URL to specialized or generic live scraper."""
    lower = url.lower()
    if "stripe.com" in lower:
        return await scrape_stripe_changelog(url, client)
    elif "openai" in lower:
        return await scrape_openai_changelog(url, client)
    elif "anthropic" in lower:
        return await scrape_anthropic_changelog(url, client)
    elif "aws" in lower or "boto" in lower:
        return await scrape_aws_changelog(url, client)
    elif "google" in lower or "gcp" in lower or "genai" in lower:
        return await scrape_gcp_changelog(url, client)
    elif "supabase" in lower:
        return await scrape_supabase_changelog(url, client)
    elif "fastapi" in lower:
        return await scrape_fastapi_changelog(url, client)
    elif "langchain" in lower or "langgraph" in lower:
        return await scrape_langchain_changelog(url, client)
    elif "crewai" in lower:
        return await scrape_raw_markdown_changelog(url, client, "CrewAI & Multi-Agent")
    elif "llama_index" in lower or "llama-index" in lower:
        return await scrape_raw_markdown_changelog(url, client, "LlamaIndex & RAG")
    elif "pinecone" in lower:
        return await scrape_raw_markdown_changelog(url, client, "Pinecone Vector")
    elif "next.js" in lower or "vercel/next" in lower:
        return await scrape_raw_markdown_changelog(url, client, "Next.js 15 & React 19")
    elif "pydantic" in lower:
        return await scrape_raw_markdown_changelog(url, client, "Pydantic v2")
    elif "ollama" in lower:
        return await scrape_ollama_changelog(url, client)
    elif "chroma" in lower:
        return await scrape_chromadb_changelog(url, client)
    elif "mcp" in lower or "modelcontextprotocol" in lower:
        return await scrape_mcp_changelog(url, client)
    elif url.endswith((".md", ".rst")) or "raw.githubusercontent.com" in lower:
        return await scrape_raw_markdown_changelog(url, client)
    else:
        return await scrape_custom_html_url(url, client)


async def run_pipeline(
    urls: list[str],
    collector_id: str | None = None,
    force_engine: str = "auto",
) -> ScrapePipelineResult:
    """Execute scrape pipeline with transparent execution telemetry."""
    started = time.perf_counter()
    urls = validate_public_http_urls([str(url) for url in urls])
    if not urls:
        raise ValueError("At least one public HTTP(S) target URL is required.")

    raw_items: list[dict] = []
    pipeline_errors: list[str] = []
    quarantined_errors: list[str] = []
    telemetry_logs: list[str] = []
    execution_engine = "direct"
    dca_succeeded = False
    job_id: str | None = None
    coll_id_used = collector_id or settings.bright_data_collector_id

    if force_engine not in {"auto", "bright_data_dca", "direct"}:
        raise ValueError(f"Unsupported scrape engine: {force_engine}")

    # 1. Attempt Bright Data DCA if configured and requested. Strict DCA mode
    # never falls back to direct scraping or silently reports a direct run.
    if force_engine != "direct":
        if not settings.bright_data_api_token or not coll_id_used:
            message = "Bright Data DCA requires both BRIGHT_DATA_API_TOKEN and BRIGHT_DATA_COLLECTOR_ID."
            telemetry_logs.append(message)
            if force_engine == "bright_data_dca":
                execution_engine = "bright_data_dca"
                pipeline_errors.append(message)
        else:
            if force_engine == "bright_data_dca":
                execution_engine = "bright_data_dca"
            telemetry_logs.append(f"Initiating Bright Data DCA Collector: {coll_id_used}")
            try:
                job_id = await trigger_scrape(urls, collector_id=coll_id_used)
                telemetry_logs.append(f"Bright Data DCA triggered successfully. Job ID: {job_id}")
                bd_items = await poll_results(job_id, max_wait=8, interval=2)
                if bd_items and isinstance(bd_items, list):
                    raw_items.extend({**item, "_execution_engine": "bright_data_dca"} for item in bd_items if isinstance(item, dict))
                    dca_succeeded = True
                    execution_engine = "bright_data_dca"
                    telemetry_logs.append(f"Bright Data DCA returned {len(bd_items)} raw structured records.")
                elif force_engine == "bright_data_dca":
                    pipeline_errors.append(f"Bright Data DCA job {job_id} returned no records.")
            except (httpx.HTTPError, OSError, RuntimeError, TimeoutError, ValueError) as exc:
                telemetry_logs.append(f"Bright Data DCA attempt status: {exc!s}")
                if force_engine == "bright_data_dca":
                    pipeline_errors.append(f"Bright Data DCA collection failed: {exc!s}")

    # 2. In auto mode, direct-scrape only targets that were not represented in
    # the DCA response. A custom collector commonly covers one target type;
    # this prevents a successful Stripe response from hiding other feeds.
    direct_urls: list[str] = []
    if force_engine != "bright_data_dca":
        if not raw_items:
            direct_urls = urls
        else:
            first_url = urls[0]
            covered_urls = set()
            for raw in raw_items:
                source = None
                if isinstance(raw, dict):
                    source = raw.get("source_url") or raw.get("url")
                if source:
                    covered_urls.add(str(source))
            for url in urls:
                if url == first_url and not covered_urls:
                    continue
                if not any(_same_target_url(url, covered) for covered in covered_urls):
                    direct_urls.append(url)

    if direct_urls:
        telemetry_logs.append("Executing upstream live documentation scrapers...")
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 DriftWatch/1.0"}
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
            tasks = [scrape_target_url(u, client) for u in direct_urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res, u in zip(results, direct_urls):
                if isinstance(res, list):
                    raw_items.extend({**item, "_execution_engine": "direct"} for item in res if isinstance(item, dict))
                    telemetry_logs.append(f"Extracted {len(res)} authentic updates from {u}")
                elif isinstance(res, Exception):
                    pipeline_errors.append(f"Failed to scrape {u}: {res!s}")
                    telemetry_logs.append(f"Error scraping {u}: {res!s}")

    if dca_succeeded and direct_urls:
        execution_engine = "mixed"

    # 3. Strict Pydantic contract validation & quarantine isolation
    valid: list[DocUpdateItem] = []
    batch_id = f"batch_{uuid.uuid4().hex[:12]}"
    for raw in raw_items:
        if not isinstance(raw, dict):
            quarantined_errors.append("Item set aside: not a valid dictionary record.")
            continue
        try:
            normalized = _normalize(raw, urls[0], str(raw.get("_execution_engine") or execution_engine))
            item = DocUpdateItem.model_validate(normalized)
            item.batch_id = batch_id
            valid.append(item)
        except ValidationError as exc:
            first = exc.errors()[0]
            field = ".".join(str(x) for x in first["loc"])
            quarantined_errors.append(f"Contract violation on '{field}': {first['msg']}.")
        except (TypeError, ValueError) as exc:
            quarantined_errors.append(f"Validation error: {exc!s}")

    # 4. Persist valid records to SQLite FTS5 database
    saved = Database(settings.db_path).upsert_updates(valid)
    telemetry_logs.append(
        f"Persisted {saved} verified records to SQLite with FTS5 search. "
        f"{len(quarantined_errors)} items quarantined."
    )

    return ScrapePipelineResult(
        batch_id=batch_id,
        urls_checked=urls,
        total_items_found=len(raw_items),
        valid_items_saved=saved,
        quarantined_items_count=len(quarantined_errors),
        quarantined_errors=quarantined_errors,
        pipeline_errors=pipeline_errors,
        time_taken_seconds=round(time.perf_counter() - started, 3),
        finished_at=datetime.now(UTC),
        execution_engine=execution_engine,
        bright_data_job_id=job_id,
        collector_id_used=coll_id_used,
        telemetry_logs=telemetry_logs,
    )


def _same_target_url(left: str, right: str) -> bool:
    """Compare target URLs by scheme, host, and normalized path."""

    left_parsed = urlparse(left)
    right_parsed = urlparse(right)
    return (
        left_parsed.scheme.lower(),
        left_parsed.netloc.lower(),
        left_parsed.path.rstrip("/") or "/",
    ) == (
        right_parsed.scheme.lower(),
        right_parsed.netloc.lower(),
        right_parsed.path.rstrip("/") or "/",
    )


async def execute_heal_cli(collector_id: str, issue_description: str) -> dict:
    """Execute Step 2: `bdata scraper heal <collector_id> "<issue>"`."""
    started = time.perf_counter()
    try:
        process = await asyncio.create_subprocess_exec(
            "npx", "-p", "@brightdata/cli", "bdata", "scraper", "heal", collector_id, issue_description,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        heal_output = stdout.decode(errors="replace").strip() or stderr.decode(errors="replace").strip()
        heal_success = (process.returncode == 0)
        return {
            "heal_success": heal_success,
            "proposed_fix": heal_output if heal_success else None,
            "error": stderr.decode(errors="replace").strip() if not heal_success else "",
            "execution_time_seconds": round(time.perf_counter() - started, 3),
        }
    except (OSError, asyncio.SubprocessError) as exc:
        return {
            "heal_success": False,
            "proposed_fix": None,
            "error": f"Heal execution failed: {exc!s}",
            "execution_time_seconds": round(time.perf_counter() - started, 3),
        }


async def execute_approve_cli(collector_id: str) -> dict:
    """Execute Step 3: `bdata scraper approve <collector_id>`."""
    started = time.perf_counter()
    try:
        process = await asyncio.create_subprocess_exec(
            "npx", "-p", "@brightdata/cli", "bdata", "scraper", "approve", collector_id,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        approve_output = stdout.decode(errors="replace").strip() or stderr.decode(errors="replace").strip()
        approve_success = (process.returncode == 0)
        return {
            "approved": approve_success,
            "approve_details": approve_output,
            "error": stderr.decode(errors="replace").strip() if not approve_success else "",
            "execution_time_seconds": round(time.perf_counter() - started, 3),
        }
    except (OSError, asyncio.SubprocessError) as exc:
        return {
            "approved": False,
            "approve_details": None,
            "error": f"Approve execution failed: {exc!s}",
            "execution_time_seconds": round(time.perf_counter() - started, 3),
        }


async def fix_scraper_with_ai(collector_id: str, issue_description: str) -> dict:
    """Combined heal + approve flow for backward compatibility endpoint."""
    heal_res = await execute_heal_cli(collector_id, issue_description)
    if not heal_res.get("heal_success"):
        return {
            "success": False,
            "heal_success": False,
            "approved": False,
            "proposed_fix": None,
            "error": heal_res.get("error"),
        }
    app_res = await execute_approve_cli(collector_id)
    return {
        "success": app_res.get("approved", False),
        "heal_success": True,
        "approved": app_res.get("approved", False),
        "proposed_fix": heal_res.get("proposed_fix"),
        "approve_details": app_res.get("approve_details"),
        "error": app_res.get("error"),
    }


async def diagnose_collector_break(collector_id: str, target_url: str) -> tuple[bool, int, str]:
    """Perform real DOM & Collector break check on the target URL."""
    try:
        if settings.bright_data_api_token and collector_id:
            job_id = await trigger_scrape([target_url], collector_id=collector_id)
            try:
                records = await poll_results(job_id, max_wait=6, interval=2)
                if not records or len(records) == 0:
                    return True, 0, f"Collector {collector_id} returned 0 records for {target_url} (selector miss or DOM shift)."
                return False, len(records), f"Collector {collector_id} active. Extracted {len(records)} records."
            except TimeoutError:
                return True, 0, f"Collector {collector_id} timed out on {target_url}. Selectors unable to resolve target containers."
            except (httpx.HTTPError, OSError, RuntimeError, ValueError) as exc:
                return True, 0, f"Collector {collector_id} execution failure: {exc!s}"
        else:
            return True, 0, f"Collector {collector_id}: No API token or collector unreachable."
    except (httpx.HTTPError, OSError, RuntimeError, ValueError) as exc:
        return True, 0, f"Break detected on {collector_id}: {exc!s}"


async def run_closed_loop_self_healing(
    collector_id: str | None = None,
    target_url: str = "https://docs.stripe.com/changelog",
    issue_description: str = "Target documentation DOM changed. Extract new version headers and breaking change notes.",
    auto_approve: bool = True,
    re_run_after_approval: bool = True,
) -> SelfHealingLoopResponse:
    """End-to-end self-healing loop: break detection -> AI heal -> approve -> re-run verification."""
    started = time.perf_counter()
    coll_id = collector_id or settings.bright_data_collector_id
    if not coll_id:
        return SelfHealingLoopResponse(
            collector_id="none",
            target_url=target_url,
            step_1_break_detected=True,
            break_diagnostic="No Collector ID configured in environment (.env).",
            step_2_heal_proposed=None,
            step_3_approved=False,
            step_4_rerun_success=False,
            step_4_rerun_records_count=0,
            total_duration_seconds=round(time.perf_counter() - started, 3),
            stage_logs=["[!] Error: Bright Data Collector ID is missing."],
            final_status="HEAL_FAILED",
        )

    logs: list[str] = []

    # Step 1: Real Break Detection (measured pre-heal record count)
    logs.append(f"[Step 1/4] Diagnosing Collector ID {coll_id} on live target {target_url}...")
    break_detected, measured_pre_count, diagnostic_msg = await diagnose_collector_break(coll_id, target_url)
    logs.append(f"[Step 1/4] Diagnostic State: {diagnostic_msg} (Pre-heal record count: {measured_pre_count})")

    # Step 2: Trigger AI Scraper Heal (ONLY heal, no pre-approval)
    logs.append(f"[Step 2/4] Triggering Bright Data AI Heal: `bdata scraper heal {coll_id}`...")
    heal_res = await execute_heal_cli(coll_id, issue_description)
    heal_success = heal_res.get("heal_success", False)
    heal_proposed = heal_res.get("proposed_fix") or heal_res.get("error")
    logs.append(f"[Step 2/4] Heal Result: {'Success' if heal_success else 'Failed'} - {str(heal_proposed)[:140]}")

    if not heal_success:
        logs.append(f"[!] Self-healing aborted at Step 2: AI Heal failed to update collector {coll_id}.")
        return SelfHealingLoopResponse(
            collector_id=coll_id,
            target_url=target_url,
            step_1_break_detected=break_detected,
            break_diagnostic=diagnostic_msg,
            step_2_heal_proposed=heal_proposed,
            step_3_approved=False,
            step_4_rerun_success=False,
            step_4_rerun_records_count=0,
            total_duration_seconds=round(time.perf_counter() - started, 3),
            stage_logs=logs,
            final_status="HEAL_FAILED",
        )

    # Step 3: Approval Check (Executes `bdata scraper approve` ONLY if auto_approve is True)
    if not auto_approve:
        logs.append("[Step 3/4] `auto_approve` is False. Scraper heal proposed, approval pending manual review.")
        return SelfHealingLoopResponse(
            collector_id=coll_id,
            target_url=target_url,
            step_1_break_detected=break_detected,
            break_diagnostic=diagnostic_msg,
            step_2_heal_proposed=heal_proposed,
            step_3_approved=False,
            step_4_rerun_success=False,
            step_4_rerun_records_count=0,
            total_duration_seconds=round(time.perf_counter() - started, 3),
            stage_logs=logs,
            final_status="APPROVAL_REQUIRED",
        )

    logs.append(f"[Step 3/4] Approving healed collector: `bdata scraper approve {coll_id}`...")
    approve_res = await execute_approve_cli(coll_id)
    approved = approve_res.get("approved", False)
    logs.append(f"[Step 3/4] Approval Result: {approved}")

    if not approved:
        logs.append(f"[!] Scraper approval failed for collector {coll_id}.")
        return SelfHealingLoopResponse(
            collector_id=coll_id,
            target_url=target_url,
            step_1_break_detected=break_detected,
            break_diagnostic=diagnostic_msg,
            step_2_heal_proposed=heal_proposed,
            step_3_approved=False,
            step_4_rerun_success=False,
            step_4_rerun_records_count=0,
            total_duration_seconds=round(time.perf_counter() - started, 3),
            stage_logs=logs,
            final_status="HEAL_FAILED",
        )

    # Step 4: Re-run Verification (Strict Bright Data Verification: force_engine='bright_data_dca')
    if not re_run_after_approval:
        logs.append("[Step 4/4] `re_run_after_approval` is False. Scraper approved without verification re-run.")
        return SelfHealingLoopResponse(
            collector_id=coll_id,
            target_url=target_url,
            step_1_break_detected=break_detected,
            break_diagnostic=diagnostic_msg,
            step_2_heal_proposed=heal_proposed,
            step_3_approved=approved,
            step_4_rerun_success=False,
            step_4_rerun_records_count=0,
            total_duration_seconds=round(time.perf_counter() - started, 3),
            stage_logs=logs,
            final_status="HEAL_APPROVED_PENDING_RERUN",
        )

    logs.append(f"[Step 4/4] Re-running Collector {coll_id} on {target_url} with force_engine='bright_data_dca'...")
    post_heal_res = await run_pipeline([target_url], collector_id=coll_id, force_engine="bright_data_dca")
    
    # Strict verification: Must have used bright_data_dca engine and saved valid items
    rerun_success = (
        post_heal_res.execution_engine == "bright_data_dca"
        and post_heal_res.valid_items_saved > 0
        and post_heal_res.quarantined_items_count == 0
    )

    # Step 4 Evidence Report Construction
    evidence_report = None
    if rerun_success:
        logs.append(
            f"[Step 4/4] Verification Complete: Bright Data DCA Collector {coll_id} extracted and persisted {post_heal_res.valid_items_saved} verified records with 0 errors!"
        )
        final_status = "RECOVERED_AND_VERIFIED"
        report_id = f"evidence_{uuid.uuid4().hex[:12]}"
        
        # Dynamically determine validated schema fields present in the verified dataset
        recent_records = Database(settings.db_path).latest(
            batch_id=post_heal_res.batch_id,
            limit=post_heal_res.valid_items_saved
        )
        if recent_records:
            recovered_fields = sorted({k for item in recent_records for k, v in item.items() if v is not None})
        else:
            recovered_fields = ["entry_id", "ecosystem", "title", "category", "urgency", "plain_summary", "affected_code", "source_url", "discovered_at"]

        import hashlib
        import json
        evidence_payload = {
            "report_id": report_id,
            "collector_id": coll_id,
            "target_url": target_url,
            "pre_heal_record_count": measured_pre_count,
            "pre_heal_diagnostic": diagnostic_msg,
            "bright_data_verified_job_id": post_heal_res.bright_data_job_id,
            "execution_engine_used": post_heal_res.execution_engine,
            "post_heal_record_count": post_heal_res.valid_items_saved,
            "quarantined_contract_errors_count": post_heal_res.quarantined_items_count,
            "recovered_schema_fields": recovered_fields,
            "approval_mode": "AUTO_APPROVED" if auto_approve else "MANUAL_APPROVED",
            "batch_id": post_heal_res.batch_id,
            "finished_at": post_heal_res.finished_at.isoformat(),
            "raw_records_digest": hashlib.sha256(json.dumps(recent_records, sort_keys=True, default=str).encode()).hexdigest(),
        }
        sha256_digest = hashlib.sha256(json.dumps(evidence_payload, sort_keys=True).encode()).hexdigest()

        evidence_report = RecoveryEvidenceReport(
            report_id=report_id,
            collector_id=coll_id,
            target_url=target_url,
            pre_heal_record_count=measured_pre_count,
            pre_heal_diagnostic=diagnostic_msg,
            bright_data_verified_job_id=post_heal_res.bright_data_job_id,
            execution_engine_used=post_heal_res.execution_engine,
            post_heal_record_count=post_heal_res.valid_items_saved,
            recovered_schema_fields=recovered_fields,
            quarantined_contract_errors_count=post_heal_res.quarantined_items_count,
            timestamped_execution_trace=[f"[{datetime.now(UTC).strftime('%H:%M:%S')}] {l}" for l in logs],
            approval_mode="AUTO_APPROVED" if auto_approve else "MANUAL_APPROVED",
            evidence_sha256=sha256_digest,
        )
    else:
        logs.append(
            f"[Step 4/4] Re-run verification failed: Bright Data DCA did not return valid records (Saved: {post_heal_res.valid_items_saved}, Errors: {len(post_heal_res.quarantined_errors)})."
        )
        final_status = "RE_RUN_FAILED"

    duration = round(time.perf_counter() - started, 3)

    return SelfHealingLoopResponse(
        collector_id=coll_id,
        target_url=target_url,
        step_1_break_detected=break_detected,
        break_diagnostic=diagnostic_msg,
        step_2_heal_proposed=heal_proposed,
        step_3_approved=approved,
        step_4_rerun_success=rerun_success,
        step_4_rerun_records_count=post_heal_res.valid_items_saved,
        total_duration_seconds=duration,
        stage_logs=logs,
        final_status=final_status,
        evidence_report=evidence_report,
    )
