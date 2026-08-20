'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  DocUpdate,
  AuditResponse,
  CodebaseImpactReport,
  SelfHealingResponse,
  WatcherStatus,
  GitHubScanResponse,
  LLMReviewResponse,
  CreatePRResponse,
  GitHubConfigStatus,
  FileImpactMatch,
  TARGET_URL_MAP,
  SystemHealth,
} from '../types';

import { Navbar } from '../components/Navbar';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { LiveRadarTab } from '../components/LiveRadarTab';
import { ImpactMapperTab } from '../components/ImpactMapperTab';
import { WatcherTab } from '../components/WatcherTab';
import { ManifestAuditTab } from '../components/ManifestAuditTab';
import { GitHubPRTab } from '../components/GitHubPRTab';
import { Modals } from '../components/Modals';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function Home() {
  // Theme state: dark | light (default: dark)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [updates, setUpdates] = useState<DocUpdate[]>([]);
  const [query, setQuery] = useState('');
  const [ecosystem, setEcosystem] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [failedErrors, setFailedErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<'live' | 'impact' | 'watcher' | 'check' | 'github'>('live');
  const [selectedItem, setSelectedItem] = useState<DocUpdate | null>(null);

  // System Health
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'checking',
    records: 0,
    scraper: false,
    collector_id: '',
  });

  // Custom Target Modal
  const [isAddTargetOpen, setIsAddTargetOpen] = useState(false);
  const [customTargetUrl, setCustomTargetUrl] = useState('');

  // 4-Stage Self Healing Modal & Proof-of-Recovery Evidence
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const [fixCollectorId, setFixCollectorId] = useState('');
  const [fixTargetUrl, setFixTargetUrl] = useState('https://docs.stripe.com/changelog');
  const [fixDescription, setFixDescription] = useState(
    'Documentation DOM changed. Extract newer release headers and breaking change notes.'
  );
  const [autoApprove, setAutoApprove] = useState(true);
  const [reRunAfterApproval, setReRunAfterApproval] = useState(true);
  const [fixLoading, setFixLoading] = useState(false);
  const [healLoopResult, setHealLoopResult] = useState<SelfHealingResponse | null>(null);

  // Innovation 1: Local Code Impact Mapper State
  const [impactDirectory, setImpactDirectory] = useState('.');
  const [impactReport, setImpactReport] = useState<CodebaseImpactReport | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Innovation 3: Continuous Drift Watcher State
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus>({
    is_running: false,
    interval_seconds: 60,
    last_run_at: null,
    monitored_targets_count: 0,
    heal_events_triggered_count: 0,
    auto_approve_enabled: true,
    recent_watcher_logs: [],
  });
  const [watcherLoading, setWatcherLoading] = useState(false);

  // Innovation: GitHub PR Remediation Studio State
  const [ghRepoUrl, setGhRepoUrl] = useState('vikramlingam/driftwatch');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghTokenOverride, setGhTokenOverride] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghScanResult, setGhScanResult] = useState<GitHubScanResponse | null>(null);
  const [ghConfigStatus, setGhConfigStatus] = useState<GitHubConfigStatus | null>(null);
  const [ghErrorMessage, setGhErrorMessage] = useState('');

  const [selectedGhMatch, setSelectedGhMatch] = useState<FileImpactMatch | null>(null);
  const [llmReviewLoading, setLlmReviewLoading] = useState(false);
  const [llmReviewResult, setLlmReviewResult] = useState<LLMReviewResponse | null>(null);

  const [llmModelChoice, setLlmModelChoice] = useState('anthropic/claude-3.5-sonnet');
  const [llmApiKeyOverride, setLlmApiKeyOverride] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const [prCustomTitle, setPrCustomTitle] = useState('');
  const [prCustomBody, setPrCustomBody] = useState('');
  const [prLoading, setPrLoading] = useState(false);
  const [prResult, setPrResult] = useState<CreatePRResponse | null>(null);

  // Innovation 2: Check Manifests State
  const [auditType, setAuditType] = useState<'requirements.txt' | 'package.json' | 'mcp_config.json'>(
    'requirements.txt'
  );
  const [auditInput, setAuditInput] = useState(
    'stripe==10.0.0\nlangchain==0.1.0\npydantic==1.10.12\nmcp==0.1.0'
  );
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isQuarantineOpen, setIsQuarantineOpen] = useState(false);

  // Pagination State for All Tabs (strictly 20 items per page limit)
  const [currentPage, setCurrentPage] = useState(1);
  const [impactPage, setImpactPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [ghMatchPage, setGhMatchPage] = useState(1);
  const itemsPerPage = 20;

  const searchInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const qParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
      const ecoParam = ecosystem !== 'All' ? `&ecosystem=${encodeURIComponent(ecosystem)}` : '';
      const endpoint = query.trim()
        ? `${API}/api/search?${qParam.slice(1)}${ecoParam}&limit=200`
        : `${API}/api/updates?limit=200${ecoParam}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setUpdates(Array.isArray(data) ? data : []);
      }

      const hRes = await fetch(`${API}/api/health`);
      if (hRes.ok) {
        const hData = await hRes.json();
        setSystemHealth({
          status: hData.status,
          records: hData.database_records,
          scraper: hData.bright_data_configured ?? hData.active_scraper,
          collector_id: hData.collector_id,
        });
      }

      const wRes = await fetch(`${API}/api/watcher/status`);
      if (wRes.ok) {
        const wData = await wRes.json();
        setWatcherStatus(wData);
      }

      const ghConfRes = await fetch(`${API}/api/github/config-status`);
      if (ghConfRes.ok) {
        const ghConfData = await ghConfRes.json();
        setGhConfigStatus(ghConfData);
        if (ghConfData.openrouter_model) {
          setLlmModelChoice(ghConfData.openrouter_model);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [ecosystem, query]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setTab('live');
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleClearDatabase() {
    if (!confirm('Are you sure you want to clear the database and FTS index?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/clear-db`, { method: 'POST' });
      if (res.ok) {
        setUpdates([]);
        setFailedErrors([]);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to clear database', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape(overrideUrls?: string[]) {
    setLoading(true);
    try {
      let urls: string[] = [];
      if (overrideUrls && overrideUrls.length > 0) {
        urls = overrideUrls;
      } else if (ecosystem !== 'All' && TARGET_URL_MAP[ecosystem]) {
        urls = [TARGET_URL_MAP[ecosystem]];
      } else {
        urls = Object.values(TARGET_URL_MAP).filter(Boolean);
      }

      const res = await fetch(`${API}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (res.ok) {
        const data = await res.json();
        setFailedErrors(data.quarantined_errors || []);
      }
      await loadData();
    } catch (err) {
      console.error('Scrape request failed', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCustomTarget(e: React.FormEvent) {
    e.preventDefault();
    const url = customTargetUrl.trim();
    if (!url) return;
    setIsAddTargetOpen(false);
    setLoading(true);
    try {
      await fetch(`${API}/api/targets/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      await loadData();
    } catch (err) {
      console.error('Failed to add custom target', err);
    } finally {
      setLoading(false);
      setCustomTargetUrl('');
    }
  }

  async function handleRunSelfHealingLoop() {
    setFixLoading(true);
    setHealLoopResult(null);
    try {
      const res = await fetch(`${API}/api/self-heal-loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collector_id: fixCollectorId || undefined,
          target_url: fixTargetUrl || undefined,
          issue_description: fixDescription,
          observed_break_description: fixDescription,
          auto_approve: autoApprove,
          auto_approve_patch: autoApprove,
          re_run_after_approval: reRunAfterApproval,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHealLoopResult(data);
      }
      await loadData();
    } catch (err) {
      console.error('Self-healing loop request failed', err);
    } finally {
      setFixLoading(false);
    }
  }

  async function handleScanDirectoryImpact() {
    if (!impactDirectory.trim()) return;
    setImpactLoading(true);
    try {
      const res = await fetch(`${API}/api/impact/scan-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory_path: impactDirectory.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setImpactReport(data);
        setImpactPage(1);
      }
    } catch (err) {
      console.error('Impact scan failed', err);
    } finally {
      setImpactLoading(false);
    }
  }

  async function handleToggleWatcher() {
    setWatcherLoading(true);
    try {
      const endpoint = watcherStatus.is_running ? `${API}/api/watcher/stop` : `${API}/api/watcher/start`;
      const body = watcherStatus.is_running ? {} : { interval_seconds: 60, auto_approve_low_risk: true };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setWatcherStatus(data);
      }
    } catch (err) {
      console.error('Toggle watcher failed', err);
    } finally {
      setWatcherLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    let detectedType: 'requirements.txt' | 'package.json' | 'mcp_config.json' = 'requirements.txt';
    if (file.name.includes('package.json')) detectedType = 'package.json';
    else if (file.name.includes('mcp')) detectedType = 'mcp_config.json';
    setAuditType(detectedType);
    setAuditInput(content);
    runAudit(content, detectedType);
  }

  async function runAudit(content: string, type: string) {
    if (!content.trim()) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`${API}/api/check-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_type: type,
          file_content: content,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data);
        setAuditPage(1);
      }
    } catch (err) {
      console.error('Audit failed', err);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleScanGitHubRepo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!ghRepoUrl.trim()) return;
    setGhLoading(true);
    setGhErrorMessage('');
    setGhScanResult(null);
    setSelectedGhMatch(null);
    setLlmReviewResult(null);
    setPrResult(null);
    setGhMatchPage(1);
    try {
      const res = await fetch(`${API}/api/github/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: ghRepoUrl.trim(),
          branch: ghBranch.trim() || null,
          github_token: ghTokenOverride.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to scan repository');
      }
      const data = await res.json();
      setGhScanResult(data);
    } catch (err: any) {
      setGhErrorMessage(err.message || 'GitHub Scan Failed');
    } finally {
      setGhLoading(false);
    }
  }

  async function handleRunLLMReview(match: FileImpactMatch) {
    setSelectedGhMatch(match);
    setLlmReviewLoading(true);
    setLlmReviewResult(null);
    setPrResult(null);
    try {
      const res = await fetch(`${API}/api/github/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: ghScanResult?.repo_name || 'custom/repo',
          file_path: match.file_path,
          file_content: match.line_content,
          advisory_id: match.advisory_id,
          advisory_title: match.advisory_title,
          advisory_summary: match.advisory_summary || match.advisory_title,
          symbol_matched: match.symbol_matched,
          model_override: llmModelChoice || null,
          api_key_override: llmApiKeyOverride || null,
          github_token: ghTokenOverride.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLlmReviewResult(data);
        setPrCustomTitle(data.suggested_pr_title);
        setPrCustomBody(data.suggested_pr_body);
      }
    } catch (err) {
      console.error('LLM Review failed', err);
    } finally {
      setLlmReviewLoading(false);
    }
  }

  async function handleCreateGitHubPR() {
    if (!ghScanResult || !selectedGhMatch || !llmReviewResult) return;
    setPrLoading(true);
    setPrResult(null);
    try {
      const res = await fetch(`${API}/api/github/create-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: ghScanResult.repo_name,
          file_path: selectedGhMatch.file_path,
          patched_code: llmReviewResult.patched_code,
          pr_title: prCustomTitle || llmReviewResult.suggested_pr_title,
          pr_body: prCustomBody || llmReviewResult.suggested_pr_body,
          base_branch: ghScanResult.default_branch || 'main',
          github_token_override: ghTokenOverride.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create PR');
      }
      setPrResult(data);
    } catch (err: any) {
      alert(`GitHub PR Creation Error: ${err.message}`);
    } finally {
      setPrLoading(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [query, ecosystem, categoryFilter]);

  function copySnippet(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredUpdates = updates.filter((u) => {
    if (categoryFilter === 'ALL') return true;
    return u.category === categoryFilter;
  });

  // 20-per-page slicing across all tabs
  const paginatedUpdates = filteredUpdates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedImpactMatches = (impactReport?.matches || []).slice(
    (impactPage - 1) * itemsPerPage,
    impactPage * itemsPerPage
  );
  const paginatedAuditMatches = (auditResult?.matches || []).slice(
    (auditPage - 1) * itemsPerPage,
    auditPage * itemsPerPage
  );
  const paginatedGhMatches = (ghScanResult?.impact_matches || []).slice(
    (ghMatchPage - 1) * itemsPerPage,
    ghMatchPage * itemsPerPage
  );

  const highCount = updates.filter((u) => u.urgency === 'HIGH').length;
  const schemaCount = updates.filter((u) => u.category === 'TOOL_SCHEMA_CHANGE').length;

  const ecosystemCounts: Record<string, number> = {};
  updates.forEach((u) => {
    const eco = u.ecosystem || 'Custom';
    ecosystemCounts[eco] = (ecosystemCounts[eco] || 0) + 1;
  });

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#090b0e] text-[#f8fafc]' : 'bg-[#f4f6fa] text-[#0f172a]'
      }`}
    >
      {/* Top Navbar */}
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        systemHealth={systemHealth}
        loading={loading}
        handleScrape={handleScrape}
        handleClearDatabase={handleClearDatabase}
      />

      {/* Main Studio Body */}
      <main className="mx-auto max-w-[1650px] px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left Navigation Sidebar */}
          <LeftSidebar
            theme={theme}
            updates={updates}
            highCount={highCount}
            schemaCount={schemaCount}
            failedErrorsCount={failedErrors.length}
            tab={tab}
            setTab={setTab}
            watcherStatus={watcherStatus}
            setIsQuarantineOpen={setIsQuarantineOpen}
            setIsFixModalOpen={setIsFixModalOpen}
          />

          {/* Center Dynamic Content Area */}
          <section className="flex-1 min-w-0 space-y-4">
            {/* Platform Headline */}
            <div className="flex flex-col gap-1 pb-1">
              <h1
                className={`text-xl sm:text-2xl font-black tracking-tight ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Developer Breaking Changes & API Drift Intelligence
              </h1>
              <p
                className={`text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                  theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'
                }`}
              >
                Autonomous self-healing crawlers monitor SDK changelogs, API documentation, and MCP schemas in real-time.
              </p>
            </div>

            {/* Tab 1: Live Radar & Search */}
            {tab === 'live' && (
              <LiveRadarTab
                theme={theme}
                query={query}
                setQuery={setQuery}
                searchInputRef={searchInputRef}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                filteredUpdates={filteredUpdates}
                paginatedUpdates={paginatedUpdates}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                setSelectedItem={setSelectedItem}
                loading={loading}
                handleScrape={handleScrape}
              />
            )}

            {/* Tab 2: Local Code Impact Mapper */}
            {tab === 'impact' && (
              <ImpactMapperTab
                theme={theme}
                impactDirectory={impactDirectory}
                setImpactDirectory={setImpactDirectory}
                impactLoading={impactLoading}
                handleScanDirectoryImpact={handleScanDirectoryImpact}
                impactReport={impactReport}
                paginatedImpactMatches={paginatedImpactMatches}
                impactPage={impactPage}
                setImpactPage={setImpactPage}
                copySnippet={copySnippet}
                copiedId={copiedId}
                updates={updates}
                setSelectedItem={setSelectedItem}
              />
            )}

            {/* Tab 3: Continuous Drift Watcher Cockpit */}
            {tab === 'watcher' && (
              <WatcherTab
                theme={theme}
                watcherStatus={watcherStatus}
                watcherLoading={watcherLoading}
                handleToggleWatcher={handleToggleWatcher}
              />
            )}

            {/* Tab 4: Project Manifests Audit */}
            {tab === 'check' && (
              <ManifestAuditTab
                theme={theme}
                auditType={auditType}
                setAuditType={setAuditType}
                auditInput={auditInput}
                setAuditInput={setAuditInput}
                auditLoading={auditLoading}
                handleFileUpload={handleFileUpload}
                runAudit={runAudit}
                auditResult={auditResult}
                paginatedAuditMatches={paginatedAuditMatches}
                auditPage={auditPage}
                setAuditPage={setAuditPage}
                copySnippet={copySnippet}
                copiedId={copiedId}
              />
            )}

            {/* Tab 5: GitHub AI Remediation & PR Studio */}
            {tab === 'github' && (
              <GitHubPRTab
                theme={theme}
                ghRepoUrl={ghRepoUrl}
                setGhRepoUrl={setGhRepoUrl}
                ghBranch={ghBranch}
                setGhBranch={setGhBranch}
                ghTokenOverride={ghTokenOverride}
                setGhTokenOverride={setGhTokenOverride}
                ghLoading={ghLoading}
                ghErrorMessage={ghErrorMessage}
                ghScanResult={ghScanResult}
                ghConfigStatus={ghConfigStatus}
                llmModelChoice={llmModelChoice}
                setLlmModelChoice={setLlmModelChoice}
                llmApiKeyOverride={llmApiKeyOverride}
                setLlmApiKeyOverride={setLlmApiKeyOverride}
                showApiKeyInput={showApiKeyInput}
                setShowApiKeyInput={setShowApiKeyInput}
                handleScanGitHubRepo={handleScanGitHubRepo}
                paginatedGhMatches={paginatedGhMatches}
                selectedGhMatch={selectedGhMatch}
                handleRunLLMReview={handleRunLLMReview}
                llmReviewLoading={llmReviewLoading}
                llmReviewResult={llmReviewResult}
                ghMatchPage={ghMatchPage}
                setGhMatchPage={setGhMatchPage}
                copySnippet={copySnippet}
                copiedId={copiedId}
                prCustomTitle={prCustomTitle}
                setPrCustomTitle={setPrCustomTitle}
                prCustomBody={prCustomBody}
                setPrCustomBody={setPrCustomBody}
                handleCreateGitHubPR={handleCreateGitHubPR}
                prLoading={prLoading}
                prResult={prResult}
              />
            )}
          </section>

          {/* Right Documentation Feeds Sidebar */}
          <RightSidebar
            theme={theme}
            ecosystem={ecosystem}
            setEcosystem={setEcosystem}
            updates={updates}
            ecosystemCounts={ecosystemCounts}
            setIsAddTargetOpen={setIsAddTargetOpen}
          />
        </div>
      </main>

      {/* Unified Modals Overlay */}
      <Modals
        theme={theme}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        isAddTargetOpen={isAddTargetOpen}
        setIsAddTargetOpen={setIsAddTargetOpen}
        customTargetUrl={customTargetUrl}
        setCustomTargetUrl={setCustomTargetUrl}
        handleAddCustomTarget={handleAddCustomTarget}
        isFixModalOpen={isFixModalOpen}
        setIsFixModalOpen={setIsFixModalOpen}
        fixCollectorId={fixCollectorId}
        setFixCollectorId={setFixCollectorId}
        fixTargetUrl={fixTargetUrl}
        setFixTargetUrl={setFixTargetUrl}
        fixDescription={fixDescription}
        setFixDescription={setFixDescription}
        autoApprove={autoApprove}
        setAutoApprove={setAutoApprove}
        reRunAfterApproval={reRunAfterApproval}
        setReRunAfterApproval={setReRunAfterApproval}
        fixLoading={fixLoading}
        healLoopResult={healLoopResult}
        handleRunSelfHealingLoop={handleRunSelfHealingLoop}
        isQuarantineOpen={isQuarantineOpen}
        setIsQuarantineOpen={setIsQuarantineOpen}
        failedErrors={failedErrors}
      />
    </div>
  );
}
