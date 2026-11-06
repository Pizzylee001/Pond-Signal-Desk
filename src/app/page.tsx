'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { validateOpenerDraft, type LeadRow, type LeadStatus, type RunRow } from '@/lib/sdr-engine';

export default function MorningLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [debriefsCount, setDebriefsCount] = useState(3);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [showQuickCommand, setShowQuickCommand] = useState(false);
  const [batchCmd, setBatchCmd] = useState('approve 1, 2 · skip 4');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    fetch('/api/sdr')
      .then(r => r.json())
      .then(data => {
        const loadedLeads: LeadRow[] = data.leads || [];
        setLeads(loadedLeads);
        setRuns(data.runs || []);
        setDebriefsCount((data.debriefs || []).length);
        if (loadedLeads.length > 0) {
          setDraftText(loadedLeads[0].draft_message);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeLead = leads[selectedIdx] || null;

  const handleSelectLead = (idx: number) => {
    setSelectedIdx(idx);
    if (leads[idx]) {
      setDraftText(leads[idx].draft_message);
    }
  };

  const handleUpdateLead = async (status: LeadStatus) => {
    if (!activeLead || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/sdr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead',
          lead_id: activeLead.lead_id,
          status,
          draft_message: draftText,
        }),
      });
      const data = await res.json();
      if (data.store?.leads) {
        setLeads(data.store.leads);
        showToast(
          status === 'meeting'
            ? `Marked ${activeLead.first_name} as Meeting & created Deal row in CRM Sheet.`
            : `Updated ${activeLead.first_name} to ${status}.`
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCmd.trim() || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/sdr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_command',
          commandText: batchCmd,
        }),
      });
      const data = await res.json();
      if (data.store?.leads) {
        setLeads(data.store.leads);
        if (data.store.leads[selectedIdx]) {
          setDraftText(data.store.leads[selectedIdx].draft_message);
        }
        showToast('Applied batch command to today’s leads.');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleRunPipeline = async (simulateLinkedInWall: boolean) => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/sdr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_pipeline',
          simulateLinkedInWall,
        }),
      });
      const data = await res.json();
      if (data.store?.leads) {
        setLeads(data.store.leads);
        setRuns(data.store.runs || []);
        setSelectedIdx(0);
        if (data.store.leads[0]) {
          setDraftText(data.store.leads[0].draft_message);
        }
        showToast(
          simulateLinkedInWall
            ? 'T10 Test: Halted LinkedIn opens at checkpoint wall, logged li_auth_needed, and delivered X-only digest.'
            : 'Completed fresh X + LinkedIn morning scan.'
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleRegenerateWithDeepSeek = async () => {
    if (!activeLead || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch('/api/sdr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_opener',
          lead_id: activeLead.lead_id,
        }),
      });
      const data = await res.json();
      if (data.store?.leads) {
        setLeads(data.store.leads);
        const updated = data.store.leads[selectedIdx];
        if (updated) {
          setDraftText(updated.draft_message);
        }
        showToast(`Refreshed draft for ${activeLead.first_name} (${data.usedModel}).`);
      }
    } finally {
      setBusyAction(false);
    }
  };

  const approvedCount = leads.filter(
    l => l.status === 'approved' || l.status === 'edited' || l.status === 'sent' || l.status === 'meeting'
  ).length;

  const latestRun = runs[0];
  const liveValidation = activeLead
    ? validateOpenerDraft(draftText, {
        first_name: activeLead.first_name,
        post_url: activeLead.post_url,
      })
    : { valid: true, charCount: 0, flags: [] };

  const statusLabel = (s: LeadStatus) => {
    switch (s) {
      case 'approved':
        return 'Approved';
      case 'edited':
        return 'Edited & Approved';
      case 'skipped':
        return 'Skipped';
      case 'do_not_contact':
        return 'Do Not Contact';
      case 'meeting':
        return 'Meeting Booked';
      case 'sent':
        return 'Sent';
      default:
        return 'Needs review';
    }
  };

  const statusDotClass = (s: LeadStatus) => {
    if (s === 'approved' || s === 'edited' || s === 'sent' || s === 'meeting') {
      return 'bg-[var(--dot-green)]';
    }
    if (s === 'skipped' || s === 'do_not_contact') {
      return 'bg-[var(--text-muted)]';
    }
    return 'bg-[var(--dot-amber)]';
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader leadsCount={leads.length} debriefsCount={debriefsCount} />

      <main id="main-content" className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
        {/* Live polite toast */}
        <div aria-live="polite" className="sr-only">
          {toastMsg || ''}
        </div>
        {toastMsg ? (
          <div className="card px-4 py-3 text-xs font-medium flex items-center justify-between">
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Simple Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Today&rsquo;s Warm Leads</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {leads.length} people matched your ICP in the last 24 to 72 hours. Pick a lead on the left to review and approve their message.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs tabular">
            <span className="text-[var(--text-secondary)] mr-1">
              <strong className="text-[var(--text-main)]">{approvedCount}</strong> of {leads.length} approved
            </span>
            <button
              type="button"
              onClick={() => setShowQuickCommand(prev => !prev)}
              className="px-3.5 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] font-medium cursor-pointer press"
            >
              {showQuickCommand ? 'Hide Quick Command' : 'Quick Command & Tests'}
            </button>
            <button
              type="button"
              disabled={busyAction}
              aria-busy={busyAction}
              onClick={() => handleRunPipeline(false)}
              className="px-3.5 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-medium cursor-pointer press disabled:opacity-50"
            >
              {busyAction ? 'Running…' : 'Refresh Scan'}
            </button>
          </div>
        </div>

        {/* Collapsible Quick Command & T10 Test Bar */}
        {showQuickCommand ? (
          <div className="card p-4 space-y-3">
            <form onSubmit={handleBatchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <label htmlFor="batch-cmd-input" className="text-xs font-medium text-[var(--text-secondary)] shrink-0">
                Digest Command:
              </label>
              <input
                id="batch-cmd-input"
                name="batchCommand"
                type="text"
                autoComplete="off"
                value={batchCmd}
                onChange={e => setBatchCmd(e.target.value)}
                placeholder="approve 1, 2, 5 · edit 3: Hey Sam… · skip 4…"
                className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--text-main)]"
              />
              <button
                type="submit"
                disabled={busyAction}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] cursor-pointer press shrink-0"
              >
                Apply Command
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              <span>
                Latest Run: <strong className="text-[var(--text-main)] tabular">{latestRun?.li_opens ?? 18}/40</strong> LinkedIn opens &middot; Failures:{' '}
                <code className="text-[var(--text-main)]">{latestRun?.failures || 'none'}</code>
              </span>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => handleRunPipeline(true)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-xs font-medium cursor-pointer press"
              >
                Simulate LinkedIn Login Wall (T10)
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 card h-96 animate-pulse motion-reduce:animate-none" />
            <div className="lg:col-span-8 card h-96 animate-pulse motion-reduce:animate-none" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Clean Scannable List (Max 3 data points per row) */}
            <div className="lg:col-span-4 card divide-y divide-[var(--border-color)] overflow-hidden">
              {leads.map((lead, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={lead.lead_id}
                    type="button"
                    onClick={() => handleSelectLead(idx)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--text-main)] ${
                      isSelected ? 'bg-[var(--bg-subtle)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--text-main)] truncate">
                        {idx + 1}. {lead.first_name}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-secondary)] tabular shrink-0">
                        {lead.total_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      {lead.title} &middot; {lead.company}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-2">
                      <span className={`size-1.5 rounded-full shrink-0 ${statusDotClass(lead.status)}`} />
                      <span>{statusLabel(lead.status)}</span>
                      <span>&middot; {lead.source}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Clear Step-by-Step Lead Review Card */}
            {activeLead ? (
              <div className="lg:col-span-8 card p-6 sm:p-8 space-y-6">
                {/* Step 1: Who & Score */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-semibold">{activeLead.first_name}</h2>
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                        {statusLabel(activeLead.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      {activeLead.title} at {activeLead.company}
                    </p>
                  </div>
                  <div className="text-right tabular">
                    <div className="text-sm font-semibold">
                      Score: {activeLead.total_score.toFixed(1)} / 10
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      Fit {activeLead.fit_score} &middot; Intent {activeLead.intent_score} ({activeLead.signal_type})
                    </div>
                  </div>
                </div>

                {/* Step 2: What They Posted */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>
                      Posted on {activeLead.source} ({activeLead.post_date})
                    </span>
                    <a
                      href={activeLead.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--text-main)] underline hover:opacity-80"
                    >
                      Open original post &nearr;
                    </a>
                  </div>
                  <blockquote className="text-sm text-[var(--text-main)] leading-relaxed pl-3.5 border-l-2 border-[var(--border-color)]">
                    &ldquo;{activeLead.signal_quote}&rdquo;
                  </blockquote>
                </div>

                {/* Step 3: Message to Send */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <label htmlFor="opener-editor" className="text-[var(--text-muted)]">
                      Draft message (300 to 400 characters, first name only)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleRegenerateWithDeepSeek}
                        className="underline text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
                      >
                        Regenerate with DeepSeek
                      </button>
                      <span
                        className={`font-mono tabular font-medium ${
                          liveValidation.valid ? 'text-[var(--text-secondary)]' : 'text-[var(--dot-red)]'
                        }`}
                      >
                        {liveValidation.charCount} / 400 chars
                      </span>
                    </div>
                  </div>

                  <textarea
                    id="opener-editor"
                    name="draftMessage"
                    rows={4}
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3.5 text-sm text-[var(--text-main)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--text-main)]"
                  />

                  {/* Guardrail Telemetry Strip */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-1 tabular">
                    <span>
                      {liveValidation.charCount >= 300 && liveValidation.charCount <= 400 ? '✓' : '✕'} 300–400 chars
                    </span>
                    <span>
                      {!liveValidation.flags.includes('last_name_or_pii') ? '✓' : '✕'} First name only
                    </span>
                    <span>
                      {!liveValidation.flags.includes('unverified_source') ? '✓' : '✕'} Cites verified URL
                    </span>
                    <span>
                      {!liveValidation.flags.includes('banned_phrase') &&
                      !liveValidation.flags.includes('em_dash') &&
                      !liveValidation.flags.includes('contains_link')
                        ? '✓'
                        : '✕'}{' '}
                      Zero banned phrases or links
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-color)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleUpdateLead('skipped')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer press"
                    >
                      Skip Lead
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleUpdateLead('meeting')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer press"
                    >
                      Move to Deals (Booked Meeting)
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() =>
                      handleUpdateLead(
                        draftText !== activeLead.draft_message ? 'edited' : 'approved'
                      )
                    }
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:opacity-90 cursor-pointer press"
                  >
                    Approve Message
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
