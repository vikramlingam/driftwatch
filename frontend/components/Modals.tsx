import React from 'react';
import {
  X,
  ExternalLink,
  Plus,
  Wrench,
  Cpu,
  RefreshCw,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
  Info,
  BookOpen,
  Layers,
  GitPullRequest,
  Search,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { DocUpdate, SelfHealingResponse } from '../types';

interface ModalsProps {
  theme: 'dark' | 'light';
  // Advisory Detail Modal
  selectedItem: DocUpdate | null;
  setSelectedItem: (item: DocUpdate | null) => void;
  // Add Target Feed Modal
  isAddTargetOpen: boolean;
  setIsAddTargetOpen: (open: boolean) => void;
  customTargetUrl: string;
  setCustomTargetUrl: (url: string) => void;
  handleAddCustomTarget: (e: React.FormEvent) => void;
  // Self-Healing Modal
  isFixModalOpen: boolean;
  setIsFixModalOpen: (open: boolean) => void;
  fixCollectorId: string;
  setFixCollectorId: (id: string) => void;
  fixTargetUrl: string;
  setFixTargetUrl: (url: string) => void;
  fixDescription: string;
  setFixDescription: (desc: string) => void;
  autoApprove: boolean;
  setAutoApprove: (val: boolean) => void;
  reRunAfterApproval: boolean;
  setReRunAfterApproval: (val: boolean) => void;
  fixLoading: boolean;
  healLoopResult: SelfHealingResponse | null;
  handleRunSelfHealingLoop: () => Promise<void>;
  // Quarantine Modal
  isQuarantineOpen: boolean;
  setIsQuarantineOpen: (open: boolean) => void;
  failedErrors: string[];
  // Info & Help Guide Modal
  isInfoOpen: boolean;
  setIsInfoOpen: (open: boolean) => void;
}

export const Modals: React.FC<ModalsProps> = ({
  theme,
  selectedItem,
  setSelectedItem,
  isAddTargetOpen,
  setIsAddTargetOpen,
  customTargetUrl,
  setCustomTargetUrl,
  handleAddCustomTarget,
  isFixModalOpen,
  setIsFixModalOpen,
  fixCollectorId,
  setFixCollectorId,
  fixTargetUrl,
  setFixTargetUrl,
  fixDescription,
  setFixDescription,
  autoApprove,
  setAutoApprove,
  reRunAfterApproval,
  setReRunAfterApproval,
  fixLoading,
  healLoopResult,
  handleRunSelfHealingLoop,
  isQuarantineOpen,
  setIsQuarantineOpen,
  failedErrors,
  isInfoOpen,
  setIsInfoOpen,
}) => {
  return (
    <>
      {/* Modal 1: Advisory Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`w-full max-w-2xl rounded-xl border p-6 shadow-2xl ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#11141c] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-500'
                    }`}
                  >
                    {selectedItem.ecosystem}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                      selectedItem.urgency === 'HIGH'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : selectedItem.urgency === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                    }`}
                  >
                    {selectedItem.urgency} URGENCY
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                      theme === 'dark'
                        ? 'bg-[#161a25] text-[#94a3b8] border-[#1e2433]'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {selectedItem.category}
                  </span>
                </div>
                <h2
                  className={`mt-2 text-lg font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {selectedItem.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className={`rounded-md p-1.5 transition ${
                  theme === 'dark'
                    ? 'text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div
                className={`rounded-lg border p-4 ${
                  theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                  Summary of Upstream Change
                </h3>
                <p
                  className={`mt-1.5 text-xs leading-relaxed ${
                    theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {selectedItem.plain_summary}
                </p>
              </div>

              {selectedItem.affected_code && selectedItem.affected_code.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1.5">
                    Target Function / Method Signatures
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.affected_code.map((c, i) => (
                      <span
                        key={i}
                        className={`rounded px-2.5 py-1 font-mono text-xs border ${
                          theme === 'dark'
                            ? 'bg-[#161a25] text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-100 text-slate-900 border-slate-200 font-semibold'
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`flex items-center justify-between border-t pt-4 text-xs ${
                  theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                }`}
              >
                <span className="text-[11px] text-[#64748b] font-mono">
                  Discovered {selectedItem.discovered_at?.slice(0, 10) || 'Recently'}
                </span>
                <a
                  href={selectedItem.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  <span>Open Official Documentation</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add Target Feed Modal */}
      {isAddTargetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-xl border p-6 shadow-2xl ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#11141c] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Add Target Documentation Feed
              </h3>
              <button
                onClick={() => setIsAddTargetOpen(false)}
                className={`text-[#94a3b8] ${theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCustomTarget} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] text-[#64748b] mb-1">
                  Changelog or Documentation Raw URL:
                </label>
                <input
                  type="url"
                  required
                  value={customTargetUrl}
                  onChange={(e) => setCustomTargetUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../CHANGELOG.md"
                  className={`w-full rounded-md border p-2.5 font-mono text-xs outline-none transition ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#0c0e13] text-white focus:border-[#2b3347]'
                      : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-500'
                  }`}
                />
              </div>

              <p className="text-[11px] text-[#64748b]">
                Drift Watch will fetch, extract breaking changes, build FTS5 indices, and immediately trigger local code impact checks.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTargetOpen(false)}
                  className={`rounded-md border px-4 py-2 text-xs font-semibold ${
                    theme === 'dark'
                      ? 'border-[#1e2433] text-[#94a3b8] hover:bg-[#161a25]'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Plus size={13} />
                  <span>Start Tracking</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: 4-Stage Self Healing Modal & Proof-of-Recovery Evidence */}
      {isFixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div
            className={`w-full max-w-3xl rounded-xl border p-6 my-8 shadow-2xl max-h-[90vh] overflow-y-auto ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#11141c] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="text-amber-400" size={20} />
                <div>
                  <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Bright Data 4-Stage Self-Healing Scraper Studio
                  </h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                    Autonomous repair loop: Break Detection &rarr; Fix Proposal &rarr; Human/Policy Approval &rarr; Verified Re-run.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFixModalOpen(false)}
                className={`text-[#94a3b8] ${theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Loop Inputs */}
            <div className="mt-5 space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                    Collector / Crawler ID
                  </label>
                  <input
                    value={fixCollectorId}
                    onChange={(e) => setFixCollectorId(e.target.value)}
                    placeholder="bright_data_collector_stripe_docs"
                    className={`w-full rounded-md border p-2 font-mono text-xs outline-none ${
                      theme === 'dark'
                        ? 'border-[#1e2433] bg-[#0c0e13] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                    Target Documentation URL
                  </label>
                  <input
                    value={fixTargetUrl}
                    onChange={(e) => setFixTargetUrl(e.target.value)}
                    placeholder="https://docs.stripe.com/changelog"
                    className={`w-full rounded-md border p-2 font-mono text-xs outline-none ${
                      theme === 'dark'
                        ? 'border-[#1e2433] bg-[#0c0e13] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                  Observed Schema Break / Diagnostic Hint
                </label>
                <textarea
                  rows={2}
                  value={fixDescription}
                  onChange={(e) => setFixDescription(e.target.value)}
                  className={`w-full rounded-md border p-2 font-mono text-xs outline-none ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#0c0e13] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                      Auto-Approve Patch (Policy Mode)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={reRunAfterApproval}
                      onChange={(e) => setReRunAfterApproval(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                      Auto Re-Run & Ingest After Approval
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleRunSelfHealingLoop}
                  disabled={fixLoading}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Cpu size={14} className={fixLoading ? 'animate-spin' : ''} />
                  <span>{fixLoading ? 'Executing 4-Stage Loop…' : 'Execute Autonomous Healing Loop'}</span>
                </button>
              </div>
            </div>

            {/* Results & 4-Stage Visualization */}
            {healLoopResult && (
              <div className="mt-6 space-y-4 border-t border-[#1e2433] pt-5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                    Autonomous Execution Pipeline
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                      healLoopResult.final_status === 'RECOVERED_AND_VERIFIED'
                        ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {healLoopResult.final_status} ({healLoopResult.total_duration_seconds}s)
                  </span>
                </div>

                {/* 4 Stage Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div
                    className={`rounded border p-2.5 ${
                      healLoopResult.step_1_break_detected
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-[#1e2433] bg-[#0c0e13] text-[#64748b]'
                    }`}
                  >
                    <span className="block text-[10px] font-bold">STAGE 1</span>
                    <span className="font-semibold">Break Detected</span>
                  </div>

                  <div
                    className={`rounded border p-2.5 ${
                      healLoopResult.step_2_heal_proposed
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                        : 'border-[#1e2433] bg-[#0c0e13] text-[#64748b]'
                    }`}
                  >
                    <span className="block text-[10px] font-bold">STAGE 2</span>
                    <span className="font-semibold">Fix Synthesized</span>
                  </div>

                  <div
                    className={`rounded border p-2.5 ${
                      healLoopResult.step_3_approved
                        ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]'
                        : 'border-[#1e2433] bg-[#0c0e13] text-[#64748b]'
                    }`}
                  >
                    <span className="block text-[10px] font-bold">STAGE 3</span>
                    <span className="font-semibold">Policy Approved</span>
                  </div>

                  <div
                    className={`rounded border p-2.5 ${
                      healLoopResult.step_4_rerun_success
                        ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]'
                        : 'border-[#1e2433] bg-[#0c0e13] text-[#64748b]'
                    }`}
                  >
                    <span className="block text-[10px] font-bold">STAGE 4</span>
                    <span className="font-semibold">
                      Re-run ({healLoopResult.step_4_rerun_records_count} rows)
                    </span>
                  </div>
                </div>

                {/* Stage Logs Terminal */}
                <div
                  className={`rounded-md border p-3 font-mono text-xs ${
                    theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 pb-2 text-[10px] font-bold text-[#64748b]">
                    <Terminal size={12} />
                    <span>AUTONOMOUS EXECUTION TRACE LOGS</span>
                  </div>
                  <div className="space-y-1 max-h-[140px] overflow-y-auto">
                    {healLoopResult.stage_logs.map((log, i) => (
                      <div
                        key={i}
                        className={
                          log.includes('SUCCESS') || log.includes('Passed')
                            ? 'text-[#10b981]'
                            : log.includes('Detected') || log.includes('Simulated')
                            ? 'text-amber-400'
                            : theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-700'
                        }
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proof-of-Recovery Evidence Report (Artifact) */}
                {healLoopResult.evidence_report && (
                  <div
                    className={`rounded-lg border p-4 space-y-2.5 ${
                      theme === 'dark'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-emerald-200 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <ShieldCheck size={16} />
                        <span>Proof-of-Recovery Evidence Report</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#64748b]">
                        ID: {healLoopResult.evidence_report.report_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Pre-Heal Records:</span>
                        <span className="font-bold">{healLoopResult.evidence_report.pre_heal_record_count}</span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Post-Heal Records:</span>
                        <span className="font-bold text-emerald-400">
                          {healLoopResult.evidence_report.post_heal_record_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Bright Data Job:</span>
                        <span className="font-bold truncate block">
                          {healLoopResult.evidence_report.bright_data_verified_job_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Approval Mode:</span>
                        <span className="font-bold text-[#10b981]">
                          {healLoopResult.evidence_report.approval_mode}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Quarantine Errors Modal */}
      {isQuarantineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`w-full max-w-xl rounded-xl border p-6 shadow-2xl ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#11141c] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert size={18} />
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Quarantined Scraper Schema Errors
                </h3>
              </div>
              <button
                onClick={() => setIsQuarantineOpen(false)}
                className={`text-[#94a3b8] ${theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto font-mono text-xs">
              {failedErrors.length === 0 ? (
                <div
                  className={`p-6 text-center rounded-lg border ${
                    theme === 'dark'
                      ? 'border-[#1e2433] bg-[#0c0e13] text-[#64748b]'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                  <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    All Active Scrapers Healthy
                  </p>
                  <p className="text-[11px] mt-1">Zero parse anomalies or quarantined contract deviations.</p>
                </div>
              ) : (
                failedErrors.map((err, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300"
                  >
                    {err}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Project Guide & Information Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#0e1118] text-slate-100'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            {/* Clean Document Header */}
            <div
              className={`flex items-center justify-between border-b px-7 py-4.5 ${
                theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
              }`}
            >
              <div>
                <h2 className="text-lg font-bold">About Drift Watch</h2>
                <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Project overview and feature guide by Team Siloed
                </p>
              </div>
              <button
                onClick={() => setIsInfoOpen(false)}
                className={`rounded-lg p-1.5 transition ${
                  theme === 'dark'
                    ? 'text-slate-400 hover:bg-[#1e2433] hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Clean Reading Body */}
            <div className="p-7 space-y-6 overflow-y-auto text-base leading-relaxed">
              {/* Introduction */}
              <section className="space-y-2.5">
                <h3 className="font-bold text-lg">What is this project?</h3>
                <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                  Drift Watch monitors developer documentation, changelogs, and release notes for major APIs and SDKs (including Stripe, OpenAI, Anthropic, AWS, Supabase, FastAPI, and MCP).
                </p>
                <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                  When third-party libraries change parameters, deprecate functions, or publish breaking releases, Drift Watch detects the changes, shows you which parts of your codebase are affected, and helps you apply fixes before your code breaks in production.
                </p>
              </section>

              <hr className={theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'} />

              {/* How to use the features */}
              <section className="space-y-4">
                <h3 className="font-bold text-lg">Features &amp; How to Use Them</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-base">1. Live Radar &amp; Search</h4>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      Browse breaking changes and deprecations in real time. Use the search bar to look up specific function names or package keywords, filter by ecosystem, and click any entry to see full details and code snippets.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-base">2. Project Audit</h4>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      Upload or paste your manifest file (package.json, requirements.txt, or mcp_config.json) to see if any installed package versions have known breaking changes. Click &quot;View Ready Fix&quot; on any match to see migration code.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-base">3. Codebase Impact</h4>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      Scan a local directory to find the exact file paths and line numbers that use deprecated functions or changed API parameters.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-base">4. Self-Healing Scrapers</h4>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      When documentation websites change layout, Drift Watch detects selector drift, updates the scraper parser, and tests the fix through Bright Data to ensure uninterrupted updates.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-base">5. GitHub Scanner &amp; Pull Requests</h4>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      Enter a public GitHub repository (e.g. owner/repo) to scan repository files for breaking changes and publish automated fix Pull Requests directly to GitHub.
                    </p>
                  </div>
                </div>
              </section>

              <hr className={theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'} />

              {/* Top Bar Actions */}
              <section className="space-y-3">
                <h3 className="font-bold text-lg">Top Bar Buttons</h3>
                <ul className={`list-disc list-inside space-y-2 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  <li><strong>Info:</strong> Opens this reading guide.</li>
                  <li><strong>Light / Dark:</strong> Switches the color theme between night and day modes.</li>
                  <li><strong>Scan All Docs:</strong> Triggers a fresh scan across all documentation feeds.</li>
                  <li><strong>Clear DB:</strong> Clears the local database cache to start fresh.</li>
                </ul>
              </section>
            </div>

            {/* Clean Footer */}
            <div
              className={`flex items-center justify-between border-t px-7 py-4 ${
                theme === 'dark' ? 'border-[#1e2433] bg-[#090b0e]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Bright Data Hackathon &bull; Team Siloed
              </span>
              <button
                onClick={() => setIsInfoOpen(false)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
