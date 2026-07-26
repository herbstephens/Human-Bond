import { NextResponse } from 'next/server';
import { getSession } from '@/lib/agents/activationSessions.server';

/**
 * Where a session got to. Safe to call after the mini app was closed and
 * reopened — the work continued on the server while the page was gone.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('sessionId');
  if (!id) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const session = getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: 'Unknown session — the server restarted, or it was never started here' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    agentAddress: session.agentAddress,
    phase: session.phase,
    polls: session.polls,
    txHash: session.txHash ?? null,
    error: session.error ?? null,
    events: session.events,
  });
}
