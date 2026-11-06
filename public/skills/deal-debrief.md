# Skill: deal-debrief (Section 2.5 & 2.6)

## Routine Prompt (Section 2.5)
Run the deal-debrief skill for the sales call that just ended: {{calendar_event_title}} at {{calendar_event_end_time}} with {{external_attendees}}.
Context: My voice and sign-off rules are in memory under "Email Voice". CRM is the Google Sheet "Pond Warm Signal CRM", tabs Deals, Debriefs, and Leads.
Do this:
1. Wait 10 minutes after the call end time, then find the transcript in Granola or the "Call Transcripts" folder in Google Drive. If it isn't there yet, retry once 20 minutes later. If there's still no transcript, log a no-transcript row in Debriefs and tell me here. Do not guess what happened on the call.
2. Read the full transcript. Run the two-pass extraction from the skill: full notes first, then the commitment sweep for "I'll send", "we'll follow up", "let's schedule", "by Friday", and similar phrases. Include a timestamp or short quote for every extracted item. Write "not discussed" for anything that didn't come up.
3. Match the call to an existing row in Deals by domain or company name (or create a new Deals row, linking Lead ID if they came from Leads). Update stage, MEDDIC fields, next step, and follow-up date.
4. Draft the follow-up email in Gmail as an unsent draft (under 150 words, plain text, their words for their problems, bullets for what each side will do with dates, one concrete next-step time). Do not send it.
5. Create one private reminder event on my calendar on the follow-up date at 9:00 AM with no attendees.
6. Append the full debrief to Debriefs and post the summary here for my review.
