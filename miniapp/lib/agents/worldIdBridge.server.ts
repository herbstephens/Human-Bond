/**
 * The World ID bridge, server-side.
 *
 * Why not idkit-core's store: it reaches for `window.crypto` directly, so it
 * only runs in a browser — and a browser is exactly what we cannot rely on here.
 *
 * The problem this solves: World App does NOT render the verification sheet on
 * top of a mini app. It queues it in the main World App UI, so the human has to
 * CLOSE the mini app to accept — which tears the page down and kills any polling
 * living in it. The proof gets minted and nobody is left to collect it.
 *
 * Moving the session server-side makes closing the mini app irrelevant: the
 * server holds the key, keeps polling, and registers on its own. The human comes
 * back to a finished job.
 *
 * The protocol (mirrors idkit-core exactly, verified against its build output):
 *   POST {bridge}/request          {iv, payload}  -> {request_id}
 *   GET  {bridge}/response/{id}                   -> {status, response}
 * Payload and response are AES-GCM encrypted under a key that only we and the
 * link holder know — the bridge itself never sees the contents.
 */
import { encodeAction, generateSignal, solidityEncode } from '@worldcoin/idkit-core/hashing';

const BRIDGE_URL = 'https://bridge.worldcoin.org';
/** Orb-level verification asks for these credentials, same mapping as idkit. */
const ORB_CREDENTIALS = ['orb'] as const;

export type BridgeProof = {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  credential_type?: string;
  verification_level?: string;
};

export type BridgeSession = {
  requestId: string;
  /** Raw AES key, base64 — the same value the link carries in `k`. */
  keyB64: string;
  iv: Uint8Array;
  connectorURI: string;
};

function b64(buffer: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buffer as ArrayBuffer).toString('base64');
}

/**
 * Opens a bridge session for `app_id` — which is the entire point: unlike
 * MiniKit, the bridge lets us name the app the proof is minted under, so we can
 * target AgentKit's app and satisfy the global AgentBook's immutable nullifier.
 */
export async function createBridgeSession(params: {
  appId: `app_${string}`;
  action: string;
  agentAddress: `0x${string}`;
  nonce: bigint;
}): Promise<BridgeSession> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const request = JSON.stringify({
    app_id: params.appId,
    action: encodeAction(params.action),
    signal: generateSignal(
      solidityEncode(['address', 'uint256'], [params.agentAddress, params.nonce]),
    ).digest,
    credential_types: ORB_CREDENTIALS,
    verification_level: 'orb',
  });

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(request),
  );

  const res = await fetch(`${BRIDGE_URL}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ iv: b64(iv), payload: b64(ciphertext) }),
  });
  if (!res.ok) {
    throw new Error(`World ID bridge rejected the request: ${res.status} ${await res.text()}`);
  }
  const { request_id } = (await res.json()) as { request_id: string };

  const keyB64 = b64(await crypto.subtle.exportKey('raw', key));
  return {
    requestId: request_id,
    keyB64,
    iv,
    // world.org universal link — World App claims it at the OS level.
    connectorURI: `https://world.org/verify?t=wld&i=${request_id}&k=${encodeURIComponent(keyB64)}`,
  };
}

export type BridgePoll =
  | { status: 'awaiting_connection' | 'awaiting_app' }
  | { status: 'completed'; proof: BridgeProof };

/** One poll of the session. `completed` carries the decrypted proof. */
export async function pollBridge(session: BridgeSession): Promise<BridgePoll> {
  const res = await fetch(`${BRIDGE_URL}/response/${session.requestId}`);
  if (!res.ok) throw new Error(`Bridge poll failed: ${res.status}`);

  const { response, status } = (await res.json()) as {
    status: string;
    response?: { iv: string; payload: string };
  };
  if (status !== 'completed' || !response) {
    return { status: status === 'retrieved' ? 'awaiting_app' : 'awaiting_connection' };
  }

  // World App answers under its own IV, not the one we sent.
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(session.keyB64, 'base64'),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(response.iv, 'base64') },
    key,
    Buffer.from(response.payload, 'base64'),
  );
  return { status: 'completed', proof: JSON.parse(new TextDecoder().decode(plaintext)) as BridgeProof };
}
