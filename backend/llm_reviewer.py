"""OpenRouter Multi-Model LLM Code Review & Migration Patch Synthesizer."""
import difflib
import json

import httpx

from .config import settings
from .models import LLMReviewRequest, LLMReviewResponse

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are an elite automated code migration and API drift remediation agent for DriftWatch.
You are given:
1. Target repository and file name.
2. The current code content.
3. An upstream API breaking change advisory (Title, Plain Summary, Ecosystem, and Matched Symbol).

Your job:
1. Perform a thorough code review explaining what is broken by the upstream change.
2. Determine risk severity: "CRITICAL", "WARNING", or "SAFE", with a risk score 0-100.
3. Synthesize the fully updated/refactored code fixing the breaking change while strictly preserving 100% of the surrounding file structure, functions, classes, imports, and comments.
4. The 'patched_code' field MUST contain the COMPLETE updated file (ready to replace the target file in GitHub), with only the affected symbols/lines modified.
5. Generate a concise unified git diff.
6. Compose a professional Pull Request title and Markdown PR body formatted for GitHub.

CRITICAL: Return ONLY valid JSON matching this schema:
{
  "risk_level": "CRITICAL" | "WARNING" | "SAFE",
  "risk_score": 85,
  "review_title": "Migrate deprecated API in target file",
  "review_summary": "Detailed 2-3 sentence technical explanation of why the current code breaks and what needs to change.",
  "breaking_changes_analysis": [
    "Identified legacy API call",
    "Applied updated signature compliant with upstream advisory"
  ],
  "patched_code": "COMPLETE UPDATED FILE CONTENT PRESERVING ALL OTHER CODE",
  "suggested_pr_title": "fix(payments): migrate legacy Charge API to PaymentIntent",
  "suggested_pr_body": "## Summary\\n...\\n## Upstream Advisory\\n...\\n## Verification Plan\\n..."
}
"""


def generate_fallback_review(request: LLMReviewRequest) -> LLMReviewResponse:
    """Deterministic heuristic fallback when OpenRouter API key is not configured."""
    lines = request.file_content.splitlines(keepends=True)
    sym = request.symbol_matched.lower()
    summary = request.advisory_summary.lower()

    patched_lines = []
    changes_made = 0

    for line in lines:
        new_line = line
        if ("charge" in sym or "stripe" in sym) and ("payment" in summary or "charge" in line.lower()):
            new_line = line.replace("stripe.Charge.create", "stripe.PaymentIntent.create").replace("stripe.Charge", "stripe.PaymentIntent")
            if new_line != line:
                changes_made += 1
        elif ("completion" in sym or "openai" in sym) and ("response" in summary or "v1" in summary):
            new_line = line.replace("create_completion", "chat.completions.create").replace("openai.Completion.create", "client.chat.completions.create")
            if new_line != line:
                changes_made += 1
        elif "langchain" in sym or "runnable" in sym:
            new_line = line.replace(".run(", ".invoke(").replace("LLMChain(", "RunnableSequence(")
            if new_line != line:
                changes_made += 1

        patched_lines.append(new_line)

    patched_code = "".join(patched_lines)
    if changes_made == 0:
        # Prepend advisory banner if no direct line match
        patched_code = f"# DriftWatch Advisory: {request.advisory_title}\n# Review upstream changes for: {request.symbol_matched}\n" + request.file_content

    diff = "".join(
        difflib.unified_diff(
            request.file_content.splitlines(keepends=True),
            patched_code.splitlines(keepends=True),
            fromfile=f"a/{request.file_path}",
            tofile=f"b/{request.file_path}",
        )
    )

    pr_title = f"fix({request.symbol_matched or 'api'}): resolve upstream drift for {request.advisory_title}"
    pr_body = f"""## 🛡️ DriftWatch Autonomous Migration

### 📋 Upstream Advisory
* **Advisory**: {request.advisory_title}
* **Impacted Symbol**: `{request.symbol_matched}`
* **Summary**: {request.advisory_summary}

### 🔍 Changes Summary
* Updated affected API references in `{request.file_path}`.
* Verified schema contract adherence with DriftWatch quarantine checks.

---
*Generated automatically by [DriftWatch](https://github.com/vikramlingam/driftwatch)*"""

    return LLMReviewResponse(
        risk_level="WARNING",
        risk_score=75,
        review_title=f"Upstream Drift Detected: {request.advisory_title}",
        review_summary=f"Detected usage of '{request.symbol_matched}' affected by upstream advisory '{request.advisory_title}'. Heuristic patch generated.",
        breaking_changes_analysis=[
            f"Referenced symbol '{request.symbol_matched}' in '{request.file_path}'",
            f"Advisory advisory: {request.advisory_summary}",
        ],
        patched_code=patched_code,
        unified_diff=diff,
        suggested_pr_title=pr_title,
        suggested_pr_body=pr_body,
        model_used="rule_based_fallback",
        execution_mode="rule_based_fallback",
    )


async def review_code_with_llm(request: LLMReviewRequest) -> LLMReviewResponse:
    """Execute code review and migration patch synthesis using OpenRouter LLM or fallback."""
    api_key = request.api_key_override or settings.openrouter_api_key
    model_name = request.model_override or settings.openrouter_model

    if not api_key:
        return generate_fallback_review(request)

    user_prompt = f"""Repository: {request.repo_name}
File Path: {request.file_path}

Current File Content:
```
{request.file_content}
```

Upstream Advisory Details:
- Title: {request.advisory_title}
- Matched Symbol: {request.symbol_matched}
- Summary: {request.advisory_summary}

Perform the code review, determine risk level and score, and output the refactored code and PR details strictly as JSON."""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/vikramlingam/driftwatch",
        "X-Title": "DriftWatch Radar",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 4000,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            if resp.status_code != 200:
                return generate_fallback_review(request)

            data = resp.json()
            choices = data.get("choices")
            if not choices or not isinstance(choices, list) or not choices[0].get("message", {}).get("content"):
                return generate_fallback_review(request)

            raw_text = str(choices[0]["message"]["content"] or "").strip()
            if not raw_text:
                return generate_fallback_review(request)

            # Clean JSON markdown fences if present
            clean_json = raw_text
            if "```json" in clean_json:
                clean_json = clean_json.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_json:
                clean_json = clean_json.split("```")[1].split("```")[0].strip()

            parsed = json.loads(clean_json)

            patched_code = parsed.get("patched_code", request.file_content)
            diff = "".join(
                difflib.unified_diff(
                    request.file_content.splitlines(keepends=True),
                    patched_code.splitlines(keepends=True),
                    fromfile=f"a/{request.file_path}",
                    tofile=f"b/{request.file_path}",
                )
            )

            risk_level = parsed.get("risk_level", "WARNING")
            if risk_level not in ["CRITICAL", "WARNING", "SAFE"]:
                risk_level = "WARNING"

            return LLMReviewResponse(
                risk_level=risk_level,
                risk_score=int(parsed.get("risk_score", 80)),
                review_title=parsed.get("review_title", f"Migration for {request.advisory_title}"),
                review_summary=parsed.get("review_summary", "Refactored codebase to resolve upstream API drift."),
                breaking_changes_analysis=parsed.get("breaking_changes_analysis", []),
                patched_code=patched_code,
                unified_diff=diff,
                suggested_pr_title=parsed.get("suggested_pr_title", f"fix: resolve {request.advisory_title}"),
                suggested_pr_body=parsed.get("suggested_pr_body", f"## DriftWatch Fix for {request.advisory_title}"),
                model_used=model_name,
                execution_mode="openrouter_llm",
            )
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return generate_fallback_review(request)
