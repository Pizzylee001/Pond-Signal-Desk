export type SignalType = 'hiring' | 'pain' | 'asking' | 'launch' | 'new_role';

export type LeadStatus =
  | 'scored'
  | 'drafted'
  | 'approved'
  | 'edited'
  | 'sent'
  | 'replied'
  | 'meeting'
  | 'skipped'
  | 'do_not_contact';

export interface CandidateInput {
  id: string;
  source: 'LinkedIn' | 'X';
  first_name: string;
  last_name?: string;
  title: string;
  company: string;
  company_size: number;
  industry: string;
  geo: string;
  is_competitor_or_recruiter: boolean;
  profile_url: string;
  x_handle: string;
  post_url: string;
  post_date: string;
  hours_ago: number;
  signal_type: SignalType;
  signal_strength: number; // 1 to 5
  specificity_points: number; // 0 to 2
  signal_quote: string;
  custom_draft?: string;
}

export interface LeadRow {
  lead_id: string;
  found_date: string;
  source: 'LinkedIn' | 'X';
  first_name: string;
  title: string;
  company: string;
  profile_url: string;
  x_handle: string;
  post_url: string;
  post_date: string;
  signal_type: SignalType;
  signal_quote: string;
  fit_score: number;
  intent_score: number;
  total_score: number;
  score_reason: string;
  draft_message: string;
  draft_chars: number;
  status: LeadStatus;
  approved_by: string;
  sent_date: string;
  reply_date: string;
  outcome: '' | 'positive' | 'neutral' | 'negative' | 'no_reply';
  notes: string;
}

export interface RunRow {
  run_date: string;
  started: string;
  finished: string;
  x_candidates: number;
  li_candidates: number;
  after_dedupe: number;
  shortlisted: number;
  drafted: number;
  li_opens: number;
  failures: string;
  notes: string;
}

export interface ICPMemory {
  companySizeMin: number;
  companySizeMax: number;
  targetIndustries: string[];
  targetGeos: string[];
  buyerTitles: string[];
  adjacentTitles: string[];
  exclusionDomainsOrNames: string[];
  approvedProofPoints: string[];
}

export function scoreCandidate(candidate: CandidateInput, icp: ICPMemory): {
  fit_score: number;
  intent_score: number;
  total_score: number;
  score_reason: string;
} {
  if (candidate.is_competitor_or_recruiter) {
    return {
      fit_score: 0,
      intent_score: 0,
      total_score: 0,
      score_reason: 'Disqualified: competitor, agency, or recruiter (Fit = 0)',
    };
  }

  const titleLower = candidate.title.toLowerCase();
  let titlePts = 0;
  if (icp.buyerTitles.some(t => titleLower.includes(t.toLowerCase()))) {
    titlePts = 4;
  } else if (icp.adjacentTitles.some(t => titleLower.includes(t.toLowerCase()))) {
    titlePts = 2;
  }

  let sizePts = 0;
  if (candidate.company_size >= icp.companySizeMin && candidate.company_size <= icp.companySizeMax) {
    sizePts = 3;
  } else if (
    candidate.company_size >= Math.floor(icp.companySizeMin * 0.5) &&
    candidate.company_size <= Math.ceil(icp.companySizeMax * 1.5)
  ) {
    sizePts = 1;
  }

  let indGeoPts = 0;
  if (icp.targetIndustries.some(i => candidate.industry.toLowerCase().includes(i.toLowerCase()))) {
    indGeoPts += 1;
  }
  if (icp.targetGeos.some(g => candidate.geo.toLowerCase().includes(g.toLowerCase()))) {
    indGeoPts += 1;
  }

  const notCompetitorPts = 1;
  const fit_score = Math.min(10, titlePts + sizePts + indGeoPts + notCompetitorPts);

  const strengthPts = Math.max(0, Math.min(5, candidate.signal_strength));
  let recencyPts = 0;
  if (candidate.hours_ago <= 24) {
    recencyPts = 3;
  } else if (candidate.hours_ago <= 48) {
    recencyPts = 2;
  } else if (candidate.hours_ago <= 72) {
    recencyPts = 1;
  }

  const specPts = Math.max(0, Math.min(2, candidate.specificity_points));
  const intent_score = Math.min(10, strengthPts + recencyPts + specPts);
  const total_score = Math.round((0.5 * fit_score + 0.5 * intent_score) * 10) / 10;

  return {
    fit_score,
    intent_score,
    total_score,
    score_reason: `Fit ${fit_score} (Title ${titlePts}, Size ${sizePts}, Ind/Geo ${indGeoPts}, Safe ${notCompetitorPts}) · Intent ${intent_score} (Signal ${strengthPts}, Recency ${recencyPts}, Specificity ${specPts})`,
  };
}

