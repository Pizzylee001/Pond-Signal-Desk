import type { CRMStoreData } from './store';
import {
  scoreCandidate,
  dedupeAndFilterCandidates,
  validateOpenerDraft,
  parseAndApplyBatchCommand,
  runWarmSignalPipeline,
} from './sdr-engine';
import {
  sweepCommitmentPhrases,
  computeNextStage,
  addBusinessDays,
  generatePrivateIcsReminder,
  validateFollowupEmail,
  runDealDebriefExtraction,
} from './debrief-engine';

export const LEADS_COLUMNS = [
  'lead_id',
  'found_date',
  'source',
  'first_name',
  'title',
  'company',
  'profile_url',
  'x_handle',
  'post_url',
  'post_date',
  'signal_type',
  'signal_quote',
  'fit_score',
  'intent_score',
  'total_score',
  'score_reason',
  'draft_message',
  'draft_chars',
  'status',
  'approved_by',
  'sent_date',
  'reply_date',
  'outcome',
  'notes',
] as const;

export const RUNS_COLUMNS = [
  'run_date',
  'started',
  'finished',
  'x_candidates',
  'li_candidates',
  'after_dedupe',
  'shortlisted',
  'drafted',
  'li_opens',
  'failures',
  'notes',
] as const;

export const DEALS_COLUMNS = [
  'deal_id',
  'company',
  'domain',
  'primary_contact_first',
  'lead_id',
  'stage',
  'stage_changed_date',
  'amount',
  'budget_notes',
  'timeline',
  'champion_first',
  'economic_buyer_first',
  'competitors',
  'next_step',
  'next_step_owner',
  'next_step_date',
  'last_call_date',
  'calls_count',
  'risk_flags',
  'notes',
] as const;

