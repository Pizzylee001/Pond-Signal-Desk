import { NextResponse } from 'next/server';
import { readStore, writeStore, type DealRow } from '@/lib/store';
import {
  parseAndApplyBatchCommand,
  runWarmSignalPipeline,
  validateOpenerDraft,
  type CandidateInput,
  type LeadRow,
  type LeadStatus,
} from '@/lib/sdr-engine';
import {
  generateOpenerWithDeepSeek,
  scoreAndDraftCandidateWithDeepSeek,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_RIVER_BASE_URL,
} from '@/lib/deepseek';

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    ...store,
    aiConfig: {
      baseUrl: DEFAULT_RIVER_BASE_URL,
      modelId: DEFAULT_DEEPSEEK_MODEL,
      modelName: 'DeepSeek V4.1 Flash',
      connected: Boolean(process.env.DEEPSEEK_API_KEY),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = readStore();

    if (body.action === 'update_lead') {
      const { lead_id, status, draft_message } = body as {
        lead_id: string;
        status?: LeadStatus;
        draft_message?: string;
      };
      const idx = store.leads.findIndex(l => l.lead_id === lead_id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      if (typeof draft_message === 'string') {
        store.leads[idx].draft_message = draft_message;
        store.leads[idx].draft_chars = draft_message.length;
        const check = validateOpenerDraft(draft_message, {
          first_name: store.leads[idx].first_name,
          post_url: store.leads[idx].post_url,
        });
        store.leads[idx].notes = check.flags.length ? `Flags: ${check.flags.join(', ')}` : '';
      }

      if (status) {
        store.leads[idx].status = status;
        if (status === 'approved' || status === 'edited') {
          store.leads[idx].approved_by = store.voice.senderFirstName || 'Lee';
        }
        if (status === 'sent') {
          store.leads[idx].sent_date = new Date().toISOString().slice(0, 10);
        }
        if (status === 'meeting') {
          store.leads[idx].reply_date = new Date().toISOString().slice(0, 10);
          store.leads[idx].outcome = 'positive';
          const existingDeal = store.deals.find(d => d.lead_id === lead_id);
          if (!existingDeal) {
            const newDeal: DealRow = {
              deal_id: `DL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(
                store.deals.length + 1
              ).padStart(2, '0')}`,
              company: store.leads[idx].company,
              domain: `${store.leads[idx].company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
              primary_contact_first: store.leads[idx].first_name,
              lead_id: store.leads[idx].lead_id,
              stage: 'Discovery',
              stage_changed_date: new Date().toISOString().slice(0, 10),
              amount: 'not discussed',
              budget_notes: 'not discussed',
              timeline: 'not discussed',
              champion_first: store.leads[idx].first_name,
              economic_buyer_first: 'unverified',
              competitors: 'not discussed',
              next_step: 'Run Discovery Call & Deal Debrief',
              next_step_owner: 'us',
              next_step_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
              last_call_date: '',
              calls_count: 0,
              risk_flags: 'none',
              notes: `Promoted from Warm Signal ${store.leads[idx].source} post (${store.leads[idx].signal_type})`,
            };
            store.deals.unshift(newDeal);
          }
        }
      }

      writeStore(store);
      return NextResponse.json({ store, updatedLead: store.leads[idx] });
    }

    if (body.action === 'batch_command') {
      const { commandText } = body as { commandText: string };
      store.leads = parseAndApplyBatchCommand(
        commandText,
        store.leads,
        store.voice.senderFirstName || 'Lee'
      );
      writeStore(store);
      return NextResponse.json({ store });
    }

    if (body.action === 'run_pipeline') {
      const { simulateLinkedInWall = false, simulateXFailure = false } = body as {
        simulateLinkedInWall?: boolean;
        simulateXFailure?: boolean;
      };
      const result = runWarmSignalPipeline({
        candidates: store.candidates,
        existingLeads: [],
        icp: store.icp,
        runDate: '2026-11-06',
        simulateLinkedInWall,
        simulateXFailure,
      });
      store.leads = result.shortlistedLeads;
      store.runs.unshift(result.runRow);
      writeStore(store);
      return NextResponse.json({ store, runRow: result.runRow });
    }

    if (body.action === 'regenerate_opener') {
      const { lead_id, apiKey } = body as { lead_id: string; apiKey?: string };
      const leadIdx = store.leads.findIndex(l => l.lead_id === lead_id);
      if (leadIdx === -1) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      const lead = store.leads[leadIdx];
      const cand: CandidateInput =
        store.candidates.find(
          c =>
            c.first_name.toLowerCase() === lead.first_name.toLowerCase() &&
            c.company.toLowerCase() === lead.company.toLowerCase()
        ) || {
          id: lead.lead_id,
          source: lead.source,
          first_name: lead.first_name,
          title: lead.title,
          company: lead.company,
          company_size: 40,
          industry: 'B2B SaaS',
          geo: 'US',
          is_competitor_or_recruiter: false,
          profile_url: lead.profile_url,
          x_handle: lead.x_handle,
          post_url: lead.post_url,
          post_date: lead.post_date,
          hours_ago: 12,
          signal_type: lead.signal_type,
          signal_strength: 5,
          specificity_points: 2,
          signal_quote: lead.signal_quote,
        };

      const { draft, usedModel, flags, latencyMs, liveApiUsed } = await generateOpenerWithDeepSeek(
        { ...cand, custom_draft: undefined },
        store.icp,
        apiKey
      );
      store.leads[leadIdx].draft_message = draft;
      store.leads[leadIdx].draft_chars = draft.length;
      store.leads[leadIdx].notes = flags.length
        ? `Flags: ${flags.join(', ')}`
        : `Generated by ${usedModel} (${latencyMs}ms)`;
      writeStore(store);
      return NextResponse.json({
        store,
        updatedLead: store.leads[leadIdx],
        usedModel,
        latencyMs,
        liveApiUsed,
      });
    }

    if (body.action === 'score_new_post') {
      const {
        first_name,
        title,
        company,
        source = 'X',
        post_url,
        signal_quote,
        apiKey,
      } = body as {
        first_name: string;
        title: string;
        company: string;
        source?: 'LinkedIn' | 'X';
        post_url: string;
        signal_quote: string;
        apiKey?: string;
      };

      const cand: CandidateInput = {
        id: `cand-${Date.now()}`,
        source,
        first_name: first_name.trim(),
        title: title.trim(),
        company: company.trim(),
        company_size: 35,
        industry: 'B2B SaaS',
        geo: 'US',
        is_competitor_or_recruiter: false,
        profile_url:
          source === 'LinkedIn'
            ? post_url
            : `https://linkedin.com/in/${first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        x_handle:
          source === 'X'
            ? `@${first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
            : '',
        post_url: post_url.trim(),
        post_date: '2026-11-06',
        hours_ago: 4,
        signal_type: 'hiring',
        signal_strength: 5,
        specificity_points: 2,
        signal_quote: signal_quote.trim(),
      };

      const scored = await scoreAndDraftCandidateWithDeepSeek(cand, store.icp, apiKey);
      const newLead: LeadRow = {
        lead_id: `WS-20261106-${String(store.leads.length + 1).padStart(2, '0')}`,
        found_date: '2026-11-06',
        source,
        first_name: cand.first_name,
        title: cand.title,
        company: cand.company,
        profile_url: cand.profile_url,
        x_handle: cand.x_handle,
        signal_type: scored.signal_type,
        post_url: cand.post_url,
        post_date: cand.post_date,
        signal_quote: cand.signal_quote,
        fit_score: scored.fit_score,
        intent_score: scored.intent_score,
        total_score: scored.total_score,
        score_reason: scored.score_reason,
        draft_message: scored.draft,
        draft_chars: scored.draft.length,
        status: 'drafted',
        approved_by: '',
        sent_date: '',
        reply_date: '',
        outcome: '',
        notes: `Scored & drafted by ${scored.usedModel} (${scored.latencyMs}ms)`,
      };

      store.candidates.unshift(cand);
      store.leads.unshift(newLead);
      writeStore(store);

      return NextResponse.json({
        store,
        createdLead: newLead,
        usedModel: scored.usedModel,
        latencyMs: scored.latencyMs,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}
