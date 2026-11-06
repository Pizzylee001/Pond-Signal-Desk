import fs from 'fs';
import path from 'path';
import {
  runWarmSignalPipeline,
  type CandidateInput,
  type ICPMemory,
  type LeadRow,
  type RunRow,
} from './sdr-engine';

export interface DealRow {
  deal_id: string;
  company: string;
  domain: string;
  primary_contact_first: string;
  lead_id: string;
  stage:
    | 'Lead'
    | 'Discovery'
    | 'Demo'
    | 'Evaluation/Pilot'
    | 'Proposal'
    | 'Negotiation'
    | 'Closed Won'
    | 'Closed Lost'
    | 'Paused';
  stage_changed_date: string;
  amount: string;
  budget_notes: string;
  timeline: string;
  champion_first: string;
  economic_buyer_first: string;
  competitors: string;
  next_step: string;
  next_step_owner: string;
  next_step_date: string;
  last_call_date: string;
  calls_count: number;
  risk_flags: string;
  notes: string;
}

export interface DebriefRow {
  debrief_id: string;
  event_id: string;
  deal_id: string;
  call_date: string;
  call_end_time: string;
  source: 'Granola' | 'Google Doc' | 'Gmail' | 'Pasted';
  attendees_first_names: string;
  summary: string;
  pain_points: string;
  decisions: string;
  objections: string;
  budget: string;
  timeline: string;
  stakeholders: string;
  decision_process: string;
  competitors: string;
  next_steps: string;
  open_questions: string;
  risk_flags: string;
  stage_before: string;
  stage_after: string;
  stage_reason: string;
  reminder_date: string;
  draft_created_at: string;
  minutes_to_draft: number;
  followup_sent: 'no' | 'approved' | 'sent';
  confidence: 'high' | 'medium' | 'low';
  flags: string;
  followup_subject?: string;
  followup_body?: string;
  transcript?: string;
}

export interface VoiceMemory {
  senderFirstName: string;
  signOff: string;
  maxFollowupWords: number;
  defaultReminderBusinessDays: number;
  internalDomain: string;
}

