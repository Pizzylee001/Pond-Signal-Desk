import { validateOpenerDraft, buildDeterministicOpener, type CandidateInput, type ICPMemory } from './sdr-engine';

export async function generateOpenerWithDeepSeek(
  candidate: CandidateInput,
  icp: ICPMemory,
  apiKey?: string
): Promise<{ draft: string; usedModel: string; flags: string[] }> {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    const fallback = buildDeterministicOpener(candidate);
    const check = validateOpenerDraft(fallback, {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      post_url: candidate.post_url,
    });
    return {
      draft: fallback,
      usedModel: 'deepseek-chat (deterministic fallback)',
      flags: check.flags,
    };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const prompt = [
        `Write a short personal outbound opener for ${candidate.first_name} (${candidate.title} at ${candidate.company}).`,
        `Source post (${candidate.source}): "${candidate.signal_quote}"`,
        `Approved Pond proof points: ${icp.approvedProofPoints.join(' | ')}`,
        `Strict rules:`,
        `- Must be strictly between 300 and 400 characters including spaces.`,
        `- Address by first name only (${candidate.first_name}). Never include last name, email, or phone.`,
        `- Sentence 1: their problem in their words pointing to their ${candidate.source} post.`,
        `- Sentence 2: a useful observation.`,
        `- Final sentence: one clause on Pond using only approved proof points, ending with a low-pressure question.`,
        `- No links, no em dashes, no emojis, no flattery ("loved your post"), no "quick call?".`,
        attempt === 2 ? `IMPORTANT: Your previous draft missed the 300-400 character window. Count characters carefully so total length is 320-380 characters.` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content:
                'You write plain, human-sounding B2B openers that strictly obey character limits (300-400 chars) and never use em dashes, links, or flattery.',
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
      const text = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
      if (text) {
        const cleaned = text.replace(/\u2014/g, ',');
        const check = validateOpenerDraft(cleaned, {
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          post_url: candidate.post_url,
        });
        if (check.valid || attempt === 2) {
          return {
            draft: cleaned,
            usedModel: 'deepseek-chat',
            flags: check.flags,
          };
        }
      }
    } catch {
      break;
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
    usedModel: 'deepseek-chat (verified fallback)',
    flags: check.flags,
  };
}