export function dedupeAndFilterCandidates(
  candidates: CandidateInput[],
  existingLeads: LeadRow[],
  icp: ICPMemory,
  runDate: string
): {
  survivingCandidates: CandidateInput[];
  updatedExistingLeads: LeadRow[];
  skippedCount: number;
} {
  const updatedExistingLeads = existingLeads.map(l => ({ ...l }));
  const seenProfileUrls = new Set<string>();
  const seenHandles = new Set<string>();
  const seenNameCompany = new Set<string>();

  const exclusions = new Set(icp.exclusionDomainsOrNames.map(e => e.toLowerCase().trim()));

  for (const lead of updatedExistingLeads) {
    if (lead.profile_url) seenProfileUrls.add(lead.profile_url.toLowerCase().trim());
    if (lead.x_handle) seenHandles.add(lead.x_handle.toLowerCase().trim());
    seenNameCompany.add(`${lead.first_name.toLowerCase().trim()}|${lead.company.toLowerCase().trim()}`);
  }

  const survivingCandidates: CandidateInput[] = [];
  let skippedCount = 0;

  for (const cand of candidates) {
    const pUrl = cand.profile_url.toLowerCase().trim();
    const xH = cand.x_handle.toLowerCase().trim();
    const nameCo = `${cand.first_name.toLowerCase().trim()}|${cand.company.toLowerCase().trim()}`;

    if (
      exclusions.has(nameCo) ||
      exclusions.has(cand.company.toLowerCase().trim()) ||
      (pUrl && exclusions.has(pUrl))
    ) {
      skippedCount++;
      continue;
    }

    // Check if matches an existing lead
    const existingMatch = updatedExistingLeads.find(
      l =>
        (pUrl && l.profile_url.toLowerCase().trim() === pUrl) ||
        (xH && l.x_handle.toLowerCase().trim() === xH) ||
        `${l.first_name.toLowerCase().trim()}|${l.company.toLowerCase().trim()}` === nameCo
    );

    if (existingMatch) {
      // Spec section 1.8 & T11: If existing row has status replied or meeting, append note and do not draft
      if (existingMatch.status === 'replied' || existingMatch.status === 'meeting') {
        const noteEntry = `New signal ${runDate}: ${cand.post_url}`;
        existingMatch.notes = existingMatch.notes
          ? `${existingMatch.notes}; ${noteEntry}`
          : noteEntry;
      }
      skippedCount++;
      continue;
    }

    // Also dedupe within the same batch
    if (
      (pUrl && seenProfileUrls.has(pUrl)) ||
      (xH && seenHandles.has(xH)) ||
      seenNameCompany.has(nameCo)
    ) {
      skippedCount++;
      continue;
    }

    if (pUrl) seenProfileUrls.add(pUrl);
    if (xH) seenHandles.add(xH);
    seenNameCompany.add(nameCo);
    survivingCandidates.push(cand);
  }

  return {
    survivingCandidates,
    updatedExistingLeads,
    skippedCount,
  };
}

const BANNED_PHRASES = [
  'i came across your profile',
  'loved your post',
  'great post',
  'quick call',
  '15-min call',
  '15 min call',
  'pick your brain',
  'synergy',
  'game-changer',
  'just checking in',
  'hi there',
  'dear ',
];

