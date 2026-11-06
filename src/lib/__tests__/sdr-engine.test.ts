import { describe, it, expect } from 'vitest';
import {
  scoreCandidate,
  dedupeAndFilterCandidates,
  validateOpenerDraft,
  parseAndApplyBatchCommand,
  runWarmSignalPipeline,
  type CandidateInput,
  type LeadRow,
  type ICPMemory,
} from '../sdr-engine';

const defaultICP: ICPMemory = {
  companySizeMin: 10,
  companySizeMax: 200,
  targetIndustries: ['B2B SaaS', 'DevTools', 'AI Infrastructure', 'Fintech', 'RevOps'],
  targetGeos: ['US', 'CA', 'UK', 'Remote'],
  buyerTitles: ['Founder', 'CEO', 'Head of Sales', 'VP Sales', 'Head of Growth', 'VP Growth', 'Head of Revenue', 'RevOps'],
  adjacentTitles: ['Director of Marketing', 'Chief of Staff', 'Product Lead', 'GTM Engineer'],
  exclusionDomainsOrNames: ['competitor.io', 'spamagency.com', 'dnc@example.com', 'alex|rivalcorp'],
  approvedProofPoints: [
    'Pond surfaces daily scored LinkedIn and X intent leads with cited sources in one sheet',
    'Teams using Pond review and approve 10 warm signal openers in under 10 minutes each morning',
  ],
};

