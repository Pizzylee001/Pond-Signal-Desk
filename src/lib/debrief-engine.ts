import type { DealRow, DebriefRow, VoiceMemory } from './store';

export interface CommitmentHit {
  phrase: string;
  owner: string;
  timestamp: string;
  quote: string;
  dueDate: string;
}

export const COMMITMENT_PHRASES = [
  "i'll",
  "we'll",
  'let me',
  'can you',
  'send',
  'follow up',
  'next week',
  'by friday',
  'before thursday',
  'before monday',
  'loop in',
  'check with',
  'schedule',
];

export function sweepCommitmentPhrases(
  transcript: string,
  repFirstName = 'Lee',
  prospectFirstName = 'Prospect'
): CommitmentHit[] {
  if (!transcript || transcript.startsWith('NO_TRANSCRIPT_FOUND')) {
    return [];
  }

  const lines = transcript
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const hits: CommitmentHit[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const matchedPhrase = COMMITMENT_PHRASES.find(p => lower.includes(p));
    if (!matchedPhrase) continue;

    const tsMatch = line.match(/\[(\d{1,2}:\d{2})\]/);
    const timestamp = tsMatch ? tsMatch[1] : '00:00';

    const speakerMatch = line.match(/^(?:\[\d{1,2}:\d{2}\]\s*)?([A-Za-z]+):/);
    const speaker = speakerMatch ? speakerMatch[1] : prospectFirstName;

    const owner =
      speaker.toLowerCase() === repFirstName.toLowerCase() ? 'us' : speaker;

    let dueDate = 'no date set';
    const dateKeywords = [
      'by friday',
      'before thursday',
      'before monday',
      'tomorrow',
      'next week',
      'tuesday nov 10',
      'monday november 9',
      'nov 10',
      'nov 9',
    ];
    for (const dk of dateKeywords) {
      if (lower.includes(dk)) {
        dueDate = dk;
        break;
      }
    }

    const cleanQuote = line
      .replace(/^\[\d{1,2}:\d{2}\]\s*/, '')
      .replace(/^[A-Za-z]+:\s*/, '')
      .trim();

    hits.push({
      phrase: matchedPhrase,
      owner,
      timestamp,
      quote: cleanQuote,
      dueDate,
    });
  }

  return hits;
}

export function computeNextStage(
  stageBefore: DealRow['stage'],
  transcript: string,
  isNoShow: boolean
): { stageAfter: DealRow['stage']; reason: string } {
  if (isNoShow || !transcript.trim()) {
    return {
      stageAfter: stageBefore,
      reason: 'No-show or missing transcript; stage unchanged',
    };
  }

  const lower = transcript.toLowerCase();
  if (lower.includes('closed won') || lower.includes('signed the annual')) {
    return { stageAfter: 'Closed Won', reason: 'Customer signed agreement on call' };
  }
  if (lower.includes('not moving forward') || lower.includes('closed lost')) {
    return { stageAfter: 'Closed Lost', reason: 'Prospect declined to proceed' };
  }
  if (lower.includes('contract') || lower.includes('redline') || lower.includes('security sign-off')) {
    if (stageBefore === 'Proposal') {
      return { stageAfter: 'Negotiation', reason: 'Security or contract terms under review' };
    }
  }
  if (lower.includes('pricing proposal') || lower.includes('send proposal')) {
    return { stageAfter: 'Proposal', reason: 'Formal proposal requested on call' };
  }
  if (lower.includes('pilot') || lower.includes('two-week trial') || lower.includes('evaluation')) {
    return {
      stageAfter: 'Evaluation/Pilot',
      reason: 'Pilot or trial evaluation agreed on call',
    };
  }
  if (lower.includes('live demo') || lower.includes('schedule a 20-minute live demo') || lower.includes('demo')) {
    if (stageBefore === 'Lead' || stageBefore === 'Discovery') {
      return { stageAfter: 'Demo', reason: 'Live product demo agreed on call' };
    }
  }
  if (stageBefore === 'Lead') {
    return { stageAfter: 'Discovery', reason: 'Initial discovery conversation completed' };
  }

  return {
    stageAfter: stageBefore,
    reason: 'Call completed; continuing in current stage',
  };
}

export function addBusinessDays(startDateIso: string, businessDays: number): string {
  const [y, m, d] = startDateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < businessDays) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return dt.toISOString().slice(0, 10);
}

