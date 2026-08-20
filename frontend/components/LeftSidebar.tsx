import React from 'react';
import { Compass, FolderSearch, Radio, FileCode, Github, Wrench, ShieldAlert, LucideIcon } from 'lucide-react';
import { DocUpdate, WatcherStatus } from '../types';

interface LeftSidebarProps {
  theme: 'dark' | 'light';
  updates: DocUpdate[];
  highCount: number;
  schemaCount: number;
  failedErrorsCount: number;
  tab: 'live' | 'impact' | 'watcher' | 'check' | 'github';
  setTab: (tab: 'live' | 'impact' | 'watcher' | 'check' | 'github') => void;
  watcherStatus: WatcherStatus;
  setIsQuarantineOpen: (open: boolean) => void;
  setIsFixModalOpen: (open: boolean) => void;
}

interface NavItem {
  id: 'live' | 'impact' | 'watcher' | 'check' | 'github';
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  pulse?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  theme,
  updates,
  highCount,
  schemaCount,
  failedErrorsCount,
  tab,
  setTab,
  watcherStatus,
  setIsQuarantineOpen,
  setIsFixModalOpen,
}) => {
  const navItems: NavItem[] = [
    { id: 'live', label: 'Live Radar & Search', icon: Compass, badge: '⌘K' },
    { id: 'impact', label: 'Code Impact Mapper', icon: FolderSearch },
    { id: 'watcher', label: 'Continuous Watcher', icon: Radio, pulse: watcherStatus.is_running },
    { id: 'check', label: 'Check Manifests', icon: FileCode },
    {
      id: 'github',
      label: 'GitHub PR',
      icon: Github,
      badge: 'AI',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
  ];

  return (
    <aside className="w-full lg:w-[255px] shrink-0 lg:sticky lg:top-[60px] lg:max-h-[calc(100vh-70px)] lg:overflow-y-auto space-y-3.5">
      {/* 4 Metric Stats Cards in 2x2 Bento Box Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className={`rounded-xl border p-3 flex flex-col justify-between transition ${
            theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">
            Advisories
          </span>
          <p className={`mt-1 text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {updates.length}
          </p>
          <span className="text-[9px] text-[#64748b]">FTS5 Indexed</span>
        </div>

        <div
          className={`rounded-xl border p-3 flex flex-col justify-between transition ${
            theme === 'dark' ? 'bg-[#11141c] border-red-500/30' : 'bg-white border-red-200 shadow-sm'
          }`}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">
            High Urgency
          </span>
          <p className="mt-1 text-xl font-black text-red-500">{highCount}</p>
          <span className="text-[9px] text-[#64748b]">Breaking API</span>
        </div>

        <div
          className={`rounded-xl border p-3 flex flex-col justify-between transition ${
            theme === 'dark' ? 'bg-[#11141c] border-emerald-500/30' : 'bg-white border-emerald-200 shadow-sm'
          }`}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">
            Tool Schemas
          </span>
          <p className="mt-1 text-xl font-black text-emerald-500">{schemaCount}</p>
          <span className="text-[9px] text-[#64748b]">MCP Tools</span>
        </div>

        <div
          onClick={() => setIsQuarantineOpen(true)}
          className={`rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition ${
            theme === 'dark'
              ? 'bg-[#11141c] border-amber-500/30 hover:border-amber-500/60'
              : 'bg-white border-amber-200 shadow-sm hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
              Quarantine
            </span>
            <ShieldAlert size={12} className="text-amber-500" />
          </div>
          <p className="mt-1 text-xl font-black text-amber-500">{failedErrorsCount}</p>
          <span className="text-[9px] text-[#64748b]">Click to view</span>
        </div>
      </div>

      {/* Feature Navigation Panel (5 Dedicated Feature Buttons) */}
      <div
        className={`rounded-xl border p-3 space-y-1 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
          Navigation & Tools
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'bg-slate-900 text-white font-bold shadow-sm'
                  : theme === 'dark'
                  ? 'text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={15}
                  className={
                    isActive
                      ? theme === 'dark' ? 'text-black' : 'text-white'
                      : item.pulse
                      ? 'text-emerald-400 animate-pulse'
                      : 'text-[#64748b]'
                  }
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border ${
                    item.badgeColor ||
                    (isActive
                      ? theme === 'dark' ? 'bg-black/10 text-black border-black/20' : 'bg-white/20 text-white border-white/30'
                      : theme === 'dark' ? 'bg-[#161a25] text-[#94a3b8] border-[#1e2433]' : 'bg-slate-100 text-slate-500 border-slate-200')
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Self-Healing Scraper Studio Quick Launcher */}
      <div
        className={`rounded-xl border p-3 space-y-2 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
            Bright Data Studio
          </span>
          <span className="h-2 w-2 rounded-full bg-[#10b981]"></span>
        </div>
        <button
          onClick={() => setIsFixModalOpen(true)}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
            theme === 'dark'
              ? 'border-[#232a3d] bg-[#161a25] text-white hover:bg-[#1f2536]'
              : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Wrench size={13} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
          <span>Self-Healing Studio</span>
        </button>
      </div>
    </aside>
  );
};
