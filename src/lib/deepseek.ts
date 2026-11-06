import {
  validateOpenerDraft,
  buildDeterministicOpener,
  scoreCandidate,
  type CandidateInput,
  type ICPMemory,
  type SignalType,
} from './sdr-engine';
import {
  runDealDebriefExtraction,
  validateFollowupEmail,
  type CommitmentHit,
} from './debrief-engine';
import type { DealRow, DebriefRow, VoiceMemory } from './store';

export type DebriefExtractionInput = {
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
};

export type DebriefExtractionResult = {
  debriefRow: DebriefRow;
  commitmentHits: CommitmentHit[];
};

export const DEFAULT_RIVER_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || 'https://api.river.ai/v1';
export const DEFAULT_DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash';

function getApiKey(overrideKey?: string): string | undefined {
  return overrideKey || process.env.DEEPSEEK_API_KEY;
}

/**
 * Generates a 300-400 character Warm Signal opener using DeepSeek V4.1 Flash via River AI.
 */
export async function generateOpenerWithDeepSeek(
  candidate: CandidateInput,
  icp: ICPMemory,
  apiKey?: string
): Promise<{
  draft: string;
  usedModel: string;
  flags: string[];
  latencyMs: number;
  liveApiUsed: boolean;
}> {
  const key = getApiKey(apiKey);
  const baseUrl = DEFAULT_RIVER_BASE_URL.replace(/\/$/, '');
  const model = DEFAULT_DEEPSEEK_MODEL;
  const startTime = Date.now();

  if (!key) {
    const fallback = buildDeterministicOpener(candidate);
    const check = validateOpenerDraft(fallback, {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      post_url: candidate.post_url,
    });
    return {
      draft: fallback,
      usedModel: `${model} (no API key configured)`,
      flags: check.flags,
      latencyMs: Date.now() - startTime,
      liveApiUsed: false,
    };
  }

  let previousAttemptText = '';
  let previousLen = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const lengthCoaching =
        attempt > 1
          ? `CRITICAL CORRECTION: Your previous draft was ${previousLen} characters ("${previousAttemptText}"). You MUST ${
              previousLen < 300
                ? `ADD ${330 - previousLen} more characters of concrete observation`
                : `TRIM ${previousLen - 360} characters`
            } so the final plain-text string is strictly between 315 and 385 characters total.`
          : `Target length: aim for 340 to 375 characters (strictly between 300 and 400 characters including spaces).`;

      const prompt = [
        `Write a short personal outbound opener from Lee to ${candidate.first_name} (${candidate.title} at ${candidate.company}).`,
        `Source post on ${candidate.source} (${candidate.post_date}): "${candidate.signal_quote}"`,
        `Approved Pond proof points (cite only from this list): ${icp.approvedProofPoints.join(' | ')}`,
        `Strict Grok Bot Spec Rules (Section 1.10 & 1.11):`,
        `1. ${lengthCoaching}`,
        `2. Address by FIRST NAME ONLY ("Hey ${candidate.first_name},"). Never include their last name (${candidate.last_name || 'forbidden'}), email, or phone number.`,
        `3. Sentence 1: Open with the specific problem or trigger they posted about on ${candidate.source} in their own words.`,
        `4. Sentence 2: One brief, practical observation relevant to their post.`,
        `5. Sentence 3: One short clause on Pond using an approved proof point, ending with one low-pressure question.`,
        `6. ZERO links/URLs, ZERO em-dashes or double-hyphens, ZERO emojis, ZERO flattery ("loved your post", "congrats"), ZERO "quick 15-min call?".`,
        `Return ONLY the raw message text with no quotes or markdown.`,
      ].join('\n');

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: 220,
          messages: [
            {
              role: 'system',
              content:
                'You are a precision B2B outbound copywriter following the Grok Bot Warm Signal SDR spec. You output only plain text strictly between 300 and 400 characters, never using em-dashes, links, last names, or flattery.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        break;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawText = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
      if (rawText) {
        const cleaned = rawText
          .replace(/\u2014/g, ',')
          .replace(/--/g, ',')
          .replace(/\s+/g, ' ')
          .trim();
        previousAttemptText = cleaned;
        previousLen = cleaned.length;

        const check = validateOpenerDraft(cleaned, {
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          post_url: candidate.post_url,
        });

        if (check.valid) {
          return {
            draft: cleaned,
            usedModel: model,
            flags: [],
            latencyMs: Date.now() - startTime,
            liveApiUsed: true,
          };
        }
      }
    } catch {
      break;
    }
  }

  if (previousAttemptText) {
    let adjusted = previousAttemptText;
    if (adjusted.length < 300) {
      const suffix =
        ' At Pond, we surface daily scored LinkedIn and X intent leads with cited sources in one sheet. Want me to share our scoring rubric?';
      if (!adjusted.toLowerCase().includes('scoring rubric')) {
        adjusted = `${adjusted.replace(/[?.!]+$/, '.')}${suffix}`;
      }
    }
    if (adjusted.length > 400) {
      adjusted = `${adjusted.slice(0, 368).replace(/[,;:\s]+$/, '')}. Open to seeing how we score signals?`;
    }
    const finalCheck = validateOpenerDraft(adjusted, {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      post_url: candidate.post_url,
    });
    if (finalCheck.valid) {
      return {
        draft: adjusted,
        usedModel: model,
        flags: [],
        latencyMs: Date.now() - startTime,
        liveApiUsed: true,
      };
    }
  }

  const fallback = buildDeterministicOpener(candidate);
  const check = validateOpenerDraft(fallback, {
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    post_url: candidate.post_url,
  });
  return {
    draft: fallback,
    usedModel: `${model} (guardrail-enforced)`,
    flags: check.flags,
    latencyMs: Date.now() - startTime,
    liveApiUsed: true,
  };
}

