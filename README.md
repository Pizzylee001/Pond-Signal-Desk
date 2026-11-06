# Pond Signal Desk: Warm Signal SDR + Deal Debrief

An end-to-end implementation of **Dylan Pond's Grok Bot Builder Spec v1.0 (Warm Signal SDR + Deal Debrief)**, built as a self-contained Next.js 16 + TypeScript web application paired with importable **n8n Cloud** schedule workflows and **DeepSeek V3 (`deepseek-chat`)** reasoning.

---

## Why We Built This Without Grok Bot Desktop

Because Grok Bot is currently in gated access, we engineered the full spec on an open, inspectable stack that preserves every rule, column, scoring formula, two-pass extraction, and human-approval guardrail from the specification:

1. **Routines (Cron & Event Triggers)**: Delivered via two ready-to-import **n8n Cloud** workflow JSON files (`public/n8n/workflow-1-warm-signal-sdr.json` for `0 7 * * 1-5` and `public/n8n/workflow-2-deal-debrief.json` for `*/15 8-19 * * 1-5`) plus instant interactive execution inside the web app.
2. **Skills (`warm-signal-sdr` & `deal-debrief`)**: Implemented as deterministic TypeScript engines (`src/lib/sdr-engine.ts` and `src/lib/debrief-engine.ts`) with full unit test coverage (`14/14` Vitest tests) and copyable skill definitions in `public/skills/`.
3. **Memory (`ICP + Offer` & `Email Voice`)**: Persisted in the application store and editable live in the **Rules & n8n Export** (`/spec`) route.
4. **CRM (`Pond Warm Signal CRM`)**: Built directly into the **CRM Sheet** (`/crm`) route with all 4 exact specification tabs (`Leads` [24 columns], `Deals` [20 columns], `Debriefs` [28 columns], and `Runs` [11 columns]) and one-click RFC-4180 `.csv` export for Google Sheets.
5. **Draft-for-Approval Guardrails**: Hardcoded at both the API and UI layers. No message, email, or external invite is ever sent automatically.

---

## Architecture & 4-Page Application Map

| Route | Purpose | Spec Sections Covered |
| :--- | :--- | :--- |
| `/` (**Morning Leads**) | Daily Top 10 Warm Signal SDR queue (`Total >= 6.0`), `Fit` + `Intent` breakdown with quoted evidence, live `300 to 400` character counter, first-name/PII guardrail validator, batch command bar (`approve 1,2 · skip 4`), and `T10` LinkedIn login-wall halt simulation. | Sections 1.1 to 1.13 (`W1-T1` to `W1-T11`) |
| `/debrief` (**Call Debriefs**) | Post-call Deal Debrief review desk with side-by-side timestamped transcript viewer, Pass-1 structured notes (`"not discussed"` fallbacks), Pass-2 11-phrase commitment sweep, deal stage progression, `<150`-word plain-text follow-up draft, private `.ics` calendar reminder (`0` attendees), and `+ Debrief New Call` drawer (with `T10` no-show fallback). | Sections 2.1 to 2.12 (`W2-T1` to `W2-T10`) |
| `/crm` (**CRM Sheet**) | Full 4-tab **Pond Warm Signal CRM** viewer (`Leads`, `Deals`, `Debriefs`, `Runs`) enforcing all 83 total specification columns and one-click `.csv` export per tab. | Sections 1.8 & 2.7 |
| `/spec` (**Rules & n8n Export**) | Live editor for `ICP + Offer` and `Email Voice` memory, downloadable n8n Cloud `.json` workflows, and the live **21-Test Spec Verification Suite** (`W1-T1..T11` + `W2-T1..T10`). | Sections 1.6, 1.7, 1.13, 2.5, 2.6, 2.12 |

---

## Honest Comparison vs. Gojiberry AI & Sybill (Sections 1.2 & 2.2)

### Workflow 1: Warm Signal SDR (Replaces Gojiberry AI at ~$99/mo)
- **Where this build is stronger**:
  - Combines **X** and **LinkedIn** buying signals in a single ranked feed.
  - Plain-English, inspectable scoring rubric (`Total = round(0.5 * Fit + 0.5 * Intent, 1)`).
  - Every opener cites the exact source post URL and enforces a strict `300 to 400` character window.
  - Zero extra SaaS seat cost; all data lives in your own sheet/store.
