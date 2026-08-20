import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
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
  return (
    <aside className="hidden xl:block w-[260px] shrink-0 sticky top-[68px] max-h-[calc(100vh-80px)] overflow-y-auto space-y-4">
      <div
        className={`rounded-xl border p-4 space-y-3 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-indigo-400" />
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              Documentations
            </h3>
          </div>
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${
              theme === 'dark'
                ? 'bg-[#161a25] text-slate-300 border-[#1e2433]'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {TARGETS.length - 1}
          </span>
        </div>

        {/* List of documentation feeds formatted strictly in ONE SINGLE LINE per item */}
        <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {TARGETS.map((t) => {
            const isSelected = ecosystem === t;
            const count = t === 'All' ? updates.length : ecosystemCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setEcosystem(t)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : theme === 'dark'
                    ? 'text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-white' : count > 0 ? 'bg-emerald-400' : 'bg-slate-400'
                    }`}
                  />
                  <span className="truncate">{t}</span>
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
        </div>

        {/* Quick Add Custom Target */}
        <div className={`pt-2 border-t ${theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'}`}>
          <button
            onClick={() => setIsAddTargetOpen(true)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
              theme === 'dark'
                ? 'border-[#1e2433] bg-[#161a25] text-[#94a3b8] hover:text-white hover:bg-[#1f2536]'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Plus size={13} />
            <span>Add Target Feed</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
