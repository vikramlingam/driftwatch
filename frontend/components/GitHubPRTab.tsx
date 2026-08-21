import React from 'react';
import {
  Github,
  GitBranch,
  Bot,
  Cpu,
  GitPullRequest,
  Search,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  Code2,
  Copy,
  Send,
} from 'lucide-react';
import {
  GitHubScanResponse,
  FileImpactMatch,
  LLMReviewResponse,
  CreatePRResponse,
  GitHubConfigStatus,
} from '../types';
import { Pagination } from './Pagination';

interface GitHubPRTabProps {
  theme: 'dark' | 'light';
  ghRepoUrl: string;
  setGhRepoUrl: (url: string) => void;
  ghBranch: string;
  setGhBranch: (branch: string) => void;
  ghTokenOverride: string;
  setGhTokenOverride: (token: string) => void;
  ghLoading: boolean;
  ghErrorMessage: string;
  ghScanResult: GitHubScanResponse | null;
  ghConfigStatus: GitHubConfigStatus | null;
  llmModelChoice: string;
  setLlmModelChoice: (model: string) => void;
  llmApiKeyOverride: string;
  setLlmApiKeyOverride: (key: string) => void;
  showApiKeyInput: boolean;
  setShowApiKeyInput: (show: boolean) => void;
  handleScanGitHubRepo: (e?: React.FormEvent) => Promise<void>;
  paginatedGhMatches: FileImpactMatch[];
  selectedGhMatch: FileImpactMatch | null;
  handleRunLLMReview: (match: FileImpactMatch) => Promise<void>;
  llmReviewLoading: boolean;
  llmReviewResult: LLMReviewResponse | null;
  ghMatchPage: number;
  setGhMatchPage: React.Dispatch<React.SetStateAction<number>>;
  copySnippet: (text: string, id: string) => void;
  copiedId: string | null;
  prCustomTitle: string;
  setPrCustomTitle: (title: string) => void;
  prCustomBody: string;
  setPrCustomBody: (body: string) => void;
  handleCreateGitHubPR: (fallbackAck: boolean) => Promise<void>;
  prLoading: boolean;
  prResult: CreatePRResponse | null;
}

