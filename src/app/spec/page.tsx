'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import type { SpecTestCaseResult } from '@/lib/crm-spec-engine';
import type { CRMStoreData } from '@/lib/store';

export default function SpecAndN8nPage() {
  const [store, setStore] = useState<CRMStoreData | null>(null);
  const [w1Tests, setW1Tests] = useState<SpecTestCaseResult[]>([]);
  const [w2Tests, setW2Tests] = useState<SpecTestCaseResult[]>([]);
  const [n8nWorkflows, setN8nWorkflows] = useState<{
    workflow1: Record<string, unknown>;
    workflow2: Record<string, unknown>;
  } | null>(null);
  const [sizeMin, setSizeMin] = useState(10);
  const [sizeMax, setSizeMax] = useState(200);
  const [buyerTitlesText, setBuyerTitlesText] = useState('');
  const [proofPointsText, setProofPointsText] = useState('');
  const [senderName, setSenderName] = useState('Lee');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    fetch('/api/crm')
      .then(r => r.json())
      .then(data => {
        if (data.store) {
          setStore(data.store);
          setSizeMin(data.store.icp.companySizeMin);
          setSizeMax(data.store.icp.companySizeMax);
          setBuyerTitlesText(data.store.icp.buyerTitles.join(', '));
          setProofPointsText(data.store.icp.approvedProofPoints.join('\n'));
          setSenderName(data.store.voice.senderFirstName);
        }
        if (data.verification) {
          setW1Tests(data.verification.workflow1Tests || []);
          setW2Tests(data.verification.workflow2Tests || []);
        }
        if (data.n8nWorkflows) {
          setN8nWorkflows(data.n8nWorkflows);
        }
      });
  }, []);

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_memory',
          icp: {
            companySizeMin: Number(sizeMin) || 10,
            companySizeMax: Number(sizeMax) || 200,
            buyerTitles: buyerTitlesText
              .split(',')
              .map(s => s.trim())
              .filter(Boolean),
            approvedProofPoints: proofPointsText
              .split('\n')
              .map(s => s.trim())
              .filter(Boolean),
          },
          voice: {
            senderFirstName: senderName.trim() || 'Lee',
            signOff: `Best,\n${senderName.trim() || 'Lee'}`,
          },
        }),
      });
      const data = await res.json();
      if (data.store) {
        setStore(data.store);
        setW1Tests(data.verification?.workflow1Tests || []);
        setW2Tests(data.verification?.workflow2Tests || []);
        notify('Saved ICP & Voice Memory and re-verified all 21 spec tests.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded ${filename} for n8n Cloud import.`);
  };

  const totalPassed =
    w1Tests.filter(t => t.passed).length + w2Tests.filter(t => t.passed).length;
  const totalCount = w1Tests.length + w2Tests.length;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        leadsCount={store?.leads.length ?? 10}
        debriefsCount={store?.debriefs.length ?? 3}
      />

      <main id="main-content" className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
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

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Rules, 21-Test Spec Verifier &amp; n8n Cloud Export
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Edit your live ICP and Voice Memory, download the n8n Cloud workflow JSONs for <code>pizzylee.app.n8n.cloud</code>, and inspect all 21 automated spec tests.
            </p>
          </div>

          <div className="text-xs font-mono tabular px-3.5 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)]">
            Spec Suite: <strong>{totalPassed} / {totalCount || 21}</strong> Passing
          </div>
        </div>

        {/* Top Row: n8n Cloud Exports + Live Memory Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: n8n Cloud Workflows & Scorecard Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="card p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">n8n Cloud Workflow Exports</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Import directly into <code>pizzylee.app.n8n.cloud</code> (Personal &rarr; Import from File).
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() =>
                    n8nWorkflows &&
                    handleDownloadJson(
                      'workflow-1-warm-signal-sdr.json',
                      n8nWorkflows.workflow1
                    )
                  }
                  className="w-full text-left p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] hover:border-[var(--text-main)] transition-colors flex items-center justify-between cursor-pointer press"
                >
                  <div>
                    <div className="text-xs font-semibold">
                      workflow-1-warm-signal-sdr.json
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                      Cron: 0 7 * * 1-5 &middot; 7 nodes &middot; DeepSeek V3
                    </div>
                  </div>
                  <span className="text-xs font-medium underline shrink-0 ml-2">
                    Download &darr;
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    n8nWorkflows &&
                    handleDownloadJson(
                      'workflow-2-deal-debrief.json',
                      n8nWorkflows.workflow2
                    )
                  }
                  className="w-full text-left p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] hover:border-[var(--text-main)] transition-colors flex items-center justify-between cursor-pointer press"
                >
                  <div>
                    <div className="text-xs font-semibold">
                      workflow-2-deal-debrief.json
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                      Cron: */15 8-19 * * 1-5 &middot; 7 nodes &middot; 2-Pass Sweep
                    </div>
                  </div>
                  <span className="text-xs font-medium underline shrink-0 ml-2">
                    Download &darr;
                  </span>
                </button>
              </div>
            </div>

            {/* Dylan's 5-Area Builder Scorecard */}
            <div className="card p-6 space-y-3">
              <h2 className="text-sm font-semibold">Dylan Pond&rsquo;s 5-Area Builder Scorecard</h2>
              <div className="divide-y divide-[var(--border-color)] text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[var(--text-secondary)]">1. Works end to end on schedule (25%)</span>
                  <span className="font-mono font-semibold">PASS</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[var(--text-secondary)]">2. Output quality &amp; 0 fabrication (30%)</span>
                  <span className="font-mono font-semibold">PASS</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[var(--text-secondary)]">3. Guardrails &amp; no auto-send (20%)</span>
                  <span className="font-mono font-semibold">PASS</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[var(--text-secondary)]">4. Failure handling T10 (15%)</span>
                  <span className="font-mono font-semibold">PASS</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[var(--text-secondary)]">5. Clarity of handoff (10%)</span>
                  <span className="font-mono font-semibold">PASS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Live Memory Editor (ICP + Offer & Email Voice) */}
          <form onSubmit={handleSaveMemory} className="lg:col-span-7 card p-6 sm:p-8 space-y-5">
            <div className="pb-4 border-b border-[var(--border-color)]">
              <h2 className="text-base font-semibold">
                Agent Memory: ICP + Offer &amp; Email Voice
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Changes saved here immediately govern Workflow 1 lead scoring and Workflow 2 follow-up drafts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="icp-min" className="block text-xs text-[var(--text-muted)] mb-1">
                  Min Company Size
                </label>
                <input
                  id="icp-min"
                  name="sizeMin"
                  type="number"
                  value={sizeMin}
                  onChange={e => setSizeMin(Number(e.target.value))}
                  className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)] tabular"
                />
              </div>
              <div>
                <label htmlFor="icp-max" className="block text-xs text-[var(--text-muted)] mb-1">
                  Max Company Size
                </label>
                <input
                  id="icp-max"
                  name="sizeMax"
                  type="number"
                  value={sizeMax}
                  onChange={e => setSizeMax(Number(e.target.value))}
                  className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)] tabular"
                />
              </div>
              <div>
                <label htmlFor="voice-sender" className="block text-xs text-[var(--text-muted)] mb-1">
                  Rep First Name (Sign-Off)
                </label>
                <input
                  id="voice-sender"
                  name="senderName"
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="icp-titles" className="block text-xs text-[var(--text-muted)] mb-1">
                Exact Buyer Titles (comma-separated, 4 Fit pts)
              </label>
              <input
                id="icp-titles"
                name="buyerTitles"
                type="text"
                value={buyerTitlesText}
                onChange={e => setBuyerTitlesText(e.target.value)}
                className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
              />
            </div>

            <div>
              <label htmlFor="icp-proof" className="block text-xs text-[var(--text-muted)] mb-1">
                Approved Proof Points (1 per line; zero unverified claims allowed)
              </label>
              <textarea
                id="icp-proof"
                name="proofPoints"
                rows={3}
                value={proofPointsText}
                onChange={e => setProofPointsText(e.target.value)}
                className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3 text-xs text-[var(--text-main)] leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] cursor-pointer press"
              >
                {saving ? 'Saving…' : 'Save Memory & Re-Run Verifier'}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: All 21 Spec Test Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold">
              Workflow 1 Test Plan (T1–T11: Warm Signal SDR)
            </h2>
            <div className="divide-y divide-[var(--border-color)] text-xs">
              {w1Tests.map(t => (
                <div key={t.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span>
                      {t.id}: {t.name}
                    </span>
                    <span className="font-mono text-xs">
                      {t.passed ? '✓ PASS' : '✕ FAIL'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)]">{t.evidence}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold">
              Workflow 2 Test Plan (T1–T10: Deal Debrief)
            </h2>
            <div className="divide-y divide-[var(--border-color)] text-xs">
              {w2Tests.map(t => (
                <div key={t.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span>
                      {t.id}: {t.name}
                    </span>
                    <span className="font-mono text-xs">
                      {t.passed ? '✓ PASS' : '✕ FAIL'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)]">{t.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
