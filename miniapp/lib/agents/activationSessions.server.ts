/**
 * Activation sessions that outlive the mini app.
 *
 * World App queues its verification sheet in the main UI, not on top of the mini
 * app, so the human must close the mini app to accept. Anything waiting inside
 * that page dies with it. This module keeps the wait on the server: it polls the
 * bridge, and the moment the proof lands it drives the AgentKit registration
 * through to AgentBook. The human reopens the mini app to a finished job.
 *
 * In-memory by design — dev/demo scope, one process. A restart loses in-flight
 * sessions, which is acceptable for a flow the human can simply run again.
 */
import { createBridgeSession, pollBridge, type BridgeSession } from './worldIdBridge.server';

export type ActivationPhase =
  | 'awaiting_connection'
  | 'awaiting_app'
  | 'registering'
  | 'complete'
  | 'failed';

export type ActivationSession = {
  id: string;
  agentAddress: `0x${string}`;
  nonce: string;
  connectorURI: string;
  phase: ActivationPhase;
  txHash?: `0x${string}`;
  error?: string;
  events: string[];
  bridge: BridgeSession;
  polls: number;
};

const sessions = new Map<string, ActivationSession>();

/** Every step is narrated: the phone has no console, the terminal is the record. */
function note(session: ActivationSession, message: string): void {
  const line = `${new Date().toLocaleTimeString()} — ${message}`;
  session.events.push(line);
  console.info(`[activation:${session.id.slice(0, 8)}] ${message}`);
}

export function getSession(id: string): ActivationSession | null {
  return sessions.get(id) ?? null;
}

export async function startActivation(params: {
  agentAddress: `0x${string}`;
  nonce: string;
  appId: `app_${string}`;
  action: string;
  /** Called once the proof arrives; returns the AgentBook tx hash. */
  register: (proof: {
    merkleRoot: string;
    nullifierHash: string;
    proof: string;
  }) => Promise<`0x${string}`>;
}): Promise<ActivationSession> {
  const bridge = await createBridgeSession({
    appId: params.appId,
    action: params.action,
    agentAddress: params.agentAddress,
    nonce: BigInt(params.nonce),
  });

  const session: ActivationSession = {
    id: crypto.randomUUID(),
    agentAddress: params.agentAddress,
    nonce: params.nonce,
    connectorURI: bridge.connectorURI,
    phase: 'awaiting_connection',
    events: [],
    bridge,
    polls: 0,
  };
  sessions.set(session.id, session);
  note(session, `bridge session open for ${params.agentAddress} under ${params.appId}`);

  void pumpUntilDone(session, params.register);
  return session;
}

/** Polls until the proof lands, then registers. Runs detached from any request. */
async function pumpUntilDone(
  session: ActivationSession,
  register: Parameters<typeof startActivation>[0]['register'],
): Promise<void> {
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    session.polls += 1;

    let poll;
    try {
      poll = await pollBridge(session.bridge);
    } catch (caught) {
      // Transient bridge failures are normal while the sheet is open; only a
      // silent stall would be a problem, and the heartbeat below exposes that.
      if (session.polls % 15 === 0) {
        note(session, `poll #${session.polls}: transient error — ${String(caught)}`);
      }
      continue;
    }

    if (poll.status !== 'completed') {
      if (poll.status !== session.phase) {
        session.phase = poll.status;
        note(session, `poll #${session.polls}: ${poll.status}`);
      } else if (session.polls % 15 === 0) {
        note(session, `poll #${session.polls}: still ${poll.status}`);
      }
      continue;
    }

    note(session, `proof received after ${session.polls} polls — registering with AgentBook`);
    session.phase = 'registering';
    try {
      session.txHash = await register({
        merkleRoot: poll.proof.merkle_root,
        nullifierHash: poll.proof.nullifier_hash,
        proof: poll.proof.proof,
      });
      session.phase = 'complete';
      note(session, `registered — tx ${session.txHash}`);
    } catch (caught) {
      session.phase = 'failed';
      session.error = caught instanceof Error ? caught.message : String(caught);
      note(session, `registration FAILED — ${session.error}`);
    }
    return;
  }

  session.phase = 'failed';
  session.error = 'Verification timed out after ten minutes';
  note(session, session.error);
}
