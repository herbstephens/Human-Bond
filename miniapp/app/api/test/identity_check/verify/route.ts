import { NextResponse } from 'next/server';
import type { IDKitResult } from '@worldcoin/idkit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const result = (await request.json()) as IDKitResult;
    const rpId = process.env.AGENTKIT_RP_ID;
    if (!rpId) throw new Error('AGENTKIT_RP_ID must be set for the Identity Check test');
    if (!result?.protocol_version || !Array.isArray(result.responses)) {
      throw new Error('Identity Check returned an invalid IDKit result');
    }

    const response = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'humanbond-test-identity-check',
      },
      body: JSON.stringify(result),
    });
    const detail = await response.text();
    if (!response.ok) {
      console.error('[test-identity-check] World ID verification rejected', {
        status: response.status,
        detail,
      });
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    console.info('[test-identity-check] World ID verification accepted', {
      rpId,
      protocolVersion: result.protocol_version,
      identityAttested: 'identity_attested' in result ? result.identity_attested : null,
      responseCount: result.responses.length,
      verification: detail,
    });
    return NextResponse.json({ verification: JSON.parse(detail) });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error('[test-identity-check] verification failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