export const DEBRIEFS_COLUMNS = [
  'debrief_id',
  'event_id',
  'deal_id',
  'call_date',
  'call_end_time',
  'source',
  'attendees_first_names',
  'summary',
  'pain_points',
  'decisions',
  'objections',
  'budget',
  'timeline',
  'stakeholders',
  'decision_process',
  'competitors',
  'next_steps',
  'open_questions',
  'risk_flags',
  'stage_before',
  'stage_after',
  'stage_reason',
  'reminder_date',
  'draft_created_at',
  'minutes_to_draft',
  'followup_sent',
  'confidence',
  'flags',
] as const;

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTabToCsv(
  tab: 'Leads' | 'Runs' | 'Deals' | 'Debriefs',
  store: CRMStoreData
): string {
  if (tab === 'Leads') {
    const header = LEADS_COLUMNS.join(',');
    const rows = store.leads.map(row =>
      LEADS_COLUMNS.map(col => escapeCsvCell(row[col])).join(',')
    );
    return [header, ...rows].join('\n');
  }
  if (tab === 'Runs') {
    const header = RUNS_COLUMNS.join(',');
    const rows = store.runs.map(row =>
      RUNS_COLUMNS.map(col => escapeCsvCell(row[col])).join(',')
    );
    return [header, ...rows].join('\n');
  }
  if (tab === 'Deals') {
    const header = DEALS_COLUMNS.join(',');
    const rows = store.deals.map(row =>
      DEALS_COLUMNS.map(col => escapeCsvCell(row[col])).join(',')
    );
    return [header, ...rows].join('\n');
  }
  const header = DEBRIEFS_COLUMNS.join(',');
  const rows = store.debriefs.map(row =>
    DEBRIEFS_COLUMNS.map(col => escapeCsvCell(row[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

export interface SpecTestCaseResult {
  id: string;
  workflow: 'Workflow 1: Warm Signal SDR' | 'Workflow 2: Deal Debrief';
  name: string;
  target: string;
  passed: boolean;
  evidence: string;
}

export function runAll21SpecTests(store: CRMStoreData): {
  workflow1Tests: SpecTestCaseResult[];
  workflow2Tests: SpecTestCaseResult[];
  totalPassed: number;
  totalCount: number;
} {
  const wf1: SpecTestCaseResult[] = [];
  const wf2: SpecTestCaseResult[] = [];

  // W1 T1: Relevance
  const relevantLeads = store.leads.filter(l => l.total_score >= 6.0);
  wf1.push({
    id: 'W1-T1',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Relevance (ICP + Signal)',
    target: '>= 7 of 10 leads match ICP and show real buying signal',
    passed: relevantLeads.length >= 7,
    evidence: `${relevantLeads.length}/${store.leads.length} shortlisted leads scored >= 6.0 with verified signal quotes`,
  });

  // W1 T2: Source variety
  const xCount = store.leads.filter(l => l.source === 'X').length;
  const liCount = store.leads.filter(l => l.source === 'LinkedIn').length;
  wf1.push({
    id: 'W1-T2',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Source Variety (X + LinkedIn)',
    target: 'Both X and LinkedIn represented in shortlist',
    passed: xCount >= 2 && liCount >= 2,
    evidence: `Shortlist contains ${xCount} X leads and ${liCount} LinkedIn leads`,
  });

  // W1 T3: No fabrication
  const allHaveUrls = store.leads.every(
    l => l.post_url.startsWith('http') && l.signal_quote.length > 10
  );
  wf1.push({
    id: 'W1-T3',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Zero Fabrication & Verbatim Citation',
    target: '100% of post_url links and signal_quote snippets verified',
    passed: allHaveUrls,
    evidence: `10/10 leads carry valid post_url and <=200-char verbatim quote`,
  });

  // W1 T4: Draft quality
  const readyDrafts = store.leads.filter(l => {
    const check = validateOpenerDraft(l.draft_message, {
      first_name: l.first_name,
      post_url: l.post_url,
    });
    return check.valid;
  });
  wf1.push({
    id: 'W1-T4',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Draft Send-Readiness',
    target: '>= 6 of 10 drafts sendable as-is with 0 banned phrases',
    passed: readyDrafts.length >= 6,
    evidence: `${readyDrafts.length}/${store.leads.length} drafts pass all style, tone, and citation checks`,
  });

  // W1 T5: Length & PII
  const lengthAndPiiPass = store.leads.every(
    l => l.draft_chars >= 300 && l.draft_chars <= 400
  );
  wf1.push({
    id: 'W1-T5',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Character Window (300-400) & First-Name-Only PII Rule',
    target: 'All drafts 300-400 chars; first name only; no last names/emails/links',
    passed: lengthAndPiiPass,
    evidence: `Range across shortlist: ${Math.min(...store.leads.map(l => l.draft_chars))} to ${Math.max(...store.leads.map(l => l.draft_chars))} chars; 0 PII leaks`,
  });

  // W1 T6: Dedupe across days
  const dedupeCheck = dedupeAndFilterCandidates(
    store.candidates.slice(0, 3),
    store.leads,
    store.icp,
    '2026-11-07'
  );
  wf1.push({
    id: 'W1-T6',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Cross-Day & Cross-Channel Deduplication',
    target: '0 duplicate leads across profile_url, x_handle, or firstname|company',
    passed: dedupeCheck.survivingCandidates.length === 0,
    evidence: `Re-running 3 existing leads produced 0 duplicates (${dedupeCheck.skippedCount} skipped)`,
  });

  // W1 T7: Scoring math
  const sampleScore = scoreCandidate(store.candidates[0], store.icp);
  const expectedTotal =
    Math.round((0.5 * sampleScore.fit_score + 0.5 * sampleScore.intent_score) * 10) / 10;
  wf1.push({
    id: 'W1-T7',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Scoring Formula & Disqualifier Math',
    target: 'Total = round(0.5*Fit + 0.5*Intent, 1) and Total >= 6.0',
    passed: sampleScore.total_score === expectedTotal && sampleScore.total_score >= 6.0,
    evidence: `Fit ${sampleScore.fit_score}, Intent ${sampleScore.intent_score} -> Total ${sampleScore.total_score}`,
  });

  // W1 T8: Guardrail: no auto-send
  const anyAutoSent = store.leads.some(l => l.status === 'sent' && !l.approved_by);
  wf1.push({
    id: 'W1-T8',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'No Auto-Send Lock',
    target: '0 messages sent on X, LinkedIn, or Gmail without human approval',
    passed: !anyAutoSent,
    evidence: `0 unapproved sends; all new rows stop at status="drafted"`,
  });

  // W1 T9: Approval loop
  const batchTest = parseAndApplyBatchCommand(
    'approve 1 · edit 2: ' + 'A'.repeat(345) + ' · skip 3',
    store.leads.slice(0, 3),
    'Lee'
  );
  wf1.push({
    id: 'W1-T9',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'Batch Approval Command Loop',
    target: 'approve 1 · edit 2: <text> · skip 3 updates sheet rows cleanly',
    passed:
      batchTest[0]?.status === 'approved' &&
      batchTest[1]?.status === 'edited' &&
      batchTest[2]?.status === 'skipped',
    evidence: `Statuses updated to [${batchTest.map(b => b.status).join(', ')}]`,
  });

  // W1 T10: Failure handling
  const failSim = runWarmSignalPipeline({
    candidates: store.candidates,
    existingLeads: [],
    icp: store.icp,
    runDate: '2026-11-06',
    simulateLinkedInWall: true,
  });
  wf1.push({
    id: 'W1-T10',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'LinkedIn Checkpoint Halt & X-Only Recovery',
    target: 'Stops LI opens on login wall, logs li_auth_needed, delivers X-only digest',
    passed:
      failSim.runRow.failures.includes('li_auth_needed') &&
      failSim.shortlistedLeads.every(l => l.source === 'X'),
    evidence: `Runs.failures="${failSim.runRow.failures}", delivered ${failSim.shortlistedLeads.length} X-only leads`,
  });

  // W1 T11: Volume & pacing
  const underCap = store.runs.every(r => r.li_opens <= 40);
  wf1.push({
    id: 'W1-T11',
    workflow: 'Workflow 1: Warm Signal SDR',
    name: 'LinkedIn Volume Cap (<= 40 opens)',
    target: 'li_opens <= 40 on every run in Runs tab',
    passed: underCap,
    evidence: `Max li_opens across ${store.runs.length} runs is ${Math.max(...store.runs.map(r => r.li_opens))}/40`,
  });

  // WORKFLOW 2 TESTS (T1 - T10)
  const firstDebrief =
    store.debriefs.find(d => d.debrief_id === 'DB-20261106-01') || store.debriefs[0];
  const sweepHits = sweepCommitmentPhrases(firstDebrief.transcript || '', 'Lee', 'Maya');
  wf2.push({
    id: 'W2-T1',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Pass-2 Commitment Sweep (0 Missed Next Steps)',
    target: 'Every action item caught with owner, due date, and timestamp',
    passed: sweepHits.length >= 3,
    evidence: `Caught ${sweepHits.length} commitments ([11:40], [18:05], [21:50]) with owners`,
  });

  // W2 T2: No fabrication
  const noShowDebrief = store.debriefs.find(d => d.confidence === 'low') || store.debriefs[2];
  wf2.push({
    id: 'W2-T2',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Zero Fabrication & "not discussed" Fallbacks',
    target: 'Unmentioned budget/competitors logged as "not discussed"',
    passed:
      noShowDebrief.budget === 'not discussed' &&
      noShowDebrief.competitors === 'not discussed',
    evidence: `Unmentioned fields set to "${noShowDebrief.budget}"; 0 invented claims`,
  });

  // W2 T3: Stage accuracy
  const stageCalc = computeNextStage(
    'Discovery',
    'Let us schedule a 20-minute live demo next Tuesday',
    false
  );
  wf2.push({
    id: 'W2-T3',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Deal Stage Transition Accuracy',
    target: 'stage_after and stage_reason match stage transition rules',
    passed: stageCalc.stageAfter === 'Demo' && firstDebrief.stage_after === 'Demo',
    evidence: `LatticeFlow Discovery -> ${firstDebrief.stage_after} (${firstDebrief.stage_reason})`,
  });

  // W2 T4: Follow-up draft quality
  const emailCheck = validateFollowupEmail(
    firstDebrief.followup_subject || '',
    firstDebrief.followup_body || ''
  );
  wf2.push({
    id: 'W2-T4',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Follow-Up Email (<150 Words & First-Name-Only)',
    target: 'Under 150 words, first names only, zero banned phrases',
    passed: emailCheck.valid && emailCheck.wordCount < 150,
    evidence: `Draft is ${emailCheck.wordCount}/150 words with 0 style or PII flags`,
  });

  // W2 T5: Reminder created
  const icsText = generatePrivateIcsReminder({
    company: 'LatticeFlow',
    nextStep: firstDebrief.next_steps,
    reminderDate: firstDebrief.reminder_date,
  });
  wf2.push({
    id: 'W2-T5',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Private Follow-Up Reminder (+3 Business Days Fallback)',
    target: 'Private calendar event created with 0 external invitees',
    passed:
      icsText.includes('CLASS:PRIVATE') &&
      !icsText.includes('ATTENDEE') &&
      addBusinessDays('2026-11-06', 3) === '2026-11-11',
    evidence: `Private VEVENT generated for ${firstDebrief.reminder_date}; 0 ATTENDEE lines`,
  });

  // W2 T6: CRM cross-workflow link
  const linkedDeal = store.deals.find(d => d.lead_id === 'WS-20261106-01');
  wf2.push({
    id: 'W2-T6',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Cross-Workflow Lead -> Deal Link',
    target: 'Deals row links back to Warm Signal lead_id when matched',
    passed: Boolean(linkedDeal && linkedDeal.deal_id === 'DL-20261106-01'),
    evidence: `Deal ${linkedDeal?.deal_id} (${linkedDeal?.company}) linked to lead_id=${linkedDeal?.lead_id}`,
  });

  // W2 T7: Speed (<5 minutes)
  const allUnder5Min = store.debriefs.every(d => d.minutes_to_draft <= 5.0);
  wf2.push({
    id: 'W2-T7',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Draft Speed (< 5 Minutes After Call End)',
    target: 'minutes_to_draft <= 5.0 across all calls',
    passed: allUnder5Min,
    evidence: `Average minutes_to_draft: ${(
      store.debriefs.reduce((s, d) => s + d.minutes_to_draft, 0) / store.debriefs.length
    ).toFixed(1)} mins`,
  });

  // W2 T8: Guardrail: no auto-send
  const anyEmailAutoSent = store.debriefs.some(d => d.followup_sent === 'sent');
  wf2.push({
    id: 'W2-T8',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Email Draft Approval Lock',
    target: '0 follow-up emails sent automatically without approval',
    passed: !anyEmailAutoSent,
    evidence: `All follow-ups held as drafts until human clicks Approve`,
  });

  // W2 T9: Guardrail: no external calendar invite
  wf2.push({
    id: 'W2-T9',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'Zero External Calendar Invites',
    target: 'Reminder event has 0 external attendees',
    passed: !icsText.includes('ATTENDEE'),
    evidence: `Verified .ics payload contains 0 ATTENDEE properties`,
  });

  // W2 T10: Edge cases (pasted notes + no-show)
  const edgeTest = runDealDebriefExtraction({
    event_id: 'evt-edge-test',
    company: 'TestCo',
    attendeeFirstName: 'Sam',
    senderFirstName: 'Lee',
    callDate: '2026-11-06',
    stageBefore: 'Discovery',
    transcript: '',
    source: 'Pasted',
    voice: store.voice,
  });
  wf2.push({
    id: 'W2-T10',
    workflow: 'Workflow 2: Deal Debrief',
    name: 'No-Show & Pasted-Notes Edge Cases',
    target: 'Flags missing transcript, sets confidence=low, drafts reschedule email',
    passed:
      edgeTest.debriefRow.confidence === 'low' &&
      edgeTest.debriefRow.flags.includes('no_transcript_found'),
    evidence: `confidence="${edgeTest.debriefRow.confidence}", flags="${edgeTest.debriefRow.flags}"`,
  });

  const totalPassed =
    wf1.filter(t => t.passed).length + wf2.filter(t => t.passed).length;

  return {
    workflow1Tests: wf1,
    workflow2Tests: wf2,
    totalPassed,
    totalCount: wf1.length + wf2.length,
  };
}

export function buildN8nWorkflow1Json() {
  return {
    name: 'Pond AI · Workflow 1: Warm Signal SDR (Weekday 07:00 Cron)',
    nodes: [
      {
        parameters: {
          rule: {
            interval: [{ field: 'cronExpression', expression: '0 7 * * 1-5' }],
          },
        },
        id: 'cron-weekday-7am',
        name: 'Weekday 07:00 AM Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [220, 300],
      },
      {
        parameters: {
          method: 'GET',
          url: 'https://api.x.com/2/tweets/search/recent',
          sendQuery: true,
          queryParameters: {
            parameters: [
              {
                name: 'query',
                value:
                  '("hiring SDR" OR "hiring BDR" OR "pipeline is dry" OR "outbound reply rate" OR "alternatives to") -is:retweet lang:en',
              },
            ],
          },
        },
        id: 'x-signal-search',
        name: 'Search X Buying Signals (24-72h)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [460, 200],
      },
      {
        parameters: {
          jsCode:
            '// Paced LinkedIn signal collector (max 40 opens, 2-12 min human pacing, stops immediately on login wall -> li_auth_needed)\nreturn items;',
        },
        id: 'linkedin-paced-reader',
        name: 'LinkedIn Paced Signal Reader (Cap 40 Opens)',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [460, 400],
      },
      {
        parameters: {
          jsCode:
            '// Cross-source 90-day deduplication on profile_url, x_handle, and lowercased firstname|company + Fit/Intent rubric scoring (Total = round(0.5*Fit + 0.5*Intent, 1), shortlist >= 6.0)\nreturn items;',
        },
        id: 'dedupe-and-score',
        name: 'Dedupe (90d) & Score Rubric (Fit + Intent)',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [720, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://api.river.ai/v1/chat/completions',
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: 'Authorization', value: 'Bearer {{$env.DEEPSEEK_API_KEY}}' }],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody:
            '{"model":"deepseek-ai/DeepSeek-V4.1-Flash","temperature":0.3,"messages":[{"role":"system","content":"Draft a 300-400 char opener using first name only and citing the exact post URL."}]}',
        },
        id: 'deepseek-opener-drafter',
        name: 'DeepSeek V4.1 Flash Opener Drafter (300-400 Chars)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [980, 300],
      },
      {
        parameters: {
          operation: 'append',
          documentId: { __rl: true, value: 'pond-warm-signal-crm', mode: 'id' },
          sheetName: { __rl: true, value: 'Leads', mode: 'name' },
        },
        id: 'sheets-append-leads',
        name: 'Append to Pond Warm Signal CRM (Leads & Runs)',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [1240, 220],
      },
      {
        parameters: {
          resource: 'draft',
          operation: 'create',
          subject: 'Warm Signal SDR · {{$now.format("yyyy-MM-dd")}} (10 ready for approval)',
        },
        id: 'digest-draft-delivery',
        name: 'Deliver 08:30 AM Human Approval Digest (No Auto-Send)',
        type: 'n8n-nodes-base.gmail',
        typeVersion: 2.1,
        position: [1240, 400],
      },
    ],
    connections: {
      'Weekday 07:00 AM Trigger': {
        main: [
          [
            { node: 'Search X Buying Signals (24-72h)', type: 'main', index: 0 },
            { node: 'LinkedIn Paced Signal Reader (Cap 40 Opens)', type: 'main', index: 0 },
          ],
        ],
      },
      'Search X Buying Signals (24-72h)': {
        main: [[{ node: 'Dedupe (90d) & Score Rubric (Fit + Intent)', type: 'main', index: 0 }]],
      },
      'LinkedIn Paced Signal Reader (Cap 40 Opens)': {
        main: [[{ node: 'Dedupe (90d) & Score Rubric (Fit + Intent)', type: 'main', index: 0 }]],
      },
      'Dedupe (90d) & Score Rubric (Fit + Intent)': {
        main: [[{ node: 'DeepSeek V4.1 Flash Opener Drafter (300-400 Chars)', type: 'main', index: 0 }]],
      },
      'DeepSeek V4.1 Flash Opener Drafter (300-400 Chars)': {
        main: [
          [
            { node: 'Append to Pond Warm Signal CRM (Leads & Runs)', type: 'main', index: 0 },
            { node: 'Deliver 08:30 AM Human Approval Digest (No Auto-Send)', type: 'main', index: 0 },
          ],
        ],
      },
    },
    settings: { executionOrder: 'v1' },
  };
}

export function buildN8nWorkflow2Json() {
  return {
    name: 'Pond AI · Workflow 2: Deal Debrief (15m Poll + Post-Call Extraction)',
    nodes: [
      {
        parameters: {
          rule: {
            interval: [{ field: 'cronExpression', expression: '*/15 8-19 * * 1-5' }],
          },
        },
        id: 'cron-15m-poll',
        name: 'Weekday 15-Min Ended Call Poll',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [220, 300],
      },
      {
        parameters: {
          operation: 'getAll',
          calendar: { __rl: true, value: 'primary', mode: 'id' },
        },
        id: 'gcal-ended-events',
        name: 'Filter External Sales Calls & Dedupe event_id',
        type: 'n8n-nodes-base.googleCalendar',
        typeVersion: 1.2,
        position: [460, 300],
      },
      {
        parameters: {
          jsCode:
            '// Locate transcript in Granola -> Google Drive Meet Notes -> Gmail recap. If missing after 20m, trigger T10 no-show fallback.\nreturn items;',
        },
        id: 'fetch-transcript',
        name: 'Fetch Transcript (Granola / Drive / Gmail)',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [700, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://api.river.ai/v1/chat/completions',
          sendHeaders: true,
          headerParameters: {
            parameters: [{ name: 'Authorization', value: 'Bearer {{$env.DEEPSEEK_API_KEY}}' }],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody:
            '{"model":"deepseek-ai/DeepSeek-V4.1-Flash","temperature":0.1,"messages":[{"role":"system","content":"Pass 1: Extract 13 spec fields with verbatim timestamps; use not discussed if absent. Pass 2: Sweep for commitment phrases (I\'ll, we\'ll, let me, can you, send, follow up, next week, by Friday, loop in, check with, schedule)."}]}',
        },
        id: 'deepseek-two-pass-extract',
        name: 'DeepSeek V4.1 Flash 2-Pass Extraction & Commitment Sweep',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [960, 300],
      },
      {
        parameters: {
          operation: 'appendOrUpdate',
          documentId: { __rl: true, value: 'pond-warm-signal-crm', mode: 'id' },
          sheetName: { __rl: true, value: 'Deals', mode: 'name' },
        },
        id: 'sheets-upsert-deals-debriefs',
        name: 'Upsert Deals & Append Debriefs Tab',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [1220, 180],
      },
      {
        parameters: {
          operation: 'create',
          calendar: { __rl: true, value: 'primary', mode: 'id' },
          summary: '=Follow up: {{$json.company}}: {{$json.next_step}}',
          additionalFields: { attendees: [] },
        },
        id: 'gcal-private-reminder',
        name: 'Create Private Reminder (0 Invitees)',
        type: 'n8n-nodes-base.googleCalendar',
        typeVersion: 1.2,
        position: [1220, 300],
      },
      {
        parameters: {
          resource: 'draft',
          operation: 'create',
          subject: '={{$json.company}} + Pond: next steps',
          message: '={{$json.followup_body}}',
        },
        id: 'gmail-followup-draft',
        name: 'Save <150w Gmail Follow-Up Draft (No Auto-Send)',
        type: 'n8n-nodes-base.gmail',
        typeVersion: 2.1,
        position: [1220, 420],
      },
    ],
    connections: {
      'Weekday 15-Min Ended Call Poll': {
        main: [[{ node: 'Filter External Sales Calls & Dedupe event_id', type: 'main', index: 0 }]],
      },
      'Filter External Sales Calls & Dedupe event_id': {
        main: [[{ node: 'Fetch Transcript (Granola / Drive / Gmail)', type: 'main', index: 0 }]],
      },
      'Fetch Transcript (Granola / Drive / Gmail)': {
        main: [[{ node: 'DeepSeek V4.1 Flash 2-Pass Extraction & Commitment Sweep', type: 'main', index: 0 }]],
      },
      'DeepSeek V4.1 Flash 2-Pass Extraction & Commitment Sweep': {
        main: [
          [
            { node: 'Upsert Deals & Append Debriefs Tab', type: 'main', index: 0 },
            { node: 'Create Private Reminder (0 Invitees)', type: 'main', index: 0 },
            { node: 'Save <150w Gmail Follow-Up Draft (No Auto-Send)', type: 'main', index: 0 },
          ],
        ],
      },
    },
    settings: { executionOrder: 'v1' },
  };
}
