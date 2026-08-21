import React from 'react';
import {
  Activity,
  CheckCircle2,
  Compass,
  FileCode,
  FolderSearch,
  Github,
  LucideIcon,
  Radar,
  Radio,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
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

const severityColor = (update?: DocUpdate) => {
  if (!update) return 'bg-slate-400/40';
  if (update.urgency === 'HIGH') return 'bg-red-500';
  if (update.urgency === 'MEDIUM') return 'bg-amber-400';
  return update.category === 'TOOL_SCHEMA_CHANGE' ? 'bg-emerald-400' : 'bg-blue-400';
};

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
  const isDark = theme === 'dark';
  const surface = isDark ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm';
  const subtle = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const navItems: NavItem[] = [
    { id: 'live', label: 'Live Radar & Search', icon: Compass, badge: '⌘K' },
    { id: 'impact', label: 'Code Impact Mapper', icon: FolderSearch },
    { id: 'watcher', label: 'Continuous Watcher', icon: Radio, pulse: watcherStatus.is_running },
    { id: 'check', label: 'Check Manifests', icon: FileCode },
    {
      id: 'github',
      label: 'GitHub PR Studio',
      icon: Github,
      badge: 'AI',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
  ];

  const totalUpdates = updates.length || 1;
  const breakingCount = updates.filter((u) => u.category === 'BREAKING_CHANGE').length;
  const deprecationCount = updates.filter((u) => u.category === 'DEPRECATION').length;
  const featureCount = updates.filter((u) => u.category === 'FEATURE_UPDATE').length;
  const breakingPct = Math.round((breakingCount / totalUpdates) * 100) || 0;
  const deprecationPct = Math.round((deprecationCount / totalUpdates) * 100) || 0;
  const schemaPct = Math.round((schemaCount / totalUpdates) * 100) || 0;
  const featurePct = Math.round((featureCount / totalUpdates) * 100) || 0;

  const orderedUpdates = [...updates].sort(
    (a, b) => new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime()
  );
  const pulseBars: Array<DocUpdate | null> = orderedUpdates.length
    ? orderedUpdates.slice(0, 16).reverse()
    : Array.from({ length: 16 }, () => null);

  return (
    <aside className="w-full shrink-0 select-none lg:sticky lg:top-[72px] lg:h-[calc(100vh-88px)] lg:w-[264px] lg:overflow-y-auto lg:pr-1 scrollbar-thin">
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <div className={`rounded-xl border p-2.5 transition ${surface}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Advisories</span>
            <p className={`my-1 text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{updates.length}</p>
            <span className="text-[10px] font-medium text-indigo-400">FTS5 indexed</span>
          </div>

          <div className={`rounded-xl border border-red-500/30 p-2.5 transition ${isDark ? 'bg-[#11141c]' : 'bg-white shadow-sm'}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-500">High urgency</span>
            <p className="my-1 text-xl font-black text-red-500">{highCount}</p>
            <span className="text-[10px] font-medium text-red-400/80">Needs review</span>
          </div>

          <div className={`rounded-xl border border-emerald-500/30 p-2.5 transition ${isDark ? 'bg-[#11141c]' : 'bg-white shadow-sm'}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-500">Tool schemas</span>
            <p className="my-1 text-xl font-black text-emerald-500">{schemaCount}</p>
            <span className="text-[10px] font-medium text-emerald-400/80">MCP tools</span>
          </div>

          <button
            type="button"
            onClick={() => setIsQuarantineOpen(true)}
            className={`group rounded-xl border border-amber-500/30 p-2.5 text-left transition hover:border-amber-500/70 ${isDark ? 'bg-[#11141c] hover:bg-[#161a25]' : 'bg-white shadow-sm hover:bg-amber-50/40'}`}
          >
            <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500">
              Quarantine
              <ShieldAlert size={13} className="transition-transform group-hover:scale-110" />
            </span>
            <p className="my-1 text-xl font-black text-amber-500">{failedErrorsCount}</p>
            <span className="text-[10px] font-medium text-amber-400/90">Audit vault</span>
          </button>
        </div>

        <section className={`rounded-xl border p-2.5 transition ${surface}`}>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Workspaces</span>
            <span className={`font-mono text-[10px] ${subtle}`}>5 tools</span>
          </div>
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex min-w-0 items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                    isActive
                      ? isDark
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-slate-900 text-white shadow-sm'
                      : isDark
                      ? 'text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      size={15}
                      className={
                        isActive
                          ? isDark
                            ? 'text-black'
                            : 'text-white'
                          : item.pulse
                          ? 'text-emerald-400 animate-pulse'
                          : 'text-[#64748b]'
                      }
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span
                      className={`ml-1 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                        item.badgeColor ||
                        (isActive
                          ? isDark
                            ? 'border-black/20 bg-black/10 text-black'
                            : 'border-white/30 bg-white/20 text-white'
                          : isDark
                          ? 'border-[#1e2433] bg-[#161a25] text-[#94a3b8]'
                          : 'border-slate-200 bg-slate-100 text-slate-500')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className={`rounded-xl border p-3 transition ${surface}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Radar size={15} className="text-indigo-400" />
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Signal pulse</h2>
                <p className={`mt-0.5 text-[10px] ${subtle}`}>Latest drift signals</p>
              </div>
            </div>
            <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-400">LIVE</span>
          </div>

          <div className={`relative mt-3 flex h-[74px] items-end gap-1 overflow-hidden rounded-lg border px-2 pb-2 pt-3 ${isDark ? 'border-[#1e2433] bg-[#0c0e14]' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`absolute inset-x-2 top-1/2 border-t border-dashed ${isDark ? 'border-slate-700/70' : 'border-slate-300'}`} />
            {pulseBars.map((item, index) => {
              const height = item ? (item.urgency === 'HIGH' ? 88 : item.urgency === 'MEDIUM' ? 62 : 38) : 20 + ((index * 13) % 28);
              return (
                <span
                  key={item?.entry_id || `empty-${index}`}
                  title={item ? `${item.urgency} · ${item.title}` : 'No scan data'}
                  className={`relative z-10 min-w-0 flex-1 rounded-t-sm transition-all duration-500 ${severityColor(item)}`}
                  style={{ height: `${height}%`, opacity: item ? 0.95 : 0.35 }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-[#64748b]">
            <span>older</span><span>{updates.length ? `${Math.min(updates.length, 16)} sampled` : 'awaiting scan'}</span><span>newer</span>
          </div>

          <div className={`mt-3 border-t pt-2.5 ${isDark ? 'border-[#1e2433]' : 'border-slate-200'}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Risk mix</span>
              <span className={`font-mono text-[10px] ${subtle}`}>{updates.length} signals</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-700/20">
              <span className="bg-red-500 transition-all duration-500" style={{ width: `${breakingPct}%` }} />
              <span className="bg-amber-400 transition-all duration-500" style={{ width: `${deprecationPct}%` }} />
              <span className="bg-emerald-400 transition-all duration-500" style={{ width: `${schemaPct}%` }} />
              <span className="bg-blue-400 transition-all duration-500" style={{ width: `${featurePct}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-red-500" />Breaking</span><b className="font-mono text-red-400">{breakingCount}</b></span>
              <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-400" />Deprecate</span><b className="font-mono text-amber-400">{deprecationCount}</b></span>
              <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Schemas</span><b className="font-mono text-emerald-400">{schemaCount}</b></span>
              <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-blue-400" />Features</span><b className="font-mono text-blue-400">{featureCount}</b></span>
            </div>
          </div>
        </section>

        <section className={`rounded-xl border p-3 transition ${surface}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Intelligence loop</span>
            </div>
            <span className={`h-2 w-2 rounded-full ${watcherStatus.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          </div>
          <div className="grid grid-cols-3 items-start gap-1">
            {[
              ['01', 'Ingest', 'Feeds'],
              ['02', 'Detect', 'AST + LLM'],
              ['03', 'Protect', 'Repair gate'],
            ].map(([number, label, detail], index) => (
              <React.Fragment key={number}>
                <div className="min-w-0 text-center">
                  <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold ${index === 2 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'}`}>{number}</span>
                  <p className={`mt-1 truncate text-[10px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                  <p className="truncate text-[9px] text-[#64748b]">{detail}</p>
                </div>
                {index < 2 && <span className="mt-3 h-px bg-gradient-to-r from-indigo-500/40 to-emerald-500/40" />}
              </React.Fragment>
            ))}
          </div>
          <div className={`mt-3 flex items-center justify-between border-t pt-2 text-[10px] ${isDark ? 'border-[#1e2433]' : 'border-slate-200'}`}>
            <span className={subtle}>{watcherStatus.is_running ? 'Watcher online' : 'Watcher ready'}</span>
            <span className="flex items-center gap-1 font-mono text-emerald-400"><CheckCircle2 size={11} /> safe-by-default</span>
          </div>
        </section>

        <section className={`rounded-xl border p-3 transition ${surface}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Bright Data studio</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <button
            type="button"
            onClick={() => setIsFixModalOpen(true)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition ${isDark ? 'border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 text-indigo-200 hover:border-indigo-400 hover:text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'}`}
          >
            <Wrench size={14} className="text-indigo-400" />
            <span>Open self-healing studio</span>
          </button>
        </section>
      </div>
    </aside>
  );
};
