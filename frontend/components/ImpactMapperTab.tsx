import React from 'react';
import { FolderSearch, Copy, ExternalLink, Eye } from 'lucide-react';
import { CodebaseImpactReport, FileImpactMatch, DocUpdate } from '../types';
import { Pagination } from './Pagination';

interface ImpactMapperTabProps {
  theme: 'dark' | 'light';
  impactDirectory: string;
  setImpactDirectory: (dir: string) => void;
  impactLoading: boolean;
  handleScanDirectoryImpact: () => Promise<void>;
  impactReport: CodebaseImpactReport | null;
  paginatedImpactMatches: FileImpactMatch[];
  impactPage: number;
  setImpactPage: React.Dispatch<React.SetStateAction<number>>;
  copySnippet: (text: string, id: string) => void;
  copiedId: string | null;
  updates: DocUpdate[];
  setSelectedItem: (item: DocUpdate) => void;
}

export const ImpactMapperTab: React.FC<ImpactMapperTabProps> = ({
  theme,
  impactDirectory,
  setImpactDirectory,
  impactLoading,
  handleScanDirectoryImpact,
  impactReport,
  paginatedImpactMatches,
  impactPage,
  setImpactPage,
  copySnippet,
  copiedId,
  updates,
  setSelectedItem,
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Local Code Impact Mapper
            </h2>
            <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
              Scan your local project files for imported functions, SDK method calls, and MCP tool schemas matching upstream breaking changes.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            value={impactDirectory}
            onChange={(e) => setImpactDirectory(e.target.value)}
            placeholder="Enter local repository directory path (e.g. . or ./backend)..."
            className={`flex-1 rounded-md border px-4 py-2.5 font-mono text-xs outline-none transition ${
              theme === 'dark'
                ? 'border-[#1e2433] bg-[#0c0e13] text-white placeholder-[#64748b] focus:border-[#2b3347]'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
            }`}
          />
          <button
            onClick={handleScanDirectoryImpact}
            disabled={impactLoading || !impactDirectory.trim()}
            className={`flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-white text-[#090b0e] hover:bg-slate-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <FolderSearch size={14} className={impactLoading ? 'animate-spin' : ''} />
            <span>{impactLoading ? 'Scanning Codebase…' : 'Scan Directory'}</span>
          </button>
        </div>
      </div>

      {/* Impact Report View */}
      {impactReport && (
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-5 flex items-center justify-between transition ${
              theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold">
                {impactReport.impacted_files_count}
              </div>
              <div>
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Impacted Files: {impactReport.impacted_files_count} / {impactReport.scanned_files_count} scanned
                </h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                  Identified {impactReport.total_occurrences_found} potentially impacted code candidate occurrences across project.
                </p>
              </div>
            </div>
          </div>

          {paginatedImpactMatches.map((match, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-5 space-y-3.5 transition ${
                theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              {/* Header */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 ${
                  theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded border ${
                      theme === 'dark'
                        ? 'bg-[#161a25] text-white border-[#1e2433]'
                        : 'bg-slate-100 text-slate-900 border-slate-200'
                    }`}
                  >
                    {match.file_path}:{match.line_number}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                      match.urgency === 'HIGH'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : match.urgency === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                    }`}
                  >
                    {match.urgency} URGENCY
                  </span>
                  {match.ecosystem && (
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        theme === 'dark' ? 'bg-[#1e2433] text-[#94a3b8]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {match.ecosystem}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-500'}`}>
                    Flagged Symbol:{' '}
                    <code className={`font-mono font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {match.symbol_matched}
                    </code>
                  </span>
                </div>
              </div>

              {/* Impact Explanation & Context */}
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-bold leading-snug ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {match.advisory_title}
                    </p>
                    {match.advisory_summary && (
                      <p className={`mt-1 text-xs leading-relaxed ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                        {match.advisory_summary}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Local Code Found */}
              <div
                className={`rounded-md border p-3 font-mono text-xs ${
                  theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 text-[10px] font-semibold uppercase text-[#64748b]">
                  <span>Found in your local file:</span>
                  <span>Line {match.line_number}</span>
                </div>
                <code
                  className={`block overflow-x-auto whitespace-pre-wrap ${
                    theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {match.line_content}
                </code>
              </div>

              {/* Unified Diff if available */}
              {match.unified_diff && (
                <div
                  className={`rounded-md border p-3.5 font-mono text-xs ${
                    theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between pb-2 border-b text-[11px] ${
                      theme === 'dark' ? 'border-[#1e2433] text-[#64748b]' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <span>Suggested Migration Patch</span>
                    <button
                      onClick={() => copySnippet(match.unified_diff!, `diff-${idx}`)}
                      className={`flex items-center gap-1 ${
                        theme === 'dark' ? 'text-[#94a3b8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Copy size={12} />
                      <span>{copiedId === `diff-${idx}` ? 'Copied' : 'Copy Diff'}</span>
                    </button>
                  </div>
                  <pre
                    className={`mt-2 leading-relaxed overflow-x-auto ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                    }`}
                  >
                    {match.unified_diff}
                  </pre>
                </div>
              )}

              {/* Action Bar & Direct Redirection Links */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t ${
                  theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
                }`}
              >
                <div className="text-[11px] text-[#64748b] font-mono">
                  Advisory ID: {match.advisory_id}
                </div>

                <div className="flex items-center gap-2">
                  {match.source_url && (
                    <a
                      href={match.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        theme === 'dark'
                          ? 'bg-white text-[#090b0e] hover:bg-slate-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>Open Official Documentation</span>
                      <ExternalLink size={13} />
                    </a>
                  )}

                  <button
                    onClick={() => {
                      const found = updates.find((u) => u.entry_id === match.advisory_id);
                      if (found) {
                        setSelectedItem(found);
                      } else {
                        setSelectedItem({
                          entry_id: match.advisory_id,
                          ecosystem: match.ecosystem || 'Custom',
                          title: match.advisory_title,
                          category: match.category as any,
                          urgency: match.urgency as any,
                          plain_summary: match.advisory_summary || match.advisory_title,
                          affected_code: [match.symbol_matched],
                          source_url: match.source_url || 'https://docs.stripe.com/changelog',
                          discovered_at: new Date().toISOString(),
                        });
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      theme === 'dark'
                        ? 'border-[#232a3d] bg-[#161a25] text-white hover:bg-[#1d2332]'
                        : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <Eye size={13} />
                    <span>Inspect</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls for Tab 2 */}
          <Pagination
            page={impactPage}
            totalItems={impactReport.matches.length}
            itemsPerPage={20}
            setPage={setImpactPage}
            itemLabel="code candidates"
            theme={theme}
          />
        </div>
      )}
    </div>
  );
};
