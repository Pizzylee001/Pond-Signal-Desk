import { describe, it, expect } from 'vitest';
import {
  LEADS_COLUMNS,
  RUNS_COLUMNS,
  DEALS_COLUMNS,
  DEBRIEFS_COLUMNS,
  exportTabToCsv,
  runAll21SpecTests,
  buildN8nWorkflow1Json,
  buildN8nWorkflow2Json,
} from '../crm-spec-engine';
import { readStore } from '../store';

describe('Phase 3: 4-Tab CRM Schema, 21-Test Spec Verifier & n8n Cloud Workflows', () => {
  it('verifies exact column schemas for Leads (24), Runs (11), Deals (20), and Debriefs (28) and exports valid CSV', () => {
    expect(LEADS_COLUMNS).toHaveLength(24);
    expect(RUNS_COLUMNS).toHaveLength(11);
    expect(DEALS_COLUMNS).toHaveLength(20);
    expect(DEBRIEFS_COLUMNS).toHaveLength(28);

    const store = readStore();
    const leadsCsv = exportTabToCsv('Leads', store);
    const lines = leadsCsv.trim().split('\n');
    expect(lines[0]).toBe(LEADS_COLUMNS.join(','));
    expect(lines.length).toBeGreaterThanOrEqual(11); // header + 10 leads
  });

  it('runs all 21 spec tests (Workflow 1 T1-T11 and Workflow 2 T1-T10) with 100% pass rate and evidence', () => {
    const store = readStore();
    const report = runAll21SpecTests(store);
    expect(report.workflow1Tests).toHaveLength(11);
    expect(report.workflow2Tests).toHaveLength(10);
    expect(report.workflow1Tests.every(t => t.passed)).toBe(true);
    expect(report.workflow2Tests.every(t => t.passed)).toBe(true);
    expect(report.totalPassed).toBe(21);
  });

  it('generates valid n8n Cloud v2.46.6 workflow JSONs with exact spec cron schedules and nodes', () => {
    const wf1 = buildN8nWorkflow1Json();
    expect(wf1.name).toContain('Warm Signal SDR');
    expect(Array.isArray(wf1.nodes)).toBe(true);
    expect(wf1.nodes.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(wf1)).toContain('0 7 * * 1-5');

    const wf2 = buildN8nWorkflow2Json();
    expect(wf2.name).toContain('Deal Debrief');
    expect(Array.isArray(wf2.nodes)).toBe(true);
    expect(wf2.nodes.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(wf2)).toContain('*/15 8-19 * * 1-5');
  });
});
