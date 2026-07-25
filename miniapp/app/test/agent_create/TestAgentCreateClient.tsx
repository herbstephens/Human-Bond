'use client';

/**
 * AgentKit activation test — runs the real 0G KV, World ID, relay and AgentBook flow.
 *
 * TWO verification paths, picked from the environment:
 *
 *  - Inside World App → MiniKit.commandsAsync.verify. The proof is issued under
 *    the app the mini app was opened as (HumanBondMultisig), because MiniKit's
 *    VerifyCommandInput has no app_id field — it cannot target another app.
 *    Requires the `agentbook-registration` action to exist in OUR app.
 *  - Desktop browser → the original IDKit bridge, which DOES take an explicit
 *    app_id and therefore targets AgentKit's own app. Misha's flow, untouched.
 *
 * The open question this test answers: whether AgentBook accepts a proof whose
 * external nullifier derives from our app_id instead of AgentKit's. If the relay
 * rejects it, registration must stay outside the mini app and the app should only
 * READ `lookupHuman(agent)` to display human-backed status.
 */

import { useEffect, useState } from 'react';
import {
  createWorldBridgeStore,
  VerificationLevel,
  VerificationState,
} from '@worldcoin/idkit-core';
import { solidityEncode } from '@worldcoin/idkit-core/hashing';
import { MiniKit, VerificationLevel as MiniKitVerificationLevel } from '@worldcoin/minikit-js';
import { isInWorldApp } from '@/lib/worldcoin/initMiniKit';
import { AliveCta } from '@/app/components/agent/AliveCta';

type StartResult = {
  agentAddress: `0x${string}`;
  nonce: string;
  appId: `app_${string}`;
  action: string;
};

type CompleteResult = {
  agentAddress: `0x${string}`;
  txHash: `0x${string}`;
  registered: true;
  humanBacked: true;
};

type TestState = 'idle' | 'starting' | 'verifying' | 'registering' | 'complete' | 'failed';

