import { NextResponse } from 'next/server';

/**
 * Dev-only sink so the phone can talk to the terminal.
 *
 * Inside World App there is no console and no devtools, and a handoff to a
 * universal link can tear the page down mid-flow — taking the on-screen log with
 * it. Mirroring client events here means the terminal keeps the record even when
 * the page does not survive.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  const { tag, message } = (await request.json()) as { tag?: string; message?: string };
  console.info(`[phone${tag ? `:${tag}` : ''}] ${message ?? ''}`);
  return NextResponse.json({ ok: true });
}
