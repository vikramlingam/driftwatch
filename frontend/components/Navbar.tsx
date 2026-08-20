import React from 'react';
import { Sun, Moon, RefreshCw, Trash2 } from 'lucide-react';
import { SystemHealth } from '../types';

interface NavbarProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  systemHealth: SystemHealth;
  loading: boolean;
  handleScrape: (overrideUrls?: string[]) => Promise<void>;
  handleClearDatabase: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  toggleTheme,
  systemHealth,
  loading,
  handleScrape,
  handleClearDatabase,
}) => {
  return (
    <nav
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        theme === 'dark'
          ? 'border-[#1b202e] bg-[#090b0e]/90'
          : 'border-[#e2e8f0] bg-white/90 shadow-sm'
      }`}
    >
      <div className="mx-auto flex max-w-[1650px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-black tracking-tight ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              DriftWatch
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                theme === 'dark'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              Studio
            </span>
          </div>
          <span className={theme === 'dark' ? 'text-[#3b445c]' : 'text-slate-300'}>|</span>
          <span
            className={`hidden text-xs sm:inline font-medium ${
              theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-500'
            }`}
          >
            Developer Intelligence Radar & Self-Healing Scraper Studio
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
              theme === 'dark'
                ? 'border-[#1b202e] bg-[#11141c] text-[#94a3b8]'
                : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>{systemHealth.records} Advisories Active</span>
          </div>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
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
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-white text-black hover:bg-slate-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Scanning…' : 'Scan All Docs'}</span>
          </button>

          <button
            onClick={handleClearDatabase}
            disabled={loading}
            title="Clear all indexed advisories from SQLite database"
            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Clear DB</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
