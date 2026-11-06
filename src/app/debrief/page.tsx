'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import {
  generatePrivateIcsReminder,
  sweepCommitmentPhrases,
  validateFollowupEmail,
} from '@/lib/debrief-engine';
import type { DealRow, DebriefRow } from '@/lib/store';

export default function CallDebriefsPage() {
  const [debriefs, setDebriefs] = useState<DebriefRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [leadsCount, setLeadsCount] = useState(10);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCompany, setNewCompany] = useState('CrateOps');
  const [newFirstName, setNewFirstName] = useState('Devon');
  const [newTranscript, setNewTranscript] = useState(
    `[03:15] Devon: Our cold reply rate dropped from 3.4% to 0.9% this quarter across 4 domains.\n[11:20] Devon: We have $500 a month on our ops card if the daily X and LinkedIn feed saves our reps an hour a day.\n[16:45] Lee: I'll send over the CrateOps sample signal sheet before Friday.\n[19:10] Devon: Great, let's schedule a 20-minute live demo next week.`
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    fetch('/api/debrief')
      .then(r => r.json())
      .then(data => {
        const list: DebriefRow[] = data.debriefs || [];
        setDebriefs(list);
        setDeals(data.deals || []);
        setLeadsCount(data.leadsCount || 10);
        if (list[0]) {
          setSubject(list[0].followup_subject || '');
          setBodyText(list[0].followup_body || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeDebrief = debriefs[selectedIdx] || null;
  const linkedDeal = activeDebrief
    ? deals.find(d => d.deal_id === activeDebrief.deal_id)
    : null;

  const handleSelectDebrief = (idx: number) => {
    setSelectedIdx(idx);
    if (debriefs[idx]) {
      setSubject(debriefs[idx].followup_subject || '');
      setBodyText(debriefs[idx].followup_body || '');
    }
  };

  const handleApproveEmail = async () => {
    if (!activeDebrief || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_followup',
          debrief_id: activeDebrief.debrief_id,
          followup_subject: subject,
          followup_body: bodyText,
        }),
      });
      const data = await res.json();
      if (data.store?.debriefs) {
        setDebriefs(data.store.debriefs);
        notify('Approved follow-up email draft for human send.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDebrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newFirstName.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_debrief',
          company: newCompany,
          attendeeFirstName: newFirstName,
          transcript: newTranscript,
        }),
      });
      const data = await res.json();
      if (data.store?.debriefs) {
        setDebriefs(data.store.debriefs);
        setDeals(data.store.deals || []);
        setSelectedIdx(0);
        setSubject(data.store.debriefs[0]?.followup_subject || '');
        setBodyText(data.store.debriefs[0]?.followup_body || '');
        setShowNewModal(false);
        notify(`Ran 2-pass extraction & commitment sweep for ${newCompany}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!activeDebrief) return;
    const companyName =
      linkedDeal?.company ||
      activeDebrief.followup_subject?.split(' + ')[0] ||
      'Prospect';
    const icsContent = generatePrivateIcsReminder({
      company: companyName,
      nextStep: activeDebrief.next_steps,
      reminderDate: activeDebrief.reminder_date,
    });
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `followup-${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded private .ics reminder for ${activeDebrief.reminder_date} (0 invitees).`);
  };

  const emailCheck = validateFollowupEmail(subject, bodyText);
  const commitmentHits = activeDebrief?.transcript
    ? sweepCommitmentPhrases(
        activeDebrief.transcript,
        'Lee',
        activeDebrief.attendees_first_names.split(',')[0]?.trim() || 'Prospect'
      )
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader leadsCount={leadsCount} debriefsCount={debriefs.length} />

      <main id="main-content" className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
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

        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Call Debriefs</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {debriefs.length} sales calls recorded. Pick a call on the left to review its transcript, extracted action items, and follow-up email.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewModal(prev => !prev)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] cursor-pointer press"
            >
              {showNewModal ? 'Close Paste Box' : '+ Debrief New Call'}
            </button>
          </div>
        </div>

        {/* Collapsible New Call Paste Form */}
        {showNewModal ? (
          <form onSubmit={handleCreateDebrief} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Run 2-Pass Extraction on Call Transcript or Notes</h2>
              <button
                type="button"
                onClick={() => {
                  setNewCompany('Kova Systems');
                  setNewFirstName('Liam');
                  setNewTranscript('');
                }}
                className="text-xs underline text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Load Empty No-Show Call (T10 Test)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-company" className="block text-xs text-[var(--text-muted)] mb-1">
                  Company Name
                </label>
                <input
                  id="new-company"
                  name="company"
                  type="text"
                  required
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
                />
              </div>
              <div>
                <label htmlFor="new-firstname" className="block text-xs text-[var(--text-muted)] mb-1">
                  Prospect First Name
                </label>
                <input
                  id="new-firstname"
                  name="attendeeFirstName"
                  type="text"
                  required
                  value={newFirstName}
                  onChange={e => setNewFirstName(e.target.value)}
                  className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="new-transcript" className="block text-xs text-[var(--text-muted)] mb-1">
                Call Transcript or Raw Notes (leave blank to test T10 no-show fallback)
              </label>
              <textarea
                id="new-transcript"
                name="transcript"
                rows={4}
                value={newTranscript}
                onChange={e => setNewTranscript(e.target.value)}
                className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3 text-xs font-mono text-[var(--text-main)]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] cursor-pointer press"
              >
                {busy ? 'Extracting…' : 'Run 2-Pass Debrief'}
              </button>
            </div>
          </form>
        ) : null}

        {loading || !activeDebrief ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 card h-96 animate-pulse motion-reduce:animate-none" />
            <div className="lg:col-span-8 card h-96 animate-pulse motion-reduce:animate-none" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (4 cols): Clear List of Recorded Calls */}
            <div className="lg:col-span-4 card divide-y divide-[var(--border-color)] overflow-hidden">
              {debriefs.map((db, idx) => {
                const deal = deals.find(d => d.deal_id === db.deal_id);
                const companyTitle =
                  deal?.company ||
                  db.followup_subject?.split(' + ')[0] ||
                  db.debrief_id;
                const contactFirst = db.attendees_first_names.split(',')[0]?.trim();
                const isSelected = idx === selectedIdx;
                const isApproved = db.followup_sent === 'approved' || db.followup_sent === 'sent';

                return (
                  <button
                    key={db.debrief_id}
                    type="button"
                    onClick={() => handleSelectDebrief(idx)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--text-main)] ${
                      isSelected ? 'bg-[var(--bg-subtle)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--text-main)] truncate">
                        {idx + 1}. {companyTitle} ({contactFirst})
                      </span>
                      <span className="text-xs font-mono text-[var(--text-secondary)] tabular shrink-0">
                        {db.call_date}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                      Stage: {db.stage_before} &rarr; {db.stage_after}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-2">
                      <span
                        className={`size-1.5 rounded-full shrink-0 ${
                          isApproved ? 'bg-[var(--dot-green)]' : 'bg-[var(--dot-amber)]'
                        }`}
                      />
                      <span>{isApproved ? 'Email approved' : 'Draft needs review'}</span>
                      <span>&middot; {db.source}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column (8 cols): Call Details, Transcript & Follow-Up Email */}
            <div className="lg:col-span-8 space-y-6">
              {/* Card 1: Extracted Call Notes */}
              <div className="card p-6 sm:p-8 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-semibold">
                        {linkedDeal?.company || activeDebrief.followup_subject?.split(' + ')[0]} &middot;{' '}
                        {activeDebrief.attendees_first_names}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                        {activeDebrief.stage_before} &rarr; {activeDebrief.stage_after}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Source: {activeDebrief.source} &middot; Confidence: {activeDebrief.confidence} &middot;{' '}
                      {commitmentHits.length} commitment phrases caught
                    </p>
                  </div>
                  <div className="text-right text-xs tabular">
                    <div className="font-semibold">Reminder: {activeDebrief.reminder_date}</div>
                    <div className="text-[var(--text-muted)] mt-0.5">Private event (0 invitees)</div>
                  </div>
                </div>

                {/* Call Transcript */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Call Transcript ({activeDebrief.call_date})</span>
                    <span className="font-mono">{activeDebrief.event_id}</span>
                  </div>
                  <pre className="text-xs font-mono text-[var(--text-main)] whitespace-pre-wrap leading-relaxed bg-[var(--bg-subtle)] p-4 rounded-lg border border-[var(--border-color)]">
                    {activeDebrief.transcript || 'NO_TRANSCRIPT_FOUND'}
                  </pre>
                </div>

                {/* 4 Key Extracted Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-3.5 rounded-lg bg-[var(--bg-subtle)]">
                    <span className="text-[var(--text-muted)] block">Main Pain (Cited)</span>
                    <span className="text-[var(--text-main)] font-medium mt-1 block leading-relaxed">
                      {activeDebrief.pain_points}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--bg-subtle)]">
                    <span className="text-[var(--text-muted)] block">Budget &amp; Stakeholders</span>
                    <span className="text-[var(--text-main)] font-medium mt-1 block leading-relaxed">
                      {activeDebrief.budget}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--bg-subtle)] sm:col-span-2">
                    <span className="text-[var(--text-muted)] block">
                      Agreed Next Steps (2-Pass Commitment Sweep)
                    </span>
                    <span className="text-[var(--text-main)] font-medium mt-1 block leading-relaxed">
                      {activeDebrief.next_steps}
                    </span>
                  </div>
                </div>

                {/* Follow-Up Email Editor */}
                <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="email-body" className="text-xs font-semibold">
                      Follow-Up Email Draft (Subject: {subject})
                    </label>
                    <span
                      className={`text-xs font-mono font-medium tabular ${
                        emailCheck.valid ? 'text-[var(--text-secondary)]' : 'text-[var(--dot-red)]'
                      }`}
                    >
                      {emailCheck.wordCount} / 150 words
                    </span>
                  </div>

                  <textarea
                    id="email-body"
                    name="body"
                    rows={8}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3.5 text-sm text-[var(--text-main)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--text-main)]"
                  />

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] tabular">
                    <span>{emailCheck.wordCount < 150 ? '✓' : '✕'} Under 150 words</span>
                    <span>{!emailCheck.flags.includes('last_name_or_pii') ? '✓' : '✕'} First names only</span>
                    <span>
                      {!emailCheck.flags.includes('banned_phrase') && !emailCheck.flags.includes('em_dash')
                        ? '✓'
                        : '✕'}{' '}
                      Zero banned phrases
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer press"
                  >
                    Download Private .ics Reminder
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleApproveEmail}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:opacity-90 cursor-pointer press"
                  >
                    {activeDebrief.followup_sent === 'approved'
                      ? 'Approved for Gmail Draft'
                      : 'Approve Email Draft'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
