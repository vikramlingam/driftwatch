'use client';

import React, { useEffect, useState } from 'react';
import { Radio, Activity, ShieldCheck, Database, Cpu, Sparkles, Terminal, CheckCircle2 } from 'lucide-react';
import { TARGETS, TARGET_URL_MAP } from '../types';

interface ScraperStudioRadarScannerProps {
  theme: 'dark' | 'light';
  emptyState?: boolean;
}

const RADAR_NODES = [
  { name: 'Stripe', x: 72, y: 28, delay: 0 },
  { name: 'OpenAI', x: 28, y: 32, delay: 0.5 },
  { name: 'Anthropic', x: 65, y: 75, delay: 1.0 },
  { name: 'LangChain', x: 22, y: 68, delay: 1.5 },
  { name: 'MCP Specs', x: 80, y: 55, delay: 2.0 },
  { name: 'Supabase', x: 38, y: 82, delay: 2.5 },
  { name: 'Next.js 15', x: 50, y: 18, delay: 3.0 },
  { name: 'FastAPI', x: 84, y: 38, delay: 3.5 },
  { name: 'Pydantic v2', x: 16, y: 48, delay: 4.0 },
  { name: 'ChromaDB', x: 55, y: 88, delay: 4.5 },
];

export const ScraperStudioRadarScanner: React.FC<ScraperStudioRadarScannerProps> = ({
  theme,
  emptyState = false,
}) => {
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    'Initializing Bright Data DCA Collector pipeline...',
    'Establishing proxy tunnels across 29 documentation nodes...',
  ]);

  const targetList = TARGETS.filter((t) => t !== 'All');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const targetInterval = setInterval(() => {
      setCurrentTargetIndex((prev) => (prev + 1) % targetList.length);
    }, 2200);

    return () => {
      clearInterval(timer);
      clearInterval(targetInterval);
    };
  }, [targetList.length]);

  useEffect(() => {
    const currentName = targetList[currentTargetIndex] || 'Stripe';
    const currentUrl = TARGET_URL_MAP[currentName] || 'https://docs.stripe.com/changelog';
    const shortUrl = currentUrl.replace('https://', '').slice(0, 42);

    const newLog = `[${String(elapsedSeconds).padStart(2, '0')}s] 🛰️ Ingesting ${currentName} feed → ${shortUrl}`;
    setLogs((prev) => [newLog, ...prev.slice(0, 3)]);
  }, [currentTargetIndex, elapsedSeconds]);

  const currentTargetName = targetList[currentTargetIndex] || 'Stripe';
  const progressPercent = Math.min(100, Math.round(((currentTargetIndex + 1) / targetList.length) * 100));

  return (
    <div className="space-y-4 mb-6 transition-all duration-300">
      {/* Radar Console Glassmorphic Container */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all shadow-xl ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-[#111622] via-[#0d1017] to-[#090b0e] border-[#1e293b]'
            : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-200 shadow-indigo-100/50'
        }`}
      >
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-indigo-500/0 animate-pulse" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Visual Radar Sweep Scope (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-emerald-500/30 bg-[#06080c] flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              {/* Concentric Distance Rings */}
              <div className="absolute w-44 h-44 sm:w-50 sm:h-50 rounded-full border border-emerald-500/20" />
              <div className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-emerald-500/20" />
              <div className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-emerald-500/25" />

              {/* Crosshairs & Axis Markings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-[1px] bg-emerald-500/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-full w-[1px] bg-emerald-500/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center rotate-45">
                <div className="w-full h-[1px] bg-emerald-500/10" />
                <div className="h-full w-[1px] bg-emerald-500/10" />
              </div>

              {/* Rotating Radar Sweep Beam */}
              <div
                className="absolute inset-0 rounded-full animate-radar-sweep pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(16,185,129,0.08) 320deg, rgba(16,185,129,0.55) 360deg)',
                }}
              />

              {/* Radar Target Blips */}
              {RADAR_NODES.map((node, i) => {
                const isActive = (currentTargetIndex % RADAR_NODES.length) === i;
                return (
                  <div
                    key={node.name}
                    className="absolute group"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div
                      className={`relative -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                        isActive ? 'scale-125' : 'opacity-70'
                      }`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]'
                            : 'bg-emerald-500/60'
                        }`}
                      />
                      {isActive && (
                        <div className="absolute inset-0 -m-1 rounded-full border border-emerald-400 animate-radar-ping" />
                      )}
                      <span className="absolute left-3 top-[-4px] font-mono text-[9px] text-emerald-300/90 whitespace-nowrap font-medium hidden sm:block bg-black/60 px-1 rounded backdrop-blur-xs border border-emerald-500/20">
                        {node.name}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Central DCA Hub Core */}
              <div className="relative z-10 w-9 h-9 rounded-full bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_20px_#10b981]">
                <Radio className="text-emerald-300 animate-pulse" size={16} />
              </div>

              {/* Scan Overlay Badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-emerald-950/80 border border-emerald-500/40 rounded-full px-2.5 py-0.5 font-mono text-[10px] text-emerald-300 font-semibold tracking-wider flex items-center gap-1.5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>29 NODES LIVE</span>
              </div>
            </div>
          </div>

          {/* Right Column: Telemetry, Active Feed Scanner & Progress (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-emerald-400">
                  <Activity size={18} className="animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div>
                  <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    Live Radar Scraper Studio
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300 uppercase">
                      Active Scan
                    </span>
                  </h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Harvesting real-time changelogs across 29 AI & web ecosystems
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs text-[#64748b]">
                <span className="rounded bg-black/40 px-2 py-1 border border-[#1e293b] text-emerald-400 font-semibold">
                  T+{String(elapsedSeconds).padStart(2, '0')}s
                </span>
                <span className="font-semibold text-slate-300">
                  {currentTargetIndex + 1} / {targetList.length} Targets
                </span>
              </div>
            </div>

            {/* Currently Scanning Target Card */}
            <div
              className={`rounded-xl border p-3 sm:p-4 transition-all ${
                theme === 'dark' ? 'bg-[#090c12] border-[#1e2433]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-mono text-[11px] text-[#64748b] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  CURRENT TARGET FEED
                </span>
                <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                  {progressPercent}% Complete
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm sm:text-base font-bold font-mono truncate ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {currentTargetName}
                </span>
                <span className="shrink-0 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  HTTP PROXY TUNNEL
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 w-full bg-[#161a25] rounded-full h-1.5 overflow-hidden border border-[#1e2433]">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4-Stage Pipeline Radar Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#0c0e14] border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <Radio size={13} className="animate-pulse shrink-0" />
                <span className="truncate">1. DCA Poll</span>
              </div>
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#0c0e14] border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <Cpu size={13} className="animate-pulse shrink-0" />
                <span className="truncate">2. AST Parser</span>
              </div>
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#0c0e14] border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <ShieldCheck size={13} className="shrink-0" />
                <span className="truncate">3. Quarantine</span>
              </div>
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#0c0e14] border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <Database size={13} className="shrink-0" />
                <span className="truncate">4. FTS5 Sync</span>
              </div>
            </div>

            {/* Rolling Cyber Terminal Logs */}
            <div
              className={`rounded-lg border p-2.5 font-mono text-[11px] space-y-1 ${
                theme === 'dark' ? 'bg-[#06080c] border-[#161a25] text-slate-400' : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#64748b] text-[10px] pb-1 border-b border-[#161a25]">
                <Terminal size={11} />
                <span>TELEMETRY STREAM</span>
              </div>
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`truncate ${
                    index === 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shimmering Holographic Bento Skeletons (when emptyState is true) */}
      {emptyState && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#64748b] px-1 font-mono">
            <span className="flex items-center gap-2">
              <Sparkles size={13} className="text-emerald-400 animate-spin" />
              PREPARING ADVISORY RECEPTORS (239+ EXPECTED)...
            </span>
            <span>HYDRATING FTS5 INDEX</span>
          </div>

          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className={`p-4 sm:p-5 rounded-xl border relative overflow-hidden transition ${
                theme === 'dark' ? 'bg-[#10131b] border-[#1e2433]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-40" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={`rounded-lg border p-4 space-y-3 ${
                    theme === 'dark' ? 'bg-[#141822] border-[#1b202e]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-20 bg-slate-700/50 rounded" />
                    <div className="h-4 w-28 bg-emerald-500/20 rounded" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-600/50 rounded" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-slate-700/40 rounded" />
                    <div className="h-3 w-5/6 bg-slate-700/40 rounded" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-5 w-16 bg-slate-700/50 rounded" />
                    <div className="h-5 w-20 bg-slate-700/50 rounded" />
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-4 space-y-3 ${
                    theme === 'dark' ? 'bg-[#0c0e14] border-[#1b202e]' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <div className="h-3 w-24 bg-slate-700/50 rounded" />
                    <div className="h-4 w-24 bg-emerald-500/20 rounded" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="h-3.5 w-full bg-slate-700/30 rounded" />
                    <div className="h-3.5 w-4/5 bg-slate-700/30 rounded" />
                    <div className="h-3.5 w-2/3 bg-slate-700/30 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
