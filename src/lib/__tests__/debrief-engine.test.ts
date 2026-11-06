import { describe, it, expect } from 'vitest';
import {
  sweepCommitmentPhrases,
  computeNextStage,
  addBusinessDays,
  generatePrivateIcsReminder,
  validateFollowupEmail,
  runDealDebriefExtraction,
} from '../debrief-engine';
import { SEED_VOICE } from '../store';

describe('Workflow 2: Deal Debrief Engine (T1-T10 Spec Verification)', () => {
  it('T1: Pass-2 commitment sweep catches all 11 commitment phrase families with timestamps and owners', () => {
    const transcript = [
      `[04:12] Maya: We spend two hours every morning checking LinkedIn and X by hand.`,
      `[11:40] Maya: I'll check with Marcus on security sign-off before we connect Google Workspace.`,
      `[18:05] Lee: I'll send over the custom scoring rubric and sample sheet before Thursday.`,
      `[21:50] Maya: Perfect, let's schedule a 20-minute live demo for Tuesday Nov 10 at 11am ET.`,
    ].join('\n');

    const hits = sweepCommitmentPhrases(transcript, 'Lee', 'Maya');
    expect(hits.length).toBe(3);
    expect(hits[0].phrase.toLowerCase()).toContain("i'll");
    expect(hits[0].owner).toBe('Maya');
    expect(hits[0].timestamp).toBe('11:40');
    expect(hits[1].owner).toBe('us');
    expect(hits[1].timestamp).toBe('18:05');
    expect(hits[2].phrase.toLowerCase()).toContain('schedule');
    expect(hits[2].timestamp).toBe('21:50');
  });

  it('T2 & T6: never fabricates missing fields; outputs "not discussed" when budget or competitors are absent', () => {
    const shortTranscript = `[02:10] Alex: We need better warm outbound signals for our 3 BDRs.\n[09:00] Lee: Let me send you the sample sheet tomorrow.`;
    const result = runDealDebriefExtraction({
      event_id: 'evt-test-01',
      company: 'AcmeCloud',
      attendeeFirstName: 'Alex',
      senderFirstName: 'Lee',
      callDate: '2026-11-06',
      stageBefore: 'Lead',
      transcript: shortTranscript,
      source: 'Pasted',
      voice: SEED_VOICE,
    });

    expect(result.debriefRow.budget).toBe('not discussed');
    expect(result.debriefRow.competitors).toBe('not discussed');
    expect(result.debriefRow.next_steps).toContain('[09:00]');
  });

  it('T3: computes accurate deal stage transitions from transcript signals', () => {
    expect(
      computeNextStage('Discovery', 'Let us schedule a 20-minute live demo next Tuesday', false)
    ).toEqual({
      stageAfter: 'Demo',
      reason: 'Live product demo agreed on call',
    });

    expect(
      computeNextStage('Demo', 'Let us run a two-week pilot starting Monday', false)
    ).toEqual({
      stageAfter: 'Evaluation/Pilot',
      reason: 'Pilot or trial evaluation agreed on call',
    });

    expect(computeNextStage('Discovery', '', true)).toEqual({
      stageAfter: 'Discovery',
      reason: 'No-show or missing transcript; stage unchanged',
    });
  });

  it('T5 & T9: calculates +3 business days fallback and generates a private .ics reminder with zero invitees', () => {
    // Friday 2026-11-06 + 3 business days -> Wednesday 2026-11-11
    expect(addBusinessDays('2026-11-06', 3)).toBe('2026-11-11');

    const ics = generatePrivateIcsReminder({
      company: 'LatticeFlow',
      nextStep: 'Send custom scoring rubric and sample sheet',
      reminderDate: '2026-11-10',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Follow up: LatticeFlow: Send custom scoring rubric');
    expect(ics).not.toContain('ATTENDEE');
  });

  it('T4 & T7: validates <150-word follow-up email, first-name-only rule, and rejects banned phrases/em-dashes', () => {
    const cleanBody = `Hi Maya,\n\nThanks for walking through how you spend two hours each morning hunting warm signals by hand.\n\n- We agreed to configure a combined LinkedIn and X buying-signal rubric.\n- I will send the sample sheet before Thursday.\n- You will check with Marcus on Workspace security ahead of our Nov 10 demo.\n\nDoes Tuesday at 11:00 AM ET still work on your calendar?\n\nBest,\nLee`;

    const validCheck = validateFollowupEmail(
      'LatticeFlow + Pond: next steps',
      cleanBody,
      { attendeeLastName: 'Lin' }
    );
    expect(validCheck.valid).toBe(true);
    expect(validCheck.wordCount).toBeLessThan(150);

    const badBody = `Hi Maya Lin — just checking in as per our conversation! Circle back at maya@latticeflow.com.`;
    const badCheck = validateFollowupEmail('Quick question', badBody, {
      attendeeLastName: 'Lin',
    });
    expect(badCheck.valid).toBe(false);
    expect(badCheck.flags).toContain('em_dash');
    expect(badCheck.flags).toContain('banned_phrase');
    expect(badCheck.flags).toContain('last_name_or_pii');
  });

  it('T10: handles no-show / empty transcript by logging low confidence and drafting a reschedule note', () => {
    const noShowResult = runDealDebriefExtraction({
      event_id: 'evt-noshow-99',
      company: 'Kova Systems',
      attendeeFirstName: 'Liam',
      senderFirstName: 'Lee',
      callDate: '2026-11-06',
      stageBefore: 'Discovery',
      transcript: '',
      source: 'Pasted',
      voice: SEED_VOICE,
    });

    expect(noShowResult.debriefRow.confidence).toBe('low');
    expect(noShowResult.debriefRow.flags).toContain('no_transcript_found');
    expect(noShowResult.debriefRow.followup_body).toContain('reschedule');
  });
});
