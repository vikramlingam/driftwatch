import React from 'react';
import { Upload, Search, AlertTriangle, CheckCircle2, ArrowUpRight, Copy } from 'lucide-react';
import { AuditResponse, AuditMatch } from '../types';
import { Pagination } from './Pagination';

interface ManifestAuditTabProps {
  theme: 'dark' | 'light';
  auditType: 'requirements.txt' | 'package.json' | 'mcp_config.json';
  setAuditType: (type: 'requirements.txt' | 'package.json' | 'mcp_config.json') => void;
  auditInput: string;
  setAuditInput: (val: string) => void;
  auditLoading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  runAudit: (content: string, type: string) => Promise<void>;
  auditResult: AuditResponse | null;
  paginatedAuditMatches: AuditMatch[];
  auditPage: number;
  setAuditPage: React.Dispatch<React.SetStateAction<number>>;
  copySnippet: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ManifestAuditTab: React.FC<ManifestAuditTabProps> = ({
  theme,
  auditType,
  setAuditType,
  auditInput,
  setAuditInput,
  auditLoading,
  handleFileUpload,
  runAudit,
  auditResult,
  paginatedAuditMatches,
  auditPage,
  setAuditPage,
  copySnippet,
  copiedId,
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Check Project Manifests
            </h2>
            <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
              Upload or paste your manifest file to audit against real breaking changes across APIs and MCP schemas.
            </p>
          </div>

          <label
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-4 py-2 text-xs font-semibold transition ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#161a25] text-white hover:bg-[#1d2332]'
                : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Upload size={13} />
            <span>Upload Manifest File</span>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.json,.lock"
            />
          </label>
        </div>

        {/* Manifest Type Selector */}
        <div className="mt-5 flex items-center gap-2">
          {(['requirements.txt', 'package.json', 'mcp_config.json'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAuditType(t)}
              className={`rounded-md px-3.5 py-1.5 font-mono text-xs transition ${
                auditType === t
                  ? theme === 'dark'
                    ? 'bg-white text-black font-bold'
                    : 'bg-slate-900 text-white font-bold'
                  : theme === 'dark'
                  ? 'bg-[#11141c] text-[#94a3b8] hover:text-white border border-[#1e2433]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Manifest Textarea Input */}
        <div className="mt-4">
          <textarea
            rows={7}
            value={auditInput}
            onChange={(e) => setAuditInput(e.target.value)}
            placeholder={`Paste ${auditType} content here...`}
            className={`w-full rounded-md border p-4 font-mono text-xs outline-none transition ${
              theme === 'dark'
                ? 'border-[#1e2433] bg-[#0c0e13] text-[#f8fafc] placeholder-[#64748b] focus:border-[#2b3347]'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
            }`}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => runAudit(auditInput, auditType)}
            disabled={auditLoading || !auditInput.trim()}
            className={`flex items-center gap-2 rounded-md px-5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-white text-[#090b0e] hover:bg-slate-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <Search size={14} />
            <span>{auditLoading ? 'Auditing…' : 'Audit Dependencies'}</span>
          </button>
        </div>
      </div>

      {/* Audit Results View */}
      {auditResult && (
        <div className="space-y-4">
          <div className="card-dark p-5">
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-md ${
                  auditResult.issues_found_count > 0
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                }`}
              >
                {auditResult.issues_found_count > 0 ? (
                  <AlertTriangle size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {auditResult.issues_found_count > 0
                    ? `${auditResult.issues_found_count} Upstream Risk(s) Detected`
                    : 'Manifest Clean — No Known Breaking Changes'}
                </h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                  Checked {auditResult.total_items_checked} dependency packages/tools across active advisories.
                </p>
              </div>
            </div>
          </div>

          {paginatedAuditMatches.map((match, idx) => (
            <div
              key={match.package_or_tool + idx}
              className={`card-dark p-5 space-y-3.5 border-amber-500/30 ${
                theme === 'dark' ? 'bg-[#161a25]' : 'bg-white'
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-semibold ${
                      theme === 'dark' ? 'bg-white text-[#090b0e]' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {match.package_or_tool}
                  </span>
                  <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {match.matched_update.title}
                  </span>
                  <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/30">
                    {match.matched_update.category}
                  </span>
                </div>

                <a
                  href={match.matched_update.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-1 text-xs underline ${
                    theme === 'dark' ? 'text-[#94a3b8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Documentation</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>

              <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                {match.plain_warning}
              </p>

              {/* Ready to use fix snippet */}
              {match.ready_to_use_fix && (
                <div
                  className={`rounded-md border p-4 font-mono ${
                    theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between border-b pb-2 text-xs ${
                      theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                    }`}
                  >
                    <span className={`font-semibold text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Recommended Fix
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copySnippet(match.ready_to_use_fix!, `fix-${idx}`)}
                        className={`flex items-center gap-1 text-xs ${
                          theme === 'dark' ? 'text-[#94a3b8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Copy size={13} />
                        <span>{copiedId === `fix-${idx}` ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <pre
                    className={`mt-2.5 overflow-x-auto text-xs leading-relaxed ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                    }`}
                  >
                    {match.ready_to_use_fix}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {/* Pagination Controls for Tab 4 */}
          <Pagination
            page={auditPage}
            totalItems={auditResult.matches.length}
            itemsPerPage={20}
            setPage={setAuditPage}
            itemLabel="dependency issues"
            theme={theme}
          />
        </div>
      )}
    </div>
  );
};
