import { NextResponse } from 'next/server';
import { readStore, writeStore, type VoiceMemory } from '@/lib/store';
import type { ICPMemory } from '@/lib/sdr-engine';
import {
  buildN8nWorkflow1Json,
  buildN8nWorkflow2Json,
  runAll21SpecTests,
} from '@/lib/crm-spec-engine';

export async function GET() {
  const store = readStore();
  const verification = runAll21SpecTests(store);
  return NextResponse.json({
    store,
    verification,
    n8nWorkflows: {
      workflow1: buildN8nWorkflow1Json(),
      workflow2: buildN8nWorkflow2Json(),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = readStore();

    if (body.action === 'update_memory') {
      const { icp, voice } = body as {
        icp?: Partial<ICPMemory>;
        voice?: Partial<VoiceMemory>;
      };
      if (icp) {
        store.icp = { ...store.icp, ...icp };
      }
      if (voice) {
        store.voice = { ...store.voice, ...voice };
      }
      writeStore(store);
      const verification = runAll21SpecTests(store);
      return NextResponse.json({ store, verification });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}
