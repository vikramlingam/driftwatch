import React from 'react';
import { Sun, Moon, RefreshCw, Trash2, Info } from 'lucide-react';
import { SystemHealth } from '../types';

interface NavbarProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  systemHealth: SystemHealth;
  loading: boolean;
  handleScrape: (overrideUrls?: string[]) => Promise<void>;
  handleClearDatabase: () => Promise<void>;
  onOpenInfo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  toggleTheme,
  systemHealth,
  loading,
  handleScrape,
  handleClearDatabase,
  onOpenInfo,
}) => {
  return (
    <nav
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        theme === 'dark'
          ? 'border-[#1b202e] bg-[#090b0e]/90'
          : 'border-[#e2e8f0] bg-white/90 shadow-sm'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-black tracking-tight sm:text-xl ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              Drift Watch
            </span>
            <span
              className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide sm:inline ${
                theme === 'dark'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              by Team Siloed
            </span>
          </div>
          <span className={`hidden sm:inline ${theme === 'dark' ? 'text-[#3b445c]' : 'text-slate-300'}`}>|</span>
          <span
            className={`hidden max-w-[340px] truncate text-xs font-medium md:inline ${
              theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-500'
            }`}
          >
            Breaking Changes & API Drift Intelligence Radar
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium lg:flex ${
              theme === 'dark'
                ? 'border-[#1b202e] bg-[#11141c] text-[#94a3b8]'
                : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{systemHealth.records} Advisories Active</span>
          </div>

          {/* Info & Help Guide Modal Button */}
          <button
            onClick={onOpenInfo}
            aria-label="Open Drift Watch guide"
            title="How to use Drift Watch (Project Guide)"
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition sm:px-3 ${
              theme === 'dark'
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Info size={14} />
            <span className="hidden font-bold sm:inline">Info</span>
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
              theme === 'dark'
                ? 'border-[#232a3d] bg-[#11141c] text-amber-300 hover:bg-[#161a25]'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            onClick={() => handleScrape()}
            disabled={loading}
            aria-label={loading ? 'Scanning documentation' : 'Scan all documentation feeds'}
            title={loading ? 'Scanning documentation' : 'Scan all documentation feeds'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 sm:px-3.5 ${
              theme === 'dark'
                ? 'bg-white text-black hover:bg-slate-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{loading ? 'Scanning…' : 'Scan All Docs'}</span>
          </button>

          <button
            onClick={handleClearDatabase}
            disabled={loading}
            aria-label="Clear indexed database"
            title="Clear all indexed advisories from SQLite database"
            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 sm:px-3"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Clear DB</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