export const GitHubPRTab: React.FC<GitHubPRTabProps> = ({
  theme,
  ghRepoUrl,
  setGhRepoUrl,
  ghBranch,
  setGhBranch,
  ghTokenOverride,
  setGhTokenOverride,
  ghLoading,
  ghErrorMessage,
  ghScanResult,
  ghConfigStatus,
  llmModelChoice,
  setLlmModelChoice,
  llmApiKeyOverride,
  setLlmApiKeyOverride,
  showApiKeyInput,
  setShowApiKeyInput,
  handleScanGitHubRepo,
  paginatedGhMatches,
  selectedGhMatch,
  handleRunLLMReview,
  llmReviewLoading,
  llmReviewResult,
  ghMatchPage,
  setGhMatchPage,
  copySnippet,
  copiedId,
  prCustomTitle,
  setPrCustomTitle,
  prCustomBody,
  setPrCustomBody,
  handleCreateGitHubPR,
  prLoading,
  prResult,
}) => {
  const [fallbackAck, setFallbackAck] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Top Control & Repo Search Card */}
      <div
        className={`rounded-xl border p-6 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div
          className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-5 ${
            theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <Github className={theme === 'dark' ? 'text-white' : 'text-slate-900'} size={20} />
              <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                GitHub AI Remediation & Pull Request Studio
              </h2>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
                OpenRouter + GitHub Bot
              </span>
            </div>
            <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
              Inspect remote GitHub repository manifests, execute multi-model LLM code reviews against upstream API breaking changes, and autonomously open Pull Requests.
            </p>
          </div>

          {/* Model & Config Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] ${
                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <Bot size={13} className="text-indigo-400" />
              <span className="text-[#64748b]">Model:</span>
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {llmModelChoice.split('/').pop()}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] ${
                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <Cpu
                size={13}
                className={
                  ghConfigStatus?.openrouter_configured || llmApiKeyOverride
                    ? 'text-amber-500'
                    : 'text-[#64748b]'
                }
              />
              <span className="text-[#64748b]">LLM:</span>
              <span
                className={
                  ghConfigStatus?.openrouter_configured || llmApiKeyOverride
                    ? 'text-emerald-500 font-semibold'
                    : 'text-amber-500'
                }
              >
                {ghConfigStatus?.openrouter_configured || llmApiKeyOverride
                  ? 'Configured'
                  : 'Fallback Engine'}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] ${
                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <GitPullRequest
                size={13}
                className={
                  ghConfigStatus?.github_token_configured || ghTokenOverride
                    ? 'text-emerald-500'
                    : 'text-[#64748b]'
                }
              />
              <span className="text-[#64748b]">PR Bot:</span>
              <span
                className={
                  ghConfigStatus?.github_token_configured || ghTokenOverride
                    ? 'text-emerald-500 font-semibold'
                    : 'text-slate-500'
                }
              >
                {ghConfigStatus?.github_token_configured || ghTokenOverride
                  ? 'Active'
                  : 'Read-Only'}
              </span>
            </div>
          </div>
        </div>

        {/* GitHub Repo Input Form */}
        <form onSubmit={handleScanGitHubRepo} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
                GitHub Repository URL or Shorthand
              </label>
              <div className="relative">
                <Github className="absolute left-3.5 top-3 text-[#64748b]" size={15} />
                <input
                  value={ghRepoUrl}
                  onChange={(e) => setGhRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository or owner/repository"
                  className={`w-full rounded-md border py-2.5 pl-10 pr-3 font-mono text-xs outline-none transition ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#0c0e13] text-white placeholder-[#64748b] focus:border-[#2b3347]'
                      : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
                Branch (Optional)
              </label>
              <div className="relative">
                <GitBranch className="absolute left-3.5 top-3 text-[#64748b]" size={15} />
                <input
                  value={ghBranch}
                  onChange={(e) => setGhBranch(e.target.value)}
                  placeholder="main / master"
                  className={`w-full rounded-md border py-2.5 pl-10 pr-3 font-mono text-xs outline-none transition ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#0c0e13] text-white placeholder-[#64748b] focus:border-[#2b3347]'
                      : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Quick Presets & Options */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-[#64748b]">Try Presets:</span>
              {[
                { name: 'Drift Watch (Self)', url: 'vikramlingam/driftwatch', branch: 'main' },
                { name: 'LangChain AI', url: 'langchain-ai/langchain', branch: 'master' },
                { name: 'OpenAI Python', url: 'openai/openai-python', branch: 'main' },
                { name: 'ModelContextProtocol', url: 'modelcontextprotocol/servers', branch: 'main' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setGhRepoUrl(preset.url);
                    setGhBranch(preset.branch);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#11141c] text-[#94a3b8] hover:border-[#333d57] hover:text-white'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono">
                ✓ Public Data Only
              </span>
              <button
                type="button"
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className={`text-[11px] underline ${
                  theme === 'dark' ? 'text-[#94a3b8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {showApiKeyInput ? 'Hide Token Overrides' : 'Custom Keys / Token Settings'}
              </button>

              <button
                type="submit"
                disabled={ghLoading || !ghRepoUrl.trim()}
                className={`flex items-center gap-2 rounded-md px-6 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'bg-white text-[#090b0e] hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Search size={14} />
                <span>{ghLoading ? 'Scanning Repository…' : 'Scan Repository'}</span>
              </button>
            </div>
          </div>

          {/* Optional API Key / Token Inputs drawer */}
          {showApiKeyInput && (
            <div
              className={`rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 animate-in fade-in ${
                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div>
                <label className="block text-[10px] font-mono text-[#64748b] mb-1">
                  OpenRouter / LLM Model Selection
                </label>
                <select
                  value={llmModelChoice}
                  onChange={(e) => setLlmModelChoice(e.target.value)}
                  className={`w-full rounded border px-3 py-1.5 font-mono text-xs outline-none ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#11141c] text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <option value="anthropic/claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                  <option value="meta-llama/llama-3.3-70b-instruct">Meta LLaMA 3.3 70B Instruct</option>
                  <option value="google/gemini-2.0-flash-001">Google Gemini 2.0 Flash</option>
                  <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                  <option value="deepseek/deepseek-chat">DeepSeek V3 Chat</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#64748b] mb-1">
                  Personal GitHub Token (Optional Override)
                </label>
                <input
                  type="password"
                  value={ghTokenOverride}
                  onChange={(e) => setGhTokenOverride(e.target.value)}
                  placeholder="ghp_... for creating PRs on private repos"
                  className={`w-full rounded border px-3 py-1.5 font-mono text-xs outline-none ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#11141c] text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}
        </form>

        {ghErrorMessage && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {ghErrorMessage}
          </div>
        )}
      </div>

      {/* GitHub Repository Scan Results */}
      {ghScanResult && (
        <div className="space-y-6">
          {/* Summary Overview Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between min-h-[96px] transition ${
                theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Target Repository
              </span>
              <p className={`my-1 font-mono text-sm sm:text-base font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {ghScanResult.repo_name}
              </p>
              <span className="text-[11px] text-[#64748b] font-medium">Branch: {ghScanResult.default_branch}</span>
            </div>

            <div
              className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between min-h-[96px] transition ${
                theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Manifests Found
              </span>
              <p className={`my-1 text-base sm:text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {ghScanResult.manifests_found.length} detected
              </p>
              <span className="text-[11px] text-[#64748b] font-medium truncate">
                {ghScanResult.manifests_found.join(', ') || 'No manifests'}
              </span>
            </div>

            <div
              className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between min-h-[96px] transition ${
                theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Files Scanned
              </span>
              <p className={`my-1 text-base sm:text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {ghScanResult.scanned_files_count} files inspected
              </p>
              <span className="text-[11px] text-[#64748b] font-medium">AST symbol analysis</span>
            </div>

            <div
              className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between min-h-[96px] transition ${
                ghScanResult.impact_matches.length > 0
                  ? theme === 'dark' ? 'border-amber-500/40 bg-[#11141c]' : 'border-amber-300 bg-white shadow-sm'
                  : theme === 'dark' ? 'border-emerald-500/40 bg-[#11141c]' : 'border-emerald-300 bg-white shadow-sm'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                Breaking API Drift
              </span>
              <p
                className={`my-1 text-base sm:text-lg font-black ${
                  ghScanResult.impact_matches.length > 0 ? 'text-amber-500' : 'text-emerald-500'
                }`}
              >
                {ghScanResult.impact_matches.length} candidates
              </p>
              <span className="text-[11px] text-[#64748b] font-medium">
                {ghScanResult.advisories_detected.length} distinct advisories
              </span>
            </div>
          </div>

          {/* Detected Drift Impact Candidates List */}
          <div
            className={`rounded-xl border p-6 transition ${
              theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-4 ${
                theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
              }`}
            >
              <div>
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Impacted Code Candidates in {ghScanResult.repo_name}
                </h3>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                  Select a candidate to trigger an OpenRouter LLM code review and automated Pull Request generation.
                </p>
              </div>
            </div>

            {ghScanResult.impact_matches.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748b]">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  No Breaking API Drift Detected
                </p>
                <p className="mt-1">Scanned manifests and source files adhere to current indexed contracts.</p>
              </div>
            ) : (
              <div className={`mt-4 divide-y ${theme === 'dark' ? 'divide-[#1e2433]' : 'divide-slate-200'}`}>
                {paginatedGhMatches.map((match, idx) => {
                  const isSelected =
                    selectedGhMatch?.file_path === match.file_path &&
                    selectedGhMatch?.line_number === match.line_number;
                  return (
                    <div
                      key={idx}
                      className={`py-4 transition flex flex-col gap-4 ${
                        isSelected
                          ? theme === 'dark'
                            ? 'bg-[#161a25]/60 px-4 py-4 rounded-xl border border-indigo-500/30'
                            : 'bg-indigo-50/70 px-4 py-4 rounded-xl border border-indigo-200'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-2.5 max-w-3xl flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono text-xs font-bold ${
                                theme === 'dark' ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {match.file_path}
                            </span>
                            <span className="font-mono text-xs text-[#64748b]">line {match.line_number}</span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                                match.urgency === 'HIGH'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                              }`}
                            >
                              {match.urgency}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                                theme === 'dark' ? 'bg-[#1e2433] text-slate-300' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {match.ecosystem}
                            </span>
                          </div>

                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {match.advisory_title}
                          </p>

                          <div
                            className={`rounded border p-2.5 font-mono text-xs ${
                              theme === 'dark'
                                ? 'bg-[#0c0e13] border-[#1e2433] text-slate-300'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <span className="text-[#64748b] mr-2">Matched symbol:</span>
                            <span className="text-amber-500 font-semibold">{match.symbol_matched}</span>
                            <pre
                              className={`mt-1 text-[11px] truncate ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {match.line_content}
                            </pre>
                          </div>

                          {/* Upstream Advisory Proof Trail */}
                          <div
                            className={`rounded-md border p-3 text-xs space-y-1.5 ${
                              theme === 'dark' ? 'border-[#1e2433]/80 bg-[#0a0d14]' : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-[11px]">
                                <ShieldCheck size={13} />
                                <span>Upstream Advisory Proof Trail</span>
                              </div>
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-500 border border-emerald-500/20">
                                Verified Scraper Engine
                              </span>
                            </div>
                            <p
                              className={`text-[11px] leading-relaxed ${
                                theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'
                              }`}
                            >
                              {match.advisory_summary || match.advisory_title}
                            </p>
                            {match.source_url && (
                              <div className="pt-1">
                                <a
                                  href={match.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:underline font-mono"
                                >
                                  <span>Source: {match.source_url}</span>
                                  <ArrowUpRight size={11} />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRunLLMReview(match)}
                          disabled={llmReviewLoading && isSelected}
                          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap self-start lg:self-center shrink-0 shadow-sm"
                        >
                          <Bot size={14} className={llmReviewLoading && isSelected ? 'animate-spin' : ''} />
                          <span>
                            {llmReviewLoading && isSelected
                              ? 'Synthesizing Migration Patch…'
                              : (ghConfigStatus?.openrouter_configured || llmApiKeyOverride)
                              ? 'Review & Fix with AI (OpenRouter LLM)'
                              : 'Review & Fix with Rule-Based Engine'}
                          </span>
                        </button>
                      </div>

                      {/* AI Review Findings & Pull Request Studio Cockpit RENDERED DIRECTLY UNDER THIS MATCH */}
                      {isSelected && llmReviewResult && (
                        <div
                          className={`mt-3 rounded-xl border p-5 space-y-5 border-indigo-500/40 animate-in fade-in slide-in-from-top-2 duration-300 ${
                            theme === 'dark' ? 'bg-[#0f121a]' : 'bg-white shadow-md'
                          }`}
                        >
                          <div
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3 ${
                              theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <Code2 size={16} className="text-indigo-500" />
                                <h3 className={`text-sm sm:text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  AI Migration Review & Patch Synthesis
                                </h3>
                              </div>
                              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                                Target: <code className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{match.file_path}</code> (Powered by {llmReviewResult.model_used})
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2.5 py-1 text-xs font-bold border ${
                                  llmReviewResult.risk_level === 'CRITICAL'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                }`}
                              >
                                Risk: {llmReviewResult.risk_level} ({llmReviewResult.risk_score}/100)
                              </span>

                              <span className="rounded bg-indigo-500/20 px-2.5 py-1 text-xs font-mono text-indigo-400 border border-indigo-500/30">
                                {llmReviewResult.execution_mode === 'openrouter_llm' ? 'OpenRouter LLM' : 'Heuristic Engine'}
                              </span>
                            </div>
                          </div>

                          {/* Review Narrative & Analysis */}
                          <div className="space-y-3">
                            <div
                              className={`rounded-md border p-4 ${
                                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                                LLM Code Review Findings
                              </span>
                              <p className={`mt-1 text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                {llmReviewResult.review_summary}
                              </p>

                              {llmReviewResult.breaking_changes_analysis && llmReviewResult.breaking_changes_analysis.length > 0 && (
                                <ul
                                  className={`mt-3 space-y-1 text-xs list-disc list-inside ${
                                    theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'
                                  }`}
                                >
                                  {llmReviewResult.breaking_changes_analysis.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          {/* Side-by-Side / Unified Git Diff Viewer */}
                          <div>
                            <div className="flex items-center justify-between pb-2">
                              <span className="font-mono text-xs font-semibold uppercase text-[#64748b]">
                                Synthesized Unified Git Diff
                              </span>
                              <button
                                onClick={() => copySnippet(llmReviewResult.unified_diff, `llm-diff-${idx}`)}
                                className={`flex items-center gap-1 text-xs ${
                                  theme === 'dark' ? 'text-[#94a3b8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Copy size={13} />
                                <span>{copiedId === `llm-diff-${idx}` ? 'Copied Diff' : 'Copy Unified Diff'}</span>
                              </button>
                            </div>

                            <div
                              className={`rounded-md border p-4 font-mono text-xs overflow-x-auto ${
                                theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <pre className={`leading-relaxed whitespace-pre font-mono ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                {llmReviewResult.unified_diff.split('\n').map((line, lidx) => {
                                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                                  const isDel = line.startsWith('-') && !line.startsWith('---');
                                  const isHdr = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                                  return (
                                    <div
                                      key={lidx}
                                      className={
                                        isAdd
                                          ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded'
                                          : isDel
                                          ? 'text-red-400 bg-red-500/10 px-1 rounded'
                                          : isHdr
                                          ? 'text-indigo-400 font-bold'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {line}
                                    </div>
                                  );
                                })}
                              </pre>
                            </div>
                          </div>

                          {/* Autonomous Pull Request Launch Form */}
                          <div
                            className={`border-t pt-4 space-y-4 ${
                              theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GitPullRequest size={16} className="text-emerald-400" />
                                <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  Launch Automated Pull Request
                                </h4>
                              </div>
                              <span className="text-[11px] text-[#64748b]">
                                Target Base Branch: <code className="font-mono text-indigo-400">{ghScanResult.default_branch}</code>
                              </span>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-mono text-[#64748b] mb-1">
                                  Pull Request Title
                                </label>
                                <input
                                  value={prCustomTitle}
                                  onChange={(e) => setPrCustomTitle(e.target.value)}
                                  className={`w-full rounded-md border p-2.5 font-mono text-xs outline-none transition ${
                                    theme === 'dark'
                                      ? 'border-[#1e2433] bg-[#0c0e13] text-white focus:border-[#2b3347]'
                                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-500'
                                  }`}
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-[#64748b] mb-1">
                                  Pull Request Description (Markdown)
                                </label>
                                <textarea
                                  rows={4}
                                  value={prCustomBody}
                                  onChange={(e) => setPrCustomBody(e.target.value)}
                                  className={`w-full rounded-md border p-2.5 font-mono text-xs outline-none transition ${
                                    theme === 'dark'
                                      ? 'border-[#1e2433] bg-[#0c0e13] text-white focus:border-[#2b3347]'
                                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-500'
                                  }`}
                                />
                              </div>
                            </div>

                            {llmReviewResult.execution_mode === 'rule_based_fallback' && (
                              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2">
                                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                                  <span>⚠️ Heuristic Rule-Based Fallback Patch</span>
                                </div>
                                <p className="text-xs text-amber-200/90 leading-relaxed">
                                  This patch was generated using local AST regex heuristics because OpenRouter LLM was not configured or reachable. Please inspect the unified diff above carefully before publishing to GitHub.
                                </p>
                                <label className="flex items-center gap-2 text-xs text-amber-300 font-medium cursor-pointer pt-1">
                                  <input
                                    type="checkbox"
                                    checked={fallbackAck}
                                    onChange={(e) => setFallbackAck(e.target.checked)}
                                    className="rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                                  />
                                  <span>I have reviewed the heuristic patch and confirm it is safe to publish.</span>
                                </label>
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                              <span className="text-[11px] text-[#64748b]">
                                Branches and commits will be authored and published via Drift Watch GitHub Bot.
                              </span>

                              <button
                                onClick={() => handleCreateGitHubPR(fallbackAck)}
                                disabled={prLoading || (llmReviewResult.execution_mode === 'rule_based_fallback' && !fallbackAck)}
                                className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-md shadow-emerald-950/20"
                              >
                                <Send size={13} className={prLoading ? 'animate-spin' : ''} />
                                <span>{prLoading ? 'Creating Pull Request…' : 'Publish Pull Request'}</span>
                              </button>
                            </div>

                            {/* PR Success Banner */}
                            {prResult && (
                              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                    <CheckCircle2 size={16} />
                                    <span>Pull Request Successfully Created!</span>
                                  </div>
                                  <a
                                    href={prResult.pr_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded"
                                  >
                                    <span>Open #{prResult.pr_number || 'PR'} on GitHub</span>
                                    <ArrowUpRight size={13} />
                                  </a>
                                </div>
                                <p className="text-xs text-slate-300">
                                  Branch <code className="font-mono text-emerald-300">{prResult.branch_created}</code> committed with sha <code className="font-mono text-slate-400">{prResult.commit_sha?.slice(0, 7) || 'latest'}</code>.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls for Tab 5 */}
            <Pagination
              page={ghMatchPage}
              totalItems={ghScanResult.impact_matches.length}
              itemsPerPage={20}
              setPage={setGhMatchPage}
              itemLabel="impact candidates"
              theme={theme}
            />
          </div>
        </div>
      )}
    </div>
  );
};