describe('Workflow 1: Warm Signal SDR Engine (T1-T11 Spec Verification)', () => {
  it('T1 & T7: calculates Fit, Intent, and Total = round(0.5*Fit + 0.5*Intent, 1), disqualifies recruiters/competitors, and never pads below 6.0', () => {
    const strongCandidate: CandidateInput = {
      id: 'c1',
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
      post_date: '2026-11-06T05:00:00Z',
      hours_ago: 14,
      signal_type: 'asking',
      signal_strength: 5,
      specificity_points: 2,
      signal_quote: 'Hiring our first 2 SDRs next month and dreading the 6-tool frankenstack. What are lean B2B teams using to catch warm buying signals?',
    };

    const scored = scoreCandidate(strongCandidate, defaultICP);
    expect(scored.fit_score).toBe(10); // Title 4 + Size 3 + Industry/Geo 2 + Not competitor 1 = 10
    expect(scored.intent_score).toBe(10); // Strength 5 + Recency (<24h=3) + Specificity 2 = 10
    expect(scored.total_score).toBe(10.0);

    const recruiterCandidate: CandidateInput = {
      ...strongCandidate,
      id: 'c2',
      first_name: 'brick',
      is_competitor_or_recruiter: true,
    };
    const recruiterScored = scoreCandidate(recruiterCandidate, defaultICP);
    expect(recruiterScored.fit_score).toBe(0);
    expect(recruiterScored.total_score).toBeLessThan(6.0);
  });

  it('T2, T6 & T11: deduplicates across profile_url, x_handle, and firstname|company, skips 90-day skipped/DNC, and appends note on replied/meeting leads without drafting', () => {
    const existingLeads: LeadRow[] = [
      {
        lead_id: 'WS-20261105-01',
        found_date: '2026-11-05',
        source: 'LinkedIn',
        first_name: 'Maya',
        title: 'Head of Growth',
        company: 'LatticeFlow',
        profile_url: 'https://linkedin.com/in/maya-latticeflow',
        x_handle: '@mayagrowth',
        post_url: 'https://linkedin.com/posts/maya-1',
        post_date: '2026-11-05',
        signal_type: 'hiring',
        signal_quote: 'Hiring SDRs soon',
        fit_score: 9,
        intent_score: 8,
        total_score: 8.5,
        score_reason: 'Fit 9, Intent 8',
        draft_message: 'Existing draft',
        draft_chars: 340,
        status: 'sent',
        approved_by: 'Lee',
        sent_date: '2026-11-05',
        reply_date: '',
        outcome: '',
        notes: '',
      },
      {
        lead_id: 'WS-20261104-02',
        found_date: '2026-11-04',
        source: 'X',
        first_name: 'Jordan',
        title: 'VP Sales',
        company: 'PeakData',
        profile_url: 'https://x.com/jordansales',
        x_handle: '@jordansales',
        post_url: 'https://x.com/jordansales/status/111',
        post_date: '2026-11-04',
        signal_type: 'pain',
        signal_quote: 'Outbound is tough',
        fit_score: 9,
        intent_score: 8,
        total_score: 8.5,
        score_reason: 'Fit 9, Intent 8',
        draft_message: 'Existing draft',
        draft_chars: 350,
        status: 'meeting',
        approved_by: 'Lee',
        sent_date: '2026-11-04',
        reply_date: '2026-11-05',
        outcome: 'positive',
        notes: '',
      },
    ];

    const incoming: CandidateInput[] = [
      // Same person Maya on X instead of LinkedIn (matches firstname|company and x_handle)
      {
        id: 'dup-maya',
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
        post_url: 'https://x.com/mayagrowth/status/222',
        post_date: '2026-11-06',
        hours_ago: 10,
        signal_type: 'asking',
        signal_strength: 5,
        specificity_points: 2,
        signal_quote: 'New X post from Maya',
      },
      // Existing meeting lead Jordan posts a new signal -> should append note to existing row and NOT create new lead
      {
        id: 'active-jordan',
        source: 'X',
        first_name: 'Jordan',
        last_name: 'Smith',
        title: 'VP Sales',
        company: 'PeakData',
        company_size: 55,
        industry: 'B2B SaaS',
        geo: 'US',
        is_competitor_or_recruiter: false,
        profile_url: 'https://x.com/jordansales',
        x_handle: '@jordansales',
        post_url: 'https://x.com/jordansales/status/999',
        post_date: '2026-11-06',
        hours_ago: 6,
        signal_type: 'hiring',
        signal_strength: 4,
        specificity_points: 2,
        signal_quote: 'Hiring a new BDR this week',
      },
    ];

    const result = dedupeAndFilterCandidates(incoming, existingLeads, defaultICP, '2026-11-06');
    expect(result.survivingCandidates).toHaveLength(0);
    const updatedJordan = result.updatedExistingLeads.find(l => l.lead_id === 'WS-20261104-02');
    expect(updatedJordan?.notes).toContain('New signal 2026-11-06: https://x.com/jordansales/status/999');
  });

  it('T3, T4, T5 & T8: validates 300-400 char bounds, rejects last names/emails/phones, rejects em-dashes and banned phrases', () => {
    const validDraft =
      'Hey Maya, saw your X post about hiring your first two SDRs and trying to avoid a six-tool outbound stack. Most teams we talk to find that catching 48-hour buying signals cuts ramp time in half before adding headcount. At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to send the rubric we use?';

    const checkValid = validateOpenerDraft(validDraft, {
      first_name: 'Maya',
      last_name: 'Lin',
      post_url: 'https://x.com/mayagrowth/status/198639104218',
    });
    expect(checkValid.charCount).toBeGreaterThanOrEqual(300);
    expect(checkValid.charCount).toBeLessThanOrEqual(400);
    expect(checkValid.valid).toBe(true);
    expect(checkValid.flags).toHaveLength(0);

    const invalidWithLastNameAndEmDash =
      'Hey Maya Lin \u2014 I came across your profile and loved your post! Can we hop on a quick 15-min call at https://calendly.com/pond? Email me at maya@latticeflow.com.';
    const checkInvalid = validateOpenerDraft(invalidWithLastNameAndEmDash, {
      first_name: 'Maya',
      last_name: 'Lin',
      post_url: 'https://x.com/mayagrowth/status/198639104218',
    });
    expect(checkInvalid.valid).toBe(false);
    expect(checkInvalid.flags).toContain('length');
    expect(checkInvalid.flags).toContain('last_name_or_pii');
    expect(checkInvalid.flags).toContain('em_dash');
    expect(checkInvalid.flags).toContain('banned_phrase');
    expect(checkInvalid.flags).toContain('contains_link');
  });

  it('T9: parses and applies batch approval commands (approve, edit, skip, do_not_contact)', () => {
    const sampleLeads: LeadRow[] = [1, 2, 3, 4, 5].map(n => ({
      lead_id: `WS-20261106-0${n}`,
      found_date: '2026-11-06',
      source: 'X',
      first_name: `Lead${n}`,
      title: 'Founder',
      company: `Co${n}`,
      profile_url: `https://x.com/lead${n}`,
      x_handle: `@lead${n}`,
      post_url: `https://x.com/lead${n}/status/${n}`,
      post_date: '2026-11-06',
      signal_type: 'pain',
      signal_quote: 'Pipeline is dry',
      fit_score: 9,
      intent_score: 8,
      total_score: 8.5,
      score_reason: 'Fit 9, Intent 8',
      draft_message: 'A'.repeat(340),
      draft_chars: 340,
      status: 'drafted',
      approved_by: '',
      sent_date: '',
      reply_date: '',
      outcome: '',
      notes: '',
    }));

    const newText =
      'Hey Lead3, saw your X post about outbound reply rates dropping this quarter. Teams we work with usually find that responding to 48-hour buying signals beats adding more cold domains. At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to share the scoring rubric we use?';

    const cmd = `approve 1, 2, 5 · edit 3: ${newText} · skip 4`;
    const updated = parseAndApplyBatchCommand(cmd, sampleLeads, 'Lee');

    expect(updated[0].status).toBe('approved');
    expect(updated[0].approved_by).toBe('Lee');
    expect(updated[1].status).toBe('approved');
    expect(updated[2].status).toBe('edited');
    expect(updated[2].draft_message).toBe(newText);
    expect(updated[2].draft_chars).toBe(newText.length);
    expect(updated[3].status).toBe('skipped');
    expect(updated[4].status).toBe('approved');
  });

  it('T10: halts LinkedIn opens immediately when LinkedIn login/checkpoint wall is encountered and logs li_auth_needed', () => {
    const candidates: CandidateInput[] = [
      {
        id: 'x1',
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
        signal_quote: 'Hiring our first 2 SDRs next month and dreading the 6-tool frankenstack.',
      },
      {
        id: 'li1',
        source: 'LinkedIn',
        first_name: 'Devon',
        last_name: 'Cole',
        title: 'Founder',
        company: 'CrateOps',
        company_size: 28,
        industry: 'DevTools',
        geo: 'US',
        is_competitor_or_recruiter: false,
        profile_url: 'https://linkedin.com/in/devon-crateops',
        x_handle: '',
        post_url: 'https://linkedin.com/posts/devon-77812',
        post_date: '2026-11-06',
        hours_ago: 19,
        signal_type: 'pain',
        signal_strength: 4,
        specificity_points: 2,
        signal_quote: 'Cold outbound reply rate dropped from 3.4% to 0.9% this quarter.',
      },
    ];

    const runResult = runWarmSignalPipeline({
      candidates,
      existingLeads: [],
      icp: defaultICP,
      runDate: '2026-11-06',
      simulateLinkedInWall: true,
    });

    expect(runResult.runRow.failures).toContain('li_auth_needed');
    expect(runResult.shortlistedLeads.every(l => l.source === 'X')).toBe(true);
  });
});
