import React from 'react';
import { Search, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { DocUpdate } from '../types';
import { Pagination } from './Pagination';

interface LiveRadarTabProps {
  theme: 'dark' | 'light';
  query: string;
  setQuery: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  filteredUpdates: DocUpdate[];
  paginatedUpdates: DocUpdate[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setSelectedItem: (item: DocUpdate) => void;
  loading: boolean;
  handleScrape: (overrideUrls?: string[]) => Promise<void>;
}

export const LiveRadarTab: React.FC<LiveRadarTabProps> = ({
  theme,
  query,
  setQuery,
  searchInputRef,
  categoryFilter,
  setCategoryFilter,
  filteredUpdates,
  paginatedUpdates,
  currentPage,
  setCurrentPage,
  setSelectedItem,
  loading,
  handleScrape,
}) => {
  const categories = [
    { label: 'All Updates', value: 'ALL' },
    { label: 'Breaking Changes', value: 'BREAKING_CHANGE' },
    { label: 'Deprecations', value: 'DEPRECATION' },
    { label: 'Tool Schema Changes', value: 'TOOL_SCHEMA_CHANGE' },
    { label: 'Feature Releases', value: 'FEATURE_UPDATE' },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar & Category Filter Controls */}
      <div
        className={`rounded-xl border p-4 space-y-3 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-[#64748b]" size={15} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search breaking changes, functions, methods, packages (e.g. charges, tool)…"
            className={`w-full rounded-lg border py-2.5 pl-10 pr-9 text-xs outline-none transition ${
              theme === 'dark'
                ? 'border-[#1e2433] bg-[#11141c] text-white placeholder-[#64748b] focus:border-[#2b3347]'
                : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-500'
            }`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-3 text-[#64748b] hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={`rounded-md px-3 py-1.5 whitespace-nowrap text-xs transition ${
                categoryFilter === c.value
                  ? theme === 'dark'
                    ? 'bg-white text-black font-bold'
                    : 'bg-slate-900 text-white font-bold'
                  : theme === 'dark'
                  ? 'bg-[#161a25] text-[#94a3b8] hover:bg-[#1e2433] hover:text-white border border-[#1e2433]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Updates Feed — Bento Box Cards */}
      <div className="space-y-4">
        {paginatedUpdates.map((item) => {
          const isBreaking = item.category === 'BREAKING_CHANGE';
          const isDeprecation = item.category === 'DEPRECATION';

          return (
            <article
              key={item.entry_id}
              onClick={() => setSelectedItem(item)}
              className={`group cursor-pointer p-3 sm:p-4 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'bg-[#10131b] border-[#1e2433] hover:border-[#333d57]'
                  : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Inner Box 1: Advisory Overview */}
                <div
                  className={`rounded-lg border p-4 sm:p-5 flex flex-col justify-between ${
                    theme === 'dark' ? 'bg-[#141822] border-[#1b202e]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="font-mono text-[11px] font-semibold text-[#64748b]">
                        {item.ecosystem}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                          isBreaking
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : isDeprecation
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {item.urgency} URGENCY
                      </span>
                    </div>

                    <h2
                      className={`text-sm sm:text-base font-semibold tracking-tight leading-snug ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </h2>
                    <p
                      className={`mt-2 text-xs leading-relaxed line-clamp-3 ${
                        theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'
                      }`}
                    >
                      {item.plain_summary}
                    </p>

                    {/* What Changed from What (Authentic Migrations Only) */}
                    {item.affected_code && item.affected_code.length > 0 && (
                      <div
                        className={`mt-3 rounded-md p-2 font-mono text-[11px] border flex flex-wrap items-center gap-1.5 ${
                          theme === 'dark' ? 'bg-[#0c0e14] border-[#1e2433]' : 'bg-white border-slate-200'
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold text-[#64748b] mr-1">
                          Target APIs:
                        </span>
                        {item.affected_code.slice(0, 3).map((token) => (
                          <span
                            key={token}
                            className={`rounded px-2 py-0.5 text-[10px] border ${
                              theme === 'dark'
                                ? 'bg-[#161a25] text-slate-300 border-[#1e2433]'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-[#64748b]">
                    <span>trace</span>
                    <span>·</span>
                    <span>{item.ecosystem.toLowerCase()}</span>
                    <span>·</span>
                    <span
                      className={
                        isBreaking
                          ? 'text-red-400 font-semibold'
                          : isDeprecation
                          ? 'text-amber-400 font-semibold'
                          : 'text-[#10b981] font-semibold'
                      }
                    >
                      {item.category.toLowerCase().replaceAll('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Inner Box 2: Trace Execution & Summary */}
                <div
                  className={`rounded-lg border p-4 flex flex-col justify-between font-mono text-xs ${
                    theme === 'dark' ? 'bg-[#0c0e14] border-[#1b202e]' : 'bg-slate-100/70 border-slate-200'
                  }`}
                >
                  <div>
                    {/* Trace Header */}
                    <div
                      className={`flex items-center justify-between border-b pb-2.5 ${
                        theme === 'dark' ? 'border-[#1b202e] text-[#94a3b8]' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>run_{item.entry_id.slice(-6)}</span>
                        <span>·</span>
                        <span>{item.ecosystem.toLowerCase()}</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded bg-[#10b981]/15 px-2 py-0.5 text-[10px] font-semibold text-[#10b981] border border-[#10b981]/30">
                        <CheckCircle2 size={11} />
                        <span>INDEXED ADVISORY</span>
                      </div>
                    </div>

                    {/* Call Operations */}
                    <div className="mt-2.5 space-y-1.5">
                      {(item.affected_code.length > 0
                        ? item.affected_code.slice(0, 3)
                        : [item.ecosystem.toLowerCase()]
                      ).map((code, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between py-0.5 border-b last:border-0 ${
                            theme === 'dark'
                              ? 'text-slate-300 border-[#161a25]'
                              : 'text-slate-700 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#64748b]">&gt;_</span>
                            <span>{code}</span>
                          </div>
                          <span className="text-emerald-500 font-mono text-[10px] font-medium tracking-tight">Tracked AST Token</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advisory Summary */}
                  <div
                    className={`mt-3 border-t pt-2.5 ${
                      theme === 'dark' ? 'border-[#1b202e]' : 'border-slate-200'
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                      ADVISORY SUMMARY
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] truncate ${
                        theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'
                      }`}
                    >
                      Urgency {item.urgency} · Source: {item.source_url}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {/* Pagination Controls for Tab 1 */}
        <Pagination
          page={currentPage}
          totalItems={filteredUpdates.length}
          itemsPerPage={20}
          setPage={setCurrentPage}
          itemLabel="advisories"
          theme={theme}
        />

        {!filteredUpdates.length && !loading && (
          <div className="card-dark p-12 text-center">
            <ShieldAlert className="mx-auto text-[#64748b]" size={36} />
            <h3 className="mt-4 text-base font-semibold text-white">No Matching Updates Found</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs text-[#94a3b8]">
              Try adjusting your search query, clearing filters, or running a documentation scan.
            </p>
            <button
              onClick={() => handleScrape()}
              className="mt-5 rounded-md bg-white px-4 py-2 text-xs font-semibold text-[#090b0e] hover:bg-slate-200"
            >
              Scan Documentation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