/** What the proof commits to — must match on both paths or AgentBook rejects it. */
type ProofFields = { merkleRoot: string; nullifierHash: string; proof: string };

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    // The routes answer failures as { error }. Unwrap it so the phone shows the
    // real reason (relay/contract message) instead of a bare status code.
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // Not JSON — the raw text is already the best available detail.
    }
    throw new Error(detail || `Request failed with HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export function TestAgentCreateClient() {
  const [state, setState] = useState<TestState>('idle');
  const [agentAddress, setAgentAddress] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Detected after mount — isInWorldApp touches the browser only.
  const [inWorldApp, setInWorldApp] = useState(false);
  useEffect(() => setInWorldApp(isInWorldApp()), []);

  const log = (message: string) =>
    setEvents((current) => [...current, `${new Date().toLocaleTimeString()} — ${message}`]);

  /** World App path: one native sheet, proof comes straight back. */
  const verifyWithMiniKit = async (start: StartResult): Promise<ProofFields> => {
    log('Verifying with MiniKit (World App native sheet)');
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: start.action,
      signal: solidityEncode(['address', 'uint256'], [start.agentAddress, BigInt(start.nonce)]),
      verification_level: MiniKitVerificationLevel.Orb,
    });
    if (finalPayload.status === 'error') {
      throw new Error(
        `MiniKit verification failed: ${JSON.stringify(finalPayload)}. If this is an unknown-action error, the action must exist in THIS app (app_925d0aaa…).`,
      );
    }
    return {
      merkleRoot: finalPayload.merkle_root,
      nullifierHash: finalPayload.nullifier_hash,
      proof: finalPayload.proof,
    };
  };

  /** Desktop path: IDKit bridge, targets AgentKit's own app_id explicitly. */
  const verifyWithBridge = async (start: StartResult): Promise<ProofFields> => {
    const verificationWindow = window.open('', '_blank');
    try {
      if (!verificationWindow) throw new Error('World ID verification window was blocked');
      const worldId = createWorldBridgeStore();
      await worldId.getState().createClient({
        app_id: start.appId,
        action: start.action,
        signal: solidityEncode(['address', 'uint256'], [start.agentAddress, BigInt(start.nonce)]),
        verification_level: VerificationLevel.Orb,
      });

      const connectorUri = worldId.getState().connectorURI;
      if (!connectorUri) throw new Error('World ID returned no verification link');
      verificationWindow.location.href = connectorUri;
      log('World ID verification opened — scan with World App');

      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await worldId.getState().pollForUpdates();
        const current = worldId.getState();
        if (current.verificationState === VerificationState.Failed) {
          throw new Error(`World ID verification failed: ${current.errorCode ?? 'unknown error'}`);
        }
        if (current.result) {
          verificationWindow.close();
          return {
            merkleRoot: current.result.merkle_root,
            nullifierHash: current.result.nullifier_hash,
            proof: current.result.proof,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      throw new Error('World ID verification timed out after five minutes');
    } catch (caught) {
      verificationWindow?.close();
      throw caught;
    }
  };

  const run = async () => {
    setState('starting');
    setAgentAddress(null);
    setTxHash(null);
    setEvents([]);
    setError(null);
    log('Creating and encrypting a fresh agent key');

    try {
      const start = await responseJson<StartResult>(
        await fetch('/api/agent/activate/start', { method: 'POST' }),
      );
      setAgentAddress(start.agentAddress);
      log(`Encrypted key stored in 0G KV for ${start.agentAddress}`);

      setState('verifying');
      const fields = inWorldApp ? await verifyWithMiniKit(start) : await verifyWithBridge(start);

      setState('registering');
      log('Proof received; submitting AgentKit registration to the relay');
      const completed = await responseJson<CompleteResult>(
        await fetch('/api/agent/activate/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentAddress: start.agentAddress,
            nonce: start.nonce,
            merkleRoot: fields.merkleRoot,
            nullifierHash: fields.nullifierHash,
            proof: fields.proof,
          }),
        }),
      );

      setTxHash(completed.txHash);
      setState('complete');
      log('AgentBook confirmed the agent is human-backed');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Agent activation failed';
      setState('failed');
      setError(message);
      log(`FAILED: ${message}`);
    }
  };

  const busy = state === 'starting' || state === 'verifying' || state === 'registering';

  return (
    <main className="min-h-screen bg-[#171512] text-[#f3eadb] px-5 py-12">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">Activate a human-backed agent</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          This runs the real 0G KV, World ID, AgentKit relay, and AgentBook flow.
          Every click creates a new agent wallet.
        </p>

        {/* Which path will run — the whole point of this test. */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
            Verification path
          </p>
          <p className="mt-1 font-mono text-xs text-amber-300">
            {inWorldApp ? 'MiniKit · proof under HumanBondMultisig' : 'IDKit bridge · proof under AgentKit app'}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[#8f8372]">
            {inWorldApp
              ? 'Inside World App MiniKit cannot target another app, so the proof is issued under our app. If the relay rejects it, registration has to happen outside the mini app.'
              : 'Desktop uses the bridge, which targets AgentKit’s app_id directly. Open this page inside World App to test the mini-app path.'}
          </p>
        </div>

        <AliveCta
          onClick={run}
          disabled={busy}
          className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
        >
          {busy ? state : 'Create test agent'}
        </AliveCta>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Status
            </span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>

          {agentAddress && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                Agent address
              </p>
              <p className="mt-1 break-all font-mono text-xs">{agentAddress}</p>
            </div>
          )}

          {txHash && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                Registration transaction
              </p>
              <p className="mt-1 break-all font-mono text-xs">{txHash}</p>
            </div>
          )}

          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}

          <ol className="mt-6 space-y-2 border-t border-white/10 pt-5">
            {events.length === 0 ? (
              <li className="font-mono text-xs text-[#6f665a]">No test started.</li>
            ) : (
              events.map((event, index) => (
                <li key={`${index}-${event}`} className="font-mono text-xs text-[#b9ad9b]">
                  {event}
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}
