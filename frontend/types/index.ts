export type GitHubScanResponse = {
  repo_name: string;
  default_branch: string;
  manifests_found: string[];
  scanned_files_count: number;
  impact_matches: FileImpactMatch[];
  advisories_detected: string[];
  openrouter_configured: boolean;
  github_token_configured: boolean;
};

export type LLMReviewResponse = {
  risk_level: 'CRITICAL' | 'WARNING' | 'SAFE';
  risk_score: number;
  review_title: string;
  review_summary: string;
  breaking_changes_analysis: string[];
  patched_code: string;
  unified_diff: string;
  suggested_pr_title: string;
  suggested_pr_body: string;
  model_used: string;
  execution_mode: 'openrouter_llm' | 'rule_based_fallback';
};

export type CreatePRResponse = {
  success: boolean;
  pr_url: string;
  pr_number: number | null;
  branch_created: string;
  commit_sha: string | null;
  message: string;
};

export type GitHubConfigStatus = {
  openrouter_configured: boolean;
  openrouter_model: string;
  github_token_configured: boolean;
  github_username: string;
};

export type DocUpdate = {
  entry_id: string;
  ecosystem: string;
  title: string;
  category: 'BREAKING_CHANGE' | 'DEPRECATION' | 'FEATURE_UPDATE' | 'TOOL_SCHEMA_CHANGE';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  plain_summary: string;
  affected_code: string[];
  source_url: string;
  discovered_at: string;
};

export type AuditMatch = {
  package_or_tool: string;
  matched_update: DocUpdate;
  plain_warning: string;
  ready_to_use_fix: string | null;
};

export type AuditResponse = {
  file_type: string;
  total_items_checked: number;
  issues_found_count: number;
  matches: AuditMatch[];
};

export type FileImpactMatch = {
  file_path: string;
  line_number: number;
  line_content: string;
  symbol_matched: string;
  advisory_id: string;
  advisory_title: string;
  advisory_summary?: string;
  ecosystem?: string;
  source_url?: string;
  category: string;
  urgency: string;
  suggested_replacement: string | null;
  unified_diff: string | null;
};

export type CodebaseImpactReport = {
  target_directory: string;
  scanned_files_count: number;
  impacted_files_count: number;
  total_occurrences_found: number;
  matches: FileImpactMatch[];
  summary_advisories_hit: string[];
};

export type RecoveryEvidenceReport = {
  report_id: string;
  collector_id: string;
  target_url: string;
  pre_heal_record_count: number;
  pre_heal_diagnostic: string;
  bright_data_verified_job_id: string | null;
  execution_engine_used: string;
  post_heal_record_count: number;
  recovered_schema_fields: string[];
  quarantined_contract_errors_count: number;
  timestamped_execution_trace: string[];
  approval_mode: 'AUTO_APPROVED' | 'MANUAL_APPROVED' | 'PENDING_APPROVAL';
  generated_at: string;
};

export type SelfHealingResponse = {
  collector_id: string;
  target_url: string;
  step_1_break_detected: boolean;
  break_diagnostic: string;
  step_2_heal_proposed: string | null;
  step_3_approved: boolean;
  step_4_rerun_success: boolean;
  step_4_rerun_records_count: number;
  total_duration_seconds: number;
  stage_logs: string[];
  final_status:
  | 'RECOVERED_AND_VERIFIED'
  | 'HEAL_FAILED'
  | 'APPROVAL_REQUIRED'
  | 'RE_RUN_FAILED'
  | 'HEAL_APPROVED_PENDING_RERUN';
  evidence_report: RecoveryEvidenceReport | null;
};

export type PendingRepairItem = {
  repair_id: string;
  target_url: string;
  risk_level: string;
  issue_description: string;
  proposed_fix: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  evidence_report: RecoveryEvidenceReport | null;
};

export type WatcherStatus = {
  is_running: boolean;
  interval_seconds: number;
  last_run_at: string | null;
  monitored_targets_count: number;
  heal_events_triggered_count: number;
  auto_approve_enabled: boolean;
  recent_watcher_logs: string[];
  pending_repairs?: PendingRepairItem[];
};

export type SystemHealth = {
  status: string;
  records: number;
  scraper: boolean;
  collector_id: string;
};

export const TARGET_URL_MAP: Record<string, string> = {
  All: '',
  Stripe: 'https://docs.stripe.com/changelog',
  OpenAI: 'https://raw.githubusercontent.com/openai/openai-python/main/CHANGELOG.md',
  Anthropic: 'https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/CHANGELOG.md',
  'LangChain & Agents': 'https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/core/CHANGELOG.md',
  'CrewAI & Multi-Agent': 'https://raw.githubusercontent.com/crewAIInc/crewAI/main/CHANGELOG.md',
  'LlamaIndex & RAG': 'https://raw.githubusercontent.com/run-llama/llama_index/main/CHANGELOG.md',
  'Ollama & Local LLMs': 'https://raw.githubusercontent.com/ollama/ollama/main/CHANGELOG.md',
  'ChromaDB & Vector': 'https://raw.githubusercontent.com/chroma-core/chroma/main/CHANGELOG.md',
  'Pinecone Vector': 'https://raw.githubusercontent.com/pinecone-io/pinecone-python-client/main/CHANGELOG.md',
  'MCP & Agent Tools': 'https://raw.githubusercontent.com/modelcontextprotocol/specification/main/README.md',
  'Next.js 15 & React 19': 'https://raw.githubusercontent.com/vercel/next.js/canary/release-notes.md',
  'Pydantic v2': 'https://raw.githubusercontent.com/pydantic/pydantic/main/docs/release-notes.md',
  Supabase: 'https://raw.githubusercontent.com/supabase/supabase-js/master/CHANGELOG.md',
  FastAPI: 'https://raw.githubusercontent.com/fastapi/fastapi/master/docs/en/docs/release-notes.md',
  AWS: 'https://raw.githubusercontent.com/boto/boto3/develop/CHANGELOG.rst',
  GCP: 'https://raw.githubusercontent.com/googleapis/python-genai/main/CHANGELOG.md',
};

export const TARGETS = Object.keys(TARGET_URL_MAP);