export function validateOpenerDraft(
  draft: string,
  context: { first_name: string; last_name?: string; post_url: string }
): {
  valid: boolean;
  charCount: number;
  flags: string[];
} {
  const charCount = draft.length;
  const flags: string[] = [];

  if (charCount < 300 || charCount > 400) {
    flags.push('length');
  }

  if (draft.includes('\u2014') || draft.includes('--')) {
    flags.push('em_dash');
  }

  if (/https?:\/\/|calendly\.com|cal\.com/i.test(draft)) {
    flags.push('contains_link');
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const hasLastName =
    context.last_name &&
    context.last_name.trim().length > 1 &&
    new RegExp(`\\b${context.last_name.trim()}\\b`, 'i').test(draft);

  if (emailRegex.test(draft) || phoneRegex.test(draft) || hasLastName) {
    flags.push('last_name_or_pii');
  }

  const lower = draft.toLowerCase();
  if (BANNED_PHRASES.some(bp => lower.includes(bp))) {
    flags.push('banned_phrase');
  }

  if (!context.post_url || !context.post_url.startsWith('http')) {
    flags.push('unverified_source');
  }

  return {
    valid: flags.length === 0,
    charCount,
    flags,
  };
}

export function buildDeterministicOpener(candidate: CandidateInput): string {
  if (candidate.custom_draft) {
    return candidate.custom_draft;
  }

  const channel = candidate.source === 'X' ? 'X' : 'LinkedIn';
  const snippet = candidate.signal_quote
    .replace(/["“”]/g, '')
    .replace(/\u2014/g, ',')
    .slice(0, 72)
    .trim();

  let base = `Hey ${candidate.first_name}, saw your ${channel} post on "${snippet}". Teams we work with usually find that acting on 48-hour buying signals beats scaling cold sequences. At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to send the scoring rubric we use?`;

  if (base.length < 305) {
    base = `Hey ${candidate.first_name}, saw your ${channel} post on "${snippet}". Most lean GTM teams we talk to find that catching 48-hour buying signals cuts outbound ramp time in half. At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to send the scoring rubric we use?`;
  }
  if (base.length > 398) {
    base = base.slice(0, 365).replace(/\s+\S*$/, '') + '. Want to see the rubric?';
  }
  return base;
}

export function parseAndApplyBatchCommand(
  commandText: string,
  leads: LeadRow[],
  actor = 'Lee'
): LeadRow[] {
  const updated = leads.map(l => ({ ...l }));
  const segments = commandText
    .split(/[·;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const approveMatch = seg.match(/^approve\s+([\d,\s]+)$/i);
    if (approveMatch) {
      const indices = approveMatch[1]
        .split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < updated.length);
      for (const idx of indices) {
        updated[idx].status = 'approved';
        updated[idx].approved_by = actor;
      }
      continue;
    }

    const skipMatch = seg.match(/^skip\s+([\d,\s]+)$/i);
    if (skipMatch) {
      const indices = skipMatch[1]
        .split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < updated.length);
      for (const idx of indices) {
        updated[idx].status = 'skipped';
      }
      continue;
    }

    const dncMatch = seg.match(/^do_not_contact\s+([\d,\s]+)$/i);
    if (dncMatch) {
      const indices = dncMatch[1]
        .split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < updated.length);
      for (const idx of indices) {
        updated[idx].status = 'do_not_contact';
      }
      continue;
    }

    const editMatch = seg.match(/^edit\s+(\d+)\s*:\s*(.+)$/i);
    if (editMatch) {
      const idx = parseInt(editMatch[1], 10) - 1;
      const newDraft = editMatch[2].trim();
      if (idx >= 0 && idx < updated.length && newDraft) {
        updated[idx].draft_message = newDraft;
        updated[idx].draft_chars = newDraft.length;
        updated[idx].status = 'edited';
        updated[idx].approved_by = actor;
        const check = validateOpenerDraft(newDraft, {
          first_name: updated[idx].first_name,
          post_url: updated[idx].post_url,
        });
        if (!check.valid) {
          updated[idx].notes = `Flags: ${check.flags.join(', ')}`;
        }
      }
    }
  }

  return updated;
}

export function runWarmSignalPipeline(params: {
  candidates: CandidateInput[];
  existingLeads: LeadRow[];
  icp: ICPMemory;
  runDate: string;
  simulateLinkedInWall?: boolean;
  simulateXFailure?: boolean;
}): {
  shortlistedLeads: LeadRow[];
  updatedExistingLeads: LeadRow[];
  runRow: RunRow;
} {
  const {
    candidates,
    existingLeads,
    icp,
    runDate,
    simulateLinkedInWall = false,
    simulateXFailure = false,
  } = params;

  const failures: string[] = [];
  if (simulateLinkedInWall) {
    failures.push('li_auth_needed');
  }
  if (simulateXFailure) {
    failures.push('x_connector_timeout');
  }

  const xRaw = candidates.filter(c => c.source === 'X');
  const liRaw = candidates.filter(c => c.source === 'LinkedIn');

  const availableCandidates = candidates.filter(c => {
    if (simulateLinkedInWall && c.source === 'LinkedIn') return false;
    if (simulateXFailure && c.source === 'X') return false;
    return true;
  });

  const { survivingCandidates, updatedExistingLeads } = dedupeAndFilterCandidates(
    availableCandidates,
    existingLeads,
    icp,
    runDate
  );

  // Score and filter >= 6.0 (never pad if fewer than 10)
  const scoredList = survivingCandidates
    .map(cand => ({
      cand,
      score: scoreCandidate(cand, icp),
    }))
    .filter(item => item.score.total_score >= 6.0)
    .sort((a, b) => b.score.total_score - a.score.total_score)
    .slice(0, 10);

  const dateCompact = runDate.replace(/-/g, '');
  const shortlistedLeads: LeadRow[] = scoredList.map(({ cand, score }, idx) => {
    const draft = buildDeterministicOpener(cand);
    const validation = validateOpenerDraft(draft, {
      first_name: cand.first_name,
      last_name: cand.last_name,
      post_url: cand.post_url,
    });

    return {
      lead_id: `WS-${dateCompact}-${String(idx + 1).padStart(2, '0')}`,
      found_date: runDate,
      source: cand.source,
      first_name: cand.first_name,
      title: cand.title,
      company: cand.company,
      profile_url: cand.profile_url,
      x_handle: cand.x_handle,
      post_url: cand.post_url,
      post_date: cand.post_date,
      signal_type: cand.signal_type,
      signal_quote: cand.signal_quote.slice(0, 200),
      fit_score: score.fit_score,
      intent_score: score.intent_score,
      total_score: score.total_score,
      score_reason: score.score_reason,
      draft_message: draft,
      draft_chars: validation.charCount,
      status: 'drafted',
      approved_by: '',
      sent_date: '',
      reply_date: '',
      outcome: '',
      notes: validation.flags.length > 0 ? validation.flags.join(', ') : '',
    };
  });

  const liOpens = simulateLinkedInWall
    ? Math.min(6, liRaw.length)
    : Math.min(40, liRaw.length);

  const runRow: RunRow = {
    run_date: runDate,
    started: `${runDate}T07:00:00Z`,
    finished: `${runDate}T07:18:42Z`,
    x_candidates: simulateXFailure ? 0 : xRaw.length,
    li_candidates: simulateLinkedInWall ? 0 : liRaw.length,
    after_dedupe: survivingCandidates.length,
    shortlisted: shortlistedLeads.length,
    drafted: shortlistedLeads.length,
    li_opens: liOpens,
    failures: failures.join(', ') || 'none',
    notes: simulateLinkedInWall
      ? 'Halted LinkedIn browser session at checkpoint wall; delivered X-only digest'
      : 'Completed on schedule before 08:30 AM local',
  };

  return {
    shortlistedLeads,
    updatedExistingLeads,
    runRow,
  };
}
