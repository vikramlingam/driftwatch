"""High-precision Local Code Impact Candidate Mapper scanning source files against indexed advisories."""
import difflib
import os
import re
from pathlib import Path
from typing import Any
from .db import Database
from .models import CodebaseImpactReport, DocUpdateItem, FileImpactMatch, StrictModel

# Generic keywords and URL artifacts that must NOT trigger symbol matching
GENERIC_STOPWORDS = {
    "tool", "tools", "client", "model", "models", "schema", "schemas", "auth",
    "database", "storage", "data", "code", "find", "packages", "setuptools",
    "setup", "project", "config", "test", "tests", "run", "call", "create",
    "update", "delete", "get", "post", "put", "response", "request", "error",
    "param", "params", "argument", "args", "kwargs", "value", "key", "token",
    "github", "github.com", "http", "https", "com", "org", "io", "url", "uri",
    "href", "src", "path", "file", "version", "latest", "true", "false", "null",
    "unittest", "unittest.mock", "pytest", "typing", "sys", "os", "json", "time", "re",
}

IGNORE_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "pipfile.lock", "cargo.lock", "composer.lock", "go.sum",
}


def is_meaningful_symbol(symbol: str) -> bool:
    """Filter out short, generic, or common English/URL stopwords while preserving SDK and MCP tool signatures."""
    if not symbol or len(symbol) < 3:
        return False
    lower = symbol.lower().strip("`'\".,;:()/\\")
    if lower in GENERIC_STOPWORDS or "github" in lower or "http" in lower:
        return False
    if lower.isdigit():
        return False

    # Check for qualified symbols, hyphenated tools (e.g. server-filesystem), or CamelCase classes
    has_separator = "." in lower or "_" in lower or "-" in lower or "/" in lower
    is_camel_case = any(c.isupper() for c in symbol[1:]) and len(symbol) >= 4
    is_mcp_spec = lower in {"stdio", "sse", "mcpservers", "runnable", "createclient", "embeddings", "paymentintent"}

    is_known_sdk = lower in {
        "stripe", "anthropic", "openai", "boto3", "botocore", "supabase",
        "fastapi", "langchain", "langgraph", "ollama", "chromadb", "pydantic"
    }
    return (has_separator and len(lower) >= 4) or is_camel_case or is_mcp_spec or is_known_sdk


