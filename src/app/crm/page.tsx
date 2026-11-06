'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import {
  DEALS_COLUMNS,
  DEBRIEFS_COLUMNS,
  LEADS_COLUMNS,
  RUNS_COLUMNS,
  exportTabToCsv,
} from '@/lib/crm-spec-engine';
import type { CRMStoreData } from '@/lib/store';

type TabKey = 'Leads' | 'Deals' | 'Debriefs' | 'Runs';

export default function CrmSheetPage() {
  const [store, setStore] = useState<CRMStoreData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
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
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDownloadCsv = (tab: TabKey) => {
    if (!store) return;
    const csv = exportTabToCsv(tab, store);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pond_Warm_Signal_CRM_${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded ${tab}.csv (${csv.split('\n').length - 1} rows).`);
  };

  const handlePromoteLeadToDeal = async (leadId: string, firstName: string) => {
    const res = await fetch('/api/sdr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_lead',
        lead_id: leadId,
        status: 'meeting',
      }),
    });
    const data = await res.json();
    if (data.store) {
      setStore(data.store);
      setActiveTab('Deals');
      notify(`Promoted ${firstName} (${leadId}) to Deals tab.`);
    }
  };

  const q = searchQuery.toLowerCase().trim();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        leadsCount={store?.leads.length ?? 10}
        debriefsCount={store?.debriefs.length ?? 3}
      />

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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-color)]">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Pond Warm Signal CRM (4 Tabs)
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Shared Google Sheet schema across Workflow 1 (<code>Leads</code>, <code>Runs</code>) and Workflow 2 (<code>Deals</code>, <code>Debriefs</code>).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadCsv(activeTab)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] cursor-pointer press"
            >
              Export {activeTab} (.CSV)
            </button>
          </div>
        </div>

        {/* Tab Bar + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'Leads', count: store?.leads.length ?? 10, cols: LEADS_COLUMNS.length },
                { key: 'Deals', count: store?.deals.length ?? 3, cols: DEALS_COLUMNS.length },
                { key: 'Debriefs', count: store?.debriefs.length ?? 3, cols: DEBRIEFS_COLUMNS.length },
                { key: 'Runs', count: store?.runs.length ?? 3, cols: RUNS_COLUMNS.length },
              ] as const
            ).map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer tabular ${
                  activeTab === t.key
                    ? 'bg-[var(--bg-subtle)] border-[var(--text-main)] text-[var(--text-main)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {t.key} ({t.count} rows &middot; {t.cols} cols)
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <label htmlFor="crm-search" className="sr-only">
              Filter rows
            </label>
            <input
              id="crm-search"
              name="search"
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}…`}
              className="w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--text-main)]"
            />
          </div>
        </div>

        {loading || !store ? (
          <div className="card h-96 animate-pulse motion-reduce:animate-none" />
        ) : (
          <div className="card overflow-hidden">
            {activeTab === 'Leads' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">lead_id</th>
                      <th className="py-3 px-4 font-medium">source</th>
                      <th className="py-3 px-4 font-medium">first_name</th>
                      <th className="py-3 px-4 font-medium">title &amp; company</th>
                      <th className="py-3 px-4 font-medium">signal_type</th>
                      <th className="py-3 px-4 font-medium">fit / intent / total</th>
                      <th className="py-3 px-4 font-medium">draft_chars</th>
                      <th className="py-3 px-4 font-medium">status</th>
                      <th className="py-3 px-4 font-medium">bridge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {store.leads
                      .filter(
                        l =>
                          !q ||
                          l.first_name.toLowerCase().includes(q) ||
                          l.company.toLowerCase().includes(q) ||
                          l.signal_type.toLowerCase().includes(q)
                      )
                      .map(lead => (
                        <tr key={lead.lead_id} className="hover:bg-[var(--bg-hover)]">
                          <td className="py-3.5 px-4 font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {lead.lead_id}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">{lead.source}</td>
                          <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                            {lead.first_name}
                          </td>
                          <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                            {lead.title} &middot; {lead.company}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">{lead.signal_type}</td>
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {lead.fit_score} / {lead.intent_score} / {lead.total_score.toFixed(1)}
                          </td>
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {lead.draft_chars}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-main)]">
                              {lead.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {lead.status === 'meeting' ? (
                              <span className="text-[var(--text-muted)]">In Deals</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handlePromoteLeadToDeal(lead.lead_id, lead.first_name)
                                }
                                className="underline text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
                              >
                                Promote to Deal &rarr;
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === 'Deals' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">deal_id</th>
                      <th className="py-3 px-4 font-medium">company</th>
                      <th className="py-3 px-4 font-medium">contact</th>
                      <th className="py-3 px-4 font-medium">lead_id</th>
                      <th className="py-3 px-4 font-medium">stage</th>
                      <th className="py-3 px-4 font-medium">amount / budget</th>
                      <th className="py-3 px-4 font-medium">next_step</th>
                      <th className="py-3 px-4 font-medium">next_step_date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {store.deals
                      .filter(
                        d =>
                          !q ||
                          d.company.toLowerCase().includes(q) ||
                          d.primary_contact_first.toLowerCase().includes(q)
                      )
                      .map(deal => (
                        <tr key={deal.deal_id} className="hover:bg-[var(--bg-hover)]">
                          <td className="py-3.5 px-4 font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {deal.deal_id}
                          </td>
                          <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                            {deal.company}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {deal.primary_contact_first}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {deal.lead_id || 'none'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] font-medium">
                              {deal.stage}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                            {deal.amount} ({deal.budget_notes})
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate">{deal.next_step}</td>
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {deal.next_step_date}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === 'Debriefs' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">debrief_id</th>
                      <th className="py-3 px-4 font-medium">event_id</th>
                      <th className="py-3 px-4 font-medium">attendees</th>
                      <th className="py-3 px-4 font-medium">source</th>
                      <th className="py-3 px-4 font-medium">stage transition</th>
                      <th className="py-3 px-4 font-medium">reminder_date</th>
                      <th className="py-3 px-4 font-medium">minutes_to_draft</th>
                      <th className="py-3 px-4 font-medium">confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {store.debriefs.map(db => (
                      <tr key={db.debrief_id} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-3.5 px-4 font-mono text-[var(--text-muted)] whitespace-nowrap">
                          {db.debrief_id}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                          {db.event_id}
                        </td>
                        <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                          {db.attendees_first_names}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{db.source}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {db.stage_before} &rarr; {db.stage_after}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {db.reminder_date}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {db.minutes_to_draft}m
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{db.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === 'Runs' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">run_date</th>
                      <th className="py-3 px-4 font-medium">x / li candidates</th>
                      <th className="py-3 px-4 font-medium">after_dedupe</th>
                      <th className="py-3 px-4 font-medium">shortlisted</th>
                      <th className="py-3 px-4 font-medium">li_opens (&le;40)</th>
                      <th className="py-3 px-4 font-medium">failures</th>
                      <th className="py-3 px-4 font-medium">notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {store.runs.map((run, idx) => (
                      <tr key={`${run.run_date}-${idx}`} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-3.5 px-4 font-mono font-medium whitespace-nowrap">
                          {run.run_date}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {run.x_candidates} X / {run.li_candidates} LI
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {run.after_dedupe}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {run.shortlisted}
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {run.li_opens} / 40
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {run.failures}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                          {run.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
