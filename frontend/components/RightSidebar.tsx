import React, { useState } from 'react';
import { Plus, Search, Layers } from 'lucide-react';
import { TARGETS, DocUpdate } from '../types';

interface RightSidebarProps {
  theme: 'dark' | 'light';
  ecosystem: string;
  setEcosystem: (eco: string) => void;
  updates: DocUpdate[];
  ecosystemCounts: Record<string, number>;
  setIsAddTargetOpen: (open: boolean) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  theme,
  ecosystem,
  setEcosystem,
  updates,
  ecosystemCounts,
  setIsAddTargetOpen,
}) => {
  const [filterSearch, setFilterSearch] = useState('');

  const filteredTargets = TARGETS.filter((t) =>
    t.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <aside className="hidden xl:block w-[280px] shrink-0 xl:sticky xl:top-[56px] xl:h-[calc(100vh-72px)] select-none">
      <div
        className={`h-full rounded-xl border p-3 flex flex-col justify-between transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        {/* Top Header & Search Area */}
        <div className="space-y-2.5 shrink-0 pb-2 border-b border-[#1e2433]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-indigo-400" />
              <h3
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Documentations
              </h3>
            </div>
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${
                theme === 'dark'
                  ? 'bg-[#161a25] text-indigo-300 border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
            >
              {TARGETS.length - 1} Feeds
            </span>
          </div>

          {/* Quick Search Filter */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[#64748b]" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Filter ecosystems..."
              className={`w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none transition ${
                theme === 'dark'
                  ? 'bg-[#0b0e14] border-[#1e2433] text-white placeholder-[#64748b] focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
              }`}
            />
          </div>
        </div>

        {/* Scrollable Feed List (strictly fits remaining space) */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-1 pr-1 scrollbar-thin">
          {filteredTargets.map((t) => {
            const isSelected = ecosystem === t;
            const count = t === 'All' ? updates.length : ecosystemCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setEcosystem(t)}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : theme === 'dark'
                    ? 'text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      isSelected ? 'bg-white' : count > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  <span className="truncate font-medium">{t}</span>
                </div>

                <span
                  className={`font-mono text-[10px] rounded px-1.5 py-0.5 shrink-0 ml-2 ${
                    isSelected
                      ? 'bg-white/20 text-white font-bold'
                      : count > 0
                      ? theme === 'dark'
                        ? 'bg-[#11141c] text-emerald-400 font-semibold border border-emerald-500/20'
                        : 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                      : theme === 'dark'
                      ? 'bg-[#11141c] text-[#64748b] border border-[#1e2433]'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {count} items
                </span>
              </button>
            );
          })}

          {filteredTargets.length === 0 && (
            <div className="py-6 text-center text-xs text-[#64748b]">
              No matching ecosystems
            </div>
          )}
        </div>

        {/* Bottom Pinned Add Target Feed Button */}
        <div className={`pt-2 border-t shrink-0 ${theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'}`}>
          <button
            onClick={() => setIsAddTargetOpen(true)}
            className={`w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition ${
              theme === 'dark'
                ? 'border-[#1e2433] bg-[#161a25] text-slate-200 hover:text-white hover:bg-[#1f2536] hover:border-indigo-500/50'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-indigo-400'
            }`}
          >
            <Plus size={13} className="text-indigo-400" />
            <span>Add Custom Target Feed</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
