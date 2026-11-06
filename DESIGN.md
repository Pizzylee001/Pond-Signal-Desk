# DESIGN.md · Pond Signal Desk

## 1. Visual Direction & Domain Exemplars
- **Surface Mode:** Operate (`CRM & Client Management` + `Soft UI Evolution`).
- **Domain Exemplars:** Attio and Linear (crisp monochrome paper-and-ink hierarchy, calm spacing, zero colored-pill clutter, instant keyboard and click triage).
- **Point of View:** A human-first revenue operations workspace that lets a sales operator review 10 daily warm buying signals in under 10 minutes and debrief sales calls in under 5 minutes, with every claim traced to a live URL or call timestamp.

## 2. Color & Atmospheric Polarity (`Both` Theme with Sun/Moon Icon Toggle)
- **Neutral Grounding Rule (`08-anti-slop-filter.md` Rule 12):** Over 90% of the viewport uses neutral surfaces (`canvas`, `surface`, `subtle`, `text-main`, `text-secondary`, `border`). Colored fills are banned on cards and badges; status uses `6px` semantic dots (`#16A34A` approved/pass, `#D97706` needs review, `#DC2626` guardrail halt).

### Light Mode (Default)
- `--bg-canvas`: `#FAFAFA`
- `--bg-surface`: `#FFFFFF`
- `--bg-subtle`: `#F4F4F5`
- `--bg-hover`: `#F4F4F5`
- `--border-color`: `#E4E4E7`
- `--text-main`: `#18181B` (`16.8:1` contrast on `#FFFFFF`)
- `--text-secondary`: `#52525B` (`7.5:1` contrast on `#FFFFFF`)
- `--text-muted`: `#71717A` (`4.7:1` contrast on `#FFFFFF`)
- `--btn-primary-bg`: `#18181B`
- `--btn-primary-fg`: `#FAFAFA` (`16.8:1` contrast)

### Dark Mode (Toggled via Header Sun/Moon Icon Button)
- `--bg-canvas`: `#09090B`
- `--bg-surface`: `#121215`
- `--bg-subtle`: `#18181C`
- `--bg-hover`: `#1F1F24`
- `--border-color`: `#27272A`
- `--text-main`: `#F4F4F5` (`16.4:1` contrast on `#121215`)
- `--text-secondary`: `#A1A1AA` (`7.8:1` contrast on `#121215`)
- `--text-muted`: `#8A8A93` (`5.1:1` contrast on `#121215`)
- `--btn-primary-bg`: `#F4F4F5`
- `--btn-primary-fg`: `#09090B` (`17.1:1` contrast)

## 3. Typography & Scannable Hierarchy
- **Heading Font (`--font-heading`):** `Lexend` (`500` Medium / `600` SemiBold), tracking `-0.02em`, `text-wrap: balance`.
- **Body Font (`--font-sans`):** `Source Sans 3` (`400` Regular / `600` SemiBold), `line-height: 1.55`.
- **Monospace / Tabular Font (`--font-mono`):** `IBM Plex Mono` (`400` / `500`), `font-variant-numeric: tabular-nums` on all scores, character/word counters, timestamps, and IDs.
- **Minimum Type Floor:** `12px` (`0.75rem`); zero sub-12px micro-text.

## 4. Layout, Spatial Architecture & Multi-Page Structure
- **Dials:** `LAYOUT_VARIANCE: 6` | `MOTION_INTENSITY: 5` | `VISUAL_DENSITY: 5` | `ENERGY: 2` | `RHYTHM: 3` | `MOTION: 2`.
- **4 Dedicated Next.js App Router Pages:**
  1. `/` (**Morning Leads**): Master-detail queue for Workflow 1 (`Warm Signal SDR`) with collapsible Quick Command bar and `T10` LinkedIn checkpoint test mode.
  2. `/debrief` (**Call Debriefs**): Post-call studio for Workflow 2 (`Deal Debrief`) with 2-pass extraction, commitment-phrase sweep highlights, stage transition, `.ics` private reminder download, and `<150`-word follow-up email editor.
  3. `/crm` (**CRM Sheet**): Full 4-tab spreadsheet inspector (`Leads`, `Deals`, `Debriefs`, `Runs`) with exact spec columns, cross-workflow `Lead -> Deal` promotion, and CSV export.
  4. `/spec` (**Rules & n8n Export**): Live `ICP + Offer` and `Email Voice + Stage Rules` memory editor, 21-test spec verifier (`T1-T11` + `T1-T10`), Grok Bot skill/routine copy blocks, and importable n8n Cloud workflow JSON files.
- **Card Content Cap & Nested-Box Ban:** List cards show at most 3 data points (Name/Role, Score, Status dot). Zero bordered cards nested inside bordered cards.

## 5. Core Functional Components & Guardrails
- **Icon-Only Sun/Moon Theme Button:** `36x36px` button in the top header (`aria-label="Toggle color theme"`) with explicit `width="16" height="16"` SVG icons.
- **Guardrail Telemetry Strip:** Inline verification row below the draft editor confirming `300-400` character window, first-name-only rule, source URL citation, and zero banned phrases.
- **Collapsible Quick Command Bar:** Hidden until toggled so the primary workspace stays uncluttered; executes `approve 1, 2 · edit 3: <text> · skip 4 · do_not_contact 5`.

## 6. Motion & Accessibility
- Explicit `transform` and `opacity` transitions (`150ms cubic-bezier(0.23, 1, 0.32, 1)`), button active scale `0.98`, full `@media (prefers-reduced-motion: reduce)` support, and visible `:focus-visible` ring on all interactive controls.