export interface CRMStoreData {
  icp: ICPMemory;
  voice: VoiceMemory;
  candidates: CandidateInput[];
  leads: LeadRow[];
  runs: RunRow[];
  deals: DealRow[];
  debriefs: DebriefRow[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'crm-store.json');

export const SEED_ICP: ICPMemory = {
  companySizeMin: 10,
  companySizeMax: 200,
  targetIndustries: ['B2B SaaS', 'DevTools', 'AI Infrastructure', 'Fintech', 'RevOps', 'Data Ops'],
  targetGeos: ['US', 'CA', 'UK', 'Remote'],
  buyerTitles: [
    'Founder',
    'CEO',
    'Head of Sales',
    'VP Sales',
    'Head of Growth',
    'VP Growth',
    'Head of Revenue',
    'CRO',
    'RevOps',
  ],
  adjacentTitles: ['Director of Marketing', 'Chief of Staff', 'Product Lead', 'GTM Engineer'],
  exclusionDomainsOrNames: ['competitor.io', 'spamagency.com', 'recruiter-hub.io'],
  approvedProofPoints: [
    'Pond surfaces daily scored LinkedIn and X intent leads with cited sources in one sheet',
    'Teams using Pond review and approve 10 warm signal openers in under 10 minutes each morning',
  ],
};

export const SEED_VOICE: VoiceMemory = {
  senderFirstName: 'Lee',
  signOff: 'Best,\nLee',
  maxFollowupWords: 150,
  defaultReminderBusinessDays: 3,
  internalDomain: 'joinpond.ai',
};

export const SEED_CANDIDATES: CandidateInput[] = [
  {
    id: 'cand-01',
    source: 'X',
    first_name: 'Maya',
    last_name: 'Lin',
    title: 'Head of Growth',
    company: 'LatticeFlow',
    company_size: 42,
    industry: 'B2B SaaS',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://x.com/mayagrowth',
    x_handle: '@mayagrowth',
    post_url: 'https://x.com/mayagrowth/status/198639104218',
    post_date: '2026-11-06',
    hours_ago: 14,
    signal_type: 'asking',
    signal_strength: 5,
    specificity_points: 2,
    signal_quote:
      'Hiring our first 2 SDRs next month and dreading the 6-tool frankenstack. What are lean B2B teams using to catch warm buying signals on X + LinkedIn without paying $25k/yr?',
    custom_draft:
      'Hey Maya, saw your X post about hiring your first two SDRs and trying to avoid a six-tool outbound stack. Most teams we talk to find that catching 48-hour buying signals cuts ramp time in half before adding headcount. At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to send the rubric we use?',
  },
  {
    id: 'cand-02',
    source: 'LinkedIn',
    first_name: 'Devon',
    last_name: 'Cole',
    title: 'Founder & CEO',
    company: 'CrateOps',
    company_size: 28,
    industry: 'DevTools',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://linkedin.com/in/devon-crateops',
    x_handle: '@devoncole',
    post_url: 'https://linkedin.com/posts/devon-crateops-77812',
    post_date: '2026-11-06',
    hours_ago: 19,
    signal_type: 'pain',
    signal_strength: 4,
    specificity_points: 2,
    signal_quote:
      'Our cold outbound reply rate dropped from 3.4% to 0.9% this quarter even with 4 domains warming. Buyers just ignore sequence templates now.',
    custom_draft:
      'Hey Devon, saw your LinkedIn post on cold reply rates dropping from 3.4% to 0.9% despite warming four domains. Teams seeing that shift usually find timing beats sequence volume when prospects post live buying signals. Pond tracks daily X and LinkedIn intent posts and drafts source-cited openers for human approval. Open to seeing how we score signals?',
  },
  {
    id: 'cand-03',
    source: 'LinkedIn',
    first_name: 'Sam',
    last_name: 'Mercer',
    title: 'VP Sales',
    company: 'VeloCloud AI',
    company_size: 65,
    industry: 'AI Infrastructure',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://linkedin.com/in/sam-velocloud',
    x_handle: '@samvelocloud',
    post_url: 'https://linkedin.com/posts/sam-velocloud-99201',
    post_date: '2026-11-05',
    hours_ago: 22,
    signal_type: 'hiring',
    signal_strength: 4,
    specificity_points: 2,
    signal_quote:
      'Just closed our $6M Seed and hiring our founding RevOps lead + 2 BDRs in NYC to build our outbound engine from scratch.',
    custom_draft:
      'Hey Sam, saw your LinkedIn post on the $6M Seed and hiring your founding RevOps lead and two BDRs in NYC. Building the signal feed before new reps start usually saves their first month of cold list building. Pond delivers 10 scored LinkedIn and X buying signals each morning into your CRM sheet for quick approval. Worth a look while you build the stack?',
  },
  {
    id: 'cand-04',
    source: 'X',
    first_name: 'Elena',
    last_name: 'Rostova',
    title: 'Head of Revenue',
    company: 'FinchPay',
    company_size: 54,
    industry: 'Fintech',
    geo: 'UK',
    is_competitor_or_recruiter: false,
    profile_url: 'https://x.com/elenafinch',
    x_handle: '@elenafinch',
    post_url: 'https://x.com/elenafinch/status/198631098112',
    post_date: '2026-11-05',
    hours_ago: 28,
    signal_type: 'new_role',
    signal_strength: 4,
    specificity_points: 2,
    signal_quote:
      'Week 2 as Head of Revenue at FinchPay. Auditing every outbound tool we pay for and cutting anything reps do not use daily.',
    custom_draft:
      'Hey Elena, saw your X update on week two at FinchPay and auditing the outbound stack to cut shelfware. New revenue leaders we work with often replace heavy sequencers with a daily feed of verified buying signals. Pond scores live LinkedIn and X intent posts every morning and drafts source-backed openers in one sheet. Want to compare notes?',
  },
  {
    id: 'cand-05',
    source: 'X',
    first_name: 'Marcus',
    last_name: 'Vance',
    title: 'Founder',
    company: 'TraceGrid',
    company_size: 19,
    industry: 'Data Ops',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://x.com/marcustrace',
    x_handle: '@marcustrace',
    post_url: 'https://x.com/marcustrace/status/198628441092',
    post_date: '2026-11-05',
    hours_ago: 18,
    signal_type: 'asking',
    signal_strength: 5,
    specificity_points: 1,
    signal_quote:
      'Any lightweight alternatives to Gojiberry AI that cover both X and LinkedIn intent signals and write straight to Google Sheets?',
    custom_draft:
      'Hey Marcus, saw your X question looking for a Gojiberry alternative that covers both X and LinkedIn signals and writes directly to Google Sheets. Owning the scoring rubric in your own sheet makes it much easier to tune lead quality week over week. Pond runs that exact dual-feed workflow with human approval before any send. Want to see our sheet template?',
  },
  {
    id: 'cand-06',
    source: 'LinkedIn',
    first_name: 'Priya',
    last_name: 'Nair',
    title: 'VP Growth',
    company: 'RunwayML Ops',
    company_size: 88,
    industry: 'AI Infrastructure',
    geo: 'CA',
    is_competitor_or_recruiter: false,
    profile_url: 'https://linkedin.com/in/priya-runwayops',
    x_handle: '@priyanair_gtm',
    post_url: 'https://linkedin.com/posts/priya-runwayops-66120',
    post_date: '2026-11-05',
    hours_ago: 21,
    signal_type: 'pain',
    signal_strength: 4,
    specificity_points: 2,
    signal_quote:
      'Pipeline feels dry from static Apollo exports. We only book meetings when we catch founders talking about an active migration in real time.',
    custom_draft:
      'Hey Priya, saw your LinkedIn post about static exports drying up and only booking meetings when you catch active migration conversations in real time. Catching those posts within 24 hours is usually the difference between a reply and a burial. Pond scores live X and LinkedIn buying signals daily into one sheet with cited URLs. Open to seeing a sample digest?',
  },
  {
    id: 'cand-07',
    source: 'X',
    first_name: 'Tariq',
    last_name: 'Hassan',
    title: 'Head of Sales',
    company: 'Kitebridge',
    company_size: 34,
    industry: 'B2B SaaS',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://x.com/tariqsales',
    x_handle: '@tariqsales',
    post_url: 'https://x.com/tariqsales/status/198624001928',
    post_date: '2026-11-05',
    hours_ago: 30,
    signal_type: 'hiring',
    signal_strength: 4,
    specificity_points: 1,
    signal_quote:
      'Looking for our first 2 outbound BDRs who know how to research live triggers instead of blasting 500 templates a day.',
    custom_draft:
      'Hey Tariq, saw your X post about hiring two outbound BDRs focused on live triggers instead of blasting 500 templates a day. Giving new reps 10 pre-scored, source-cited warm signals every morning lets them spend their time personalizing instead of scrolling feeds. Pond automates the daily scoring and sheet sync with human sign-off. Want to see how it works?',
  },
  {
    id: 'cand-08',
    source: 'LinkedIn',
    first_name: 'Chloe',
    last_name: 'Bennett',
    title: 'CEO',
    company: 'StackPulse',
    company_size: 24,
    industry: 'DevTools',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://linkedin.com/in/chloe-stackpulse',
    x_handle: '@chloestack',
    post_url: 'https://linkedin.com/posts/chloe-stackpulse-55109',
    post_date: '2026-11-06',
    hours_ago: 11,
    signal_type: 'launch',
    signal_strength: 3,
    specificity_points: 2,
    signal_quote:
      'We are live on Product Hunt today with StackPulse 2.0 and shifting our focus to founder-led outbound for the next 60 days.',
    custom_draft:
      'Hey Chloe, saw your LinkedIn post on launching StackPulse 2.0 on Product Hunt and shifting into founder-led outbound for the next 60 days. When founders run outbound themselves, reviewing 10 high-intent signals at 8 AM beats managing a complex sequencer. Pond delivers scored X and LinkedIn buying signals with cited posts into one sheet. Want me to share the setup?',
  },
  {
    id: 'cand-09',
    source: 'X',
    first_name: 'Noah',
    last_name: 'Keller',
    title: 'RevOps Lead',
    company: 'VergeMetrics',
    company_size: 72,
    industry: 'RevOps',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://x.com/noahrevops',
    x_handle: '@noahrevops',
    post_url: 'https://x.com/noahrevops/status/198619920114',
    post_date: '2026-11-05',
    hours_ago: 35,
    signal_type: 'asking',
    signal_strength: 5,
    specificity_points: 1,
    signal_quote:
      'What is the cleanest way to pipe social buying signals and post-call debrief notes into the same CRM sheet without paying enterprise prices?',
    custom_draft:
      'Hey Noah, saw your X post asking how to pipe social buying signals and post-call debriefs into the same CRM sheet without enterprise seat pricing. Keeping both workflows in one shared four-tab sheet prevents leads from getting lost after the first meeting books. Pond pairs daily X and LinkedIn signal scoring with automated call debriefs. Want to see the schema?',
  },
  {
    id: 'cand-10',
    source: 'LinkedIn',
    first_name: 'Hannah',
    last_name: 'Cho',
    title: 'VP Growth',
    company: 'Arcadian Cloud',
    company_size: 110,
    industry: 'B2B SaaS',
    geo: 'US',
    is_competitor_or_recruiter: false,
    profile_url: 'https://linkedin.com/in/hannah-arcadian',
    x_handle: '@hannahcho',
    post_url: 'https://linkedin.com/posts/hannah-arcadian-33108',
    post_date: '2026-11-05',
    hours_ago: 26,
    signal_type: 'new_role',
    signal_strength: 3,
    specificity_points: 2,
    signal_quote:
      'Excited to step in as VP Growth at Arcadian Cloud this month. Priority #1: fixing the handoff between top-of-funnel intent signals and AE discovery calls.',
    custom_draft:
      'Hey Hannah, saw your LinkedIn announcement on stepping in as VP Growth at Arcadian Cloud and fixing the handoff between intent signals and AE discovery calls. Connecting the original buying-signal quote directly to the deal row keeps context intact on the first call. Pond links daily X and LinkedIn signals straight to post-call debriefs. Open to comparing workflows?',
  },
  // Extra candidates for dedupe and disqualifier testing
  {
    id: 'cand-11-recruiter',
    source: 'LinkedIn',
    first_name: 'Derek',
    last_name: 'Stone',
    title: 'Executive Agency Recruiter',
    company: 'TalentScouts Agency',
    company_size: 15,
    industry: 'Staffing',
    geo: 'US',
    is_competitor_or_recruiter: true,
    profile_url: 'https://linkedin.com/in/derek-recruiter',
    x_handle: '@derekrecruits',
    post_url: 'https://linkedin.com/posts/derek-111',
    post_date: '2026-11-06',
    hours_ago: 8,
    signal_type: 'hiring',
    signal_strength: 4,
    specificity_points: 1,
    signal_quote: 'Recruiting 5 SDRs for our external clients this month.',
  },
];

function createInitialStore(): CRMStoreData {
  const initialPipeline = runWarmSignalPipeline({
    candidates: SEED_CANDIDATES,
    existingLeads: [],
    icp: SEED_ICP,
    runDate: '2026-11-06',
  });

  const deals: DealRow[] = [
    {
      deal_id: 'DL-20261106-01',
      company: 'LatticeFlow',
      domain: 'latticeflow.io',
      primary_contact_first: 'Maya',
      lead_id: 'WS-20261106-01',
      stage: 'Demo',
      stage_changed_date: '2026-11-06',
      amount: '$6,000',
      budget_notes: '$400-$600/mo growth ops card (Maya); Marcus signs off security [11:40]',
      timeline: 'Q4 rollout before 2 new SDRs start Dec 1',
      champion_first: 'Maya',
      economic_buyer_first: 'Marcus',
      competitors: 'Gojiberry AI (dropped due to LinkedIn-only coverage)',
      next_step: 'Send custom scoring rubric and sample 4-tab sheet before Thursday',
      next_step_owner: 'us',
      next_step_date: '2026-11-10',
      last_call_date: '2026-11-06',
      calls_count: 1,
      risk_flags: 'Google Workspace security review required by Marcus',
      notes: 'Originated from Warm Signal X post WS-20261106-01',
    },
    {
      deal_id: 'DL-20261105-02',
      company: 'PeakData',
      domain: 'peakdata.dev',
      primary_contact_first: 'Jordan',
      lead_id: 'WS-20261104-02',
      stage: 'Evaluation/Pilot',
      stage_changed_date: '2026-11-05',
      amount: '$9,600',
      budget_notes: 'Annual RevOps tooling budget approved up to $10k [16:10]',
      timeline: '2-week pilot starting Nov 9',
      champion_first: 'Jordan',
      economic_buyer_first: 'Jordan',
      competitors: 'not discussed',
      next_step: 'Provision pilot workspace and review first 3 morning digests',
      next_step_owner: 'us',
      next_step_date: '2026-11-09',
      last_call_date: '2026-11-05',
      calls_count: 2,
      risk_flags: 'none',
      notes: 'Pilot success criteria: 7/10 daily relevance for 5 weekdays',
    },
    {
      deal_id: 'DL-20261104-03',
      company: 'Kova Systems',
      domain: 'kovasystems.com',
      primary_contact_first: 'Liam',
      lead_id: 'WS-20261103-04',
      stage: 'Discovery',
      stage_changed_date: '2026-11-04',
      amount: 'not discussed',
      budget_notes: 'not discussed',
      timeline: 'Evaluating Q1 outbound workflow',
      champion_first: 'Liam',
      economic_buyer_first: 'unverified',
      competitors: 'Clay + manual VA',
      next_step: 'Follow up after no-show to reschedule discovery call',
      next_step_owner: 'us',
      next_step_date: '2026-11-09',
      last_call_date: '2026-11-04',
      calls_count: 1,
      risk_flags: 'No-show on scheduled intro call; economic buyer unknown',
      notes: 'T10 edge case: no transcript existed; drafted reschedule note',
    },
  ];

  const debriefs: DebriefRow[] = [
    {
      debrief_id: 'DB-20261106-01',
      event_id: 'evt-cal-latticeflow-01',
      deal_id: 'DL-20261106-01',
      call_date: '2026-11-06',
      call_end_time: '2026-11-06T14:30:00Z',
      source: 'Granola',
      attendees_first_names: 'Maya, Lee',
      summary:
        'Maya walked through how LatticeFlow spends two hours every morning manually checking X and LinkedIn before hiring two SDRs on Dec 1. She wants a unified daily digest in Google Sheets and agreed to a live demo with Marcus on Nov 10.',
      pain_points:
        'Spending 2 hrs/morning hunting signals manually; cold sequence reply rates fell below 1% [04:12]',
      decisions: 'Agreed to evaluate Pond for dual X + LinkedIn signal scoring [15:20]',
      objections:
        'Concerned about Google Workspace OAuth permissions (resolved: partly; Marcus will review security scope) [11:40]',
      budget: '$400 to $600/mo on Maya growth ops card; Marcus controls security sign-off [11:40]',
      timeline: 'Needs workflow live before 2 new SDRs start on Dec 1 [06:05]',
      stakeholders:
        'Maya (Head of Growth, champion, present: yes); Marcus (VP Eng, skeptic, present: no)',
      decision_process: 'Maya tests daily digest quality -> Marcus signs off Workspace scope [12:15]',
      competitors: 'Gojiberry AI ($99/mo, dropped because it only covers LinkedIn) [08:45]',
      next_steps:
        '1. Us (Lee): Send custom scoring rubric and sample sheet by Thursday [18:05] | 2. Them (Maya): Loop in Marcus for 20-min live demo on Tue Nov 10 at 11am ET [21:50]',
      open_questions: 'Whether LatticeFlow wants Slack or email delivery for the 8:30 AM digest',
      risk_flags: 'Marcus was not on the call and controls security sign-off',
      stage_before: 'Discovery',
      stage_after: 'Demo',
      stage_reason: 'Pain confirmed and live technical demo scheduled for Nov 10 with Marcus',
      reminder_date: '2026-11-10',
      draft_created_at: '2026-11-06T14:33:10Z',
      minutes_to_draft: 3.2,
      followup_sent: 'no',
      confidence: 'high',
      flags: 'none',
      followup_subject: 'LatticeFlow + Pond: next steps',
      followup_body: `Hi Maya,\n\nThanks for walking through how you are spending two hours each morning hunting warm signals by hand while preparing to hire your first two SDRs.\n\n- We agreed to configure a combined LinkedIn and X buying-signal rubric tuned to B2B SaaS growth teams.\n- I will send the sample sheet and scoring rubric before Thursday.\n- You will check with Marcus on Google Workspace security sign-off ahead of our live demo on Tuesday, Nov 10 at 11:00 AM ET.\n\nDoes Tuesday at 11:00 AM ET still work on your calendar once Marcus confirms?\n\nBest,\nLee`,
      transcript: `[04:12] Maya: We spend almost two hours every morning checking LinkedIn job posts and X threads by hand, and our reply rate on generic sequences fell under 1%.\n[06:05] Maya: Our first two SDRs start December 1st and I do not want them stitched into six different tools.\n[08:45] Maya: We tried Gojiberry AI for a month at $99/mo, but it only watched LinkedIn and we could not edit the scoring logic.\n[11:40] Maya: Budget is around $400 to $600 a month from my growth ops card, though I'll check with Marcus on security sign-off before we connect Google Workspace.\n[18:05] Lee: I'll send over the custom scoring rubric and sample sheet before Thursday.\n[21:50] Maya: Perfect, let's schedule a 20-minute live demo for Tuesday Nov 10 at 11am ET with Marcus on the call.`,
    },
    {
      debrief_id: 'DB-20261105-02',
      event_id: 'evt-cal-peakdata-02',
      deal_id: 'DL-20261105-02',
      call_date: '2026-11-05',
      call_end_time: '2026-11-05T16:30:00Z',
      source: 'Google Doc',
      attendees_first_names: 'Jordan, Lee',
      summary:
        'Jordan reviewed the live demo of Pond Signal Desk and confirmed an annual RevOps budget of up to $10k. We agreed to launch a two-week pilot starting Monday Nov 9.',
      pain_points: 'SDRs were contacting leads already in active deals because X and LinkedIn were not deduplicated [05:18]',
      decisions: 'Approved 2-week pilot starting Nov 9 with 10 daily signals [19:40]',
      objections: 'None raised on call [00:00]',
      budget: '$9,600/yr out of approved $10k RevOps tooling budget (Jordan controls it) [16:10]',
      timeline: 'Pilot starts Nov 9; full annual conversion by Nov 23 [19:40]',
      stakeholders: 'Jordan (VP Sales, champion & economic buyer, present: yes)',
      decision_process: 'If 7 of 10 daily leads are relevant across 10 weekdays, Jordan signs annual order [20:15]',
      competitors: 'not discussed',
      next_steps:
        '1. Us (Lee): Send pilot onboarding link by Friday [22:10] | 2. Them (Jordan): Share exclusion list CSV before Monday [23:05]',
      open_questions: 'not discussed',
      risk_flags: 'none',
      stage_before: 'Demo',
      stage_after: 'Evaluation/Pilot',
      stage_reason: '2-week pilot scope and success criteria agreed on call',
      reminder_date: '2026-11-09',
      draft_created_at: '2026-11-05T16:32:45Z',
      minutes_to_draft: 2.8,
      followup_sent: 'approved',
      confidence: 'high',
      flags: 'none',
      followup_subject: 'PeakData + Pond: next steps',
      followup_body: `Hi Jordan,\n\nThanks for reviewing the live signal deduplication demo today and sharing how duplicate outreach across X and LinkedIn was slowing down your reps.\n\n- We agreed to run a two-week pilot starting Monday, Nov 9 with a target of at least 7 relevant leads out of 10 each weekday morning.\n- I will send your pilot workspace link before Friday.\n- You will share your current exclusion list CSV before Monday morning.\n\nCan you send over that exclusion CSV once you have it exported?\n\nBest,\nLee`,
      transcript: `[05:18] Jordan: Our biggest headache is that an SDR messages a founder on X while another rep is already talking to them on LinkedIn.\n[16:10] Jordan: We have $10k set aside in my RevOps tooling budget for the year, so $800 a month works if the signal quality holds up.\n[19:40] Jordan: Let's run a two-week pilot starting Monday November 9.\n[22:10] Lee: Sounds good, I'll send the pilot onboarding link by Friday.\n[23:05] Jordan: And I'll send over our exclusion list CSV before Monday.`,
    },
    {
      debrief_id: 'DB-20261104-03',
      event_id: 'evt-cal-kova-03',
      deal_id: 'DL-20261104-03',
      call_date: '2026-11-04',
      call_end_time: '2026-11-04T15:00:00Z',
      source: 'Pasted',
      attendees_first_names: 'Liam, Lee',
      summary:
        'Scheduled discovery call with Liam at Kova Systems ended with no transcript found (prospect no-show). Logged low-confidence check-in and drafted a short reschedule email.',
      pain_points: 'not discussed',
      decisions: 'not discussed',
      objections: 'not discussed',
      budget: 'not discussed',
      timeline: 'not discussed',
      stakeholders: 'Liam (Founder, unknown, present: no)',
      decision_process: 'not discussed',
      competitors: 'not discussed',
      next_steps: '1. Us (Lee): Follow up to reschedule discovery call (+3 business days reminder)',
      open_questions: 'not discussed',
      risk_flags: 'No transcript found; prospect no-show',
      stage_before: 'Discovery',
      stage_after: 'Discovery',
      stage_reason: 'No-show; stage unchanged pending reschedule',
      reminder_date: '2026-11-09',
      draft_created_at: '2026-11-04T15:04:00Z',
      minutes_to_draft: 4.0,
      followup_sent: 'no',
      confidence: 'low',
      flags: 'no_transcript_found, no_show_reschedule',
      followup_subject: 'Kova Systems + Pond: next steps',
      followup_body: `Hi Liam,\n\nSorry we missed each other on our scheduled intro call earlier today. I know founder schedules move fast.\n\n- I held our notes on how Kova Systems is evaluating outbound signal workflows for Q1.\n- I will follow up next week if now is a busy stretch.\n\nWould Tuesday or Wednesday next week work to reschedule for 15 minutes?\n\nBest,\nLee`,
      transcript: `NO_TRANSCRIPT_FOUND: Calendar event ended at 15:00 UTC with 0 minutes recorded. Triggered T10 no-show fallback.`,
    },
  ];

  const runs: RunRow[] = [
    initialPipeline.runRow,
    {
      run_date: '2026-11-05',
      started: '2026-11-05T07:00:00Z',
      finished: '2026-11-05T07:21:14Z',
      x_candidates: 24,
      li_candidates: 19,
      after_dedupe: 32,
      shortlisted: 10,
      drafted: 10,
      li_opens: 19,
      failures: 'none',
      notes: '8 approved, 1 edited, 1 skipped; 3 replies logged (+33% reply rate vs 1.8% cold baseline)',
    },
    {
      run_date: '2026-11-04',
      started: '2026-11-04T07:00:00Z',
      finished: '2026-11-04T07:17:08Z',
      x_candidates: 21,
      li_candidates: 16,
      after_dedupe: 29,
      shortlisted: 9,
      drafted: 9,
      li_opens: 16,
      failures: 'none',
      notes: 'T7 natural shortlist: 9 candidates scored >= 6.0; did not pad #10',
    },
  ];

  return {
    icp: SEED_ICP,
    voice: SEED_VOICE,
    candidates: SEED_CANDIDATES,
    leads: initialPipeline.shortlistedLeads,
    runs,
    deals,
    debriefs,
  };
}

export function readStore(): CRMStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const seed = createInitialStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as CRMStoreData;
  } catch {
    return createInitialStore();
  }
}

export function writeStore(data: CRMStoreData): CRMStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}