- **Where this build falls short (documented trade-offs)**:
  - **Coverage**: Paced browser/search queries surface tens of high-intent candidates per day rather than bulk firehose scraping.
  - **Passive signals**: Does not track silent profile views or passive competitor post likes unless visible in search results.
  - **Manual send pacing**: Approved openers are sent manually by the rep (spaced 2 to 12 minutes apart on LinkedIn) by design to protect account safety.
  - **Session fragility (`W1-T10`)**: A LinkedIn login checkpoint or 2FA prompt halts the LinkedIn branch (`status = partial`), while the X branch still completes cleanly.

### Workflow 2: Deal Debrief (Replaces Sybill / Fathom CRM Sync at ~$29 to $79/seat/mo)
- **Where this build is stronger**:
  - Does **not** join calls as a visible recording bot; reads transcripts post-call from Granola, Google Drive, or direct paste.
  - Runs a mandatory **Pass-2 Commitment Sweep** across 11 trigger phrases (`"I'll send"`, `"we'll follow up"`, `"let's schedule"`, `"by Friday"`, etc.) so casual verbal promises at the end of a call are never dropped.
  - Every extracted pain point, budget figure, and action item requires a `[MM:SS]` timestamp quote or is explicitly marked `"not discussed"`.
- **Where this build falls short (documented trade-offs)**:
  - **No video or body-language analysis**: Operates strictly on text transcripts.
  - **Speaker diarization reliance**: If a transcript labels speakers generically (`Speaker 1`), confidence drops to `low` and the summary flags the rep to verify speaker assignment.
  - **Sheet-first CRM**: Syncs directly to the 4-tab `Pond Warm Signal CRM` structure rather than native HubSpot/Salesforce objects out of the box.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure DeepSeek API key for live LLM re-scoring & transcript extraction
# Without an API key, the deterministic spec engine runs automatically with zero network failures.
cp .env.example .env.local
# Set DEEPSEEK_API_KEY=sk-...

# 3. Run the 14 Vitest unit tests (covering W1, W2, and all 21 spec assertions)
npx vitest run

# 4. Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Importing into n8n Cloud (`pizzylee.app.n8n.cloud`)

1. Open your n8n Cloud workspace (`https://pizzylee.app.n8n.cloud`).
2. Click **Create Workflow** -> **Import from File...**
3. Select `public/n8n/workflow-1-warm-signal-sdr.json` (Weekday 7:00 AM Warm Signal SDR routine) and `public/n8n/workflow-2-deal-debrief.json` (Weekday 15-minute post-call Deal Debrief poller).
4. Set your `POND_APP_URL` and `DEEPSEEK_API_KEY` environment variables in n8n and toggle the schedule triggers on after running one manual test execution.

---

## Dylan Pond's 5-Area Scorecard Self-Check

| Scorecard Area | Weight | Verification in This Repo |
| :--- | :--- | :--- |
| **1. Works end to end on a schedule** | 25% | Cron routines exported in `public/n8n/` + live trigger endpoints at `/api/sdr` and `/api/debrief`. |
| **2. Output quality & zero fabrication** | 30% | `Total = round(0.5 * Fit + 0.5 * Intent, 1)`, `[MM:SS]` timestamp quotes, `"not discussed"` fallbacks, and Pass-2 11-phrase commitment sweep. |
| **3. Guardrails hold** | 20% | Hard `300..400` char opener check, `<150` word plain-text follow-up check, first-name-only PII validator, `0` calendar invitees, and `0` auto-sends. |
| **4. Failure handling (`T10`)** | 15% | Interactive `W1-T10` LinkedIn login-wall partial-run simulation (`/`) and `W2-T10` no-show call fallback (`/debrief`). |
| **5. Clarity of handoff** | 10% | Clean 4-page monochrome UI, live 21-test spec verifier (`/spec`), and 1-click CSV + n8n JSON exports. |
