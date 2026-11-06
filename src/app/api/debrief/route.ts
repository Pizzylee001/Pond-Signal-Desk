import { NextResponse } from 'next/server';
import { readStore, writeStore, type DealRow } from '@/lib/store';
import {
  runDealDebriefExtraction,
  validateFollowupEmail,
} from '@/lib/debrief-engine';

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    debriefs: store.debriefs,
    deals: store.deals,
    leadsCount: store.leads.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = readStore();

    if (body.action === 'approve_followup') {
      const { debrief_id, followup_subject, followup_body } = body as {
        debrief_id: string;
        followup_subject: string;
        followup_body: string;
      };
      const idx = store.debriefs.findIndex(d => d.debrief_id === debrief_id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Debrief not found' }, { status: 404 });
      }
      store.debriefs[idx].followup_subject = followup_subject;
      store.debriefs[idx].followup_body = followup_body;
      store.debriefs[idx].followup_sent = 'approved';
      const check = validateFollowupEmail(followup_subject, followup_body);
      store.debriefs[idx].flags = check.flags.length ? check.flags.join(', ') : 'none';
      writeStore(store);
      return NextResponse.json({ store, updatedDebrief: store.debriefs[idx] });
    }

    if (body.action === 'create_debrief') {
      const {
        company,
        attendeeFirstName,
        stageBefore = 'Discovery',
        transcript,
      } = body as {
        company: string;
        attendeeFirstName: string;
        stageBefore?: DealRow['stage'];
        transcript: string;
      };

      const callDate = '2026-11-06';
      const existingDeal = store.deals.find(
        d => d.company.toLowerCase() === company.toLowerCase().trim()
      );
      const dealId =
        existingDeal?.deal_id ||
        `DL-${callDate.replace(/-/g, '')}-${String(store.deals.length + 1).padStart(2, '0')}`;

      const { debriefRow } = runDealDebriefExtraction({
        event_id: `evt-manual-${Date.now()}`,
        deal_id: dealId,
        company: company.trim(),
        attendeeFirstName: attendeeFirstName.trim(),
        senderFirstName: store.voice.senderFirstName || 'Lee',
        callDate,
        stageBefore: existingDeal ? existingDeal.stage : stageBefore,
        transcript,
        source: 'Pasted',
        voice: store.voice,
      });

      store.debriefs.unshift(debriefRow);

      if (existingDeal) {
        existingDeal.stage = debriefRow.stage_after as DealRow['stage'];
        existingDeal.stage_changed_date = callDate;
        existingDeal.last_call_date = callDate;
        existingDeal.calls_count += 1;
        existingDeal.next_step = debriefRow.next_steps;
        existingDeal.next_step_date = debriefRow.reminder_date;
        if (debriefRow.budget !== 'not discussed') {
          existingDeal.budget_notes = debriefRow.budget;
        }
      } else {
        const matchedLead = store.leads.find(
          l =>
            l.company.toLowerCase() === company.toLowerCase().trim() ||
            l.first_name.toLowerCase() === attendeeFirstName.toLowerCase().trim()
        );
        store.deals.unshift({
          deal_id: dealId,
          company: company.trim(),
          domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          primary_contact_first: attendeeFirstName.trim(),
          lead_id: matchedLead ? matchedLead.lead_id : '',
          stage: debriefRow.stage_after as DealRow['stage'],
          stage_changed_date: callDate,
          amount: 'not discussed',
          budget_notes: debriefRow.budget,
          timeline: debriefRow.timeline,
          champion_first: attendeeFirstName.trim(),
          economic_buyer_first: 'unverified',
          competitors: debriefRow.competitors,
          next_step: debriefRow.next_steps,
          next_step_owner: 'us',
          next_step_date: debriefRow.reminder_date,
          last_call_date: callDate,
          calls_count: 1,
          risk_flags: debriefRow.risk_flags,
          notes: `Created from Deal Debrief ${debriefRow.debrief_id}`,
        });
      }

      writeStore(store);
      return NextResponse.json({ store, createdDebrief: debriefRow });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}
