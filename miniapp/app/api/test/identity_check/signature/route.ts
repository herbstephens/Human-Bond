import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit/signing';
import { WORLD_APP_CONFIG } from '@/lib/contracts';

export const runtime = 'nodejs';

export const IDENTITY_CHECK_ACTION = 'humanbond-check-age';

export async function POST() {
  try {
    const rpId = process.env.AGENTKIT_RP_ID;
    const signingKey = process.env.AGENTKIT_RP_SIGNING_KEY;
    if (!rpId) throw new Error('AGENTKIT_RP_ID must be set for the Identity Check test');
    if (!signingKey) throw new Error('AGENTKIT_RP_SIGNING_KEY must be set for the Identity Check test');

    const signature = signRequest({
      signingKeyHex: signingKey,
      action: IDENTITY_CHECK_ACTION,
      ttl: 300,
    });

    console.info('[test-identity-check] created RP context', {
      appId: WORLD_APP_CONFIG.APP_ID,
      action: IDENTITY_CHECK_ACTION,
      rpId,
      expiresAt: signature.expiresAt,
    });

    return NextResponse.json({
      appId: WORLD_APP_CONFIG.APP_ID,
      action: IDENTITY_CHECK_ACTION,
      rpContext: {
        rp_id: rpId,
        nonce: signature.nonce,
        created_at: signature.createdAt,
        expires_at: signature.expiresAt,
        signature: signature.sig,
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error('[test-identity-check] signature failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