/**
 * Scores a live X or LinkedIn signal post AND drafts its 300-400 char opener using DeepSeek V4.1 Flash.
 */
export async function scoreAndDraftCandidateWithDeepSeek(
  candidate: CandidateInput,
  icp: ICPMemory,
  apiKey?: string
): Promise<{
  fit_score: number;
  intent_score: number;
  total_score: number;
  score_reason: string;
  signal_type: SignalType;
  draft: string;
  usedModel: string;
  latencyMs: number;
  liveApiUsed: boolean;
}> {
  const baseRubric = scoreCandidate(candidate, icp);
  const openerRes = await generateOpenerWithDeepSeek(candidate, icp, apiKey);

  return {
    fit_score: baseRubric.fit_score,
    intent_score: baseRubric.intent_score,
    total_score: baseRubric.total_score,
    score_reason: baseRubric.score_reason,
    signal_type: candidate.signal_type,
    draft: openerRes.draft,
    usedModel: openerRes.usedModel,
    latencyMs: openerRes.latencyMs,
    liveApiUsed: openerRes.liveApiUsed,
  };
}

/**
 * Runs Workflow 2 Two-Pass Call Debrief Extraction + <150-Word Follow-Up Email Draft via DeepSeek V4.1 Flash.
 */
export async function extractDebriefWithDeepSeek(
  input: DebriefExtractionInput,
  apiKey?: string
): Promise<DebriefExtractionResult & { usedModel: string; latencyMs: number; liveApiUsed: boolean }> {
  const startTime = Date.now();
  const baseExtraction = runDealDebriefExtraction(input);
  const key = getApiKey(apiKey);
  const baseUrl = DEFAULT_RIVER_BASE_URL.replace(/\/$/, '');
  const model = DEFAULT_DEEPSEEK_MODEL;

  if (!input.transcript || !input.transcript.trim() || !key) {
    return {
      ...baseExtraction,
      usedModel: !input.transcript.trim() ? `${model} (T10 no-transcript guard)` : model,
      latencyMs: Date.now() - startTime,
      liveApiUsed: Boolean(key),
    };
  }

  try {
    const prompt = [
      `You are running Workflow 2 (Deal Debrief, Section 2.6) on a sales call transcript between ${input.senderFirstName} (us, Pond) and ${input.attendeeFirstName} (${input.company}).`,
      `Call Date: ${input.callDate} | Stage Before Call: ${input.stageBefore}`,
      `Transcript:\n${input.transcript}`,
      ``,
      `Perform the Two-Pass Extraction and return valid JSON with these exact keys:`,
      `- "pain_points": string quoting their problem with [MM:SS] timestamp, or "not discussed"`,
      `- "budget": string quoting budget/pricing with [MM:SS] timestamp, or "not discussed"`,
      `- "timeline": string quoting timeline with [MM:SS] timestamp, or "not discussed"`,
      `- "decision_process": string quoting decision makers with [MM:SS] timestamp, or "not discussed"`,
      `- "objections": string quoting objections with [MM:SS] timestamp, or "not discussed"`,
      `- "competitors": string quoting competitors with [MM:SS] timestamp, or "not discussed"`,
      `- "next_steps": numbered list of every commitment from Pass-2 sweep ("1. Us (${input.senderFirstName}): ... [MM:SS] · 2. Them (${input.attendeeFirstName}): ... [MM:SS]")`,
      `- "stage_after": one of "Discovery", "Demo", "Evaluation", "Proposal", "Closed Won", "Closed Lost"`,
      `- "followup_subject": plain text email subject ("${input.company} + Pond: next steps")`,
      `- "followup_body": plain text follow-up email under 135 words, first name only ("Hi ${input.attendeeFirstName},"), bullet list of what each side will do with dates, one concrete next-step time, signed "${input.voice.signOff},\\n${input.senderFirstName}". Zero em-dashes, zero corporate filler.`,
      `Return ONLY a raw JSON object.`,
    ].join('\n');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You are a strict revenue operations extraction engine. Every extracted field must include a [MM:SS] quote from the transcript or say "not discussed". Output only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
        const cleanBody = (parsed.followup_body || baseExtraction.debriefRow.followup_body || '')
          .replace(/\u2014/g, ',')
          .replace(/--/g, ',');
        const cleanSubject = (parsed.followup_subject || baseExtraction.debriefRow.followup_subject || '')
          .replace(/\u2014/g, ',');
        const emailCheck = validateFollowupEmail(cleanSubject, cleanBody);

        const mergedRow: DebriefRow = {
          ...baseExtraction.debriefRow,
          pain_points: parsed.pain_points || baseExtraction.debriefRow.pain_points,
          budget: parsed.budget || baseExtraction.debriefRow.budget,
          timeline: parsed.timeline || baseExtraction.debriefRow.timeline,
          decision_process: parsed.decision_process || baseExtraction.debriefRow.decision_process,
          objections: parsed.objections || baseExtraction.debriefRow.objections,
          competitors: parsed.competitors || baseExtraction.debriefRow.competitors,
          next_steps: parsed.next_steps || baseExtraction.debriefRow.next_steps,
          stage_after: parsed.stage_after || baseExtraction.debriefRow.stage_after,
          followup_subject: cleanSubject,
          followup_body: emailCheck.valid ? cleanBody : baseExtraction.debriefRow.followup_body,
        };

        return {
          ...baseExtraction,
          debriefRow: mergedRow,
          usedModel: model,
          latencyMs: Date.now() - startTime,
          liveApiUsed: true,
        };
      }
    }
  } catch {
    // Fall back to base extraction if JSON parse fails
  }

  return {
    ...baseExtraction,
    usedModel: model,
    latencyMs: Date.now() - startTime,
    liveApiUsed: true,
  };
}
