"""GitHub REST API Client for remote repository manifest inspection and automated PR creation."""
import base64
import re
import time
from typing import Any

import httpx

from .config import settings

COMMON_SCAN_FILES = [
    "requirements.txt",
    "package.json",
    "pyproject.toml",
    "mcp_config.json",
    "README.md",
    "app.py",
    "main.py",
    "index.ts",
    "index.js",
    "src/app.py",
    "src/index.ts",
    "src/index.js",
]


def parse_github_repo(repo_input: str) -> tuple[str, str]:
    """Parse 'owner/repo' or 'https://github.com/owner/repo' into (owner, repo)."""
    cleaned = repo_input.strip().rstrip("/")
    cleaned = cleaned.removesuffix(".git")

    # Handle full URL
    url_match = re.search(r"github\.com[/:]([\w.-]+)/([\w.-]+)", cleaned)
    if url_match:
        return url_match.group(1), url_match.group(2)

    # Handle owner/repo shorthand
    parts = cleaned.split("/")
    if len(parts) == 2 and parts[0] and parts[1]:
        return parts[0], parts[1]

    raise ValueError(f"Invalid GitHub repository identifier '{repo_input}'. Expected 'owner/repo' or 'https://github.com/owner/repo'.")


class GitHubClient:
    def __init__(self, token: str | None = None):
        self.token = token or settings.github_token
        self.headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "DriftWatch-Radar-AI/1.0",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    async def get_repo_info(self, owner: str, repo: str) -> dict[str, Any]:
        """Fetch repository metadata, default branch, and description."""
        url = f"https://api.github.com/repos/{owner}/{repo}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=self.headers)
            if resp.status_code == 404:
                raise ValueError(f"GitHub repository '{owner}/{repo}' not found or private without token.")
            if resp.status_code == 401 or resp.status_code == 403:
                rate_msg = resp.json().get("message", "Authentication or rate limit error")
                raise ValueError(f"GitHub API error: {rate_msg}")
            resp.raise_for_status()
            return resp.json()

    async def fetch_file_content(self, owner: str, repo: str, file_path: str, ref: str | None = None) -> tuple[str, str]:
        """Fetch file content (decoded utf-8) and its SHA blob. Returns (content, sha)."""
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        params = {"ref": ref} if ref else {}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=self.headers, params=params)
            if resp.status_code == 404:
                # Try raw GitHub usercontent fallback
                raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{ref or 'main'}/{file_path}"
                raw_resp = await client.get(raw_url, headers=self.headers)
                if raw_resp.status_code == 200:
                    return raw_resp.text, ""
                raise FileNotFoundError(f"File '{file_path}' not found in '{owner}/{repo}'.")

            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "content" in data:
                raw_bytes = base64.b64decode(data["content"])
                return raw_bytes.decode("utf-8", errors="ignore"), data.get("sha", "")
            raise FileNotFoundError(f"'{file_path}' is a directory or invalid file.")

    async def scan_repo_manifests_and_code(
        self,
        owner: str,
        repo: str,
        branch: str | None = None,
    ) -> tuple[dict[str, str], str]:
        """Scan common manifests and source files from the remote repository."""
        repo_info = await self.get_repo_info(owner, repo)
        default_branch = branch or repo_info.get("default_branch", "main")

        found_files: dict[str, str] = {}

        # 1. Try to get recursive tree if available
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
        async with httpx.AsyncClient(timeout=15.0) as client:
            tree_resp = await client.get(tree_url, headers=self.headers)
            candidates = set(COMMON_SCAN_FILES)
            if tree_resp.status_code == 200:
                tree_data = tree_resp.json().get("tree", [])
                for item in tree_data:
                    path = item.get("path", "")
                    # Match manifests or relevant small source files
                    if path.endswith((".py", ".ts", ".js", ".json", ".txt", ".md", ".toml")) and not any(
                        p in path for p in ["node_modules/", ".git/", ".venv/", "dist/", "build/", "__pycache__/"]
                    ):
                        candidates.add(path)

            # Limit candidate files to scan up to 15 key files
            ordered_candidates = [f for f in COMMON_SCAN_FILES if f in candidates] + [
                f for f in sorted(candidates) if f not in COMMON_SCAN_FILES
            ][:10]

            for file_path in ordered_candidates:
                try:
                    content, _ = await self.fetch_file_content(owner, repo, file_path, ref=default_branch)
                    if content and len(content) < 100_000:
                        found_files[file_path] = content
                except (FileNotFoundError, OSError, UnicodeError, ValueError, httpx.HTTPError):
                    continue

        return found_files, default_branch

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        file_path: str,
        patched_code: str,
        pr_title: str,
        pr_body: str,
        base_branch: str = "main",
        custom_branch: str | None = None,
    ) -> dict[str, Any]:
        """Create a new migration branch, commit the patched code, and open a Pull Request."""
        if not self.token:
            raise ValueError("GitHub Token is required to create a branch and open a Pull Request. Please set GITHUB_TOKEN in .env or provide it in the request.")

        async with httpx.AsyncClient(timeout=20.0) as client:
            # 1. Get base branch latest commit SHA
            ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{base_branch}"
            ref_resp = await client.get(ref_url, headers=self.headers)
            if ref_resp.status_code != 200:
                # Try getting repo info default branch
                repo_info = await self.get_repo_info(owner, repo)
                base_branch = repo_info.get("default_branch", "main")
                ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{base_branch}"
                ref_resp = await client.get(ref_url, headers=self.headers)
                ref_resp.raise_for_status()

            base_sha = ref_resp.json()["object"]["sha"]

            # 2. Create new branch
            timestamp = int(time.time())
            branch_name = custom_branch or f"driftwatch/patch-{timestamp}"
            branch_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs"
            branch_payload = {
                "ref": f"refs/heads/{branch_name}",
                "sha": base_sha,
            }
            branch_resp = await client.post(branch_url, headers=self.headers, json=branch_payload)
            if branch_resp.status_code == 422:
                # Branch might already exist, append random suffix
                branch_name = f"{branch_name}-{timestamp % 1000}"
                branch_payload["ref"] = f"refs/heads/{branch_name}"
                branch_resp = await client.post(branch_url, headers=self.headers, json=branch_payload)

            branch_resp.raise_for_status()

            # 3. Get existing file SHA (if file exists) to update it
            file_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
            file_resp = await client.get(file_url, headers=self.headers, params={"ref": branch_name})
            file_sha = None
            if file_resp.status_code == 200:
                file_sha = file_resp.json().get("sha")

            # 4. Commit updated file to the new branch
            encoded_content = base64.b64encode(patched_code.encode("utf-8")).decode("utf-8")
            commit_payload: dict[str, Any] = {
                "message": f"fix(driftwatch): {pr_title}",
                "content": encoded_content,
                "branch": branch_name,
            }
            if file_sha:
                commit_payload["sha"] = file_sha

            commit_resp = await client.put(file_url, headers=self.headers, json=commit_payload)
            commit_resp.raise_for_status()
            commit_data = commit_resp.json()
            commit_sha = commit_data.get("commit", {}).get("sha")

            # 5. Create Pull Request
            pr_url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
            pr_payload = {
                "title": pr_title,
                "body": pr_body,
                "head": branch_name,
                "base": base_branch,
            }
            pr_resp = await client.post(pr_url, headers=self.headers, json=pr_payload)
            pr_resp.raise_for_status()
            pr_data = pr_resp.json()

            return {
                "success": True,
                "pr_url": pr_data.get("html_url", f"https://github.com/{owner}/{repo}/pulls"),
                "pr_number": pr_data.get("number"),
                "branch_created": branch_name,
                "commit_sha": commit_sha,
                "message": f"Successfully created Pull Request #{pr_data.get('number')} on branch '{branch_name}'.",
            }