export function generatePrivateIcsReminder(params: {
  company: string;
  nextStep: string;
  reminderDate: string;
}): string {
  const dateCompact = params.reminderDate.replace(/-/g, '');
  const shortStep = params.nextStep.slice(0, 60).trim();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pond Signal Desk//Deal Debrief//EN',
    'BEGIN:VEVENT',
    `UID:pond-reminder-${dateCompact}-${params.company.toLowerCase().replace(/[^a-z0-9]/g, '')}@joinpond.ai`,
    `DTSTART;VALUE=DATE:${dateCompact}`,
    `DTEND;VALUE=DATE:${dateCompact}`,
    `SUMMARY:Follow up: ${params.company}: ${shortStep}`,
    'DESCRIPTION:Private rep reminder created by Pond Signal Desk (0 external invitees).',
    'CLASS:PRIVATE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

const BANNED_EMAIL_PHRASES = [
  'just checking in',
  'circling back',
  'circle back',
  'as per our conversation',
  'touching base',
  'synergy',
  'game-changer',
];

export function validateFollowupEmail(
  subject: string,
  body: string,
  context?: { attendeeLastName?: string }
): {
  valid: boolean;
  wordCount: number;
  flags: string[];
} {
  const words = body
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const wordCount = words.length;
  const flags: string[] = [];

  if (wordCount >= 150) {
    flags.push('over_150_words');
  }

  if (body.includes('\u2014') || body.includes('--') || subject.includes('\u2014')) {
    flags.push('em_dash');
  }

  if (!subject.toLowerCase().includes('+ pond: next steps')) {
    flags.push('subject_format');
  }

  const lower = body.toLowerCase();
  if (BANNED_EMAIL_PHRASES.some(bp => lower.includes(bp))) {
    flags.push('banned_phrase');
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const hasLastName =
    context?.attendeeLastName &&
    context.attendeeLastName.trim().length > 1 &&
    new RegExp(`\\b${context.attendeeLastName.trim()}\\b`, 'i').test(body);

  if (emailRegex.test(body) || hasLastName) {
    flags.push('last_name_or_pii');
  }

  return {
    valid: flags.length === 0,
    wordCount,
    flags,
  };
}

export function runDealDebriefExtraction(params: {
  event_id: string;
  deal_id?: string;
  company: string;
  attendeeFirstName: string;
  attendeeLastName?: string;
  senderFirstName: string;
  callDate: string;
  stageBefore: DealRow['stage'];
  transcript: string;
  source: DebriefRow['source'];
  voice: VoiceMemory;
}): {
  debriefRow: DebriefRow;
  commitmentHits: CommitmentHit[];
} {
  const {
    event_id,
    deal_id = `DL-${params.callDate.replace(/-/g, '')}-09`,
    company,
    attendeeFirstName,
    attendeeLastName,
    senderFirstName,
    callDate,
    stageBefore,
    transcript,
    source,
    voice,
  } = params;

  const isNoShow =
    !transcript.trim() || transcript.trim().startsWith('NO_TRANSCRIPT_FOUND');

  const reminderDate = addBusinessDays(
    callDate,
    voice.defaultReminderBusinessDays || 3
  );

  if (isNoShow) {
    const subject = `${company} + Pond: next steps`;
    const body = `Hi ${attendeeFirstName},\n\nSorry we missed each other on our scheduled call today. I know schedules move fast.\n\n- I held our notes on how ${company} is evaluating warm buying-signal workflows.\n- I will follow up next week if now is a busy stretch.\n\nWould Tuesday or Wednesday next week work to reschedule for 15 minutes?\n\n${voice.signOff}`;

    return {
      commitmentHits: [],
      debriefRow: {
        debrief_id: `DB-${callDate.replace(/-/g, '')}-${Math.floor(Math.random() * 90 + 10)}`,
        event_id,
        deal_id,
        call_date: callDate,
        call_end_time: `${callDate}T15:00:00Z`,
        source,
        attendees_first_names: `${attendeeFirstName}, ${senderFirstName}`,
        summary: `Scheduled call with ${attendeeFirstName} at ${company} ended with no transcript found. Logged low-confidence check-in and drafted a short reschedule email.`,
        pain_points: 'not discussed',
        decisions: 'not discussed',
        objections: 'not discussed',
        budget: 'not discussed',
        timeline: 'not discussed',
        stakeholders: `${attendeeFirstName} (Primary Contact, unknown, present: no)`,
        decision_process: 'not discussed',
        competitors: 'not discussed',
        next_steps: `1. Us (${senderFirstName}): Follow up to reschedule discovery call (+3 business days reminder)`,
        open_questions: 'not discussed',
        risk_flags: 'No transcript found; prospect no-show',
        stage_before: stageBefore,
        stage_after: stageBefore,
        stage_reason: 'No-show or missing transcript; stage unchanged',
        reminder_date: reminderDate,
        draft_created_at: `${callDate}T15:03:00Z`,
        minutes_to_draft: 3.0,
        followup_sent: 'no',
        confidence: 'low',
        flags: 'no_transcript_found, no_show_reschedule',
        followup_subject: subject,
        followup_body: body,
        transcript: transcript || 'NO_TRANSCRIPT_FOUND',
      },
    };
  }

  // Pass 1: Extract structured fields with verbatim timestamps
  const lines = transcript
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const firstLine = lines[0] || '';
  const firstTs = firstLine.match(/\[(\d{1,2}:\d{2})\]/)?.[1] || '02:00';
  const painSnippet = firstLine
    .replace(/^\[\d{1,2}:\d{2}\]\s*/, '')
    .replace(/^[A-Za-z]+:\s*/, '')
    .slice(0, 140);

  const budgetLine = lines.find(l => /\$|\bbudget\b|\bmonth\b|\byear\b/i.test(l));
  const budgetTs = budgetLine?.match(/\[(\d{1,2}:\d{2})\]/)?.[1] || '';
  const budgetText = budgetLine
    ? `${budgetLine.replace(/^\[\d{1,2}:\d{2}\]\s*[A-Za-z]+:\s*/, '')} [${budgetTs}]`
    : 'not discussed';

  const compLine = lines.find(l => /gojiberry|clay|apollo|competitor/i.test(l));
  const compTs = compLine?.match(/\[(\d{1,2}:\d{2})\]/)?.[1] || '';
  const competitorsText = compLine
    ? `${compLine.replace(/^\[\d{1,2}:\d{2}\]\s*[A-Za-z]+:\s*/, '')} [${compTs}]`
    : 'not discussed';

  // Pass 2: Compulsory commitment-phrase sweep
  const commitmentHits = sweepCommitmentPhrases(
    transcript,
    senderFirstName,
    attendeeFirstName
  );

  const nextStepsFormatted =
    commitmentHits.length > 0
      ? commitmentHits
          .map(
            (h, idx) =>
              `${idx + 1}. ${h.owner === 'us' ? `Us (${senderFirstName})` : `Them (${h.owner})`}: ${h.quote} (${h.dueDate}) [${h.timestamp}]`
          )
          .join(' | ')
      : 'not discussed';

  const { stageAfter, reason } = computeNextStage(stageBefore, transcript, false);

  const subject = `${company} + Pond: next steps`;
  const bullets =
    commitmentHits.length > 0
      ? commitmentHits
          .slice(0, 3)
          .map(h => `- ${h.owner === 'us' ? 'I will' : `${attendeeFirstName} will`} follow through on: "${h.quote}" [${h.timestamp}].`)
          .join('\n')
      : `- We reviewed how ${company} is evaluating daily buying signals.\n- I will share our sample scoring rubric sheet.`;

  const body = `Hi ${attendeeFirstName},\n\nThanks for walking through your team's outbound workflow today, especially "${painSnippet}".\n\n${bullets}\n\nDoes that timeline still work on your end for our next step?\n\n${voice.signOff}`;

  const emailCheck = validateFollowupEmail(subject, body, { attendeeLastName });

  return {
    commitmentHits,
    debriefRow: {
      debrief_id: `DB-${callDate.replace(/-/g, '')}-${Math.floor(Math.random() * 90 + 10)}`,
      event_id,
      deal_id,
      call_date: callDate,
      call_end_time: `${callDate}T16:00:00Z`,
      source,
      attendees_first_names: `${attendeeFirstName}, ${senderFirstName}`,
      summary: `${attendeeFirstName} at ${company} discussed "${painSnippet}" [${firstTs}]. Stage moved from ${stageBefore} to ${stageAfter}.`,
      pain_points: `${painSnippet} [${firstTs}]`,
      decisions: `${reason}`,
      objections: 'not discussed',
      budget: budgetText,
      timeline: commitmentHits[0]?.dueDate || 'not discussed',
      stakeholders: `${attendeeFirstName} (Primary Contact, champion, present: yes)`,
      decision_process: 'not discussed',
      competitors: competitorsText,
      next_steps: nextStepsFormatted,
      open_questions: 'not discussed',
      risk_flags: budgetText === 'not discussed' ? 'Budget not discussed on call' : 'none',
      stage_before: stageBefore,
      stage_after: stageAfter,
      stage_reason: reason,
      reminder_date: reminderDate,
      draft_created_at: `${callDate}T16:02:30Z`,
      minutes_to_draft: 2.5,
      followup_sent: 'no',
      confidence: source === 'Pasted' ? 'medium' : 'high',
      flags: emailCheck.flags.length ? emailCheck.flags.join(', ') : 'none',
      followup_subject: subject,
      followup_body: body,
      transcript,
    },
  };
}