def scan_file_for_impacts(
    file_path: str,
    content: str,
    advisories: list[DocUpdateItem],
) -> list[FileImpactMatch]:
    """Scan a single source file against indexed advisories with deduplication and plain summaries."""
    matches: list[FileImpactMatch] = []
    lines = content.splitlines()
    filename = Path(file_path).name.lower()
    ext = Path(file_path).suffix.lower()

    if filename in IGNORE_FILENAMES:
        return []

    is_manifest = filename in {"requirements.txt", "package.json", "pyproject.toml", "mcp_config.json"}

    # Group matches by (file_path, line_number, symbol) so we keep only the highest urgency advisory per line
    line_symbol_matches: dict[tuple[int, str], FileImpactMatch] = {}

    for item in advisories:
        symbols_to_check = set()
        
        for sym in item.affected_code:
            if is_meaningful_symbol(sym):
                symbols_to_check.add(sym)

        # For manifests, match package name to advisory ecosystem
        if is_manifest and item.ecosystem:
            eco_lower = item.ecosystem.split()[0].lower()
            if is_meaningful_symbol(eco_lower):
                symbols_to_check.add(eco_lower)

        # In code files, match imported ecosystem
        elif not is_manifest and item.ecosystem:
            eco_lower = item.ecosystem.split()[0].lower()
            if len(eco_lower) >= 4 and is_meaningful_symbol(eco_lower):
                symbols_to_check.add(eco_lower)

        if not symbols_to_check:
            continue

        for symbol in symbols_to_check:
            pattern = re.compile(rf"\b{re.escape(symbol)}\b", re.IGNORECASE)

            for line_idx, line in enumerate(lines, 1):
                clean_line = line.strip()
                if not clean_line or clean_line.startswith("#") or clean_line.startswith("//") or clean_line.startswith("/*"):
                    continue

                if ext == ".toml" and clean_line.startswith("[") and clean_line.endswith("]"):
                    continue

                if pattern.search(clean_line):
                    key = (line_idx, symbol.lower())

                    # Suggested line replacement & unified diff
                    replacement_line = None
                    diff_text = None

                    if "charge" in symbol.lower() and "payment" in item.plain_summary.lower():
                        replacement_line = line.replace("stripe.Charge", "stripe.PaymentIntent").replace(".charges.", ".payment_intents.")
                    elif "completion" in symbol.lower() and "response" in item.plain_summary.lower():
                        replacement_line = line.replace("create_completion", "responses.create")
                    elif "mcp" in symbol.lower() or "stdio" in symbol.lower():
                        replacement_line = f"# Review MCP tool schema: {item.title}\n{line}"

                    if replacement_line and replacement_line != line:
                        old_chunk = f"{line}\n"
                        new_chunk = f"{replacement_line}\n"
                        diff = "".join(
                            difflib.unified_diff(
                                old_chunk.splitlines(keepends=True),
                                new_chunk.splitlines(keepends=True),
                                fromfile=f"a/{Path(file_path).name}",
                                tofile=f"b/{Path(file_path).name}",
                            )
                        )
                        diff_text = diff

                    candidate = FileImpactMatch(
                        file_path=file_path,
                        line_number=line_idx,
                        line_content=clean_line[:200],
                        symbol_matched=symbol,
                        advisory_id=item.entry_id,
                        advisory_title=item.title,
                        advisory_summary=item.plain_summary,
                        ecosystem=item.ecosystem,
                        source_url=str(item.source_url),
                        category=item.category,
                        urgency=item.urgency,
                        suggested_replacement=replacement_line.strip() if replacement_line else None,
                        unified_diff=diff_text,
                    )

                    # Only keep the higher urgency advisory if multiple match the same line
                    if key not in line_symbol_matches:
                        line_symbol_matches[key] = candidate
                    else:
                        existing = line_symbol_matches[key]
                        if candidate.urgency == "HIGH" and existing.urgency != "HIGH":
                            line_symbol_matches[key] = candidate

    return list(line_symbol_matches.values())


def scan_directory_for_impact(
    directory_path: str,
    db: Database,
    max_files: int = 500,
) -> CodebaseImpactReport:
    """Recursively scan a local repository directory for high-precision impact candidates."""
    advisories = [DocUpdateItem.model_validate(x) for x in db.latest(limit=200)]
    all_matches: list[FileImpactMatch] = []
    scanned_count = 0
    impacted_files_set = set()
    advisories_hit = set()

    allowed_exts = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".txt", ".yaml", ".yml", ".toml"}
    ignore_dirs = {
        ".git", "node_modules", ".venv", "venv", "__pycache__", ".next",
        "dist", "build", ".pytest_cache", ".eggs", "*.egg-info"
    }

    target_dir = Path(directory_path).resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        return CodebaseImpactReport(
            target_directory=directory_path,
            scanned_files_count=0,
            impacted_files_count=0,
            total_occurrences_found=0,
            matches=[],
            summary_advisories_hit=[],
        )

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.endswith(".egg-info")]

        for file in files:
            if file.lower() in IGNORE_FILENAMES:
                continue

            ext = Path(file).suffix.lower()
            if ext not in allowed_exts:
                continue

            file_path = os.path.join(root, file)
            scanned_count += 1
            if scanned_count > max_files:
                break

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                file_matches = scan_file_for_impacts(file_path, content, advisories)
                if file_matches:
                    all_matches.extend(file_matches)
                    impacted_files_set.add(file_path)
                    for m in file_matches:
                        advisories_hit.add(f"{m.advisory_title} ({m.urgency})")
            except Exception:
                continue

        if scanned_count > max_files:
            break

    return CodebaseImpactReport(
        target_directory=str(target_dir),
        scanned_files_count=scanned_count,
        impacted_files_count=len(impacted_files_set),
        total_occurrences_found=len(all_matches),
        matches=all_matches[:100],
        summary_advisories_hit=list(advisories_hit)[:20],
    )
