"""Project manifest parsing and patch generation."""
import difflib
import json
import re
from typing import Any

from .db import Database
from .models import DocUpdateItem, ProjectAuditMatch, ProjectAuditResponse


def _extract_requirements_names(content: str) -> list[str]:
    """Parse clean package names from requirements.txt content."""
    names: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(("#", "-")):
            continue
        # Remove trailing environment markers e.g. ; python_version >= '3.8'
        line = line.split(";")[0].strip()
        # Remove inline comments
        line = line.split("#")[0].strip()
        if not line:
            continue
        # Split on standard pip specifiers: <, >, =, !, ~, @, space
        pkg_part = re.split(r"[<>=!~@ ]", line)[0].strip()
        # Strip extras e.g. uvicorn[standard] -> uvicorn
        pkg_clean = re.sub(r"\[.*?\]", "", pkg_part).strip()
        if pkg_clean:
            names.append(pkg_clean.lower())
    return list(dict.fromkeys(names))


def _extract_package_json_names(content: str) -> list[str]:
    """Parse dependency names from package.json."""
    try:
        data = json.loads(content)
        if not isinstance(data, dict):
            return []
    except json.JSONDecodeError:
        return []
    keys = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
    names: list[str] = []
    for k in keys:
        deps = data.get(k, {})
        if isinstance(deps, dict):
            names.extend(deps.keys())
    return list(dict.fromkeys(names))


def _extract_mcp_config_names(content: str) -> list[str]:
    """Parse server keys, tool names, and package references from mcp_config.json."""
    names: list[str] = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return []

    # Check standard mcpServers root key
    if isinstance(data, dict) and "mcpServers" in data and isinstance(data["mcpServers"], dict):
        for s_name, s_conf in data["mcpServers"].items():
            names.append(s_name)
            if isinstance(s_conf, dict):
                args = s_conf.get("args", [])
                if isinstance(args, list):
                    for arg in args:
                        if isinstance(arg, str) and (arg.startswith("@") or "/" in arg):
                            names.append(arg.split("/")[-1].replace("@", ""))
                cmd = s_conf.get("command", "")
                if isinstance(cmd, str) and cmd:
                    names.append(cmd)

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for k, v in value.items():
                if k.lower() in {"name", "tool", "server", "package", "mcp"} and isinstance(v, str):
                    names.append(v)
                walk(v)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(data)
    # Clean up names
    cleaned: list[str] = []
    for n in names:
        if isinstance(n, str) and len(n.strip()) > 1:
            clean = n.strip().split("/")[-1].replace("@", "")
            if clean:
                cleaned.append(clean.lower())
    return list(dict.fromkeys(cleaned))


def _names(content: str, file_type: str) -> list[str]:
    if file_type == "requirements.txt" or "requirements" in file_type:
        return _extract_requirements_names(content)
    elif file_type == "package.json" or "package" in file_type:
        return _extract_package_json_names(content)
    elif file_type == "mcp_config.json" or "mcp" in file_type:
        return _extract_mcp_config_names(content)
    else:
        # Fallback: try requirements parsing first, then JSON
        reqs = _extract_requirements_names(content)
        if reqs:
            return reqs
        return _extract_mcp_config_names(content)


def generate_suggested_fix(package: str, update: DocUpdateItem) -> str:
    """Generate a clean suggested migration snippet or patch."""
    affected = ", ".join(update.affected_code) if update.affected_code else package
    return (
        f"# Migration Fix for {package} ({update.title})\n"
        f"# Upstream advisory: {update.plain_summary}\n"
        f"# Review and migrate affected symbols: {affected}\n"
        f"# Reference: {update.source_url}\n"
    )


def audit_project_file(content: str, file_type: str, db: Database) -> ProjectAuditResponse:
    names = _names(content, file_type)
    matches: list[ProjectAuditMatch] = []
    seen_matches = set()

    for name in names:
        results = db.search(name, limit=25)
        for item in results:
            cat = item.get("category")
            if cat not in {"BREAKING_CHANGE", "DEPRECATION", "TOOL_SCHEMA_CHANGE"}:
                continue
            entry_id = item.get("entry_id")
            match_key = (name, entry_id)
            if match_key in seen_matches:
                continue
            seen_matches.add(match_key)

            try:
                update = DocUpdateItem.model_validate(item)
                warning = f"Your project references '{name}'. {update.title} ({update.category}): {update.plain_summary}"
                fix = generate_suggested_fix(name, update)
                matches.append(
                    ProjectAuditMatch(
                        package_or_tool=name,
                        matched_update=update,
                        plain_warning=warning,
                        ready_to_use_fix=fix,
                    )
                )
            except (TypeError, ValueError):
                continue

    return ProjectAuditResponse(
        file_type=file_type,
        total_items_checked=len(names),
        issues_found_count=len(matches),
        matches=matches,
    )


def create_code_fix(ecosystem: str, old_code: str, new_code: str, sample_filename: str = "app.py") -> str:
    """Generate unified diff between old and new code snippets."""
    old_lines = old_code.splitlines(True)
    new_lines = new_code.splitlines(True)
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"a/{sample_filename}",
        tofile=f"b/{sample_filename}",
        lineterm="",
    )
    return "".join(diff)
