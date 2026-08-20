import React from 'react';
import { Radio, Play, Square, SlidersHorizontal, Activity } from 'lucide-react';
import { WatcherStatus } from '../types';

interface WatcherTabProps {
  theme: 'dark' | 'light';
  watcherStatus: WatcherStatus;
  watcherLoading: boolean;
  handleToggleWatcher: () => Promise<void>;
}

export const WatcherTab: React.FC<WatcherTabProps> = ({
  theme,
  watcherStatus,
  watcherLoading,
  handleToggleWatcher,
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5 ${
            theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <Radio
                className={watcherStatus.is_running ? 'text-[#10b981] animate-pulse' : 'text-[#64748b]'}
                size={18}
              />
              <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Continuous Drift Watcher Cockpit
              </h2>
            </div>
            <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
              Background worker daemon periodically checks for documentation changes and automatically recovers scrapers on DOM mutations.
            </p>
          </div>

          <button
            onClick={handleToggleWatcher}
            disabled={watcherLoading}
            className={`flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
              watcherStatus.is_running
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                : 'bg-[#10b981] text-white hover:bg-[#059669]'
            }`}
          >
            {watcherStatus.is_running ? <Square size={14} /> : <Play size={14} />}
            <span>
              {watcherLoading
                ? 'Processing…'
                : watcherStatus.is_running
                ? 'Stop Watcher Daemon'
                : 'Start Watcher Daemon'}
            </span>
          </button>
        </div>

        {/* 4 Status Metric Cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Daemon Status
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  watcherStatus.is_running ? 'bg-[#10b981] animate-ping' : 'bg-slate-600'
                }`}
              />
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {watcherStatus.is_running ? 'ACTIVE (CRON)' : 'STANDBY'}
              </p>
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Monitored Target Feeds
            </span>
            <p className={`mt-1 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {watcherStatus.monitored_targets_count} Documentation Sources
            </p>
          </div>

          <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Heals Triggered
            </span>
            <p className="mt-1 text-sm font-bold text-amber-500">
              {watcherStatus.heal_events_triggered_count} Self-Healing Runs
            </p>
          </div>

          <div className={`rounded-lg border p-4 ${theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Cron Scan Interval
            </span>
            <p className={`mt-1 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Every {watcherStatus.interval_seconds}s
            </p>
          </div>
        </div>

        {/* Configuration settings banner */}
        <div
          className={`mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-4 ${
            theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={16} className="text-[#64748b]" />
            <div>
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Zero-Downtime Autonomous Recovery
              </span>
              <p className={`text-[11px] ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                When scrapers encounter schema breaks during periodic polls, the 4-stage pipeline automatically synthesizes fixes and restarts data ingestion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
              Bright Data Web Collector
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Watcher Activity Feed Console */}
      <div
        className={`rounded-xl border p-6 space-y-4 transition ${
          theme === 'dark' ? 'bg-[#11141c] border-[#1e2433]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" />
            <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Watcher Daemon Live Activity Feed
            </h3>
          </div>
          <span className="text-[11px] text-[#64748b]">
            {watcherStatus.last_run_at ? `Last run: ${watcherStatus.last_run_at}` : 'Awaiting first run'}
          </span>
        </div>

        <div
          className={`rounded-md border p-4 font-mono text-xs max-h-[400px] overflow-y-auto space-y-2 ${
            theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {watcherStatus.recent_watcher_logs.length === 0 ? (
            <div className="py-6 text-center text-[#64748b]">
              No active logs. Start the watcher daemon above to initiate background polling.
            </div>
          ) : (
            watcherStatus.recent_watcher_logs.map((log, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 border-b pb-1.5 last:border-0 ${
                  theme === 'dark' ? 'border-[#161a25]' : 'border-slate-200'
                }`}
              >
                <span className="text-[#64748b] text-[10px] select-none">&gt;</span>
                <span
                  className={
                    log.includes('Triggered') || log.includes('error') || log.includes('High-Risk')
                      ? 'text-amber-400'
                      : log.includes('SUCCESS') || log.includes('verified healthy') || log.includes('approved')
                      ? 'text-[#10b981]'
                      : theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }
                >
                  {log}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* High-Risk Manual Approval Queue */}
      {watcherStatus.pending_repairs && watcherStatus.pending_repairs.length > 0 && (
        <div
          className={`rounded-xl border p-6 space-y-4 transition ${
            theme === 'dark' ? 'bg-[#11141c] border-amber-500/40' : 'bg-white border-amber-300 shadow-sm'
          }`}
        >
          <div
            className={`flex items-center justify-between border-b pb-3 ${
              theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
            }`}
          >
            <div>
              <h3 className={`text-sm font-bold text-amber-500 flex items-center gap-2`}>
                <span>⚠️ High-Risk Scraper Repair Approval Queue</span>
                <span className="rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5 text-[10px] font-mono">
                  {watcherStatus.pending_repairs.filter(r => r.status === 'PENDING').length} Pending
                </span>
              </h3>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                Continuous Watcher detected breaking schema changes flagged as high risk. Human operator approval is required before deploying patch to database.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {watcherStatus.pending_repairs.map((repair) => (
              <div
                key={repair.repair_id}
                className={`rounded-lg border p-4 text-xs space-y-2.5 ${
                  theme === 'dark' ? 'border-[#1e2433] bg-[#0c0e13]' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-300">{repair.repair_id}</span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      {repair.risk_level}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-mono ${
                      repair.status === 'PENDING' ? 'bg-indigo-500/20 text-indigo-400' :
                      repair.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {repair.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748b]">{repair.created_at}</span>
                </div>

                <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                  <strong>Target Feed:</strong> <span className="font-mono text-emerald-400">{repair.target_url}</span>
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
                  <strong>Diagnostic:</strong> {repair.issue_description}
                </p>

                {repair.proposed_fix && (
                  <pre className="rounded bg-[#08090d] p-2.5 font-mono text-[11px] text-slate-300 overflow-x-auto border border-[#161a25]">
                    {repair.proposed_fix}
                  </pre>
                )}

                {repair.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={async () => {
                        try {
                          const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                          await fetch(`${apiBase}/api/watcher/approve-repair/${repair.repair_id}`, { method: 'POST' });
                          window.location.reload();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 text-xs transition"
                    >
                      ✓ Approve & Deploy Fix
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                          await fetch(`${apiBase}/api/watcher/reject-repair/${repair.repair_id}`, { method: 'POST' });
                          window.location.reload();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="rounded bg-red-600/80 hover:bg-red-600 text-white font-semibold px-3 py-1.5 text-xs transition"
                    >
                      ✕ Reject Patch
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
